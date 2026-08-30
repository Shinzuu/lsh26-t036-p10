# Handoff — decluttering the step navigation

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Branch:** `ui-declutter` — merged up to `main` at `a0733c3`, so it applies cleanly
**Net change vs main:** `src/app.css` (+24) and `src/features/Sidebar.jsx` (+33, −16). Two files.
**For:** shinzuu — `app.css` is integrator-owned. Not merged, not deployed.

---

## Read this first — the branch shrank on purpose

I started this while `u9-interactive` was landing. Main now has a hamburger **Drawer** and a
settings **popover**, which do the same job as two of my four changes and do it better. So I
merged main in and **took its `App.jsx` wholesale**, dropping my versions:

| My original change | Fate |
|---|---|
| Mobile step list → collapsible disclosure | **Dropped** — `u9`'s native `<dialog>` drawer supersedes it |
| Currency select regrouped in the header | **Dropped** — `u9` moved it into a labelled settings popover |
| Currency `aria-label` | **Dropped** — `u9`'s popover gives it a real visible `<label>` |
| Sidebar: blurb on the active step only | **Kept** — main still shows all seven |
| Sidebar: "Step N of 7" + progress bar | **Kept** — main has neither |
| Dark-mode primary-button fix | **Kept** — still broken on main |

What is left is two files. No conflict with `u9`; the drawer renders the same `Sidebar`, so the
declutter improves the drawer too.

---

## The headline, and it is not the decluttering

**Every primary button in the app is unreadable in dark mode — still true on `main` today.**

`--color-accent` lifts for dark mode (`#54517c` → `#a0a4d0`) so it stays legible as *text* on
the dark page. That makes it a **light** surface — and every primary button is
`bg-accent text-white`. White on `#a0a4d0` is **2.41:1**.

Six call sites across four owners' files: both buttons in `DataNotice`, the "Next" control in
`StepFooter`, the load button in `DataSource`, the submit in `MeterSetup`, and **the active step
badge in `Sidebar`** — which `u9` now also renders inside the drawer. I found it while measuring
the sidebar, not by looking for it.

The token cannot just be darkened: it is the same token that has to stay light to work as text.
So the button flips its label to ink, in one unlayered rule touching none of the four files:

```css
.bg-accent.text-white { color: var(--color-ink-900); }        /* 2.41:1 -> 5.33:1 */
.bg-accent .text-white\/80 { color: color-mix(...); }         /* the "Next" caption */
```

**This is the third time this exact trap has bitten.** A token that inverts for dark mode paired
with one that deliberately does not: first `accent-soft` + `ink-900` (item 4's verdict banner,
1.16:1), now `accent` + `white`. Any new `bg-*` / `text-*` pairing is worth a check before freeze.

## The decluttering that survived

**All seven blurbs rendered at once** in the sidebar — a wall of secondary text beside the
figures, six lines of it describing somewhere you are not. Only the active step explains itself
now. On a phone this is the drawer's content, so it declutters there too.

**Seven identical rows gave no sense of place.** There is now a "Step N of 7" line and a progress
bar at the top of the sidebar.

Measured: blurbs visible on a non-overview step went from **7 to 1**. (The overview keeps its
"what's coming" list — that is content, not chrome.)

---

## Test evidence, on the merged state

| Check | Result |
|---|---|
| Rendered pairs below AA — dark | **0** (was 1: every primary button at 2.41:1) |
| Rendered pairs below AA — light | **0** |
| Blurbs visible per step | **1** (was 7) |
| All 7 steps render | **ok** — exactly one live `aria-current`, progress on each |
| Drawer | native `<dialog>`, **closed by default**, hamburger present |
| `tariff.test.mjs` / `dataset.test.mjs` | **37 / 27 pass** |
| `npm run build` · `preflight.sh` | **clean** |
| Item 4 vs independent reference, 25 cases | **identical** — 22 equal, PUB-02/06/24 at −82.00 |
| Fuzz, 250 same-shape cases | **clean** |
| Whole-app render | four regions present, ten renders byte-identical, no `alert()` |

### Five false alarms I ran down rather than reporting

My harnesses predate `u7`/`u8`/`u9`. Every one of these was tooling, not the app:

1. **"Items 3 and 4 missing; 13 malformed cases crash three panels."** The app is step-based now
   and needs `DisplayProvider` (`u7`), which my harness did not wrap. Rewritten — zero crashes.
2. **"BLOCKER: panel text claims a slab saving."** The sentence is *"A comparison that reported a
   slab saving **would be wrong**, not merely rounded differently"* — a denial, exactly what R-16
   wants. My phrase match could not tell a claim from a denial.
3. **The negation guard I added to fix (2) then failed on text plainly containing "not".** The
   file held a literal backspace byte (`0x08`) where `\b` should have been two characters, so the
   regex was `/[BS](no|not|…)[BS]/i` — unmatchable, and invisible when printed.
4. **"`aria-current` twice on every step."** The drawer renders a second `Sidebar` inside a
   `<dialog>` with no `open` attribute — `display:none`, inert. Exactly one live occurrence.
5. **"Light-mode `text-ink-300` at 1.51:1."** It is the header subtitle inside the `bg-ink-700`
   bar at 6.83:1; my DOM walker drifts on self-closing SVG tags. Verified per element.

### Not verified — needs a human with a browser

No browser this session, so none of this has been *looked* at:

1. **Dark mode, any width** — that primary buttons and the active step badge are readable. This
   is the fix that matters most and it has never been seen.
2. The drawer on a phone with the new sidebar content, and the settings popover.
3. ~1024px, where the desktop sidebar takes over from the drawer.
4. Tab order and focus visibility.

## To take it

```bash
git fetch origin
git merge --no-ff origin/ui-declutter     # src/app.css + src/features/Sidebar.jsx
npm run build && bash scripts/preflight.sh
npm run deploy -- --project-name lsh26-t036-p10
bash scripts/smoke-live.sh https://lsh26-t036-p10.pages.dev "Which recharge habit costs less"
```

The dark-mode button fix is self-contained in `src/app.css` if you want only that — it is the
part I would take even if you take nothing else.

**Companion documents:** [`NAV-RESPONSIVE-HANDOFF.md`](NAV-RESPONSIVE-HANDOFF.md) ·
[`UI-CONTRAST-HANDOFF.md`](UI-CONTRAST-HANDOFF.md) · [`README.md`](README.md) ·
[`U3-findings.md`](U3-findings.md)
