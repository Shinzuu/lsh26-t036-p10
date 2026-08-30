# SPEC — P10 Prepaid Meter Recharge Advisor (Tier 02, 7.5 credit)

Repo `lsh26-t036-p10` · live https://lsh26-t036-p10.pages.dev · kit `starter-kit-react`
Team LSH26-T036 · event start code `LSH26-8490-C900`

Like P08, this is a rules engine — a day-by-day simulation over a fixed tariff. No map,
no realtime, no LLM, no auth, no backend. The single largest risk in the whole problem is
stated in its own constraints: the slab counter resets on the **first day of the calendar
month**, not on a recharge, and getting that backwards produces the wrong number
everywhere.

---

## The four required items, verbatim

1. Create a household with at least six months of daily unit readings and its recharge
   history. The readings must include a light month, a heavy summer month and a month
   where the family recharged a large amount in the last week.
2. Rebuild the meter balance day by day using the tariff above. Charge each day's units
   at the slab the month's running total has reached, take the demand charge and meter
   rent on the first recharge of each month, add VAT, and show the balance as a line with
   every recharge marked on it.
3. Answer the family's two questions. Given today's balance and their usual daily use, on
   which date does the balance run out. And to last until a date the user picks, how much
   must be recharged today. Break that amount into energy, the part caused by being in a
   higher slab, fixed charges and VAT.
4. Compare two recharge habits over the same three months on the same consumption:
   recharging a large amount whenever the balance runs low, against recharging at the
   start of each month. Show which one costs less and by how much.

### Constraints, verbatim

- Use the tariff and the charges exactly as written in the problem. Real published
  tariffs change and will not be used for checking.
- The slab counter resets on the first day of the calendar month, not on a recharge.
  Getting this backwards will produce the wrong number everywhere.
- The comparison in the last item must run on identical consumption. Changing the usage
  between the two habits proves nothing.

### The tariff, verbatim from the problem statement

Units 1 to 75 in a month cost 4.63 taka each, 76 to 200 cost 5.26, 201 to 300 cost 5.63,
301 to 400 cost 5.83, 401 to 600 cost 9.30, and 601 and above cost 10.70. On top of that
there is a demand charge of 42 taka and a meter rent of 40 taka, both taken once a month
on the first recharge of that month, and 5 percent VAT on the energy amount. The slab
counter resets on the first day of each calendar month and a recharge does not reset it.

### Clarifications — judges mark by these

- Both recharge habits use identical daily consumption and the same calendar month slab
  counter. Recharge timing cannot create an energy rate saving. (R-16)
- "Cost" means the money the meter consumes: energy, VAT and the applicable monthly fixed
  charges. It is not the amount deposited. (R-33)
- The two results may legitimately be equal. Any difference can come only from how many
  monthly first recharge fixed charges occur. A fabricated slab saving is a failure.
  (R-16)
- The two habits: "low balance" recharges the case's amount at the start of any day whose
  balance is below the case's threshold; "monthly" recharges the case's amount on the 1st
  of each month. Both start from the case's opening balance and run the three named
  months. (R-33)

**Read R-16 twice before writing item 4.** The correct answer is often "they cost the
same", and when they differ the difference is exactly 82 taka times the difference in the
number of months that saw at least one recharge. A comparison that reports a slab saving
is marked as a failure, not as a rounding problem.

---

## Data model

The organizers' fixture shape **is** the data model.

```
Case:
  case_id:              string
  opening_balance_bdt:  string        // "310.00" — decimal string, not a number
  days:     [{ date: "YYYY-MM-DD", units: integer }]     // consecutive, starts on the 1st of a month
  recharges:[{ date: "YYYY-MM-DD", amount_bdt: string }]
  today:                "YYYY-MM-DD" // the last reading date
  usual_daily_units:    integer
  target_date:          "YYYY-MM-DD"
  comparison:
    months:               ["YYYY-MM", "YYYY-MM", "YYYY-MM"]
    source:               "readings"          // see the note below
    daily_units:          integer | null
    opening_balance_bdt:  string
    low_threshold_bdt:    string
    low_amount_bdt:       string
    monthly_amount_bdt:   string
```

