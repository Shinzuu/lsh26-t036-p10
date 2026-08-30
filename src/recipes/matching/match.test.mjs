// node --test match.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { matchPairwise, findCycles, settleDebts } from './match.js'

// ---------------------------------------------------------------------------
// a seeded PRNG for the settleDebts property test — no Math.random anywhere
// in this file, so a failing property test always reproduces with the same
// seed printed in the failure message.
// mulberry32: https://gist.github.com/tommyettinger/46a874533244883189143505d203312
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build `n` random balances (in integer cents, so the true sum is exactly
// zero with no float noise) that sum to zero: n-1 random creditors/debtors,
// last participant absorbs whatever balance is needed to close it out.
function randomZeroSumBalances(rng, n) {
  const cents = []
  let total = 0
  for (let k = 0; k < n - 1; k++) {
    const c = Math.floor(rng() * 20000) - 10000 // -10000..+10000 cents
    cents.push(c)
    total += c
  }
  cents.push(-total) // last participant closes the sum to exactly zero
  return cents.map((c, idx) => ({ id: `p${idx}`, net: c / 100 }))
}

// ---------------------------------------------------------------------------
// matchPairwise
// ---------------------------------------------------------------------------

describe('matchPairwise', () => {
  test('both empty: no pairs, no leftovers', () => {
    const { pairs, unmatchedA, unmatchedB } = matchPairwise([], [], () => 1)
    assert.deepEqual(pairs, [])
    assert.deepEqual(unmatchedA, [])
    assert.deepEqual(unmatchedB, [])
  })

  test('empty sideA: every b is unmatched, no pairs', () => {
    const b = [{ id: 'b1' }, { id: 'b2' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise([], b, () => 1)
    assert.deepEqual(pairs, [])
    assert.deepEqual(unmatchedA, [])
    assert.deepEqual(unmatchedB, b)
  })

  test('empty sideB: every a is unmatched, no pairs', () => {
    const a = [{ id: 'a1' }, { id: 'a2' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, [], () => 1)
    assert.deepEqual(pairs, [])
    assert.deepEqual(unmatchedA, a)
    assert.deepEqual(unmatchedB, [])
  })

  test('one obvious best match per side', () => {
    const students = [{ id: 's1', subject: 'math' }, { id: 's2', subject: 'physics' }]
    const tutors = [{ id: 't1', subject: 'math' }, { id: 't2', subject: 'physics' }]
    const score = (s, t) => (s.subject === t.subject ? 10 : 0)
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(students, tutors, score)
    assert.equal(pairs.length, 2)
    assert.deepEqual(
      pairs.map((p) => [p.a.id, p.b.id]),
      [['s1', 't1'], ['s2', 't2']],
    )
    assert.deepEqual(unmatchedA, [])
    assert.deepEqual(unmatchedB, [])
  })

  test('unmatchable leftovers are reported, not dropped', () => {
    const a = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
    const b = [{ id: 'b1' }]
    // only a2 scores above threshold against b1
    const score = (x, y) => (x.id === 'a2' ? 5 : -5)
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, b, score, { threshold: 0 })
    assert.deepEqual(pairs.map((p) => p.a.id), ['a2'])
    assert.deepEqual(unmatchedA.map((x) => x.id), ['a1', 'a3'])
    assert.deepEqual(unmatchedB, [])
  })

  test('threshold excludes low scores entirely, both sides end up unmatched', () => {
    const a = [{ id: 'a1' }]
    const b = [{ id: 'b1' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, b, () => 1, { threshold: 5 })
    assert.deepEqual(pairs, [])
    assert.deepEqual(unmatchedA.map((x) => x.id), ['a1'])
    assert.deepEqual(unmatchedB.map((x) => x.id), ['b1'])
  })

  test('a negative threshold can force a match on a poor score', () => {
    const a = [{ id: 'a1' }]
    const b = [{ id: 'b1' }]
    const { pairs } = matchPairwise(a, b, () => -1, { threshold: -Infinity })
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].score, -1)
  })

  test('once b is claimed it is unavailable to a later a, even if it scores higher there', () => {
    const a = [{ id: 'a1' }, { id: 'a2' }]
    const b = [{ id: 'b1' }]
    // a1 scores b1 at 1, a2 would score b1 at 10 — a1 goes first and claims it anyway
    const score = (x, y) => (x.id === 'a1' ? 1 : 10)
    const { pairs, unmatchedA } = matchPairwise(a, b, score)
    assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id, p.score]), [['a1', 'b1', 1]])
    assert.deepEqual(unmatchedA.map((x) => x.id), ['a2'])
  })

  test('ties are broken deterministically by sideB input order, both directions', () => {
    const a = [{ id: 'a1' }]
    const bForward = [{ id: 'b1' }, { id: 'b2' }]
    const bReversed = [{ id: 'b2' }, { id: 'b1' }]
    const score = () => 7 // every b ties

    const forward = matchPairwise(a, bForward, score)
    const reversed = matchPairwise(a, bReversed, score)

    assert.equal(forward.pairs[0].b.id, 'b1') // first in input order wins the tie
    assert.equal(reversed.pairs[0].b.id, 'b2')
  })

  test('running the same inputs twice produces identical output (determinism)', () => {
    const a = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
    const b = [{ id: 'b1' }, { id: 'b2' }]
    const score = (x, y) => (x.id.charCodeAt(1) + y.id.charCodeAt(1)) % 5
    const first = matchPairwise(a, b, score)
    const second = matchPairwise(a, b, score)
    assert.deepEqual(first, second)
  })

  test('self-match prevention: an entry never matches itself when both sides share a pool', () => {
    const pool = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }]
    let selfScoreCalled = false
    const score = (a, b) => {
      if (a.id === b.id) selfScoreCalled = true
      return 10 // everything "matches" everything except itself
    }
    const { pairs } = matchPairwise(pool, pool, score)
    assert.equal(selfScoreCalled, false, 'score() must never be called for a.id === b.id')
    for (const p of pairs) assert.notEqual(p.a.id, p.b.id)
  })

  test('self-match prevention still leaves the two distinct entries free to match each other', () => {
    const pool = [{ id: 'x1' }, { id: 'x2' }]
    // sideA and sideB are the same pool but fill different roles, so x1 (as
    // an A) can claim x2 (as a B) AND x2 (as an A) can independently claim
    // x1 (as a B) — the only thing self-match prevention forbids is an
    // entry claiming itself.
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(pool, pool, () => 10)
    assert.equal(pairs.length, 2)
    assert.deepEqual(
      pairs.map((p) => [p.a.id, p.b.id]),
      [['x1', 'x2'], ['x2', 'x1']],
    )
    assert.deepEqual(unmatchedA, [])
    assert.deepEqual(unmatchedB, [])
  })

  test('a non-finite score (NaN) is treated as unmatchable, not thrown', () => {
    const a = [{ id: 'a1' }]
    const b = [{ id: 'b1' }, { id: 'b2' }]
    const score = (x, y) => (y.id === 'b1' ? NaN : 3)
    const { pairs } = matchPairwise(a, b, score)
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].b.id, 'b2')
  })

  test('an Infinity score does not throw — it is non-finite, so it is treated as unmatchable like NaN', () => {
    const a = [{ id: 'a1' }]
    const b = [{ id: 'b1' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, b, () => Infinity)
    assert.deepEqual(pairs, [])
    assert.equal(unmatchedA.length, 1)
    assert.equal(unmatchedB.length, 1)
  })

  test('throws a clear TypeError for non-array inputs instead of failing deep inside a loop', () => {
    assert.throws(() => matchPairwise(null, [], () => 1), TypeError)
    assert.throws(() => matchPairwise([], null, () => 1), TypeError)
    assert.throws(() => matchPairwise([], [], null), TypeError)
  })

  test('more sideA than sideB: excess A entries land in unmatchedA', () => {
    const a = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
    const b = [{ id: 'b1' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, b, () => 1)
    assert.equal(pairs.length, 1)
    assert.equal(unmatchedA.length, 2)
    assert.deepEqual(unmatchedB, [])
  })

  test('more sideB than sideA: excess B entries land in unmatchedB', () => {
    const a = [{ id: 'a1' }]
    const b = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]
    const { pairs, unmatchedA, unmatchedB } = matchPairwise(a, b, () => 1)
    assert.equal(pairs.length, 1)
    assert.deepEqual(unmatchedA, [])
    assert.equal(unmatchedB.length, 2)
  })
})

