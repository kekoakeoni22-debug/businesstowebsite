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

// Extra fill data — image/map URLs the template's gallery and map sections
// reference. Any of these can be absent; conditional blocks in the template
// will hide their containers when the value is missing.
export type FillExtras = {
  PHOTO_1?: string;
  PHOTO_2?: string;
  PHOTO_3?: string;
  PHOTO_4?: string;
  PHOTO_5?: string;
  PHOTO_6?: string;
  // Public Google Maps iframe embed URL (no API key, free).
  MAP_EMBED_URL?: string;
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

CONDITIONAL BLOCK SYNTAX

The template engine supports hide-when-empty blocks with this exact syntax:
  {{#KEY}}content{{/KEY}}
If KEY has data at fill time, the inner content renders. If KEY is empty, the whole block (and everything inside it) is removed. Use it for the gallery and map sections below so they vanish cleanly when no data is available.

PHOTO GALLERY (INCLUDE — WRAPPED CONDITIONALLY)

After Services/Menu, add a "Gallery" or "Our Space" section that shows up to 6 real business photos in a responsive grid. Wrap the entire section in {{#PHOTO_1}}...{{/PHOTO_1}} so it only renders when at least one photo is provided. Inside, render photo 1 unconditionally (we're already inside its block) and wrap photos 2–6 in their own conditional blocks:

{{#PHOTO_1}}
<section class="gallery">
  <h2>Our Space</h2>
  <div class="gallery-grid">
    <img class="gallery-img" src="{{PHOTO_1}}" alt="{{BUSINESS_NAME}} photo 1" loading="lazy" />
    {{#PHOTO_2}}<img class="gallery-img" src="{{PHOTO_2}}" alt="{{BUSINESS_NAME}} photo 2" loading="lazy" />{{/PHOTO_2}}
    {{#PHOTO_3}}<img class="gallery-img" src="{{PHOTO_3}}" alt="{{BUSINESS_NAME}} photo 3" loading="lazy" />{{/PHOTO_3}}
    {{#PHOTO_4}}<img class="gallery-img" src="{{PHOTO_4}}" alt="{{BUSINESS_NAME}} photo 4" loading="lazy" />{{/PHOTO_4}}
    {{#PHOTO_5}}<img class="gallery-img" src="{{PHOTO_5}}" alt="{{BUSINESS_NAME}} photo 5" loading="lazy" />{{/PHOTO_5}}
    {{#PHOTO_6}}<img class="gallery-img" src="{{PHOTO_6}}" alt="{{BUSINESS_NAME}} photo 6" loading="lazy" />{{/PHOTO_6}}
  </div>
</section>
{{/PHOTO_1}}

Style \`.gallery-grid\` as a responsive grid (e.g. \`display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;\`) and \`.gallery-img\` cover-fit (e.g. \`width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px;\`). The grid must look intentional whether 1 or 6 photos render.

LOCATION MAP (INCLUDE — WRAPPED CONDITIONALLY)

Just above the contact/footer, add a "Visit us" or "Find us" section that embeds an interactive Google Maps iframe of the business's location. Wrap the entire section in {{#MAP_EMBED_URL}}...{{/MAP_EMBED_URL}} so it vanishes if no map URL is provided:

{{#MAP_EMBED_URL}}
<section class="map-section">
  <h2>Visit us</h2>
  <iframe
    class="location-map"
    src="{{MAP_EMBED_URL}}"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
    title="Map showing the location of {{BUSINESS_NAME}}"
  ></iframe>
  <p class="address-under-map"><a href="{{ADDRESS_MAPS_URL}}" target="_blank" rel="noreferrer">{{ADDRESS}}</a></p>
</section>
{{/MAP_EMBED_URL}}

Style \`.location-map\` as \`width: 100%; height: 420px; border: 0; border-radius: 12px; display: block;\`. Do NOT use an <img> here — this is an <iframe> that loads Google Maps interactively.

OTHER IMAGES
The ONLY <img> tags allowed on the page are:
- 1 hero <img> with src="{{HERO_PHOTO_URL}}"
- 1–6 gallery <img>s inside the gallery section above
- 1 location-map <img> inside the map section above
For decorative imagery (icons, dividers, feature-card glyphs), use inline SVGs only — never an extra <img> tag.

SECTIONS
Sticky header (with {{BUSINESS_NAME}} logo, nav: About / Services or Menu / Gallery / Contact) → Hero (uses {{HERO_PHOTO_URL}}, headline mentioning {{BUSINESS_NAME}}, two CTAs primary <a href="tel:{{PHONE}}">) → About (2–3 paragraphs mentioning {{BUSINESS_NAME}}) → Services / Menu (3–6 cards) → Gallery (conditional, as specified above) → 1–2 review quotes → Map (conditional, as specified above) → Contact + footer (use <a href="tel:{{PHONE}}">{{PHONE}}</a>, <a href="{{ADDRESS_MAPS_URL}}">{{ADDRESS}}</a>, <ul class="hours">{{HOURS_LIST}}</ul>, footer copyright "© <year> {{BUSINESS_NAME}}").

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

export function fillTemplate(
  template: string,
  b: BusinessInfo,
  extras: FillExtras = {}
): string {
  const name = b.name || "";
  const phone = b.phone || "";
  const address = b.address || "";
  const rating = typeof b.rating === "number" ? b.rating.toFixed(1) : "";
  const reviewCount =
    typeof b.userRatingCount === "number"
      ? b.userRatingCount.toLocaleString()
      : "";

  // All placeholder values. Empty string for absent extras so conditional
  // blocks correctly recognize them as "missing".
  const values: Record<string, string> = {
    BUSINESS_NAME: escapeHtml(name),
    PHONE: escapeHtml(phone),
    ADDRESS: escapeHtml(address),
    ADDRESS_MAPS_URL: buildMapsUrl(name, address),
    RATING: escapeHtml(rating),
    REVIEW_COUNT: escapeHtml(reviewCount),
    HOURS_LIST: buildHoursListHtml(b.hours || []),
    HERO_PHOTO_URL: buildHeroPhotoUrl(b),
    PHOTO_1: extras.PHOTO_1 || "",
    PHOTO_2: extras.PHOTO_2 || "",
    PHOTO_3: extras.PHOTO_3 || "",
    PHOTO_4: extras.PHOTO_4 || "",
    PHOTO_5: extras.PHOTO_5 || "",
    PHOTO_6: extras.PHOTO_6 || "",
    MAP_EMBED_URL: extras.MAP_EMBED_URL || "",
  };

  // 1) Strip conditional blocks {{#KEY}}...{{/KEY}} whose key is missing.
  //    Iterate to handle nested blocks (different keys nested in each other).
  let html = template;
  for (let i = 0; i < 6; i++) {
    const next = html.replace(
      /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, key: string, content: string) => {
        const v = values[key];
        return v && v.length > 0 ? content : "";
      }
    );
    if (next === html) break;
    html = next;
  }

  // 2) Substitute remaining {{KEY}} placeholders.
  for (const [key, value] of Object.entries(values)) {
    html = html.split(`{{${key}}}`).join(value);
  }

  // 3) Strip any orphan {{...}} that we don't know about so they don't
  //    appear as literal text in the rendered page.
  html = html.replace(/\{\{\w+\}\}/g, "");

  return html;
}

// ============================================================================
// Gemini model chain
// ============================================================================

export const GEMINI_MODEL_CHAIN = [
  "gemini-3-flash-preview",
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
