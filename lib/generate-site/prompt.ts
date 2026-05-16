export type BusinessInfo = {
  name?: string;
  primaryType?: string;
  types?: string[];
  address?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  hours?: string[];
  query?: string;
};

const STOPWORDS = new Set([
  "near", "me", "in", "the", "best", "top", "good", "great", "open", "now",
  "with", "and", "for", "of", "to", "a", "an", "on", "at", "by", "this",
  "that", "what", "where", "when", "why", "how", "who", "around", "my",
]);

function buildHeroPhotoUrl(b: BusinessInfo): string {
  const fromQuery = (b.query || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  const fromType = (b.primaryType || "")
    .toLowerCase()
    .split("_")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  const merged: string[] = [];
  for (const w of [...fromQuery, ...fromType]) {
    if (!merged.includes(w)) merged.push(w);
    if (merged.length >= 3) break;
  }
  const keywords = merged.length > 0 ? merged.join(",") : "storefront";

  // Deterministic per-business seed so different businesses get different
  // photos but the same business gets the same photo on regenerate.
  const seedSource = b.name || keywords;
  let hash = 0;
  for (let i = 0; i < seedSource.length; i++) {
    hash = (hash + seedSource.charCodeAt(i) * (i + 1)) % 9999;
  }
  const seed = hash + 1;

  return `https://loremflickr.com/1600/900/${keywords}?lock=${seed}`;
}

export function buildPrompt(b: BusinessInfo): string {
  const types = (b.types || []).slice(0, 5).join(", ");
  const rating =
    typeof b.rating === "number"
      ? `${b.rating.toFixed(1)} stars${b.userRatingCount ? ` from ${b.userRatingCount} reviews` : ""}`
      : "no rating data";

  const heroPhotoUrl = buildHeroPhotoUrl(b);

  const hours = (b.hours || []).filter(Boolean);
  const hasHours = hours.length > 0;

  return `You are a senior product designer and front-end engineer hired to design a one-page marketing website for a small local business that does not yet have one.

BUSINESS DETAILS
- Name: ${b.name || "Local Business"}
- Primary type: ${b.primaryType || "business"}
- Categories: ${types || "n/a"}
- Address: ${b.address || "n/a"}
- Phone: ${b.phone || "n/a"}
- Google reviews: ${rating}
- User searched for: ${b.query || "n/a"}

HOURS (FROM GOOGLE — USE VERBATIM, DO NOT INVENT)
${hasHours
  ? hours.map((line) => `- ${line}`).join("\n") + `\n\nRender these hours in the contact/visit section exactly as listed above. Do not change times, days, or order. Do not abbreviate. Do not invent or substitute hours under any circumstance.`
  : `Google did not return hours for this business. Do NOT invent hours. In the contact section, write 'Hours by appointment — please call' or omit the hours block entirely. Never fabricate opening times.`}

DELIVERABLE
Output a COMPLETE, SINGLE-FILE HTML5 document (no markdown fences, no commentary — pure HTML). Embed all CSS in a <style> tag in <head>. Use minimal vanilla JS only if it adds real value (smooth scroll, mobile menu toggle).

HARD REQUIREMENTS
- Visually stunning and modern: confident typography, generous whitespace, layered hero, thoughtful color palette that matches the business type (warm/earthy for restaurants, clean/professional for services, bold for nightlife, etc.).
- Mobile-first responsive. Looks great at 375px and at 1440px.
- Use Google Fonts via <link> — pick fonts that fit the business (e.g. Playfair Display + Inter for upscale, Bebas Neue + DM Sans for energetic, etc.).
- Use real, plausible-sounding copy. Never write "Lorem ipsum". Invent reasonable details (tagline, 3–5 service/menu items, an about story) consistent with the business name and type. NEVER invent hours — see the HOURS block below.
- Use inline SVGs for icons — do not link any external icon CDN.
- Include subtle animations: fade-in on scroll, hover lifts on cards, transform transitions. Keep them tasteful, not distracting.

IMAGE POLICY — READ THIS CAREFULLY. VIOLATIONS WILL BE REJECTED.

There is exactly ONE stock photo on this entire page. It is the hero background. There is no second stock photo. Anywhere. Not in the gallery, not in the about section, not in feature cards, not in the footer, not as a watermark. ONE.

HERO PHOTO — use this exact URL, verbatim, as the hero background:

${heroPhotoUrl}

Do not modify the URL. Place the image with \`onerror="this.style.display='none'"\` and back the hero section with a tasteful CSS gradient underneath so the layout holds if the image fails to load. Add a dark linear-gradient overlay on top of the photo so headline text stays readable.

EVERY OTHER SECTION
No other photographic images anywhere on the page. Zero <img> tags outside the hero. Where you would normally use photos (gallery, about image, feature cards), use:
- Inline-SVG illustrations and icons
- Color-blocked sections backed by tasteful CSS gradients
- Typographic blockquotes or large pull-quotes
- Bold-icon + headline feature cards

Count your <img> tags before you finish — there must be exactly 1, and it must point at the hero URL above.

SECTIONS
Sticky header (name as logo, nav: About / Services or Menu / Contact) → Hero with image, headline, subheadline, two CTAs (primary: \`tel:${b.phone || ""}\`) → About (2–3 paragraphs) → Services/Menu (3–6 cards with inline SVG icon + name + short description + optional price) → 1–2 review quotes → Contact + footer with phone link, address (Google Maps deep link), hours, copyright.

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
