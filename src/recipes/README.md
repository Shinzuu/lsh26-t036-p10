# Recipes

Pre-solved capabilities. Each one is a hole that costs 30–45 minutes at 18:00 if
you have never done it under pressure, and about two minutes if it is already
sitting here working.

**These are not a framework.** Nothing imports them by default and the app builds
fine with the whole folder deleted. On the night you copy the one you need into
your code and edit it. Do not try to wire them together.

## The contract every recipe follows

1. **Self-contained.** One folder, no imports from another recipe, no shared
   helper module. Copy-paste has to work.
2. **Zero new required dependencies.** Anything needing a package lazy-loads it
   and says so at the top of its README, with the exact install command. The
   starter kit's own `package.json` stays as it is.
3. **Works with no backend.** Same rule as `src/lib/db.js` — degrade to
   localStorage or in-memory rather than requiring Supabase to demo.
4. **Ships its states.** Loading, empty, error, and the failure path. A recipe
   that only handles the happy path has moved the 30-minute hole rather than
   filled it.
5. **Verified.** Every recipe has been run, not just written. If it has logic
   worth testing it ships a `*.test.mjs` runnable with `node --test`.

This is the React port of the Svelte starter kit's recipe pack: same
capabilities, same contract, same pure `*.js`/`*.test.mjs` logic modules
(copied verbatim — they never depended on Svelte), with each `*.svelte`
component rewritten as a `*.jsx` React function component (hooks, same
props, same Tailwind classes). `matching/`, `queue/`, and `corroborate/` are
logic-only (no component either side, same shape as `bd-formats/`) and were
authored directly, then mirrored to the Svelte kit rather than ported from it.

## Status

All thirteen built/ported and verified — every component compiles, no key
material anywhere in the tree. Re-check any time with:

```bash
bash src/recipes/verify.sh
```

The app's JS bundle is unchanged with all thirteen present — nothing imports
them, so they cost nothing until you copy one in. The CSS bundle does grow,
because Tailwind scans these files for class names; that disappears when you
delete the recipes you didn't use.

## Index

| Recipe | Use when the problem involves | Extra deps |
|---|---|---|
| `csv-import/` | a spreadsheet, bulk upload, "import your data" | none |
| `search-filter/` | finding things in a list, typeahead, filtering | none |
| `charts/` | any dashboard, trend, report, "show me the numbers" | none |
| `auth/` | accounts, "my" anything, per-user data | none |
| `upload/` | photos, documents, evidence, receipts | none |
| `map/` | location, delivery, "near me", incident reporting | Leaflet (lazy, loaded from CDN — not `react-leaflet`) |
| `realtime/` | live updates, collaboration, queues, notifications | none |
| `llm/` | summarise, classify, extract, chat, generate | none |
| `bd-formats/` | Bangladeshi money, phone numbers, Bangla digits and dates | none |
| `export/` | receipts, reports, "download", "print", QR codes | none |
| `matching/` | pairwise assignment, n-way swap cycles, minimal-transfer debt settlement — "match two sides" | none |
| `queue/` | queue position, status transitions, "call next" without race conditions | none |
| `corroborate/` | turning many independent reports into one recurrence signal — "this keeps happening here" | none |

## Using one

```bash
cp -r src/recipes/csv-import src/lib/
```

Then delete the parts you do not need. A recipe left half-used in the tree is
dead code, and dead code is a straight loss on "is it built well" — see
`../../../playbook/01-rubric.md`.

## Related: templates/ (not recipes)

`../../templates/supabase-roles-rls.sql` + `PERMISSIONS-TEMPLATE.md` — the
role-based-access schema pattern (profiles, role enum, RLS policy set, signup
and privilege-guard triggers) proven in the 27 Aug drill. Not a recipe (no
component, no tests) — a SQL starting point for any bullet that needs logins
with different powers.
