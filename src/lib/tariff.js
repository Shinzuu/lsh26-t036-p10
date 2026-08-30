/**
 * The tariff engine. OWNED BY U2 (Rimjhim) — replace this file wholesale.
 *
 * Signature-only placeholder written by the integrator so the app builds and so
 * U3 and U4 can lay out against real shapes before the engine lands. Every name
 * and return shape below is fixed in SPEC.md. Keep them; throw the bodies away.
 *
 * The constants ARE correct and come straight from the problem statement — the
 * tariff is stated there verbatim and must be used exactly as written.
 */
export const SLABS = [
  { upTo: 75, paisaPerUnit: 463 },
  { upTo: 200, paisaPerUnit: 526 },
  { upTo: 300, paisaPerUnit: 563 },
  { upTo: 400, paisaPerUnit: 583 },
  { upTo: 600, paisaPerUnit: 930 },
  { upTo: Infinity, paisaPerUnit: 1070 },
]
export const DEMAND_CHARGE_PAISA = 4200
export const METER_RENT_PAISA = 4000
export const VAT_PERCENT = 5

export function toPaisa(decimalString) {
  return Math.round(parseFloat(decimalString ?? '0') * 100)
}

export function formatBDT(paisa) {
  return `৳${(paisa / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function energyCost() {
  return { paisa: 0, parts: [] }
}

export function simulate() {
  return {
    rows: [],
    totals: { energyPaisa: 0, vatPaisa: 0, fixedPaisa: 0, rechargedPaisa: 0 },
    firstRechargeMonths: [],
    pending: true,
  }
}

export function projectRunOut() {
  return { runsOutOn: null, rows: [], pending: true }
}

export function requiredRecharge() {
  return { totalPaisa: 0, energyPaisa: 0, higherSlabPaisa: 0, fixedPaisa: 0, vatPaisa: 0, pending: true }
}

export function compareHabits() {
  return {
    low: { costPaisa: 0, energyPaisa: 0, vatPaisa: 0, fixedPaisa: 0, rechargeDates: [], monthsCharged: 0 },
    monthly: { costPaisa: 0, energyPaisa: 0, vatPaisa: 0, fixedPaisa: 0, rechargeDates: [], monthsCharged: 0 },
    cheaper: 'equal',
    differencePaisa: 0,
    reason: 'not implemented yet — U2',
    pending: true,
  }
}
