// node --test queue.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { derivePositions, TRANSITIONS, canTransition, assertTransition, claimNext, applyClaim, waitEstimate } from './queue.js'

const T0 = '2026-08-30T19:00:00.000Z'

// A small helper so every fixture entry has the fields the module reads,
// without repeating boilerplate in every test.
function entry(id, created_at, status = 'waiting', extra = {}) {
  return { id, created_at, status, ...extra }
}

// ---------------------------------------------------------------------------
// derivePositions
// ---------------------------------------------------------------------------

describe('derivePositions', () => {
  test('ranks waiting entries by created_at, earliest first', () => {
    const entries = [
      entry('c', '2026-08-27T10:02:00Z'),
      entry('a', '2026-08-27T10:00:00Z'),
      entry('b', '2026-08-27T10:01:00Z'),
    ]
    const result = derivePositions(entries)
    assert.equal(result.find((e) => e.id === 'a').position, 1)
    assert.equal(result.find((e) => e.id === 'b').position, 2)
    assert.equal(result.find((e) => e.id === 'c').position, 3)
  })

  test('non-waiting entries get position null', () => {
    const entries = [
      entry('a', '2026-08-27T10:00:00Z', 'waiting'),
      entry('b', '2026-08-27T10:01:00Z', 'called'),
      entry('c', '2026-08-27T10:02:00Z', 'served'),
      entry('d', '2026-08-27T10:03:00Z', 'no-show'),
      entry('e', '2026-08-27T10:04:00Z', 'cancelled'),
    ]
    const result = derivePositions(entries)
    assert.equal(result.find((e) => e.id === 'a').position, 1)
    for (const id of ['b', 'c', 'd', 'e']) {
      assert.equal(result.find((e) => e.id === id).position, null)
    }
  })

  test('called entries do not count against waiting positions', () => {
    const entries = [
      entry('a', '2026-08-27T10:00:00Z', 'called'),
      entry('b', '2026-08-27T10:01:00Z', 'waiting'),
      entry('c', '2026-08-27T10:02:00Z', 'waiting'),
    ]
    const result = derivePositions(entries)
    assert.equal(result.find((e) => e.id === 'b').position, 1)
    assert.equal(result.find((e) => e.id === 'c').position, 2)
  })

  test('tiebreaks identical created_at by id, deterministically', () => {
    const sameTime = '2026-08-27T10:00:00Z'
    const entries = [entry('z', sameTime), entry('a', sameTime), entry('m', sameTime)]
    const result = derivePositions(entries)
    assert.equal(result.find((e) => e.id === 'a').position, 1)
    assert.equal(result.find((e) => e.id === 'm').position, 2)
    assert.equal(result.find((e) => e.id === 'z').position, 3)
  })

  test('tiebreak is stable across input order — this is the two-people-take-position-3 fix', () => {
    const sameTime = '2026-08-27T10:00:00Z'
    const order1 = derivePositions([entry('3', sameTime), entry('1', sameTime), entry('2', sameTime)])
    const order2 = derivePositions([entry('2', sameTime), entry('3', sameTime), entry('1', sameTime)])
    for (const id of ['1', '2', '3']) {
      assert.equal(order1.find((e) => e.id === id).position, order2.find((e) => e.id === id).position)
    }
  })

  test('empty queue returns an empty array', () => {
    assert.deepEqual(derivePositions([]), [])
  })

  test('all entries waiting: positions are a dense 1..N run with no gaps or dupes', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(`e${i}`, new Date(2026, 7, 27, 10, i).toISOString()))
    const positions = derivePositions(entries)
      .map((e) => e.position)
      .sort((a, b) => a - b)
    assert.deepEqual(positions, [1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('does not mutate the input array or its entries', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z')]
    const snapshot = JSON.stringify(entries)
    derivePositions(entries)
    assert.equal(JSON.stringify(entries), snapshot)
  })

  test('preserves every other field on each entry', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z', 'waiting', { name: 'Rafi', partySize: 3 })]
    const [result] = derivePositions(entries)
    assert.equal(result.name, 'Rafi')
    assert.equal(result.partySize, 3)
  })

  test('position stability after a mid-queue cancellation: nobody behind the cancelled row keeps a gap', () => {
    const base = [
      entry('a', '2026-08-27T10:00:00Z'),
      entry('b', '2026-08-27T10:01:00Z'),
      entry('c', '2026-08-27T10:02:00Z'),
      entry('d', '2026-08-27T10:03:00Z'),
    ]
    const before = derivePositions(base)
    assert.equal(before.find((e) => e.id === 'c').position, 3)
    assert.equal(before.find((e) => e.id === 'd').position, 4)

    // b (position 2) cancels mid-queue — nobody re-numbers anyone by hand,
    // the next derivePositions call just recomputes from the survivors.
    const afterCancel = base.map((e) => (e.id === 'b' ? { ...e, status: 'cancelled' } : e))
    const after = derivePositions(afterCancel)
    assert.equal(after.find((e) => e.id === 'a').position, 1)
    assert.equal(after.find((e) => e.id === 'b').position, null)
    assert.equal(after.find((e) => e.id === 'c').position, 2) // moved up, no gap left at "2"
    assert.equal(after.find((e) => e.id === 'd').position, 3)
  })

  test('position stability after cancelling the front of the queue', () => {
    const base = [
      entry('a', '2026-08-27T10:00:00Z'),
      entry('b', '2026-08-27T10:01:00Z'),
      entry('c', '2026-08-27T10:02:00Z'),
    ]
    const afterCancel = base.map((e) => (e.id === 'a' ? { ...e, status: 'cancelled' } : e))
    const after = derivePositions(afterCancel)
    assert.equal(after.find((e) => e.id === 'b').position, 1)
    assert.equal(after.find((e) => e.id === 'c').position, 2)
  })

  test('a re-join after cancelling gets a fresh position at the back, not the old slot', () => {
    const base = [entry('a', '2026-08-27T10:00:00Z'), entry('b', '2026-08-27T10:01:00Z')]
    const afterCancel = base.map((e) => (e.id === 'a' ? { ...e, status: 'cancelled' } : e))
    const rejoined = [...afterCancel, entry('a2', '2026-08-27T10:05:00Z')] // new entry, not resurrected
    const result = derivePositions(rejoined)
    assert.equal(result.find((e) => e.id === 'b').position, 1)
    assert.equal(result.find((e) => e.id === 'a2').position, 2)
  })
})

