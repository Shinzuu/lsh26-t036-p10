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

1. **A household with at least six months of daily unit readings and its recharge
   history**, including a light month, a heavy summer month, and a month where a large
   recharge falls in the last week. The three months are computed from the data and
   labelled on screen. — *status pending*
2. **The balance rebuilt day by day** on the stated tariff: each day's units charged at the
   slab the month's running total has reached, the demand charge and meter rent taken on
   the first recharge of each month, VAT added, shown as a line with every recharge marked.
   — *status pending*
3. **The family's two questions** — the date the balance runs out at their usual daily use,
   and the amount to recharge today to last until a chosen date, broken into energy, the
   part caused by being in a higher slab, fixed charges and VAT. — *status pending*
4. **The two recharge habits compared** over the same three months on identical
   consumption, showing which costs less and by how much. — *status pending*

*(Each line gets a tick and a one-sentence proof naming what to click, filled at the freeze.)*

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
