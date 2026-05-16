import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns a Places-API photo as a `data:image/jpeg;base64,...` URL so the
// client can bake it directly into the HTML of a published site (no
// dependency on a live Google CDN signed URL or our own /api/photo route).
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
  // Default to 1200px wide — published-site embeds use a moderate size so
  // base64 doesn't bloat the HTML to absurd levels.
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

  let imgResp: Response;
  try {
    imgResp = await fetch(photoUri);
  } catch (e: any) {
    return new Response(`Image fetch error: ${e.message || e}`, { status: 502 });
  }
  if (!imgResp.ok) {
    return new Response(
      `Image fetch failed (${imgResp.status})`,
      { status: imgResp.status }
    );
  }

  const contentType = imgResp.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await imgResp.arrayBuffer());
  const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;

  return new Response(dataUrl, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
