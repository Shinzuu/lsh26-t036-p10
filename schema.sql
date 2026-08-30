-- Supabase schema for the starter's demo loop.
-- Paste into Supabase → SQL Editor → Run. Takes about 20 seconds.
--
-- Only needed when going multi-device. The app runs fully on localStorage until
-- VITE_SUPABASE_URL is set, so this can wait until the core loop already works.

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Ordering by created_at is the app's only read pattern. One index, not five.
create index if not exists items_created_at_idx on items (created_at desc);

alter table items enable row level security;

-- ---------------------------------------------------------------------------
-- DEMO POLICY — anonymous full access.
--
-- Deliberate for a 4-hour build with no auth: a judge opens the link and it
-- works, with no signup wall in front of the core loop. It is NOT a production
-- policy — anyone with the anon key can read and write every row.
--
-- Say this out loud if a judge asks about security. Naming the tradeoff scores
-- better on "is it built well" than pretending it isn't there. If the app grows
-- an auth screen, delete these and scope by auth.uid().
-- ---------------------------------------------------------------------------
drop policy if exists items_anon_all on items;
create policy items_anon_all on items
  for all
  to anon
  using (true)
  with check (true);
