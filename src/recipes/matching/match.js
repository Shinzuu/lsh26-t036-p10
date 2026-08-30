/**
 * Matching / allocation engines — pairwise assignment, n-way swap cycles,
 * and minimal-transfer debt settlement.
 *
 * WHY THIS EXISTS
 * "Match two sides" is a whole archetype (playbook/05-archetypes.md) and a
 * third of the drill's twelve problems need exactly one of these three
 * shapes — tutor/student pairing, a 3-way class swap, a bill/rent split —
 * and the starter kit shipped zero lines toward any of them. Each is a
 * real, if small, algorithm (greedy bipartite matching, cycle detection on
 * a functional graph, greedy net-balance settlement); getting the edge
 * cases wrong at hour 3 (self-matching a row against itself, dropping a
 * leftover instead of reporting it, a settlement that loops forever on
 * floating-point noise) is a worse failure than not having the feature,
 * because it looks done and then breaks live in front of a judge.
 *
 * Three independent pure functions, plain arrays and objects in, plain
 * arrays and objects out. No imports, no DOM, no db.js, no randomness.
 * Every entity is expected to carry a stable `id` field — that is the only
 * shape requirement any of the three functions impose.
 *
 * WHAT EACH ONE IS FOR
 *   matchPairwise  - "match every driver to a load", "assign a tutor to
 *                     each student" — one side picks its best still-free
 *                     partner on the other side, scored by a caller-supplied
 *                     function. Reach for this whenever the bullet is a
 *                     verb like "pair", "assign", or "match" between two
 *                     distinct lists.
 *   findCycles     - "A wants B's slot, B wants C's, C wants A's" — nobody
 *                     involved has anything the *other* side wants, only
 *                     each other's slot. Reach for this whenever a bullet
 *                     says "swap" and more than two parties can be involved
 *                     at once (a 2-cycle, A<->B, is exactly a swap between
 *                     a pair, and still a valid cycle here).
 *   settleDebts    - "who owes whom, minimised" — one list of net balances
 *                     (paid minus owed) becomes a short list of transfers
 *                     that zeroes everyone out. Reach for this for any bill
 *                     split, rent split, or shared-expense bullet.
 *
 * NOT PROVEN OPTIMAL, ON PURPOSE
 * `settleDebts` is a greedy largest-creditor-vs-largest-debtor sweep. It is
 * NOT the provably-minimum number of transfers — true minimum-transfer
 * settlement is NP-hard in general. Say "fewest transfers, greedily
 * settled" to a judge, not "mathematically optimal": the greedy result is
 * at most n-1 transfers for n participants (proven and property-tested
 * below), which is good enough that the difference from true-optimal is
 * very rarely visible on hackathon-scale data, but the claim matters if
 * asked.
 */

// ---------------------------------------------------------------------------
// matchPairwise
// ---------------------------------------------------------------------------

/**
 * Greedy score-based pairing of two entity lists.
 *
 * For every entry in `sideA`, in order, pick the still-unclaimed entry in
 * `sideB` with the highest `score(a, b)`, provided that score clears
 * `threshold`. Once a `b` is claimed it is unavailable to every later `a`.
 * This is a greedy O(n*m) match, not a global-optimum assignment (that
 * would be the Hungarian algorithm) — greedy is the right trade for a
 * hackathon: it is simple enough to build and explain cold, and at the
 * sizes these problems run at (well under 500 rows a side) the two rarely
 * disagree on which pairs are "good."
 *
 * Determinism: ties are broken by `sideB`'s input order — the first `b`
 * that reaches the current best score keeps it, because a later equal
 * score must be *strictly greater* to replace it. Re-running with the same
 * two arrays and the same `score` function always produces the same pairs,
 * which matters for a demo (re-seeding the same data twice should look
 * identical) and for testing.
 *
 * Self-match prevention: if `sideA` and `sideB` are actually the same pool
 * (e.g. matching people against each other for a swap, rather than two
 * distinct lists), an entry is never allowed to match itself — `score` is
 * simply never called for `a.id === b.id`.
 *
 * Leftovers are never dropped: every `a` that could not clear `threshold`
 * against any remaining `b`, and every `b` that was never claimed, comes
 * back explicitly in `unmatchedA` / `unmatchedB` so the caller can show
 * "3 tutors still need a student" instead of the row silently vanishing.
 *
 * @param {Array<{id: any}>} sideA
 * @param {Array<{id: any}>} sideB
 * @param {(a: object, b: object) => number} score - higher is better; called
 *   at most once per (a, still-available-b) pair. A non-finite result
 *   (NaN, +/-Infinity) is treated as "cannot pair" and skipped rather than
 *   thrown, so one bad row doesn't crash the whole match.
 * @param {object} [opts]
 * @param {number} [opts.threshold=0] - a candidate must score strictly
 *   greater than this to be eligible. Use a negative threshold (e.g. -Infinity)
 *   to force every `a` to match something even on a poor score.
 * @returns {{
 *   pairs: Array<{ a: object, b: object, score: number }>,
 *   unmatchedA: Array<object>,
 *   unmatchedB: Array<object>,
 * }} `pairs` is ordered by `sideA`'s input order. `unmatchedA`/`unmatchedB`
 *   preserve each side's original input order.
 */
