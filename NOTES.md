# NOTES

Gotchas that affect more than one unit. One line each, newest on top.

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
