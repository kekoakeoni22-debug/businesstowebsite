# Business To Website AI

Next.js app that searches local businesses via the Google Maps **Places API (New)**, generates a one-page marketing site for each via Gemini, and publishes it under a name-based slug at `/site/<slug>`.

- **Auth**: Supabase Auth — sign in with Google.
- **Server-side API keys**: Google Maps + Gemini keys live in Vercel environment variables. Nothing per-user.

## 1. Create the Supabase project

1. Go to <https://app.supabase.com> → **New project**.
2. After it provisions, open **Project Settings → API Keys**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (starts with `sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Open **SQL Editor** and run each migration in `supabase/migrations/`. The relevant ones now are:
   - `0003_site_templates.sql` — cached HTML templates per (user_id, primary_type)
   - `0005_published_sites_slugs.sql` — slug-based published sites
   - (Earlier `user_api_keys` migrations can be skipped; that table is no longer used. If it already exists you can `drop table public.user_api_keys`.)

## 2. Configure Google sign-in

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for dev, your Vercel URL for prod.
- **Redirect URLs**: add both
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-DOMAIN/auth/callback`

In **Authentication → Providers → Google**: create OAuth credentials at <https://console.cloud.google.com/apis/credentials> (OAuth client → Web application). Authorized redirect URI is the one Supabase shows on the provider page, typically `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Paste the client ID + secret back into Supabase.

## 3. Environment variables

Set these in `.env.local` for dev and in **Vercel → Project Settings → Environment Variables** for prod:

| Name | Where used | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client | public |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirect builder | public |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS embed in the browser | public |
| `GOOGLE_MAPS_API_KEY` | `/api/search`, `/api/photo`, `/api/photo-data`, `/api/reverse-geocode` | **server only** |
| `GEMINI_API_KEY` | `/api/generate-site` (edge proxy) | **server only** |

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY` can be the same key, or you can split them (browser-restricted vs. server-only) for tighter security. Whichever key you use for the public one **must** be restricted by HTTP referrer in Google Cloud Console.

The Google Maps key needs **Places API (New)** and **Geocoding API** (and **Maps JavaScript API** for the public one). Photos require the Pro SKU tier of Text Search.

## 4. Local dev

```bash
cp .env.example .env.local
# fill in the variables above
npm install
npm run dev
```

Open <http://localhost:3000> → sign in with Google → start searching.

## 5. Deploy to Vercel (via GitHub)

1. Push to GitHub.
2. Import the repo at <https://vercel.com/new>.
3. Before the first deploy, add the env vars above to **Production + Preview + Development**.
4. Deploy. Then go back to Supabase and add the production URL to **Site URL** and **Redirect URLs**.

## How it works

- `/api/search` (Node) — Places Text Search, server uses `GOOGLE_MAPS_API_KEY`.
- `/api/photo` (Node) — 302s to a signed Google CDN photo URL; the key never reaches the browser.
- `/api/photo-data` (Node) — returns a photo as a `data:image/jpeg;base64,…` URL so published sites can self-contain images.
- `/api/generate-site` (**Edge**) — streams Gemini's `streamGenerateContent` SSE through to the browser. Edge avoids `FUNCTION_INVOCATION_TIMEOUT` on long generations.
- `/site/<slug>` (Node) — serves a published HTML row from `published_sites`.

## Security notes

- The Supabase publishable key is safe to expose; RLS protects rows.
- Don't add `service_role` to this project — nothing here needs to bypass RLS.
- Restrict the public Google Maps key by HTTP referrer + API in Cloud Console. Keep the server-only key separate if you want belt-and-suspenders.
