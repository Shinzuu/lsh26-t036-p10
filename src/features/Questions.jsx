/**
 * Required item 3 — the family's two questions.
 *
 *   1. Given today's balance and their usual daily use, on which date does the
 *      balance run out?
 *   2. To last until a date the user picks, how much must be recharged today —
 *      broken into energy, the part caused by being in a higher slab, fixed
 *      charges and VAT, with the four parts visibly adding up to the total.
 *
 * The projection starts on the day AFTER `today`, because `today` is the last
 * reading date and its units are already consumed in the simulation. The slab
 * counter carries on inside the same calendar month and resets on the 1st, so
 * `monthUnitsBefore` is the month's running total through `today` when the next
 * day is still in that month, and zero when it is not.
 *
 * Each fact is stated once. The answer leads; the one assumption it rests on
 * sits under it in a line; the definition the problem leaves open — what "the
 * part caused by being in a higher slab" is measured against — is the single
 * collapsed note, because the spec requires it on screen and nothing else here
 * needs a paragraph.
 */
import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useDisplay, Money } from '../lib/display.jsx'
import { useCase } from '../lib/store.js'
import { useReveal } from '../lib/useReveal.js'
import {
  projectRunOut,
  requiredRecharge,
  BASE_PAISA_PER_UNIT,
  DEMAND_CHARGE_PAISA,
  METER_RENT_PAISA,
  VAT_PERCENT,
} from '../lib/tariff.js'
import { addDays, daysBetween, endOfMonth, longDate, nextDay, plural } from '../lib/format.js'
import Tooltip from './ui/Tooltip.jsx'
import Explainer from './Explainer.jsx'

/**
 * Where the forward projection starts: the first unconsumed day, the balance at
 * that moment, and the calendar month's running total it inherits.
 */
function projectionStart(kase, sim) {
  const rows = sim?.rows ?? []
  const last = rows[rows.length - 1]
  if (!last) return null
  const fromDate = nextDay(kase.today)
  const sameMonth = fromDate.slice(0, 7) === kase.today.slice(0, 7)
  return {
    fromDate,
    fromBalancePaisa: last.balancePaisa,
    // The month's total through today; zero once the 1st rolls the counter over.
    monthUnitsBefore: sameMonth ? last.monthUnitsBefore + last.units : 0,
  }
}

/** Quick targets. Changing the date is the interaction the item is judged on. */
function presets(fromDate, caseTarget) {
  const list = [
    { key: 'case', label: 'Case target', date: caseTarget },
    { key: 'eom', label: 'End of month', date: endOfMonth(fromDate) },
    { key: '30', label: '+30 days', date: addDays(fromDate, 29) },
    { key: '60', label: '+60 days', date: addDays(fromDate, 59) },
    { key: '90', label: '+90 days', date: addDays(fromDate, 89) },
  ]
  // Drop any preset that lands before the projection can start, and any
  // duplicate date, so two chips never mean the same thing.
  const seen = new Set()
  return list.filter((p) => {
    if (!p.date || daysBetween(fromDate, p.date) < 0 || seen.has(p.date)) return false
    seen.add(p.date)
    return true
  })
}

function Row({ label, hint, paisa, strong = false, check = null }) {
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
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        {check === true && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok">
            <Check className="size-3" aria-hidden="true" />
            adds up
          </span>
        )}
        {check === false && (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
            does not add up
          </span>
        )}
        {money(paisa)}
      </span>
    </div>
  )
}

const dotted = 'underline decoration-dotted decoration-ink-300 underline-offset-2'

