# Handoff — responsive header and section navigation

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Branch:** `ui-nav-responsive`, cut from `main` at `2d26474` (after `ui-contrast` merged)
**Files changed:** `src/App.jsx` (+37, −9) and `src/app.css` (+16). Nothing else.
**For:** shinzuu — both files are integrator-owned, so this needs your merge, not mine.

---

## Read this first

`src/App.jsx` and `src/app.css` are on the integrator-only list. I built this on a branch and
did **not** push to `main` or deploy. Merge freeze is 21:15; past it, treat this as a fix you
requested.

**Two of the three problems are functional, not cosmetic** — on a phone the app was missing
controls entirely, not just looking untidy.

---

## 1 · The household selector did not exist on a phone

```jsx
<div className="hidden w-40 shrink-0 sm:block sm:w-56">   // before
```

`CasePicker` appears exactly once in the app, inside that wrapper. Below 640px it was
`display:none`, so **there was no way to change case on a phone at all.** The 25 published
cases were desktop-only. A judge testing on mobile could not load PUB-02 — the case that
demonstrates the two habits actually differing by ৳82.00, which is required item 4's whole
point. The only mobile route to another case was pasting raw JSON into the item-1 panel.

Now one instance still, moved by flex ordering rather than duplicated: full-width on its own
row below `sm`, inline from `sm` up. No second control enters the tab order.

## 2 · "Back to the sample" was hidden too — and it is now the only way back

This one changed meaning under us. `load()` in `src/lib/store.js` writes every case to
`localStorage` — the picker, the paste box, the file upload and the set-up form all go through
it. So a reload no longer returns to the seeded PUB-01; it restores whatever was last loaded.
That makes `Back to the sample` the only reset, and it was `hidden sm:block`.

Net effect on a phone before this change: **load a case and you are stuck with it.** Now
visible at every width.

### Related finding — for you, not fixed here

`evaluation-manifest.json`'s `reset_instructions` still says:

> "Nothing is persisted to localStorage or to any server ... the initial data is restored
> simply by reloading the page."

Both halves are now false, and this is the field a judge uses to reset between test cases.
Following it, they would reload, get the previous case back, and could mis-read the result.
The file's own `known_limitations[0]` already describes the new behaviour correctly, so the
manifest currently contradicts itself. `README.md` (line 164) is fine. Suggested wording:

> "The last case loaded is remembered in this browser only. Use **Back to the sample** in the
> header to return to the seeded PUB-01; a reload keeps the case you loaded."

I did not edit it — the manifest is yours and it is a submission artifact.

## 3 · The jump links were a clipped strip with 26px targets

Six labels are roughly 430px of content; a 375px phone cannot show them. The old markup was
`flex gap-1.5 overflow-x-auto` with `px-2.5 py-1` links:

- clipped at the right edge with **no affordance** that anything was there;
- a scrollbar rendering across the links on platforms that reserve space for one;
- **26px tap targets**, under every tap-size guideline (WCAG 2.5.8 asks 24px minimum, platform
  guidance 44px).

Now: a snap scroller with a fade at the right edge that reads as "there is more", no scrollbar
chrome (`.no-scrollbar` added to `app.css`), and **44px targets**. From `sm` up the row fits, so
it wraps normally and the fade is hidden. Every interactive element in the header is now at
least 44px on touch — verified against the rendered markup, 0 exceptions.

## 4 · The header is sticky only from `sm` up

Once the selector and the links are both reachable, the bar is three rows on a phone. Pinning
~150px of a 667px screen costs more than the jumping saves, so below `sm` it scrolls away. The
footer's "On this page" list carries the same six links for anyone deep in the page.

---

## Test evidence

| Check | Result |
|---|---|
| `npm run build` | clean (300.60 kB / 91.22 kB gzipped) |
| `scripts/preflight.sh` | passes |
| `tariff.test.mjs` | 37 pass |
| `dataset.test.mjs` | 27 pass |
| Dark-mode contrast, rendered pairs | **every pair still clears AA 4.5:1** |
| Required item 4 vs independent reference, 25 cases | **identical** — 22 equal, PUB-02/06/24 at −82.00 |
| Fuzz, 250 random same-shape cases | clean — no crash, no NaN, R-16 invariants hold |
| Whole-app render | four panels present, ten renders byte-identical, no `alert()` |
| Header touch targets | 0 controls under 44px on mobile |
| Controls labelled | all 7 — by `for=`, `aria-label`, or an enclosing `<label>` |
| One `CasePicker` instance | confirmed — the second `<select>` in the DOM is MonthBill's month picker |

`sm:` resolves to `min-width:40rem` (640px) in the built CSS, and all the new variants
(`sm:sticky`, `sm:flex-nowrap`, `sm:order-none`, `sm:overflow-visible`, `sm:min-h-0`) are
present in the output — checked in `dist`, not assumed.

**One honest note:** I first placed a JSX comment inside a `map` callback, which broke the
build. `preflight.sh` caught it, I fixed it, and the numbers above are from a clean rebuild
after `rm -rf dist`. Flagging it because it is the kind of thing that would otherwise show up
as a mystery in your merge.

### Not verified — needs a human with a browser

No browser in my session, so nothing here has been *looked* at. Layout changes deserve eyes
more than logic changes do:

1. **375px, real phone.** The three header rows, the nav fade, and that the six links scroll
   smoothly with the snap.
2. **The selector on mobile** — that it is reachable and switching to PUB-02 works.
3. **Landscape phone and ~640px**, the boundary where the layout flips to the desktop
   arrangement.
4. Tab order through the header, and focus visibility on the nav links.

## To take it

```bash
git fetch origin
git merge --no-ff origin/ui-nav-responsive     # src/App.jsx + src/app.css only
npm run build && bash scripts/preflight.sh
npm run deploy -- --project-name lsh26-t036-p10
bash scripts/smoke-live.sh https://lsh26-t036-p10.pages.dev "Which recharge habit costs less"
```

**Companion documents:** [`UI-CONTRAST-HANDOFF.md`](UI-CONTRAST-HANDOFF.md) — the contrast pass ·
[`README.md`](README.md) — whole-codebase review · [`U3-findings.md`](U3-findings.md) — item-4
test pass.
