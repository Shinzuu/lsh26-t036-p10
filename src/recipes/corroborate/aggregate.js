/**
 * Corroboration — turning many independent reports into one recurrence
 * signal: "this keeps happening here" or "this route is unreliable," not
 * just a pile of dots or rows.
 *
 * WHY THIS EXISTS
 * "Map the world" and two other archetypes name the anti-pattern
 * (playbook/05-archetypes.md explicitly says "do not start with tiles or
 * clustering") without ever landing on the right-sized version of the fix,
 * and three of the drill's twelve problems need exactly this shape: a flood
 * report that recurs at the same spot, a load-shedding pattern, riders
 * corroborating the same bus stop is unreliable. The kit's `map/geo.js`
 * ships the distance maths but nothing that turns a pile of reports into a
 * count; this file is that missing step, and it works for the non-geo case
 * too (route/place-keyed reports), because the grouping key is a plug-in,
 * not hard-coded to lat/lng.
 *
 * WHAT THIS IS NOT
 * Not a clustering library (no k-means, no DBSCAN, no spatial index) and
 * not a trust/reputation system (no scoring of individual reporters across
 * groups, no weighting by "how often has this person been right before").
 * Grid-binning is the entire spatial strategy — cheap, deterministic,
 * explainable to a judge in one sentence, and exactly the "right-sized"
 * version the archetype doc gestures at but never names.
 *
 * WHAT EACH PIECE IS FOR
 *   decayWeight     - the exponential-decay building block ("how much is a
 *                     report from N hours/days ago still worth"). Reach for
 *                     this directly only if you need the raw weight number
 *                     somewhere outside aggregateReports (e.g. a UI badge
 *                     that fades with age).
 *   makeGridKeyFn   - groups lat/lng reports into fixed-size grid cells.
 *                     Reach for this for any "shows the pattern on a map"
 *                     bullet — flood spots, load-shedding, pothole reports.
 *   makeFieldKeyFn  - groups reports by a plain field (route id, stop id,
 *                     place name). Reach for this whenever the recurring
 *                     thing isn't a point on a map at all — "riders
 *                     reported bus 6 skipped this stop 4 times today."
 *   classify        - the unconfirmed/likely/confirmed threshold label by
 *                     distinct-reporter count. Reach for this if you're
 *                     rendering a badge and don't need the full aggregate
 *                     (e.g. you already have a reporter count from
 *                     elsewhere).
 *   aggregateReports - the whole pipeline: group, weight by recency, count
 *                     distinct reporters, classify. This is the one you
 *                     wire up 95% of the time.
 *
 * THE ONE RULE THAT MATTERS MOST: no `Date.now()` in here, anywhere.
 * Every function that cares about "now" takes it as an argument. A pure
 * function that reads the clock internally cannot be unit-tested for decay
 * math (every assertion would go stale the instant the test runs a
 * millisecond later) and cannot be safely re-run against historical data
 * ("was this confirmed as of last Tuesday?") — both of which this recipe's
 * own test file relies on. Pass `now` from `Date.now()` at the call site,
 * never inside.
 */

// ---------------------------------------------------------------------------
// decayWeight
// ---------------------------------------------------------------------------

export const DEFAULT_HALF_LIFE_MS = 24 * 60 * 60 * 1000 // 24 hours
export const DEFAULT_THRESHOLDS = { likely: 2, confirmed: 3 }

