# NOTES.md

Gotchas found mid-build that affect more than one unit. One line each, newest on top.
Chat evaporates; this file syncs.

- **18:57 (U1) — the organizers' `format_note` for P10 is truncated.** It cuts off
  mid-sentence at "Item 4 runs on the three `comparison.months`: `source` `readings`
  uses the case's own", so what a `source` other than `"readings"` means is not
  documented anywhere in the pack. All 25 published cases use `source: "readings"`
  with `daily_units: null`. SPEC.md's rule: `"readings"` uses the case's own day
  readings for those three months, anything else uses `comparison.daily_units` as a
  flat figure for every day. Hits U4. Worth one question in the support channel —
  do not guess silently.
- **18:57 (U1) — `import ... from './x.json'` needs an import attribute to run under
  `node --test`.** Vite accepts the bare form, Node does not, so a test importing a
  module that loads JSON fails with `Unknown file extension ".json"`. Written as
  `import seed from '../data/seed-p10.json' with { type: 'json' }`, which both Vite 8
  and Node 22 accept. Verified in both.
- **18:57 (U1) — a component only referenced by an unimported module is not in the
  bundle, and `npm run build` still passes.** The bundle stayed byte-identical at
  195.08 kB with `DataSource.jsx` fully written. `npm run build` passing does not mean
  your code shipped — check the bundle size moved, or grep the deployed bundle with
  `bash scripts/smoke-live.sh <url> <a string only your unit contains>`.
- **18:57 (U1) — tests do not prove a component renders.** Compile every `.jsx` before
  calling it done:
  `npx esbuild src/features/Yours.jsx --loader:.jsx=jsx --jsx=automatic --bundle --format=esm --external:react --external:react-dom --outfile=/dev/null`
- **U3 → U2, projection start convention.** `Questions.jsx` calls `projectRunOut` and
  `requiredRecharge` with `fromDate` = **the day after `kase.today`** (today's units are
  already consumed in `simulate`), `fromBalancePaisa` = the last sim row's `balancePaisa`,
  and `monthUnitsBefore` = the month's running total through `today` when that next day is
  still in the same calendar month, else `0`. If `tariff.js` treats `fromDate` as the last
  *known* day instead of the first *projected* day, the answers shift by one day — please
  match this convention or say so here.
- **Fixture `format_note` is truncated** in `P10_prepaid_meter_public.json`, mid-sentence at
  "`source` `readings` uses the case's own", so a `source` other than `"readings"` is
  undocumented. All 25 public cases use `source: "readings"` with `daily_units: null`.
  Treat non-`readings` as a flat `comparison.daily_units` per day, and ask in the support
  channel rather than guessing silently.
- **U2 → U3, projection convention confirmed — your reading is what shipped.** `projectRunOut`
  and `requiredRecharge` treat `fromDate` as the **first projected day**: it is charged inside
  the loop, not assumed already consumed. So passing the day after `kase.today` with the last
  sim row's `balancePaisa` and that month's running total is exactly right, and no day is
  double-counted. `requiredRecharge` covers `fromDate` through `targetDate` **inclusive**.
- **U2 → U3, two additive fields on `requiredRecharge`, both optional.** SPEC's four parts sum
  to `totalPaisa`, which is the *gross* cost of the window — so the breakdown adds up on screen.
  What must actually be handed over is `netRequiredPaisa` (gross minus the balance already on
  the meter, floored at zero). Pass `chargedMonths: sim.firstRechargeMonths` if you want a month
  already charged during the rebuild not to be charged a second time; omitted, the recharge is
  treated as its month's first.
- **U2 → U4, SPEC's reference oracle is one paisa off on PUB-01 and the engine is not.** The
  table says the habit cost is 11815.36; `compareHabits` returns 11815.37. The comparison
  window's energy is 1,101,845 paisa by two independent methods (the slab walk, and charging
  all 21,730 units one at a time), and 5 percent of that is 55,092.25 → 55,092, giving
  1,101,845 + 55,092 + 24,600 = 1,181,537. No rounding rule reaches the published figure.
  **Do not "fix" the engine to match the table.** What the oracle is for still holds exactly and
  is asserted in `tariff.test.mjs`: the two habits are equal on PUB-01, both pay three sets of
  fixed charges, and any difference is a whole multiple of 8200 paisa.
- **VAT is rounded once per period, never once per day.** A day's energy is very often an exact
  half-paisa of VAT, so rounding daily and summing runs half a paisa per day high — 7 paisa over
  a 91-day window, enough to turn "equal" into "not equal" on required item 4. The day rows still
  sum to exactly `vatOn(totals.energyPaisa)`; do not re-round them.
