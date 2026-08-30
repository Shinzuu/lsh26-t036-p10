/**
 * Live-updates adapter.
 *
 * WHY THIS EXISTS
 * "Someone else just changed this" is the moment a judge remembers — one
 * person edits on a laptop, the other's phone updates with no refresh. It is
 * also the single easiest thing to half-build: a version that only works in
 * one tab, on one machine, demos great alone at your desk and then does
 * nothing on stage when the judge's phone is the second device.
 *
 * Three backends, picked automatically - same trick as ../../lib/db.js:
 *
 *   VITE_SUPABASE_URL set        -> Supabase Realtime. `postgres_changes` on
 *                                    the table, so a real second device (the
 *                                    judge's phone) sees the change.
 *   no env vars, BroadcastChannel
 *   available (every modern
 *   browser, including Node 18+)  -> BroadcastChannel. Same-browser,
 *                                    multiple tabs, works fully offline -
 *                                    the demo still works with zero setup.
 *   neither                      -> interval polling against the same
 *                                    `hack:<table>` localStorage key db.js's
 *                                    local backend already writes. Last
 *                                    resort, but never nothing.
 *
 * Same call sites in every tier: live.subscribe(table, handler) and
 * live.publish(table, event). Never throws - a dropped websocket or a full
 * BroadcastChannel buffer should degrade the status pill, not the app.
 *
 * publish() exists because the local tiers have no server pushing changes
 * for them. Call it right after a successful db.insert/update/remove with
 * the row you just wrote - see README.md "gotcha 1". The Supabase tier
 * ignores it: Postgres is already the source of truth there, and
 * `postgres_changes` fires from the real write, not from this call.
 */

const env = import.meta.env ?? {}
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined'

export const backend = url && anonKey ? 'supabase' : hasBroadcastChannel ? 'broadcast' : 'poll'

let client = null
async function supabase() {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(url, anonKey)
  }
  return client
}

// --- pure helpers (exported for tests - no network, no storage, no timers) -

/**
 * Exponential backoff with a cap. `attempt` is a 1-based count of
 * consecutive failures. Used to space out Supabase reconnect attempts so a
 * bad network doesn't hammer the socket in a tight loop.
 */
export function nextBackoffDelay(attempt, { baseMs = 1000, maxMs = 30000 } = {}) {
  const clamped = Math.max(1, attempt)
  return Math.min(baseMs * 2 ** (clamped - 1), maxMs)
}

/**
 * Stable identity for a change event, keyed on *content* rather than a
 * timestamp - a duplicate delivery of the exact same row (Supabase
 * redelivering on reconnect, or a stray poll tick catching a row a
 * BroadcastChannel message already announced) produces the same key, while a
 * genuinely new change to the same row does not.
 */
export function eventKey(event) {
  const payload = event.eventType === 'DELETE' ? event.old : event.row
  const id = payload?.id ?? event.row?.id ?? event.old?.id ?? ''
  return `${event.table}:${event.eventType}:${id}:${JSON.stringify(payload ?? null)}`
}

/**
 * Small time-windowed set. `isDuplicate` both checks and records in one
 * call - the same shape as most "have I seen this before" caches - and
 * sweeps its own expired entries so it can't grow forever across a long
 * demo.
 */
export function createDeduper(windowMs = 5000) {
  const seen = new Map() // key -> expiry
  return {
    isDuplicate(key, now = Date.now()) {
      for (const [k, expiry] of seen) {
        if (expiry <= now) seen.delete(k)
      }
      if (seen.has(key)) return true
      seen.set(key, now + windowMs)
      return false
    },
    size() {
      return seen.size
    },
  }
}

/**
 * Diff two snapshots of a table (arrays of rows with an `id`) into change
 * events. This is the poll tier's entire "detect a change" logic, pulled out
 * as a pure function so it's testable without a timer or localStorage.
 */
export function diffRows(previous, current) {
  const before = new Map(previous.map((r) => [r.id, r]))
  const after = new Map(current.map((r) => [r.id, r]))
  const events = []

  for (const [id, row] of after) {
    const prior = before.get(id)
    if (!prior) events.push({ eventType: 'INSERT', row, old: null })
    else if (JSON.stringify(prior) !== JSON.stringify(row)) events.push({ eventType: 'UPDATE', row, old: prior })
  }
  for (const [id, row] of before) {
    if (!after.has(id)) events.push({ eventType: 'DELETE', row: null, old: row })
  }
  return events
}

