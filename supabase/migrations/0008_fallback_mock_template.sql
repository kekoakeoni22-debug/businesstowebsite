-- Single-row table that holds the HTML template the paywall mock-streams
-- when no row in site_templates matches the current business's primary_type.
-- The CHECK on the primary key + default value enforces a singleton: only
-- one row can ever exist, and it's always at id = 'default'.

create table if not exists public.fallback_mock_template (
  id text primary key default 'default' check (id = 'default'),
  html_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fallback_mock_template enable row level security;

-- Public read so the browser can pull the fallback during mock generation.
-- Writes are not allowed via RLS — paste new HTML in the SQL editor when
-- you want to update the template:
--
--   insert into public.fallback_mock_template (id, html_template)
--   values ('default', '<!doctype html>...your full HTML here...')
--   on conflict (id) do update set
--     html_template = excluded.html_template,
--     updated_at = now();

drop policy if exists "fallback_mock_template_select_all"
  on public.fallback_mock_template;
create policy "fallback_mock_template_select_all"
  on public.fallback_mock_template
  for select using (true);