export default function Questions() {
  const { money, number } = useDisplay()
  const { kase, sim } = useCase()
  const { ref, shown } = useReveal()
  const [targetDate, setTargetDate] = useState(null)
  // A date typed for one household is meaningless for the next, so loading a
  // different case drops it and the field falls back to that case's own target.
  const [targetFor, setTargetFor] = useState(null)
  if (kase && targetFor !== kase.case_id) {
    setTargetFor(kase.case_id)
    if (targetDate !== null) setTargetDate(null)
  }

  const start = useMemo(() => (kase && sim ? projectionStart(kase, sim) : null), [kase, sim])
  const target = targetDate ?? kase?.target_date ?? ''

  const runOut = useMemo(() => {
    if (!start) return null
    try {
      return projectRunOut({ ...start, dailyUnits: kase.usual_daily_units })
    } catch (err) {
      return { error: err?.message ?? String(err) }
    }
  }, [start, kase])

  const needed = useMemo(() => {
    if (!start || !target) return null
    if (daysBetween(start.fromDate, target) < 0) {
      return { error: `Pick a date on or after ${longDate(start.fromDate)}.` }
    }
    try {
      return requiredRecharge({ ...start, dailyUnits: kase.usual_daily_units, targetDate: target })
    } catch (err) {
      return { error: err?.message ?? String(err) }
    }
  }, [start, target, kase])

  const chips = useMemo(
    () => (start && kase ? presets(start.fromDate, kase.target_date) : []),
    [start, kase],
  )

  if (!kase || !sim) {
    return (
      <Frame aria-busy="true">
        <div className="mt-4 space-y-2">
          <div className="h-20 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-700/30" />
          <div className="h-32 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-700/30" />
        </div>
      </Frame>
    )
  }

  if (!start) {
    return (
      <Frame>
        <p className="mt-3 rounded-xl border border-dashed border-ink-300/70 px-6 py-8 text-center text-ink-500">
          No daily readings in this household yet, so there is no balance to project from.
        </p>
      </Frame>
    )
  }

  const parts = needed && !needed.error ? needed : null
  const sumPaisa = parts
    ? parts.energyPaisa + parts.higherSlabPaisa + parts.fixedPaisa + parts.vatPaisa
    : 0
  const reconciles = parts ? sumPaisa === parts.totalPaisa : null
  const daysLeft = runOut?.runsOutOn ? daysBetween(start.fromDate, runOut.runsOutOn) + 1 : null

  return (
    <Frame reveal={{ ref, shown }}>
      {/* ---------------- Question one: when does the balance run out? -------- */}
      <article className="mt-4">
        <h3 className="text-sm font-medium text-ink-700 dark:text-ink-300">
          1 · When does the balance run out?
        </h3>

        <div aria-live="polite">
          {runOut?.error ? (
            <p className="mt-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{runOut.error}</p>
          ) : runOut?.runsOutOn ? (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tracking-tight">{longDate(runOut.runsOutOn)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  daysLeft <= 7 ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'
                }`}
              >
                {plural(daysLeft, 'day', number)} away
              </span>
            </p>
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight">Not within the projected period</p>
          )}
        </div>

        {/* The one assumption the answer rests on, and nothing else. */}
        <p className="mt-2 text-xs text-ink-500">
          At {number(kase.usual_daily_units)} units a day from the {money(start.fromBalancePaisa)} on the
          meter, with no further recharge.
        </p>
      </article>

      {/* ---------------- Question two: how much to recharge today? ----------- */}
      <article className="mt-6 border-t border-ink-300/50 pt-5">
        <h3 className="text-sm font-medium text-ink-700 dark:text-ink-300">
          2 · How much must be recharged today?
        </h3>

        <p className="mt-3 text-sm" id="target-date-label">
          To last until
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            id="target-date"
            aria-labelledby="target-date-label"
            type="date"
            className="min-h-11 rounded-xl border border-ink-300/60 bg-white/80 px-3 text-base focus:border-accent dark:bg-ink-900/40 sm:min-h-0 sm:py-2"
            value={target}
            min={start.fromDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <div role="group" aria-label="Quick targets" className="flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const active = c.date === target
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTargetDate(c.date)}
                  className={`min-h-11 rounded-full border px-3 text-xs font-medium sm:min-h-0 sm:py-1.5 ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-ink-300/60 text-ink-700 hover:border-accent/60 hover:text-accent dark:text-ink-300'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div aria-live="polite">
          {needed?.error ? (
            <p className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{needed.error}</p>
          ) : parts ? (
            <>
              <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                <Money paisa={parts.netRequiredPaisa} />
              </p>
              <p className="mt-1 text-sm text-ink-500">
                for {plural(parts.days, 'day', number)} through {longDate(target)}, after the{' '}
                {money(start.fromBalancePaisa)} already on the meter.
              </p>
              {parts.capped && (
                <p className="mt-2 rounded-xl bg-accent-soft px-4 py-2 text-xs text-accent">
                  That date is further out than this tool projects. The figure covers the first{' '}
                  {plural(parts.cappedDays, 'day', number)} — about fifty years — which is as far as a
                  daily projection stays meaningful.
                </p>
              )}

              <div className="mt-4 text-sm">
                <Row
                  label={
                    <Tooltip label={`Every projected unit priced at the lowest slab rate, ${money(BASE_PAISA_PER_UNIT)} a unit.`}>
                      <span className={dotted}>Energy</span>
                    </Tooltip>
                  }
                  paisa={parts.energyPaisa}
                />
                <Row
                  label={
                    <Tooltip label="The real slab-aware cost minus that lowest-rate base. Together the two are exactly the true energy charge.">
                      <span className={dotted}>Caused by being in a higher slab</span>
                    </Tooltip>
                  }
                  paisa={parts.higherSlabPaisa}
                />
                <Row
                  label={
                    <Tooltip label={`Demand charge ${money(DEMAND_CHARGE_PAISA)} + meter rent ${money(METER_RENT_PAISA)}, once per calendar month the projection spans.`}>
                      <span className={dotted}>Fixed charges</span>
                    </Tooltip>
                  }
                  paisa={parts.fixedPaisa}
                />
                <Row
                  label={
                    <Tooltip label={`${VAT_PERCENT}% of the energy amount only — never of the fixed charges.`}>
                      <span className={dotted}>VAT</span>
                    </Tooltip>
                  }
                  paisa={parts.vatPaisa}
                />
                {/* The four parts must visibly add up. The check sits on the total
                    row itself, so it cannot drift from the figures it certifies. */}
                <Row label="Cost of those days" paisa={parts.totalPaisa} strong check={reconciles} />
                <Row label="Already on the meter" paisa={-start.fromBalancePaisa} />
                <Row label="Recharge today" paisa={parts.netRequiredPaisa} strong />
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-ink-300/70 px-6 py-8 text-center text-ink-500">
              Pick a date to see what today&rsquo;s recharge needs to be.
            </p>
          )}
        </div>

        {parts && (
          <Explainer label="How the four parts are defined">
            The problem does not define a baseline for &ldquo;the part caused by being in a higher
            slab&rdquo;, so this is ours: <strong>energy</strong> is every projected unit charged at
            the lowest slab rate ({money(BASE_PAISA_PER_UNIT)}), and the{' '}
            <strong>higher-slab part</strong> is the real slab-aware cost minus that base — so the two
            together are exactly the true energy charge, and the four parts reconcile. The slab
            counter resets on the 1st of each calendar month, so a target further into a heavy month
            costs more per day than one early in it.
          </Explainer>
        )}
      </article>
    </Frame>
  )
}

function Frame({ children, reveal, ...rest }) {
  return (
    <section
      ref={reveal?.ref}
      {...rest}
      className={`w-full rounded-card border border-ink-300/60 bg-white p-5 dark:bg-ink-900/40 ${
        reveal ? `reveal ${reveal.shown ? 'reveal-in' : ''}` : ''
      }`}
    >
      <h2 className="text-lg font-semibold tracking-tight">The family&rsquo;s two questions</h2>
      {children}
    </section>
  )
}
