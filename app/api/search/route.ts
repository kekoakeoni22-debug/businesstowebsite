import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SearchBody = {
  query?: string;
  location?: string;
  filterNoWebsite?: boolean;
  coords?: { lat: number; lng: number };
};

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

  const payload: Record<string, unknown> = {
    textQuery,
    maxResultCount: 20,
  };

  if (body.coords) {
    payload.locationBias = {
      circle: {
        center: {
          latitude: body.coords.lat,
          longitude: body.coords.lng,
        },
        radius: 20000,
      },
    };
  }

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.rating",
    "places.userRatingCount",
    "places.types",
  ].join(",");

  let resp: Response;
  try {
    resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Network error calling Places API: ${e.message || e}` },
      { status: 502 }
    );
  }

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
    return NextResponse.json({ error: message }, { status: resp.status });
  }

  const data = await resp.json();
  const rawPlaces: any[] = Array.isArray(data.places) ? data.places : [];

  const allPlaces = rawPlaces.map((p) => ({
    id: p.id,
    name: p.displayName?.text || "(unnamed)",
    address: p.formattedAddress,
    websiteUri: p.websiteUri,
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    types: p.types,
  }));

  const filtered = filterNoWebsite
    ? allPlaces.filter((p) => !p.websiteUri)
    : allPlaces;

  return NextResponse.json({
    places: filtered,
    totalBeforeFilter: allPlaces.length,
  });
}
