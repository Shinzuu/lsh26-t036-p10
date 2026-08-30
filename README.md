# Recharge Advisor

Solution for **LofiStack Hackathon 2026 — P10**

## Project information

- **Team:** `Miasma`
- **Team ID:** `LSH26-T036`
- **Problem:** `P10 — Prepaid Meter Recharge Advisor` (Tier 02)
- **Live application:** <https://lsh26-t036-p10.pages.dev>
- **Repository:** <https://github.com/Shinzuu/lsh26-t036-p10>
- **Event start code:** `LSH26-8490-C900`

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

A family on a prepaid electricity meter recharges whenever it starts beeping, often a large
amount late in the month, and the money disappears faster than they expect — because the
slab price climbs with the month's cumulative units and resets on the 1st, and nobody can
see that happening. This application rebuilds the meter balance day by day on the published
tariff, shows where the money actually went, answers when the balance runs out and what to
recharge to reach a chosen date, and compares two recharge habits on identical consumption.

## Requirements

| Requirement | Status | Where to verify |
|---|---|---|
| R1 — A household with six months of daily readings and its recharge history, including a light month, a heavy month and a month with a large recharge in its last week | Complete | Opens on it. **Household** section: 181 readings, 1 Jan–30 Jun 2026, 18 recharges. The months line labels 2026-01 lightest (129 units), 2026-05 heaviest (673) and 2026-05 large late recharge (৳4,300 on 26 May) |
| R2 — The balance rebuilt day by day on the tariff, fixed charges on each month's first recharge, VAT, drawn as a line with every recharge marked | Complete | **Balance** section. 18 markers, month boundaries dashed. Click any day for its units, slab rate, month running total and closing balance. Totals: energy ৳13,844.79, VAT ৳692.24, fixed ৳492.00 (6 × ৳82), closing ৳2,080.97 |
| R3 — The run-out date, and the amount to recharge today split into energy, the higher-slab part, fixed charges and VAT | Complete | **Questions** section, and the headline figures at the top. Runs out 20 July 2026 at 19 units a day. To last to 13 Aug 2026: ৳5,600.70 of charges = ৳3,870.68 + ৳1,307.13 + ৳164.00 + ৳258.89, leaving ৳3,519.73 to recharge today |
| R4 — Two recharge habits compared over the same three months on identical consumption, with the cheaper named and by how much | Complete | **Habits** section. PUB-01: both ৳11,815.37, equal, 3 of 3 fixed-charge months. Load PUB-02 from the selector: recharging when low is ৳82.00 cheaper, having recharged in two of three months |

## How to test the application

1. Open <https://lsh26-t036-p10.pages.dev>. It loads household PUB-01 with no setup, no
   login and nothing to click first.
2. Read the three figures at the top: what is on the meter, when it runs out, and what to
   recharge today.
3. In **Balance**, click a day late in May, then click 1 June. The month running total resets
   to that day's units and the slab rate drops back to ৳4.63 — the rule the problem warns
   about, visible on the slab ladder under the day detail.
4. In **Questions**, change the target date. The required amount moves and the four parts
   still add to the total shown.
5. In **Habits**, read the verdict. On PUB-01 the two habits cost exactly the same, which is
   the correct answer here; load PUB-02, PUB-06 or PUB-24 from the selector to see a ৳82.00
   difference and the sentence explaining where it comes from.

### Test or sample data

The selector in the top bar carries all 25 published households from
`P10_prepaid_meter_public.json`. The application ships case PUB-01 as its seed, so the live
URL is never empty; reloading restores it, because nothing is persisted.

For data outside the published pack, open **Paste or upload your own data** in the Household
section and paste a case object or upload a JSON file in the same shape. A file containing a
`cases` list is accepted and every case in it becomes selectable. Malformed input is rejected
with a message naming the field at fault, and the previous household stays on screen.

## Run locally

### Requirements

- Node.js 20 or newer (built and tested on 22.23)
- No database, no environment variables and no API keys — the application is a pure
  calculation over a JSON case

### Setup

```bash
git clone https://github.com/Shinzuu/lsh26-t036-p10.git
cd lsh26-t036-p10
npm install
npm run dev                      # development server
npm run build                    # production build
node --test src/lib/*.test.mjs   # 57 tests
```

## Problem-solving approach

**How we understood the problem.** The tariff is the entire problem. All four required items
are consequences of one rule — the slab counter runs on the calendar month and a recharge
never resets it — and the problem statement says outright that getting it backwards produces
the wrong number everywhere.

**The chosen solution.** One screen, no backend, no persistence. The engine is a pure module
with its `node --test` suite written before any interface; the interface only reads from it.
The organizers' published fixture shape is used directly as the data model rather than
designing a schema and mapping onto it, so an unpublished case in the same shape loads with
no translation layer.

**The most important technical decision.** All money is computed in integer paisa and
converted to taka only at the render edge. The balance compounds across 181 days of daily
charges; floating-point drift there would put the run-out date and the habit comparison
quietly wrong in a way no single-day test would catch.

