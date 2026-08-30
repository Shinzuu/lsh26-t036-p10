# Handoff — decluttering the step navigation

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Branch:** `ui-declutter`, cut from `main` at `941b93b`
**Files changed:** `src/App.jsx`, `src/app.css`, `src/features/Sidebar.jsx` (+124, −25)
**For:** shinzuu — `App.jsx` and `app.css` are integrator-owned. Not merged, not deployed.

---

## The headline, because it is not the thing I was asked to do

**Every primary button in the app is unreadable in dark mode.** `--color-accent` lifts for
dark mode (`#54517c` → `#a0a4d0`) so it stays legible as *text* on the dark page — which makes
it a **light** surface. Every primary button is `bg-accent text-white`, and white on `#a0a4d0`
is **2.41:1**.

Six call sites, across four owners' files: the two buttons in `DataNotice`, the "Next" control
in `StepFooter`, the load button in `DataSource`, the submit in `MeterSetup`, and **the active
step badge in `Sidebar`**. I found it while measuring the sidebar, not by looking for it.

The token cannot simply be darkened — it is the same token that has to stay light to work as
text on the dark page. So the button flips its label to ink instead, in one unlayered rule,
touching none of the four files:

```css
.bg-accent.text-white { color: var(--color-ink-900); }   /* 2.41:1 -> 5.33:1 */
```

This is the third time this exact trap has bitten: a token that inverts for dark mode paired
with one that deliberately does not. `accent-soft`/`ink-900` was the first (item 4's verdict
banner), now `accent`/`white`. Worth a look at any future `bg-*` + `text-*` pairing.

---

## The clutter itself

### The step list on a phone — the big one

All seven rows rendered above the content **on every step**: roughly 300px of navigation
before the first figure, on a screen with about 600px to spend, repeated every time you moved.
The reader already knows where they are, and `StepFooter` gives Back and Next at the bottom.

It now collapses to a single row — "Step 3 of 7 · When to recharge" with an "All steps"
disclosure — opening the full list on demand and closing itself on selection. Wired with
`aria-expanded` / `aria-controls`, collapsed by default.

### The desktop sidebar

All seven blurbs rendered at once: a wall of secondary text sitting beside the figures, six
lines of which describe somewhere you are not. **Only the active step explains itself now.**

Measured effect: text nodes on a step fell from **116 to 93**, and the blurb count per step
from 7 to 1 (the overview keeps its "what's coming" list, which is content, not chrome).

### Both get a sense of place

Seven identical rows gave no indication of progress. There is now a "Step N of 7" line and a
progress bar in the sidebar, and the same counter on the phone's collapsed row.

### The header

The currency select sat between the brand and the buttons, giving four controls equal weight.
It now joins the case picker — the two "what am I looking at, and how is it shown" controls
together — so a first glance takes in the name of the thing and its two actions.

### One accessibility fix on the way past

The currency select's only label was a `<span class="hidden … lg:block">Currency</span>`.
`display:none` content is excluded from the accessibility tree, so **below 1024px it announced
as a combobox with no name at all.** It now carries an explicit `aria-label`; the visible span
stays for wide screens.

---

## Test evidence

| Check | Before | After |
|---|---|---|
| Rendered pairs below AA, dark | **1** (every primary button, 2.41:1) | **0** |
| Rendered pairs below AA, light | 0 | **0** |
| Text nodes on a step | 116 | **93** |
| Blurbs visible at once (non-overview) | 7 | **1** |
| All 7 steps render | — | **ok** — one `aria-current` each, progress on each |
| Phone step menu | always open, 7 rows | **collapsed, `aria-expanded`/`aria-controls` wired** |
| Controls labelled | 1 unnamed combobox under 1024px | **all labelled** |
| `tariff.test.mjs` / `dataset.test.mjs` | 37 / 27 | **37 / 27** |
| `npm run build`, `preflight.sh` | clean | **clean** |
| Item 4 vs independent reference, 25 cases | 22 equal, PUB-02/06/24 at −82.00 | **identical** |
| Fuzz, 250 same-shape cases | clean | **clean** |

### Three false alarms I ran down rather than reporting

My harnesses were written against the pre-`u8` app and cried wolf three times. All three were
tooling, not the app — recording them so nobody re-opens them:

1. **"Items 3 and 4 missing on first render", "13 malformed cases crash three panels".** The
   app is step-based now and needs `DisplayProvider` (added by `u7`), which my harness did not
   wrap. Rewritten; zero crashes across all 13 malformed cases once the provider is present.
2. **"BLOCKER: panel text claims a slab saving."** The sentence is
   *"A comparison that reported a slab saving would be wrong, not merely rounded differently"* —
   a **denial**, exactly what R-16 wants. My phrase match could not tell a claim from a denial.
3. **The negation guard I added to fix (2) then failed on text that plainly contained "not".**
   The file had a literal backspace byte (`0x08`) where `\b` should have been two characters,
   so the regex was `/[BS](no|not|…)[BS]/i` and could never match — and it printed innocently,
   because the control character is invisible. Repaired.

### Not verified — needs a human with a browser

No browser in this session. Layout work deserves eyes more than logic does:

1. **Dark mode, any screen** — that the primary buttons and the active step badge are readable.
   This is the fix that matters most and it has never been looked at.
2. **375px** — the collapsed step row, opening and closing it, and that choosing a step closes
   the menu and lands on the right content.
3. **~1024px**, where the sidebar appears and the currency label reappears.
4. Tab order through the header and the disclosure, and focus visibility.

## To take it

```bash
git fetch origin
git merge --no-ff origin/ui-declutter
npm run build && bash scripts/preflight.sh
npm run deploy -- --project-name lsh26-t036-p10
bash scripts/smoke-live.sh https://lsh26-t036-p10.pages.dev "Which recharge habit costs less"
```

The dark-mode button fix is self-contained in `src/app.css` if you want only that.

**Companion documents:** [`NAV-RESPONSIVE-HANDOFF.md`](NAV-RESPONSIVE-HANDOFF.md) ·
[`UI-CONTRAST-HANDOFF.md`](UI-CONTRAST-HANDOFF.md) · [`README.md`](README.md) ·
[`U3-findings.md`](U3-findings.md)
