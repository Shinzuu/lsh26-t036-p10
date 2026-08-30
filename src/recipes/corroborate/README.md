# corroborate

Turning many independent reports into one recurrence signal — "this keeps
happening here," not just a pile of dots on a map or rows in a table. Pure
logic, dependency-free, no DOM, no `db.js`, no clustering library.

This is the seed pattern for playbook/10-coverage.md's gap C: three of the
drill's twelve problems need exactly this shape (a flood spot that recurs, a
load-shedding pattern, riders corroborating the same bus stop is
unreliable), and `map/geo.js` ships the distance maths but nothing that
turns a pile of reports into a count. The archetype doc names the
anti-pattern ("do not start with tiles or clustering") without ever landing
on the right-sized fix — this recipe is that fix: grid-binning for geo
reports, plain-field grouping for everything else, both feeding one
aggregation pipeline.

## Files

| File | What |
|---|---|
| `aggregate.js` | `decayWeight`, `makeGridKeyFn`, `makeFieldKeyFn`, `classify`, `aggregateReports` — the whole pipeline. |
| `aggregate.test.mjs` | `node --test` coverage — decay math spot-checked by hand, grid boundary behaviour, spam resistance, empty/single-report groups, deterministic ordering. |

Nothing here imports from another recipe or from `src/lib`.

## Using it

```bash
cp -r src/recipes/corroborate src/lib/corroborate
```

```js
import { aggregateReports, makeGridKeyFn, makeFieldKeyFn } from '../lib/corroborate/aggregate.js'

// Geo case: many flood reports, cluster them into ~150m cells.
const keyFn = makeGridKeyFn({ binMeters: 150 }) // atLatDeg defaults to Dhaka
const groups = aggregateReports(floodReports, { keyFn, now: Date.now() })
// [{ key, count, distinctReporters, confidence, classification, lastSeen, reports }, ...]
// sorted most-confirmed first — render the top of the array as the map's
// "hot spots" list, or size/colour each marker by `count` or `confidence`.

// Non-geo case: same pipeline, keyed by a plain field instead of lat/lng.
const routeKeyFn = makeFieldKeyFn('routeId')
const busGroups = aggregateReports(skippedStopReports, { keyFn: routeKeyFn, now: Date.now() })
// "3 riders reported route 6 skipped this stop in the last hour" is
// groups.find(g => g.key === '6').distinctReporters
```

