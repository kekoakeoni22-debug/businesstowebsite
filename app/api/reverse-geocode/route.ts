import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Google Maps API key configured on the server." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required." },
      { status: 400 }
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("result_type", "locality|administrative_area_level_2");

  let resp: Response;
  try {
    resp = await fetch(url.toString());
  } catch (e: any) {
    return NextResponse.json(
      { error: `Network error: ${e.message || e}` },
      { status: 502 }
    );
  }

  if (!resp.ok) {
    return NextResponse.json(
      { error: `Geocoding API error (HTTP ${resp.status}).` },
      { status: resp.status }
    );
  }

  const data = await resp.json();
  if (data.status !== "OK") {
    return NextResponse.json(
      { city: null, status: data.status, message: data.error_message || null },
      { status: 200 }
    );
  }

  let city: string | null = null;
  let region: string | null = null;

  for (const result of data.results || []) {
    for (const c of result.address_components || []) {
      const t: string[] = c.types || [];
      if (!city && t.includes("locality")) city = c.long_name;
      if (!region && t.includes("administrative_area_level_1"))
        region = c.short_name;
    }
    if (city) break;
  }

  if (!city) {
    for (const result of data.results || []) {
      for (const c of result.address_components || []) {
        const t: string[] = c.types || [];
        if (t.includes("administrative_area_level_2")) {
          city = c.long_name;
          break;
        }
      }
      if (city) break;
    }
  }

  const display = city && region ? `${city}, ${region}` : city;
  return NextResponse.json({ city: display });
}
