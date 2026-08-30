# P10 · TEST 4 — required item 4 (habit comparison) + whole-app pass

**Tester:** Robiul (built U3, so testing U4's item 4 — nobody tests their own unit)
**Branch:** `test-u3` · **Tested:** commit `856656c`, verified byte-identical to the bundle
served at https://lsh26-t036-p10.pages.dev (only difference is CRLF/LF from a Windows
checkout, inside class-name strings — no behavioural difference).
**Method:** an independent reference implementation of both habits written from the problem
text and R-16/R-33 **before** reading `src/lib/tariff.js`, then the deployed components
rendered over all 25 published cases and 8 synthetic edge cases and compared against it.

---

## Verdict

**Item 4 is correct and I could not break its answer.** Every verdict, winner, difference,
month count and recharge date the app puts on screen matches my independent reference on all
25 published cases. The R-16 trap is not merely avoided but explicitly defended against.

**2 findings worth fixing before freeze — one MAJOR, and it is a one-line fix.** No BLOCKER.

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 1 |
| MINOR | 5 |

---

## A. The rule that decides this item — PASS on all 25

Checked, per case: energy identical between habits · VAT identical between habits ·
difference an exact multiple of ৳82.00 · difference equals ৳82.00 × the month-count delta.

- **Energy is identical between the two habits in all 25 cases.** No fabricated slab saving.
- **Every difference is 0.00 or exactly −82.00.** Nothing else appeared.
- **22 equal · 3 differ — PUB-02, PUB-06, PUB-24**, each by exactly ৳82.00, each because the
  low-balance habit triggered a first recharge in 2 of 3 months. This reproduces the expected
  shape exactly.
- Recharge dates and counts match my reference in every case, including PUB-24's
  `1 Jun · 30 Jun · 9 Aug` — three recharges but only two months charged, which the screen
  reports correctly as "Fixed charges (2 of 3 months)".

| Case | app low | app monthly | diff | months low/monthly | verdict |
|---|---|---|---|---|---|
| PUB-01 | 11,815.37 | 11,815.37 | 0.00 | 3/3 | equal |
| PUB-02 | 9,341.05 | 9,423.05 | −82.00 | 2/3 | low cheaper |
| PUB-03 | 14,264.29 | 14,264.29 | 0.00 | 3/3 | equal |
| PUB-04 | 10,726.48 | 10,726.48 | 0.00 | 3/3 | equal |
| PUB-05 | 9,424.32 | 9,424.32 | 0.00 | 3/3 | equal |
| PUB-06 | 8,106.73 | 8,188.73 | −82.00 | 2/3 | low cheaper |
| PUB-07 | 8,474.78 | 8,474.78 | 0.00 | 3/3 | equal |
| PUB-08 | 8,626.90 | 8,626.90 | 0.00 | 3/3 | equal |
| PUB-09 | 11,893.81 | 11,893.81 | 0.00 | 3/3 | equal |
| PUB-10 | 12,010.36 | 12,010.36 | 0.00 | 3/3 | equal |
| PUB-11 | 15,693.97 | 15,693.97 | 0.00 | 3/3 | equal |
| PUB-12 | 9,012.92 | 9,012.92 | 0.00 | 3/3 | equal |
| PUB-13 | 14,013.34 | 14,013.34 | 0.00 | 3/3 | equal |
| PUB-14 | 16,564.94 | 16,564.94 | 0.00 | 3/3 | equal |
| PUB-15 | 7,781.97 | 7,781.97 | 0.00 | 3/3 | equal |
| PUB-16 | 14,467.15 | 14,467.15 | 0.00 | 3/3 | equal |
| PUB-17 | 8,331.41 | 8,331.41 | 0.00 | 3/3 | equal |
| PUB-18 | 10,633.91 | 10,633.91 | 0.00 | 3/3 | equal |
| PUB-19 | 9,423.05 | 9,423.05 | 0.00 | 3/3 | equal |
| PUB-20 | 9,784.36 | 9,784.36 | 0.00 | 3/3 | equal |
| PUB-21 | 10,980.10 | 10,980.10 | 0.00 | 3/3 | equal |
| PUB-22 | 13,134.59 | 13,134.59 | 0.00 | 3/3 | equal |
| PUB-23 | 8,939.69 | 8,939.69 | 0.00 | 3/3 | equal |
| PUB-24 | 12,705.57 | 12,787.57 | −82.00 | 2/3 | low cheaper |
| PUB-25 | 12,919.24 | 12,919.24 | 0.00 | 3/3 | equal |