Reference case PUB-01: opening balance 310.00, 181 consecutive days from 2026-01-01 to
2026-06-30, today 2026-06-30, usual daily use 19 units, target 2026-08-13, comparison over
2026-04 / 2026-05 / 2026-06 with a 200.00 threshold, 5000.00 low-balance amount and
2000.00 monthly amount. It satisfies item 1 on its own.

**Known gap in the organizers' data.** The `format_note` in
`P10_prepaid_meter_public.json` is truncated mid-sentence at "`source` `readings` uses the
case's own", so the meaning of a `source` other than `"readings"` is not documented. All
25 public cases use `source: "readings"` with `daily_units: null`. Handle it as: when
`source === "readings"`, take the case's own day readings for the three comparison months;
otherwise use `comparison.daily_units` as a flat figure for every day of those months.
Put one line in `NOTES.md` and ask in the Discord support channel — do not guess silently.

**Storage:** none. State lives in React. The app is a calculator.

**Seed data:** `src/data/seed-p10.json` is fixture case PUB-01 copied verbatim. The app
opens with the balance line already drawn.

---

## Money arithmetic — decided here, once

**Work in integer paisa everywhere inside the engine.** Rates become integers
(4.63 taka → 463 paisa per unit), units are integers, so energy cost is an exact integer
with no float drift across 181 days of compounding. Fixed charges are 4200 and 4000
paisa. VAT is `Math.round(energyPaisa * 5 / 100)`, half-up. Convert to taka only at the
render edge with a single `formatBDT` helper. Amounts arriving as decimal strings
(`"310.00"`) are parsed to paisa with `Math.round(parseFloat(s) * 100)`.

This is worth stating because floats will otherwise put the balance a few paisa off by
June, and item 4's whole answer is a difference of a few hundred taka.

---

## The store module — integrator-owned, export shape fixed here

`src/lib/store.js`. Integrator only.

```js
export function useCase()      // -> { kase, sim, load, error }
export function useDay()       // -> { selectedDate, selectDay }
```

`kase` is the parsed fixture case; `sim` is the return of `simulate(kase)`, recomputed
whenever `load(kase)` is called. `load` sets `error` to a readable string on a bad shape
and leaves the previous case in place.

---

## The engine — U2 owns it, everyone else imports it

`src/lib/tariff.js`. These signatures are fixed. U3 and U4 build against them without
waiting.

```js
export const SLABS = [
  { upTo: 75,       paisaPerUnit: 463  },
  { upTo: 200,      paisaPerUnit: 526  },
  { upTo: 300,      paisaPerUnit: 563  },
  { upTo: 400,      paisaPerUnit: 583  },
  { upTo: 600,      paisaPerUnit: 930  },
  { upTo: Infinity, paisaPerUnit: 1070 },
]
export const DEMAND_CHARGE_PAISA = 4200
export const METER_RENT_PAISA    = 4000
export const VAT_PERCENT         = 5

export function toPaisa(decimalString)   // "310.00" -> 31000
export function formatBDT(paisa)         // 31000 -> "৳310.00"

// Cost of consuming `units` when `unitsBefore` are already consumed this calendar month.
// -> { paisa, parts: [{ paisaPerUnit, units, paisa }] }
export function energyCost(unitsBefore, units)

// Day-by-day rebuild over the whole case.
// -> {
//   rows: [{ date, units, monthUnitsBefore, energyPaisa, vatPaisa, fixedPaisa,
//            rechargePaisa, balancePaisa, slabParts }],
//   totals: { energyPaisa, vatPaisa, fixedPaisa, rechargedPaisa },
//   firstRechargeMonths: ["2026-01", ...]   // months that took the fixed charges
// }
export function simulate(kase)

// Forward projection at a flat daily rate from `fromDate` with `fromBalancePaisa`,
// continuing the calendar month's running total in `monthUnitsBefore`.
// -> { runsOutOn: "YYYY-MM-DD" | null, rows: [...] }
export function projectRunOut({ fromDate, fromBalancePaisa, dailyUnits, monthUnitsBefore })

// Amount needed today so the balance survives every day up to and including targetDate.
// -> { totalPaisa, energyPaisa, higherSlabPaisa, fixedPaisa, vatPaisa }
export function requiredRecharge({ fromDate, fromBalancePaisa, dailyUnits, monthUnitsBefore, targetDate })

// -> {
//   low:     { costPaisa, energyPaisa, vatPaisa, fixedPaisa, rechargeDates, monthsCharged },
//   monthly: { ...same },
//   cheaper: 'low' | 'monthly' | 'equal',
//   differencePaisa,
//   reason      // sentence naming the number of monthly first-recharge fixed charges on each side
// }
export function compareHabits(kase)
```