// ---------------------------------------------------------------------------
// findCycles
// ---------------------------------------------------------------------------

describe('findCycles', () => {
  test('empty input: no cycles', () => {
    assert.deepEqual(findCycles([]), [])
  })

  test('a single want with no reciprocation is a chain, not a cycle', () => {
    assert.deepEqual(findCycles([{ from: 'A', to: 'B' }]), [])
  })

  test('a plain two-party swap is a 2-cycle', () => {
    const cycles = findCycles([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ])
    assert.equal(cycles.length, 1)
    assert.deepEqual(cycles[0], ['A', 'B'])
  })

  test('the named 3-way cycle: A wants B, B wants C, C wants A', () => {
    const cycles = findCycles([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ])
    assert.equal(cycles.length, 1)
    assert.deepEqual(cycles[0], ['A', 'B', 'C'])
  })

  test('a self-loop (wants own slot) is excluded, not reported as a length-1 cycle', () => {
    assert.deepEqual(findCycles([{ from: 'A', to: 'A' }]), [])
  })

  test('a self-loop does not block a real cycle elsewhere in the same input', () => {
    const cycles = findCycles([
      { from: 'A', to: 'A' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'B' },
    ])
    assert.deepEqual(cycles, [['B', 'C']])
  })

  test('a chain that never loops back produces zero cycles', () => {
    assert.deepEqual(
      findCycles([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
      ]),
      [],
    )
  })

  test('two independent cycles in one input are both found, in first-seen order', () => {
    const cycles = findCycles([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'Z' },
      { from: 'Z', to: 'X' },
    ])
    assert.equal(cycles.length, 2)
    assert.deepEqual(cycles[0], ['A', 'B'])
    assert.deepEqual(cycles[1], ['X', 'Y', 'Z'])
  })

  test('a chain feeding into a cycle reports only the cyclic part', () => {
    // A wants B's slot (a lead-in), but B/C/D form the actual 3-cycle.
    const cycles = findCycles([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'B' },
    ])
    assert.equal(cycles.length, 1)
    assert.deepEqual(cycles[0], ['B', 'C', 'D'])
  })

  test('duplicate `from` entries: the later entry wins (last write, Map semantics)', () => {
    const cycles = findCycles([
      { from: 'A', to: 'Z' }, // overwritten before it's ever read
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ])
    assert.deepEqual(cycles, [['A', 'B']])
  })

  test('entries with a missing from/to are skipped rather than corrupting the graph', () => {
    const cycles = findCycles([
      { from: 'A', to: undefined },
      { to: 'A' },
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ])
    assert.deepEqual(cycles, [['A', 'B']])
  })

  test('running the same input twice is deterministic (same cycles, same order, same rotation)', () => {
    const wants = [
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
      { from: 'A', to: 'B' },
    ]
    assert.deepEqual(findCycles(wants), findCycles(wants))
    // starts at the first `from` encountered in input order that belongs to the cycle
    assert.deepEqual(findCycles(wants)[0], ['B', 'C', 'A'])
  })

  test('throws a clear TypeError for a non-array input', () => {
    assert.throws(() => findCycles(null), TypeError)
    assert.throws(() => findCycles('not an array'), TypeError)
  })
})

