/**
 * Independent oracle for P10 required item 3.
 *
 * Written from the problem statement's tariff text alone. It deliberately does
 * not import anything from src/lib — code that checks itself agrees with its
 * own bugs.
 */
import fs from 'node:fs'

const PACK = JSON.parse(fs.readFileSync(process.argv[2] ?? '/tmp/p10.json', 'utf8'))

// "Units 1 to 75 in a month cost 4.63 taka each, 76 to 200 cost 5.26, 201 to
// 300 cost 5.63, 301 to 400 cost 5.83, 401 to 600 cost 9.30, and 601 and above
// cost 10.70." Transcribed by hand from the statement, in paisa.
const SLABS = [
  [75, 463],
  [200, 526],
  [300, 563],
  [400, 583],
  [600, 930],
  [Infinity, 1070],
]
const DEMAND = 4200
const RENT = 4000
const FIXED = DEMAND + RENT
const BASE_RATE = 463

const paisa = (s) => Math.round(parseFloat(s ?? '0') * 100)
const taka = (p) => (p / 100).toFixed(2)
const monthOf = (d) => d.slice(0, 7)

function nextDate(d) {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10)
}

/** Charge `units` when `before` are already on this calendar month's counter. */
function energy(before, units) {
  let pos = before
  let left = units
  let total = 0
  for (const [upTo, rate] of SLABS) {
    if (left <= 0) break
    if (pos >= upTo) continue
    const take = Math.min(left, upTo - pos)
    total += take * rate
    pos += take
    left -= take
  }
  return total
}

/** Rebuild the case to get today's balance and the month counter at `today`. */
function rebuild(kase) {
  const byDate = new Map()
  for (const r of kase.recharges ?? []) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + paisa(r.amount_bdt))
  }

  let balance = paisa(kase.opening_balance_bdt)
  let month = null
  let monthUnits = 0
  let energyTotal = 0
  let fixedTotal = 0
  let rechargedTotal = 0
  const chargedMonths = new Set()
  let vatRunning = 0

  for (const day of kase.days) {
    const m = monthOf(day.date)
    if (m !== month) {
      month = m
      monthUnits = 0
    }
    const dep = byDate.get(day.date) ?? 0
    if (dep > 0) {
      balance += dep
      rechargedTotal += dep
      if (!chargedMonths.has(m)) {
        chargedMonths.add(m)
        balance -= FIXED
        fixedTotal += FIXED
      }
    }
    const e = energy(monthUnits, day.units)
    energyTotal += e
    const vatNow = Math.round((energyTotal * 5) / 100)
    const vatDay = vatNow - vatRunning
    vatRunning = vatNow
    balance -= e + vatDay
    monthUnits += day.units
  }

  return {
    balance,
    monthUnitsAtToday: monthUnits,
    lastDate: kase.days.at(-1).date,
    energyTotal,
    vatTotal: vatRunning,
    fixedTotal,
    rechargedTotal,
    chargedMonths: [...chargedMonths],
  }
}

/**
 * Run-out date. `startOnToday=false` starts the projection on the day AFTER the
 * last reading, which is the first day not already consumed in the rebuild.
 */
function runOut(kase, { startOnToday = false } = {}) {
  const r = rebuild(kase)
  const daily = kase.usual_daily_units
  if (!daily || daily <= 0) return { runsOutOn: null, reason: 'zero daily use' }

  let date = startOnToday ? r.lastDate : nextDate(r.lastDate)
  let balance = r.balance
  let month = monthOf(date)
  let monthUnits = month === monthOf(r.lastDate) && !startOnToday ? r.monthUnitsAtToday : 0
  let energyRun = 0
  let vatRun = 0

  for (let i = 0; i < 4000; i += 1) {
    const m = monthOf(date)
    if (m !== month) {
      month = m
      monthUnits = 0
    }
    const e = energy(monthUnits, daily)
    energyRun += e
    const vatNow = Math.round((energyRun * 5) / 100)
    balance -= e + (vatNow - vatRun)
    vatRun = vatNow
    monthUnits += daily
    if (balance < 0) return { runsOutOn: date, daysLasted: i }
    date = nextDate(date)
  }
  return { runsOutOn: null, reason: 'never within 4000 days' }
}

/** Cost of surviving from the first unconsumed day through `target` inclusive. */
function required(kase, target) {
  const r = rebuild(kase)
  const daily = kase.usual_daily_units
  let date = nextDate(r.lastDate)
  let month = monthOf(date)
  let monthUnits = month === monthOf(r.lastDate) ? r.monthUnitsAtToday : 0
  let realEnergy = 0
  let units = 0
  let days = 0
  const months = []

  while (date <= target) {
    const m = monthOf(date)
    if (m !== month) {
      month = m
      monthUnits = 0
    }
    if (!months.includes(m)) months.push(m)
    realEnergy += energy(monthUnits, daily)
    monthUnits += daily
    units += daily
    days += 1
    date = nextDate(date)
  }

  const energyPart = units * BASE_RATE
  const higher = realEnergy - energyPart
  const fixed = months.length * FIXED
  const vat = Math.round((realEnergy * 5) / 100)
  const total = energyPart + higher + fixed + vat
  return {
    days,
    units,
    months,
    energyPart,
    higher,
    fixed,
    vat,
    total,
    deposit: Math.max(0, total - r.balance),
    balance: r.balance,
  }
}

const cases = PACK.cases ?? PACK
const only = process.argv[3]
const rows = []

for (const kase of cases) {
  if (only && kase.case_id !== only) continue
  const r = rebuild(kase)
  const outAfter = runOut(kase)
  const outToday = runOut(kase, { startOnToday: true })
  const req = required(kase, kase.target_date)
  const sums = req.energyPart + req.higher + req.fixed + req.vat === req.total
  rows.push({
    case: kase.case_id,
    balance: taka(r.balance),
    daily: kase.usual_daily_units,
    target: kase.target_date,
    runsOut_from_next_day: outAfter.runsOutOn ?? `none (${outAfter.reason})`,
    runsOut_from_today: outToday.runsOutOn ?? `none (${outToday.reason})`,
    days: req.days,
    energy: taka(req.energyPart),
    higher: taka(req.higher),
    fixed: taka(req.fixed),
    vat: taka(req.vat),
    total: taka(req.total),
    deposit: taka(req.deposit),
    partsSum: sums,
  })
}

console.table(rows)
console.log('\nparts reconcile on all cases:', rows.every((r) => r.partsSum))
console.log('cases:', rows.length)
