export type BusinessInfo = {
  name?: string;
  primaryType?: string;
  types?: string[];
  address?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: string[];
};

export function buildPrompt(b: BusinessInfo): string {
  const types = (b.types || []).slice(0, 5).join(", ");
  const rating =
    typeof b.rating === "number"
      ? `${b.rating.toFixed(1)} stars${b.userRatingCount ? ` from ${b.userRatingCount} reviews` : ""}`
      : "no rating data";

  const photos = (b.photos || []).filter(Boolean);
  const hasPhotos = photos.length > 0;
  const photoList = hasPhotos
    ? photos.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "(none — fall back to LoremFlickr)";

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

BUSINESS PHOTOS (USE THESE FIRST)
${hasPhotos ? `You have ${photos.length} real photo${photos.length === 1 ? "" : "s"} of this exact business from Google Maps. These are the actual storefront / interior / product / staff photos people uploaded. Use them throughout the site — hero, gallery, feature sections. They are far better than stock photos because they show the real place.

URLs (use them exactly as written, in order — photo 1 is the most representative):
${photoList}

Embed rules:
- Hero: use photo 1 as the hero background (with a dark gradient overlay so headline text stays readable) OR as a large adjacent hero image. Hero MUST have a real photo.
- Gallery: use photos 2..N in a 2–4 image grid. Don't repeat photo 1 unless there's only one photo total.
- Always include \`loading="lazy"\` on non-hero images.
- Always include \`onerror="this.style.display='none'"\` so a transient image fetch failure never breaks the layout. Back the hero section with a tasteful gradient color so the layout holds without the photo.
- Add a small \`Photos: Google Maps\` credit in the footer.` : `No photos were attached to this business listing. You MUST use LoremFlickr keyword photos instead — see fallback rules below.`}

LOREMFLICKR FALLBACK${hasPhotos ? ` (only if you need MORE images than the ${photos.length} business photo${photos.length === 1 ? "" : "s"} above, or want to supplement them in places where business photos don't fit)` : ""}
URL format: \`https://loremflickr.com/<width>/<height>/<keyword1>,<keyword2>,<keyword3>?lock=<positive integer>\`

Examples by business type:
- thai restaurant → \`https://loremflickr.com/1600/900/thai,restaurant,food?lock=7\`
- coffee shop → \`https://loremflickr.com/1600/900/coffee,cafe,interior?lock=12\`
- hair salon → \`https://loremflickr.com/1600/900/salon,hair,styling?lock=3\`
- gym → \`https://loremflickr.com/1600/900/gym,fitness,weights?lock=9\`
- plumber → \`https://loremflickr.com/1600/900/plumbing,tools,pipes?lock=5\`
- bakery → \`https://loremflickr.com/1600/900/bakery,bread,pastry?lock=2\`

Keyword rules: 2–4 lowercase comma-separated keywords, most-specific first. Same onerror fallback as above.

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
