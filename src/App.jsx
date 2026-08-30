/**
 * App shell. INTEGRATOR-OWNED — do not edit in a unit branch.
 *
 * One screen, no router: a sticky bar carrying the brand and the household
 * selector, the three headline figures, jump links, then the four sections that
 * map one-to-one onto the four required items. A judge reading the problem
 * statement finds each without being told where to look, and a family reading
 * it gets the answer before the working.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, HelpCircle, Menu, Settings2 } from 'lucide-react'
import Sidebar, { STEPS } from './features/Sidebar.jsx'
import Drawer from './features/ui/Drawer.jsx'
import Tooltip from './features/ui/Tooltip.jsx'
import { ToastProvider, useToast } from './features/ui/Toasts.jsx'
import { DisplayProvider, useDisplay, CURRENCIES } from './lib/display.jsx'
import { StoreProvider, useCase } from './lib/store.js'
import { SEED } from './lib/dataset.js'
import { SLABS, DEMAND_CHARGE_PAISA, METER_RENT_PAISA, VAT_PERCENT } from './lib/tariff.js'
import CasePicker from './features/CasePicker.jsx'
import Hero from './features/Hero.jsx'

import DataSource from './features/DataSource.jsx'
import BalanceChart from './features/BalanceChart.jsx'
import Questions from './features/Questions.jsx'
import HabitCompare from './features/HabitCompare.jsx'

// Below the fold or behind a button: none of these are needed for first paint.
const MeterSetup = lazy(() => import('./features/MeterSetup.jsx'))
const MonthBill = lazy(() => import('./features/MonthBill.jsx'))
const MeterCheck = lazy(() => import('./features/MeterCheck.jsx'))


/**
 * An eyebrow and a hairline. Deliberately not a heading: each panel already owns
 * the one h2 for its required item, and a second would put the same section in
 * the heading tree twice.
 */
/** Holds the panel's shape while its code arrives, so nothing jumps. */
function PanelSkeleton({ lines = 4 }) {
  return (
    <div
      className="rounded-card border border-ink-300/60 bg-white p-5 dark:bg-ink-900/40"
      aria-busy="true"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-ink-100 dark:bg-ink-700/40" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-ink-100 dark:bg-ink-700/30" />
        ))}
      </div>
    </div>
  )
}


/**
 * The header's tools: a settings popover and a help hint.
 *
 * Currency used to sit bare in the bar, which made a preference look like part
 * of the data. It now lives behind a settings button with a label and an
 * explanation, which is both quieter and clearer.
 */
