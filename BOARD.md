# Board — who is doing what, right now

**This file is the shared canvas between the four Claude sessions on this repo.** Chat
and memory do not sync across devices; this file does. Update your row when your status
changes, commit (`board: U2 building`), push. Pull before reading — a stale board is
worse than no board.

**Repo: `lsh26-t036-p10` · P10 Prepaid Meter Recharge Advisor · Tier 02**
**Live: https://lsh26-t036-p10.pages.dev**
**Integrator: shinzuu** — owns merges, deploys, and `src/App.jsx`, `src/lib/store.js`,
`src/app.css`, `index.html`, `package.json`.

**MERGE FREEZE: 21:15.** After it, no feature merges — only fixes the integrator
explicitly requests, plus the submission artifacts.

**SUBMIT AS SOON AS THE GATE PASSES.** The early bonus is measured from the Google Form
receipt, not from any commit (organizer clarification: *"Commit times are not used."*).
The gate is at least 3 of the 4 required items fully passing on **both** P08 and P10.
The moment that is true on both repos, the team leader submits — do not wait for 4/4.
The submission can be edited later, but the recorded time becomes the time of the edit.

| Receipt | Bonus |
|---|---|
| 20:00 | 5.00 |
| 20:30 | 3.75 |
| 21:00 | 2.50 |
| 21:30 | 1.25 |
| 21:50+ | 0 |

Read `SPEC.md` in full before building. It carries the four required items and the
clarifications verbatim, the data model, the fixed engine and store export shapes, and
the per-unit prompts.

| Unit | Item | Owner | Branch | Status | Last update (time + note) |
|---|---|---|---|---|---|
| U1 | R1 — household, ≥6 months of daily readings + recharges, light/heavy/late-large months labelled | shinzuu | `u1-household` | pushed | 18:52 — branch pushed, 15 tests pass. MERGED into main at 18:46 by the integrator; awaiting deploy + live check before done-live. |
| U2 | R2 — rebuild the balance day by day on the tariff, fixed charges on the month's first recharge, VAT, balance line with recharge markers | Rimjhim | `u2-tariff-engine` | todo | — |
| U3 | R3 — run-out date, and the amount to recharge today split into energy / higher-slab / fixed / VAT | Robiul | `u3-questions` | pushed | 19:02 — `Questions.jsx` only. Verified by esbuild compile and an SSR harness against a reference engine over all 25 fixture cases (parts sum to total in every one). MERGED 19:1x; needs the real `tariff.js` before it can be checked live. |
| U4 | R4 — compare the two recharge habits over three months on identical consumption | Dip | `u4-habit-compare` | todo | — |

Status values: `todo` → `building` → `pushed` → **`done-live`**. A row only earns
`done-live` when its note names the exact live-URL check performed — e.g. "verified live:
opened S045's trace, AB printed for Biology, rule says absent". "The crash stopped" is
not `done-live`; "looks right" is not `done-live`.

## Rules that cost marks if broken

- **Do not squash, delete or rewrite git history after 18:00.** Judges read the history.
  Inside this repo use `git pull --no-rebase`, never `git pull --rebase`.
- Integrator-only files are `src/App.jsx`, `src/lib/store.js`, `src/app.css`,
  `index.html`, `package.json`. Need a change there? Post the exact diff below as a
  blocker; do not make it yourself.
- `BOARD.md` and `NOTES.md` are the only files committed directly to `main`.
- No docs or polish commits while any required item is broken.
- `bash scripts/preflight.sh` before every push.

## Blockers / requests to the integrator

One line each, newest on top. The integrator clears these and deletes the line.

- (cleared 19:15 — U3's requests are all satisfied: `App.jsx` renders `Questions`,
  `store.js` exists, `SPEC.md` is in the repo, and the merge freeze is set.)
- (cleared 18:46 — `src/App.jsx` now renders `DataSource`, and `src/lib/store.js` exists. U1 is visible.)

## Notes — things everyone should know

Gotchas found mid-build: rule quirks, deploy traps, licence flags. One line each.

- The shell, `src/lib/store.js` and a placeholder for every unit-owned file are merged. Your placeholder names you in a banner — replace the file wholesale, do not build around it.
- `src/lib/tariff.js` currently holds signature-only stubs so the app builds and U3/U4 can lay out against real shapes. U2 replaces it entirely, keeping every export name. Its SLABS, DEMAND_CHARGE_PAISA, METER_RENT_PAISA and VAT_PERCENT constants are already correct, straight from the problem statement.
- U1 is merged, so `SEED`, `parseCase`, `parseCases`, `monthSummary` and `dateRange` are available from `src/lib/dataset.js`, and the store seeds from the real 181-day household.
- **Verify on your own branch's preview URL, no merge needed.** `npm run build && npx wrangler pages deploy dist --project-name lsh26-t036-p10 --branch <your-branch>` gives you `https://<your-branch>.lsh26-t036-p10.pages.dev`.
- SPEC.md ends with a reference oracle for required item 4: the expected answer for all 25 published cases. Every difference is 0.00 or exactly 82.00 taka. Anything else means the implementation is wrong.
- Work in integer paisa inside the engine. 4.63 taka is 463 paisa. Floats drift over 181 compounding days and put every downstream answer quietly wrong.