**How it was tested.** Each required item was built by one person on their own branch and
their own files. After merging, each of us tested an item somebody else had built — nobody
tested their own work — against an independently written reference rather than against our
own code. Item 4 was additionally checked over all 25 published cases against a reference
computed from the clarifications: energy and VAT are identical between the two habits in
every case, 22 come out equal, and exactly three differ by exactly ৳82.00. Every finding was
fixed and re-verified on the deployed URL rather than locally.

## Technology used

- **Frontend:** React 19, Tailwind CSS 4, Vite 8
- **Backend:** none — a pure client-side calculation
- **Database:** none, and nothing is persisted between reloads
- **Deployment:** Cloudflare Pages
- **Other material tools:** `@number-flow/react` for animated figures, `lucide-react` for
  icons

See [`LICENSES.md`](LICENSES.md) for third-party materials.

## Team contributions

| Registered member | GitHub username | Major contribution | Evidence |
|---|---|---|---|
| MD. Nishadul Islam Chy Shezan | `Shinzuu` | Build specification and the reference answers for item 4; required item 1 — the seeded household, the case parser and validator, the computed month labels; the application shell, the store, every merge and every deployment | `src/lib/dataset.js`, `src/features/DataSource.jsx`, `src/App.jsx`, `SPEC.md` |
| Rimjhim Dey | `RimjhimD` | Required item 2 — the tariff engine (slab pricing on the calendar-month counter, the month reset, once-a-month fixed charges, VAT) with 37 tests written before the interface, and the balance line with a marker at every recharge; tested item 3 | `src/lib/tariff.js`, `src/lib/tariff.test.mjs`, `src/features/BalanceChart.jsx` |
| Robiul Hassan | `MDRobiulhassan` | Required item 3 — the run-out date with its assumption stated, and the target-date recharge split into energy, higher slab, fixed charges and VAT with the four parts reconciling; tested item 4 and the whole-app pass | `src/features/Questions.jsx` |
| Dip Jyoti Ghosh | `Dip-it11` | Required item 4 — the habit comparison over identical consumption per R-16 and R-33, the cheaper habit named and the fixed-charge explanation in words; tested item 1 | `src/features/HabitCompare.jsx` |

Commit count alone does not represent contribution.

## AI usage

**Claude Code (Anthropic)** assisted with reading and reconciling the organizer documents,
drafting the build specification, and implementing units against it.

How the output was verified: the tariff rules are covered by 57 `node --test` cases
exercising every slab boundary, the calendar-month reset and the once-per-month fixed
charges. Item 4 was checked against an independently computed reference over all 25
published cases. Each required item was tested by a team member who had not built it, using
their own reference implementation written from the problem text rather than from our code,
and every item was confirmed on the deployed URL rather than locally.

## Major design decisions

- **Decision: the published fixture shape is the data model.** No schema of our own and no
  mapping layer, so an unpublished case in the same shape loads unchanged.
- **Decision: integer paisa end to end,** formatted as taka only at the render edge, because
  the balance compounds over 181 days and float drift would stay invisible until it was
  wrong.
- **Decision: the slab counter is keyed to the calendar month and never reset by a
  recharge** — the single behaviour the problem statement warns produces the wrong number
  everywhere.
- **Decision: the demand charge and meter rent are taken once per calendar month, on that
  month's first recharge,** so a month with no recharge incurs neither. This is the only
  mechanism by which the two habits can differ in cost, exactly as clarification R-16
  requires.
- **Decision: the higher-slab baseline is stated on screen.** The problem names the four
  parts without defining the split, so energy is every projected unit at the lowest slab rate
  and the higher-slab part is the real slab-aware cost minus that base — together they are
  the true energy charge, and the four parts reconcile.
- **Decision: colour placed by measured contrast.** Body text 12.0:1, headings 10.4:1, the
  single interactive colour 6.9:1; the two lightest brand colours are used only as surfaces
  carrying dark text, because at 1.9:1 and 2.4:1 they are unreadable as text.

## Known limitations

- **No persistence.** The application holds no state between reloads; a household loaded by
  paste or upload is gone on refresh, and reloading restores the seeded case.
- **The run-out date assumes flat consumption** — the household's stated usual daily use
  every day, with no seasonality and no further recharge.
- **The required-recharge window is capped at 18,262 days,** about fifty years. A native date
  picker reaches the year 9999; past the cap the application answers for the capped window
  and says so on screen.
- **A `comparison.source` other than `"readings"` is our reading, not the organizers'.** The
  published `format_note` is truncated mid-sentence at exactly the point where it would have
  defined the alternative, so we treat it as a flat `comparison.daily_units` for every day of
  the three months. All 25 published cases use `"readings"`.
- **VAT is rounded once over the period,** not per day and summed, so a figure recomputed
  with per-day rounding differs by a few paisa over six months. The daily rows still sum
  exactly to the totals shown.
- **A recharge dated outside the reading period is not counted** in the rebuild. Every
  published case keeps its recharges inside the readings.

## Repository records

- [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
- [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
- [`LICENSES.md`](LICENSES.md) — frameworks, libraries, templates and assets
- [`SPEC.md`](SPEC.md) — the build specification, including the reference answers for item 4
- [`NOTES.md`](NOTES.md) — cross-unit findings recorded during the build