Three definitions fixed here so the four parts in item 3 reconcile on screen:

1. **`energyPaisa`** in `requiredRecharge` is every projected unit charged at the lowest
   slab rate, 463 paisa. **`higherSlabPaisa`** is the actual slab-aware energy cost minus
   that base. So `energy + higherSlab` equals the real energy charge, and the four parts
   sum exactly to `totalPaisa`. State this definition in the README — the problem says
   "the part caused by being in a higher slab" without defining the baseline, so ours has
   to be visible and consistent.
2. **`fixedPaisa`** in `requiredRecharge` is 8200 only when the recharge being made is the
   first recharge of its calendar month, plus 8200 for each later calendar month the
   projection spans. Months already charged in the simulation are not charged twice.
3. **`compareHabits` cost** is `energy + VAT + fixed`, per R-33. It is not the sum of the
   deposits. Both habits run on the identical day readings for `comparison.months`, both
   start from `comparison.opening_balance_bdt`, and the slab counter resets on the 1st of
   each of those months.

`src/lib/tariff.test.mjs` runs under `node --test` and must cover: a single day inside one
slab; a day that straddles a slab boundary; the 75/76, 200/201, 300/301, 400/401 and
600/601 boundaries; a month rollover resetting the counter to zero; two recharges in one
month taking the fixed charges exactly once; a month with no recharge taking no fixed
charge; VAT applied to energy only and never to the fixed charges; and `compareHabits`
returning `equal` with a zero difference when both habits recharge in all three months.

---

## Screens

One screen, no router.

- **Header** — case id, the date range covered, today's balance, and the load control.
- **Balance chart** — the full period as a line, a marker at every recharge, month
  boundaries visible. Selecting a day shows that day's units, the slab rate charged, the
  month's running total, and the balance after.
- **Questions panel** — the run-out date, and a target-date input with the required amount
  broken into its four parts.
- **Habit comparison** — the two habits side by side with the cost breakdown, the winner,
  the difference, and the sentence explaining where the difference comes from.

Theme: `ochre` — operations. One `@import` line in `app.css`, integrator only.

## Recipes used

- `charts/LineChart.jsx` and `charts/scale.js` → the balance line in U2. `linePath` and
  `niceTicks` do the work; recharge markers are extra points drawn over it.
- `bd-formats/money.js` → `formatBDT` as a reference for the taka format. The engine's own
  paisa-based formatter is the one used, to keep integer arithmetic end to end.
- `bd-formats/datetime.js` → `formatDate` for axis labels.
- Nothing else.

---

## Unit list — build order is item order

**U1 (item 1) — the household and ingest.** Branch `u1-household`.
Files: `src/data/seed-p10.json`, `src/lib/dataset.js`, `src/features/DataSource.jsx`.
Copy fixture case PUB-01 verbatim. `dataset.js` exports `parseCase(json)` which validates
the shape and throws a readable message, and `SEED`. `DataSource.jsx` renders the header
strip: case id, the date range, the number of readings, a paste textarea and a file input,
and a "months in this data" line that computes each month's total units and labels the
lightest month, the heaviest month, and the month whose largest recharge falls in its last
seven days. Those three labels are the evidence for item 1's three required month
characters — compute them, do not hard-code them.
*Done when:* the live URL opens with 181 days and the recharge history already loaded, the
three months are labelled on screen, and pasting fixture case PUB-02 replaces the
household and changes the labels.

