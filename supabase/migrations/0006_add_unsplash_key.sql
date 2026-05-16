-- Optional third BYO key for Unsplash Source-style hero photos via the
-- Unsplash Search API. Lookup is server-side; the row remains RLS-protected.

alter table public.user_api_keys
  add column if not exists unsplash_access_key text;
