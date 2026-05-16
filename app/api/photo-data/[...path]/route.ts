import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Resolves a Places-API photo to its signed Google CDN URL and returns that
// URL as plain text. The client bakes the URL directly into the HTML of a
// published site so the page is self-contained (no /api/photo auth round-trip
// when a visitor loads it) and the HTML stays small (a URL is ~200 bytes vs.
// hundreds of KB of base64 per photo).
//
// We previously inlined base64 data URLs here; six 1200px photos pushed the
// published HTML past 2 MB which slowed /site/<slug> dramatically and was
// hitting size issues on the insert path. Signed CDN URLs are public for the
// lifetime of their token (hours/days), plenty for the sale-demo use case.
//
// URL shape: /api/photo-data/places/<PLACE_ID>/photos/<PHOTO_REF>?w=1200
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
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

  const { path } = await context.params;
  if (!Array.isArray(path) || path[0] !== "places" || !path.includes("photos")) {
    return new Response("Invalid photo path", { status: 400 });
  }

  const photoPath = path.join("/");
  const width = req.nextUrl.searchParams.get("w") || "1200";

  const resolveUrl = `https://places.googleapis.com/v1/${photoPath}/media?maxWidthPx=${encodeURIComponent(
    width
  )}&key=${encodeURIComponent(apiKey)}&skipHttpRedirect=true`;

  let resolveResp: Response;
  try {
    resolveResp = await fetch(resolveUrl);
  } catch (e: any) {
    return new Response(`Resolve error: ${e.message || e}`, { status: 502 });
  }
  if (!resolveResp.ok) {
    return new Response(
      `Places API error (${resolveResp.status})`,
      { status: resolveResp.status }
    );
  }
  const j = await resolveResp.json();
  const photoUri: string | undefined = j?.photoUri;
  if (!photoUri) {
    return new Response("Places API returned no photoUri", { status: 502 });
  }

  return new Response(photoUri, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