**U2 (item 2) — the tariff engine and the balance line.** Branch `u2-tariff-engine`.
Files: `src/lib/tariff.js`, `src/lib/tariff.test.mjs`, `src/features/BalanceChart.jsx`.
Contract and `node --test` suite before the component. Implement the export shape above
exactly — U3 and U4 are already coding against it. `BalanceChart.jsx` draws the balance
across the whole period with a marker at every recharge and month boundaries visible, and
a detail line for the selected day showing units, slab rate, month running total and
closing balance.
*Done when:* `node --test` passes and the live URL shows the balance line over the whole
period with a marker at each recharge; selecting a day shows that day's units, the slab
rate charged and the month's running total.

**U3 (item 3) — the two questions.** Branch `u3-questions`.
Files: `src/features/Questions.jsx`.
Question one: from today's balance and `usual_daily_units`, the date the balance runs out,
with the assumption stated on screen. Question two: a target-date input defaulting to the
case's `target_date`, and the amount that must be recharged today, broken into energy,
the part caused by being in a higher slab, fixed charges and VAT — with the four parts
shown adding to the total. Import from `src/lib/tariff.js`; do not edit it.
*Done when:* the live URL shows a run-out date computed from today's balance and usual
daily use; changing the target date changes the required amount, and the four parts
visibly add up to the total.

**U4 (item 4) — the habit comparison.** Branch `u4-habit-compare`.
Files: `src/features/HabitCompare.jsx`.
Run both habits over `comparison.months` on identical consumption, per R-33's definitions.
Show each habit's energy, VAT, fixed charges and total, the recharge dates each habit
produced, which is cheaper and by how much — and a sentence naming how many monthly
first-recharge fixed charges each side incurred, which is the only legitimate source of a
difference. When the two are equal, say so plainly; equal is a correct answer.
*Done when:* the live URL shows both habits' cost over the three months with the
difference stated, and states in words that any difference comes only from the number of
monthly first-recharge fixed charges.

**U5+ (only after 4/4).** Bonus features, in order of value: a warning when the month's
running total is close to the next slab, showing what the next unit will cost after it
crosses; a one-month bill broken into energy, demand charge, meter rent and VAT; pasting a
real recharge history and comparing the rebuilt balance against what the meter showed.

---

## Out of scope — written down so nobody builds it

Authentication. Accounts. Persistence. A second route. Editing daily readings in the UI.
Any real published tariff. Dark mode. Currency other than taka.

---

## Acceptance script

1. Open the live URL cold → the balance line is already drawn over six months with
   recharge markers, no upload performed.
2. Read the header's months line → the lightest month, the heaviest month and the
   late-large-recharge month are each named.
3. Select a day inside a heavy month → the detail shows that day's units, the slab rate
   being charged, and the month's running total.
4. Select the 1st of the next month → the running total has reset to that day's units,
   and the rate charged has dropped back to the lowest slab.
5. Read the run-out date → it is computed from today's balance and the usual daily use,
   with the assumption stated.
6. Change the target date to something later → the required amount rises, and the four
   parts still add to the total shown.
7. Scroll to the comparison → both habits show a cost over the same three months, the
   difference is stated, and the sentence explains it as a difference in the number of
   monthly first-recharge fixed charges.

---

## Ready-to-paste unit prompts

Fill `<name>` from PICKS.md.

```text
Set effort low. Read CLAUDE.md, SPEC.md and BOARD.md in full. This repo is P10; you are
the builder for unit U1, owned by <name>, on branch u1-household. Build only U1 — its
files are src/data/seed-p10.json, src/lib/dataset.js, src/features/DataSource.jsx. Shared
files (App.jsx, src/lib/store.js, app.css, index.html, package.json) are off limits; if
you need a change there, write the exact diff as a request on BOARD.md instead.

Build: copy fixture case PUB-01 verbatim into src/data/seed-p10.json. Export parseCase(json)
and SEED from src/lib/dataset.js — parseCase validates the fixture shape and throws a
readable message naming the missing field. DataSource.jsx renders the header strip: case
id, date range, number of readings, a paste textarea and a file input that both call
parseCase, and a "months in this data" line that COMPUTES each month's total units and
labels the lightest month, the heaviest month, and the month whose largest recharge falls
in its last seven days. Compute those three labels from the data; do not hard-code them —
they are the evidence for required item 1 and the judges test other cases.

Done means: npm run build passes AND the live URL opens with 181 days and the recharge
history loaded, the three months labelled, and pasting fixture case PUB-02 replaces the
household and changes the labels. Verify with bash scripts/smoke-live.sh <url> first, then
in a browser. Return: files changed, the build output tail, and how you verified.
```