## B. What the screen says — PASS

Read on PUB-01 (equal), PUB-02 and PUB-24 (differ):

- Both habits side by side with energy, VAT, fixed charges and total — **yes**.
- Recharge dates listed and counts correct — **yes**.
- Winner named, difference in taka — **yes**.
- Equal reads as a real answer — **yes**: "Both habits cost exactly the same — ৳11,815.37
  over the 3 months", with no invented winner and no error styling.
- The sentence naming each side's first-recharge count — **yes**, and the numbers match my
  reference ("2 of the 3 months and recharging monthly in 3 … 2 times and 3 times").
- **No slab-saving claim anywhere.** Both occurrences of "slab" in the panel are denials:
  "the same calendar-month slab counter, so *when* the meter is recharged cannot change the
  rate a unit is charged at."
- Cost is consumption, not deposits — **yes**, and stated in words. PUB-01 deposits
  ৳15,000.00 against a stated cost of ৳11,815.37, so the two cannot be confused.

---

## Findings

### [MAJOR] The "equal" explanation sentence hard-codes the month count, and can contradict its own cards
`src/features/HabitCompare.jsx`, the `equal ?` branch of the closing paragraph.

**What I did:** loaded a case where the opening balance is large enough that neither habit
ever recharges (`comparison.opening_balance_bdt` high, `monthly_amount_bdt` 0.00).
**What I saw:** the two habit cards correctly read **"Fixed charges (0 of 3 months) ৳0.00"**
and **"No recharge was triggered in these months."** — but the paragraph directly below them
says: *"Both habits triggered a first recharge in all 3 of the 3 months, so both paid the
৳82.00 demand charge and meter rent 3 times."*
**What I expected:** both habits charged 0 of 3 months and paid ৳0.00 — which is what the
cards already say. The sentence contradicts the numbers on the same screen.

**Why it matters:** test item B-9 is "a sentence names how many monthly first-recharge fixed
charges each side incurred" — a judge who checks that sentence against the cards on an
unpublished case with a high opening balance finds the app stating a falsehood about the one
mechanism this item is about. All 25 published cases happen to charge 3 of 3 months, so it
never fires on the public pack — but judges test unpublished cases in the same shape.

**Fix:** the equal branch already has `lowMonths` and `monthlyMonths` in scope; use them
instead of `monthCount`, exactly as the non-equal branch does. One line.

### [MINOR] A comparison month with no readings is silently dropped
Named months `["2026-04","2026-05","2026-12"]` where December has no readings: the app
reports "Both habits cost exactly the same — ৳7,688.09 **over the 3 months**" and
"Fixed charges (2 of 3 months)", computed from the two months that do have data. The
arithmetic is right and matches my reference, and it does not crash — but nothing on screen
says a named month was skipped. One caveat line would close it.

### [MINOR] The header claims "the household's own daily readings" even when `source` is not `readings`
With `comparison.source = "flat"` and `daily_units: 20`, the engine **correctly** switches to
the flat figure (its totals match my reference to the paisa), but the header still reads "on
the household's own daily readings", which is then untrue. `NOTES.md` already records that
the organizers' `format_note` is truncated here, so the behaviour is the right guess — only
the wording needs a conditional.

