/**
 * Household dataset — required item 1.
 *
 * The organizers' fixture shape IS our data model (see SPEC.md). Nothing is
 * remapped into a prettier internal shape: judges test with unpublished cases
 * in the published shape, so the closer we stay to it the fewer places a field
 * can go missing.
 *
 * Two jobs live here:
 *   parseCase   — turn pasted text / an uploaded file into a validated case,
 *                 or throw a message that names the field that is wrong.
 *   monthSummary— derive the three month characters item 1 requires. Computed
 *                 from the data every time, never hard-coded: they are the
 *                 evidence for the item and the fixture is not the only case
 *                 this app will be shown.
 */
import seed from '../data/seed-p10.json' with { type: 'json' }

/** Fixture case PUB-01, verbatim. The app opens on this. */
export const SEED = seed

const REQUIRED = [
  'case_id',
  'opening_balance_bdt',
  'days',
  'recharges',
  'today',
  'usual_daily_units',
  'target_date',
  'comparison',
]

const COMPARISON_REQUIRED = [
  'months',
  'opening_balance_bdt',
  'low_threshold_bdt',
  'low_amount_bdt',
  'monthly_amount_bdt',
]

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const DECIMAL = /^-?\d+(\.\d+)?$/

function fail(message) {
  throw new Error(message)
}

/**
 * Accepts a JSON string, a single case object, or the published pack
 * ({ problem_id, cases: [...] }) — a judge handed the pack file should get all
 * 25 cases, not an error.
 */
export function parseCases(input) {
  let json = input
  if (typeof input === 'string') {
    const text = input.trim()
    if (!text) fail('Nothing to load — paste a case or choose a file.')
    try {
      json = JSON.parse(text)
    } catch (e) {
      fail(`That is not valid JSON: ${e.message}`)
    }
  }
  if (!json || typeof json !== 'object') fail('Expected a JSON object, got ' + typeof json)

  const cases = Array.isArray(json) ? json : Array.isArray(json.cases) ? json.cases : [json]
  if (cases.length === 0) fail('The file has a "cases" list, but it is empty.')
  return cases.map((c, i) => validateCase(c, cases.length > 1 ? ` (case ${i + 1})` : ''))
}

/** The single case the app runs on. First case when handed a whole pack. */
export function parseCase(input) {
  return parseCases(input)[0]
}

function validateCase(kase, where = '') {
  if (!kase || typeof kase !== 'object' || Array.isArray(kase)) {
    fail(`Expected a case object${where}.`)
  }
  for (const field of REQUIRED) {
    if (kase[field] === undefined || kase[field] === null) {
      fail(`Missing field "${field}"${where}.`)
    }
  }

  if (!Array.isArray(kase.days) || kase.days.length === 0) {
    fail(`"days" must be a non-empty list of readings${where}.`)
  }
  kase.days.forEach((d, i) => {
    if (!d || !DATE.test(d.date ?? '')) fail(`days[${i}].date must look like 2026-01-01${where}.`)
    if (!Number.isInteger(d.units) || d.units < 0) {
      fail(`days[${i}].units must be a whole number of units${where}.`)
    }
  })

  if (!Array.isArray(kase.recharges)) fail(`"recharges" must be a list${where}.`)
  kase.recharges.forEach((r, i) => {
    if (!r || !DATE.test(r.date ?? '')) fail(`recharges[${i}].date must look like 2026-01-09${where}.`)
    if (!DECIMAL.test(String(r.amount_bdt ?? ''))) {
      fail(`recharges[${i}].amount_bdt must be an amount like "300.00"${where}.`)
    }
  })

  if (!DECIMAL.test(String(kase.opening_balance_bdt))) {
    fail(`"opening_balance_bdt" must be an amount like "310.00"${where}.`)
  }
  if (!DATE.test(kase.today)) fail(`"today" must look like 2026-06-30${where}.`)
  if (!DATE.test(kase.target_date)) fail(`"target_date" must look like 2026-08-13${where}.`)
  if (!Number.isInteger(kase.usual_daily_units) || kase.usual_daily_units < 0) {
    fail(`"usual_daily_units" must be a whole number of units${where}.`)
  }

  const c = kase.comparison
  if (typeof c !== 'object' || Array.isArray(c)) fail(`"comparison" must be an object${where}.`)
  for (const field of COMPARISON_REQUIRED) {
    if (c[field] === undefined || c[field] === null) {
      fail(`Missing field "comparison.${field}"${where}.`)
    }
  }
  if (!Array.isArray(c.months) || c.months.length === 0 || !c.months.every((m) => MONTH.test(m))) {
    fail(`"comparison.months" must be months like "2026-04"${where}.`)
  }

  return kase
}

// --- month characters (required item 1) -------------------------------------

const monthOf = (isoDate) => isoDate.slice(0, 7)

/** Days in a calendar month, from its "YYYY-MM" key. Month 0-indexed in Date. */
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const amountOf = (r) => parseFloat(r.amount_bdt)

/**
 * Per-month totals plus the three characters item 1 asks the data to contain:
 * a light month, a heavy month, and a month where a large recharge landed in
 * the last week.
 *
 * The last one needs a tiebreak the problem does not give: on PUB-01 two months
 * have their biggest recharge inside the final seven days. We take the month
 * whose late recharge is the largest, and say so on screen so the rule a judge
 * sees is the rule the code ran.
 */
export function monthSummary(kase) {
  const byMonth = new Map()
  const month = (key) => {
    if (!byMonth.has(key)) {
      byMonth.set(key, { month: key, units: 0, readings: 0, recharged: 0, largestRecharge: null })
    }
    return byMonth.get(key)
  }

  for (const d of kase.days) {
    const m = month(monthOf(d.date))
    m.units += d.units
    m.readings += 1
  }
  for (const r of kase.recharges) {
    const m = month(monthOf(r.date))
    const amount = amountOf(r)
    m.recharged += amount
    if (!m.largestRecharge || amount > m.largestRecharge.amount) {
      m.largestRecharge = { date: r.date, amount }
    }
  }

  // Only months that actually carry readings can be light or heavy — a month
  // with a stray recharge and no consumption is not a month of usage.
  const months = [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1))
  const withReadings = months.filter((m) => m.readings > 0)

  let lightest = null
  let heaviest = null
  for (const m of withReadings) {
    if (!lightest || m.units < lightest.units) lightest = m
    if (!heaviest || m.units > heaviest.units) heaviest = m
  }

  let lateLarge = null
  for (const m of months) {
    const big = m.largestRecharge
    if (!big) continue
    const dayOfMonth = Number(big.date.slice(8, 10))
    const isLate = dayOfMonth > daysInMonth(m.month) - 7
    if (!isLate) continue
    if (!lateLarge || big.amount > lateLarge.largestRecharge.amount) lateLarge = m
  }

  return {
    months,
    lightest: lightest?.month ?? null,
    heaviest: heaviest?.month ?? null,
    lateLarge: lateLarge?.month ?? null,
    lateLargeRecharge: lateLarge?.largestRecharge ?? null,
    totalUnits: months.reduce((sum, m) => sum + m.units, 0),
  }
}

/** "2026-01-01 to 2026-06-30" — the span the readings actually cover. */
export function dateRange(kase) {
  const first = kase.days[0]?.date
  const last = kase.days[kase.days.length - 1]?.date
  return { first, last }
}