// ---------------------------------------------------------------------------
// settleDebts
// ---------------------------------------------------------------------------

describe('settleDebts', () => {
  test('empty balances: no transfers', () => {
    assert.deepEqual(settleDebts([]), [])
  })

  test('everyone already at zero: no transfers', () => {
    const transfers = settleDebts([
      { id: 'a', net: 0 },
      { id: 'b', net: 0 },
    ])
    assert.deepEqual(transfers, [])
  })

  test('simple two-person settlement', () => {
    const transfers = settleDebts([
      { id: 'alice', net: 50 },
      { id: 'bob', net: -50 },
    ])
    assert.deepEqual(transfers, [{ from: 'bob', to: 'alice', amount: 50 }])
  })

  test('three-person bill split settles in at most n-1 = 2 transfers', () => {
    // Alice paid the full 300 for a 3-way split (100 each): Bob and Carol owe 100 each.
    const transfers = settleDebts([
      { id: 'alice', net: 200 },
      { id: 'bob', net: -100 },
      { id: 'carol', net: -100 },
    ])
    assert.ok(transfers.length <= 2)
    const paidToAlice = transfers.filter((t) => t.to === 'alice').reduce((s, t) => s + t.amount, 0)
    assert.equal(paidToAlice, 200)
  })

  test('a value within epsilon of zero produces no transfer for that participant', () => {
    const transfers = settleDebts([
      { id: 'a', net: 1e-9 },
      { id: 'b', net: -1e-9 },
    ])
    assert.deepEqual(transfers, [])
  })

  test('unbalanced input (does not sum to zero) settles as far as the smaller side allows', () => {
    // total credit (100) exceeds total debt (40): debtor is fully paid off,
    // creditor is left partially unsettled — no infinite loop, no throw.
    const transfers = settleDebts([
      { id: 'a', net: 100 },
      { id: 'b', net: -40 },
    ])
    assert.deepEqual(transfers, [{ from: 'b', to: 'a', amount: 40 }])
  })

  test('amounts are rounded to cents even when float division would otherwise drift', () => {
    const transfers = settleDebts([
      { id: 'a', net: 0.1 + 0.2 }, // 0.30000000000000004 in raw IEEE754
      { id: 'b', net: -(0.1 + 0.2) },
    ])
    assert.equal(transfers.length, 1)
    assert.equal(transfers[0].amount, 0.3)
  })

  test('multiple creditors and debtors: every balance nets to zero after applying the transfers', () => {
    const balances = [
      { id: 'a', net: 30 },
      { id: 'b', net: 20 },
      { id: 'c', net: -10 },
      { id: 'd', net: -40 },
    ]
    const transfers = settleDebts(balances)
    const net = Object.fromEntries(balances.map((b) => [b.id, b.net]))
    for (const t of transfers) {
      net[t.from] += t.amount
      net[t.to] -= t.amount
    }
    for (const id of Object.keys(net)) assert.ok(Math.abs(net[id]) < 1e-6, `${id} did not settle to zero`)
    assert.ok(transfers.length <= balances.length - 1)
  })

  test('throws a clear TypeError for a non-array input', () => {
    assert.throws(() => settleDebts(null), TypeError)
  })

  test('ties among creditors/debtors are broken deterministically by id', () => {
    const balances = [
      { id: 'z', net: 10 },
      { id: 'a', net: 10 },
      { id: 'y', net: -10 },
      { id: 'b', net: -10 },
    ]
    const first = settleDebts(balances)
    const second = settleDebts(balances.slice().reverse())
    assert.deepEqual(first, second)
  })

  test('property: over 300 random seeded trials, every settlement is correct and stays within n-1 transfers', () => {
    const rng = mulberry32(20260827) // fixed seed: any failure reproduces exactly
    const TRIALS = 300

    for (let trial = 0; trial < TRIALS; trial++) {
      const n = 2 + Math.floor(rng() * 9) // 2..10 participants
      const balances = randomZeroSumBalances(rng, n)
      const transfers = settleDebts(balances)

      const msg = `seed 20260827, trial ${trial}, n=${n}, balances=${JSON.stringify(balances)}`

      // every transfer amount is strictly positive
      for (const t of transfers) assert.ok(t.amount > 0, `non-positive transfer amount — ${msg}`)

      // property: at most n-1 transfers (n = participants with a nonzero balance)
      const nonZero = balances.filter((b) => Math.abs(b.net) > 1e-9).length
      assert.ok(
        transfers.length <= Math.max(nonZero - 1, 0),
        `too many transfers (${transfers.length} > ${nonZero - 1}) — ${msg}`,
      )

      // property: applying every transfer settles every participant to (~)zero
      const net = Object.fromEntries(balances.map((b) => [b.id, b.net]))
      for (const t of transfers) {
        net[t.from] += t.amount
        net[t.to] -= t.amount
      }
      for (const id of Object.keys(net)) {
        assert.ok(Math.abs(net[id]) < 0.01, `${id} left at ${net[id]}, not settled — ${msg}`)
      }
    }
  })
})
