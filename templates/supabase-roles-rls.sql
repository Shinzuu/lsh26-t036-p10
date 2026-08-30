-- ============================================================================
-- TEMPLATE: roles + RLS skeleton (public / approved-staff / admin)
-- ============================================================================
--
-- Reach for this when a problem's bullets need per-role access control — "my"
-- anything past a single shared table, an approval workflow ("pending until
-- an admin approves"), or a public/private split of the same domain object
-- ("everyone sees the location, only staff see the detail"). This is the
-- "multi-role dashboard" archetype in playbook/05-archetypes.md. If your
-- problem is a single shared table with no login, you don't need this — use
-- the plain `schema.sql` one level up (anon-full-access, no roles).
--
-- PROVENANCE: generalized, comments intact, from miasma-drill-27aug's
-- schema.sql (Relief Lens, 27 Aug drill, Problem 7 "Hard"). The three-tier
-- shape below — public / approved-staff / admin — is exactly what shipped:
-- built correctly from scratch in ~35 minutes with zero RLS bugs found by
-- judges ("unusually thorough RLS," Technical execution 12/15). Only the
-- domain (shelters / shelter_needs / updates) has been stripped out and
-- replaced with three placeholder tables that demonstrate the same three
-- policy shapes, so the RLS logic below is proven, not invented for this
-- template.
--
-- WHAT TO RENAME before you paste this into Supabase → SQL Editor:
--   1. `public.user_role` enum values ('admin', 'staff', 'member') → your
--      domain's actual role names. Keep exactly 3 tiers unless you have a
--      strong reason not to — every helper/trigger below assumes "admin" is
--      the top role and everyone else needs `approved = true` before they
--      can do anything beyond the public tier.
--   2. `public_resource` → your public-readable table (map pins, a
--      directory, anything a cold, logged-out judge must see — see the
--      "public teaser view" pattern below if only PART of a table is
--      public).
--   3. `gated_resource` → your approved-only table (the private detail that
--      sits behind login + approval).
--   4. `activity_log` → your append-only submission table, if your problem
--      has one (field reports, orders, an audit trail — anything where a
--      staff member files a row). Delete this table entirely if your
--      problem doesn't need one.
--   5. The demo-user emails and role assignments in the bootstrap block at
--      the bottom.
--
-- Paired doc: PERMISSIONS-TEMPLATE.md in this folder. Fill in its capability
-- matrix as you rename policies, so "who can do what" maps explicitly to
-- "which policy is the reason" — that explicitness is plausibly why the
-- source drill shipped zero RLS holes under a 2-hour clock.
--
-- Idempotent: every run drops and rebuilds every object below, then reseeds
-- demo data from scratch. Re-running this file WIPES any data a demo session
-- has added — fine for a hackathon rehearsal, not for a project you intend
-- to keep live data in.
--
-- ----------------------------------------------------------------------------
-- RELATED PATTERNS worth knowing before you build on this
-- ----------------------------------------------------------------------------
--
-- PUBLIC/PRIVATE SPLIT, COMPOSED CLIENT-SIDE. When RLS forces you to split one
-- logical entity across a public table and an approved-only table (exactly
-- what `public_resource` / `gated_resource` model below), don't widen the
-- public table's columns to dodge a second fetch — compose the two
-- client-side instead (fetch both, join by id in JS). This is the one
-- genuinely new wrinkle the drill surfaced on top of the storage adapter
-- every kit already ships: `src/lib/db.js`'s supabase-or-localStorage facade
-- (picking a backend behind one interface) is not new here — the drill's
-- `src/lib/api.js` is just a correct, validated instance of that same
-- convention applied to a split-table domain. `fetchShelters()` +
-- `fetchNeeds()`, composed by the caller, is the worked example (see
-- miasma-drill-27aug/src/lib/api.js).
--
-- PUBLIC TEASER VIEW. If a bullet's literal text requires a field visible to
-- a cold, logged-out judge, but your instinct — once roles/RLS exist — is to
-- gate the whole table behind auth, don't let the RLS model silently narrow
-- the bullet's scope. Ship a narrow public VIEW exposing exactly the fields
-- the bullet's literal text asks for (see the commented-out
-- `public_resource_teaser` view below) — writes and full detail stay behind
-- RLS, but the read the bullet explicitly asks for still works with no
-- login. Re-read every bullet's literal wording against the access model any
-- time a pivot adds roles/RLS after bullets were already scoped; a spec that
-- quietly narrows "no login required" to "logged in required" costs marks
-- for zero extra minutes of work — it happened on the source drill (~5
-- marks, for a rewrite that took no time at all).
--
-- ADMIN APPROVE/RE-ROLE UI — POINTER, NOT A SHIPPED RECIPE. This file is the
-- database side only. The matching admin panel (approve/revoke, change
-- role, a self-demotion guard so an admin can't lock themselves out, a
-- "pending first" sort) is deliberately not shipped here as a tested recipe
-- — porting it to both the React and Svelte kits and meeting the recipe
-- contract in `src/recipes/README.md` (self-contained, ships its states,
-- verified with `node --test`) wasn't cheap enough to do in the same pass as
-- this template. Treat miasma-drill-27aug's `src/lib/admin-api.js` and
-- `src/components/AdminPanel.jsx` as the reference implementation and port
-- by hand: it's a table with two actions (`setRole`, `setApproved`) wired to
-- the `profiles_update_admin` policy and `guard_profile_privileges_trigger`
-- below — both already block a non-admin (or a stripped-client-code
-- attacker) from touching `role`/`approved`, so the panel only needs to show
-- a friendly error, never re-implement the check.
-- ============================================================================

