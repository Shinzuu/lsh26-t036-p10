/**
 * Tests for verified-live.js.
 *
 * These cover what the 27 Aug drill's 66 green tests did not, and therefore
 * gave false confidence about: a transport that reports itself connected and
 * then delivers nothing. That is what actually happened on the night, and no
 * test in the repo could have caught it.
 *
 * The transport is faked, so `live.js`'s own tiers are not re-tested here —
 * they have their own suite, and `createSharedChannel` covers the
 * multi-subscriber half separately.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createVerifiedLive, liveTransport } from './verified-live.js'

// --- doubles -----------------------------------------------------------------

function fakeTimers() {
  let seq = 0
  const intervals = new Map()
  return {
    api: {
      setInterval(fn) {
        intervals.set(++seq, fn)
        return seq
      },
      clearInterval(id) {
        intervals.delete(id)
      },
    },
    tick() {
      for (const fn of [...intervals.values()]) fn()
    },
    count: () => intervals.size,
  }
}

/**
 * Stands in for `live` — same three methods verified-live actually uses.
 * Multiple `subscribe`/`onStatus` calls on the same table fan out from one
 * shared set, and `onStatus` fires immediately with the *current cached*
 * status rather than always 'reconnecting' — that's what `createSharedChannel`
 * actually does for a second subscriber joining an already-open channel, and
 * getting this wrong here would hide the multi-subscriber status bug instead
 * of catching it.
 */
function fakeLive() {
  const handlers = new Map() // table -> Set<handler>
  const statusCbs = new Map() // table -> Set<cb>
  const currentStatus = new Map() // table -> last status this table saw
  let unsubscribes = 0
  return {
    unsubscribes: () => unsubscribes,
    subscribe(table, handler) {
      if (!handlers.has(table)) handlers.set(table, new Set())
      handlers.get(table).add(handler)
      return () => {
        unsubscribes += 1
        handlers.get(table)?.delete(handler)
      }
    },
    onStatus(table, cb) {
      if (!statusCbs.has(table)) statusCbs.set(table, new Set())
      statusCbs.get(table).add(cb)
      cb(currentStatus.get(table) ?? 'reconnecting') // live.js fires immediately
      return () => {
        unsubscribes += 1
        statusCbs.get(table)?.delete(cb)
      }
    },
    // test controls
    deliver(table, event) {
      for (const handler of handlers.get(table) ?? []) handler(event)
    },
    setStatus(table, value) {
      currentStatus.set(table, value)
      for (const cb of statusCbs.get(table) ?? []) cb(value)
    },
    hasHandler: (table) => (handlers.get(table)?.size ?? 0) > 0,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function harness({ rows = [], withPoll = true } = {}) {
  const timers = fakeTimers()
  const live = fakeLive()
  let current = rows
  let clock = 1000
  const verified = createVerifiedLive({
    connect: liveTransport(live),
    fetchRows: withPoll ? async () => current : null,
    timers: timers.api,
    now: () => (clock += 1),
  })
  return { verified, live, timers, setRows: (next) => (current = next) }
}

// --- the whole point ---------------------------------------------------------

test('live.js reporting "live" does NOT make this report live', async () => {
  const h = harness()
  const stop = h.verified.subscribe('updates', () => {})
  h.live.setStatus('updates', 'live') // live.js says SUBSCRIBED => 'live'
  await flush()

  assert.notEqual(h.verified.status('updates'), 'live')
  assert.equal(h.verified.status('updates'), 'polling')
  stop()
})

test('a connected-but-silent feed still delivers changes, via the poll', async () => {
  const h = harness({ rows: [{ id: 1, note: 'first' }] })
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  await flush() // baseline
  h.live.setStatus('updates', 'live') // socket up...
  // ...and nothing is ever published to it, exactly as on the night.
  h.setRows([
    { id: 1, note: 'first' },
    { id: 2, note: 'filed from device B' },
  ])
  h.timers.tick()
  await flush()

  assert.equal(seen.length, 1)
  assert.equal(seen[0].eventType, 'INSERT')
  assert.equal(seen[0].row.id, 2)
  assert.equal(seen[0].source, 'poll')
  stop()
})

test('one delivered event flips status to live and stops the poll', async () => {
  const h = harness({ rows: [] })
  const stop = h.verified.subscribe('updates', () => {})
  await flush()
  assert.ok(h.timers.count() > 0, 'poll runs from t=0')

  h.live.setStatus('updates', 'live')
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 9 }, old: null })
  await flush()

  assert.equal(h.verified.status('updates'), 'live')
  assert.equal(h.timers.count(), 0, 'poll stops once the feed is proven')
  stop()
})