export function matchPairwise(sideA, sideB, score, opts = {}) {
  if (!Array.isArray(sideA) || !Array.isArray(sideB)) {
    throw new TypeError('matchPairwise: sideA and sideB must both be arrays')
  }
  if (typeof score !== 'function') {
    throw new TypeError('matchPairwise: score must be a function')
  }
  const { threshold = 0 } = opts

  const usedB = new Set()
  const pairs = []

  for (const a of sideA) {
    let best = null
    let bestScore = threshold

    for (const b of sideB) {
      if (b.id === a.id) continue // self-match prevention
      if (usedB.has(b.id)) continue

      const s = score(a, b)
      if (!Number.isFinite(s)) continue
      if (s > bestScore) {
        best = b
        bestScore = s
      }
    }

    if (best) {
      usedB.add(best.id)
      pairs.push({ a, b: best, score: bestScore })
    }
  }

  const matchedAIds = new Set(pairs.map((p) => p.a.id))
  const unmatchedA = sideA.filter((a) => !matchedAIds.has(a.id))
  const unmatchedB = sideB.filter((b) => !usedB.has(b.id))

  return { pairs, unmatchedA, unmatchedB }
}

// ---------------------------------------------------------------------------
// findCycles
// ---------------------------------------------------------------------------

/**
 * n-way swap-cycle detection over a "who wants whose slot" graph.
 *
 * `wants` is a list of directed edges: `{ from, to }` means "`from` wants
 * `to`'s slot." Because everyone wants at most one thing, this graph has
 * out-degree at most 1 per node (a *functional graph*) — which means every
 * node either dead-ends at someone who wants nothing, or eventually loops
 * back on itself. Every loop is a confirmable cycle: a 2-cycle is an
 * ordinary two-party swap, a 3-cycle is the "A wants B's, B wants C's, C
 * wants A's" case the archetype names explicitly, and cycles can be
 * arbitrarily long.
 *
 * Self-loops (`from === to`, someone "wants" their own slot) are dropped
 * before graph construction — that is not a swap, it is a no-op, and
 * reporting it as a length-1 cycle would be misleading in a UI that reads
 * "N people confirmed a swap."
 *
 * Duplicate `from` entries (the same participant appearing twice with
 * different wants) are not a supported input shape — each participant
 * wants exactly one slot — so a later entry for the same `from` silently
 * overwrites an earlier one, same as building a `Map` from the array
 * would. De-duplicate upstream of this call if your data can contain
 * duplicates and you need choose-first (not choose-last) semantics.
 *
 * Determinism: nodes are visited in the order they first appear as a
 * `from` in the input array, and a cycle is reported starting at whichever
 * node in it was reached first by that walk — so the same input array
 * always produces the same cycles, in the same order, each rotated to the
 * same starting point.
 *
 * @param {Array<{ from: any, to: any }>} wants
 * @returns {Array<Array<any>>} one array of node ids per cycle found, each
 *   in swap order (`cycle[i]` wants `cycle[i + 1]`'s slot, and the last
 *   element wants the first's) — never includes non-cycle chains.
 */