// ---------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------

describe('canTransition / assertTransition — the legality matrix', () => {
  const legalMoves = [
    ['waiting', 'called'],
    ['waiting', 'cancelled'],
    ['called', 'served'],
    ['called', 'no-show'],
    ['called', 'cancelled'],
  ]

  const illegalMoves = [
    ['waiting', 'served'], // skips being called
    ['waiting', 'no-show'], // skips being called
    ['waiting', 'waiting'], // no-op is not a transition
    ['called', 'waiting'], // no going backwards
    ['served', 'waiting'], // terminal
    ['served', 'called'], // terminal
    ['no-show', 'waiting'], // terminal
    ['no-show', 'called'], // terminal
    ['cancelled', 'waiting'], // terminal
    ['cancelled', 'called'], // terminal
  ]

  for (const [from, to] of legalMoves) {
    test(`"${from}" -> "${to}" is legal: canTransition true, assertTransition passes`, () => {
      assert.equal(canTransition(from, to), true)
      assert.equal(assertTransition(from, to), true)
    })
  }

  for (const [from, to] of illegalMoves) {
    test(`"${from}" -> "${to}" is illegal: canTransition false, assertTransition throws readably`, () => {
      assert.equal(canTransition(from, to), false)
      assert.throws(() => assertTransition(from, to), (err) => {
        assert.match(err.message, new RegExp(`"${from}"`))
        assert.match(err.message, new RegExp(`"${to}"`))
        return true
      })
    })
  }

  test('every terminal status has an empty allowed list in TRANSITIONS', () => {
    assert.deepEqual(TRANSITIONS.served, [])
    assert.deepEqual(TRANSITIONS['no-show'], [])
    assert.deepEqual(TRANSITIONS.cancelled, [])
  })

  test('assertTransition on an unrecognised "from" status throws and names it as unknown', () => {
    assert.throws(() => assertTransition('bogus', 'called'), /unknown status "bogus"/)
  })

  test('canTransition on an unrecognised "from" status is false, not a throw', () => {
    assert.equal(canTransition('bogus', 'called'), false)
  })

  test('assertTransition error message for a terminal status says so in words', () => {
    assert.throws(() => assertTransition('served', 'waiting'), /terminal status/)
  })
})

// ---------------------------------------------------------------------------
// claimNext / applyClaim — optimistic concurrency
// ---------------------------------------------------------------------------

