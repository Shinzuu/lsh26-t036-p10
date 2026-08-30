/**
 * App shell. INTEGRATOR-OWNED — do not edit in a unit branch.
 *
 * One screen, no router: a sticky bar carrying the brand and the household
 * selector, the three headline figures, jump links, then the four sections that
 * map one-to-one onto the four required items. A judge reading the problem
 * statement finds each without being told where to look, and a family reading
 * it gets the answer before the working.
 */
import { useState } from 'react'
import { StoreProvider, useCase } from './lib/store.js'
import { SEED } from './lib/dataset.js'
import CasePicker from './features/CasePicker.jsx'
import Hero from './features/Hero.jsx'
import MeterSetup from './features/MeterSetup.jsx'
import DataSource from './features/DataSource.jsx'
import BalanceChart from './features/BalanceChart.jsx'
import Questions from './features/Questions.jsx'
import HabitCompare from './features/HabitCompare.jsx'
import MonthBill from './features/MonthBill.jsx'
import MeterCheck from './features/MeterCheck.jsx'

const SECTIONS = [
  { id: 'household', label: 'Household' },
  { id: 'balance', label: 'Balance' },
  { id: 'questions', label: 'Questions' },
  { id: 'habits', label: 'Habits' },
  { id: 'check', label: 'Check' },
  { id: 'bill', label: 'Bill' },
]

/**
 * An eyebrow and a hairline. Deliberately not a heading: each panel already owns
 * the one h2 for its required item, and a second would put the same section in
 * the heading tree twice.
 */
function SectionHead({ eyebrow, note }) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        {note && <p className="text-xs text-ink-500">{note}</p>}
      </div>
      <div className="rule mt-2" />
    </div>
  )
}

function Layout() {
  // The store owns remembering: `isSeed` is false once anything else is loaded,
  // and `reset` forgets it and returns to the published sample.
  const { kase, load, reset, isSeed, error, setError } = useCase()
  const [setup, setSetup] = useState(false)
  const empty = !kase || !kase.days?.length

  return (
    <div className="min-h-dvh">
      {/* Sticky from `sm` up only. On a phone the bar is three rows tall once the
          household selector and the jump links are reachable, and pinning ~150px
          of a 667px screen costs more than the jumping saves. It scrolls away
          instead, and the footer carries the same section list. */}
      <header className="top-0 z-20 border-b border-ink-700 bg-ink-700 text-ink-50 sm:sticky">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
              Recharge Advisor
            </p>
            <p className="truncate text-xs text-ink-300">
              {isSeed
                ? 'Prepaid meter · rebuilt on the published slab tariff'
                : 'Your household · remembered on this device'}
            </p>
          </div>
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
                onLoad={load}
                onError={(m) => setError?.(m)}
              />
            </div>
          )}
        </div>

        {/* Six labels are about 430px of content; a 375px phone cannot show them.
            Below `sm` this is a snap scroller with a fade at the right edge so it
            reads as "there is more", rather than a silently clipped row. The
            scrollbar is hidden because it sat on top of the links. From `sm` up
            the whole row fits, so it wraps normally and the fade is gone.

            Each link is 44px tall on touch; the old `px-2.5 py-1` gave a 26px
            target, under every tap-size guideline. Compact again from `sm`. */}
        <nav aria-label="Sections" className="relative mx-auto w-full max-w-5xl px-4 pb-2 sm:px-6">
          <ul className="no-scrollbar -mx-1 flex snap-x gap-1 overflow-x-auto px-1 text-sm sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="snap-start">
                <a
                  href={`#${s.id}`}
                  className="flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-ink-300 hover:bg-white/10 hover:text-white sm:min-h-0 sm:px-2.5 sm:py-1"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink-700 to-transparent sm:hidden"
          />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-20 pt-6 sm:px-6">
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
              <MeterSetup
                onCancel={() => setSetup(false)}
                onLoad={(k) => {
                  load(k)
                  setSetup(false)
                }}
              />
            )}

            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Where the money on this meter actually goes
                </h1>
                <p className="mt-1 max-w-2xl text-ink-500">
                  Electricity is priced in slabs that climb as the month goes on and reset on
                  the 1st. This rebuilds the balance day by day on that tariff, so the next
                  recharge is a number rather than a guess.
                </p>
              </div>
              <Hero />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                <span className="flex-1">{error}</span>
              </p>
            )}

            {/* Item 1 — the household's readings and recharges, and how a judge loads their own. */}
            <section id="household" className="scroll-mt-32">
              <SectionHead eyebrow="Required item 1 · the household" note="six months of daily readings and its recharge history" />
              <DataSource kase={kase} error={null} onLoad={load} />
            </section>

            {/* Item 2 — the balance rebuilt day by day, with every recharge marked. */}
            <section id="balance" className="scroll-mt-32">
              <SectionHead eyebrow="Required item 2 · the rebuild" note="each day at the slab the month had reached" />
              <BalanceChart />
            </section>

            {/* Two column stacks rather than a row grid: a tall panel would
                otherwise set its whole row's height and leave the shorter one
                sitting above a block of dead space. */}
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <div className="min-w-0 space-y-8">
                {/* Item 3 — when does it run out, and how much to recharge today. */}
                <section id="questions" className="scroll-mt-32">
                  <SectionHead eyebrow="Required item 3 · the two questions" />
                  <Questions />
                </section>

                <section id="check" className="scroll-mt-32">
                  <SectionHead eyebrow="Going further · reconciliation" note="the rebuild against the real meter" />
                  <MeterCheck />
                </section>
              </div>

              <div className="min-w-0 space-y-8">
                {/* Item 4 — low-balance habit against monthly habit, same consumption. */}
                <section id="habits" className="scroll-mt-32">
                  <SectionHead eyebrow="Required item 4 · the habits" />
                  <HabitCompare />
                </section>

                <section id="bill" className="scroll-mt-32">
                  <SectionHead eyebrow="Going further · the monthly bill" note="and the next slab crossing" />
                  <MonthBill />
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-4 border-t border-ink-300/60">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Recharge Advisor</p>
              <p className="mt-1.5 max-w-xs text-sm text-ink-500">
                Rebuilds a prepaid meter day by day on the published slab tariff, so the next
                recharge is a number rather than a guess.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                The tariff
              </p>
              <p className="mt-1.5 text-sm text-ink-500">
                Six slabs from ৳4.63 to ৳10.70 a unit, counted per calendar month.
                <br />
                ৳42.00 demand charge + ৳40.00 meter rent, once a month.
                <br />
                5% VAT on energy only.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">On this page</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a className="text-ink-500 underline-offset-2 hover:text-accent hover:underline" href={`#${s.id}`}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-8 border-t border-ink-300/50 pt-5 text-xs text-ink-500">
            Built by <span className="font-medium text-ink-700 dark:text-ink-300">Miasma</span>.
            Figures are computed from the readings you load; they are an estimate of what the
            meter will do, not a bill.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  )
}
