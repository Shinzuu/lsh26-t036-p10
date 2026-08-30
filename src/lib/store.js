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
import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import { SEED, parseCase } from './dataset.js'
import { simulate } from './tariff.js'

const CaseContext = createContext(null)

/**
 * Where a household's own meter is kept between visits.
 *
 * Someone who fills in the set-up form has typed their real balance, their
 * daily use and every recharge they could remember. Losing that on a refresh
 * makes the tool feel broken, so the case is written to localStorage and read
 * back on boot. Only the case is stored — the simulation stays derived, so a
 * stored case can never disagree with the engine that reads it.
 */
const SAVED_CASE_KEY = 'p10.case.v1'

/** Never let a corrupt or hand-edited entry white-screen the app. */
function readSavedCase() {
  try {
    const raw = localStorage.getItem(SAVED_CASE_KEY)
    if (!raw) return null
    // Validated on the way in, not trusted: the same parser the paste box uses.
    return parseCase(JSON.parse(raw))
  } catch {
    try {
      localStorage.removeItem(SAVED_CASE_KEY)
    } catch {
      /* storage unavailable — nothing to clean up */
    }
    return null
  }
}

export function StoreProvider({ children }) {
  // The seed renders on the very first paint so the landing route is never
  // empty; a saved case replaces it immediately after mount.
  const [kase, setCase] = useState(SEED)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const saved = readSavedCase()
    if (saved) {
      setCase(saved)
      setRestored(true)
    }
  }, [])

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
    setRestored(false)
    try {
      localStorage.setItem(SAVED_CASE_KEY, JSON.stringify(next))
    } catch {
      // Private browsing or a full quota. The case still loads for this
      // session; only the remembering is lost, so this is not worth an error.
    }
  }

  /** Drop the remembered meter and go back to the published sample. */
  function reset() {
    try {
      localStorage.removeItem(SAVED_CASE_KEY)
    } catch {
      /* storage unavailable */
    }
    setCase(SEED)
    setSelectedDate(null)
    setError(null)
    setRestored(false)
  }

  const value = useMemo(
    () => ({
      kase,
      sim,
      load,
      reset,
      restored,
      isSeed: kase === SEED,
      error,
      setError,
      selectedDate,
      selectDay: setSelectedDate,
    }),
    [kase, sim, error, selectedDate, restored],
  )

  return createElement(CaseContext.Provider, { value }, children)
}

function ctx() {
  const v = useContext(CaseContext)
  if (!v) throw new Error('useCase/useDay used outside StoreProvider')
  return v
}

/** { kase, sim, load, reset, restored, isSeed, error, setError } */
export function useCase() {
  const { kase, sim, load, reset, restored, isSeed, error, setError } = ctx()
  return { kase, sim, load, reset, restored, isSeed, error, setError }
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
