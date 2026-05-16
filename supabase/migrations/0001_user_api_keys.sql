-- Per-user storage for the Google Maps API key (BYO model).
-- Run this in the Supabase SQL editor for your project.

create table if not exists public.user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_maps_api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;

-- A user can only see/modify their own row. The service role still bypasses this
-- (Supabase default), so do NOT expose the service-role key to the client.

drop policy if exists "user_api_keys_select_own" on public.user_api_keys;
create policy "user_api_keys_select_own" on public.user_api_keys
  for select using (auth.uid() = user_id);

drop policy if exists "user_api_keys_insert_own" on public.user_api_keys;
create policy "user_api_keys_insert_own" on public.user_api_keys
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_api_keys_update_own" on public.user_api_keys;
create policy "user_api_keys_update_own" on public.user_api_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_api_keys_delete_own" on public.user_api_keys;
create policy "user_api_keys_delete_own" on public.user_api_keys
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh on writes.
create or replace function public.set_user_api_keys_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_api_keys_set_updated_at on public.user_api_keys;
create trigger user_api_keys_set_updated_at
  before update on public.user_api_keys
  for each row execute function public.set_user_api_keys_updated_at();
