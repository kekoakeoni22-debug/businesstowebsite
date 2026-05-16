-- One generated HTML template per (user, business primary_type). Filled with
-- business-specific data at render time, so subsequent generations for the
-- same primary_type don't need a fresh LLM call.

create table if not exists public.site_templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_type text not null,
  html_template text not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, primary_type)
);

alter table public.site_templates enable row level security;

drop policy if exists "site_templates_select_own" on public.site_templates;
create policy "site_templates_select_own" on public.site_templates
  for select using (auth.uid() = user_id);

drop policy if exists "site_templates_insert_own" on public.site_templates;
create policy "site_templates_insert_own" on public.site_templates
  for insert with check (auth.uid() = user_id);

drop policy if exists "site_templates_update_own" on public.site_templates;
create policy "site_templates_update_own" on public.site_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "site_templates_delete_own" on public.site_templates;
create policy "site_templates_delete_own" on public.site_templates
  for delete using (auth.uid() = user_id);

create or replace function public.set_site_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_templates_set_updated_at on public.site_templates;
create trigger site_templates_set_updated_at
  before update on public.site_templates
  for each row execute function public.set_site_templates_updated_at();
