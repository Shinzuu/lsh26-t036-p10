// node --test aggregate.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  decayWeight,
  metersPerDegreeLng,
  makeGridKeyFn,
  makeFieldKeyFn,
  classify,
  aggregateReports,
  DHAKA_LAT,
  DEFAULT_HALF_LIFE_MS,
  DEFAULT_THRESHOLDS,
} from './aggregate.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-08-27T12:00:00Z') // fixed instant — never Date.now() in a test either

function iso(msAgo) {
  return new Date(NOW - msAgo).toISOString()
}

// ---------------------------------------------------------------------------
// decayWeight — hand-verified spot checks
// ---------------------------------------------------------------------------

describe('decayWeight', () => {
  test('age 0 -> full weight 1', () => {
    assert.equal(decayWeight(0, DAY), 1)
  })

  test('age === halfLife -> exactly 0.5, by definition', () => {
    assert.equal(decayWeight(DAY, DAY), 0.5)
  })

  test('age === 2x halfLife -> 0.25', () => {
    assert.ok(Math.abs(decayWeight(2 * DAY, DAY) - 0.25) < 1e-12)
  })

  test('age === 3x halfLife -> 0.125', () => {
    assert.ok(Math.abs(decayWeight(3 * DAY, DAY) - 0.125) < 1e-12)
  })

  test('hand-verified quarter/half half-life points (see file header comment)', () => {
    // 0.5^0.25 = 0.8408964152537146, 0.5^0.5 = 0.7071067811865476
    assert.ok(Math.abs(decayWeight(6 * HOUR, DAY) - 0.8408964152537146) < 1e-9)
    assert.ok(Math.abs(decayWeight(12 * HOUR, DAY) - 0.7071067811865476) < 1e-9)
  })

  test('future timestamp (negative age) clamps to weight 1, never above', () => {
    assert.equal(decayWeight(-5000, DAY), 1)
  })

  test('non-finite age returns 0, does not throw', () => {
    assert.equal(decayWeight(NaN, DAY), 0)
    assert.equal(decayWeight(Infinity, DAY), 0)
  })

  test('non-positive or non-finite halfLife returns 0, does not throw', () => {
    assert.equal(decayWeight(1000, 0), 0)
    assert.equal(decayWeight(1000, -1), 0)
    assert.equal(decayWeight(1000, NaN), 0)
  })

  test('weight is strictly decreasing as age increases (monotonic decay)', () => {
    const w1 = decayWeight(HOUR, DAY)
    const w2 = decayWeight(2 * HOUR, DAY)
    const w3 = decayWeight(3 * HOUR, DAY)
    assert.ok(w1 > w2 && w2 > w3)
  })
})

// ---------------------------------------------------------------------------
// metersPerDegreeLng — degrees-to-meters, Bangladesh latitudes
// ---------------------------------------------------------------------------

describe('metersPerDegreeLng', () => {
  test('at Dhaka latitude, ~101,730m per degree of longitude (hand-verified)', () => {
    const m = metersPerDegreeLng(DHAKA_LAT)
    assert.ok(Math.abs(m - 101730.8) < 1)
  })

  test('narrower than a degree of latitude (111,194.9m) at any nonzero latitude', () => {
    assert.ok(metersPerDegreeLng(DHAKA_LAT) < 111194.93)
  })

  test('at the equator, longitude degree ~= latitude degree (cos(0) = 1)', () => {
    const m = metersPerDegreeLng(0)
    assert.ok(Math.abs(m - 111194.9266) < 1)
  })

  test('shrinks further at higher latitude', () => {
    assert.ok(metersPerDegreeLng(60) < metersPerDegreeLng(DHAKA_LAT))
  })
})

// ---------------------------------------------------------------------------
// makeGridKeyFn — grid-bin grouping + boundary behaviour
// ---------------------------------------------------------------------------

