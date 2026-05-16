# Business Finder

Next.js app that searches local businesses via the Google Maps **Places API (New)** and, by default, filters out any place that already has a website.

## How it works

- The browser asks for geolocation on load → reverse-geocodes to a city name and pre-fills the location input.
- "Search" calls the server route `/api/search`, which forwards a `places:searchText` request to Google. The API key stays on the server.
- Each result includes a `websiteUri` (or doesn't). The server filters those out when the "without a website" checkbox is checked (default: on).

## Setup

### 1. Enable Google APIs

In a Google Cloud project, enable:

- **Places API (New)**
- **Geocoding API**

Create an API key. For production, restrict it by HTTP referrer and to the two APIs above.

### 2. Local dev

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your key
npm run dev
```

Open http://localhost:3000.

### 3. Deploy to Vercel

```bash
# from the project root, after pushing to a git remote:
vercel
```

Then add the API key as a **Vercel secret / environment variable**:

```bash
vercel env add GOOGLE_MAPS_API_KEY production
# paste the key when prompted
vercel env add GOOGLE_MAPS_API_KEY preview
vercel env add GOOGLE_MAPS_API_KEY development
```

(Or via the Vercel dashboard → Project → Settings → Environment Variables.)

The variable is server-side only — no `NEXT_PUBLIC_` prefix — so the key never reaches the browser bundle.

## Notes

- The Places API "Text Search" returns up to 20 results per call. To go further you'd page through `nextPageToken`.
- `websiteUri` being absent in Places data is a strong signal but not a guarantee that the business has no website anywhere on the internet — it just means Google doesn't have one on file. That's usually exactly the signal you want for outreach.