```text
Set effort low. Read CLAUDE.md, SPEC.md and BOARD.md in full. This repo is P10; you are
the builder for unit U2, owned by <name>, on branch u2-tariff-engine. Build only U2 — its
files are src/lib/tariff.js, src/lib/tariff.test.mjs, src/features/BalanceChart.jsx.
Shared files are off limits; request changes on BOARD.md.

This is the no-recipe unit: contract and node --test suite BEFORE the component. Implement
exactly the export shape in SPEC.md's "The engine" section — U3 and U4 are already coding
against those names. Non-negotiables from the problem's own constraints: work in integer
paisa throughout (4.63 taka is 463 paisa) and convert to taka only at the render edge; the
slab counter resets on the FIRST DAY OF THE CALENDAR MONTH and a recharge does NOT reset
it; the demand charge (4200 paisa) and meter rent (4000 paisa) are taken once per calendar
month, on the first recharge of that month, and a month with no recharge takes neither;
VAT is 5 percent of the energy amount only, never of the fixed charges.

Tests must cover: one day inside a slab; a day straddling a boundary; the 75/76, 200/201,
300/301, 400/401 and 600/601 boundaries; a month rollover resetting the counter; two
recharges in one month taking the fixed charges exactly once; a month with no recharge
taking none; VAT on energy only.

BalanceChart.jsx uses src/recipes/charts (copy it into src/lib, do not import across
recipes) to draw the balance over the whole period with a marker at every recharge and
month boundaries visible, plus a detail line for the selected day: units, slab rate, month
running total, closing balance.

Done means: node --test src/lib/tariff.test.mjs passes, npm run build passes, AND the live
URL shows the balance line with recharge markers and a day detail showing the slab rate
and month running total. Return: files changed, test output tail, build output tail, and
how you verified.
```

```text
Set effort low. Read CLAUDE.md, SPEC.md and BOARD.md in full. This repo is P10; you are
the builder for unit U3, owned by <name>, on branch u3-questions. Build only U3 — its file
is src/features/Questions.jsx. Shared files are off limits; request changes on BOARD.md.
Import from src/lib/tariff.js and src/lib/store.js; do not edit either.

Question one: from today's balance and the case's usual_daily_units, show the date the
balance runs out, with the assumption stated on screen. Question two: a target-date input
defaulting to the case's target_date, showing the amount that must be recharged today,
broken into energy, the part caused by being in a higher slab, fixed charges, and VAT.

The four parts must visibly add up to the total. Per SPEC.md, energy is every projected
unit at the lowest slab rate (463 paisa) and the higher-slab part is the real slab-aware
cost minus that base — so the two together equal the true energy charge. Say that
definition on screen in one line, because the problem does not define the baseline.

Done means: npm run build passes AND the live URL shows a run-out date computed from
today's balance and usual daily use, and changing the target date changes the required
amount with the four parts still adding to the total. Return: files changed, the build
output tail, and how you verified.
```

```text
Set effort low. Read CLAUDE.md, SPEC.md and BOARD.md in full. This repo is P10; you are
the builder for unit U4, owned by <name>, on branch u4-habit-compare. Build only U4 — its
file is src/features/HabitCompare.jsx. Shared files are off limits; request changes on
BOARD.md. Import compareHabits from src/lib/tariff.js; do not edit it.

Run both recharge habits over the case's comparison.months on identical consumption, per
clarification R-33: "low balance" recharges comparison.low_amount_bdt at the start of any
day whose balance is below comparison.low_threshold_bdt; "monthly" recharges
comparison.monthly_amount_bdt on the 1st of each month; both start from
comparison.opening_balance_bdt. Show each habit's energy, VAT, fixed charges and total,
the recharge dates it produced, which is cheaper and by how much.

Read clarification R-16 before you start: cost means what the meter consumes, not what was
deposited; recharge timing CANNOT create an energy rate saving; the two results may
legitimately be equal; and any difference can come only from how many monthly
first-recharge fixed charges occurred. A reported slab saving is marked a failure. Print a
sentence naming how many monthly first-recharge fixed charges each side incurred. When the
two are equal, say so plainly — equal is a correct answer.

Done means: npm run build passes AND the live URL shows both habits' cost over the three
months with the difference stated and the fixed-charge explanation in words. Return: files
changed, the build output tail, and how you verified.
```