describe('makeGridKeyFn', () => {
  test('throws on missing/invalid binMeters (call-site misconfiguration)', () => {
    assert.throws(() => makeGridKeyFn({}), TypeError)
    assert.throws(() => makeGridKeyFn({ binMeters: 0 }), TypeError)
    assert.throws(() => makeGridKeyFn({ binMeters: -50 }), TypeError)
    assert.throws(() => makeGridKeyFn({ binMeters: NaN }), TypeError)
  })

  test('two points a few metres apart land in the same bin', () => {
    const keyFn = makeGridKeyFn({ binMeters: 500, atLatDeg: DHAKA_LAT })
    const a = keyFn({ lat: 23.8103, lng: 90.4125 })
    const b = keyFn({ lat: 23.8104, lng: 90.4126 }) // ~15m away
    assert.equal(a, b)
  })

  test('two points far apart land in different bins', () => {
    const keyFn = makeGridKeyFn({ binMeters: 500, atLatDeg: DHAKA_LAT })
    const a = keyFn({ lat: 23.8103, lng: 90.4125 })
    const b = keyFn({ lat: 23.9000, lng: 90.5000 }) // several km away
    assert.notEqual(a, b)
  })

  test('missing/non-finite coordinates return null (skip signal)', () => {
    const keyFn = makeGridKeyFn({ binMeters: 500 })
    assert.equal(keyFn({ lat: NaN, lng: 90.4125 }), null)
    assert.equal(keyFn({ lat: 23.81, lng: undefined }), null)
    assert.equal(keyFn({}), null)
  })

  test('boundary: a point exactly on a bin edge consistently joins the cell above (floor semantics)', () => {
    // Choose binMeters so the lat step works out to a round number, then
    // probe exactly on and either side of that boundary.
    const binMeters = 1000
    const keyFn = makeGridKeyFn({ binMeters, atLatDeg: 0 }) // atLatDeg=0 makes lng step == lat step, simpler to reason about
    const latStepDeg = binMeters / ((Math.PI / 180) * 6371000)

    const onBoundary = keyFn({ lat: latStepDeg * 4, lng: 0 }) // exactly on multiple of step -> cell 4
    const justBelow = keyFn({ lat: latStepDeg * 4 - 1e-9, lng: 0 }) // just under -> cell 3
    const justAbove = keyFn({ lat: latStepDeg * 4 + 1e-9, lng: 0 }) // just over -> still cell 4

    assert.equal(onBoundary, justAbove)
    assert.notEqual(onBoundary, justBelow)
  })

  test('custom getLat/getLng accessors read from a differently-shaped report', () => {
    const keyFn = makeGridKeyFn({
      binMeters: 500,
      getLat: (r) => r.coords.latitude,
      getLng: (r) => r.coords.longitude,
    })
    const key = keyFn({ coords: { latitude: 23.8103, longitude: 90.4125 } })
    assert.equal(typeof key, 'string')
  })

  test('smaller binMeters produces finer (more distinct) grouping for the same spread of points', () => {
    const coarse = makeGridKeyFn({ binMeters: 5000, atLatDeg: DHAKA_LAT })
    const fine = makeGridKeyFn({ binMeters: 10, atLatDeg: DHAKA_LAT })
    const points = [
      { lat: 23.8103, lng: 90.4125 },
      { lat: 23.8113, lng: 90.4135 }, // ~150m away
    ]
    const coarseKeys = new Set(points.map(coarse))
    const fineKeys = new Set(points.map(fine))
    assert.equal(coarseKeys.size, 1) // same coarse bin
    assert.equal(fineKeys.size, 2) // split into separate fine bins
  })
})

// ---------------------------------------------------------------------------
// makeFieldKeyFn — route/place-keyed grouping
// ---------------------------------------------------------------------------

