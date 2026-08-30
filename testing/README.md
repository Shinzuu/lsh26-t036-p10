# Codebase review — P10 Prepaid Meter Recharge Advisor

**Operator:** Robiul (`MDRobiulHassan`)
**Project:** P10 — Prepaid Meter Recharge Advisor · repository `lsh26-t036-p10` · team Miasma `LSH26-T036`
**Reviewed at:** commit `3113796` ("fix: findings from Rimjhim's U2 test pass on item 3"), after the
team lead's merge, fix and compile pass.
**Live URL:** https://lsh26-t036-p10.pages.dev — verified current with `3113796`.
**Scope:** whole codebase, post-merge. Read-only: nothing outside `testing/` was changed.

> Deliberately filed as `testing/README.md`, not the repository's root `README.md` — that file
> is a judged submission artifact and must not be disturbed.

---

## Summary

The application itself is in good shape and I could not break it. **Every finding below is in
the surrounding artifacts — the manifest, the licence file, declarations and dead code — not in
the four required items.** Findings 1 and 4 are the ones worth acting on first: one is a
required-file format risk, the other makes an otherwise truthful declaration inaccurate. Both
are minutes of work.

| # | Severity | Finding |
|---|---|---|
| 1 | **HIGH** | `evaluation-manifest.json` does not follow the organizer's template shape, and omits P08 entirely |
| 2 | MEDIUM | `LICENSES.md` says there are no fonts; the page loads Inter from a CDN |
| 3 | MEDIUM | A 640 kB generated build artifact is committed at the repository root |
| 4 | MEDIUM | `EVENT.md` declares that unused recipes are deleted; they are not |
| 5 | LOW | `package.json` still carries the starter kit's name |
| 6 | LOW | `BOARD.md` rows never reached `done-live` |
| 7 | Checklist | Both repositories are still private |

---

## Verified good — do not re-check these

Re-verified against the new HEAD rather than taken from the fix commit's message.

- **All six findings from my item-4 test pass are correctly fixed** (`cf8528d`). The MAJOR now
  reads *"Neither habit triggered a recharge in these months, so neither paid the ৳82.00 demand
  charge and meter rent at all"*, which agrees with the cards above it.
- **Tests 98/98** — `tariff.test.mjs` 37, `dataset.test.mjs` 20, `themes.test.mjs` 41.
- **`npm run build` clean** (240 kB JS / 73.8 kB gzipped); **`scripts/preflight.sh` clean**,
  including "no template branding left".
- **The deployed bundle is current with `3113796`** — strings from both fix commits are present
  in the live JavaScript.
- **Required item 4 still correct on all 25 published cases** after the fixes: energy and VAT
  identical between habits everywhere, 22 equal, PUB-02/06/24 differing by exactly ৳82.00.
- **250 randomly generated cases in the organizers' shape** — spanning year boundaries,
  zero-unit days, 60–400 day ranges, varying comparison windows, thresholds and amounts — with
  **no crash, no NaN, and the R-16 invariants holding on every one.** This is the closest
  available proxy for the unpublished cases judges will use.
- **Whole-app:** four panels present on cold open with no empty-state flash; every control
  labelled; 39 malformed-input renders (13 broken cases × 3 panels) with no throw, no NaN, no
  "Invalid Date", no "undefined"; ten renders byte-identical; no browser storage, so a reload
  cannot drift; no `alert()`; no console output during render.
- **`LICENSES.md` is otherwise accurate**, and **`EVENT.md` is thorough and honest** about
  pre-event material — finding 4 is a single stale sentence in it, not a problem with its
  substance.

### One correction to my own earlier work

My fuzz harness initially reported 27 R-16 violations. That was **my assertion being wrong**,
not a defect: `differencePaisa` is `Math.abs(delta)`, with the signed value exposed separately
as `lowMinusMonthlyPaisa`. Corrected the assertion, re-ran, clean. Recording it so nobody
re-opens it.

Similarly, `scripts/smoke-live.sh` reports the deploy as **stale** on my machine. It is not —
the mismatch is CRLF line endings in a Windows checkout changing the local bundle hash. I
confirmed freshness by grepping the deployed bundle for strings introduced by both fix commits.

---

## Findings

### 1 · HIGH — `evaluation-manifest.json` does not follow the organizer's template

`brief/participant-pack-v2.1/evaluation-manifest.template.json` specifies:

```
release_version · team_id · form_receipt_time
problems: [ two entries, one per problem ]
   problem_id · repository_url · live_url · commit_sha
   loads_sample_data · requirements{R1..R4} · known_limitations
```

The committed file is a flat, single-problem object. Against the template it is missing
`release_version`, `form_receipt_time`, **`commit_sha`**, and the `problems` array — so it
**contains no P08 entry at all** — and it uses `repository_name` where the template says
`repository_url`, with `known_limitations` at the top level rather than per problem.

