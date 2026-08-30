/**
 * The answer, before the evidence.
 *
 * A family opening this does not want a dashboard; they want three numbers —
 * what is left, when it runs out, and what to put in. Those sit at the top,
 * large, and everything below them is the working that justifies them.
 *
 * Each figure is a link into the step that shows its working. The step lives in
 * the address hash and the shell listens for `hashchange`, so a plain anchor is
 * the whole navigation — no prop, no callback, and it works with a keyboard and
 * with the browser's Back button for free.
 */
import { ArrowRight, CalendarClock, Wallet, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useDisplay, Money } from '../lib/display.jsx'
import { useCase } from '../lib/store.js'
import { useReveal } from '../lib/useReveal.js'
import { projectRunOut, requiredRecharge, toPaisa } from '../lib/tariff.js'
import { longDate, nextDay, plural, daysBetween } from '../lib/format.js'

/** One headline figure, as a card that goes somewhere. */
function Figure({ href, icon: Icon, label, children, hint, tone = 'default', big = false }) {
  const accent = tone === 'accent'
  return (
    <a
      href={href}
      className={`lift group flex min-w-0 flex-col justify-between rounded-card border p-4 no-underline ${
        accent
          ? 'border-accent/40 bg-accent-soft text-ink-900 dark:text-ink-50'
          : 'border-ink-300/60 bg-white text-ink-900 dark:bg-ink-900/40 dark:text-ink-50'
      } ${big ? 'sm:p-6' : ''}`}
    >
      <p className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <ArrowRight
          className="size-3.5 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
          aria-hidden="true"
        />
      </p>
      <p className={`font-meter mt-2 font-semibold ${big ? 'text-5xl sm:text-6xl' : 'text-2xl sm:text-3xl'}`}>
        {children}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
    </a>
  )
}

export default function Hero() {
  const { money, number } = useDisplay()
  const { kase, sim } = useCase()
  const { ref, shown } = useReveal()
  const last = sim?.rows?.at(-1) ?? null

  // Hooks first, every render, whether or not there is a case — an early
  // return above a hook changes the hook count between renders.
  const start = useMemo(() => {
    if (!kase || !last) return null
    const from = nextDay(kase.today)
    const sameMonth = from.slice(0, 7) === kase.today.slice(0, 7)
    return {
      fromDate: from,
      fromBalancePaisa: last.balancePaisa,
      monthUnitsBefore: sameMonth ? last.monthUnitsBefore + last.units : 0,
      dailyUnits: kase.usual_daily_units,
    }
  }, [kase, last])

  const runOut = useMemo(() => (start ? projectRunOut(start) : null), [start])
  const needed = useMemo(
    () => (start ? requiredRecharge({ ...start, targetDate: kase.target_date }) : null),
    [start, kase],
  )

  if (!kase || !last || !start) return null

  const lastRecharge = kase.recharges?.at(-1)
  const daysLeft = runOut?.runsOutOn ? daysBetween(start.fromDate, runOut.runsOutOn) + 1 : null
  const low = daysLeft !== null && daysLeft <= 7

  return (
    <section
      ref={ref}
      aria-label="Where this household stands"
      className={`grid gap-4 lg:grid-cols-5 reveal ${shown ? 'reveal-in' : ''}`}
    >
      {/* The meter reading itself, given the weight a meter has in the room. */}
      <div className="lg:col-span-3">
        <Figure
          href="#balance"
          icon={Wallet}
          label="On the meter"
          big
          hint={
            <>
              as of {longDate(kase.today)} · using {number(kase.usual_daily_units)} units a day
              {lastRecharge && (
                <>
                  {' '}· last recharge {money(toPaisa(lastRecharge.amount_bdt))} on{' '}
                  {longDate(lastRecharge.date)}
                </>
              )}
            </>
          }
        >
          <Money paisa={last.balancePaisa} />
        </Figure>
      </div>

      {/* The two things to act on, beside it. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
        <Figure
          href="#questions"
          icon={CalendarClock}
          label="Runs out"
          tone={low ? 'accent' : 'default'}
          hint={
            runOut?.runsOutOn
              ? `in ${plural(daysLeft, 'day', number)} at the usual daily use, with no recharge`
              : 'not within the projected period'
          }
        >
          {runOut?.runsOutOn ? longDate(runOut.runsOutOn) : '—'}
        </Figure>

        <Figure
          href="#questions"
          icon={Zap}
          label="Recharge today"
          tone="accent"
          hint={`to last until ${longDate(kase.target_date)}`}
        >
          <Money paisa={needed?.netRequiredPaisa ?? 0} />
        </Figure>
      </div>
    </section>
  )
}
