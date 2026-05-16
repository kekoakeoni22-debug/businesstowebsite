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

// Build a LoremFlickr URL that is fully determined by the business's name +
// primary_type. The search query is intentionally NOT used, so the same
// business gets the same photo regardless of how the user found it.
export function buildHeroPhotoUrl(b: BusinessInfo): string {
  const keywords =
    (b.primaryType || "")
      .toLowerCase()
      .split("_")
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .slice(0, 3)
      .join(",") || "storefront";

  // djb2-style hash for better distribution than a naive sum; same input
  // always yields the same seed.
  const seedSource = `${b.name || ""}|${b.primaryType || ""}`;
  let hash = 5381;
  for (let i = 0; i < seedSource.length; i++) {
    hash = ((hash << 5) + hash + seedSource.charCodeAt(i)) & 0x7fffffff;
  }
  const seed = (hash % 9998) + 1;

  return `https://loremflickr.com/1600/900/${keywords}?lock=${seed}`;
}

// ============================================================================
// Template prompt — Gemini generates HTML with literal {{PLACEHOLDER}} tokens
// in place of any data that varies per business. We fill them in at render
// time so a second business of the same primary_type can reuse the cached
// template with no LLM call.
// ============================================================================

export function buildTemplatePrompt(primaryType: string): string {
  const type = primaryType || "business";

  return `You are a senior product designer and front-end engineer hired to design a REUSABLE one-page marketing website TEMPLATE.

This template will be used for many different real businesses whose primary type is: "${type}". The HTML you output is generic to that type; specific business data (name, phone, address, hours, rating) is substituted at render time via simple text-replacement of placeholder tokens.

PLACEHOLDER TOKENS — USE THESE EXACTLY, VERBATIM, WITH THE DOUBLE BRACES

Use these literal tokens anywhere the corresponding data should appear. Do NOT invent example values for them, do NOT remove the braces, do NOT translate them. They are literal strings, not variables.

- {{BUSINESS_NAME}} — the business's name. Use it freely — in the header logo, hero headline, about story, contact block, footer copyright, page <title>, anywhere it reads naturally.
- {{PHONE}} — the formatted phone number, e.g. "(800) 555-1234". Use as both display text and inside tel: links: <a href="tel:{{PHONE}}">{{PHONE}}</a>.
- {{ADDRESS}} — single-line street address.
- {{ADDRESS_MAPS_URL}} — Google Maps deep link. Use as an href.
- {{RATING}} — Google rating, e.g. "4.7".
- {{REVIEW_COUNT}} — number of reviews, e.g. "1,024".
- {{HOURS_LIST}} — a pre-rendered block of <li>…</li> items, one per weekday. ALWAYS wrap this token inside a single <ul class="hours">{{HOURS_LIST}}</ul>. Style the .hours list in your CSS (probably list-style: none, monospace times, two-column day/time layout, etc.). If the business has no hours on file, the substitution will be an empty string and the <ul> will collapse to no visible items.
- {{HERO_PHOTO_URL}} — the hero background image URL. Use as the src of the hero <img>. Different businesses will get different URLs at fill time.

EXAMPLES OF CORRECT USAGE (note the braces stay)
  <title>{{BUSINESS_NAME}}</title>
  <a class="logo" href="#top">{{BUSINESS_NAME}}</a>
  <h1>Welcome to {{BUSINESS_NAME}}</h1>
  <a class="cta cta-primary" href="tel:{{PHONE}}">Call us · {{PHONE}}</a>
  <a class="address" href="{{ADDRESS_MAPS_URL}}" target="_blank" rel="noreferrer">{{ADDRESS}}</a>
  <p class="rating">★ {{RATING}} <span>· {{REVIEW_COUNT}} reviews</span></p>
  <ul class="hours">{{HOURS_LIST}}</ul>
  <img class="hero-img" src="{{HERO_PHOTO_URL}}" alt="${type.replace(/_/g, " ")} business" onerror="this.style.display='none'" />

COPY THAT IS NOT PLACEHOLDERED

For tagline, about story, service/menu cards, review quotes, feature card descriptions: write generic-but-on-brand copy that fits ANY business of type "${type}". Mention {{BUSINESS_NAME}} naturally throughout. Do not invent specific facts (no specific dish names, no specific staff names, no specific founding stories) — write the kind of copy that could go on any ${type}'s site. Examples:
- Tagline: "Your neighborhood ${type.replace(/_/g, " ")}, since day one."
- About: "{{BUSINESS_NAME}} has been serving the community with care, craft, and a personal touch. Step in — we'd love to meet you."
- Review quote: "Honestly the best ${type.replace(/_/g, " ")} I've found. Friendly, professional, and they know what they're doing." — first name only.

DELIVERABLE
Output a COMPLETE, SINGLE-FILE HTML5 document (no markdown fences, no commentary — pure HTML). Embed all CSS in a <style> tag in <head>. Use minimal vanilla JS only if it adds real value (smooth scroll, mobile menu toggle).

HARD REQUIREMENTS
- Visually stunning and modern: confident typography, generous whitespace, layered hero, thoughtful color palette that matches the business type (warm/earthy for restaurants, clean/professional for services, bold for nightlife, etc.).
- Mobile-first responsive. Looks great at 375px and at 1440px.
- Use Google Fonts via <link> — pick fonts that fit "${type}".
- Use inline SVGs for icons — do not link any external icon CDN.
- Subtle animations: fade-in on scroll, hover lifts, transform transitions.

HERO IMAGE
The hero must use <img src="{{HERO_PHOTO_URL}}" ... /> as its background or large adjacent image. Place with onerror="this.style.display='none'" and back the hero section with a CSS gradient underneath so the layout holds if the photo fails. Dark linear-gradient overlay on top so headline text stays readable.

EVERY OTHER SECTION
No other photographic images on the page. Zero <img> tags outside the hero. Use inline-SVG illustrations, color-blocked sections backed by CSS gradients, typographic blockquotes, and icon-driven feature cards.

SECTIONS
Sticky header (with {{BUSINESS_NAME}} logo, nav: About / Services or Menu / Contact) → Hero (uses {{HERO_PHOTO_URL}}, headline mentioning {{BUSINESS_NAME}}, two CTAs primary <a href="tel:{{PHONE}}">) → About (2–3 paragraphs mentioning {{BUSINESS_NAME}}) → Services / Menu (3–6 cards) → 1–2 review quotes → Contact + footer (use <a href="tel:{{PHONE}}">{{PHONE}}</a>, <a href="{{ADDRESS_MAPS_URL}}">{{ADDRESS}}</a>, <ul class="hours">{{HOURS_LIST}}</ul>, and a footer copyright line "© <year> {{BUSINESS_NAME}}").

ACCESSIBILITY
Descriptive alt text on the hero image. WCAG-AA color contrast. Semantic landmarks (<header>, <main>, <section>, <footer>).

OUTPUT FORMAT
Output ONLY the HTML document, starting with \`<!doctype html>\`. No prose, no markdown, no \`\`\`html fences. Keep the placeholder tokens literal — do not substitute them with example data.`;
}