describe('claimNext', () => {
  test('returns null when nobody is waiting', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z', 'served')]
    assert.equal(claimNext(entries, 'staff-1', T0), null)
  })

  test('returns null on an empty queue', () => {
    assert.equal(claimNext([], 'staff-1', T0), null)
  })

  test('claims whoever derivePositions ranks #1', () => {
    const entries = [entry('a', '2026-08-27T10:01:00Z'), entry('b', '2026-08-27T10:00:00Z')]
    const intent = claimNext(entries, 'staff-1', T0)
    assert.equal(intent.id, 'b')
  })

  test('intent carries expected/next status and the claimer', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z')]
    const intent = claimNext(entries, 'staff-9', T0)
    assert.equal(intent.expectedStatus, 'waiting')
    assert.equal(intent.nextStatus, 'called')
    assert.equal(intent.claimerId, 'staff-9')
    assert.equal(typeof intent.claimedAt, 'string')
  })

  test('skips already-called or terminal entries in favour of the next waiting one', () => {
    const entries = [
      entry('a', '2026-08-27T10:00:00Z', 'called'),
      entry('b', '2026-08-27T10:01:00Z', 'waiting'),
    ]
    const intent = claimNext(entries, 'staff-1', T0)
    assert.equal(intent.id, 'b')
  })
})

describe('applyClaim — the compare-and-swap half', () => {
  test('a clean claim on a currently-waiting entry succeeds', () => {
    const server = [entry('a', '2026-08-27T10:00:00Z', 'waiting')]
    const intent = claimNext(server, 'staff-1', T0)
    const { data, error } = applyClaim(server, intent)
    assert.equal(error, null)
    assert.equal(data.status, 'called')
    assert.equal(data.claimedBy, 'staff-1')
  })

  test('claiming an id that no longer exists returns a not_found error, not a throw', () => {
    const server = []
    const intent = { id: 'ghost', claimerId: 'staff-1', expectedStatus: 'waiting', nextStatus: 'called', claimedAt: 'x' }
    const { data, error } = applyClaim(server, intent)
    assert.equal(data, null)
    assert.equal(error.code, 'not_found')
  })

  test('stale claim against an entry already moved on returns a truthful stale_claim error', () => {
    const server = [{ ...entry('a', '2026-08-27T10:00:00Z'), status: 'called' }]
    const intent = { id: 'a', claimerId: 'staff-2', expectedStatus: 'waiting', nextStatus: 'called', claimedAt: 'x' }
    const { data, error } = applyClaim(server, intent)
    assert.equal(data, null)
    assert.equal(error.code, 'stale_claim')
    assert.match(error.message, /already "called"/)
  })

  test('concurrent-claim simulation: two claimers race the same stale snapshot, one wins, one loses truthfully', () => {
    // Both staff tablets fetched the queue before anyone acted — same
    // stale snapshot, same computed intent target.
    const staleSnapshot = [entry('front', '2026-08-27T10:00:00Z', 'waiting')]

    const intentFromTablet1 = claimNext(staleSnapshot, 'staff-1', T0)
    const intentFromTablet2 = claimNext(staleSnapshot, 'staff-2', T0)
    assert.equal(intentFromTablet1.id, intentFromTablet2.id) // both aimed at the same person

    // The "server" — the actual source of truth both applies check against.
    let serverState = [entry('front', '2026-08-27T10:00:00Z', 'waiting')]

    // Tablet 1's request lands first.
    const result1 = applyClaim(serverState, intentFromTablet1)
    assert.equal(result1.error, null)
    assert.equal(result1.data.claimedBy, 'staff-1')

    // The server state is now updated (this is what a real re-read of
    // Postgres, or a real re-read of localStorage, would return).
    serverState = serverState.map((e) => (e.id === result1.data.id ? result1.data : e))

    // Tablet 2's request, built from the same stale intent, lands second.
    const result2 = applyClaim(serverState, intentFromTablet2)
    assert.notEqual(result2.error, null)
    assert.equal(result2.error.code, 'stale_claim')
    assert.equal(result2.data, null) // the loser does not get a row back

    // Exactly one claimer actually owns the entry — no double-claim.
    assert.equal(serverState.find((e) => e.id === 'front').claimedBy, 'staff-1')
  })

  test('after a lost claim, the loser can immediately claim whoever is next instead', () => {
    let serverState = [entry('front', '2026-08-27T10:00:00Z', 'waiting'), entry('second', '2026-08-27T10:01:00Z', 'waiting')]
    const staleSnapshot = serverState

    const intent1 = claimNext(staleSnapshot, 'staff-1', T0)
    const intent2 = claimNext(staleSnapshot, 'staff-2', T0) // same stale target as intent1

    const win = applyClaim(serverState, intent1)
    serverState = serverState.map((e) => (e.id === win.data.id ? win.data : e))

    const lose = applyClaim(serverState, intent2)
    assert.equal(lose.error.code, 'stale_claim')

    // staff-2 re-reads and claims fresh — gets the real next person, not front.
    const freshIntent = claimNext(serverState, 'staff-2', T0)
    assert.equal(freshIntent.id, 'second')
    const retry = applyClaim(serverState, freshIntent)
    assert.equal(retry.error, null)
    assert.equal(retry.data.claimedBy, 'staff-2')
  })

  test('applyClaim refuses an intent whose nextStatus is not a legal move from the current status', () => {
    const server = [entry('a', '2026-08-27T10:00:00Z', 'served')]
    const intent = { id: 'a', claimerId: 'x', expectedStatus: 'served', nextStatus: 'waiting', claimedAt: 'x' }
    assert.throws(() => applyClaim(server, intent), /Illegal queue transition/)
  })
})

