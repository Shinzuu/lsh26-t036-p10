/**
 * Application state. INTEGRATOR-OWNED — do not edit in a unit branch.
 *
 * One piece of state: which case is loaded, and which day is selected. The
 * simulation is derived, never stored, because it is a pure function of the case
 * — deriving means a pasted case cannot leave a stale balance line on screen.
 *
 * The export shape is fixed in SPEC.md. U2, U3 and U4 import it and were written
 * against these names, so changing a signature breaks three units at once. Need a
 * change? Put the exact diff on BOARD.md.
 *
 * createElement rather than JSX: SPEC.md fixes this module's name as `.js`, and
 * Vite's React plugin only transforms `.jsx`.
 */
import { createContext, createElement, useContext, useMemo, useState } from 'react'
import { SEED } from './dataset.js'
import { simulate } from './tariff.js'

const CaseContext = createContext(null)

export function StoreProvider({ children }) {
  const [kase, setCase] = useState(SEED)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

  const sim = useMemo(() => {
    if (!kase) return null
    try {
      return simulate(kase)
    } catch (e) {
      // A half-built engine must not white-screen the demo. The header and the
      // readings still render; the balance panels read as unavailable.
      console.error('simulate failed', e)
      return null
    }
  }, [kase])

  // Replacing the case clears the day selection, otherwise the detail line keeps
  // describing a date that is no longer in the readings.
  function load(next) {
    if (!next) {
      setError('Nothing to load.')
      return
    }
    setCase(next)
    setSelectedDate(null)
    setError(null)
  }

  const value = useMemo(
    () => ({ kase, sim, load, error, setError, selectedDate, selectDay: setSelectedDate }),
    [kase, sim, error, selectedDate],
  )

  return createElement(CaseContext.Provider, { value }, children)
}

function ctx() {
  const v = useContext(CaseContext)
  if (!v) throw new Error('useCase/useDay used outside StoreProvider')
  return v
}

/** { kase, sim, load, error, setError } */
export function useCase() {
  const { kase, sim, load, error, setError } = ctx()
  return { kase, sim, load, error, setError }
}

/** { selectedDate, selectDay, row } — `row` is the simulated day, or null. */
export function useDay() {
  const { selectedDate, selectDay, sim } = ctx()
  const row = useMemo(
    () => sim?.rows?.find((r) => r.date === selectedDate) ?? null,
    [sim, selectedDate],
  )
  return { selectedDate, selectDay, row }
}
