# U2 findings — testing required item 3 (the family's two questions)

**Tester:** Rimjhim (built U2, tested U3's item 3 — nobody tests their own unit)
**Target:** https://lsh26-t036-p10.pages.dev — live, not localhost
**Date:** 30 August 2026, 19:33–19:47
**Method:** every expected value computed independently in
`testing/oracle.mjs`, written from the problem statement's tariff text alone.
Nothing was derived from `src/lib/tariff.js`.

## Verdict

**Item 3 passes.** Every number the panel prints is arithmetically correct on
every case checked, and the four parts reconcile on all 25. One MAJOR
robustness defect, in **my own module, not U3's** — see F1.

- 25 of 26 checks pass
- 1 MAJOR, 5 MINOR, 0 BLOCKER
- The parts reconcile on all 25 cases
- **The projection starts on the day AFTER `today`** — the first unconsumed day.
  This is the correct reading and it matches the published reference exactly.

## The oracle agrees with the reference, so the oracle can be trusted

Reproduced independently before trusting anything, on PUB-01:

| Value | Reference | My oracle | Live app |
|---|---|---|---|
| Balance 30 Jun 2026 | ৳2,080.97 | ৳2,080.97 | ৳2,080.97 |
| Runs out (19 u/day from 1 Jul) | 20 Jul 2026 | 20 Jul 2026 | 20 July 2026 |
| Days to 13 Aug | 44 | 44 | 44 |
| Energy | ৳3,870.68 | ৳3,870.68 | ৳3,870.68 |
| Higher slab | ৳1,307.13 | ৳1,307.13 | ৳1,307.13 |
| Fixed | ৳164.00 | ৳164.00 | ৳164.00 |
| VAT | ৳258.89 | ৳258.89 | ৳258.89 |
| Cost | ৳5,600.70 | ৳5,600.70 | ৳5,600.70 |
| Deposit | ৳3,519.73 | ৳3,519.73 | ৳3,519.73 |

Three-way agreement on all nine.

## Findings

- [MAJOR] Set the target date to `9999-12-31` (reachable by typing or scrolling
  the year in the native date picker) -> **the page hangs; the main thread is
  blocked for over 120 seconds and the tab never recovers** — a subsequent
  `page.goto` on the same tab timed out at 60s -> expected a computed answer, a
  clamp, or a "pick a date within N years" message. **Root cause is mine, in
  U2's `src/lib/tariff.js`, not in U3's `Questions.jsx`:** `projectRunOut` caps
  its loop at `MAX_PROJECTION_DAYS = 3650`, but `requiredRecharge` iterates
  `for (let i = 0; i <= span; i += 1)` with no cap at all. From 1 Jul 2026 to
  9999-12-31 is **2,912,261 days**; a bare date-arithmetic loop of that size
  costs 6.1s before the slab walk is counted, and it runs synchronously inside
  the React render. `2036-08-13` (3,697 days) is fine and answers in well under
  a second, so the failure needs a date centuries out. Fix belongs in
  `requiredRecharge` — cap the span the way `projectRunOut` already does and
  return a message above the cap.
- [MINOR] Target = the first projected day, and a case whose balance already
  covers the window -> "to cover **1 days** at 19 units a day"; also "**1 days**
  from 1 July 2026" on question one -> expected "1 day". Pluralisation only, but
  it is on the headline sentence a judge reads first.
- [MINOR] Edited the target date by hand, then loaded a different household ->
  the manually chosen date persists, so the panel answered "through 13 August
  **2036**" for a case whose own `target_date` is 2026-07-31 -> expected the
  input to fall back to the newly loaded case's `target_date`. Note the
  untouched path is correct: loading a case without having edited the field does
  reset it (2026-08-13 -> 2026-07-31, verified). Defensible either way, but the
  stale date is not obviously the previous household's.
- [MINOR] Cleared the date field entirely -> the input renders empty while the
  answer below still reads "৳3,519.73 … through 13 August 2026" -> expected
  either the field to show the date being used, or the answer to blank out. No
  crash; the fallback itself is sensible.
- [MINOR] Target date in the past -> the panel correctly says "Pick a date on or
  after 1 July 2026", but the long explanatory paragraph defining the
  higher-slab baseline still renders underneath -> expected the explanation to
  hide with the breakdown it explains.
- [MINOR] At 375px, item 3's panel begins **2,219px** down the page, below the
  household strip and the whole balance chart -> expected both answers to be
  reachable with less scrolling on a phone. This is `App.jsx` ordering, so it is
  the integrator's call, not U3's — and the full-page 22:00 screenshot is
  unaffected. No horizontal overflow at 375px; the page fits.

## What passed

**A — question one (run-out date)**

1. A real date is shown, never a blank or a dash. PASS
2. The assumption is stated on screen in full: "Assumes 19 units a day — the
   household's usual daily use — from a balance of ৳2,080.97 on 30 June 2026,
   with no further recharge." A judge does not have to guess. PASS
3. Recomputed day by day. **The projection starts on 1 Jul, the first unconsumed
   day, not on 30 Jun.** Starting on 30 Jun would give 19 July; the app says 20
   July and so does my oracle. The wording "20 days from 1 July 2026" matches
   the arithmetic it used. PASS
4. The slab counter keeps resetting mid-projection — confirmed on the balance
   panel at 1 Aug and in the oracle. PASS
5. Loaded seven other cases; the run-out date moved correctly on every one. PASS
6. Case with an already-negative balance (crafted, −৳435.49): claims **1 July
   2026**, the first projected day, and prints the negative balance openly.
   Honest, not a date months away. PASS
7. `usual_daily_units = 0` (crafted): "**Not within the projected period**". No
   hang, no nonsense date centuries out. PASS

**B — question two, in range**

8. The target-date input defaults to the case's own `target_date` (08/13/2026 on
   PUB-01; 2026-06-20 on PUB-15; 2026-08-26 on PUB-13). PASS
