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
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
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
    <section aria-label="Where this household stands" className="grid gap-3 sm:grid-cols-3">
      <Figure
        icon={Wallet}
        label="On the meter"
        hint={`after ${kase.days.length} days of readings, on ${longDate(kase.today)}`}
      >
        <NumberFlow
          value={last.balancePaisa / 100}
          format={{ style: 'currency', currency: 'BDT', currencyDisplay: 'narrowSymbol' }}
          locale="en-GB"
        />
      </Figure>

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
    </section>
  )
}
