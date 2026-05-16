export type BusinessInfo = {
  name?: string;
  primaryType?: string;
  types?: string[];
  address?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: string[];
  query?: string;
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
- User searched for: ${b.query || "n/a"}

DELIVERABLE
Output a COMPLETE, SINGLE-FILE HTML5 document (no markdown fences, no commentary — pure HTML). Embed all CSS in a <style> tag in <head>. Use minimal vanilla JS only if it adds real value (smooth scroll, mobile menu toggle).

HARD REQUIREMENTS
- Visually stunning and modern: confident typography, generous whitespace, layered hero, thoughtful color palette that matches the business type (warm/earthy for restaurants, clean/professional for services, bold for nightlife, etc.).
- Mobile-first responsive. Looks great at 375px and at 1440px.
- Use Google Fonts via <link> — pick fonts that fit the business (e.g. Playfair Display + Inter for upscale, Bebas Neue + DM Sans for energetic, etc.).
- Use real, plausible-sounding copy. Never write "Lorem ipsum". Invent reasonable details (tagline, 3–5 service/menu items, hours, an about story) consistent with the business name and type. Make hours believable for the category.
- Use inline SVGs for icons — do not link any external icon CDN.
- Include subtle animations: fade-in on scroll, hover lifts on cards, transform transitions. Keep them tasteful, not distracting.

IMAGE POLICY — READ THIS CAREFULLY. VIOLATIONS WILL BE REJECTED.

There is exactly ONE stock photo on this entire page. It is the hero background. There is no second stock photo. Anywhere. Not in the gallery, not in the about section, not in feature cards, not in the footer, not as a watermark. ONE.

THE ONE HERO PHOTO

Build the URL yourself using this exact template:
  \`https://loremflickr.com/1600/900/<KEYWORDS>?lock=<SEED>\`

KEYWORDS — must be derived from THIS specific business. Do not use generic words like "business" or "shop". Pick 2 to 4 lowercase, comma-separated, no-spaces keywords by combining:
- The primary type \`${b.primaryType || "business"}\` (split on underscores into separate keywords).
- The user's search term: "${b.query || ""}" (pull the meaningful nouns/adjectives, drop filler words like "near", "in", "the", "best", city names, "open now", etc.).
- One supporting concrete noun appropriate to the category (e.g. "interior", "storefront", "espresso", "scissors", "weights", "pipes", "bread", "cocktails", "books") — never a vague abstract word.

Examples of how to derive keywords for THIS prompt's flow (do not copy these — derive your own from the actual business above):
- primary type \`thai_restaurant\`, query \`"thai food"\` → \`thai,restaurant,food,interior\`
- primary type \`hair_salon\`, query \`"salons near me"\` → \`salon,hair,styling\`
- primary type \`finance\`, query \`"auto loans"\` → \`auto,car,dealership\` (visualize what the business sells, not the abstract category)
- primary type \`gym\`, query \`"crossfit gym"\` → \`crossfit,gym,fitness\`
- primary type \`bookstore\`, query \`"used bookstores"\` → \`bookstore,books,shelves\`

SEED — pick a number between 1 and 9999 derived deterministically from the business name (e.g. sum of character codes mod 9999). Different businesses must end up with different seeds so the photos vary.

The hero must have a dark linear-gradient overlay so headline text reads cleanly. The hero section also has a solid tasteful gradient background color underneath the image so the layout holds if the photo fails to load.

EVERY OTHER IMAGE
${hasPhotos
  ? `You have ${photos.length} real photo${photos.length === 1 ? "" : "s"} of this exact business from Google Maps. These are the ONLY images allowed elsewhere on the page. Use them in the gallery, the about image, feature cards, the contact section.

URLs in order (photo 1 is most representative):
${photoList}

Hard rules:
- Use each business photo at least once before repeating.
- \`loading="lazy"\` on every business photo.
- \`onerror="this.style.display='none'"\` on every business photo.
- Plausible alt text per photo.
- A small "Photos: Google Maps" credit in the footer.
- DO NOT generate any additional LoremFlickr URL anywhere outside the hero. NO. ZERO. Not even one.`
  : `This listing has NO business photos. In that case the page has NO photographic images outside the hero. Replace what would have been a gallery with one of:
- An inline-SVG illustrated feature section
- A two-column "what we do" layout with bold icon + headline cards
- A bold typographic block-quote section
- A color-blocked services grid using CSS gradients and inline-SVG icons
Choose whichever fits the business type. Do NOT generate any additional LoremFlickr URL. ONE stock photo total on the page, which is the hero.`}

Counts: exactly 1 LoremFlickr URL anywhere in the output. ${hasPhotos ? `Plus ${photos.length} business photo URL${photos.length === 1 ? "" : "s"} used in the page.` : `No other photos.`} Count them before you finish.

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
