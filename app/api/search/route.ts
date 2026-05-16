import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SearchBody = {
  query?: string;
  location?: string;
  filterNoWebsite?: boolean;
  coords?: { lat: number; lng: number };
};

// Google's Places API (New) Text Search caps at 20 results per page and 3 pages
// total = 60 results. We page adaptively: when the no-website filter is on, we
// keep fetching until we either hit the cap or have enough filtered results.
const MAX_PAGES = 3;
const TARGET_FILTERED = 20;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.types",
  "places.location",
  "places.photos",
  "nextPageToken",
].join(",");

// Max photos per place to surface to the client. The Places Photo API charges
// per image *load*, so we keep this modest. Hero + a small gallery is enough.
const MAX_PHOTOS_PER_PLACE = 6;
const PHOTO_MAX_WIDTH = 1600;

function getRequestOrigin(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildPhotoUrls(rawPhotos: any[], origin: string): string[] {
  if (!Array.isArray(rawPhotos)) return [];
  const urls: string[] = [];
  for (const ph of rawPhotos.slice(0, MAX_PHOTOS_PER_PLACE)) {
    const name: string | undefined = ph?.name;
    if (!name) continue;
    // Route the photo through our own proxy so the Maps API key never appears
    // in the URL. Gemini is wary of URLs that contain &key=... and tends to
    // substitute stock photos instead of using them. Clean URLs fix that.
    // photo "name" is a path like "places/CHIJ.../photos/ATplDJ..."
    urls.push(`${origin}/api/photo/${name}?w=${PHOTO_MAX_WIDTH}`);
  }
  return urls;
}

type Payload = {
  textQuery: string;
  pageSize: number;
  pageToken?: string;
  locationBias?: {
    circle: { center: { latitude: number; longitude: number }; radius: number };
  };
};

async function fetchPlacesPage(apiKey: string, payload: Payload) {
  const resp = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
    const message =
      parsed?.error?.message ||
      (typeof parsed === "string" ? parsed : null) ||
      `Places API error (HTTP ${resp.status}).`;
    throw Object.assign(new Error(message), { status: resp.status });
  }

  return resp.json() as Promise<{
    places?: any[];
    nextPageToken?: string;
  }>;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: row, error: keyErr } = await supabase
    .from("user_api_keys")
    .select("google_maps_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (keyErr) {
    return NextResponse.json({ error: keyErr.message }, { status: 500 });
  }
  const apiKey = row?.google_maps_api_key;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Google Maps API key on file. Add one in Settings." },
      { status: 400 }
    );
  }

  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = (body.query || "").trim();
  const location = (body.location || "").trim();
  const filterNoWebsite = body.filterNoWebsite !== false;

  if (!query) {
    return NextResponse.json({ error: "query is required." }, { status: 400 });
  }

  const textQuery = location ? `${query} in ${location}` : query;

  const basePayload: Payload = { textQuery, pageSize: 20 };
  if (body.coords) {
    basePayload.locationBias = {
      circle: {
        center: {
          latitude: body.coords.lat,
          longitude: body.coords.lng,
        },
        radius: 20000,
      },
    };
  }

  const collected: any[] = [];
  let filteredCount = 0;
  let pageToken: string | undefined;
  let pagesFetched = 0;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const payload: Payload = pageToken
        ? { ...basePayload, pageToken }
        : { ...basePayload };
      const data = await fetchPlacesPage(apiKey, payload);
      pagesFetched++;
      const places = Array.isArray(data.places) ? data.places : [];
      collected.push(...places);

      if (filterNoWebsite) {
        filteredCount += places.filter((p) => !p.websiteUri).length;
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
      // Stop early when we don't need more pages.
      if (!filterNoWebsite) break;
      if (filteredCount >= TARGET_FILTERED) break;
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Search failed" },
      { status: e.status || 502 }
    );
  }

  const origin = getRequestOrigin(req);

  const allPlaces = collected.map((p) => ({
    id: p.id,
    name: p.displayName?.text || "(unnamed)",
    address: p.formattedAddress,
    websiteUri: p.websiteUri,
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    primaryType: p.primaryType,
    types: p.types,
    lat:
      typeof p.location?.latitude === "number"
        ? p.location.latitude
        : undefined,
    lng:
      typeof p.location?.longitude === "number"
        ? p.location.longitude
        : undefined,
    photos: buildPhotoUrls(p.photos || [], origin),
  }));

  const filtered = filterNoWebsite
    ? allPlaces.filter((p) => !p.websiteUri)
    : allPlaces;

  return NextResponse.json({
    places: filtered,
    totalBeforeFilter: allPlaces.length,
    pagesFetched,
  });
}