/**
 * Exponential recency decay: `0.5 ^ (ageMs / halfLifeMs)`.
 *
 * A report's weight is 1 at age 0, exactly 0.5 at `age === halfLifeMs`
 * (that is the definition of a half-life), 0.25 at two half-lives, 0.125 at
 * three, and so on, asymptoting toward (never reaching) 0 as age grows.
 * Hand-verified spot checks, at `halfLifeMs = 24h` (the default):
 *
 *   age  0h -> 1.0            (fresh report, full weight)
 *   age  6h -> 0.8408964...   (0.5 ^ 0.25 — a quarter of a half-life)
 *   age 12h -> 0.7071067...   (0.5 ^ 0.5  — sqrt(0.5), a half half-life)
 *   age 24h -> 0.5            (0.5 ^ 1    — exactly one half-life, by definition)
 *   age 48h -> 0.25           (0.5 ^ 2    — two half-lives)
 *   age 72h -> 0.125          (0.5 ^ 3    — three half-lives)
 *
 * Clock skew / out-of-order data: a negative `ageMs` (a report timestamped
 * after `now`) is clamped to 0 rather than producing a weight above 1 — a
 * report from "the future" is worth at most as much as a report from right
 * now, never more.
 *
 * @param {number} ageMs - `now - reportTimestampMs`, in milliseconds.
 * @param {number} halfLifeMs - time for weight to drop by half. Must be > 0.
 * @returns {number} weight in `(0, 1]`, or `0` for invalid/non-finite input
 *   (never `NaN`, never throws — a bad timestamp should zero out one
 *   report's contribution, not crash the whole aggregate).
 */
export function decayWeight(ageMs, halfLifeMs) {
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) return 0
  if (!Number.isFinite(ageMs)) return 0
  const clampedAge = Math.max(0, ageMs)
  return Math.pow(0.5, clampedAge / halfLifeMs)
}

// ---------------------------------------------------------------------------
// makeGridKeyFn — lat/lng grid-bin grouping
// ---------------------------------------------------------------------------

// Spherical-earth approximation, same model `map/geo.js` uses
// (`EARTH_RADIUS_KM = 6371`) — kept as an independent constant here since
// this recipe is self-contained and never imports from another recipe.
const EARTH_RADIUS_M = 6371000

// One degree of LATITUDE is ~111,194.9 metres everywhere on a sphere — it
// does not depend on where on Earth you are, because meridians (lines of
// longitude) all converge at the poles at the same rate.
const METERS_PER_DEGREE_LAT = (Math.PI / 180) * EARTH_RADIUS_M // 111,194.9266...

// Dhaka, Bangladesh — matches `map/geo.js`'s `DEFAULT_CENTER`. This is the
// reference latitude the worked example below is computed at; pass a
// different `atLatDeg` to `makeGridKeyFn` for reports outside the Dhaka area.
export const DHAKA_LAT = 23.8103

/**
 * One degree of LONGITUDE, in metres, at a given latitude. Unlike latitude,
 * this genuinely depends on where you are: meridians are `metersPerDegreeLat`
 * apart at the equator and 0 apart at the poles, following `cos(latitude)`.
 *
 * Worked example at Dhaka's latitude (23.8103°N), hand-verified:
 *   cos(23.8103°)                    = 0.914887...
 *   111,194.9266 * 0.914887...       = 101,730.80... metres per degree of longitude
 *
 * That is ~9% narrower than a degree of latitude at the same spot — using
 * the latitude figure for both axes (a common shortcut) would make every
 * grid cell noticeably wider east-west than the bin size actually asked
 * for. This function is what `makeGridKeyFn` uses to correct for that.
 *
 * @param {number} atLatDeg - latitude in decimal degrees.
 * @returns {number} metres per degree of longitude at that latitude.
 */
export function metersPerDegreeLng(atLatDeg) {
  return METERS_PER_DEGREE_LAT * Math.cos((atLatDeg * Math.PI) / 180)
}

