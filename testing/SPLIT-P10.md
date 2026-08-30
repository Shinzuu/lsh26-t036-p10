# P10 — the app split in two, one branch each

Two people, two halves, no shared files. Everything below is on `main` as of the
`u9-interactive` merge; both branches cut from there.

Base: `main` · live https://lsh26-t036-p10.pages.dev

---

## The line down the middle

The split is **shell and inputs** against **answers and evidence**. It falls on
file boundaries, so the two branches should not touch the same file at all — the
only shared surfaces are `src/App.jsx` and `src/app.css`, and each of those has
an owner below.

### Side A — the shell, the inputs, the way in · **shinzuu**

Branch: `sideA-shell`

| File | What it is |
|---|---|
| `src/App.jsx` | The shell: header, drawer, step routing, overview, footer. **A owns this file.** |
| `src/app.css` | Tokens, motion, print. **A owns this file.** |
| `src/features/Sidebar.jsx` | The step list and its copy |
| `src/features/ui/Drawer.jsx` | The slide-over menu |
| `src/features/ui/Tooltip.jsx` | The tooltip primitive |
| `src/features/ui/Toasts.jsx` | Toasts and the live region |
| `src/features/CasePicker.jsx` | The household selector |
| `src/features/MeterSetup.jsx` | "Set up my meter" — the form |
| `src/features/DataSource.jsx` | The household card, CSV/JSON import, export |
| `src/lib/display.jsx` | Currency and numerals |
| `src/lib/dataset.js` · `dataset.test.mjs` | Parsing, validation, month labels |
| `src/lib/saved.js` · `useReveal.js` | Export helper, reveal hook |

**What A is looking for.** Can a stranger get their own data in without help?
Does every control say what it does before it is pressed? Is the first screen an
offer rather than a wall? Does the drawer, the popover and the picker work on a
real phone, one-handed?

### Side B — the answers and the working behind them · **Robiul**

Branch: `sideB-answers`

| File | What it is |
|---|---|
| `src/features/Hero.jsx` | The three headline figures |
| `src/features/BalanceChart.jsx` | R2 — the balance line, day detail, slab ladder |
| `src/features/Questions.jsx` | R3 — run-out date, required recharge |
| `src/features/HabitCompare.jsx` | R4 — the two habits |
| `src/features/MonthBill.jsx` | The monthly bill and the slab warning |
| `src/features/MeterCheck.jsx` | Reconciliation against a real meter |
| `src/features/Explainer.jsx` | The collapsed "how this works" note |
| `src/lib/tariff.js` · `tariff.test.mjs` | The engine |
| `src/lib/chart-scale.js` | Chart maths |

**What B is looking for.** Is every figure legible at a glance and checkable on
demand? Does the chart teach the slab reset, or just show a line? Do the four
required answers read as answers rather than as tables? Is the working there for
anyone who wants it and out of the way for anyone who does not?

---

## Rules while we are apart

- **Do not edit a file on the other side's list.** If you need a change there,
  write it down and raise it — that is the whole point of the split.
- `src/lib/store.js` is shared and **frozen**. If either side needs a change to
  it, we agree it first.
- **Never change `src/lib/tariff.js` without re-running the oracle.** Item 4's
  answer must be `0.00` or a multiple of `৳82.00` on every published case:
  `node testing/oracle.mjs /tmp/p10.json`.
- Before pushing: `node --test src/lib/*.test.mjs`, `npm run build`,
  `bash scripts/preflight.sh`. All three, every time.
- Do not deploy from a side branch. Production stays on `main`.

## When we come back together

1. Merge Side A, then Side B on top — A owns `App.jsx`, so conflicts should be
   rare and small.
2. Consistency pass, which is the part that actually needs doing together:
   - one card treatment, one border weight, one radius
   - headings all the same size and weight per level
   - money always through the display layer, never a local formatter
   - one voice in the copy — plain, second person, no jargon
   - spacing rhythm between panels identical on both sides
3. Full verification on the deployed URL: 64 tests, preflight, all 25 households
   in light and dark, 1440 / 390, keyboard-only pass, console silent.

## Where things stand now

Working, verified on `main`: four required items, three bonus features, CSV and
JSON import, own-meter setup with persistence and export, currency switching,
step navigation with a hamburger drawer, settings popover, tooltips, toasts,
dark mode, and 64 tests.

Known and unfixed: nobody has opened it on a real phone on mobile data.