-- =============================================================================
-- CLEAN SLATE — drop in dependency order so re-running this file is safe.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop view if exists public.public_resource_teaser;

drop table if exists public.activity_log cascade;
drop table if exists public.gated_resource cascade;
drop table if exists public.public_resource cascade;
drop table if exists public.profiles cascade;

drop function if exists public.guard_profile_privileges() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_approved() cascade;
drop function if exists public.app_role() cascade;

drop type if exists public.user_role cascade;

-- =============================================================================
-- ENUM
-- =============================================================================

create type public.user_role as enum ('admin', 'staff', 'member');

-- =============================================================================
-- TABLES
-- =============================================================================

-- One row per authenticated user. Created by the auth.users trigger below —
-- nobody INSERTs into this table directly from the client.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        public.user_role not null default 'member',
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Public-facing directory. Public SELECT for anon + authenticated alike — the
-- fields here are exactly what a cold, logged-out judge is allowed to see.
-- Anything sensitive belongs in gated_resource instead, not as an extra
-- column here. Rename to your domain noun (a map's shelters, a queue's
-- tickets, a catalogue's listings, ...).
create table public.public_resource (
  id          text primary key,
  label       text not null,
  status      text,
  updated_at  timestamptz not null default now()
);

-- Detail behind login + approval. One row (or many) per public_resource row.
-- Rename to your domain noun (needs, line items, private notes, ...).
create table public.gated_resource (
  id            bigserial primary key,
  resource_id   text not null references public.public_resource (id) on delete cascade,
  detail        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- Append-only submission log — a staff member files a row, nobody edits
-- history. Delete this table if your problem has no "field report" shape.
-- `author` defaults to auth.uid() server-side; never send it from the client.
create table public.activity_log (
  id            bigserial primary key,
  resource_id   text not null references public.public_resource (id) on delete cascade,
  author        uuid references public.profiles (id) default auth.uid(),
  payload       jsonb not null default '{}'::jsonb,
  note          text,
  created_at    timestamptz not null default now()
);

create index activity_log_resource_id_idx on public.activity_log (resource_id);

-- =============================================================================
-- HELPER FUNCTIONS
--
-- Both are STABLE + SECURITY DEFINER with an explicit search_path: they read
-- public.profiles by auth.uid() so RLS policies elsewhere can gate on role /
-- approval without every policy re-querying profiles (and without a policy on
-- profiles needing to allow cross-user reads just so its OWN checks work).
-- Named app_role() (not current_role — that identifier is reserved).
-- =============================================================================

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.app_role() to anon, authenticated;
grant execute on function public.is_approved() to anon, authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- New signup → profile row, role='member', approved=false. Unapproved users
-- (any role) see nothing beyond the public tier until an admin flips
-- approved=true.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, approved)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'member', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Blocks a user from elevating their own role/approved via the
-- profiles_update_own policy. Only checked when auth.uid() is present (i.e.
-- the request came through PostgREST/GoTrue as a logged-in user) — a NULL
-- auth.uid() means the statement is running as the SQL-editor superuser or
-- the service_role key, both of which already bypass RLS entirely, so this
-- is the deliberate escape hatch the bootstrap block at the bottom of this
-- file relies on to promote the first admin.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.approved is distinct from old.approved)
     and public.app_role() is distinct from 'admin' then
    raise exception 'only an admin can change role or approved';
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileges_trigger
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.public_resource enable row level security;
alter table public.gated_resource enable row level security;
alter table public.activity_log enable row level security;

-- ---------- profiles ----------
-- Own row always; admin reads/updates every row. No INSERT/DELETE policy —
-- rows are created only by the signup trigger (SECURITY DEFINER, bypasses
-- RLS) and are never deleted from the client.

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (app_role() = 'admin' and is_approved());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- role/approved are still columns on "own row", but guard_profile_privileges_trigger
-- rejects any attempt to change them unless the caller is already an admin.

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (app_role() = 'admin' and is_approved())
  with check (app_role() = 'admin' and is_approved());

