# Themes

**Activate one by adding a single line to `src/app.css`: `@import './themes/slate.css';`**

That is the whole operation. Nothing else in the kit changes, no component is
touched, and swapping themes is editing one word. On the night this is a
sub-minute job that should happen once, early, and never be thought about again.

**React kit only.** `../starter-kit` (Svelte) has no theme pack — its
`app.css` ships the same unfixed tokens this README measures below. Out of
scope for this freeze rather than undiscoverable by omission; port the five
`oklch()` `:root` blocks over if a Svelte team needs the same AA fixes.

---

## The five

| Theme | Accent | Ink | Page | Worst text pair | Reach for it when |
|---|---|---|---|---|---|
| `slate` | `#1169da` | `#0c121b` | `#f6f9fc` | 4.67:1 | Default. No strong domain colour — dashboards, CRUD, internal tools |
| `civic` | `#027282` | `#15110a` | `#faf8f5` | 4.53:1 | Forms and records — registration, complaints, permits, anything a citizen fills in |
| `ochre` | `#886800` | `#0e1216` | `#f7f9fa` | 4.67:1 | Operations — dispatch, queues, delivery tracking, inventory |
| `plum` | `#a241be` | `#131018` | `#f9f8fb` | 4.67:1 | Consumer-facing — marketplace, feed, booking |
| `noir` | `#004f9d` | `#101213` | `#f8f8f9` | 7.27:1 | Everything at AAA. The insurance policy for a bad screen or a daylight demo |

"Worst text pair" is the weakest contrast ratio any theme produces across both
colour schemes — the number that decides whether a judge can read the thing.

---

## Why this exists

The rubric is blunt about decoration: *"a plain clear interface beats a decorated
confusing one"*, and styling is explicitly **not** what earns the last UI/UX band.
So a theme pack cannot be justified as prettiness. It is justified because the
palette the kit ships today does not clear WCAG AA, and unreadable text is a
`Usability` problem, not a decoration problem.

Measured against `src/app.css` as it stands on `main`:

| Pair | Ratio | AA 4.5:1 | Where it shows |
|---|---|---|---|
| text-ink-500 on bg-ink-50 | 4.04:1 | **fail** | 44 uses — secondary text everywhere |
| text-ink-500 on bg-ink-900 (dark) | 4.31:1 | **fail** | 42 of those 44 have no `dark:` variant |
| text-accent on bg-ink-50 | 3.51:1 | **fail** | every link |
| text-accent on bg-accent-soft | 3.10:1 | **fail** | the chip pattern, 8 uses |
| text-ok on bg-ink-50 | 3.09:1 | **fail** | success text |
| text-danger on bg-ink-50 | 4.48:1 | **fail** | error text, 19 uses |
| text-danger on bg-ink-900 (dark) | 3.89:1 | **fail** | the same text on the dark page |
| white text on bg-accent | 3.71:1 | **fail** | every primary button |

`--color-accent-soft` is also `oklch(0.94 0.04 258)`, which is **outside the sRGB
gamut**. Every browser clips an out-of-gamut colour slightly differently, so the
screenshot the judges archive at 22:00 is not exactly the thing anyone signed off.

None of this is visible by eye at 21:50, and all of it is arithmetic. Every theme
here clears AA on every pair the kit actually renders, in both colour schemes, and
every colour is inside sRGB.

---

## How it works

Tailwind 4 compiles the `@theme` block in `app.css` into `@layer theme { :root { … } }`.
A theme file declares the same custom properties in a **plain, unlayered `:root`**,
and unlayered rules beat layered ones in the cascade no matter what order they
appear in. So the import can go anywhere in `app.css` and still wins.

Verified, not assumed — built both ways and read out of the emitted bundle:

```
@layer theme > :root,:host   --color-accent:#3082f6    <- app.css @theme
:root                        --color-accent:#1169da    <- themes/slate.css
@media (prefers-color-scheme:dark) > :root
                             --color-accent:#3b7ede    <- themes/slate.css dark block
```

Two consequences worth knowing:

- **Import position does not matter.** Top of the file or bottom, the theme wins.
  Putting it after the `@theme` block is a readability preference, not a
  requirement.
- **A theme cannot be scoped to part of the app** without changing the selector,
  and it should not be. One palette, whole app.

Nothing imports this folder, so an unactivated theme adds no JavaScript at all.
The CSS bundle does grow by **608 bytes** with the folder present and no theme
imported — Tailwind scans every file in `src/` for class names, and the shim
selector and the examples in this README look like candidates to it. Measured,
not estimated: 22,067 → 22,675 bytes with the folder moved out and back. Deleting
the four themes you did not use before the freeze takes it back to nothing.

---

## Dark mode, and the one thing that cannot be fixed here