describe('makeFieldKeyFn', () => {
  test('throws on missing/non-string field name', () => {
    assert.throws(() => makeFieldKeyFn(), TypeError)
    assert.throws(() => makeFieldKeyFn(''), TypeError)
    assert.throws(() => makeFieldKeyFn(42), TypeError)
  })

  test('groups by the named field', () => {
    const keyFn = makeFieldKeyFn('routeId')
    assert.equal(keyFn({ routeId: 'route-6' }), 'route-6')
    assert.equal(keyFn({ routeId: 'route-6' }), keyFn({ routeId: 'route-6' }))
    assert.notEqual(keyFn({ routeId: 'route-6' }), keyFn({ routeId: 'route-7' }))
  })

  test('missing/null/empty field value returns null (skip signal)', () => {
    const keyFn = makeFieldKeyFn('routeId')
    assert.equal(keyFn({}), null)
    assert.equal(keyFn({ routeId: null }), null)
    assert.equal(keyFn({ routeId: '' }), null)
  })

  test('normalize option folds equivalent values into one key', () => {
    const keyFn = makeFieldKeyFn('place', { normalize: (v) => v.trim().toLowerCase() })
    assert.equal(keyFn({ place: 'Mirpur 10' }), keyFn({ place: ' mirpur 10 ' }))
  })
})

// ---------------------------------------------------------------------------
// classify — threshold classifier
// ---------------------------------------------------------------------------

describe('classify', () => {
  test('0 or 1 distinct reporters -> unconfirmed (default thresholds)', () => {
    assert.equal(classify(0), 'unconfirmed')
    assert.equal(classify(1), 'unconfirmed')
  })

  test('2 distinct reporters -> likely (default thresholds)', () => {
    assert.equal(classify(2), 'likely')
  })

  test('3+ distinct reporters -> confirmed (default thresholds)', () => {
    assert.equal(classify(3), 'confirmed')
    assert.equal(classify(10), 'confirmed')
  })

  test('custom thresholds are honoured', () => {
    const thresholds = { likely: 5, confirmed: 10 }
    assert.equal(classify(4, thresholds), 'unconfirmed')
    assert.equal(classify(5, thresholds), 'likely')
    assert.equal(classify(9, thresholds), 'likely')
    assert.equal(classify(10, thresholds), 'confirmed')
  })

  test('non-finite count treated as 0 -> unconfirmed', () => {
    assert.equal(classify(NaN), 'unconfirmed')
    assert.equal(classify(undefined), 'unconfirmed')
  })

  test('DEFAULT_THRESHOLDS matches documented default (2 likely, 3 confirmed)', () => {
    assert.deepEqual(DEFAULT_THRESHOLDS, { likely: 2, confirmed: 3 })
  })
})

// ---------------------------------------------------------------------------
// aggregateReports — the full pipeline
// ---------------------------------------------------------------------------