9. The headline is the deposit **net of the balance already on the meter**, and
   says so: "after the ৳2,080.97 already on the meter". PASS
10. All four parts present and labelled: energy, caused by being in a higher
    slab, fixed charges, VAT. PASS
11. Added them by hand on every case checked. PUB-01: 3,870.68 + 1,307.13 +
    164.00 + 258.89 = 5,600.70. The reconciliation sentence is true. PASS
12. Target +1 day: 31 Jul -> 1 Aug moved the total 4,185.87 -> 4,360.24, and the
    fixed part 82.00 -> 164.00. +1 month rises further. PASS
13. **The fixed-charge step lands exactly on the month boundary.** 30 Jul and 31
    Jul both charge ৳82.00; 1 Aug charges ৳164.00 — exactly ৳82.00 more, at
    exactly that step. PASS
14. Day counts are inclusive and correct: 1 Jul→13 Aug = 44; 1 Jul→31 Jul = 31;
    1 Jul→1 Aug = 32; 1 Jul→1 Jul = 1. Counted by hand. PASS
15. The higher-slab definition is stated on screen ("energy is every projected
    unit charged at the lowest slab rate (৳4.63), and the higher-slab part is
    the real slab-aware cost minus that base") and the numbers obey it: energy
    ৳3,870.68 = 836 units × ৳4.63 exactly. PASS

**C — out of range**

16. One-day window (target = first projected day): total ৳174.37, matches the
    oracle. PASS
17. Target in the past: "Pick a date on or after 1 July 2026." No negative
    amount, no crash. PASS
18. Ten years out (2036-08-13): 3,697 days, ৳493,393.59, matches the oracle to
    the paisa, page stays responsive. PASS
19. Cleared the field: no crash, falls back to the case target. PASS (see MINOR)
20. `2026-02-31` is rejected by the native date input. `9999-12-31` — see F1.
21. Balance already exceeds the whole window cost (PUB-13, PUB-18, and a crafted
    one-day case): deposit is **৳0.00**, never negative. PASS
22. 200 units a day (crafted, top slab throughout): computes correctly. PASS

**D — cross-case sweep**

23. Computed the run-out date and deposit for all 25 cases with my own script,
    then spot-checked **seven live**, chosen to include the lightest (PUB-15,
    1,576 units) and heaviest (PUB-18, 3,887 units) consumption:

| Case | Run-out | Days | Deposit | Live == oracle |
|---|---|---|---|---|
| PUB-01 | 20 Jul 2026 | 44 | ৳3,519.73 | yes |
| PUB-02 | 11 Oct 2026 | 36 | ৳668.74 | yes |
| PUB-11 | 19 Aug 2026 | 39 | ৳1,547.65 | yes |
| PUB-13 | 12 Oct 2026 | 14 | ৳0.00 | yes |
| PUB-15 (lightest) | 18 Jun 2026 | 20 | ৳335.84 | yes |
| PUB-18 (heaviest) | 22 Oct 2026 | 14 | ৳0.00 | yes |
| PUB-25 | 26 Jul 2026 | 18 | ৳1,495.34 | yes |

    Zero mismatches.

24. **The four parts sum exactly to the cost total on all 25 cases** — proven
    arithmetically in the oracle for all 25, and read off the live
    reconciliation sentence on the seven above. No case fails. PASS

**E — reading it as a stranger**

25. Both answers are legible at 375px with no horizontal overflow. The
    scroll distance to reach them is the MINOR above. PARTIAL
26. The date input is labelled ("To last until", a real `<label>`), 256×50px, so
    it is keyboard- and thumb-usable. PASS
27. No flash of zeroes: the app seeds PUB-01 and the panel renders populated on
    cold open. PASS
28. Read aloud, both answers are actionable: a family is told the date the meter
    dies and the exact taka to hand over today, with the assumption spelled out.
    PASS

## Note on console errors

Two console errors appear in my session logs. **They are mine, not the app's** —
a `fetch` I ran from the page to the organizers' fixture API, blocked by CORS as
expected. The app itself logged nothing on cold load or during any case switch.

## Repro

```bash
curl -s "https://live.hackathon.lofistack.com/api/fixtures/P10?teamId=LSH26-T036" -o /tmp/p10.json
node testing/oracle.mjs /tmp/p10.json          # all 25 cases
node testing/oracle.mjs /tmp/p10.json PUB-01   # one case
```
