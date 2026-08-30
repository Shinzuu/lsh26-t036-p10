# Side B handoff — the answers and evidence, overhauled

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Branch:** `sideB-answers`, cut from `main` at `a0733c3` (the split commit)
**For:** shinzuu (Side A / integrator). Not merged, not deployed — production stays on `main`.

Per `testing/SPLIT-P10.md` this is Side B: `Hero`, `BalanceChart`, `Questions`, `HabitCompare`,
`MonthBill`, `MeterCheck`, plus a new shared date/number helper. **No Side A file is touched** —
verified: the working tree changes only the seven files below.

```
 M src/features/BalanceChart.jsx
 M src/features/HabitCompare.jsx
 M src/features/Hero.jsx
 M src/features/MeterCheck.jsx
 M src/features/MonthBill.jsx
 M src/features/Questions.jsx
?? src/lib/format.js          (new, Side B-owned)
```

---

## The one that is live-wrong on `main` right now

**`HabitCompare` printed every comparison amount 100× too small.** The rule lines read
*"Adds ৳50.00 … below ৳2.00"* where the case is ৳5,000 below ৳200. Cause: the `u7` display
refactor gave the file a `money(paisa)` from `useDisplay`, but a local helper of the same name
still called `toPaisa` on the already-decimal fixture strings and shadowed it — so the fixture's
`"5000.00"` went through `toPaisa` **and** got divided by 100 again. Fixed by removing the shadow
and routing fixture strings through one explicit `fromBdt()` that converts once. The four figures
inside each habit card (energy/VAT/fixed/total) were always right — they came from the engine in
paisa; only the rule and threshold text was wrong.

---

## What changed, and why it is decluttering rather than decoration

**Redundancy removed (measured on the rendered page):**

| | before | after |
|---|---|---|
| Habits step, visible words | 332 | **282** |
| Balance step, visible words | 235 | **181** |
| Repeated sentences across the app | 3 | **0** |
| R-16 sentence on the habits step | printed twice (visible + in the explainer) | **once** |

The R-16 rule ("timing cannot buy a cheaper rate") was stated in full both as visible prose and
inside the collapsed explainer. Now the **household-specific** version is visible (how many months
each habit charged, for *this* case) and the **general rule** is the one collapsed note. Same for
the balance step's tariff preamble, which repeated what the footer and day-detail already show.

**One vocabulary.** `longDate`, `monthLabel`, `plural`, `nextDay`, `daysBetween` had drifted into
five separate copies across these files ("1 Apr" vs "1 April 2026"). They now come from
`src/lib/format.js` — one voice, and money still goes only through `useDisplay().money` so a
currency or numeral switch can never miss a figure.

**More interactive, each tied to a number changing (not motion for its own sake):**

- **Overview** — the three headline figures are now anchor cards into their step (`#balance`,
  `#questions`), using the hash the Side A shell already listens on: plain `<a href>`, so keyboard
  and Back work for free. Arrow slides on hover, card lifts, "Runs out" turns urgent ≤7 days.
- **When to recharge** — preset chips (Case target · End of month · +30/+60/+90), each recomputing
  the breakdown live; the "adds up" check is now a pill on the total row so it cannot drift from
  the figures it certifies.
- **Which habit is cheaper** — two proportional bars show the gap (or the tie) before it is read;
  tooltips on VAT and fixed charges.
- **One month's bill** — month dropdown → a row of chips; shares the balance step's slab ladder.
- **Balance** — prev/next-day buttons so a touch user can step through days without hovering.
- Reveal-on-scroll and hover-lift across all six, both off under `prefers-reduced-motion`.

---

## Verified

| Check | Result |
|---|---|
| Required item 4 vs independent reference, 25 cases | **identical** — 22 equal, PUB-02/06/24 at −82.00 |
| Fuzz, 250 random same-shape cases | clean — no crash, no NaN, R-16 invariants hold |
| Malformed input, 13 cases × 3 panels | no throw, no NaN, no "Invalid Date" |
| Contrast, all 7 steps, light + dark | **every rendered pair clears AA 4.5:1** |
| `tariff.test.mjs` / `dataset.test.mjs` | 37 / 27 pass |
| `npm run build` · `scripts/preflight.sh` | clean |
| Side boundary | only the 7 files above; no Side A file touched |

Measured by rendering the real components (server-side, through `DisplayProvider` + `StoreProvider`)
and reading the numbers back off the output — against what a judge sees, not the engine's own view.

**Not verified — needs a human with a browser.** No browser this session, so the interactions
themselves (chip taps recomputing, the hover-lifts, reveal-on-scroll, the prev/next buttons, the
overview cards jumping to their step) have been checked as *rendered markup*, not *driven*. Worth a
few minutes on the phone link, which nobody on the team has done yet.

---

## Two clutter items that are NOT mine to fix — they are Side A

Both are on `src/App.jsx` / `src/features/Sidebar.jsx`, which you own:

1. **The steps sidebar still shows all seven blurbs at once** — the wall of secondary text Robiul
   flagged. It is already fixed on the `ui-declutter` branch (blurb on the active step only, plus a
   "Step N of 7" progress bar), which has not been merged. If you merge that, this resolves.
2. **The overview's "What this tool does next" list duplicates the sidebar** — same seven items,
   twice on one screen. Worth collapsing one of them.

`ui-declutter` also still carries the **dark-mode primary-button fix** (`bg-accent text-white` is
2.41:1 in dark mode, every primary button) which is unmerged and still live-wrong on `main`.

## To take Side B

```bash
git fetch origin
git merge --no-ff origin/sideB-answers      # 7 files, no Side A overlap
npm run build && bash scripts/preflight.sh
node --test src/lib/*.test.mjs
# then the consistency pass in SPLIT-P10.md, deploy from main
```

**Companion documents:** [`SPLIT-P10.md`](SPLIT-P10.md) · [`UI-DECLUTTER-HANDOFF.md`](UI-DECLUTTER-HANDOFF.md) ·
[`README.md`](README.md) · [`U3-findings.md`](U3-findings.md)
