# Prepaid Meter Recharge Advisor

| Field | Value |
|---|---|
| Team | Miasma |
| Team ID | LSH26-T036 |
| Problem ID | P10 (Tier 02) |
| Live URL | https://lsh26-t036-p10.pages.dev |
| Repository | https://github.com/Shinzuu/lsh26-t036-p10 |
| Event start code | LSH26-8490-C900 |

## What it does

A family on a prepaid electricity meter recharges whenever it starts beeping, often a
large amount late in the month, and the money disappears faster than they expect — because
the slab price rises with the month's cumulative units and resets on the 1st, and nobody
can see that happening. This app rebuilds the meter balance day by day from the published
tariff, shows where the money actually went, answers when the balance runs out and what to
recharge to reach a chosen date, and compares two recharge habits on identical consumption.

## How to run it

Live, with no setup: **https://lsh26-t036-p10.pages.dev** — it opens with six months of
readings already loaded and the balance line drawn. Nothing to install, no login, no
configuration.

Locally:

```bash
npm install
npm run dev
```

No environment variables are required. There is no backend; the app is a pure calculation
over a JSON case.

## Sample data

Seeded on start with case PUB-01 from the organizers' participant release v2.1 fixture
`P10_prepaid_meter_public.json`, copied unmodified — 181 consecutive daily readings from
2026-01-01 to 2026-06-30 with the household's recharge history. Any case in the same shape
can be pasted into the load box or uploaded; a file containing several cases is accepted
and the first is used. Reloading the page restores the seed, because nothing is persisted.

## The four required items

All four work on the live URL. Each line names what to click and the number you should see.

1. ✅ **A household with at least six months of daily unit readings and its recharge
   history**, including a light month, a heavy summer month, and a month where a large
   recharge falls in the last week. *Proof: the page opens on case PUB-01 — 181 daily
   readings from 1 Jan to 30 Jun 2026 and 18 recharges. The months line labels 2026-01 the
   lightest (129 units), 2026-05 the heaviest (673 units), and 2026-05 the month with a
   large late recharge (৳4,300.00 on 26 May, inside its last seven days). All three are
   computed from whichever case is loaded — paste PUB-02 and they move.*
2. ✅ **The balance rebuilt day by day** on the stated tariff, shown as a line with every
   recharge marked. *Proof: the balance line covers the whole six months with a marker at
   each of the 18 recharges. Click any day for its units, the slab rate charged, the
   month's running total and the closing balance; click the 1st of a month and the running
   total has reset to that day's units with the rate back at ৳4.63. Over PUB-01: energy
   ৳13,844.79, VAT ৳692.24, fixed charges ৳492.00 — six months at ৳82.00 — and a closing
   balance of ৳2,080.97 on 30 June.*
3. ✅ **The family's two questions.** *Proof: at 19 units a day the balance runs out on
   20 July 2026, with the assumption printed beside it. Set the target date to 13 Aug 2026
   and those days cost ৳5,600.70 — energy ৳3,870.68, the part caused by being in a higher
   slab ৳1,307.13, fixed charges ৳164.00, VAT ৳258.89 — leaving ৳3,519.73 to recharge today
   after the ৳2,080.97 already on the meter. The four parts add up on screen.*
4. ✅ **The two recharge habits compared** over the same three months on identical
   consumption. *Proof: on PUB-01 both habits cost ৳11,815.37 — equal, and equal is the
   correct answer here, because both recharged in all three months. Paste PUB-02 and the
   low-balance habit costs ৳82.00 less, exactly one month's demand charge and meter rent,
   because it recharged in only two of the three months. Energy and VAT are identical on
   both sides in every one of the 25 published cases, as clarification R-16 requires.*

## The tariff implemented

Exactly as written in the problem statement, and no real published tariff:

| Units in the calendar month | Rate |
|---|---|
| 1 to 75 | 4.63 taka |
| 76 to 200 | 5.26 taka |
| 201 to 300 | 5.63 taka |
| 301 to 400 | 5.83 taka |
| 401 to 600 | 9.30 taka |
| 601 and above | 10.70 taka |

Plus a demand charge of 42 taka and a meter rent of 40 taka, both taken once a month on
that month's first recharge, and 5 percent VAT on the energy amount. **The slab counter
resets on the first day of each calendar month, and a recharge does not reset it.**

Published clarifications that govern the comparison (R-16, R-33): cost means the money the
meter consumes — energy, VAT and the applicable monthly fixed charges — not the amount
deposited; recharge timing cannot create an energy rate saving; the two habits may
legitimately cost the same; and any difference can come only from how many monthly
first-recharge fixed charges occurred.

## Major decisions

- **The organizers' fixture shape is the data model**, rather than a schema of our own with
  a mapping layer, so an unpublished case in the same shape loads unchanged.
- **All money is computed in integer paisa** and formatted as taka only at the render edge.
  The balance compounds over 181 days of daily charges, and floating-point drift there
  would put the run-out date and the habit comparison quietly wrong.
- **The slab counter is keyed to the calendar month and never reset by a recharge** — the
  one behaviour the problem warns produces the wrong number everywhere if inverted.
- **The higher-slab baseline is stated on screen.** The problem asks for "the part caused by
  being in a higher slab" without defining a baseline, so ours is every projected unit
  priced at the lowest slab, with the higher-slab part being the real cost minus that base.
  The four parts then reconcile exactly to the total.

## How we approached it, and who did what

The tariff is the whole problem, so it was built as a pure module with a `node --test`
suite written before any interface, in integer paisa end to end, and the screen reads from
it. The organizers' published fixture shape was adopted directly as the data model rather
than designing a schema and mapping onto it, so an unpublished case in the same shape loads
with no translation layer. Each required item was owned by one person on their own branch
and their own files. After the four merged, each of us tested an item somebody else built —
nobody tested their own work — against an independently written reference rather than
against our own code, and every finding was fixed and re-verified on the deployed URL.

| Member | GitHub | Major contribution |
|---|---|---|
| MD. Nishadul Islam Chy Shezan | `Shinzuu` | Build specification and the reference answers for item 4; required item 1 — the seeded household, the case parser and validator, and the computed month labels; the application shell, the store, every merge and every deployment |
| Rimjhim Dey | `RimjhimD` | Required item 2 — the tariff engine (slab pricing on the calendar-month counter, the month reset, once-a-month fixed charges, VAT) with 37 tests written before the interface, and the balance line with a marker at every recharge; tested item 3 |
| Robiul Hassan | `MDRobiulhassan` | Required item 3 — the run-out date with its assumption stated, and the target-date recharge broken into energy, higher slab, fixed charges and VAT with the four parts reconciling; tested item 4 and the whole-app pass |
| Dip Jyoti Ghosh | `Dip-it11` | Required item 4 — the habit comparison over identical consumption per R-16 and R-33, with the cheaper habit named and the fixed-charge explanation in words; tested item 1 |

## Known limitations

*(Filled at the freeze.)*

## AI assistant use

Disclosed here in full. Claude Code was used throughout: to read and reconcile the
organizer documents, to author the specification in `SPEC.md`, and to implement units
against it. The tariff rules are covered by a test suite, and the habit comparison is
checked against an independently computed reference table of the expected answer for all
25 published cases, recorded at the end of `SPEC.md`. Every required item was verified by a
human on the live URL before being marked complete.

## Licences

See `LICENSES.md`.
