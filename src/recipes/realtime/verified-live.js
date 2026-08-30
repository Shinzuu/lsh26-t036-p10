/**
 * Verified live updates — a thin wrapper over `live.js` that refuses to claim
 * the feed is working until it has proved it.
 *
 * WHAT THIS IS NOT
 * It is not a second realtime implementation. `live.js` owns the transport:
 * the three tiers, the reconnect backoff, and `createSharedChannel`'s
 * multi-subscriber safety. Nothing here duplicates that, and nothing here
 * opens a channel of its own.
 *
 * THE GAP IT FILLS
 * The 27 Aug drill lost ~15–17 marks, billed across five scoring categories,
 * to a feed that was up and silent. `createSharedChannel` fixed the collision
 * half of that. The other half is still live in `live.js` today:
 *
 *     if (channelStatus === 'SUBSCRIBED') setStatus(table, 'live')
 *
 * `SUBSCRIBED` means the socket opened. It does not mean rows are being
 * published to it. On the night a correctly-built channel reported SUBSCRIBED,
 * the insert succeeded, and zero events ever arrived — the tables were (or may
 * have been) missing from the `supabase_realtime` publication, which no client
 * code can detect and no channel architecture can fix. The status pill read
 * green over a dead feed for four widgets at once, underneath a "Update filed"
 * success message. A judge reads that as dishonesty, not latency.
 *
 * THE RULE
 * Poll from t=0. Keep polling until the transport delivers a real event with
 * its own hands. Only then stop polling and report 'live'. A feed that never
 * delivers therefore degrades to a 5-second poll — debrief rule R3's exact
 * prescription, "for realtime: a dumb 5-s poll behind the same interface" —
 * instead of degrading to silence.
 *
 * STATUS VALUES
 *   'connecting' — nothing has reported in yet
 *   'polling'    — updates ARE flowing, via the poll; the feed is unproven
 *                  (this is the state `live.js` currently calls 'live')
 *   'live'       — the feed has delivered at least one event; poll stopped
 *   'offline'    — transport degraded and no poll is configured to cover it
 *
 * Collapsing 'polling' into 'live' is the precise lie this module exists to
 * prevent, which is why it is a fourth value rather than a remap.
 *
 * NO NEW DEPENDENCIES. Transport, snapshot reader, clock and scheduler are all
 * injected, so the tests drive it with a fake adapter and a manual clock — no
 * network, no timers, no Supabase project.
 *
 * @example
 *   import { live } from './live.js'
 *   import { createVerifiedLive, liveTransport } from './verified-live.js'
 *
 *   const verified = createVerifiedLive({
 *     connect: liveTransport(live),
 *     fetchRows: (table) => db.list(table),   // the poll's snapshot reader
 *   })
 *   const stop = verified.subscribe('updates', (e) => refresh(e))
 *   verified.onStatus('updates', (s) => setPill(s))   // 'live' now means proven
 */
import { createDeduper, diffRows } from './live.js'

const DEFAULT_POLL_MS = 5000

/**
 * Adapts `live.js`'s public API to the transport contract below. This is the
 * whole integration: `live.subscribe` supplies events, `live.onStatus`
 * supplies connectivity, and `live.js` keeps owning reconnection.
 *
 * The mapping is the point: `live`'s own 'live' becomes merely 'connected'
 * here — socket up, nothing proved.
 *
 * @param {{subscribe: Function, onStatus: Function}} liveAdapter
 * @returns {(table: string, cbs: {onEvent: Function, onStatus: Function}) => {close: Function}}
 */
export function liveTransport(liveAdapter) {
  return function connect(table, { onEvent, onStatus }) {
    const stopEvents = liveAdapter.subscribe(table, (event) => onEvent(event))
    const stopStatus = liveAdapter.onStatus(table, (status) =>
      onStatus(status === 'live' ? 'connected' : 'degraded')
    )
    return {
      close() {
        stopEvents?.()
        stopStatus?.()
      },
    }
  }
}

