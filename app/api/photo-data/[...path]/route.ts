import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Returns a Places-API photo as a `data:image/jpeg;base64,...` URL so the
// client can bake it directly into the HTML of a published site. Width is
// kept modest (800px default) so six photos' worth of base64 doesn't push
// the published HTML past Postgres/PostgREST comfort.
// URL shape: /api/photo-data/places/<PLACE_ID>/photos/<PHOTO_REF>?w=800
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response("No Google Maps API key configured on the server", {
      status: 500,
    });
  }

  const { path } = await context.params;
  if (!Array.isArray(path) || path[0] !== "places" || !path.includes("photos")) {
    return new Response("Invalid photo path", { status: 400 });
  }

  const photoPath = path.join("/");
  const width = req.nextUrl.searchParams.get("w") || "800";

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
    const errText = await resolveResp.text();
    return new Response(
      `Places API error (${resolveResp.status}): ${errText.slice(0, 200)}`,
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