Every report needs, at minimum, a timestamp (`r.timestamp` by default — a
`Date`, an epoch-ms number, or anything `Date.parse` accepts) and a reporter
identifier (`r.reporterId` by default) for the distinct-reporter count to
mean anything; both are overridable via `getTimestamp`/`getReporterId` if
your data shapes them differently. `now` is **always** passed in — this
file never calls `Date.now()` internally, so the whole pipeline is testable
against fixed historical instants and safe to re-run over history ("was
this confirmed as of last Tuesday?") without any code changes.

### Rendering the result

No chart library needed for a first pass — a badge per classification tier
does the job:

```jsx
const badgeClass = {
  unconfirmed: 'bg-ink-200 text-ink-700',
  likely: 'bg-warn/20 text-warn',
  confirmed: 'bg-danger/20 text-danger',
}

groups.map((g) => (
  <li key={g.key}>
    <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass[g.classification]}`}>
      {g.classification}
    </span>
    {' '}{g.distinctReporters} reporters, last seen {new Date(g.lastSeen).toLocaleString()}
  </li>
))
```

On a Leaflet map (see `map/`), size or colour each marker by `g.confidence`
or `g.count` against 2-3 fixed thresholds — grey/amber/red, no gradient math
needed, per the archetype doc's own advice.

## The grid-bin math — verify before you trust it

`makeGridKeyFn` converts a bin size in **metres** to degree steps, because
report coordinates are lat/lng but "how close counts as the same spot" is a
physical distance. One degree of **latitude** is ~111,194.9m everywhere on
Earth (meridians converge at the poles at a fixed rate); one degree of
**longitude** shrinks with `cos(latitude)` and is genuinely different by
location:

| Latitude | Metres per degree of longitude |
|---|---|
| 0° (equator) | ~111,194.9 (same as latitude) |
| 23.8103° (Dhaka) | ~101,730.8 |
| 60° | ~55,597.5 |

Using the latitude figure for both axes — a common shortcut — would make
every grid cell ~9% wider east-west than the `binMeters` actually asked for
at Dhaka's latitude, and worse at higher latitudes. `metersPerDegreeLng`
does the correction; pass `atLatDeg` for anywhere outside the Dhaka area
(it defaults to `DHAKA_LAT = 23.8103`, matching `map/geo.js`'s
`DEFAULT_CENTER`).

Binning uses `floor`, not `round`: a point sitting exactly on a multiple of
the step always joins the cell above it. That is a deliberate, testable
choice — `round`'s ties-to-even behaviour would make the exact-boundary case
depend on floating-point representation instead of a clear rule.

## Decay math — hand-verified

`decayWeight(ageMs, halfLifeMs)` is `0.5 ^ (ageMs / halfLifeMs)`. At the
default `halfLifeMs` of 24 hours:

| Age | Weight | Why |
|---|---|---|
| 0h | 1.0 | fresh report, full weight |
| 6h | 0.8408964... | `0.5 ^ 0.25` — a quarter of a half-life |
| 12h | 0.7071067... | `0.5 ^ 0.5` (`sqrt(0.5)`) — half a half-life |
| 24h | 0.5 | `0.5 ^ 1` — exactly one half-life, by definition |
| 48h | 0.25 | `0.5 ^ 2` — two half-lives |
| 72h | 0.125 | `0.5 ^ 3` — three half-lives |

Every one of these is asserted directly in `aggregate.test.mjs`. Pass a
shorter `halfLifeMs` (minutes, for something like "riders reported this bus
skipped the stop in the last 30 minutes") or a longer one (weeks, for "this
flood spot recurs every monsoon") depending on how fast a stale report
should stop mattering for your bullet.

## The 3 gotchas

1. **Same-reporter spam cannot inflate a group on its own — by design.** A
   reporter's repeat submissions collapse to their single most-recent
   sighting for both `distinctReporters` and `confidence`, so filing the
   same report five times is worth exactly as much as filing it once. What
   this does NOT protect against: five *different* fake accounts each
   filing once — this recipe has no reputation system, no account-age
   check, nothing beyond "how many distinct reporter ids." If your bullet
   needs sybil-resistance, that is a different (and much bigger) feature;
   say "recurrence signal from reported data," not "verified truth," to a
   judge.

2. **A report missing a usable id is never merged with another anonymous
   report.** Each ID-less report gets its own synthetic identity
   (`__anon_<input index>`) rather than all anonymous reports being treated
   as "the same person" — the latter would silently *suppress* a real
   distinct-reporter count (five different anonymous users would count as
   one). The trade-off: if your app genuinely can't tell two anonymous
   submitters apart, this recipe will over-count them as distinct rather
   than under-count them as the same person. That is the safer direction to
   be wrong in for a corroboration signal, but it is still a real limitation
   worth knowing about.

3. **Fixed-grid binning can split a real cluster across a cell boundary.**
   Two reports 1 metre apart but straddling a grid line land in different
   bins and don't corroborate each other. This is the same trade-off every
   fixed-grid spatial index makes; fixing it properly (overlapping or
   hierarchical bins) is real clustering-library territory, which this
   recipe deliberately does not reach for — see the file header in
   `aggregate.js`. Pick `binMeters` a bit larger than the radius you
   actually care about if boundary-splitting would visibly hurt your demo.

## One more thing worth knowing

`aggregateReports` never reads the clock itself — `now` is a required
argument, always. This is not a style preference: a function that reads
`Date.now()` internally cannot be unit-tested for decay math without every
assertion going stale between when it's written and when the test runs, and
it cannot be safely re-run against historical data. If you wire this into a
component, compute `Date.now()` once at the call site (or once per render/
poll interval) and pass it down — don't be tempted to add a `now` default
inside this file "for convenience."