// --- poll correctness --------------------------------------------------------

test('the first poll is a baseline and does not replay existing rows', async () => {
  const h = harness({ rows: [{ id: 1 }, { id: 2 }] })
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  await flush()
  h.timers.tick()
  await flush()

  assert.equal(seen.length, 0)
  stop()
})

test('the poll reports updates and deletes, not just inserts', async () => {
  const h = harness({ rows: [{ id: 1, n: 1 }, { id: 2 }] })
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  await flush()
  h.setRows([{ id: 1, n: 2 }])
  h.timers.tick()
  await flush()

  const kinds = seen.map((e) => e.eventType).sort()
  assert.deepEqual(kinds, ['DELETE', 'UPDATE'])
  stop()
})

test('the same change from poll and transport is delivered once', async () => {
  const h = harness({ rows: [{ id: 1 }] })
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  await flush()

  const row = { id: 2, note: 'dupe' }
  h.setRows([{ id: 1 }, row])
  h.live.deliver('updates', { eventType: 'INSERT', row, old: null })
  h.timers.tick()
  await flush()

  assert.equal(seen.length, 1)
  stop()
})

test('a failing fetchRows is reported, not thrown, and polling continues', async () => {
  const timers = fakeTimers()
  const live = fakeLive()
  const errors = []
  let fail = true
  const verified = createVerifiedLive({
    connect: liveTransport(live),
    fetchRows: async () => {
      if (fail) throw new Error('network')
      return [{ id: 1 }]
    },
    timers: timers.api,
    onError: (err, ctx) => errors.push(ctx.phase),
  })
  const stop = verified.subscribe('updates', () => {})
  await flush()

  assert.ok(errors.includes('poll'))
  fail = false
  timers.tick()
  await flush()
  assert.ok(timers.count() > 0, 'poll survives a failed fetch')
  stop()
})

// --- degradation -------------------------------------------------------------

test('a degraded transport resumes polling and un-proves the feed', async () => {
  const h = harness({ rows: [] })
  const stop = h.verified.subscribe('updates', () => {})
  await flush()
  h.live.setStatus('updates', 'live')
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })
  await flush()
  assert.equal(h.timers.count(), 0)

  h.live.setStatus('updates', 'offline')
  await flush()

  assert.ok(h.timers.count() > 0, 'poll resumes when the feed drops')
  assert.equal(h.verified.status('updates'), 'polling')
  stop()
})

test('without a poll configured, status is honest about being offline', async () => {
  const h = harness({ withPoll: false })
  const stop = h.verified.subscribe('updates', () => {})

  h.live.setStatus('updates', 'live')
  assert.equal(h.verified.status('updates'), 'connecting', 'nothing delivered, so not live')

  h.live.setStatus('updates', 'offline')
  assert.equal(h.verified.status('updates'), 'offline')
  assert.equal(h.timers.count(), 0, 'no poll exists to fall back to')
  stop()
})

// --- lifecycle ---------------------------------------------------------------

test('a throwing handler does not kill the subscription', async () => {
  const h = harness({ rows: [] })
  let calls = 0
  const stop = h.verified.subscribe('updates', () => {
    calls += 1
    throw new Error('bad render')
  })
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 2 }, old: null })
  await flush()

  assert.equal(calls, 2, 'the second event still lands after the first threw')
  stop()
})

test('unsubscribe stops the poll and releases the transport', async () => {
  const h = harness({ rows: [] })
  const stop = h.verified.subscribe('updates', () => {})
  await flush()
  stop()

  assert.equal(h.timers.count(), 0)
  assert.equal(h.live.unsubscribes(), 2, 'both the event and status subscriptions released')
  assert.equal(h.live.hasHandler('updates'), false)
})

test('events stop reaching the handler after unsubscribe', async () => {
  const h = harness({ rows: [] })
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  stop()
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })
  await flush()

  assert.equal(seen.length, 0)
})

test('subscribe -> unsubscribe -> immediate resubscribe works (tab-switch churn)', async () => {
  const h = harness({ rows: [{ id: 1 }] })
  h.verified.subscribe('updates', () => {})()
  const seen = []
  const stop = h.verified.subscribe('updates', (e) => seen.push(e))
  await flush()

  h.setRows([{ id: 1 }, { id: 2 }])
  h.timers.tick()
  await flush()

  assert.equal(seen.length, 1, 'the remounted subscriber still receives changes')
  stop()
})

// --- status plumbing ---------------------------------------------------------