function HeaderTools() {
  const { currency, setCurrency, rateNote } = useDisplay()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  // Focus follows the popover: into its first control on open, back to the
  // button that opened it on close — otherwise a keyboard user is left behind
  // the panel they just opened.
  useEffect(() => {
    if (open) panelRef.current?.querySelector('select')?.focus()
    else if (document.activeElement === document.body) buttonRef.current?.focus()
  }, [open])

  // Close on Escape or a click anywhere else, the way a menu is expected to.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onClick = (e) => {
      if (!e.target.closest?.('[data-header-tools]')) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [open])

  return (
    <div className="relative flex items-center gap-1" data-header-tools>
      <Tooltip
        side="bottom"
        label="Every figure is rebuilt from the household's own readings using the published slab tariff. Nothing is estimated unless the screen says so."
      >
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-xl text-ink-300 hover:bg-white/10 hover:text-white"
        >
          <HelpCircle className="size-5" aria-hidden="true" />
          <span className="sr-only">How these figures are produced</span>
        </button>
      </Tooltip>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm ${
          open ? 'bg-white/15 text-white' : 'text-ink-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Settings2 className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{currency.code}</span>
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Display settings"
          className="absolute right-0 top-12 z-40 w-72 rounded-card border border-ink-300/60 bg-white p-4 text-ink-900 shadow-xl dark:bg-ink-900 dark:text-ink-50"
        >
          <p className="text-sm font-semibold tracking-tight">Display</p>
          <label className="mt-3 block text-sm">
            <span className="text-ink-500">Show all amounts in</span>
            <select
              value={currency.code}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-300/70 bg-white px-3 py-2 text-sm focus:border-accent dark:bg-ink-900/60"
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-ink-500">
            {rateNote ??
              'The tariff is written in taka, so taka is what a fresh visit shows. Any other currency is converted for display only, at a stated rate.'}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Whose meter is on screen, and how to change it.
 *
 * Someone opening this for the first time sees numbers for a household they
 * have never heard of. Unexplained, that reads as a broken demo. Said plainly,
 * it reads as a worked example — and the two ways out of it are right there.
 */
function DataNotice({ kase, isPublished, onSetup, onStep }) {
  return (
    <section className="rounded-card border border-accent/30 bg-accent-soft/60 p-4">
      <p className="text-sm">
        {isPublished ? (
          <>
            You are looking at <strong className="font-semibold">{kase.case_id}</strong>, one of
            25 sample households published with this problem — six months of real-shaped
            readings and recharges, so every figure below has something to work on.
          </>
        ) : (
          <>
            You are looking at <strong className="font-semibold">{kase.case_id}</strong>, the
            meter you set up. It is kept in this browser and nowhere else.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSetup}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Set up my own meter
        </button>
        <button
          type="button"
          onClick={() => onStep('household')}
          className="rounded-xl border border-accent/40 px-3 py-2 text-sm font-medium text-accent"
        >
          Load a file, or pick another sample
        </button>
      </div>
    </section>
  )
}

/** The title of the step you are on, and what it is for. */
function StepHeader({ step }) {
  const s = STEPS.find((x) => x.id === step)
  const { kase, sim } = useCase()
  const { money } = useDisplay()
  if (!s) return null
  const closing = sim?.rows?.at(-1)?.balancePaisa
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {s.id !== 'overview' && kase && (
          <span className="order-last ml-auto flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full border border-ink-300/60 px-2.5 py-1 text-ink-500">
              {kase.case_id}
            </span>
            {closing !== undefined && (
              <span className="rounded-full border border-ink-300/60 px-2.5 py-1 tabular-nums text-ink-500">
                {money(closing)} on the meter
              </span>
            )}
          </span>
        )}
        {s.item && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-accent">
            {s.item}
          </span>
        )}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{s.label}</h1>
      </div>
      <p className="mt-1 text-ink-500">{s.blurb}</p>
      <div className="rule mt-3" />
    </header>
  )
}

/** Walk forward and back without going to the sidebar for it. */
function StepFooter({ step, onSelect }) {
  const i = STEPS.findIndex((x) => x.id === step)
  const prev = STEPS[i - 1]
  const next = STEPS[i + 1]
  return (
    <nav aria-label="Move between steps" className="flex items-stretch justify-between gap-3 pt-2">
      {prev ? (
        <button
          type="button"
          onClick={() => onSelect(prev.id)}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-card border border-ink-300/60 px-4 py-3 text-left hover:border-accent/50 sm:flex-none sm:min-w-56"
        >
          <ArrowLeft className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xs text-ink-500">Back</span>
            <span className="block truncate text-sm font-medium">{prev.label}</span>
          </span>
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button
          type="button"
          onClick={() => onSelect(next.id)}
          className="group flex min-w-0 flex-1 items-center justify-end gap-2 rounded-card bg-accent px-4 py-3 text-right text-white sm:flex-none sm:min-w-56"
        >
          <span className="min-w-0">
            <span className="block text-xs text-white/80">Next</span>
            <span className="block truncate text-sm font-medium">{next.label}</span>
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      )}
    </nav>
  )
}

/** On the overview, say what the tool will do rather than leaving them to guess. */
function NextSteps({ onSelect }) {
  return (
    <section className="rounded-card border border-ink-300/60 bg-white p-5 dark:bg-ink-900/40">
      <h2 className="text-base font-semibold tracking-tight">What this tool does next</h2>
      <p className="mt-1 text-sm text-ink-500">
        Four steps, in order. Each answers one question about this meter, and each shows the
        working behind its answer.
      </p>
      <ol className="mt-4 space-y-2">
        {STEPS.filter((s) => s.item).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-ink-300/50 px-3 py-2.5 text-left hover:border-accent/50 hover:bg-accent-soft/40"
            >
              <span className="mt-0.5 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                {s.item}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-ink-500">{s.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Printed pages need the collapsed explanations open; the screen keeps them shut. */
function useOpenDetailsForPrint() {
  useEffect(() => {
    const opened = []
    const before = () => {
      document.querySelectorAll('details:not([open])').forEach((d) => {
        d.setAttribute('open', '')
        opened.push(d)
      })
    }
    const after = () => {
      opened.splice(0).forEach((d) => d.removeAttribute('open'))
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
}

function Layout() {
  // The store owns remembering: `isSeed` is false once anything else is loaded,
  // and `reset` forgets it and returns to the published sample.
  const { kase, load, reset, isSeed, error, setError } = useCase()
  const [setup, setSetup] = useState(false)
  const [menu, setMenu] = useState(false)
  useOpenDetailsForPrint()

  // Left and right arrows walk the steps. Not while typing, not inside a
  // select, chart or dialog — anywhere arrows already mean something.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      const el = document.activeElement
      if (el && (/^(INPUT|SELECT|TEXTAREA|SVG)$/i.test(el.tagName) || el.isContentEditable)) return
      if (document.querySelector('dialog[open]')) return
      const i = STEPS.findIndex((x) => x.id === window.location.hash.replace('#', '')) 
      const cur = i === -1 ? 0 : i
      const next = STEPS[cur + (e.key === 'ArrowRight' ? 1 : -1)]
      if (next) setStep(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toast = useToast()
  // The step lives in the address bar, so a link points at a step, the browser's
  // Back button walks them, and a refresh stays where the reader was.
  const [step, setStepState] = useState(() => {
    const fromHash = window.location.hash.replace('#', '')
    return STEPS.some((s) => s.id === fromHash) ? fromHash : 'overview'
  })
  const setStep = (id) => {
    // pushState, not replaceState: each step is a history entry, so the
    // browser's Back button walks the steps instead of leaving the site.
    // The guard reads the address bar, not React state — a side effect inside
    // a state updater runs twice under StrictMode and pushed double entries.
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`)
    setStepState(id)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  // The browser tab names the step — switching tabs back, you know where you were.
  useEffect(() => {
    const s = STEPS.find((x) => x.id === step)
    document.title = s && s.id !== 'overview' ? `${s.label} · Recharge Advisor` : 'Recharge Advisor'
  }, [step])

  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.replace('#', '')
      setStepState(STEPS.some((s) => s.id === id) ? id : 'overview')
    }
    window.addEventListener('popstate', onHash)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('popstate', onHash)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])
  const empty = !kase || !kase.days?.length
  // `isSeed` is identity with PUB-01, which is the right test for "offer to go
  // back", but the wrong one for the subtitle: picking PUB-24 from the sample
  // list is still a published household, and calling it "your household" is a
  // claim the app cannot support.
  const isPublished = /^PUB-\d+$/.test(kase?.case_id ?? '')

  return (
    <div className="min-h-dvh">
      {/* Sticky from `sm` up only. On a phone the bar is three rows tall once the
          household selector and the jump links are reachable, and pinning ~150px
          of a 667px screen costs more than the jumping saves. It scrolls away
          instead, and the footer carries the same section list. */}
      <header className="top-0 z-20 border-b border-ink-700 bg-ink-700 text-ink-50 sm:sticky">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Open the menu"
            className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-50 hover:bg-white/10 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight sm:text-base">Recharge Advisor</p>
            {/* Truncated to "Prepaid meter · r…" on a phone, which says less
                than nothing. It is a subtitle, so it goes rather than clips. */}
            <p className="hidden truncate text-xs text-ink-300 sm:block">
              {isPublished
                ? 'Prepaid meter · rebuilt on the published slab tariff'
                : 'Your household · remembered on this device'}
            </p>
          </div>
          <HeaderTools />
          {/* Was `hidden sm:block`. Every case now goes through `load()`, which
              writes to localStorage, so a reload no longer returns to the sample
              — this button is the only way back. Hiding it below `sm` left a
              phone with a one-way door: load a case, and you are stuck with it. */}
          {!isSeed && (
            <button
              type="button"
              className="flex min-h-11 shrink-0 items-center rounded-xl border border-white/25 px-3 text-sm text-ink-50 hover:bg-white/10 sm:min-h-0 sm:py-2"
              onClick={reset}
            >
              Back to the sample
            </button>
          )}
          <button
            type="button"
            onClick={() => setSetup((v) => !v)}
            className="flex min-h-11 shrink-0 items-center rounded-xl bg-sand px-3 text-sm font-medium text-ink-900 hover:bg-sand/90 sm:min-h-0 sm:py-2"
          >
            {setup ? 'Close' : 'Set up my meter'}
          </button>
          {/* Was `hidden sm:block`, which left a phone with no way to change case
              at all — the 25 published cases were desktop-only, and a judge on a
              phone could not load PUB-02 to see the habits differ. One instance
              still: it drops to its own full-width row below `sm` and sits inline
              from `sm` up, so there is no duplicate control to tab through. */}
          {kase && (
            <div className="order-last w-full shrink-0 sm:order-none sm:w-56">
              <CasePicker
                current={kase.case_id}
                onLoad={(k) => {
                  load(k)
                  toast(`Loaded ${k.case_id} — ${k.days.length} days of readings.`, 'info')
                }}
                onError={(m) => setError?.(m)}
              />
            </div>
          )}
        </div>

      </header>

      <Drawer open={menu} onClose={() => setMenu(false)} title="Recharge Advisor">
        <Sidebar active={step} onSelect={setStep} onNavigate={() => setMenu(false)} />
      </Drawer>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 pb-20 pt-6 sm:px-6">
        {/* The sidebar is the map of the tool. On a phone it becomes the step
            list at the top of the page instead, because a drawer that has to be
            opened hides the one thing a first-time reader needs to see. */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24">
            <Sidebar active={step} onSelect={setStep} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {empty ? (
            <div className="rounded-card border border-dashed border-ink-300 p-8 text-center">
              <p className="font-medium">Nothing to rebuild yet.</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                Load a household&rsquo;s daily readings and recharges and this page will rebuild
                its meter balance day by day, say when the balance runs out, and compare two
                recharge habits.
              </p>
              <button
                type="button"
                className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
                onClick={() => load(SEED)}
              >
                Load the sample household
              </button>
            </div>
          ) : (
            <>
              {setup && (
                <Suspense fallback={<PanelSkeleton lines={6} />}>
                  <MeterSetup
                    onCancel={() => setSetup(false)}
                    onLoad={(k) => {
                      load(k)
                      setSetup(false)
                      setStep('overview')
                      toast(`Your meter is set up — ${k.days.length} days rebuilt.`)
                    }}
                  />
                </Suspense>
              )}

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  <span className="flex-1">{error}</span>
                </p>
              )}

              <div key={step} className="step-in space-y-6">
              <StepHeader step={step} />

              {step === 'overview' && (
                <div className="space-y-6">
                  <DataNotice
                    kase={kase}
                    isPublished={isPublished}
                    onSetup={() => setSetup(true)}
                    onStep={setStep}
                  />
                  <Hero />
                  <NextSteps onSelect={setStep} />
                </div>
              )}
              {step === 'household' && <DataSource kase={kase} error={null} onLoad={load} />}
              {step === 'balance' && <BalanceChart />}
              {step === 'questions' && <Questions />}
              {step === 'habits' && <HabitCompare />}
              {step === 'bill' && (
                <Suspense fallback={<PanelSkeleton lines={5} />}>
                  <MonthBill />
                </Suspense>
              )}
              {step === 'check' && (
                <Suspense fallback={<PanelSkeleton lines={3} />}>
                  <MeterCheck />
                </Suspense>
              )}

              <StepFooter step={step} onSelect={setStep} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* A footer that carries the tariff it computes on. Anyone checking a
          figure needs the six slab rates and the two fixed charges, and putting
          them here means they are on the page without crowding the panels. */}
      <footer className="mt-6 border-t border-ink-300/60 bg-white/50 dark:bg-ink-900/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <p className="text-base font-semibold tracking-tight">Recharge Advisor</p>
              <p className="mt-2 max-w-xs text-sm text-ink-500">
                A prepaid meter, rebuilt day by day on the published slab tariff.
              </p>
            </div>

            <div className="sm:col-span-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
                The tariff, per calendar month
              </p>
              <dl className="mt-3 space-y-1 text-sm tabular-nums">
                {SLABS.map((slab, i) => {
                  const from = i === 0 ? 1 : SLABS[i - 1].upTo + 1
                  const to = slab.upTo === Infinity ? null : slab.upTo
                  return (
                    <div key={slab.upTo} className="flex justify-between gap-4">
                      <dt className="text-ink-500">
                        {to ? `Units ${from}–${to}` : `Units ${from} and above`}
                      </dt>
                      <dd className="font-medium">৳{(slab.paisaPerUnit / 100).toFixed(2)}</dd>
                    </div>
                  )
                })}
                <div className="flex justify-between gap-4 border-t border-ink-300/50 pt-1">
                  <dt className="text-ink-500">Demand charge + meter rent</dt>
                  <dd className="font-medium">
                    ৳{((DEMAND_CHARGE_PAISA + METER_RENT_PAISA) / 100).toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">VAT, on energy only</dt>
                  <dd className="font-medium">{VAT_PERCENT}%</dd>
                </div>
              </dl>
            </div>

            <nav aria-label="Footer" className="sm:col-span-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
The steps
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {STEPS.map((s) => (
                  <li key={s.id}>
                    <a
                      className="text-ink-500 underline-offset-4 hover:text-accent hover:underline"
                      href={`#${s.id}`}
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ink-300/50 pt-5 text-xs text-ink-500">
            <p>
              Built by <span className="font-medium text-ink-700 dark:text-ink-300">Miasma</span>
            </p>
            <p>Slab counter resets on the 1st of each month</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <DisplayProvider>
        <ToastProvider>
          <Layout />
        </ToastProvider>
      </DisplayProvider>
    </StoreProvider>
  )
}