### [MINOR] Pluralisation: "over the 1 months" / "(1 of 1 months)"
With a single comparison month the panel reads "Both habits cost exactly the same — ৳5,113.44
over the 1 months" and "Fixed charges (1 of 1 months)". The `times()` helper already does
this properly for "once"; the month count needs the same treatment.

### [MINOR] VAT rounding differs from a per-day reference by up to ৳0.13 — deliberate, documented, and it changes no verdict
Every VAT figure and total on screen sits 2–13 paisa below my reference, in all 25 cases,
because `vatOn()` rounds **once over the period** while my reference rounds **per day and
sums**. This is a documented decision in `tariff.js` ("rounding each day up and adding gives a
period total half a paisa per day too high"), it is internally consistent, and the daily rows
still sum to the period figure. **It never changes a winner, a difference, a month count or a
recharge date** — I re-ran the whole comparison both ways.

Recording it only because of the knock-on below, not as a defect. Judges are given no VAT
rounding rule, so either convention is defensible.

### [MINOR] The prep repo's oracle table is 1 paisa off the app — the judged README is not
`event/SPEC-P10.md` and `P10README.md` (prep repo) both state PUB-01 = **11815.36**; the app
and the judged `README.md` both say **11,815.37**. The judged artifact is self-consistent, so
this costs nothing — but the internal oracle everyone is checking against should be corrected
so a later tester does not "find" a bug that is not there.

### [MINOR] `parseCase(null)` message reads oddly
Returns *"Expected a JSON object, got object"* (JS `typeof null === 'object'`). Every other
message is excellent — "Missing field \"case_id\".", "The file has a \"cases\" list, but it is
empty." Worth the same polish only if there is spare time.

---

## D. Whole-app pass

**Passed, by static and server-render analysis:**

- **Cold open** — all four panels render on the seeded first paint. No empty state, no
  "No readings loaded" flash. Seed is PUB-01, 181 days, already drawn.
- **Every control is labelled** — both `case-paste` and `target-date` have a real
  `<label for>`. No empty buttons.
- **Nothing crashes on bad input.** 13 malformed cases (`days: []`, days missing, units as
  strings, negative units, non-numeric opening balance, recharges missing, comparison
  missing, empty months, `today` outside the readings, target before today, zero and negative
  daily units, malformed dates) × 3 panels = 39 renders: **no throw, no NaN, no "Invalid
  Date", no "undefined" on screen.** Bad paste is rejected with a readable message naming the
  missing field.
- **Deterministic** — ten renders byte-identical; no `localStorage`/`sessionStorage`/
  IndexedDB anywhere, so a reload cannot drift.
- **No `alert()` anywhere.** Errors render as in-page messages.
- **No console output during a normal render** — no React warnings, no errors.
- **README is truthful on item 4.** Its three claims — PUB-01 equal at ৳11,815.37, PUB-02
  low-balance ৳82.00 cheaper from recharging in two of three months, and energy+VAT identical
  on both sides in all 25 cases — I verified independently. All three hold.
- **Findability** — the four panels sit in required-item order and each is titled in the
  problem's own language ("Which recharge habit costs less?"), so all four items can be found
  without being told where to look.

**NOT verified — needs a human with a browser.** The Chrome extension was declined this
session, so these are untested rather than passed. They are quick:

1. Phone width at 375 px on a real device, on mobile data — no horizontal scroll, no clipped
   text, tap targets big enough.
2. Tab order and focus visibility through the whole page.
3. Cold-open time to usable in a private window.
4. The live browser console during two minutes of real use (I verified no warnings in a
   server render, which does not exercise effects, hover or the date picker).

---

## Reproducing any of this

The reference implementation and the render harnesses are in my scratch dir, not committed
(nothing outside `testing/` was touched). The reference is ~120 lines and rebuilds both habits
straight from R-16/R-33; the comparison harness renders the real `HabitCompare` inside a real
`StoreProvider` for each case and scrapes the numbers back off the rendered text.
