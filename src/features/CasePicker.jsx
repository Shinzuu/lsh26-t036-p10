/**
 * Household selector — the app's front door.
 *
 * The 25 published households live in a separate JSON that is fetched only when
 * this control is first opened, so the first paint stays small. Loading one
 * swaps the whole application over to it.
 */
import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { parseCases } from '../lib/dataset.js'

export default function CasePicker({ current, onLoad, onError }) {
  const [cases, setCases] = useState(null)
  const [loading, setLoading] = useState(false)

  async function ensureLoaded() {
    if (cases || loading) return
    setLoading(true)
    try {
      const mod = await import('../data/cases-p10.json')
      setCases(parseCases(mod.default))
    } catch (e) {
      onError?.(`Could not load the sample households: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <label className="relative flex min-w-0 items-center gap-2 text-sm">
      <span className="hidden shrink-0 text-xs text-ink-300 lg:block">Household</span>
      {/* Both indicators are centred on the control's own axis rather than left
          to their static position, which put them at the top of the label. */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      </span>
      <select
        className="w-full min-w-0 appearance-none rounded-xl border border-ink-300/70 bg-white py-2 pl-3 pr-9
           text-sm font-medium text-ink-900 focus:border-accent dark:bg-ink-900/60 dark:text-ink-50"
        value={current}
        onFocus={ensureLoaded}
        onMouseDown={ensureLoaded}
        onChange={(e) => {
          const next = cases?.find((c) => c.case_id === e.target.value)
          if (next) onLoad(next)
        }}
      >
        <option value={current}>
          {/^PUB-\d+$/.test(current) ? `${current} — sample household` : current}
        </option>
        {(cases ?? [])
          .filter((c) => c.case_id !== current)
          .map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.case_id} — sample, {c.days.length} days of readings
            </option>
          ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
        aria-hidden="true"
      />
    </label>
  )
}
