/**
 * node --test src/lib/dataset.test.mjs
 *
 * Item 1's whole claim is that the three month characters are computed, not
 * asserted — so the tests that matter are the ones that move the answer when
 * the data moves.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SEED,
  parseCase,
  parseCases,
  parseCsv,
  parseAny,
  looksLikeCsv,
  monthSummary,
  daysInMonth,
  dateRange,
} from './dataset.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

/** A spreadsheet export: one row per day, recharges in the same file. */
function csvOf(days, { header = 'date,units,recharge' } = {}) {
  return [header, ...days].join('\n')
}

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
  // The message names the two shapes the box accepts rather than quoting the
  // JSON parser, whose "Unexpected token 'h' at position 4" helps nobody who
  // did not mean to write JSON in the first place.
  assert.throws(() => parseCase('{ not json'), /does not look like a CSV or a saved case/)
  assert.throws(() => parseCase('{ not json'), (e) => !/Unexpected token/.test(e.message))
  assert.throws(() => parseCase('   '), /Nothing to load/)
})

// --- from Dip's U4 test pass, 19:42 -----------------------------------------

test('a recharge cannot be negative', () => {
  const kase = clone(SEED)
  kase.recharges[0].amount_bdt = '-500.00'
  assert.throws(() => parseCase(kase), /recharges\[0\]\.amount_bdt/)
  assert.throws(() => parseCase(kase), /cannot be negative/)
})

test('an empty array says what it is, not what it is not', () => {
  assert.throws(() => parseCase('[]'), /empty list/)
  assert.throws(() => parseCase('{"cases":[]}'), /"cases" list, but it is empty/)
})

test('one month of readings is neither lightest nor heaviest', () => {
  const kase = clone(SEED)
  kase.days = kase.days.filter((d) => d.date.startsWith('2026-01'))
  const s = monthSummary(kase)
  assert.deepEqual(s.lightestMonths, [])
  assert.deepEqual(s.heaviestMonths, [])
  assert.equal(s.lightest, null)
})

test('months that tie are all labelled, not silently dropped', () => {
  const kase = clone(SEED)
  const jan = kase.days.filter((d) => d.date.startsWith('2026-01')).reduce((a, d) => a + d.units, 0)
  for (const d of kase.days) if (d.date.startsWith('2026-02')) d.units = 0
  kase.days.find((d) => d.date === '2026-02-01').units = jan
  assert.deepEqual(monthSummary(kase).lightestMonths, ['2026-01', '2026-02'])
})

test('the last seven days of a 29-day February are the 23rd to the 29th', () => {
  const kase = clone(SEED)
  kase.days = [{ date: '2024-02-01', units: 5 }]
  kase.recharges = [{ date: '2024-02-23', amount_bdt: '100.00' }]
  assert.equal(monthSummary(kase).lateLarge, '2024-02')
  kase.recharges = [{ date: '2024-02-22', amount_bdt: '100.00' }]
  assert.equal(monthSummary(kase).lateLarge, null)
})

// --- bonus features, U5 -----------------------------------------------------

test('a recharge outside the reading period is reported, not silently dropped', async () => {
  const { simulate } = await import('./tariff.js')
  const kase = clone(SEED)
  assert.equal(simulate(kase).unappliedRecharges.length, 0)

  kase.recharges.push({ date: '2025-12-25', amount_bdt: '500.00' })
  kase.recharges.push({ date: '2026-07-15', amount_bdt: '700.00' })
  const sim = simulate(kase)
  assert.equal(sim.unappliedRecharges.length, 2)
  assert.equal(sim.unappliedPaisa, 120000)
  // and the rebuild itself is unchanged by money it could not place
  assert.equal(sim.closingBalancePaisa, simulate(SEED).closingBalancePaisa)
})

test('a month bill sums the simulation rows it covers', async () => {
  const { simulate, DEMAND_CHARGE_PAISA, METER_RENT_PAISA } = await import('./tariff.js')
  const sim = simulate(SEED)
  const june = sim.rows.filter((r) => r.date.startsWith('2026-06'))
  const energy = june.reduce((s, r) => s + r.energyPaisa, 0)
  const vat = june.reduce((s, r) => s + r.vatPaisa, 0)
  const fixed = june.reduce((s, r) => s + r.fixedPaisa, 0)
  assert.equal(energy, 385265)
  assert.equal(vat, 19263)
  assert.equal(fixed, DEMAND_CHARGE_PAISA + METER_RENT_PAISA)
  assert.equal(energy + vat + fixed, 412728)
})

// --- CSV upload, added in the polish pass -----------------------------------

test('a two-column CSV becomes a valid case', () => {
  const kase = parseCsv(
    csvOf(['2026-01-01,10,', '2026-01-02,12,', '2026-01-03,8,500.00'], { header: 'date,units,recharge' }),
    { caseId: 'Mirpur flat' },
  )
  assert.equal(kase.case_id, 'Mirpur flat')
  assert.equal(kase.days.length, 3)
  assert.deepEqual(kase.days[0], { date: '2026-01-01', units: 10 })
  assert.equal(kase.recharges.length, 1)
  assert.deepEqual(kase.recharges[0], { date: '2026-01-03', amount_bdt: '500.00' })
  assert.equal(kase.today, '2026-01-03')
  // The case it produces must survive the same validator a JSON case does.
  assert.doesNotThrow(() => parseCase(kase))
})

test('CSV without a recharge column still works — a household may have none', () => {
  const kase = parseCsv('date,units\n2026-03-01,9\n2026-03-02,11')
  assert.equal(kase.days.length, 2)
  assert.deepEqual(kase.recharges, [])
  assert.equal(kase.usual_daily_units, 10) // mean of 9 and 11
})

test('CSV headers are matched loosely, and day-first dates are understood', () => {
  const kase = parseCsv('Date , Units , Recharge Amount\n01/02/2026, 7 , \n02/02/2026, 9 , 300')
  assert.equal(kase.days[0].date, '2026-02-01')
  assert.equal(kase.days[1].date, '2026-02-02')
  assert.equal(kase.recharges[0].amount_bdt, '300.00')
})

test('a CSV error names the row, not a character offset', () => {
  assert.throws(() => parseCsv('date,units\nnotadate,5'), /Row 2/)
  assert.throws(() => parseCsv('date,units\n2026-01-01,abc'), /Row 2/)
  assert.throws(() => parseCsv('units\n5'), /needs a "date" column/)
  assert.throws(() => parseCsv('date\n2026-01-01'), /needs a "units" column/)
  assert.throws(() => parseCsv(''), /empty/)
})

test('looksLikeCsv tells the two formats apart, and parseAny routes on it', () => {
  assert.equal(looksLikeCsv('date,units\n2026-01-01,5'), true)
  assert.equal(looksLikeCsv('{ "case_id": "PUB-01" }'), false)
  assert.equal(looksLikeCsv('[{"case_id":"x"}]'), false)
  assert.equal(parseAny('date,units\n2026-01-01,5')[0].days.length, 1)
  assert.equal(parseAny(JSON.stringify(SEED))[0].case_id, 'PUB-01')
})
