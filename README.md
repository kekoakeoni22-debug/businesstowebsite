# Business Finder

Next.js app that searches local businesses via the Google Maps **Places API (New)** and, by default, filters out any place that already has a website.

- **Auth**: Supabase Auth — sign in with Google, GitHub, or email/password.
- **BYO API key**: Each user enters their own Google Maps API key on `/settings`. It's stored in their private row in a `user_api_keys` table protected by row-level security and only used server-side at search time.

## 1. Create the Supabase project

1. Go to <https://app.supabase.com> → **New project**.
2. After it provisions, open **Project Settings → API Keys**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (starts with `sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   > This is the new key format Supabase rolled out in 2025. Legacy `anon` keys still work through end of 2026, but new projects should use the publishable key. (See [Supabase: Understanding API keys](https://supabase.com/docs/guides/api/api-keys).)
3. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_user_api_keys.sql`, and run it. This creates the `user_api_keys` table with RLS so a user can only read/write their own row.

## 2. Configure auth providers

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for dev, your Vercel URL for prod.
- **Redirect URLs**: add both
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-DOMAIN/auth/callback`

In **Authentication → Providers**:

- **Email**: enabled by default.
- **Google**: create OAuth credentials at <https://console.cloud.google.com/apis/credentials> (OAuth client → Web application). Authorized redirect URI is the one Supabase shows on the provider page, typically `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Paste the client ID + secret back into Supabase.
- **GitHub**: at <https://github.com/settings/developers> → **New OAuth App**. Authorization callback URL is the same Supabase callback. Paste client ID + secret into Supabase.

## 3. Local dev

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL
npm install
npm run dev
```

Open <http://localhost:3000> → sign in → go to **Settings** → paste your Google Maps API key.

The key needs **Places API (New)** and **Geocoding API** enabled in Google Cloud.

## 4. Deploy to Vercel (via GitHub)

1. Push to GitHub.
2. Import the repo at <https://vercel.com/new>.
3. Before the first deploy, add environment variables (Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` — your Vercel URL (e.g. `https://businesstowebsite.vercel.app`)
4. Deploy. Then go back to Supabase and add the production URL to **Site URL** and **Redirect URLs**.

## How the key flow works

1. User signs in (Google / GitHub / email).
2. User pastes their Google Maps API key on `/settings`. The form posts to a server action that calls `supabase.from('user_api_keys').upsert(...)` using the user's session — RLS guarantees they can only write their own row.
3. When the user searches, `/api/search` runs on the server, reads the caller's row via their session, and uses that key to call Google. The key is never sent to the browser.
4. Sign out clears the session.

## Security notes

- The publishable key shipped to the browser is safe to expose — RLS is what protects rows. (Same security model as the old anon key, just under a clearer name.)
- Don't add a Supabase **secret key** (`sb_secret_…`) or the legacy `service_role` key to this project. They bypass RLS and aren't needed for any flow here.
- Users should restrict their own Google Maps API key in Google Cloud (HTTP referrer + API restrictions) for their own protection — show this guidance on the Settings page if you want.

## Files of note

- `middleware.ts` + `lib/supabase/middleware.ts` — refreshes the Supabase session cookie on every request.
- `lib/supabase/server.ts` / `client.ts` — server- and browser-side Supabase clients.
- `app/login/` — login page + server actions for Google / GitHub / email.
- `app/auth/callback/route.ts` — OAuth & email-confirm code exchange.
- `app/settings/` — manage the BYO key (save / replace / remove).
- `app/api/search/route.ts` — text search, per-user key.
- `app/api/reverse-geocode/route.ts` — city detection, per-user key.
- `supabase/migrations/0001_user_api_keys.sql` — schema + RLS policies.
