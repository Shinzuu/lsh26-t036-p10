/**
 * Bonus features 1 and 3, in one panel.
 *
 *   "Show one month's bill broken into energy, demand charge, meter rent and VAT."
 *   "Warn the user when the month's running total is close to the next slab and
 *    show what the next unit will cost after it crosses."
 *
 * Both are the same question asked at two scales — what did this month cost, and
 * what is the next unit about to cost — so they share a panel and a month.
 *
 * Every figure is summed from the simulation's own rows. Nothing is recomputed
 * here, so the bill cannot drift from the balance line above it.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Receipt } from 'lucide-react'
import { useCase } from '../lib/store.js'
import { formatBDT, SLABS, DEMAND_CHARGE_PAISA, METER_RENT_PAISA } from '../lib/tariff.js'

const monthOf = (iso) => iso.slice(0, 7)

const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** Units left in the band the month is currently in, and what comes after it. */
function slabPosition(units) {
  let floor = 0
  for (const band of SLABS) {
    if (units < band.upTo) {
      const next = SLABS[SLABS.indexOf(band) + 1]
      return {
        rate: band.paisaPerUnit,
        unitsToNext: band.upTo === Infinity ? null : band.upTo - units,
        nextRate: next ? next.paisaPerUnit : null,
        bandFrom: floor,
        bandTo: band.upTo,
      }
    }
    floor = band.upTo
  }
  return { rate: SLABS.at(-1).paisaPerUnit, unitsToNext: null, nextRate: null }
}

function Line({ label, hint, paisa, strong = false }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        strong ? 'border-t border-ink-300/60 font-semibold' : ''
      }`}
    >
      <span className="min-w-0">
        <span className={strong ? '' : 'text-ink-700 dark:text-ink-300'}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{formatBDT(paisa)}</span>
    </div>
  )
}

export default function MonthBill() {
  const { kase, sim } = useCase()
  const rows = sim?.rows ?? []

  const months = useMemo(() => [...new Set(rows.map((r) => monthOf(r.date)))], [rows])
  const [picked, setPicked] = useState(null)
  const month = picked && months.includes(picked) ? picked : months.at(-1)

  const bill = useMemo(() => {
    if (!month) return null
    const inMonth = rows.filter((r) => monthOf(r.date) === month)
    const energy = inMonth.reduce((s, r) => s + r.energyPaisa, 0)
    const vat = inMonth.reduce((s, r) => s + r.vatPaisa, 0)
    const fixed = inMonth.reduce((s, r) => s + r.fixedPaisa, 0)
    const recharged = inMonth.reduce((s, r) => s + r.rechargePaisa, 0)
    const units = inMonth.reduce((s, r) => s + r.units, 0)
    const chargedMonth = fixed > 0
    return {
      inMonth,
      units,
      energy,
      vat,
      fixed,
      recharged,
      chargedMonth,
      total: energy + vat + fixed,
      opening: inMonth[0] ? inMonth[0].balancePaisa - inMonth[0].rechargePaisa + inMonth[0].fixedPaisa + inMonth[0].energyPaisa + inMonth[0].vatPaisa : 0,
      closing: inMonth.at(-1)?.balancePaisa ?? 0,
    }
  }, [rows, month])

  if (!kase || !bill) return null

  // The warning reads off the LAST day of the chosen month — for the current
  // month that is where the meter actually stands.
  const pos = slabPosition(bill.units)
  const closeToNext = pos.unitsToNext !== null && pos.unitsToNext <= 40

  return (
    <section aria-labelledby="month-bill-heading" className="w-full">
      <div className="rounded-card border border-ink-300/60 bg-white p-5 shadow-sm dark:bg-ink-900/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="month-bill-heading"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <Receipt className="size-5 text-accent" aria-hidden="true" />
              One month&rsquo;s bill
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              What {monthLabel(month)} actually cost the meter, split the way the tariff
              charges it.
            </p>
          </div>
          <label className="text-sm">
            <span className="sr-only">Month</span>
            <select
              className="rounded-xl border border-ink-300/70 bg-white px-3 py-2 text-sm font-medium focus:border-accent dark:bg-ink-900/40"
              value={month}
              onChange={(e) => setPicked(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 text-sm">
          <Line
            label="Energy"
            hint={`${bill.units.toLocaleString('en-GB')} units, each charged at the slab the month had reached`}
            paisa={bill.energy}
          />
          <Line
            label="Demand charge"
            hint={bill.chargedMonth ? 'once this month, on its first recharge' : 'not charged — no recharge this month'}
            paisa={bill.chargedMonth ? DEMAND_CHARGE_PAISA : 0}
          />
          <Line
            label="Meter rent"
            hint={bill.chargedMonth ? 'once this month, on its first recharge' : 'not charged — no recharge this month'}
            paisa={bill.chargedMonth ? METER_RENT_PAISA : 0}
          />
          <Line label="VAT" hint="5% of the energy amount only" paisa={bill.vat} />
          <Line label={`Total for ${monthLabel(month)}`} paisa={bill.total} strong />
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Recharged this month: {formatBDT(bill.recharged)} · balance at the end of the month{' '}
          {formatBDT(bill.closing)}.
        </p>

        {/* Bonus: the slab warning. */}
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            closeToNext ? 'border-sand bg-sand-soft' : 'border-ink-300/60'
          }`}
        >
          <p className="flex items-start gap-2">
            {closeToNext && (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ink-900 dark:text-ink-50" aria-hidden="true" />
            )}
            <span>
              {pos.unitsToNext === null ? (
                <>
                  {monthLabel(month)} is in the top band at{' '}
                  <strong className="font-medium">{formatBDT(pos.rate)}</strong> a unit. There is
                  no higher slab — the rate stays here until the 1st, when the counter resets to{' '}
                  <strong className="font-medium">{formatBDT(SLABS[0].paisaPerUnit)}</strong>.
                </>
              ) : closeToNext ? (
                <>
                  Only{' '}
                  <strong className="font-medium">
                    {pos.unitsToNext} {pos.unitsToNext === 1 ? 'unit' : 'units'}
                  </strong>{' '}
                  left in this slab. They cost{' '}
                  <strong className="font-medium">{formatBDT(pos.rate)}</strong> each; the unit
                  after them costs{' '}
                  <strong className="font-medium">{formatBDT(pos.nextRate)}</strong> —{' '}
                  {formatBDT(pos.nextRate - pos.rate)} more, and it stays there until the 1st.
                </>
              ) : (
                <>
                  {monthLabel(month)} used {bill.units.toLocaleString('en-GB')} units and ended
                  at <strong className="font-medium">{formatBDT(pos.rate)}</strong> a unit.
                  There are {pos.unitsToNext} units left in that slab before the rate steps up
                  to <strong className="font-medium">{formatBDT(pos.nextRate)}</strong>.
                </>
              )}
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