/**
 * Build a `keyFn` that groups reports into a fixed-size lat/lng grid —
 * "reports within roughly `binMeters` of each other" without a clustering
 * library. Reach for this for any "shows the pattern on a map" bullet: a
 * pothole reported five times near the same corner should collapse into
 * one group, not five map markers with no visible relationship.
 *
 * How it works: each axis is divided into steps of `binMeters` (converted
 * to degrees via `METERS_PER_DEGREE_LAT` / `metersPerDegreeLng`), and a
 * point is assigned to the grid cell `floor(lat / latStepDeg)` by
 * `floor(lng / lngStepDeg)`. `floor`, not `round`, is the deliberate choice:
 * every point in `[cellIndex * step, (cellIndex + 1) * step)` belongs to the
 * same cell, so a point sitting exactly on a multiple of the step always
 * joins the cell above it, consistently — `round`'s "round half to even"
 * behaviour would make that boundary case depend on floating-point
 * representation, which is much harder to reason about or test.
 *
 * Trade-off worth knowing: a real report pair 1 metre apart but straddling
 * a cell boundary lands in two different bins, undercounting that pair's
 * corroboration. This is the same trade-off every fixed-grid spatial index
 * makes; the fix (overlapping/hierarchical bins) is real clustering-library
 * territory, which this recipe deliberately does not reach for. Pick
 * `binMeters` a little larger than the corroboration radius you actually
 * care about if boundary-splitting would matter for your bullet.
 *
 * @param {object} options
 * @param {number} options.binMeters - grid cell size in metres. Must be > 0.
 * @param {number} [options.atLatDeg=DHAKA_LAT] - latitude the longitude
 *   correction is computed at. Pick roughly the centre of your data's
 *   actual area — the correction only needs to be approximately right.
 * @param {(report: object) => number} [options.getLat] - defaults to `r.lat`.
 * @param {(report: object) => number} [options.getLng] - defaults to `r.lng`.
 * @returns {(report: object) => (string|null)} a keyFn for `aggregateReports`
 *   — returns `null` for a report with missing/non-finite coordinates, which
 *   `aggregateReports` treats as "cannot be grouped" and skips.
 * @throws {TypeError} if `binMeters` is missing or not a positive number —
 *   that is a call-site configuration mistake, not bad report data, so it
 *   fails loudly at setup time rather than silently grouping every report
 *   into one giant bin.
 */
export function makeGridKeyFn(options = {}) {
  const { binMeters, atLatDeg = DHAKA_LAT, getLat = (r) => r?.lat, getLng = (r) => r?.lng } = options

  if (!Number.isFinite(binMeters) || binMeters <= 0) {
    throw new TypeError('makeGridKeyFn: options.binMeters must be a positive number')
  }

  const latStepDeg = binMeters / METERS_PER_DEGREE_LAT
  const lngStepDeg = binMeters / metersPerDegreeLng(atLatDeg)

  return function gridKeyFn(report) {
    const lat = getLat(report)
    const lng = getLng(report)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const latIdx = Math.floor(lat / latStepDeg)
    const lngIdx = Math.floor(lng / lngStepDeg)
    return `${latIdx}:${lngIdx}`
  }
}

// ---------------------------------------------------------------------------
// makeFieldKeyFn — route/place-keyed grouping
// ---------------------------------------------------------------------------

/**
 * Build a `keyFn` that groups reports by a plain field instead of location —
 * "bus route 6," "Mirpur 10 stop," "Ward 12." Reach for this whenever the
 * recurring thing being reported isn't a point on a map at all: bus-stop
 * reliability, a specific market's price-gouging reports, a named
 * neighbourhood's load-shedding complaints.
 *
 * @param {string} field - property name to read off each report.
 * @param {object} [options]
 * @param {(value: any) => any} [options.normalize] - applied to the field
 *   value before it becomes the group key, e.g. `(v) => v.trim().toLowerCase()`
 *   so `"Route 6"` and `"route 6 "` land in the same group. Defaults to the
 *   identity function (no normalization).
 * @returns {(report: object) => (string|null)} a keyFn for `aggregateReports`
 *   — returns `null` (skip) when the field is missing, `null`, `undefined`,
 *   or an empty string, so an incomplete report doesn't silently join a
 *   `"undefined"`-keyed group.
 * @throws {TypeError} if `field` is falsy — a call-site mistake, not bad data.
 */