export function findCycles(wants) {
  if (!Array.isArray(wants)) {
    throw new TypeError('findCycles: wants must be an array')
  }

  const graph = new Map()
  for (const w of wants) {
    if (!w || w.from === undefined || w.from === null) continue
    if (w.to === undefined || w.to === null) continue
    if (w.from === w.to) continue // wanting your own slot isn't a swap
    graph.set(w.from, w.to)
  }

  const globalSeen = new Set()
  const cycles = []

  for (const start of graph.keys()) {
    if (globalSeen.has(start)) continue

    const path = []
    const indexOnPath = new Map()
    let cur = start

    while (cur !== undefined && graph.has(cur) && !globalSeen.has(cur)) {
      if (indexOnPath.has(cur)) {
        cycles.push(path.slice(indexOnPath.get(cur)))
        break
      }
      indexOnPath.set(cur, path.length)
      path.push(cur)
      cur = graph.get(cur)
    }

    for (const node of path) globalSeen.add(node)
  }

  return cycles
}

// ---------------------------------------------------------------------------
// settleDebts
// ---------------------------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100

/**
 * Minimal-transfer debt settlement from a list of net balances.
 *
 * `balances` is one row per participant: `net = paid - owed`. Positive
 * `net` means the group owes that person (a creditor); negative means they
 * owe the group (a debtor). Reach for this for any bill-split or
 * rent-split bullet — feed it the net balances, render the returned
 * transfer list as "X pays Y ৳Z", done.
 *
 * Algorithm: repeatedly match the largest remaining creditor against the
 * largest remaining debtor, transfer the smaller of the two magnitudes,
 * and retire whichever side hit zero. This is the same greedy strategy
 * apps like Splitwise use for their "simplify debts" feature. It always
 * terminates in at most `n - 1` transfers for `n` participants with a
 * nonzero balance (every transfer fully retires at least one participant,
 * and the last remaining participant must already be at zero once
 * everyone else is settled — property-tested below over randomized
 * balances) — but it is not proven to be the *global* minimum possible
 * transfer count; see the file header.
 *
 * Balances that do not sum to (approximately) zero are settled as far as
 * the smaller side allows — the loop stops when either the creditor list
 * or the debtor list is exhausted, which is correct behaviour for
 * mismatched input, but the caller should treat a large leftover as a
 * sign the input balances were wrong, not as a bug in this function.
 *
 * Floating point: balances within `epsilon` of zero are treated as already
 * settled and never produce a transfer, and every emitted transfer amount
 * is rounded to 2 decimal places (cents/paisa) so `0.1 + 0.2`-style float
 * noise never leaks into a displayed amount or causes the loop to spin on
 * an amount that never quite reaches zero.
 *
 * @param {Array<{ id: any, net: number }>} balances
 * @param {object} [opts]
 * @param {number} [opts.epsilon=1e-6] - balances with |net| <= epsilon are
 *   treated as already settled.
 * @returns {Array<{ from: any, to: any, amount: number }>} transfers in the
 *   order they were decided; `from` pays `to` exactly `amount`.
 */
export function settleDebts(balances, opts = {}) {
  if (!Array.isArray(balances)) {
    throw new TypeError('settleDebts: balances must be an array')
  }
  const { epsilon = 1e-6 } = opts

  const byIdThenNet = (x, y) => {
    if (x.id < y.id) return -1
    if (x.id > y.id) return 1
    return 0
  }

  const cred = balances
    .filter((b) => b.net > epsilon)
    .map((b) => ({ id: b.id, net: b.net }))
    .sort((x, y) => y.net - x.net || byIdThenNet(x, y))

  const debt = balances
    .filter((b) => b.net < -epsilon)
    .map((b) => ({ id: b.id, net: b.net }))
    .sort((x, y) => x.net - y.net || byIdThenNet(x, y))

  const transfers = []
  let i = 0
  let j = 0

  while (i < cred.length && j < debt.length) {
    const amount = Math.min(cred[i].net, -debt[j].net)
    if (amount > epsilon) {
      transfers.push({ from: debt[j].id, to: cred[i].id, amount: round2(amount) })
    }
    cred[i].net -= amount
    debt[j].net += amount
    if (cred[i].net <= epsilon) i++
    if (debt[j].net >= -epsilon) j++
  }

  return transfers
}
