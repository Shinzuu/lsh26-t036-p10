# NOTES.md

Gotchas found mid-build that affect more than one unit. One line each, newest on top.
Chat evaporates; this file syncs.

- **18:57 (U1) — the organizers' `format_note` for P10 is truncated.** It cuts off
  mid-sentence at "Item 4 runs on the three `comparison.months`: `source` `readings`
  uses the case's own", so what a `source` other than `"readings"` means is not
  documented anywhere in the pack. All 25 published cases use `source: "readings"`
  with `daily_units: null`. SPEC.md's rule: `"readings"` uses the case's own day
  readings for those three months, anything else uses `comparison.daily_units` as a
  flat figure for every day. Hits U4. Worth one question in the support channel —
  do not guess silently.
- **18:57 (U1) — `import ... from './x.json'` needs an import attribute to run under
  `node --test`.** Vite accepts the bare form, Node does not, so a test importing a
  module that loads JSON fails with `Unknown file extension ".json"`. Written as
  `import seed from '../data/seed-p10.json' with { type: 'json' }`, which both Vite 8
  and Node 22 accept. Verified in both.
- **18:57 (U1) — a component only referenced by an unimported module is not in the
  bundle, and `npm run build` still passes.** The bundle stayed byte-identical at
  195.08 kB with `DataSource.jsx` fully written. `npm run build` passing does not mean
  your code shipped — check the bundle size moved, or grep the deployed bundle with
  `bash scripts/smoke-live.sh <url> <a string only your unit contains>`.
- **18:57 (U1) — tests do not prove a component renders.** Compile every `.jsx` before
  calling it done:
  `npx esbuild src/features/Yours.jsx --loader:.jsx=jsx --jsx=automatic --bundle --format=esm --external:react --external:react-dom --outfile=/dev/null`
