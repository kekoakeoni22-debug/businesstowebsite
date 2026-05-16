import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns an Unsplash hero photo for a business.
//
// URL shape: /api/unsplash-hero?type=<primary_type>&name=<business_name>&format=<redirect|data>
//   - redirect (default): 302 to the Unsplash CDN URL for the chosen photo
//   - data: returns `data:image/...;base64,...` as text/plain (for baking
//           into published HTML so the link doesn't depend on Unsplash CDN
//           shenanigans later)
//
// The chosen photo is deterministic per (type, name): we hash the name to
// pick an index into Unsplash's search results, so the same business always
// gets the same hero on regenerate.

const STOPWORDS = new Set([
  "near", "me", "in", "the", "best", "top", "good", "great", "open", "now",
  "with", "and", "for", "of", "to", "a", "an", "on", "at", "by", "this",
  "that", "what", "where", "when", "why", "how", "who", "around", "my",
]);

function keywordsFromType(primaryType: string): string {
  return (
    primaryType
      .toLowerCase()
      .split("_")
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .slice(0, 3)
      .join(" ") || "storefront"
  );
}

function seedFromName(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: row } = await supabase
    .from("user_api_keys")
    .select("unsplash_access_key")
    .eq("user_id", user.id)
    .maybeSingle();
  const accessKey = row?.unsplash_access_key;
  if (!accessKey) {
    return new Response("No Unsplash Access Key on file", { status: 400 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "business").trim();
  const name = (url.searchParams.get("name") || "").trim();
  const format = (url.searchParams.get("format") || "redirect").trim();

  const query = keywordsFromType(type);

  const searchUrl =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}` +
    `&per_page=10` +
    `&orientation=landscape` +
    `&content_filter=high`;

  let searchResp: Response;
  try {
    searchResp = await fetch(searchUrl, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
  } catch (e: any) {
    return new Response(`Network error: ${e.message || e}`, { status: 502 });
  }
  if (!searchResp.ok) {
    const text = await searchResp.text();
    return new Response(
      `Unsplash search failed (${searchResp.status}): ${text.slice(0, 200)}`,
      { status: searchResp.status }
    );
  }

  const data = await searchResp.json();
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  if (results.length === 0) {
    return new Response("No Unsplash results for this query", { status: 404 });
  }

  const idx = seedFromName(name || query) % results.length;
  const photo = results[idx];
  const photoUrl: string | undefined =
    photo?.urls?.regular || photo?.urls?.full || photo?.urls?.raw;
  if (!photoUrl) {
    return new Response("Missing photo URL in Unsplash response", { status: 502 });
  }

  // Per Unsplash API guidelines, trigger the download endpoint to credit the
  // photographer. Fire-and-forget — failure here doesn't block our response.
  const downloadLocation: string | undefined = photo?.links?.download_location;
  if (downloadLocation) {
    fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    }).catch(() => {});
  }

  if (format === "data") {
    let imgResp: Response;
    try {
      imgResp = await fetch(photoUrl);
    } catch (e: any) {
      return new Response(`Image fetch error: ${e.message || e}`, {
        status: 502,
      });
    }
    if (!imgResp.ok) {
      return new Response(`Image fetch failed (${imgResp.status})`, {
        status: imgResp.status,
      });
    }
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    return new Response(`data:${contentType};base64,${buf.toString("base64")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: photoUrl,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
