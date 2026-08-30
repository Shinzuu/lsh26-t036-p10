# U1 findings — testing required item 2 (the tariff engine and the balance line)

Tester: shinzuu (built U1). Area tested: item 2, built by U2 (Rimjhim).
Method: an independent reference implementation written from the problem statement's
tariff text alone (`/tmp/ref.mjs`), then compared against `src/lib/tariff.js` across all
25 published fixture cases; plus internal-consistency checks, degenerate inputs, and a
server-side render to count what the chart actually draws.

**Verdict: item 2 passes. No BLOCKER, no MAJOR.** Two MINORs and one note, below.

## What was checked and agreed

- **Slab arithmetic, all boundaries.** 1 unit from 0 = 463 paisa. 2 units from 74 = 989
  (463 + 526), so a single day straddling a boundary splits across rates rather than
  picking one. Same at 200/201 (1089), 300/301 (1146), 400/401 (1513), 600/601 (2000).
  100 units from zero = 75 x 463 + 25 x 526. Reference and app agree on every case tried,
  including 5000 units in one day crossing all six bands (BDT 51,090.75, and `slabParts`
  reports all six segments).
- **The month reset.** For all 25 cases, `monthUnitsBefore` restarts at 0 on the first row
  of every calendar month and accumulates within it; a recharge never resets it. Readings
  that start mid-month still start the counter at zero.
- **Fixed charges.** Across all 25 cases: every month containing a recharge takes exactly
  BDT 82.00, taken on that month's *first* recharge date, and every month with no recharge
  takes nothing. Two recharges on the same date sum, and still take the fixed charge once.
  PUB-01 = 6 months x 82.00 = BDT 492.00.
- **VAT** is 5% of the energy amount and is never applied to the demand charge or meter
  rent.
- **Internal consistency.** For all 25 cases the rows sum exactly to the totals for energy,
  VAT, fixed charges and recharges, and the balance chain reconciles day by day from the
  opening balance with no drift.
- **Energy, fixed charges and recharge totals match the reference exactly on all 25 cases.**
- **The chart.** The rendered SVG carries 18 recharge markers for PUB-01's 18 recharges,
  plus a halo on the 6 that were their month's first — the ones that paid the 82.00. Month
  boundaries are drawn. The day detail states units, slab rate, month running total and
  closing balance, and is keyboard-reachable with the arrow keys.
- **PUB-01 numbers on screen**: energy BDT 13,844.79, VAT BDT 692.24, fixed BDT 492.00,
  recharged BDT 16,800.00, closing balance BDT 2,080.97 on 30 June.
- **Degenerate input**: no recharges at all, a single day, every day zero units, 581 days,
  and a 5000-unit day all rebuild without throwing. 581 days computes in under a
  millisecond.
- `node --test src/lib/tariff.test.mjs` — 37 pass, 0 fail. Spot-read three assertions
  (the 75/76 boundary pair, the January-only fixed charge, the first-recharge date): the
  expected values are correct, not merely green.

## MINOR 1 — VAT is rounded over the period, not per day

`vatOn` rounds once over whatever energy total it is handed, and `runDays` redistributes
that figure across the rows so they still sum. A reference that rounds each day's VAT and
adds them gets up to BDT 0.26 more over 181 days (PUB-01: 692.37 against the app's 692.24;
largest gap across the 25 cases, PUB-09, is 0.26).

Both readings satisfy "5 percent VAT on the energy amount" — the problem does not say at
what granularity. The engine's choice is deliberate and documented in the source, and item
4's oracle is matched to the paisa because of it. **No change recommended.** A judge
recomputing per day will land a few paisa apart; the difference is far below the taka.

## MINOR 2 — a recharge dated outside the reading days is silently dropped

Adding a recharge on 2025-12-25 and another on 2026-07-15 to PUB-01 — both outside the
1 Jan to 30 Jun reading span — leaves the closing balance completely unchanged at BDT
2,080.97. The money vanishes with no message.

None of the 25 published cases contains a recharge off a reading day, so this cannot bite
on published data. It could on an unpublished case, and the failure is silent, which is the
bad kind. Cheapest honest fix if there is time: count such recharges and say so ("2
recharges fall outside the reading period and are not included"). Not worth a code change
during the freeze window if the clock is short.

## Note — the manifest described this backwards

`evaluation-manifest.json`'s known-limitations entry said VAT is "rounded to the paisa on
each day's energy charge rather than once on the period total". That is the opposite of
what the engine does. Corrected on `main`.