/**
 * Generic multi-subscriber-safe wrapper around one shared resource per
 * `key` - this is the README's gotcha 4 HARD WARNING, extracted so the exact
 * mechanism it requires is a pure function with its own tests instead of
 * logic buried inside a network-dependent tier. Supabase forbids adding a
 * `postgres_changes` callback to a channel that has already called
 * `.subscribe()`, so every table can have exactly one live channel for the
 * whole app, ever - never one per caller. `subscribeSupabase` below is a
 * thin wrapper around this: `open` builds that one channel and fans
 * incoming events out to every listener in the shared Set; `close` tears it
 * down only once the last listener has left. Same shape for any other
 * single-socket-per-key resource, which is why it's tested here directly
 * rather than only through the Supabase tier (which needs a real project -
 * see "Verifying this recipe" in README.md).
 *
 * Returns a `subscribe(key, listener)` function. Calling it:
 *   - for a `key` with no existing listeners calls `open(key, emitToAll)`
 *     once and keeps whatever it returns as that key's resource.
 *   - for a `key` that already has listeners just adds to the shared Set -
 *     no second `open()` call, no second real subscription.
 *   - returns an unsubscribe function; once the last listener for a `key`
 *     unsubscribes, `close(key, resource)` runs once and the key is
 *     forgotten entirely, so the *next* subscribe for that key calls
 *     `open()` again from scratch - a fresh resource, not the torn-down one.
 */
export function createSharedChannel({ open, close }) {
  const listeners = new Map() // key -> Set<listener>
  const resources = new Map() // key -> whatever open() returned

  return function subscribe(key, listener) {
    if (!listeners.has(key)) listeners.set(key, new Set())
    const set = listeners.get(key)
    set.add(listener)

    if (!resources.has(key)) {
      function emitToAll(event) {
        for (const fn of [...set]) {
          try {
            fn(event)
          } catch {
            // One bad listener (a bad render, a bad assumption about the
            // payload) must not take the shared resource - or any other
            // listener on it - down with it.
          }
        }
      }
      resources.set(key, open(key, emitToAll))
    }

    return () => {
      set.delete(listener)
      if (set.size > 0) return // other subscribers still need this resource

      listeners.delete(key)
      const resource = resources.get(key)
      resources.delete(key)
      close(key, resource)
    }
  }
}

// --- connection status: table-scoped, "fires immediately" like auth.subscribe

const statusValues = new Map() // table -> 'live' | 'reconnecting' | 'offline'
const statusListeners = new Map() // table -> Set<callback>

function setStatus(table, value) {
  if (statusValues.get(table) === value) return
  statusValues.set(table, value)
  for (const cb of statusListeners.get(table) ?? []) cb(value)
}

/** Current status for `table`, synchronously. 'offline' before the first subscribe. */
function status(table) {
  return statusValues.get(table) ?? 'offline'
}

/**
 * Watch the connection status for `table`. Fires immediately with the
 * current value, then again on every change. Returns an unsubscribe
 * function - same contract as auth.js's `subscribe`.
 */
function onStatus(table, callback) {
  if (!statusListeners.has(table)) statusListeners.set(table, new Set())
  const set = statusListeners.get(table)
  set.add(callback)
  callback(status(table))
  return () => set.delete(callback)
}

// --- shared dispatch: every tier's incoming event funnels through here ----

function emit(table, handler, event, dedupe) {
  const full = { table, source: backend, at: event.at ?? Date.now(), old: null, row: null, ...event }
  if (dedupe && dedupe.isDuplicate(eventKey(full))) return
  try {
    handler(full)
  } catch {
    // A handler that throws (a bad render, a bad assumption about the
    // payload) should not take the subscription down with it.
  }
}

// --- Supabase tier -----------------------------------------------------------
//
// HARD WARNING (README.md gotcha 4): Supabase forbids adding a
// `postgres_changes` callback to a channel that has already called
// `.subscribe()` - do that twice for the same table (e.g. two `LiveList`
// instances, or one that unmounts and remounts on a tab switch) and you get
// a runtime crash, not a silent no-op. This shipped broken to judging in the
// 27 Aug drill because the fix was documented here but never applied to this
// file's own subscribeSupabase - each call built its own `sb.channel(...)`.
// `createSharedChannel` above is the fix, applied once, inside the module:
// one channel per table for the whole app, created before its one
// `.subscribe()` call, fanned out to a listener Set, torn down with
// `removeChannel` only once the last listener leaves.

