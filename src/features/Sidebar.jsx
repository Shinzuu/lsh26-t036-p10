/**
 * The sidebar, and the whole navigation model.
 *
 * The page used to be one long scroll. Six panels of dense figures in a column
 * asks the reader to hold their place, and the only way to know what was further
 * down was to go there. Now each step is its own view and the sidebar says what
 * every one of them answers — so the shape of the tool is visible before any of
 * it is read.
 *
 * Each entry carries a one-line description for the same reason. "Habits" means
 * nothing to someone opening this for the first time; "Which way of recharging
 * costs less" means exactly what it says.
 */
import { Check, ChevronRight } from 'lucide-react'

export const STEPS = [
  {
    id: 'overview',
    label: 'Overview',
    blurb: 'What is on the meter, and what to do about it',
    item: null,
  },
  {
    id: 'household',
    label: 'The household',
    blurb: 'The readings and recharges everything is built from',
    item: 'R1',
  },
  {
    id: 'balance',
    label: 'Where the money went',
    blurb: 'The balance rebuilt day by day on the tariff',
    item: 'R2',
  },
  {
    id: 'questions',
    label: 'When to recharge',
    blurb: 'The date it runs out, and what to put in today',
    item: 'R3',
  },
  {
    id: 'habits',
    label: 'Which habit is cheaper',
    blurb: 'Recharging when low against recharging monthly',
    item: 'R4',
  },
  {
    id: 'bill',
    label: "One month's bill",
    blurb: 'Energy, charges and VAT for a month you pick',
    item: null,
  },
  {
    id: 'check',
    label: 'Check against your meter',
    blurb: 'Compare our rebuild with what the meter showed',
    item: null,
  },
]

export default function Sidebar({ active, onSelect, className = '', onNavigate }) {
  return (
    <nav aria-label="Sections" className={className}>
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        Steps
      </p>
      <ul className="space-y-0.5">
        {STEPS.map((s) => {
          const current = s.id === active
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  onSelect(s.id)
                  onNavigate?.()
                }}
                className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  current
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700/30'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {s.item ? (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        current ? 'bg-accent text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-700/50'
                      }`}
                    >
                      {s.item}
                    </span>
                  ) : (
                    <ChevronRight
                      className={`size-4 ${current ? 'text-accent' : 'text-ink-300'}`}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{s.label}</span>
                  <span
                    className={`mt-0.5 block text-xs leading-snug ${
                      current ? 'text-accent/80' : 'text-ink-500'
                    }`}
                  >
                    {s.blurb}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink-100/60 px-3 py-2.5 text-xs text-ink-500 dark:bg-ink-700/20">
        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          R1 to R4 are the four things this tool has to do. Each has its own step, in order.
        </span>
      </p>
    </nav>
  )
}
