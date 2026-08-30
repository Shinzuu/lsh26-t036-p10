/**
 * The answer, before the evidence.
 *
 * A family opening this does not want a dashboard; they want three numbers —
 * what is left, when it runs out, and what to put in. Those sit at the top,
 * large, and everything below them is the working that justifies them.
 */
import NumberFlow from '@number-flow/react'
import { CalendarClock, Wallet, Zap } from 'lucide-react'
import { useCase } from '../lib/store.js'
import { formatBDT, projectRunOut, requiredRecharge } from '../lib/tariff.js'

const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const longDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—'

function Figure({ icon: Icon, label, children, hint, tone = 'default' }) {
  return (
    <div
      className={`min-w-0 rounded-card border p-4 ${
        tone === 'accent'
          ? 'border-accent/40 bg-accent-soft'
          : 'border-ink-300/60 bg-white dark:bg-ink-900/40'
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="font-meter mt-1 text-2xl font-semibold sm:text-3xl">
        {children}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export default function Hero() {
  const { kase, sim } = useCase()
  const last = sim?.rows?.at(-1)
  if (!kase || !last) return null

  const from = nextDay(kase.today)
  const sameMonth = from.slice(0, 7) === kase.today.slice(0, 7)
  const start = {
    fromDate: from,
    fromBalancePaisa: last.balancePaisa,
    monthUnitsBefore: sameMonth ? last.monthUnitsBefore + last.units : 0,
    dailyUnits: kase.usual_daily_units,
  }

  const runOut = projectRunOut(start)
  const needed = requiredRecharge({ ...start, targetDate: kase.target_date })

  return (
    <section aria-label="Where this household stands" className="grid gap-4 lg:grid-cols-5">
      {/* The meter reading itself, given the weight a meter has in the room. */}
      <div className="lg:col-span-3 rounded-card border border-ink-300/60 bg-white p-6 dark:bg-ink-900/40">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          <Wallet className="size-3.5" aria-hidden="true" />
          On the meter
        </p>
        <p className="font-meter mt-2 text-5xl font-semibold sm:text-6xl">
          <NumberFlow
            value={last.balancePaisa / 100}
            format={{ style: 'currency', currency: 'BDT', currencyDisplay: 'narrowSymbol' }}
            locale="en-GB"
          />
        </p>
        <p className="mt-2 text-sm text-ink-500">
          after {kase.days.length} days of readings, on {longDate(kase.today)}
        </p>

        <div className="rule my-4" />

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
          <span className="text-ink-500">
            Using{' '}
            <strong className="font-medium text-ink-900 dark:text-ink-50">
              {kase.usual_daily_units} units
            </strong>{' '}
            a day
          </span>
          <span className="text-ink-500">
            Last recharge{' '}
            <strong className="font-medium text-ink-900 dark:text-ink-50">
              {kase.recharges.length ? formatBDT(Math.round(parseFloat(kase.recharges.at(-1).amount_bdt) * 100)) : 'none'}
            </strong>
            {kase.recharges.length ? ` on ${longDate(kase.recharges.at(-1).date)}` : ''}
          </span>
        </div>
      </div>

      {/* The two things to act on, stacked beside it. */}
      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Figure
          icon={CalendarClock}
          label="Runs out"
          hint={
            runOut.runsOutOn
              ? `at ${kase.usual_daily_units} units a day, with no further recharge`
              : 'not within the projected period'
          }
        >
          {runOut.runsOutOn ? longDate(runOut.runsOutOn) : '—'}
        </Figure>

        <Figure
          icon={Zap}
          label="Recharge today"
          tone="accent"
          hint={`to last until ${longDate(kase.target_date)} — ${formatBDT(needed.totalPaisa)} of charges, less what is on the meter`}
        >
          <NumberFlow
            value={needed.netRequiredPaisa / 100}
            format={{ style: 'currency', currency: 'BDT', currencyDisplay: 'narrowSymbol' }}
            locale="en-GB"
          />
        </Figure>
      </div>
    </section>
  )
}