---

## Reference oracle — expected answers for item 4 on all 25 public cases

Computed here from the tariff rules while writing this spec, as an independent check on
whatever U4 builds. Cost is energy + VAT + fixed charges in taka, per R-33. In every one
of the 25 public cases the energy and VAT totals are **identical** between the two habits
— exactly as R-16 says they must be — and the whole difference is the fixed charges.

Twenty-two cases come out equal. Three differ, and each differs by exactly 82.00 taka,
because the low-balance habit recharged in only two of the three months and so paid the
demand charge and meter rent twice instead of three times.

**If U4 produces a difference that is not 0.00 or a multiple of 82.00, it is wrong.**
That is the cheapest possible check on the most dangerous item in this problem.

| Case | low-balance cost | monthly cost | difference | fixed-charge months (low / monthly) |
|---|---|---|---|---|
| PUB-01 | 11815.36 | 11815.36 | +0.00 | 3 / 3 |
| PUB-02 | 9341.09 | 9423.09 | -82.00 | 2 / 3 |
| PUB-03 | 14264.25 | 14264.25 | +0.00 | 3 / 3 |
| PUB-04 | 10726.50 | 10726.50 | +0.00 | 3 / 3 |
| PUB-05 | 9424.31 | 9424.31 | +0.00 | 3 / 3 |
| PUB-06 | 8106.76 | 8188.76 | -82.00 | 2 / 3 |
| PUB-07 | 8474.74 | 8474.74 | +0.00 | 3 / 3 |
| PUB-08 | 8626.93 | 8626.93 | +0.00 | 3 / 3 |
| PUB-09 | 11893.84 | 11893.84 | +0.00 | 3 / 3 |
| PUB-10 | 12010.32 | 12010.32 | +0.00 | 3 / 3 |
| PUB-11 | 15693.96 | 15693.96 | +0.00 | 3 / 3 |
| PUB-12 | 9012.94 | 9012.94 | +0.00 | 3 / 3 |
| PUB-13 | 14013.37 | 14013.37 | +0.00 | 3 / 3 |
| PUB-14 | 16564.91 | 16564.91 | +0.00 | 3 / 3 |
| PUB-15 | 7781.98 | 7781.98 | +0.00 | 3 / 3 |
| PUB-16 | 14467.19 | 14467.19 | +0.00 | 3 / 3 |
| PUB-17 | 8331.46 | 8331.46 | +0.00 | 3 / 3 |
| PUB-18 | 10633.88 | 10633.88 | +0.00 | 3 / 3 |
| PUB-19 | 9423.01 | 9423.01 | +0.00 | 3 / 3 |
| PUB-20 | 9784.43 | 9784.43 | +0.00 | 3 / 3 |
| PUB-21 | 10980.07 | 10980.07 | +0.00 | 3 / 3 |
| PUB-22 | 13134.59 | 13134.59 | +0.00 | 3 / 3 |
| PUB-23 | 8939.71 | 8939.71 | +0.00 | 3 / 3 |
| PUB-24 | 12705.58 | 12787.58 | -82.00 | 2 / 3 |
| PUB-25 | 12919.23 | 12919.23 | +0.00 | 3 / 3 |

Method used for the oracle, matching R-33: both habits start from
`comparison.opening_balance_bdt`; a recharge is applied at the start of the day, before
that day's consumption; the low-balance habit recharges when the balance at the start of a
day is below `comparison.low_threshold_bdt`; the monthly habit recharges on the 1st; the
demand charge and meter rent are deducted from the balance on the first recharge of each
calendar month; the slab counter runs on the calendar month's cumulative units and resets
on the 1st.
