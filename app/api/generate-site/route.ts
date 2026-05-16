import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pro first for quality. With streaming the user sees progress immediately,
// so a slower generation isn't a UX problem. Flash is the fallback if Pro
// is over quota / not accessible on the user's tier.
const MODEL_CHAIN = ["gemini-2.5-pro", "gemini-2.5-flash"] as const;

function isQuotaOrAccessError(status: number, message: string) {
  if (status === 429 || status === 403 || status === 404) return true;
  const m = (message || "").toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("rate") ||
    m.includes("permission") ||
    m.includes("not found") ||
    m.includes("not supported")
  );
}

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

SECTIONS
Sticky header (name as logo, nav: About / Services or Menu / Gallery / Contact) → Hero with image, headline, subheadline, two CTAs (primary: \`tel:${b.phone || ""}\`) → About (2–3 paragraphs) → Services/Menu (3–6 cards with inline SVG icon + name + short description + optional price) → Gallery (3–6 images) → 1–2 review quotes → Contact + footer with phone link, address (Google Maps deep link), hours, copyright.

ACCESSIBILITY
Descriptive alt text on every image. WCAG-AA color contrast. Semantic landmarks (<header>, <main>, <section>, <footer>).

OUTPUT FORMAT
Output ONLY the HTML document, starting with \`<!doctype html>\`. No prose, no markdown, no \`\`\`html fences. Do not wrap the output in any other content.`;
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
  const attempted: string[] = [];
  let lastErrorMsg = "Gemini call failed.";
  let lastErrorStatus = 502;

  for (const model of MODEL_CHAIN) {
    attempted.push(model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
      geminiKey
    )}`;

    let upstream: Response;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            topP: 0.95,
            // No artificial cap on output — generate as much as needed.
            // The model decides when the page is finished.
            maxOutputTokens: 32768,
            responseMimeType: "text/plain",
          },
        }),
        // Propagate client aborts so closing the modal cancels Gemini too.
        signal: req.signal,
      });
    } catch (e: any) {
      lastErrorMsg = `Network error calling Gemini: ${e.message || e}`;
      lastErrorStatus = 502;
      continue;
    }

    if (!upstream.ok) {
      const text = await upstream.text();
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep text */
      }
      const message =
        parsed?.error?.message ||
        (typeof parsed === "string" ? parsed : null) ||
        `Gemini API error (HTTP ${upstream.status}).`;
      lastErrorMsg = message;
      lastErrorStatus = upstream.status;

      if (isQuotaOrAccessError(upstream.status, message)) continue;
      return NextResponse.json(
        { error: message, attempted },
        { status: upstream.status }
      );
    }

    if (!upstream.body) {
      lastErrorMsg = "Empty response from Gemini.";
      continue;
    }

    // Got a streaming response — commit to this model and pipe its SSE
    // through as plain text deltas the client can append to a buffer.
    const transformed = transformGeminiSSE(upstream.body);

    return new Response(transformed, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Used-Model": model,
        // Tell intermediaries (proxies, CDNs) not to buffer the stream.
        "X-Accel-Buffering": "no",
      },
    });
  }

  return NextResponse.json(
    {
      error: `${lastErrorMsg} (tried: ${attempted.join(", ")})`,
      attempted,
    },
    { status: lastErrorStatus }
  );
}

// Parse Gemini's Server-Sent Events stream and write only the text deltas
// (no JSON wrappers) to a new ReadableStream the client consumes directly.
function transformGeminiSSE(upstream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();

      function processLine(line: string) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const data = trimmed.slice(5).trim();
        if (!data) return;
        try {
          const json = JSON.parse(data);
          const parts = json?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            const text = parts.map((p: any) => p?.text || "").join("");
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch {
          /* ignore malformed event */
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any trailing buffered line.
            if (buffer.trim()) processLine(buffer);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            processLine(line);
          }
        }
      } catch {
        // Upstream errored — best effort; close cleanly so the client
        // sees the stream end and renders whatever it has.
      } finally {
        controller.close();
      }
    },
  });
}
