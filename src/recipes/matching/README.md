# matching

Matching and allocation engines for the "match two sides" archetype: pairwise
assignment between two lists, n-way swap-cycle detection, and minimal-transfer
debt settlement. Pure functions, dependency-free, no DOM — the matcher itself
is a data problem, not a UI problem, so there is no `.jsx` here (same shape as
`bd-formats/`: copy the logic file, wire it up in whatever markup your bullet
actually needs).

Zero recipes in this kit touched the actual matching logic before this one —
`search-filter` and `realtime` cover browsing/liveness *around* a match, never
the match itself. This closes that gap for four of the drill's twelve
problems (bill split, class swap, rent split, tutor match) and the whole
"match two sides" archetype.

## Files

| File | What |
|---|---|
| `match.js` | `matchPairwise`, `findCycles`, `settleDebts` — the three algorithms, each independently useful. |
| `match.test.mjs` | `node --test` coverage, including a seeded-PRNG property test over randomized balances for `settleDebts`. |

## Using it

```bash
cp -r src/recipes/matching src/lib/matching
```

```js
import { matchPairwise, findCycles, settleDebts } from '../lib/matching/match.js'

// --- pairwise: tutor/student, driver/load, any "assign X to Y" bullet ---
const { pairs, unmatchedA, unmatchedB } = matchPairwise(
  students,
  tutors,
  (student, tutor) => (student.subject === tutor.subject ? 10 : 0),
  { threshold: 0 },
)
// pairs: [{ a: student, b: tutor, score }, ...]
// unmatchedA / unmatchedB: whoever is left over — show these, don't hide them

// --- n-way swap: class swap, shift swap, seat swap ---
const cycles = findCycles([
  { from: 'alice', to: 'bobs-slot' },
  { from: 'bob', to: 'carols-slot' },
  { from: 'carol', to: 'alices-slot' },
])
// cycles: [['alice', 'bob', 'carol']] — a confirmable 3-way swap

// --- debt settlement: bill split, rent split ---
const transfers = settleDebts([
  { id: 'alice', net: 200 },  // paid 300, owed 100 -> net = paid - owed
  { id: 'bob', net: -100 },
  { id: 'carol', net: -100 },
])
// transfers: [{ from: 'bob', to: 'alice', amount: 100 }, { from: 'carol', to: 'alice', amount: 100 }]
```

Wire-up, per the archetype doc: seed both sides with demo data, run the
matcher, show the result. Skip the signup/login flow entirely for the first
pass — the matcher running on seeded data *is* the demo, and a judge should
see it inside the first 20 minutes, not discover it working at hour 3.

## The 3 gotchas

1. **`matchPairwise` is greedy, not globally optimal.** It picks each `a`'s
   best still-available `b` in input order — this is not the Hungarian
   algorithm, and a different `sideA` ordering can occasionally produce a
   different (still valid, still every-constraint-respected) set of pairs
   with a slightly lower total score. At hackathon scale (well under 500
   rows a side) this essentially never looks wrong to a human judging the
   result, but don't claim "optimal assignment" — claim "best available
   match, greedily, in list order."

2. **`settleDebts` is not proven to produce the mathematically minimum
   number of transfers.** True minimum-transfer debt settlement is NP-hard.
   The greedy largest-creditor-vs-largest-debtor sweep used here (the same
   strategy apps like Splitwise use) is proven — and property-tested with a
   seeded PRNG over hundreds of randomized balance sets — to need at most
   `n - 1` transfers for `n` participants, which is what "minimal-transfer"
   means in this README: fewest transfers *this greedy strategy* finds, not
   fewest transfers *possible*. Say that to a judge if asked; the practical
   difference is rare to see and never wrong, just not a proof of optimality.

3. **`findCycles` silently overwrites a duplicate `from` entry (last one
   wins) instead of erroring.** The input shape assumes each participant
   wants exactly one thing; if your data can legitimately contain more than
   one "want" per person (e.g. a ranked list of acceptable swaps, not a
   single pick), de-duplicate to each person's top choice *before* calling
   this function — it will not tell you it dropped anything.

## One more thing worth knowing

All three functions expect a stable `id` field on every entity and never
mutate their inputs — `matchPairwise` and `settleDebts` both copy before
sorting/removing. That makes it safe to call any of them straight from
render (e.g. inside a `useMemo`) without worrying about the seeded demo data
changing shape underneath the UI on a second render.