test('onStatus fires immediately, then on every change', async () => {
  const h = harness({ rows: [] })
  const seen = []
  const off = h.verified.onStatus('updates', (s) => seen.push(s))
  assert.deepEqual(seen, ['connecting'])

  const stop = h.verified.subscribe('updates', () => {})
  await flush()
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })

  assert.deepEqual(seen, ['connecting', 'polling', 'live'])
  off()
  stop()
})

test('createVerifiedLive refuses to build without a transport', () => {
  assert.throws(() => createVerifiedLive({}), /connect/)
})

// --- multi-subscriber safety -------------------------------------------------
// The "four widgets at once" scenario the module doc cites as its own
// motivating incident — a second subscriber to an already-proven table must
// not drag the shared status back down, and the two subscribers' polls must
// not double the read load.

test('a table already proven live stays live when a second subscriber mounts', async () => {
  const h = harness({ rows: [] })
  const seenA = []
  const offA = h.verified.onStatus('updates', (s) => seenA.push(s))
  const stopA = h.verified.subscribe('updates', () => {})
  await flush()
  h.live.setStatus('updates', 'live') // the channel is SUBSCRIBED, per createSharedChannel, from here on
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })
  await flush()
  assert.equal(h.verified.status('updates'), 'live')

  // A late-joining subscriber to the SAME table must observe 'live'
  // immediately, and must not regress the shared status while it connects.
  const seenB = []
  const offB = h.verified.onStatus('updates', (s) => seenB.push(s))
  const stopB = h.verified.subscribe('updates', () => {})
  await flush()

  assert.deepEqual(seenB, ['live'], 'the late joiner sees live from the start, never connecting/polling')
  assert.equal(h.verified.status('updates'), 'live', 'the shared status never regressed')
  assert.deepEqual(seenA, ['connecting', 'polling', 'live'], 'the original subscriber is undisturbed by B mounting')
  offA()
  offB()
  stopA()
  stopB()
})

test('two subscribers to the same table share one fetchRows call per tick', async () => {
  const timers = fakeTimers()
  const live = fakeLive()
  let calls = 0
  const verified = createVerifiedLive({
    connect: liveTransport(live),
    fetchRows: async () => {
      calls += 1
      return []
    },
    timers: timers.api,
  })
  const stopA = verified.subscribe('updates', () => {})
  const stopB = verified.subscribe('updates', () => {})
  await flush()

  assert.equal(calls, 1, 'the initial poll is shared, not doubled')

  timers.tick()
  await flush()

  assert.equal(calls, 2, 'one shared fetch per tick, not one per subscriber')
  stopA()
  stopB()
})

test('the last subscriber leaving un-proves the table for the next one', async () => {
  const h = harness({ rows: [] })
  const stopA = h.verified.subscribe('updates', () => {})
  await flush()
  h.live.deliver('updates', { eventType: 'INSERT', row: { id: 1 }, old: null })
  await flush()
  assert.equal(h.verified.status('updates'), 'live')
  stopA()

  // `onStatus` fires immediately with the last-known value ('live', stale
  // now that nobody is subscribed) before reflecting that a fresh subscriber
  // starts unproven again — same "fires immediately, then on change" contract
  // every other onStatus listener in this file gets.
  const seen = []
  h.verified.onStatus('updates', (s) => seen.push(s))
  const stopB = h.verified.subscribe('updates', () => {})
  await flush()

  assert.deepEqual(
    seen,
    ['live', 'connecting', 'polling'],
    'a fresh subscriber after the last one left starts unproven again'
  )
  stopB()
})

// --- poll failure honesty ----------------------------------------------------
// The RLS-denial scenario: fetchRows fails on every call. 'polling' must
// never be claimed without at least one row read actually succeeding, and a
// permanently failing poll must eventually degrade instead of parking at
// 'connecting' forever.

test('a permanently failing fetchRows never claims polling, and degrades after 3 misses', async () => {
  const timers = fakeTimers()
  const live = fakeLive()
  const verified = createVerifiedLive({
    connect: liveTransport(live),
    fetchRows: async () => {
      throw new Error('permission denied for table updates (RLS)')
    },
    timers: timers.api,
    onError: () => {},
  })
  const seen = []
  verified.onStatus('updates', (s) => seen.push(s))
  const stop = verified.subscribe('updates', () => {})
  await flush()
  assert.ok(!seen.includes('polling'), 'zero successful reads ever happened — never claim polling')

  timers.tick()
  await flush()
  timers.tick()
  await flush()

  assert.equal(verified.status('updates'), 'offline', 'a permanently failing poll degrades, not parks at connecting')
  stop()
})