/**
 * @param {object} opts
 * @param {Function} opts.connect transport: `(table, {onEvent, onStatus}) => {close}`.
 *   `onStatus` receives 'connected' | 'degraded'. The transport owns reconnection.
 * @param {(table: string) => Promise<object[]>} [opts.fetchRows] snapshot reader for
 *   the poll tier. OMITTING IT REMOVES THE SAFETY NET — without it a silent feed
 *   is silent, which is the drill bug verbatim. The status reflects that honestly.
 * @param {number} [opts.pollMs=5000] R3's "dumb 5-s poll"
 * @param {number} [opts.dedupeMs=5000]
 * @param {{setInterval: Function, clearInterval: Function}} [opts.timers]
 * @param {() => number} [opts.now]
 * @param {(err: Error, ctx: {table: string, phase: string}) => void} [opts.onError]
 */
export function createVerifiedLive({
  connect,
  fetchRows = null,
  pollMs = DEFAULT_POLL_MS,
  dedupeMs = 5000,
  timers = { setInterval, clearInterval },
  now = () => Date.now(),
  onError = () => {},
} = {}) {
  if (typeof connect !== 'function') throw new TypeError('createVerifiedLive requires a `connect` transport')

  const statusValues = new Map()
  const statusListeners = new Map()
  // Proof-of-life is a fact about the TABLE, not about any one subscription.
  // Without this, a second `subscribe()` call on a table already proven live
  // starts from its own private `verified = false` and drags the shared
  // status back down through 'connecting'/'polling' the instant it mounts —
  // exactly the "status pill regresses" bug this module exists to prevent,
  // just reintroduced in the other direction. See verified-live.test.mjs.
  const verifiedTables = new Set()
  const subscriberCounts = new Map()
  // Concurrent `pollOnce()` calls across subscribers of the same table share
  // one real `fetchRows` — N widgets on one table should cost one read per
  // tick, not N (the module's own "four widgets at once" motivating incident).
  const inflightFetches = new Map()

  function setStatus(table, value) {
    // `onStatus` reports 'connecting' for a table it has never seen, so treat
    // an absent entry as already-'connecting' — otherwise a listener that
    // registers before `subscribe()` is told 'connecting' twice.
    const previous = statusValues.get(table) ?? 'connecting'
    statusValues.set(table, value)
    if (previous === value) return
    for (const cb of statusListeners.get(table) ?? []) {
      try {
        cb(value)
      } catch (err) {
        onError(err, { table, phase: 'status' })
      }
    }
  }

  function subscribe(table, handler) {
    const dedupe = createDeduper(dedupeMs)
    let stopped = false
    let snapshot = null
    let pollTimer = null
    let conn = null
    let pollFailures = 0

    function verified() {
      return verifiedTables.has(table)
    }

    // A handler that throws is a bug in the component, not a reason to tear
    // down the subscription underneath every other component.
    function emit(event, source) {
      if (stopped) return
      const full = { table, ...event, source, at: now() }
      if (dedupe.isDuplicate(keyOf(full), now())) return
      try {
        handler(full)
      } catch (err) {
        onError(err, { table, phase: 'handler' })
      }
    }

    // 'polling' is only honest once a fetch has actually succeeded — an
    // interval that has only ever thrown is a silent feed with a green-ish
    // label on it, the exact failure this module exists to prevent, one
    // layer down in the poll transport (e.g. an RLS-denied table).
    let pollProven = false

    function pollStatusWhileUnverified() {
      return fetchRows && pollProven ? 'polling' : 'connecting'
    }

    async function pollOnce() {
      if (stopped || !fetchRows) return
      let rows
      try {
        let inflight = inflightFetches.get(table)
        if (!inflight) {
          inflight = Promise.resolve()
            .then(() => fetchRows(table))
            .finally(() => inflightFetches.delete(table))
          inflightFetches.set(table, inflight)
        }
        rows = await inflight
      } catch (err) {
        // The inflight fetch may be shared with another (possibly since-
        // unsubscribed) subscription — check `stopped` before touching
        // anything this subscription no longer owns.
        if (stopped) return
        onError(err, { table, phase: 'poll' })
        pollFailures += 1
        // Matches live.js's own reconnect-tier threshold (3 consecutive
        // failures -> 'offline') so a permanently failing fetch (RLS denial,
        // a dropped table) degrades honestly instead of sitting at 'polling'
        // forever with zero rows ever delivered.
        if (!verified() && pollFailures >= 3) setStatus(table, 'offline')
        return
      }
      if (stopped) return
      pollFailures = 0
      pollProven = true
      if (!verified()) setStatus(table, 'polling')
      if (!Array.isArray(rows)) return
      if (snapshot === null) {
        // The first read is a baseline. Emitting it would replay the entire
        // table into the handler as INSERTs on mount.
        snapshot = rows
        return
      }
      const events = diffRows(snapshot, rows)
      snapshot = rows
      for (const event of events) emit(event, 'poll')
    }

    function startPolling() {
      if (stopped || !fetchRows || pollTimer !== null) return
      if (!verified()) setStatus(table, pollStatusWhileUnverified())
      pollOnce()
      pollTimer = timers.setInterval(pollOnce, pollMs)
    }

    function stopPolling() {
      if (pollTimer === null) return
      timers.clearInterval(pollTimer)
      pollTimer = null
    }

    function onEvent(event) {
      if (stopped) return
      if (!verified()) {
        // A delivered event is the only evidence that means anything.
        // 'SUBSCRIBED' never was.
        verifiedTables.add(table)
        stopPolling()
        setStatus(table, 'live')
      }
      emit(event, 'realtime')
    }

    function onStatus(state) {
      if (stopped) return
      if (state === 'connected') {
        // Deliberately NOT 'live' — see the module doc.
        if (!verified()) setStatus(table, pollStatusWhileUnverified())
        return
      }
      // 'degraded': whatever the transport proved before, it is not proving it
      // now. Fall back and stop claiming the feed works.
      verifiedTables.delete(table)
      startPolling()
      if (!fetchRows) setStatus(table, 'offline')
    }

    subscriberCounts.set(table, (subscriberCounts.get(table) ?? 0) + 1)

    // A table another subscriber has already proven live stays 'live' for a
    // late joiner too — it must not re-announce 'connecting' or start its own
    // poll on a feed that's already proven. Only a real 'degraded' report (or
    // the last subscriber leaving) may take that fact back.
    if (!verified()) {
      setStatus(table, 'connecting')
      startPolling() // before the transport, not after — cover the gap from t=0
    }
    try {
      conn = connect(table, { onEvent, onStatus })
    } catch (err) {
      onError(err, { table, phase: 'connect' })
      if (!verified() && !fetchRows) setStatus(table, 'offline')
    }

    return function unsubscribe() {
      if (stopped) return
      stopped = true
      stopPolling()
      const remaining = (subscriberCounts.get(table) ?? 1) - 1
      if (remaining <= 0) {
        subscriberCounts.delete(table)
        verifiedTables.delete(table)
      } else {
        subscriberCounts.set(table, remaining)
      }
      try {
        conn?.close()
      } catch (err) {
        onError(err, { table, phase: 'close' })
      }
      conn = null
    }
  }

  return {
    subscribe,
    /** Current status for `table`. See STATUS VALUES in the module doc. */
    status(table) {
      return statusValues.get(table) ?? 'connecting'
    },
    /** Fires immediately with the current value, then on every change. */
    onStatus(table, cb) {
      if (!statusListeners.has(table)) statusListeners.set(table, new Set())
      statusListeners.get(table).add(cb)
      cb(statusValues.get(table) ?? 'connecting')
      return () => statusListeners.get(table)?.delete(cb)
    },
  }
}

/**
 * Dedupe key. The poll and the transport describe the same change differently
 * — a poll UPDATE carries the previous snapshot as `old`, Postgres carries its
 * own — so keying on row identity plus new contents is what actually collapses
 * the pair into a single delivery.
 */
function keyOf(event) {
  const payload = event.eventType === 'DELETE' ? event.old : event.row
  const id = payload?.id ?? ''
  return `${event.table}:${event.eventType}:${id}:${JSON.stringify(payload ?? null)}`
}