`PICKS.md` states the requirement plainly: *"filled from
`brief/participant-pack-v2.1/evaluation-manifest.template.json`, identical in both repos,
covering both problems."*

The **content is excellent** — the R1–R4 evidence, per-member contributions, design decisions
and limitations are all there and are the hard part. This is a remapping into the template's
shape, not a rewrite. The missing `commit_sha` is the sharpest edge, because the 30 Aug
clarifications say *"The commit SHA you enter in the form is the version judged."*

### 2 · MEDIUM — `LICENSES.md` says there are no fonts; the page loads Inter from a CDN

`index.html` lines 14–15:

```html
<link rel="preconnect" href="https://rsms.me/" />
<link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
```

and `src/app.css` sets `--font-sans: 'Inter var', 'Inter', ui-sans-serif, system-ui, sans-serif`.
But `LICENSES.md` states: *"Fonts, icons, images, sound: **None.** The interface uses the
browser's own system font stack via Tailwind's defaults."*

Inter is SIL OFL 1.1, which is permitted — so this is a **disclosure gap, not a licence
violation**. It still matters twice over: licence-file accuracy is explicitly scored, and the
rulebook requires every third-party asset to be listed with its licence. It is also an avoidable
third-party network dependency on the exact URL the organizers health-check and screenshot at
22:00.

**Fix, either way round:** add Inter (SIL OFL 1.1, rsms.me) to the assets table, or delete the
two `<link>` tags and let the system stack render. Removing it is the smaller change and drops
an external dependency.

### 3 · MEDIUM — a 640 kB generated build artifact is committed at the repository root

`ssr-check.mjs` — 639,853 bytes, 13,718 lines of esbuild output with React bundled into it, and
not covered by `.gitignore`. It is the generated form of `ssr-entry.jsx`, the integrator's SSR
smoke check; that source file is legitimate tooling and can stay. A judge opening the repository
root meets the generated blob before anything else.

**Fix:** `git rm --cached ssr-check.mjs`, add it to `.gitignore`.

### 4 · MEDIUM — `EVENT.md` declares that unused recipes are deleted; they are not

`EVENT.md` states: *"Unused recipes are deleted before submission."* Still tracked at
`3113796`, and unreachable from `src/main.jsx` by import-graph analysis:

| Dead | Size |
|---|---|
| `src/recipes/` — all 13 capability modules | 43 files |
| `src/themes/` — 4 unused palettes (only `ochre` is imported by `app.css`) | 4 files |
| `src/lib/Loop.jsx` — the starter kit's to-do demo | 187 lines |
| `src/lib/db.js` — localStorage/Supabase adapter, for an app with no backend | 118 lines |

Reachable from `main.jsx`: only `App.jsx`, the four `features/*.jsx`, `lib/store.js`,
`lib/tariff.js`, `lib/dataset.js`, `lib/chart-scale.js`, `data/seed-p10.json`, `app.css`.

Two separate costs: the declaration is currently inaccurate, and dead code reads against
"is it built well". `EVENT.md` and `LICENSES.md` both describe the recipe library as pre-existing
material, so **deleting it is safe** — but if it is kept, that one sentence needs rewording.

### 5 · LOW — `package.json` still carries the starter kit's name

`"name": "hackathon-starter-react"`. `preflight.sh` only scans `src/` and `index.html` for
template branding, so it passes clean and this survives. One line.

### 6 · LOW — `BOARD.md` rows never reached `done-live`

All four unit rows sit at `pushed`. Not a judged artifact, but the board is the stated source for
the manifest's per-member contributions, and `CLAUDE.md`'s own rule is that a row earns
`done-live` only when its note names the live-URL check performed.

### 7 · Checklist — both repositories are still private

Unauthenticated `api.github.com` returns `404` for both `lsh26-t036-p08` and `lsh26-t036-p10`.
`PICKS.md` requires both public before the leader submits. Presumably deliberate timing — noted
so it is not forgotten at the wire.

---

## How this was checked

- An **independent reference implementation** of both recharge habits, written from the problem
  statement and clarifications R-16/R-33 *before* reading `src/lib/tariff.js`, run over all 25
  published cases.
- The **real components rendered server-side** inside a real `StoreProvider`, with the numbers
  scraped back off the rendered text and compared against that reference — so the check is
  against what a judge sees, not against the engine's own opinion of itself.
- A **250-case fuzz** over the organizers' fixture shape, asserting the R-16 invariants.
- **Import-graph analysis** from `src/main.jsx` for dead code.
- Repository artifacts read directly: `EVENT.md`, `README.md`, `LICENSES.md`,
  `evaluation-manifest.json`, `SUBMISSION.md`, `BOARD.md`, `NOTES.md`, `SPEC.md`.

Harnesses live in an untracked, git-excluded `.harness/` directory in my test clone; nothing
outside `testing/` was added to the repository.

**Companion document:** [`U3-findings.md`](U3-findings.md) — the item-4 test pass that produced
the fixes verified above.