export function makeFieldKeyFn(field, options = {}) {
  if (!field || typeof field !== 'string') {
    throw new TypeError('makeFieldKeyFn: field must be a non-empty string')
  }
  const { normalize = (v) => v } = options

  return function fieldKeyFn(report) {
    const raw = report?.[field]
    if (raw === null || raw === undefined || raw === '') return null
    return String(normalize(raw))
  }
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------

/**
 * Threshold classifier: how many *distinct* reporters does a group need
 * before it's worth acting on? Reach for this directly when you already
 * have a distinct-reporter count from somewhere else and just need the
 * label; `aggregateReports` calls this internally for its `classification`
 * field, so most callers never need it standalone.
 *
 * Distinct reporters, not raw report count, is the input on purpose: one
 * person filing the same report five times is one opinion, not five, and
 * `aggregateReports` already enforces that upstream (see its own doc
 * comment) — this function trusts whatever count it's handed.
 *
 * @param {number} distinctReporterCount
 * @param {object} [thresholds]
 * @param {number} [thresholds.likely=2] - distinct reporters needed to move
 *   past "unconfirmed."
 * @param {number} [thresholds.confirmed=3] - distinct reporters needed to
 *   reach "confirmed." Must be >= `likely` for the three tiers to be
 *   reachable in order; a misconfigured `confirmed < likely` still resolves
 *   sensibly (whichever threshold a count clears "highest" wins) but is not
 *   a supported configuration.
 * @returns {'unconfirmed'|'likely'|'confirmed'}
 */
export function classify(distinctReporterCount, thresholds = DEFAULT_THRESHOLDS) {
  const { likely = DEFAULT_THRESHOLDS.likely, confirmed = DEFAULT_THRESHOLDS.confirmed } = thresholds ?? {}
  const n = Number.isFinite(distinctReporterCount) ? distinctReporterCount : 0
  if (n >= confirmed) return 'confirmed'
  if (n >= likely) return 'likely'
  return 'unconfirmed'
}

// ---------------------------------------------------------------------------
// aggregateReports
// ---------------------------------------------------------------------------

function toMs(value) {
  if (value === null || value === undefined) return NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? NaN : parsed
  }
  return NaN
}

function sumMapValues(map) {
  let total = 0
  for (const v of map.values()) total += v
  return total
}

/**
 * The whole pipeline: group many independent reports, weight each by how
 * recent it is, count how many *distinct* reporters corroborate each group,
 * and classify the result. This is the function nearly every caller wants —
 * `makeGridKeyFn`/`makeFieldKeyFn` above exist to build the `keyFn` this
 * takes.
 *
 * SAME-REPORTER SPAM DOES NOT INFLATE A GROUP
 * A report with no usable reporter id is never merged with another
 * anonymous report — each such report gets its own synthetic id
 * (`__anon_<input index>`) so a missing id can never accidentally
 * masquerade as "the same person reported twice," which would wrongly
 * *suppress* a real distinct-reporter count. But when a reporter id IS
 * present and repeats, only that reporter's single most-recent sighting
 * counts toward both `distinctReporters` and `confidence` — one person
 * filing the same flood report five times in an hour is one corroborating
 * opinion, not five. This is what stops a bad actor (or an over-eager
 * genuine user double-tapping "report") from single-handedly pushing a
 * group from "unconfirmed" to "confirmed."
 *
 * CONFIDENCE, PRECISELY
 * `confidence` is the sum, over each *distinct* reporter in the group, of
 * `decayWeight(now - thatReporter'sMostRecentTimestamp, halfLifeMs)`. It
 * therefore ranges from just above 0 (one reporter, a long time ago) up to
 * `distinctReporters` (every distinct reporter's most recent report was
 * exactly "now"). It grows with more distinct corroborators AND with more
 * recent ones — either alone can raise it, which is the intended "many
 * people, recently" signal — but never with repeat reports from the same
 * person, for the reason above.
 *
 * EMPTY / MISSING DATA
 * A report missing a usable key (per the `keyFn`, e.g. no lat/lng) or a
 * timestamp that doesn't parse is not dropped from the group — it still
 * counts toward `count` — but contributes a decay weight of `0`, since
 * "when did this happen" is unknowable. A report that isn't even an object
 * is skipped entirely (same defensive posture as `map/geo.js`'s point
 * filtering). An empty `reports` input returns `[]`, not an error — an
 * empty result is this pipeline's legitimate empty state, not a failure.
 *
 * DETERMINISTIC ORDERING
 * Groups are returned sorted by `confidence` descending (most urgent
 * first), tie-broken by `distinctReporters` descending, tie-broken by `key`
 * ascending as a final, always-available tiebreak. That means two groups
 * with identical scores never depend on `Map` iteration order (which
 * itself would depend on input order) — the same input always produces the
 * same output array, in the same order, which both this file's tests and
 * any UI list rendered straight from the result rely on.
 *
 * @param {Array<object>} reports
 * @param {object} options
 * @param {(report: object) => (string|null)} options.keyFn - required. Use
 *   `makeGridKeyFn` or `makeFieldKeyFn`, or write your own.
 * @param {number} options.now - required, milliseconds since epoch. Never
 *   defaults to `Date.now()` — see the file header.
 * @param {number} [options.halfLifeMs=DEFAULT_HALF_LIFE_MS] - see `decayWeight`.
 * @param {object} [options.thresholds=DEFAULT_THRESHOLDS] - see `classify`.
 * @param {(report: object) => any} [options.getTimestamp] - defaults to
 *   `r.timestamp`. Accepts a `Date`, an epoch-ms number, or anything
 *   `Date.parse` understands.
 * @param {(report: object) => any} [options.getReporterId] - defaults to
 *   `r.reporterId`.
 * @returns {Array<{
 *   key: string,
 *   count: number,
 *   distinctReporters: number,
 *   confidence: number,
 *   classification: 'unconfirmed'|'likely'|'confirmed',
 *   lastSeen: number|null,
 *   reports: Array<object>,
 * }>}
 * @throws {TypeError} if `keyFn` isn't a function or `now` isn't a finite
 *   number — both are call-site configuration mistakes, not bad report data.
 */
