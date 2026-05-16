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

IMAGE POLICY (READ CAREFULLY — STRICT)

You will use TWO sources of images on this page, in clearly-separated roles:

1. HERO PHOTO — exactly ONE LoremFlickr stock photo, used as the hero background or large adjacent hero image. This is the only place a stock photo is permitted when business photos are available. Format:
   \`https://loremflickr.com/1600/900/<keyword1>,<keyword2>,<keyword3>?lock=<positive integer>\`

   Keyword examples by business type:
   - thai restaurant → \`https://loremflickr.com/1600/900/thai,restaurant,food?lock=7\`
   - coffee shop → \`https://loremflickr.com/1600/900/coffee,cafe,interior?lock=12\`
   - hair salon → \`https://loremflickr.com/1600/900/salon,hair,styling?lock=3\`
   - gym → \`https://loremflickr.com/1600/900/gym,fitness,weights?lock=9\`
   - plumber → \`https://loremflickr.com/1600/900/plumbing,tools,pipes?lock=5\`
   - bakery → \`https://loremflickr.com/1600/900/bakery,bread,pastry?lock=2\`

   Keyword rules: 2–4 lowercase comma-separated keywords, most-specific first. The hero must always have a dark gradient overlay so headline text reads cleanly. Back the hero section with a tasteful gradient color so the layout holds even if the photo fails to load.

2. EVERY OTHER IMAGE ON THE PAGE — use the real business photos below.
${hasPhotos ? `   You have ${photos.length} real photo${photos.length === 1 ? "" : "s"} of this exact business from Google Maps. Use them in the gallery, the about-section image, any feature/service cards that benefit from imagery, and the contact/visit section. Use as many of these photos as you need — and do not repeat the same photo twice if you have more.

   URLs (in order — photo 1 is the most representative; assume the array order is meaningful):
${photoList}

   You MUST use these business photos. Do NOT replace them with LoremFlickr. Do NOT use a LoremFlickr photo anywhere except the single hero photo described in section 1.

   Embed rules for every business photo:
   - \`loading="lazy"\` (these are not the hero).
   - \`onerror="this.style.display='none'"\` so a transient fetch failure never breaks the layout.
   - Reasonable alt text describing what the photo likely shows for this kind of business.
   - Add a small \`Photos: Google Maps\` credit in the footer.` : `   This listing has NO business photos attached. In this case, you may use additional LoremFlickr stock photos (using the same URL format and keyword rules as section 1) for the gallery, about image, feature cards, etc. Use a different \`?lock=N\` value for each to get visual variety. Apply the same \`loading="lazy"\` and \`onerror\` rules.`}

Image counts to aim for:
- 1 hero photo (LoremFlickr, always).
${hasPhotos ? `- 3–6 business photos elsewhere on the page (use what you have, up to ${photos.length}).` : `- 3–5 additional LoremFlickr photos elsewhere on the page.`}

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
