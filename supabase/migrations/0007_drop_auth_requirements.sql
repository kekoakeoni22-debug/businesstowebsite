-- Drop the per-user split on site_templates and treat it as a global cache.
-- The template is generated from a generic prompt keyed by primary_type, so
-- one template per primary_type is shared across all visitors. Signed-in
-- visitors are the only ones who can trigger a NEW template generation —
-- that's enforced at the /api/generate-site edge route, not in the table.
-- Anonymous visitors can read the cache freely.
drop table if exists public.site_templates cascade;

create table public.site_templates (
  primary_type text primary key,
  html_template text not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_templates enable row level security;

create policy "site_templates_select_all" on public.site_templates
  for select using (true);

create policy "site_templates_insert_all" on public.site_templates
  for insert with check (true);

create policy "site_templates_update_all" on public.site_templates
  for update using (true) with check (true);

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

-- published_sites stays per-user — anonymous visitors must sign in to
-- publish, which is part of the intended onboarding flow. No changes to
-- that table here.