export function aggregateReports(reports, options) {
  const opts = options ?? {}
  const {
    keyFn,
    now,
    halfLifeMs = DEFAULT_HALF_LIFE_MS,
    thresholds = DEFAULT_THRESHOLDS,
    getTimestamp = (r) => r?.timestamp,
    getReporterId = (r) => r?.reporterId,
  } = opts

  if (typeof keyFn !== 'function') {
    throw new TypeError('aggregateReports: options.keyFn must be a function (see makeGridKeyFn / makeFieldKeyFn)')
  }
  if (!Number.isFinite(now)) {
    throw new TypeError('aggregateReports: options.now must be a finite number (ms since epoch) — pass Date.now() from the call site, never read the clock inside this function')
  }

  const list = Array.isArray(reports) ? reports : []
  const groups = new Map() // key -> { reports: object[], reporterWeight: Map<string, number> }

  list.forEach((report, index) => {
    if (!report || typeof report !== 'object') return // skip junk rows silently

    const key = keyFn(report)
    if (key === null || key === undefined) return // keyFn's own "cannot be grouped" signal

    let group = groups.get(key)
    if (!group) {
      group = { reports: [], reporterWeight: new Map() }
      groups.set(key, group)
    }
    group.reports.push(report)

    const tsMs = toMs(getTimestamp(report))
    const ageMs = Number.isFinite(tsMs) ? now - tsMs : NaN
    const weight = decayWeight(ageMs, halfLifeMs) // 0 for an unparsable timestamp

    const rawReporterId = getReporterId(report)
    const reporterId =
      rawReporterId === null || rawReporterId === undefined || rawReporterId === ''
        ? `__anon_${index}`
        : String(rawReporterId)

    // Keep only the most-recent (= highest-weight, decay is monotonic in
    // age) sighting per reporter — repeats from the same person never add
    // to distinctReporters or confidence beyond their single best weight.
    const existingWeight = group.reporterWeight.get(reporterId)
    if (existingWeight === undefined || weight > existingWeight) {
      group.reporterWeight.set(reporterId, weight)
    }
  })

  const result = []
  for (const [key, group] of groups) {
    const distinctReporters = group.reporterWeight.size
    const confidence = sumMapValues(group.reporterWeight)
    const timestamps = group.reports.map((r) => toMs(getTimestamp(r))).filter(Number.isFinite)
    const lastSeen = timestamps.length ? Math.max(...timestamps) : null

    result.push({
      key,
      count: group.reports.length,
      distinctReporters,
      confidence,
      classification: classify(distinctReporters, thresholds),
      lastSeen,
      reports: group.reports,
    })
  }

  result.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    if (b.distinctReporters !== a.distinctReporters) return b.distinctReporters - a.distinctReporters
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })

  return result
}
