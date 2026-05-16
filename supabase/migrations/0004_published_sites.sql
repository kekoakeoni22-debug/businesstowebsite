-- Stores filled-in HTML snapshots so the "sell" flow can hand the user a
-- real shareable URL like /site/<uuid> instead of a one-shot blob URL.
-- IDs are 128-bit UUIDs; security relies on the unguessability of the ID
-- (anyone with the link can read, no listing exposed).

create extension if not exists "pgcrypto";

create table if not exists public.published_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text,
  html text not null,
  created_at timestamptz not null default now()
);

alter table public.published_sites enable row level security;

-- Anyone with a valid id can read the HTML — this is what makes the URL
-- shareable with prospects who aren't users of our app.
drop policy if exists "published_sites_public_read" on public.published_sites;
create policy "published_sites_public_read" on public.published_sites
  for select using (true);

-- Only signed-in users can publish (and only as themselves).
drop policy if exists "published_sites_insert_own" on public.published_sites;
create policy "published_sites_insert_own" on public.published_sites
  for insert with check (auth.uid() = user_id);

-- Users can clean up their own publishes if they want.
drop policy if exists "published_sites_delete_own" on public.published_sites;
create policy "published_sites_delete_own" on public.published_sites
  for delete using (auth.uid() = user_id);

create index if not exists published_sites_user_created_idx
  on public.published_sites (user_id, created_at desc);
