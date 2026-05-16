import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns a Google Static Maps image centered on (lat, lng) as a
// `data:image/png;base64,...` URL the client can bake into a published site.
// URL shape: /api/static-map-data?lat=...&lng=...
const COORD_RE = /^-?\d{1,3}(?:\.\d+)?$/;

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: row } = await supabase
    .from("user_api_keys")
    .select("google_maps_api_key")
    .eq("user_id", user.id)
    .maybeSingle();
  const apiKey = row?.google_maps_api_key;
  if (!apiKey) {
    return new Response("No Google Maps API key on file", { status: 400 });
  }

  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng || !COORD_RE.test(lat) || !COORD_RE.test(lng)) {
    return new Response("Bad lat/lng", { status: 400 });
  }

  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=15&size=800x400&scale=2` +
    `&markers=color:red%7C${lat},${lng}` +
    `&key=${encodeURIComponent(apiKey)}`;

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (e: any) {
    return new Response(`Network error: ${e.message || e}`, { status: 502 });
  }
  if (!resp.ok) {
    const text = await resp.text();
    return new Response(
      `Static Maps API error (${resp.status}): ${text.slice(0, 200)}`,
      { status: resp.status }
    );
  }

  const contentType = resp.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await resp.arrayBuffer());
  const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;

  return new Response(dataUrl, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