// ============================================================================
// Fill — substitute placeholder tokens in a stored template with real data.
// ============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHoursListHtml(hours: string[]): string {
  if (!hours || hours.length === 0) return "";
  return hours
    .map((line) => {
      // Lines look like "Monday: 9:00 AM – 5:00 PM". Split on the first colon
      // so the CSS can style day and time separately.
      const idx = line.indexOf(":");
      if (idx > 0) {
        const day = line.slice(0, idx);
        const rest = line.slice(idx + 1).trim();
        return `<li><span class="day">${escapeHtml(day)}</span><span class="time">${escapeHtml(rest)}</span></li>`;
      }
      return `<li>${escapeHtml(line)}</li>`;
    })
    .join("");
}

function buildMapsUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [name, address].filter(Boolean).join(" ")
  )}`;
}

export function fillTemplate(template: string, b: BusinessInfo): string {
  const name = b.name || "";
  const phone = b.phone || "";
  const address = b.address || "";
  const rating = typeof b.rating === "number" ? b.rating.toFixed(1) : "";
  const reviewCount =
    typeof b.userRatingCount === "number"
      ? b.userRatingCount.toLocaleString()
      : "";

  const replacements: Record<string, string> = {
    "{{BUSINESS_NAME}}": escapeHtml(name),
    "{{PHONE}}": escapeHtml(phone),
    "{{ADDRESS}}": escapeHtml(address),
    "{{ADDRESS_MAPS_URL}}": buildMapsUrl(name, address),
    "{{RATING}}": escapeHtml(rating),
    "{{REVIEW_COUNT}}": escapeHtml(reviewCount),
    "{{HOURS_LIST}}": buildHoursListHtml(b.hours || []),
    "{{HERO_PHOTO_URL}}": buildHeroPhotoUrl(b),
  };

  let html = template;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }
  return html;
}

// ============================================================================
// Gemini model chain
// ============================================================================

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