-- ---------- public_resource ----------
-- Public SELECT (the map / directory / queue) for anon + authenticated
-- alike. All writes are admin-only CRUD.

drop policy if exists public_resource_select_public on public.public_resource;
create policy public_resource_select_public on public.public_resource
  for select to public
  using (true);

drop policy if exists public_resource_insert_admin on public.public_resource;
create policy public_resource_insert_admin on public.public_resource
  for insert to authenticated
  with check (app_role() = 'admin' and is_approved());

drop policy if exists public_resource_update_admin on public.public_resource;
create policy public_resource_update_admin on public.public_resource
  for update to authenticated
  using (app_role() = 'admin' and is_approved())
  with check (app_role() = 'admin' and is_approved());

drop policy if exists public_resource_delete_admin on public.public_resource;
create policy public_resource_delete_admin on public.public_resource
  for delete to authenticated
  using (app_role() = 'admin' and is_approved());

-- ---------- gated_resource ----------
-- Approved authenticated users read. Staff+admin write directly.

drop policy if exists gated_resource_select_approved on public.gated_resource;
create policy gated_resource_select_approved on public.gated_resource
  for select to authenticated
  using (is_approved());

drop policy if exists gated_resource_insert_staff_admin on public.gated_resource;
create policy gated_resource_insert_staff_admin on public.gated_resource
  for insert to authenticated
  with check (is_approved() and app_role() in ('staff', 'admin'));

drop policy if exists gated_resource_update_staff_admin on public.gated_resource;
create policy gated_resource_update_staff_admin on public.gated_resource
  for update to authenticated
  using (is_approved() and app_role() in ('staff', 'admin'))
  with check (is_approved() and app_role() in ('staff', 'admin'));

drop policy if exists gated_resource_delete_staff_admin on public.gated_resource;
create policy gated_resource_delete_staff_admin on public.gated_resource
  for delete to authenticated
  using (is_approved() and app_role() in ('staff', 'admin'));

-- ---------- activity_log ----------
-- Approved authenticated users read (audit trail). Any approved role can
-- file an entry; author is verified against auth.uid() in the CHECK so
-- nobody can file under someone else's name. Append-only — no UPDATE/DELETE
-- policy; a correction is a new row, not an edit to history.

drop policy if exists activity_log_select_approved on public.activity_log;
create policy activity_log_select_approved on public.activity_log
  for select to authenticated
  using (is_approved());

drop policy if exists activity_log_insert_any_approved on public.activity_log;
create policy activity_log_insert_any_approved on public.activity_log
  for insert to authenticated
  with check (
    author = auth.uid()
    and is_approved()
    and app_role() in ('member', 'staff', 'admin')
  );

-- =============================================================================
-- OPTIONAL: PUBLIC TEASER VIEW
--
-- Uncomment and adjust if a bullet's literal text needs a field that lives in
-- gated_resource visible to a cold, logged-out judge (see the "PUBLIC TEASER
-- VIEW" note in the header). Expose ONLY the specific fields the bullet asks
-- for — this is a narrow read model sitting next to full RLS, not a
-- replacement for it.
-- =============================================================================

-- create view public.public_resource_teaser as
--   select
--     r.id,
--     r.label,
--     r.status,
--     (
--       select jsonb_agg(g.detail order by g.updated_at desc)
--       from public.gated_resource g
--       where g.resource_id = r.id
--       limit 3
--     ) as teaser_detail
--   from public.public_resource r;
--
-- grant select on public.public_resource_teaser to anon, authenticated;

-- =============================================================================
-- BOOTSTRAP — run by hand AFTER the SQL above.
--
-- auth.users cannot be seeded from this file: it is managed by GoTrue, and a
-- raw INSERT skips password hashing / email-confirmation bookkeeping and
-- leaves an account that cannot log in. Create demo accounts instead:
--
--   Dashboard → Authentication → Users → Add user → Create new user
--   (tick "Auto Confirm User" so no email round-trip is needed)
--
--     admin@example.demo
--     staff@example.demo
--     member@example.demo
--
-- The signup trigger fires immediately and gives each one a profiles row
-- with role='member', approved=false. Promote them by running this in the
-- SQL Editor (as the postgres role — auth.uid() is NULL there, so
-- guard_profile_privileges_trigger's admin check does not apply; see the
-- comment on that function above):
--
--   update public.profiles set role = 'admin', approved = true
--     where id = (select id from auth.users where email = 'admin@example.demo');
--
--   update public.profiles set role = 'staff', approved = true
--     where id = (select id from auth.users where email = 'staff@example.demo');
--
--   update public.profiles set role = 'member', approved = true
--     where id = (select id from auth.users where email = 'member@example.demo');
--
-- Verify:
--
--   select id, full_name, role, approved from public.profiles;
-- =============================================================================
