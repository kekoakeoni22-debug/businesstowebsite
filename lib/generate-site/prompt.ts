export type BusinessInfo = {
  name?: string;
  primaryType?: string;
  types?: string[];
  address?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
};

export function buildPrompt(b: BusinessInfo): string {
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

HERO BACKGROUND IMAGE (REQUIRED)
You MUST include a stock photo in the hero section that visually matches the business type. Use it as the hero background (with a dark gradient overlay so headline text stays readable), or as a large adjacent hero image. This is not optional.

Image URL format (LoremFlickr — keyword-based, no API key, always works):
  https://loremflickr.com/<width>/<height>/<keyword1>,<keyword2>,<keyword3>?lock=<positive integer>

Examples by business type:
- thai restaurant → \`https://loremflickr.com/1600/900/thai,restaurant,food?lock=7\`
- coffee shop → \`https://loremflickr.com/1600/900/coffee,cafe,interior?lock=12\`
- hair salon → \`https://loremflickr.com/1600/900/salon,hair,styling?lock=3\`
- gym → \`https://loremflickr.com/1600/900/gym,fitness,weights?lock=9\`
- plumber → \`https://loremflickr.com/1600/900/plumbing,tools,pipes?lock=5\`
- bakery → \`https://loremflickr.com/1600/900/bakery,bread,pastry?lock=2\`

Rules for keyword selection:
- 2 to 4 comma-separated keywords, lowercase, no spaces.
- Lead with the most specific keyword for the business type, then a more generic one (e.g. \`pizza,restaurant\` not \`food,italian\`).
- For service businesses without obvious photo subjects (lawyer, accountant, consulting), still include a relevant photo using \`office,professional,modern\` or \`handshake,business\`.

Always set the image with \`onerror\` to fall back to a CSS gradient so a transient image failure never produces a broken hero:
  <img onerror="this.style.display='none'" ... />
and back the hero section with a tasteful gradient color so the layout holds without the photo.

ADDITIONAL STOCK PHOTOS
Add 2–4 more LoremFlickr images in a gallery or feature section, each with different keywords pulled from the business. Use \`loading="lazy"\` on these and the same \`onerror\` fallback.

SECTIONS
Sticky header (name as logo, nav: About / Services or Menu / Gallery / Contact) → Hero with image, headline, subheadline, two CTAs (primary: \`tel:${b.phone || ""}\`) → About (2–3 paragraphs) → Services/Menu (3–6 cards with inline SVG icon + name + short description + optional price) → Gallery (3–6 images) → 1–2 review quotes → Contact + footer with phone link, address (Google Maps deep link), hours, copyright.

ACCESSIBILITY
Descriptive alt text on every image. WCAG-AA color contrast. Semantic landmarks (<header>, <main>, <section>, <footer>).

OUTPUT FORMAT
Output ONLY the HTML document, starting with \`<!doctype html>\`. No prose, no markdown, no \`\`\`html fences. Do not wrap the output in any other content.`;
}

export const GEMINI_MODEL_CHAIN = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
] as const;

export function isQuotaOrAccessError(status: number, message: string) {
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
