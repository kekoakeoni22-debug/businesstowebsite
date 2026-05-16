-- Add an optional Gemini API key column, and make google_maps_api_key
-- nullable so users can save one without the other.

alter table public.user_api_keys
  alter column google_maps_api_key drop not null;

alter table public.user_api_keys
  add column if not exists gemini_api_key text;
