/**
 * "Set up my meter" — the path a real household takes.
 *
 * A family does not have a JSON file. They have a meter that shows a balance, a
 * rough idea of what they use in a day, and a handful of recharge receipts or
 * SMS confirmations. That is exactly what this form asks for, and it builds the
 * daily series from the daily-use figure the problem statement already treats as
 * known.
 *
 * The readings it produces are estimated, not measured, and the form says so —
 * a tool that quietly presents an estimate as a meter reading would be lying to
 * the person who most needs the number.
 */
import { useState } from 'react'
import { Plus, Trash2, Gauge } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)

function monthsBack(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - n)
  d.setUTCDate(1)
  return d.toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

const money = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2)

/**
 * Build a case in the organizers' shape from what a household actually knows.
 * Readings run from the first of the earliest month through `asOf`, at the
 * stated daily use, with a mild weekday/weekend shape so the months are not
 * artificially identical.
 */
function buildCase({ name, asOf, months, dailyUnits, openingBalance, recharges, targetDate }) {
  const start = monthsBack(asOf, months - 1)
  const days = []
  for (let d = start; d <= asOf; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
    const weekend = dow === 5 || dow === 6
    days.push({ date: d, units: Math.max(0, Math.round(dailyUnits * (weekend ? 1.15 : 0.95))) })
  }
  const monthKeys = [...new Set(days.map((d) => d.date.slice(0, 7)))]
  const lastThree = monthKeys.slice(-3)

  return {
    case_id: name.trim() || 'My meter',
    opening_balance_bdt: money(openingBalance),
    days,
    recharges: recharges
      .filter((r) => r.date && Number(r.amount) > 0)
      .map((r) => ({ date: r.date, amount_bdt: money(r.amount) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    today: asOf,
    usual_daily_units: Math.max(0, Math.round(dailyUnits)),
    target_date: targetDate,
    comparison: {
      months: lastThree,
      source: 'readings',
      daily_units: null,
      opening_balance_bdt: '0.00',
      low_threshold_bdt: '200.00',
      low_amount_bdt: money(Math.max(500, dailyUnits * 30 * 6)),
      monthly_amount_bdt: money(Math.max(500, dailyUnits * 30 * 5)),
    },
  }
}

export default function MeterSetup({ onLoad, onCancel }) {
  const asOfDefault = today()
  const [name, setName] = useState('')
  const [asOf, setAsOf] = useState(asOfDefault)
  const [months, setMonths] = useState(6)
  const [dailyUnits, setDailyUnits] = useState(12)
  const [openingBalance, setOpeningBalance] = useState(300)
  const [targetDate, setTargetDate] = useState(addMonths(asOfDefault, 1))
  const [recharges, setRecharges] = useState([{ date: '', amount: '' }])
  const [problem, setProblem] = useState(null)

  const setRow = (i, patch) =>
    setRecharges((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function submit(e) {
    e.preventDefault()
    if (!(Number(dailyUnits) > 0)) return setProblem('Enter how many units you use on a typical day.')
    if (targetDate <= asOf) return setProblem('The date you want to last until must be after today.')
    try {
      onLoad(buildCase({ name, asOf, months: Number(months), dailyUnits: Number(dailyUnits), openingBalance, recharges, targetDate }))
    } catch (err) {
      setProblem(err.message)
    }
  }

  const field = 'mt-1 w-full rounded-xl border border-ink-300/70 bg-white px-3 py-2 text-sm focus:border-accent dark:bg-ink-900/40'

  return (
    <form
      onSubmit={submit}
      className="rounded-card border border-ink-300/60 bg-white p-5 shadow-sm dark:bg-ink-900/40"
      aria-labelledby="meter-setup-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="meter-setup-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Gauge className="size-5 text-accent" aria-hidden="true" />
            Set up your meter
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            No file needed. Tell us what your meter shows and roughly what you use, add the
            recharges you remember, and we rebuild the rest on the published tariff.
          </p>
        </div>
        {onCancel && (
          <button type="button" className="shrink-0 text-sm text-ink-500 underline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">Name this meter</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Home, Mirpur flat…" />
        </label>

        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">Balance when you started tracking</span>
          <input className={field} type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          <span className="mt-1 block text-xs text-ink-500">taka on the meter before the first day</span>
        </label>

        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">Units on a typical day</span>
          <input className={field} type="number" min="1" step="1" value={dailyUnits} onChange={(e) => setDailyUnits(e.target.value)} />
          <span className="mt-1 block text-xs text-ink-500">a small flat is 8–15, a family house 20–35</span>
        </label>

        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">History to build</span>
          <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
            {[6, 7, 8, 9, 12].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">Reading up to</span>
          <input className={field} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>

        <label className="text-sm">
          <span className="text-ink-700 dark:text-ink-300">You want it to last until</span>
          <input className={field} type="date" value={targetDate} min={asOf} onChange={(e) => setTargetDate(e.target.value)} />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Recharges you remember</legend>
        <p className="mt-1 text-xs text-ink-500">
          From your receipts or the meter&rsquo;s SMS. Leave it empty if you cannot recall any —
          the rebuild still works, the balance simply falls the whole way.
        </p>
        <div className="mt-2 space-y-2">
          {recharges.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">Recharge {i + 1} date</span>
                <input className={field} type="date" value={r.date} max={asOf} onChange={(e) => setRow(i, { date: e.target.value })} />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">Recharge {i + 1} amount in taka</span>
                <input className={field} type="number" min="0" step="1" placeholder="Amount ৳" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              </label>
              <button
                type="button"
                className="rounded-xl border border-ink-300/70 p-2 text-ink-500 hover:text-danger"
                onClick={() => setRecharges((rows) => rows.filter((_, j) => j !== i))}
                aria-label={`Remove recharge ${i + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-ink-300/70 px-3 py-1.5 text-sm font-medium"
          onClick={() => setRecharges((rows) => [...rows, { date: '', amount: '' }])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a recharge
        </button>
      </fieldset>

      {problem && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white">
          Rebuild my balance
        </button>
        <p className="text-xs text-ink-500">
          Daily readings are estimated from the figure you gave, not measured. The tariff,
          the slab reset and the monthly charges are exact.
        </p>
      </div>
    </form>
  )
}
