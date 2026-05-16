import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3.1-pro-preview";

type Body = {
  name?: string;
  primaryType?: string;
  types?: string[];
  address?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
};

function buildPrompt(b: Body) {
  const types = (b.types || []).slice(0, 5).join(", ");
  const rating =
    typeof b.rating === "number"
      ? `${b.rating.toFixed(1)} stars${b.userRatingCount ? ` from ${b.userRatingCount} reviews` : ""}`
      : "no rating data";

  return `You are a senior product designer and front-end engineer hired to design a one-page marketing website for a small local business that does not yet have one.

BUSINESS DETAILS
- Name: ${b.name || "Local Business"}
- Primary type: ${b.primaryType || "business"}
- Categories: ${types || "n/a"}
- Address: ${b.address || "n/a"}
- Phone: ${b.phone || "n/a"}
- Google reviews: ${rating}

DELIVERABLE
Output a COMPLETE, SINGLE-FILE HTML5 document (no markdown fences, no commentary — pure HTML). Embed all CSS in a <style> tag in <head>. Use minimal vanilla JS only if it adds real value (smooth scroll, mobile menu toggle).

HARD REQUIREMENTS
- Visually stunning and modern: confident typography, generous whitespace, layered hero, thoughtful color palette that matches the business type (warm/earthy for restaurants, clean/professional for services, bold for nightlife, etc.).
- Mobile-first responsive. Looks great at 375px and at 1440px.
- Use Google Fonts via <link> — pick fonts that fit the business (e.g. Playfair Display + Inter for upscale, Bebas Neue + DM Sans for energetic, etc.).
- Use real, plausible-sounding copy. Never write "Lorem ipsum". Invent reasonable details (tagline, 3–5 service/menu items, hours, an about story) consistent with the business name and type. Make hours believable for the category.
- Use inline SVGs for icons — do not link any external icon CDN.
- Include subtle animations: fade-in on scroll, hover lifts on cards, transform transitions. Keep them tasteful, not distracting.

STOCK PHOTOS (USE WHEN APPROPRIATE)
- Source: \`https://source.unsplash.com/featured/<width>x<height>/?<comma-separated-keywords>\` — this redirects to a curated Unsplash photo matching the keywords.
- Pick keywords that match the business type (e.g. "restaurant,interior,warm" for a cafe; "salon,hairdresser,minimal" for a salon; "construction,worker,industrial" for a contractor).
- Use 1 large hero image, plus 2–4 supporting images in a gallery or feature section. Use \`loading="lazy"\` for non-hero images. Use \`onerror="this.style.display='none'"\` so a failed image never breaks the layout.
- If the business type is one where photos add little (e.g. lawyer, accountant), favor gradients, illustrations, and inline SVG illustrations over stock photos.

SECTIONS TO INCLUDE
1. Sticky transparent-to-solid header with business name as logo (you may add a small inline SVG mark) and nav links: About, Services (or Menu), Gallery, Contact.
2. Hero: large headline, supporting subheadline, two CTAs (primary: phone link \`tel:${b.phone || ""}\`; secondary: scroll to services). Background hero image with a tasteful dark gradient overlay so text is readable.
3. About: 2–3 paragraphs of warm, on-brand copy.
4. Services / Menu / Offerings: 3–6 cards with icon, name, short description, and optionally price.
5. Gallery: 3–6 images in a tight grid.
6. Reviews quote: 1–3 short fabricated-but-plausible review quotes with attribution to first names.
7. Contact + footer: address (Google Maps deep link), phone link, hours, copyright.

ACCESSIBILITY
- All images have descriptive alt text.
- Color contrast meets WCAG AA on text.
- Skip-to-content link not required but semantic landmarks (<header>, <main>, <section>, <footer>) are.

OUTPUT FORMAT
Output ONLY the HTML document, starting with \`<!doctype html>\`. No prose, no markdown, no \`\`\`html fences. Do not wrap the output in any other content.`;
}

function stripFences(s: string) {
  let out = s.trim();
  // Strip ```html ... ``` or ``` ... ```
  const fence = /^```(?:html)?\s*([\s\S]*?)\s*```$/i;
  const m = out.match(fence);
  if (m) out = m[1].trim();
  return out;
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
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (keyErr) {
    return NextResponse.json({ error: keyErr.message }, { status: 500 });
  }
  const geminiKey = row?.gemini_api_key;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "No Gemini API key on file. Add one in Settings." },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    geminiKey
  )}`;

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 16384,
          responseMimeType: "text/plain",
        },
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Network error calling Gemini: ${e.message || e}` },
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
      `Gemini API error (HTTP ${resp.status}).`;
    return NextResponse.json({ error: message }, { status: resp.status });
  }

  const data = await resp.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || "")
    .join("");

  if (!text) {
    return NextResponse.json(
      { error: "Gemini returned no content." },
      { status: 502 }
    );
  }

  const html = stripFences(text);

  return NextResponse.json({ html, model: MODEL });
}