// ---------------------------------------------------------------------------
// waitEstimate
// ---------------------------------------------------------------------------

describe('waitEstimate', () => {
  test('empty queue returns an empty array', () => {
    assert.deepEqual(waitEstimate([], 5), [])
  })

  test('the person at position 1 has zero estimated wait', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z')]
    const [result] = waitEstimate(entries, 5)
    assert.equal(result.estimatedWaitMinutes, 0)
  })

  test('estimate scales linearly with position at one server', () => {
    const entries = [
      entry('a', '2026-08-27T10:00:00Z'),
      entry('b', '2026-08-27T10:01:00Z'),
      entry('c', '2026-08-27T10:02:00Z'),
    ]
    const result = waitEstimate(entries, 5)
    assert.equal(result.find((e) => e.id === 'a').estimatedWaitMinutes, 0)
    assert.equal(result.find((e) => e.id === 'b').estimatedWaitMinutes, 5)
    assert.equal(result.find((e) => e.id === 'c').estimatedWaitMinutes, 10)
  })

  test('zero avgServiceMinutes gives everyone a zero estimate, not an error', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z'), entry('b', '2026-08-27T10:01:00Z')]
    const result = waitEstimate(entries, 0)
    assert.equal(result.find((e) => e.id === 'a').estimatedWaitMinutes, 0)
    assert.equal(result.find((e) => e.id === 'b').estimatedWaitMinutes, 0)
  })

  test('non-waiting entries get estimatedWaitMinutes: null, not 0 and not omitted', () => {
    const entries = [entry('a', '2026-08-27T10:00:00Z', 'called'), entry('b', '2026-08-27T10:01:00Z', 'waiting')]
    const result = waitEstimate(entries, 5)
    assert.equal(result.find((e) => e.id === 'a').estimatedWaitMinutes, null)
    assert.equal(result.find((e) => e.id === 'b').estimatedWaitMinutes, 0)
  })

  test('multiple servers split the queue ahead proportionally', () => {
    // 4 people ahead, 2 servers -> effectively 2 "rounds" of service ahead.
    const entries = Array.from({ length: 5 }, (_, i) => entry(`e${i}`, new Date(2026, 7, 27, 10, i).toISOString()))
    const result = waitEstimate(entries, 10, { servers: 2 })
    // position 5 (index 4) -> 4 ahead -> floor(4/2)=2 rounds -> 20 min
    assert.equal(result.find((e) => e.id === 'e4').estimatedWaitMinutes, 20)
    // position 3 (index 2) -> 2 ahead -> floor(2/2)=1 round -> 10 min
    assert.equal(result.find((e) => e.id === 'e2').estimatedWaitMinutes, 10)
  })

  test('throws on a negative avgServiceMinutes', () => {
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], -5), /avgServiceMinutes/)
  })

  test('throws on a non-finite avgServiceMinutes', () => {
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], NaN), /avgServiceMinutes/)
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], Infinity), /avgServiceMinutes/)
  })

  test('throws on a zero or negative servers count', () => {
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], 5, { servers: 0 }), /servers/)
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], 5, { servers: -1 }), /servers/)
  })

  test('throws on a non-integer servers count', () => {
    assert.throws(() => waitEstimate([entry('a', '2026-08-27T10:00:00Z')], 5, { servers: 1.5 }), /servers/)
  })

  test('a large queue still produces a monotonically non-decreasing estimate by position', () => {
    const entries = Array.from({ length: 50 }, (_, i) => entry(`e${i}`, new Date(2026, 7, 27, 9, i).toISOString()))
    const result = waitEstimate(entries, 3)
    const sorted = [...result].sort((a, b) => a.position - b.position)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].estimatedWaitMinutes >= sorted[i - 1].estimatedWaitMinutes)
    }
  })

  test('cancelled entries mid-queue do not inflate the estimate for people behind them', () => {
    const withCancel = [
      entry('a', '2026-08-27T10:00:00Z', 'waiting'),
      entry('b', '2026-08-27T10:01:00Z', 'cancelled'),
      entry('c', '2026-08-27T10:02:00Z', 'waiting'),
    ]
    const result = waitEstimate(withCancel, 10)
    // c is only 1 behind a real waiting person (b doesn't count), not 2.
    assert.equal(result.find((e) => e.id === 'c').estimatedWaitMinutes, 10)
  })
})
