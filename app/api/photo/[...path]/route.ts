import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Resolve a Places API photo name to its signed Google CDN URL and 302 there.
// The Maps API key never reaches the client — it stays on this server.
// URL shape: /api/photo/places/<PLACE_ID>/photos/<PHOTO_REFERENCE>?w=1600
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("GOOGLE_MAPS_API_KEY is not set on the server", {
      status: 500,
    });
  }

  const { path } = await context.params;
  if (!Array.isArray(path) || path.length === 0) {
    return new Response("Missing photo path", { status: 400 });
  }
  // Reject anything that doesn't look like a Places photo name.
  if (path[0] !== "places" || !path.includes("photos")) {
    return new Response("Invalid photo path", { status: 400 });
  }

  const photoPath = path.join("/");
  const width = req.nextUrl.searchParams.get("w") || "1600";

  // skipHttpRedirect=true returns JSON with { photoUri } instead of an image
  // redirect, so we can grab the signed CDN URL and forward the user there
  // without leaking the API key.
  const upstreamUrl = `https://places.googleapis.com/v1/${photoPath}/media?maxWidthPx=${encodeURIComponent(
    width
  )}&key=${encodeURIComponent(apiKey)}&skipHttpRedirect=true`;

  let resp: Response;
  try {
    resp = await fetch(upstreamUrl);
  } catch (e: any) {
    return new Response(`Network error: ${e.message || e}`, { status: 502 });
  }

  if (!resp.ok) {
    const text = await resp.text();
    return new Response(
      `Google Photos API error (${resp.status}): ${text.slice(0, 200)}`,
      { status: resp.status }
    );
  }

  const data = await resp.json();
  const photoUri: string | undefined = data?.photoUri;
  if (!photoUri) {
    return new Response("Places API returned no photoUri", { status: 502 });
  }

  // Cache the redirect for a few minutes. The signed CDN URL itself expires,
  // so we don't cache longer than its typical lifetime.
  return new Response(null, {
    status: 302,
    headers: {
      Location: photoUri,
      "Cache-Control": "private, max-age=300",
    },
  });
}