`app.css` swaps only the page background and body text for dark mode. Everything
else keeps its light value, and the kit's markup patches the gap with `dark:`
variants at some call sites but not others. A theme that overrode a token the
markup already handles would be fighting it, so each theme moves only the four
that need moving. Counted out of `src/`:

| Token | Kit's own handling | Theme |
|---|---|---|
| `ink-100` | 13 of 13 background uses carry `dark:bg-*` | left alone |
| `ink-300` | used as `dark:text-ink-300`, must stay light | left alone |
| `ink-700` | used as `dark:bg-ink-700`, must stay dark | left alone |
| `ink-500` | 42 of 44 text uses have no `dark:` variant | **moved** |
| `accent` | has to lift off the dark page | **moved** |
| `danger` / `ok` | sit on `bg-danger/10` over the dark page | **moved** |

The `ink-500` case is not a tuning oversight, it is arithmetic. A grey readable on
a near-white page needs relative luminance ≤ 0.17; the same grey readable on a
near-black page needs ≥ 0.29. There is no value in both ranges. One token cannot
serve both schemes, so either it moves per scheme or 42 call sites stay illegible
in dark mode.

Lifting `--color-accent` for the dark page forces `--color-accent-soft` to invert
with it — a light accent on a near-white chip is unreadable. That is right
everywhere the chip carries accent-coloured text, and wrong at the two places the
kit puts `text-ink-900` on that chip, because in dark mode `ink-900` *is* the page
background and the label would vanish.

The clean fix is `text-ink-900 dark:text-ink-50` at those two call sites. They live
in recipe files these themes do not own, and the 27 August drill cost us sixteen
minutes to exactly this instinct — editing someone else's file because the change
looked small. So the repair ships inside each theme instead:

```css
.bg-accent-soft.text-ink-900 { color: var(--color-ink-50); }
```

Two classes outrank one, nothing outside that exact pairing is touched, and the
rule deletes itself from relevance the day those call sites carry their own
`dark:` variant. `themes.test.mjs` fails any theme that inverts the chip and
forgets the shim.

---

## What a theme cannot fix — integrator requests

These need `app.css` or component changes, which belong to the integrator. Posting
them here rather than doing them:

1. **Borders sit at 2.2:1.** WCAG 1.4.11 wants 3:1 for the boundary of a control,
   and an input outline is a control. Getting there turns every field outline into
   a mid-grey rule and visibly changes the app, which is a design call, not a
   token call. The themes hold a 2:1 floor — above the kit's current 1.82:1 — and
   the test enforces it. Raise `BORDER_MIN` in `themes.test.mjs` and re-run to see
   what a stricter choice would cost.
2. **`text-ink-900 dark:text-ink-50` on the two `bg-accent-soft` chips** in
   `src/recipes/`, which would let the shim rule above be deleted.
3. **No way to force a colour scheme.** Dark mode follows the OS. If the demo
   video needs a guaranteed look, that is a `dark:` strategy change in `app.css`,
   not something a token file can reach.

---

## Verifying

```bash
node --test src/themes/themes.test.mjs
```

41 checks across the five themes. For each one it verifies:

- every token the kit uses is declared, so a theme cannot render half-applied;
- every colour is inside sRGB, in both schemes;
- every text pair the kit actually renders clears AA (AAA for `noir`), in both
  schemes;
- white button labels clear AA on the solid fills;
- borders stay visible against both page backgrounds;
- accent, danger and ok stay at least 55° apart in hue, so a status badge cannot
  read as the wrong status;
- the neutral ramp is still monotonic after the dark override;
- a theme that inverts the chip ships the shim.

The thresholds are floors, not targets. Raising one and re-running is the intended
way to argue about a palette.

`contrast.mjs` holds the OKLCH → sRGB → WCAG maths with no dependencies. It is
plain `.mjs` on purpose: importable from a test, from a scratch script, or pasted
into a problem repo on the night if a bullet needs a contrast check.

---

## Adding a theme

Copy the closest existing file, change the numbers, run the test. It will tell you
exactly which pair you broke and by how much:

```
slate light: secondary text — 44 uses in the kit — color-ink-500 on color-ink-50
is 4.21:1, below 4.5:1 (#757a83 on #f6f9fc)
```

Two rules beyond the test:

- **Declare the full palette in `:root`**, even tokens you did not change. A theme
  that declares six of ten leaves the other four at whatever `app.css` last said,
  which is how you get a half-themed app that looks like a merge went wrong.
- **Only `oklch(L C H)` values.** The test's parser understands that syntax and
  nothing else, so a hex value or a `var()` indirection reads as a missing token
  and fails the completeness check. That is deliberate: a value the gate cannot
  read is a value the gate is not checking.
