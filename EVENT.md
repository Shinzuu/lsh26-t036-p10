# EVENT.md

| | |
|---|---|
| Team ID | `LSH26-T036` (Miasma) |
| Problem ID | `P10` — Prepaid Meter Recharge Advisor (Tier 02) |
| Event start code | `LSH26-8490-C900` |
| Repository | `lsh26-t036-p10` — one repository, this problem only |
| Live URL | https://lsh26-t036-p10.pages.dev |

## Registered members

| Member | GitHub |
|---|---|
| shinzuu (team leader) | `Shinzuu` |
| Rimjhim | `RimjhimD` |
| Robiul | `MDRobiulhassan` |
| Dip | `Dip-it11` |

## Declaration of pre-event material

Commit `5e9cc8b`, "Starter kit baseline (pre-existing work, MIT — see LICENSES.md)",
was pushed at the start of the event and contains **generic scaffolding written before
6:00 pm**. It is declared here in full:

- A Vite + React 19 + Tailwind 4 application skeleton: build config, entry point, an
  app shell with a placeholder list feature, and a storage adapter
  (localStorage, optionally Supabase).
- `src/recipes/` — thirteen self-contained, pre-solved capabilities (CSV import,
  search and filter, charts, auth, upload, map, realtime, LLM, Bangladeshi formats,
  export, matching, queue, corroboration) with their own tests.
- `src/themes/` — five accessible colour palettes.
- `scripts/` — a secrets-and-build preflight check, a live-URL smoke test, and a video
  compression helper.
- Document templates: `README-TEMPLATE.md`, `SUBMISSION-TEMPLATE.md`, `BOARD.md`,
  `LICENSES.md`, `CLAUDE.md`, `DEPLOY.md`, and a Supabase schema template.

None of it is specific to P10 or to any other problem in this event. It was written
between 14 and 29 August 2026 as a general-purpose starter, it addresses no problem
statement, and it contains no prepaid-meter, tariff, slab or recharge logic of any
kind. Every line of P10 work — the tariff engine, the balance rebuild, the two
questions, the habit comparison, the data model and the user interface — was written
after 6:00 pm on 30 August 2026 and is visible as such in this repository's history.

Unused parts of the starter kit are removed before submission; whatever remains is
listed in `LICENSES.md`.

## Git history

History is not squashed, deleted or rewritten after 6:00 pm. Unit branches are merged
with merge commits.
