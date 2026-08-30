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
 * here, so the bill cannot drift from the balance line.
 *
 * The month is a row of chips rather than a dropdown: six months fit on one line,
 * one tap changes the bill, and the chip you are on is visible without opening
 * anything. The slab position is the same ladder the balance step draws, so the
 * two panels teach the rule with one picture.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Receipt } from 'lucide-react'
import { useDisplay, Money } from '../lib/display.jsx'
import { useCase } from '../lib/store.js'
import { useReveal } from '../lib/useReveal.js'
import { SLABS, DEMAND_CHARGE_PAISA, METER_RENT_PAISA, VAT_PERCENT, monthOf } from '../lib/tariff.js'
import { monthLabel, monthShort, plural } from '../lib/format.js'
import { SlabLadder } from './BalanceChart.jsx'

/** Units left in the band the month is currently in, and what comes after it. */
function slabPosition(units) {
  for (let i = 0; i < SLABS.length; i++) {
    const band = SLABS[i]
    if (units < band.upTo) {
      const next = SLABS[i + 1]
      return {
        rate: band.paisaPerUnit,
        unitsToNext: band.upTo === Infinity ? null : band.upTo - units,
        nextRate: next ? next.paisaPerUnit : null,
      }
    }
  }
  return { rate: SLABS.at(-1).paisaPerUnit, unitsToNext: null, nextRate: null }
}

function Line({ label, hint, paisa, strong = false }) {
  const { money } = useDisplay()
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        strong ? 'border-t border-ink-300/60 font-semibold' : ''
      }`}
    >
      <span className="min-w-0">
        <span className={strong ? '' : 'text-ink-700 dark:text-ink-300'}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs font-normal text-ink-500">{hint}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{money(paisa)}</span>
    </div>
  )
}

export default function MonthBill() {
  const { money, number } = useDisplay()
  const { kase, sim } = useCase()
  const { ref, shown } = useReveal()
  const rows = sim?.rows ?? []

  const months = useMemo(() => [...new Set(rows.map((r) => monthOf(r.date)))], [rows])
  const [picked, setPicked] = useState(null)
  const month = picked && months.includes(picked) ? picked : months.at(-1)

  const bill = useMemo(() => {
    if (!month) return null
    const inMonth = rows.filter((r) => monthOf(r.date) === month)
    const sum = (k) => inMonth.reduce((s, r) => s + r[k], 0)
    const energy = sum('energyPaisa')
    const vat = sum('vatPaisa')
    const fixed = sum('fixedPaisa')
    return {
      units: sum('units'),
      energy,
      vat,
      fixed,
      recharged: sum('rechargePaisa'),
      chargedMonth: fixed > 0,
      total: energy + vat + fixed,
      closing: inMonth.at(-1)?.balancePaisa ?? 0,
      days: inMonth.length,
    }
  }, [rows, month])

  if (!kase || !bill) return null

  // The warning reads off the LAST day of the chosen month — for the current
  // month that is where the meter actually stands.
  const pos = slabPosition(bill.units)
  const closeToNext = pos.unitsToNext !== null && pos.unitsToNext <= 40

  return (
    <section
      ref={ref}
      aria-labelledby="month-bill-heading"
      className={`w-full rounded-card border border-ink-300/60 bg-white p-5 dark:bg-ink-900/40 reveal ${
        shown ? 'reveal-in' : ''
      }`}
    >
      <h2 id="month-bill-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Receipt className="size-5 text-accent" aria-hidden="true" />
        One month&rsquo;s bill
      </h2>

      {/* Month chips. One row, one tap, and the current one is always visible. */}
      <div role="group" aria-label="Month" className="mt-3 flex flex-wrap gap-1.5">
        {months.map((m) => {
          const active = m === month
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => setPicked(m)}
              className={`min-h-11 rounded-full border px-3 text-sm font-medium sm:min-h-0 sm:py-1.5 ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-ink-300/60 text-ink-700 hover:border-accent/60 hover:text-accent dark:text-ink-300'
              }`}
            >
              {monthShort(m)}
            </button>
          )
        })}
      </div>

      <div aria-live="polite">
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            <Money paisa={bill.total} />
          </span>
          <span className="text-sm text-ink-500">
            {monthLabel(month)} · {plural(bill.units, 'unit', number)} over {plural(bill.days, 'day', number)}
          </span>
        </p>

        <div className="mt-3 text-sm">
          <Line
            label="Energy"
            hint={`${number(bill.units)} units, each at the slab the month had reached`}
            paisa={bill.energy}
          />
          <Line
            label="Demand charge"
            hint={bill.chargedMonth ? 'once, on the first recharge' : 'not charged — no recharge this month'}
            paisa={bill.chargedMonth ? DEMAND_CHARGE_PAISA : 0}
          />
          <Line
            label="Meter rent"
            hint={bill.chargedMonth ? 'once, on the first recharge' : 'not charged — no recharge this month'}
            paisa={bill.chargedMonth ? METER_RENT_PAISA : 0}
          />
          <Line label="VAT" hint={`${VAT_PERCENT}% of energy only`} paisa={bill.vat} />
          <Line label={`Total for ${monthLabel(month)}`} paisa={bill.total} strong />
        </div>

        <p className="mt-2 text-xs text-ink-500">
          Recharged {money(bill.recharged)} · {money(bill.closing)} left at month end.
        </p>
      </div>

      {/* Bonus: the slab warning, on the same ladder the balance step draws. */}
      <div
        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          closeToNext ? 'border-sand bg-sand-soft text-ink-900 dark:text-ink-50' : 'border-ink-300/60'
        }`}
      >
        <p className="flex items-start gap-2">
          {closeToNext && (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {pos.unitsToNext === null ? (
              <>
                In the top band at <strong className="font-medium">{money(pos.rate)}</strong> a unit.
                No higher slab — it stays here until the 1st, when the counter resets to{' '}
                <strong className="font-medium">{money(SLABS[0].paisaPerUnit)}</strong>.
              </>
            ) : closeToNext ? (
              <>
                Only <strong className="font-medium">{plural(pos.unitsToNext, 'unit', number)}</strong>{' '}
                left at <strong className="font-medium">{money(pos.rate)}</strong>. The unit after
                them costs <strong className="font-medium">{money(pos.nextRate)}</strong> —{' '}
                {money(pos.nextRate - pos.rate)} more, until the 1st.
              </>
            ) : (
              <>
                At <strong className="font-medium">{money(pos.rate)}</strong> a unit, with{' '}
                {number(pos.unitsToNext)} units left before the rate steps up to{' '}
                <strong className="font-medium">{money(pos.nextRate)}</strong>.
              </>
            )}
          </span>
        </p>
        <SlabLadder unitsBefore={bill.units} unitsAfter={bill.units} month={month} compact />
      </div>
    </section>
  )
}
