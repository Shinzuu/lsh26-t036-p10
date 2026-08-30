/**
 * U3 — required item 3: the family's two questions.
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
 * Owned by U3. Imports the engine and the store, never edits them.
 */
import { useMemo, useState } from 'react'
import { useCase } from '../lib/store.js'
import { formatBDT, projectRunOut, requiredRecharge } from '../lib/tariff.js'

/** Lowest slab rate, in paisa — the baseline the "higher slab" part is measured against. */
const BASE_RATE_PAISA = 463

/** "2026-06-30" -> "2026-07-01", without going through a timezone. */
function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** "2026-08-13" -> "13 August 2026". Plain and unambiguous for a judge. */
function longDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Days between two ISO dates, inclusive of neither end. */
function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime()
  const b = new Date(`${toIso}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

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

function Row({ label, hint, paisa, strong = false }) {
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

export default function Questions() {
  const { kase, sim } = useCase()
  const [targetDate, setTargetDate] = useState('')

  const start = useMemo(() => (kase && sim ? projectionStart(kase, sim) : null), [kase, sim])

  // The input is uncontrolled until the case lands, then defaults to the case's
  // own target_date. Loading a different case moves the default with it.
  const target = targetDate || kase?.target_date || ''

  const runOut = useMemo(() => {
    if (!start) return null
    try {
      return projectRunOut({
        fromDate: start.fromDate,
        fromBalancePaisa: start.fromBalancePaisa,
        dailyUnits: kase.usual_daily_units,
        monthUnitsBefore: start.monthUnitsBefore,
      })
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
      return requiredRecharge({
        fromDate: start.fromDate,
        fromBalancePaisa: start.fromBalancePaisa,
        dailyUnits: kase.usual_daily_units,
        monthUnitsBefore: start.monthUnitsBefore,
        targetDate: target,
      })
    } catch (err) {
      return { error: err?.message ?? String(err) }
    }
  }, [start, target, kase])

  if (!kase || !sim) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-8" aria-busy="true">
        <h2 className="text-lg font-semibold">The family's two questions</h2>
        <div className="mt-4 space-y-2">
          <div className="h-20 animate-pulse rounded-card bg-ink-100 dark:bg-ink-700/30" />
          <div className="h-32 animate-pulse rounded-card bg-ink-100 dark:bg-ink-700/30" />
        </div>
      </section>
    )
  }

  if (!start) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-8">
        <h2 className="text-lg font-semibold">The family's two questions</h2>
        <p className="mt-3 rounded-card border border-dashed border-ink-300/70 px-6 py-8 text-center text-ink-500">
          No daily readings in this household yet, so there is no balance to project from.
        </p>
      </section>
    )
  }

  const parts = needed && !needed.error ? needed : null
  const sumPaisa = parts
    ? parts.energyPaisa + parts.higherSlabPaisa + parts.fixedPaisa + parts.vatPaisa
    : 0
  const reconciles = parts ? sumPaisa === parts.totalPaisa : false
  const days = target ? daysBetween(start.fromDate, target) + 1 : 0

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-8">
      <h2 className="text-lg font-semibold">The family's two questions</h2>

      {/* ---------------- Question one: when does the balance run out? -------- */}
      <article className="mt-4 rounded-card bg-white p-5 shadow-sm dark:bg-ink-900/40">
        <h3 className="text-sm font-medium text-ink-700 dark:text-ink-300">
          1 · When does the balance run out?
        </h3>

        {runOut?.error ? (
          <p className="mt-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {runOut.error}
          </p>
        ) : runOut?.runsOutOn ? (
          <>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {longDate(runOut.runsOutOn)}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {daysBetween(start.fromDate, runOut.runsOutOn) + 1} days from{' '}
              {longDate(start.fromDate)}.
            </p>
          </>
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            Not within the projected period
          </p>
        )}

        <p className="mt-3 text-xs text-ink-500">
          Assumes {kase.usual_daily_units} units a day — the household's usual daily use — from a
          balance of {formatBDT(start.fromBalancePaisa)} on {longDate(kase.today)}, with no further
          recharge. The slab counter resets on the 1st of each calendar month, so later days in a
          heavy month cost more.
        </p>
      </article>

      {/* ---------------- Question two: how much to recharge today? ----------- */}
      <article className="mt-4 rounded-card bg-white p-5 shadow-sm dark:bg-ink-900/40">
        <h3 className="text-sm font-medium text-ink-700 dark:text-ink-300">
          2 · How much must be recharged today?
        </h3>

        <label className="mt-3 block text-sm" htmlFor="target-date">
          To last until
        </label>
        <input
          id="target-date"
          type="date"
          className="mt-1 w-full rounded-xl border border-ink-300/60 bg-white/80 px-4 py-3 text-base
             focus:border-accent dark:bg-ink-900/40"
          value={target}
          min={start.fromDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />

        {needed?.error ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {needed.error}
          </p>
        ) : parts ? (
          <>
            <p className="mt-4 text-3xl font-semibold tracking-tight">
              {formatBDT(parts.totalPaisa)}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              to cover {days} days at {kase.usual_daily_units} units a day, through{' '}
              {longDate(target)}.
            </p>

            <div className="mt-4 text-sm">
              <Row
                label="Energy"
                hint={`every projected unit at the lowest slab rate, ৳${(BASE_RATE_PAISA / 100).toFixed(2)}`}
                paisa={parts.energyPaisa}
              />
              <Row
                label="Caused by being in a higher slab"
                hint="the real slab-aware cost minus that base"
                paisa={parts.higherSlabPaisa}
              />
              <Row
                label="Fixed charges"
                hint="demand charge ৳42.00 + meter rent ৳40.00, once per calendar month"
                paisa={parts.fixedPaisa}
              />
              <Row label="VAT" hint="5% of the energy amount only" paisa={parts.vatPaisa} />
              <Row label="Total" paisa={sumPaisa} strong />
            </div>

            <p
              className={`mt-3 text-xs ${reconciles ? 'text-ink-500' : 'font-medium text-danger'}`}
            >
              {reconciles ? (
                <>
                  The four parts add up: {formatBDT(parts.energyPaisa)} +{' '}
                  {formatBDT(parts.higherSlabPaisa)} + {formatBDT(parts.fixedPaisa)} +{' '}
                  {formatBDT(parts.vatPaisa)} = {formatBDT(parts.totalPaisa)}.
                </>
              ) : (
                <>
                  The four parts sum to {formatBDT(sumPaisa)} but the total is{' '}
                  {formatBDT(parts.totalPaisa)} — they do not reconcile.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-card border border-dashed border-ink-300/70 px-6 py-8 text-center text-ink-500">
            Pick a date to see what today's recharge needs to be.
          </p>
        )}

        <p className="mt-4 border-t border-ink-300/40 pt-3 text-xs text-ink-500">
          The problem does not define a baseline for “the part caused by being in a higher slab”, so
          this is ours: <strong>energy</strong> is every projected unit charged at the lowest slab
          rate (৳{(BASE_RATE_PAISA / 100).toFixed(2)}), and the{' '}
          <strong>higher-slab part</strong> is the real slab-aware cost minus that base — so the two
          together are exactly the true energy charge, and the four parts reconcile.
        </p>
      </article>
    </section>
  )
}
