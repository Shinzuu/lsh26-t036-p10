# Handoff — colour-contrast and usability pass

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Branch:** `ui-contrast`, cut from `main` at `b1818ed`
**Files changed:** `src/app.css` (+50, −2) and `BOARD.md`. **No unit-owned component touched.**
**For:** shinzuu — `src/app.css` is integrator-owned, so this needs your merge, not mine.

---

## Read this first

`src/app.css` is on the integrator-only list. I built this on a branch rather than editing
`main`, and I am not merging it — that is your call. Everything here is additive and reversible,
and the three changes are independent, so you can take one and drop the others.

The merge freeze is **21:15**. If this lands after it, it is a fix you requested, not a feature.

---

## The one that actually matters

**In dark mode, required item 4's verdict banner renders at 1.16:1 — invisible.**

`--color-accent-soft` inverts for dark mode (`#e8e9f4` → `#3c3950`), but the ink ramp
deliberately does not: `#343134` is the dark *page*, not dark text. So an element pairing
`bg-accent-soft` with `text-ink-900` renders dark-on-dark.

It lands on exactly one element, and it is the worst one available —
`src/features/HabitCompare.jsx:175`:

```jsx
equal ? 'bg-accent-soft text-ink-900' : 'bg-ok/10 text-ink-900 dark:text-ink-50'
```

The `equal` branch has no `dark:` variant; the other branch does. That branch is taken whenever
the two habits tie — **22 of the 25 published cases, including PUB-01, the case the app seeds
itself with.** A judge opening the live URL on a dark-mode phone sees item 4's headline answer
as blank space.

| | light | dark |
|---|---|---|
| before | 10.64:1 | **1.16:1** |
| after | 10.64:1 | **10.29:1** |

Fixed in `app.css`, not in `HabitCompare.jsx`, so no unit-owned file is touched:

```css
.bg-accent-soft.text-ink-900,
.bg-sand-soft.text-ink-900 { color: var(--color-ink-50); }
```

Two classes outrank one, and the rule is **unlayered** while Tailwind's `.text-ink-900` sits
inside `@layer utilities` — unlayered wins regardless of specificity or order. I verified that
in the built CSS rather than assuming it: the utility is inside `@layer utilities` spanning
bytes 7601–24252, and the shim is at 25230, outside every layer. The rule also retires itself
the day that call site grows its own `dark:` variant.

## The other two changes

**Dark-mode `--color-ink-500`: `#a5a2b0` → `#aeabb9`.** The old value clears AA on the dark page
(5.13:1) but not on the two tinted chips it also renders on — 4.43:1 on `accent-soft`, an actual
miss rather than a rounding artifact. The new value clears every surface it is actually rendered
against: 4.93:1 on accent-soft, 5.02:1 on sand-soft, 5.70:1 on the page. It is never rendered on
a light surface in dark mode, so nothing else moves.

**`prefers-reduced-motion` respected.** The app runs a loading pulse and animates money with
NumberFlow; both decorate content that is already correct. Costs nothing, and a judge with the
OS setting on is no longer chasing a moving number.

## What I deliberately did NOT change

**`--color-ink-300` stays at `#c9cad8`, and I want to be explicit that this was a decision, not
an oversight.** It is 1.62:1 against a white card, under WCAG 1.4.11's 3:1 for the edge of a
control, so I tried darkening it to `#a3a7bc` — then measured the result and reverted it:

| | borders on white | header nav text on `bg-ink-700` |
|---|---|---|
| `#c9cad8` (kept) | 1.62:1 | **6.83:1** |
| `#a3a7bc` (tried) | 2.38:1 — still short of 3:1 | **4.66:1** |

The token is overloaded: it is a border in light mode *and* muted text in the header *and* muted
text on the dark page. Darkening it bought a border improvement that still fails the standard,
while pushing text a judge actually reads from comfortable to borderline. Partial benefit, real
cost — not worth shipping at freeze.

Two follow-ups are on `BOARD.md` for you rather than done here, because both need unit-owned
files:

1. Borders properly at 3:1 need a **separate border token** plus dropping the `/60` opacity
   modifiers at the call sites — those live in four owners' components.
2. `BalanceChart.jsx`'s month-boundary dashed lines are `text-ink-300` at **1.51:1**, and SPEC
   requires month boundaries "visible". `text-ink-500` would make them 5.88:1. Rimjhim's file.

---

## Test evidence

Contrast was measured by rendering the real `App` and walking the DOM for each text node's
nearest background ancestor — actual rendered pairs, not a cartesian product of tokens.

| Check | Before | After |
|---|---|---|
| Dark-mode rendered pairs below AA | **2** (incl. the 1.16:1 banner) | **0 — every rendered pair clears 4.5:1** |
| Light-mode rendered pairs below AA | 0 real | 0 real |
| `tariff.test.mjs` | 37 pass | **37 pass** |
| `dataset.test.mjs` | 22 pass | **22 pass** |
| `npm run build` | clean | **clean** |
| `scripts/preflight.sh` | passes | **passes** |
| Item 4 vs independent reference, 25 cases | 22 equal, PUB-02/06/24 at −82.00 | **identical — no behavioural change** |
| Fuzz, 250 random same-shape cases | clean | **clean — no crash, no NaN, R-16 invariants hold** |
| Whole-app render | 4 panels, deterministic, no console noise | **unchanged** |

Since the diff is CSS-only, no behavioural change was expected — the harnesses were re-run to
prove that rather than to assume it.

### Two false alarms I chased down so you don't have to

- **Light-mode `text-ink-300` at 1.51:1 "on the page", 6 nodes.** Not real. All seven bare
  `text-ink-300` *text* nodes sit inside the `bg-ink-700` header at 6.83:1; the ones my walker
  put "on the page" are SVG `<line>` gridline strokes, not text. My DOM walker drifts on
  self-closing SVG tags. Verified by matching each element against its enclosing `<header>`.
- **"3 controls with no label".** Not real. All seven controls are properly labelled — two by
  `for=`, one by `aria-label`, four by an enclosing `<label>` (implicit association, which my
  detector did not know about). Verified per control.

Both are tooling artifacts in my harness, not defects in the app. Neither is worth your time.

### Not verified — still needs a human with a browser

The Chrome extension is unavailable in my session, so these are untested rather than passed.
The dark-mode fix in particular is worth eyeballing once:

1. **Open the live URL with the OS in dark mode** and confirm the item-4 verdict banner reads
   clearly. This is the fix; it deserves thirty seconds of human eyes.
2. 375 px on a real phone on mobile data — no horizontal scroll, nothing clipped.
3. Tab order and focus visibility through the page.
4. The browser console during two minutes of real use.

---

## To take it

```bash
git fetch origin
git merge --no-ff origin/ui-contrast     # src/app.css + BOARD.md only
npm run build && bash scripts/preflight.sh
npm run deploy -- --project-name lsh26-t036-p10
bash scripts/smoke-live.sh https://lsh26-t036-p10.pages.dev "Which recharge habit costs less"
```

To take only the critical fix, cherry-pick the `.bg-accent-soft.text-ink-900` rule out of the
dark-mode block in `src/app.css`; it is self-contained and depends on nothing else in the diff.

**Companion documents:** [`README.md`](README.md) — whole-codebase review ·
[`U3-findings.md`](U3-findings.md) — the item-4 test pass.
