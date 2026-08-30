# Permissions template

Paired with `supabase-roles-rls.sql` in this folder. Fill in this table as you
rename that schema's placeholder tables and roles — the point of writing
capability-to-policy mappings this explicitly is that it plausibly explains
why the source drill's RLS shipped with zero judge-found holes on a Hard
problem under a 2-hour clock: every "who can do what" question has a named
policy as its answer, not a shrug.

"Approved" means `profiles.approved = true`. An authenticated user who isn't
approved yet gets exactly the public tier — a fresh signup and an anonymous
visitor see the same thing until an admin flips the switch.

## Capability matrix

| Capability | Public | Member | Staff | Admin |
|---|---|---|---|---|
| View public resource (the public directory/map/queue) | ✅ | ✅ | ✅ | ✅ |
| View gated resource (the detail behind login) | ❌ | ✅ (once approved) | ✅ (once approved) | ✅ (once approved) |
| File an activity-log entry | ❌ | ✅ (once approved) | ✅ (once approved) | ✅ (once approved) |
| Manage gated resource directly (edit without a log entry) | ❌ | ❌ | ✅ (once approved) | ✅ (once approved) |
| Manage public resource (create/edit/delete) | ❌ | ❌ | ❌ | ✅ |
| Manage accounts (set role, set approved) | ❌ | ❌ | ❌ | ✅ |

Member and Staff columns assume `approved = true`. Before that, every row in
those two columns is a flat ❌ — RLS gates on `is_approved()` regardless of
role, not on role alone. Rename the "Member"/"Staff"/"Admin" headers and the
row labels to your domain's actual nouns as you go; keep the ✅/❌ shape, it's
what makes this scannable by a judge or a teammate mid-build.

## How RLS enforces it

**View public resource.** `public_resource_select_public` — `for select to
public using (true)`. `public` covers `anon` and `authenticated` both, which
is why this is the one row where an unapproved or logged-out visitor still
gets a yes. Keep this table to only the fields a cold judge is allowed to
see — if a bullet's literal text needs one more field than this table
carries, use the public-teaser-view pattern (see the schema file's header)
instead of widening this table.

**View gated resource.** `gated_resource_select_approved` — `for select to
authenticated using (is_approved())`.

**File an activity-log entry.** `activity_log_insert_any_approved` — `for
insert to authenticated with check (author = auth.uid() and is_approved()
and app_role() in ('member','staff','admin'))`. The role list is every role
there is, so in practice this is "any approved account may file an entry" —
spelled out explicitly rather than left implicit. `author = auth.uid()` in
the `WITH CHECK` is what "author forced" means here: a client can omit
`author` (the column default fills in `auth.uid()`) but cannot set it to
someone else's id and have the insert succeed. `activity_log` has no
`UPDATE`/`DELETE` policy — a correction is a new row, not an edit to history.

**Manage gated resource directly.** `gated_resource_insert_staff_admin` /
`_update_staff_admin` / `_delete_staff_admin` — all gated on `is_approved()
and app_role() in ('staff','admin')`. This is the direct-edit path, distinct
from the activity-log path above; use it when staff correct a record without
going through a logged submission.

**Manage public resource.** `public_resource_insert_admin`,
`_update_admin`, `_delete_admin` — all `to authenticated` gated on
`app_role() = 'admin'`. This is genuine direct write access to the public
table, separate from any trigger-driven derivation you add on top of
`activity_log` (the source drill derived `shelters.headcount` this way — see
`apply_field_update` in miasma-drill-27aug/schema.sql if your problem needs
that shape; it wasn't generalized into this template because it's the one
piece that's genuinely domain-specific).

**Manage accounts.** `profiles_select_admin` and `profiles_update_admin`
give an admin read/write on every profile row, gated the same way
(`app_role() = 'admin'`). Every other authenticated user only gets
`profiles_select_own` / `profiles_update_own` — their own row, and
`guard_profile_privileges_trigger` (a `BEFORE UPDATE` trigger, not an RLS
policy) blocks even that from touching `role` or `approved` unless the
caller's own `app_role()` is already `admin`. That split — RLS decides
*which row*, the trigger decides *which column* — is why `profiles_update_own`
can stay a simple "own row" policy instead of needing per-column logic that
Postgres RLS doesn't support natively.

**Signup default.** `on_auth_user_created` (`AFTER INSERT ON auth.users`)
creates the profile row with `role = 'member'`, `approved = false`. There is
no path — API or otherwise — that creates a profile any other way, so every
new account starts at the bottom of the ladder and an admin has to
explicitly promote it (see the bootstrap block at the bottom of
`supabase-roles-rls.sql` for the one time that's done outside the API, via
the SQL Editor as `postgres`, which is exempt from the guard trigger's admin
check).

## What this template does not include

**The admin approve/re-role UI.** This doc and its paired schema cover the
database side only — the RLS policies above are what actually protects
"manage accounts," so a client-side admin panel is a UI convenience, not the
security boundary. Building and testing one for both the React and Svelte
kits wasn't cheap enough to bundle into this pass; treat
`miasma-drill-27aug/src/lib/admin-api.js` and
`src/components/AdminPanel.jsx` as the reference implementation (a table with
`setRole`/`setApproved` actions, a "pending first" sort, and a self-demotion
guard) and port by hand against the policies above.

**A trigger that derives one table's data from another's log.** If your
problem needs "an approved user submits a report, and a summary table
updates automatically" (the source drill's `updates` → `shelters.headcount`
shape), that trigger is domain-specific enough that it wasn't generalized
into `activity_log` here. See `apply_field_update()` in
`miasma-drill-27aug/schema.sql` for a `SECURITY DEFINER` trigger that does
exactly this, callable as a pattern reference.
