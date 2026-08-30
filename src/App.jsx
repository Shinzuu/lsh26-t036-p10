/**
 * App shell. INTEGRATOR-OWNED — do not edit in a unit branch.
 *
 * One screen, no router. The four panels map one-to-one onto the four required
 * items, so a judge reading the problem statement finds each without being told
 * where to look. Each panel is a separate unit's file; this file only decides
 * where they sit and hands them the store.
 */
import { StoreProvider, useCase } from './lib/store.js'
import DataSource from './features/DataSource.jsx'
import { SEED } from './lib/dataset.js'
import BalanceChart from './features/BalanceChart.jsx'
import Questions from './features/Questions.jsx'
import HabitCompare from './features/HabitCompare.jsx'

const APP_NAME = 'Recharge Advisor'
const TAGLINE = 'Where the prepaid balance actually goes, and what to recharge before it runs out.'

function Layout() {
  const { kase, load, error } = useCase()
  const empty = !kase || !kase.days?.length

  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-4 pt-8 pb-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          LSH26-T036 · Problem P10
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-ink-500">{TAGLINE}</p>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 sm:px-6">
        {/* Item 1 — the household's readings and recharges, and how a judge loads their own. */}
        <DataSource kase={kase} error={error} onLoad={load} />

        {empty ? (
          // An empty screen is an invitation, not a status line: the action that
          // fills it sits inside the message.
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
            {/* Item 2 — the balance rebuilt day by day, with every recharge marked. */}
            <BalanceChart />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Item 3 — when does it run out, and how much to recharge today. */}
              <div className="min-w-0">
                <Questions />
              </div>
              {/* Item 4 — low-balance habit against monthly habit, same consumption. */}
              <div className="min-w-0">
                <HabitCompare />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-xs text-ink-500 sm:px-6">
        Team Miasma · LSH26-T036 · LofiStack Hackathon 2026
      </footer>
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  )
}
