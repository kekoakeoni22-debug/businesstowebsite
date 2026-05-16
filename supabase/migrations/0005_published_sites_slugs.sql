-- Replace UUID ids with human-readable slugs derived from the business name.
-- Duplicates (across users) get a numeric suffix: tonys-pizza, tonys-pizza-2.
-- The id IS the slug, so URLs look like /site/tonys-pizza.
--
-- This drops the previous published_sites table — if you'd already published
-- a few sites under UUIDs, those links go away. Re-publish to get slug URLs.

drop table if exists public.published_sites cascade;

create table public.published_sites (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text,
  html text not null,
  created_at timestamptz not null default now()
);

alter table public.published_sites enable row level security;

create policy "published_sites_public_read" on public.published_sites
  for select using (true);

create policy "published_sites_insert_own" on public.published_sites
  for insert with check (auth.uid() = user_id);

create policy "published_sites_delete_own" on public.published_sites
  for delete using (auth.uid() = user_id);

create index if not exists published_sites_user_created_idx
  on public.published_sites (user_id, created_at desc);

-- Helps the slug-availability LIKE query the client runs before each insert.
create index if not exists published_sites_id_prefix_idx
  on public.published_sites (id text_pattern_ops);
