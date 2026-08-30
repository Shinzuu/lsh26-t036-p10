/**
 * node --test src/lib/dataset.test.mjs
 *
 * Item 1's whole claim is that the three month characters are computed, not
 * asserted — so the tests that matter are the ones that move the answer when
 * the data moves.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED, parseCase, parseCases, monthSummary, daysInMonth, dateRange } from './dataset.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

test('SEED is fixture case PUB-01, unmodified', () => {
  assert.equal(SEED.case_id, 'PUB-01')
  assert.equal(SEED.days.length, 181)
  assert.equal(SEED.days[0].date, '2026-01-01')
  assert.equal(SEED.days.at(-1).date, '2026-06-30')
  assert.equal(SEED.recharges.length, 18)
  assert.equal(SEED.opening_balance_bdt, '310.00')
  assert.equal(SEED.today, '2026-06-30')
  assert.equal(SEED.usual_daily_units, 19)
  assert.equal(SEED.target_date, '2026-08-13')
})

test('the seed satisfies item 1: six months of daily readings', () => {
  const { months } = monthSummary(SEED)
  assert.equal(months.length, 6)
  assert.equal(months.reduce((n, m) => n + m.readings, 0), 181)
})

test('month characters are computed from PUB-01', () => {
  const s = monthSummary(SEED)
  assert.equal(s.lightest, '2026-01')
  assert.equal(s.heaviest, '2026-05')
  assert.equal(s.lateLarge, '2026-05')
  assert.equal(s.lateLargeRecharge.date, '2026-05-26')
})

test('the labels follow the data, not the fixture', () => {
  const kase = clone(SEED)
  // Make January the heaviest month by a wide margin.
  for (const d of kase.days) if (d.date.startsWith('2026-01')) d.units = 500
  const s = monthSummary(kase)
  assert.equal(s.heaviest, '2026-01')
  assert.notEqual(s.lightest, '2026-01')
})

test('late-large ties break toward the biggest late recharge', () => {
  const kase = clone(SEED)
  // June already has a late recharge (1300 on the 29th); make it the biggest.
  kase.recharges.push({ date: '2026-06-30', amount_bdt: '9000.00' })
  assert.equal(monthSummary(kase).lateLarge, '2026-06')
})

test('a recharge early in the month is not a late-large month', () => {
  const kase = clone(SEED)
  kase.days = kase.days.filter((d) => d.date.startsWith('2026-01'))
  kase.recharges = [{ date: '2026-01-02', amount_bdt: '5000.00' }]
  const s = monthSummary(kase)
  assert.equal(s.lateLarge, null)
})

test('daysInMonth handles month lengths and leap years', () => {
  assert.equal(daysInMonth('2026-01'), 31)
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2024-02'), 29)
  assert.equal(daysInMonth('2026-06'), 30)
})

test('dateRange reports the span of the readings', () => {
  assert.deepEqual(dateRange(SEED), { first: '2026-01-01', last: '2026-06-30' })
})

test('parseCase accepts a JSON string', () => {
  const kase = parseCase(JSON.stringify(SEED))
  assert.equal(kase.case_id, 'PUB-01')
})

test('parseCases accepts the whole published pack', () => {
  const pack = { problem_id: 'P10', cases: [clone(SEED), { ...clone(SEED), case_id: 'PUB-02' }] }
  const cases = parseCases(pack)
  assert.equal(cases.length, 2)
  assert.equal(cases[1].case_id, 'PUB-02')
  assert.equal(parseCase(pack).case_id, 'PUB-01')
})

test('a missing field is named in the message', () => {
  const kase = clone(SEED)
  delete kase.usual_daily_units
  assert.throws(() => parseCase(kase), /usual_daily_units/)
})

test('a missing comparison field is named with its path', () => {
  const kase = clone(SEED)
  delete kase.comparison.low_threshold_bdt
  assert.throws(() => parseCase(kase), /comparison\.low_threshold_bdt/)
})

test('a bad reading names its index', () => {
  const kase = clone(SEED)
  kase.days[7].units = 'twelve'
  assert.throws(() => parseCase(kase), /days\[7\]\.units/)
})

test('a bad recharge amount names its index', () => {
  const kase = clone(SEED)
  kase.recharges[2].amount_bdt = '৳300'
  assert.throws(() => parseCase(kase), /recharges\[2\]\.amount_bdt/)
})

test('malformed JSON produces a readable message, not a stack trace', () => {
  assert.throws(() => parseCase('{ not json'), /not valid JSON/)
  assert.throws(() => parseCase('   '), /Nothing to load/)
})
