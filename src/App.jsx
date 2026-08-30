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

const SECTIONS = [
  { id: 'household', label: 'Household' },
  { id: 'balance', label: 'Balance' },
  { id: 'questions', label: 'Questions' },
  { id: 'habits', label: 'Habits' },
]

function Layout() {
  const { kase, load, error, setError } = useCase()
  const [setup, setSetup] = useState(false)
  const empty = !kase || !kase.days?.length

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-ink-300/60 bg-ink-50/85 backdrop-blur dark:bg-ink-900/85">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
              Recharge Advisor
            </p>
            <p className="truncate text-xs text-ink-500">Prepaid meter · slab-aware</p>
          </div>
          <button
            type="button"
            onClick={() => setSetup((v) => !v)}
            className="shrink-0 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
          >
            {setup ? 'Close' : 'Set up my meter'}
          </button>
          {kase && (
            <div className="hidden w-40 shrink-0 sm:block sm:w-56">
              <CasePicker
                current={kase.case_id}
                onLoad={load}
                onError={(m) => setError?.(m)}
              />
            </div>
          )}
        </div>

        <nav aria-label="Sections" className="mx-auto w-full max-w-5xl px-4 pb-2 sm:px-6">
          <ul className="flex gap-1.5 overflow-x-auto text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block whitespace-nowrap rounded-lg px-2.5 py-1 text-ink-500 hover:bg-accent-soft hover:text-accent"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
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
              <DataSource kase={kase} error={null} onLoad={load} />
            </section>

            {/* Item 2 — the balance rebuilt day by day, with every recharge marked. */}
            <section id="balance" className="scroll-mt-32">
              <BalanceChart />
            </section>

            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              {/* Item 3 — when does it run out, and how much to recharge today. */}
              <section id="questions" className="min-w-0 scroll-mt-32">
                <Questions />
              </section>
              {/* Item 4 — low-balance habit against monthly habit, same consumption. */}
              <section id="habits" className="min-w-0 scroll-mt-32">
                <HabitCompare />
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-ink-300/60">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-ink-500 sm:px-6">
          Team Miasma · LSH26-T036 · Problem P10 · LofiStack Hackathon 2026
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
