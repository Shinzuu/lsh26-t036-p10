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
import { } from '../lib/tariff.js'

const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export default function MeterCheck() {
  const { money, number } = useDisplay()
  const { kase, sim } = useCase()
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

  return (
    <section aria-labelledby="meter-check-heading" className="w-full">
      <div className="rounded-card border border-ink-300/60 bg-white p-5 shadow-sm dark:bg-ink-900/40">
        <h2
          id="meter-check-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <ScanLine className="size-5 text-accent" aria-hidden="true" />
          Does the rebuild match your meter?
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Type what the meter actually showed on any date between {longDate(first)} and{' '}
          {longDate(last)}. We put our rebuilt figure beside it. A gap usually means a recharge
          is missing from the history or the real usage ran above the stated daily figure — it
          is a prompt to look, not a verdict.
        </p>

        <div className="mt-4 space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">Reading {i + 1} date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-ink-300/70 bg-white px-3 py-2 text-sm focus:border-accent dark:bg-ink-900/40"
                  value={e.date}
                  min={first}
                  max={last}
                  onChange={(ev) => setRow(i, { date: ev.target.value })}
                />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">Reading {i + 1}: what the meter showed, in taka</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Meter showed ৳"
                  className="mt-1 w-full rounded-xl border border-ink-300/70 bg-white px-3 py-2 text-sm focus:border-accent dark:bg-ink-900/40"
                  value={e.shown}
                  onChange={(ev) => setRow(i, { shown: ev.target.value })}
                />
              </label>
              <button
                type="button"
                className="rounded-xl border border-ink-300/70 p-2 text-ink-500 hover:text-danger"
                onClick={() => setEntries((r) => r.filter((_, j) => j !== i))}
                aria-label={`Remove reading ${i + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-ink-300/70 px-3 py-1.5 text-sm font-medium"
          onClick={() => setEntries((r) => [...r, { date: '', shown: '' }])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a reading
        </button>

        {checked.length > 0 && (
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
                    <td className="py-2 pr-4">{c.date ? longDate(c.date) : '—'}</td>
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
                    Our rebuild sits {money(Math.abs(worst.gap))} <strong>above</strong> the
                    meter on {longDate(worst.date)}. That direction usually means real usage ran
                    heavier than the stated {number(kase.usual_daily_units)} units a day, or a month
                    carried charges the history does not show.
                  </>
                ) : (
                  <>
                    Our rebuild sits {money(Math.abs(worst.gap))} <strong>below</strong> the
                    meter on {longDate(worst.date)}. That direction usually means a recharge is
                    missing from the history — add it above and the line will move.
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