const subscribeSharedTable = createSharedChannel({
  open(table, emitToAll) {
    const state = { channel: null, attempt: 0, backoffTimer: null, cancelled: false, dedupe: createDeduper() }

    function connect() {
      if (state.cancelled) return
      supabase().then((sb) => {
        if (state.cancelled) return
        state.channel = sb
          .channel(`live:${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
            const event = { eventType: payload.eventType, row: payload.new ?? null, old: payload.old ?? null }
            const full = { table, source: backend, at: event.at ?? Date.now(), old: null, row: null, ...event }
            // Dedupe once for the shared incoming stream, then fan out the
            // already-deduped event - checking per listener would flag the
            // 2nd..Nth listener's own delivery of the same event as a
            // duplicate of the 1st's.
            if (state.dedupe.isDuplicate(eventKey(full))) return
            emitToAll(full)
          })
          .subscribe((channelStatus) => {
            if (state.cancelled) return
            if (channelStatus === 'SUBSCRIBED') {
              state.attempt = 0
              setStatus(table, 'live')
            } else if (
              channelStatus === 'CHANNEL_ERROR' ||
              channelStatus === 'TIMED_OUT' ||
              channelStatus === 'CLOSED'
            ) {
              scheduleReconnect()
            }
          })
      })
    }

    function scheduleReconnect() {
      if (state.cancelled) return
      state.attempt += 1
      // A single blip reads as "reconnecting"; several in a row read as
      // "offline" so the pill doesn't lie about a socket that's been down a while.
      setStatus(table, state.attempt >= 3 ? 'offline' : 'reconnecting')
      clearTimeout(state.backoffTimer)
      state.backoffTimer = setTimeout(() => {
        if (state.channel) client?.removeChannel(state.channel)
        state.channel = null
        connect()
      }, nextBackoffDelay(state.attempt))
    }

    setStatus(table, 'reconnecting') // connecting, not live yet
    connect()
    return state
  },

  close(table, state) {
    state.cancelled = true
    clearTimeout(state.backoffTimer)
    if (state.channel) client?.removeChannel(state.channel)
    setStatus(table, 'offline')
  },
})

function subscribeSupabase(table, handler) {
  return subscribeSharedTable(table, handler)
}

// --- BroadcastChannel tier ---------------------------------------------------

const channelName = (table) => `hack:live:${table}`

function subscribeBroadcast(table, handler) {
  const dedupe = createDeduper()
  const bc = new BroadcastChannel(channelName(table))
  bc.onmessage = (e) => {
    const event = e.data
    if (!event || event.table !== table) return
    emit(table, handler, event, dedupe)
  }
  setStatus(table, 'live') // same-browser channel: either it exists or it doesn't, no reconnect state
  return () => {
    bc.close()
    setStatus(table, 'offline')
  }
}

function publishBroadcast(table, event) {
  try {
    const bc = new BroadcastChannel(channelName(table))
    // BroadcastChannel never delivers a message back to its own sender, so
    // the tab that just wrote never double-applies its own optimistic update.
    bc.postMessage({ table, at: Date.now(), ...event })
    bc.close()
  } catch {
    // Some locked-down webviews throw on `new BroadcastChannel`. The demo
    // keeps working; that tab just won't get the instant cross-tab nudge.
  }
}

// --- polling tier -------------------------------------------------------------

const POLL_INTERVAL_MS = 2500

// Reads the exact key db.js's local backend writes (`hack:<table>`), so the
// poll tier sees real data without importing db.js - see README.md gotcha 2.
function readLocalRows(table) {
  try {
    return JSON.parse(localStorage.getItem(`hack:${table}`) ?? '[]')
  } catch {
    return []
  }
}

// table -> Set<() => void>, so publish() can force an out-of-cycle check
// instead of making every local write wait for the next tick.
const pollCheckers = new Map()

function subscribePoll(table, handler) {
  const dedupe = createDeduper()
  let last = readLocalRows(table)

  function check() {
    const current = readLocalRows(table)
    for (const event of diffRows(last, current)) emit(table, handler, event, dedupe)
    last = current
  }

  if (!pollCheckers.has(table)) pollCheckers.set(table, new Set())
  pollCheckers.get(table).add(check)
  setStatus(table, 'live')
  const timer = setInterval(check, POLL_INTERVAL_MS)

  return () => {
    clearInterval(timer)
    pollCheckers.get(table)?.delete(check)
    setStatus(table, 'offline')
  }
}

function publishPoll(table) {
  for (const check of pollCheckers.get(table) ?? []) check()
}

// --- public API ---------------------------------------------------------------

export const live = {
  /**
   * Subscribe to changes on `table`. `handler` receives
   * `{ table, eventType: 'INSERT'|'UPDATE'|'DELETE', row, old, source, at }`.
   * Returns an unsubscribe function - call it from an `$effect` cleanup.
   */
  subscribe(table, handler) {
    if (backend === 'supabase') return subscribeSupabase(table, handler)
    if (backend === 'broadcast') return subscribeBroadcast(table, handler)
    return subscribePoll(table, handler)
  },

  /**
   * Announce a change you just made locally (after a successful
   * db.insert/update/remove). No-op on the Supabase tier. See the module
   * doc above and README.md gotcha 1.
   */
  publish(table, event) {
    if (backend === 'broadcast') publishBroadcast(table, event)
    else if (backend === 'poll') publishPoll(table)
    // supabase: nothing to do - the real write already triggered postgres_changes.
  },

  /** Current connection status for `table`: 'live' | 'reconnecting' | 'offline'. */
  status,

  /** Watch connection status for `table`. Fires immediately, then on every change. */
  onStatus,
}
