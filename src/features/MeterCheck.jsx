/**
 * Bonus feature 2 — "let the user paste their real recharge history and compare
 * the rebuilt balance against what the meter actually showed."
 *
 * The honest version of this is a reconciliation, not a demo. A household types
 * what the meter read on a few dates they remember; we put our rebuilt figure
 * next to it and show the gap. A gap is not automatically our error — it is
 * usually a recharge they forgot or a heavier week than their stated daily use —
 * so the panel says which direction it points rather than pretending to a
 * verdict it cannot support.
 */
import { useMemo, useState } from 'react'
import { Plus, ScanLine, Trash2 } from 'lucide-react'
import { useDisplay } from '../lib/display.jsx'
import { useCase } from '../lib/store.js'
import { useReveal } from '../lib/useReveal.js'
import { shortDate } from '../lib/format.js'

export default function MeterCheck() {
  const { money, number } = useDisplay()
  const { kase, sim } = useCase()
  const { ref, shown } = useReveal()
  const rows = sim?.rows ?? []
  const [entries, setEntries] = useState([{ date: '', shown: '' }])

  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows])

  const checked = entries
    .filter((e) => e.date && e.shown !== '')
    .map((e) => {
      const row = byDate.get(e.date)
      const shownPaisa = Math.round(parseFloat(e.shown) * 100)
      if (!row || Number.isNaN(shownPaisa)) return { ...e, missing: true }
      const gap = row.balancePaisa - shownPaisa
      return { ...e, shownPaisa, rebuilt: row.balancePaisa, gap }
    })

  const usable = checked.filter((c) => !c.missing)
  const worst = usable.reduce((a, c) => (Math.abs(c.gap) > Math.abs(a?.gap ?? -1) ? c : a), null)

  if (!kase || rows.length === 0) return null

  const setRow = (i, patch) =>
    setEntries((rowsIn) => rowsIn.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const first = rows[0].date
  const last = rows.at(-1).date
  const inputClass =
    'mt-1 w-full min-h-11 rounded-xl border border-ink-300/70 bg-white px-3 text-sm focus:border-accent dark:bg-ink-900/40 sm:min-h-0 sm:py-2'

  return (
    <section
      ref={ref}
      aria-labelledby="meter-check-heading"
      className={`w-full rounded-card border border-ink-300/60 bg-white p-5 dark:bg-ink-900/40 reveal ${
        shown ? 'reveal-in' : ''
      }`}
    >
      <h2 id="meter-check-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <ScanLine className="size-5 text-accent" aria-hidden="true" />
        Does the rebuild match your meter?
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        Type what the meter showed on any date between {shortDate(first)} and {shortDate(last)}, and
        our rebuilt figure appears beside it.
      </p>

      <div className="mt-4 space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-xs text-ink-500">Date</span>
              <input
                type="date"
                className={inputClass}
                value={e.date}
                min={first}
                max={last}
                onChange={(ev) => setRow(i, { date: ev.target.value })}
              />
            </label>
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-xs text-ink-500">Meter showed</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="৳"
                className={inputClass}
                value={e.shown}
                onChange={(ev) => setRow(i, { shown: ev.target.value })}
              />
            </label>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-xl border border-ink-300/70 text-ink-500 hover:border-danger/60 hover:text-danger sm:size-9"
              onClick={() => setEntries((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [{ date: '', shown: '' }]))}
              aria-label={`Remove reading ${i + 1}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink-300/70 px-3 text-sm font-medium hover:border-accent/60 hover:text-accent sm:min-h-0 sm:py-1.5"
        onClick={() => setEntries((r) => [...r, { date: '', shown: '' }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add another reading
      </button>

      <div aria-live="polite">
        {checked.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-ink-300/70 px-6 py-6 text-center text-sm text-ink-500">
            Fill in a date and a reading to see how close the rebuild is.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Meter readings against the rebuilt balance</caption>
              <thead>
                <tr className="border-b border-ink-300/60 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Meter showed</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">We rebuilt</th>
                  <th scope="col" className="py-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {checked.map((c, i) => (
                  <tr key={i} className="border-b border-ink-300/30">
                    <td className="py-2 pr-4">{c.date ? shortDate(c.date) : '—'}</td>
                    {c.missing ? (
                      <td colSpan={3} className="py-2 text-ink-500">
                        No reading in the rebuild for that date.
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-4 text-right tabular-nums">{money(c.shownPaisa)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{money(c.rebuilt)}</td>
                        <td
                          className={`py-2 text-right tabular-nums ${
                            Math.abs(c.gap) < 100 ? 'text-ok' : 'text-ink-900 dark:text-ink-50'
                          }`}
                        >
                          {c.gap === 0 ? 'exact' : `${c.gap > 0 ? '+' : ''}${money(c.gap)}`}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {worst && (
              <p className="mt-3 text-sm text-ink-500">
                {Math.abs(worst.gap) < 100 ? (
                  <>The rebuild matches the meter to within a taka on every date given.</>
                ) : worst.gap > 0 ? (
                  <>
                    Our rebuild sits {money(Math.abs(worst.gap))} <strong>above</strong> the meter on{' '}
                    {shortDate(worst.date)}. That usually means real usage ran heavier than the stated{' '}
                    {number(kase.usual_daily_units)} units a day, or a month carried charges the history
                    does not show.
                  </>
                ) : (
                  <>
                    Our rebuild sits {money(Math.abs(worst.gap))} <strong>below</strong> the meter on{' '}
                    {shortDate(worst.date)}. That usually means a recharge is missing from the history —
                    add it and the line will move.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