describe('aggregateReports', () => {
  test('throws when keyFn is missing or not a function', () => {
    assert.throws(() => aggregateReports([], { now: NOW }), TypeError)
    assert.throws(() => aggregateReports([], { now: NOW, keyFn: 'nope' }), TypeError)
  })

  test('throws when now is missing or not finite', () => {
    const keyFn = makeFieldKeyFn('routeId')
    assert.throws(() => aggregateReports([], { keyFn }), TypeError)
    assert.throws(() => aggregateReports([], { keyFn, now: NaN }), TypeError)
    assert.throws(() => aggregateReports([], { keyFn, now: 'now' }), TypeError)
  })

  test('empty input returns an empty array, not an error', () => {
    const keyFn = makeFieldKeyFn('routeId')
    assert.deepEqual(aggregateReports([], { keyFn, now: NOW }), [])
  })

  test('non-array input is treated as empty, does not throw', () => {
    const keyFn = makeFieldKeyFn('routeId')
    assert.deepEqual(aggregateReports(null, { keyFn, now: NOW }), [])
    assert.deepEqual(aggregateReports(undefined, { keyFn, now: NOW }), [])
  })

  test('junk (non-object) rows in the input are skipped silently', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [null, 42, 'nope', { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) }]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(groups.length, 1)
    assert.equal(groups[0].count, 1)
  })

  test('a single-report group: count 1, distinctReporters 1, unconfirmed', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [{ routeId: 'r1', reporterId: 'u1', timestamp: iso(0) }]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(groups.length, 1)
    assert.equal(groups[0].count, 1)
    assert.equal(groups[0].distinctReporters, 1)
    assert.equal(groups[0].classification, 'unconfirmed')
    assert.equal(groups[0].confidence, 1) // fresh report, weight 1
  })

  test('same reporter spamming the same group does not raise distinct count', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(1000) },
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(2000) },
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(3000) },
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(4000) },
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.count, 5) // every report still counted
    assert.equal(group.distinctReporters, 1) // but only one distinct person
    assert.equal(group.classification, 'unconfirmed') // spam alone can't reach "likely"
  })

  test('same-reporter spam contributes only their single best (most recent) weight to confidence', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) }, // weight 1 (freshest)
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(3 * DAY) }, // much older, weight 0.125
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.confidence, 1) // takes the max (freshest), not the sum of both
  })

  test('multiple distinct reporters raise both distinctReporters and confidence', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r1', reporterId: 'u2', timestamp: iso(0) },
      { routeId: 'r1', reporterId: 'u3', timestamp: iso(0) },
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.distinctReporters, 3)
    assert.equal(group.confidence, 3) // 3 distinct reporters, all fresh -> weight 1 each
    assert.equal(group.classification, 'confirmed')
  })

  test('reports missing a reporterId are never merged with each other', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', timestamp: iso(0) }, // no reporterId
      { routeId: 'r1', timestamp: iso(0) }, // no reporterId
      { routeId: 'r1', timestamp: iso(0) }, // no reporterId
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    // each anonymous report gets a synthetic distinct id, so 3 separate
    // "reporters" here, not 1 collapsed "anonymous" bucket
    assert.equal(group.distinctReporters, 3)
    assert.equal(group.count, 3)
  })

  test('older reports contribute less confidence than fresher ones', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const fresh = aggregateReports([{ routeId: 'r1', reporterId: 'u1', timestamp: iso(0) }], { keyFn, now: NOW })
    const stale = aggregateReports([{ routeId: 'r1', reporterId: 'u1', timestamp: iso(3 * DAY) }], {
      keyFn,
      now: NOW,
    })
    assert.ok(fresh[0].confidence > stale[0].confidence)
  })

  test('halfLifeMs option changes the decay rate', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [{ routeId: 'r1', reporterId: 'u1', timestamp: iso(DAY) }]
    const shortHalfLife = aggregateReports(reports, { keyFn, now: NOW, halfLifeMs: HOUR })
    const longHalfLife = aggregateReports(reports, { keyFn, now: NOW, halfLifeMs: 30 * DAY })
    assert.ok(shortHalfLife[0].confidence < longHalfLife[0].confidence)
  })

  test('reports with an unparsable timestamp still count toward `count` but contribute 0 confidence', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: 'not a date' },
      { routeId: 'r1', reporterId: 'u2', timestamp: iso(0) },
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.count, 2)
    assert.equal(group.distinctReporters, 2)
    assert.equal(group.confidence, 1) // u1 contributes 0, u2 contributes 1
  })

  test('lastSeen is the most recent valid timestamp in the group, or null if none parse', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(2 * DAY) },
      { routeId: 'r1', reporterId: 'u2', timestamp: iso(0) },
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.lastSeen, NOW)

    const allBad = aggregateReports([{ routeId: 'r1', reporterId: 'u1', timestamp: 'garbage' }], {
      keyFn,
      now: NOW,
    })
    assert.equal(allBad[0].lastSeen, null)
  })

  test('reports missing a usable grouping key are excluded from every group', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) },
      { reporterId: 'u2', timestamp: iso(0) }, // no routeId at all
    ]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(groups.length, 1)
    assert.equal(groups[0].count, 1)
  })

  test('deterministic ordering: most-confirmed group first, tie-broken by distinctReporters then key', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r-low', reporterId: 'u1', timestamp: iso(0) }, // 1 reporter
      { routeId: 'r-high', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r-high', reporterId: 'u2', timestamp: iso(0) },
      { routeId: 'r-high', reporterId: 'u3', timestamp: iso(0) }, // 3 reporters
      { routeId: 'r-mid', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r-mid', reporterId: 'u2', timestamp: iso(0) }, // 2 reporters
    ]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.deepEqual(
      groups.map((g) => g.key),
      ['r-high', 'r-mid', 'r-low'],
    )
  })

  test('deterministic ordering is stable regardless of input order (same input shuffled -> same output)', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const base = [
      { routeId: 'r-a', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r-b', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r-b', reporterId: 'u2', timestamp: iso(0) },
    ]
    const reversed = [...base].reverse()
    const groupsA = aggregateReports(base, { keyFn, now: NOW }).map((g) => g.key)
    const groupsB = aggregateReports(reversed, { keyFn, now: NOW }).map((g) => g.key)
    assert.deepEqual(groupsA, groupsB)
  })

  test('exact tie on confidence and distinctReporters falls back to ascending key order', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r-z', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r-a', reporterId: 'u1', timestamp: iso(0) },
    ]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.deepEqual(
      groups.map((g) => g.key),
      ['r-a', 'r-z'],
    )
  })

  test('custom getTimestamp/getReporterId accessors read from a differently-shaped report', () => {
    const keyFn = makeFieldKeyFn('place')
    const reports = [
      { place: 'Mirpur', reportedBy: 'u1', reportedAt: iso(0) },
      { place: 'Mirpur', reportedBy: 'u2', reportedAt: iso(0) },
    ]
    const groups = aggregateReports(reports, {
      keyFn,
      now: NOW,
      getReporterId: (r) => r.reportedBy,
      getTimestamp: (r) => r.reportedAt,
    })
    assert.equal(groups[0].distinctReporters, 2)
  })

  test('accepts Date objects and epoch-ms numbers for timestamps, not just ISO strings', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: new Date(NOW) },
      { routeId: 'r1', reporterId: 'u2', timestamp: NOW },
    ]
    const [group] = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(group.distinctReporters, 2)
    assert.equal(group.confidence, 2)
  })

  test('custom thresholds option is honoured end to end', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const reports = [
      { routeId: 'r1', reporterId: 'u1', timestamp: iso(0) },
      { routeId: 'r1', reporterId: 'u2', timestamp: iso(0) },
    ]
    const strict = aggregateReports(reports, { keyFn, now: NOW, thresholds: { likely: 3, confirmed: 5 } })
    assert.equal(strict[0].classification, 'unconfirmed') // would be "likely" under default thresholds
  })

  test('end-to-end with a grid keyFn: nearby geo reports from different people confirm; a distant one does not merge', () => {
    const keyFn = makeGridKeyFn({ binMeters: 200, atLatDeg: DHAKA_LAT })
    const reports = [
      { lat: 23.8103, lng: 90.4125, reporterId: 'u1', timestamp: iso(0) },
      { lat: 23.8104, lng: 90.4126, reporterId: 'u2', timestamp: iso(HOUR) },
      { lat: 23.8103, lng: 90.4125, reporterId: 'u3', timestamp: iso(2 * HOUR) },
      { lat: 23.9500, lng: 90.5500, reporterId: 'u4', timestamp: iso(0) }, // far away, own bin
    ]
    const groups = aggregateReports(reports, { keyFn, now: NOW })
    assert.equal(groups.length, 2)
    const [confirmed, distant] = groups
    assert.equal(confirmed.distinctReporters, 3)
    assert.equal(confirmed.classification, 'confirmed')
    assert.equal(distant.distinctReporters, 1)
    assert.equal(distant.classification, 'unconfirmed')
  })

  test('reports array on each group preserves the original report objects', () => {
    const keyFn = makeFieldKeyFn('routeId')
    const r1 = { routeId: 'r1', reporterId: 'u1', timestamp: iso(0), note: 'skipped stop' }
    const groups = aggregateReports([r1], { keyFn, now: NOW })
    assert.equal(groups[0].reports[0], r1) // same reference, not a copy
    assert.equal(groups[0].reports[0].note, 'skipped stop')
  })
})
