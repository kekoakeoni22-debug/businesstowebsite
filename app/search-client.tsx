"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  fillTemplate,
  GEMINI_MODEL_CHAIN,
  isQuotaOrAccessError,
  type BusinessInfo,
  type FillExtras,
} from "@/lib/generate-site/prompt";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Toggle to false to call the real Gemini API again. When true, every
// Generate click streams an existing template from site_templates as if
// it were being generated live, then shows a locked state inside the
// previewed HTML itself.
const MOCK_GENERATION = true;

// Used when site_templates is empty so the mock-stream UI always has
// something to show. Kept small so the first paint isn't ugly.
const FALLBACK_MOCK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{BUSINESS_NAME}}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #faf6f1; color: #2d241e; }
    .hero { padding: 6rem 2rem 4rem; text-align: center; }
    h1 { font-size: 3rem; margin: 0 0 1rem; }
    .lead { color: #6b5c52; margin: 0 0 2rem; }
    .cta { display: inline-block; padding: 0.9rem 1.6rem; background: #c9a66b; color: white; border-radius: 4px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>{{BUSINESS_NAME}}</h1>
    <p class="lead">Crafted in your neighborhood. Stop by, say hi.</p>
    <a class="cta" href="tel:{{PHONE}}">Call {{PHONE}}</a>
  </section>
</body>
</html>`;

type Place = {
  id: string;
  name: string;
  address?: string;
  websiteUri?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  lat?: number;
  lng?: number;
  photos?: string[];
  hours?: string[];
};

function formatType(t?: string) {
  if (!t) return "";
  return t.replace(/_/g, " ");
}

// Strip protocol + leading www + trailing slash so the displayed link reads
// cleanly (e.g. "tonys-pizza.com") while the href still points to the full URL.
function prettyHostname(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "");
  } catch {
    return url;
  }
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function injectMockPaywall(html: string, businessName: string): string {
  const safeName = escapeHtmlText(businessName || "this business");
  const styles = `
<style id="btw-mock-paywall-styles">
  html, body { min-height: 100%; overflow: hidden !important; }
  .btw-mock-paywall {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif !important;
  }
  .btw-mock-paywall,
  .btw-mock-paywall * {
    font-family: "Segoe UI", Arial, Helvetica, sans-serif !important;
  }
  .btw-mock-paywall__scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(rgba(15, 23, 42, 0.62), rgba(15, 23, 42, 0.62)),
      radial-gradient(circle at 20% 0%, rgba(26, 115, 232, 0.2), transparent 42%),
      radial-gradient(circle at 80% 100%, rgba(37, 99, 235, 0.16), transparent 44%);
  }
  .btw-mock-paywall__card {
    position: relative;
    width: min(760px, 94vw);
    min-height: min(520px, 86vh);
    border-radius: 16px;
    padding: clamp(24px, 3vw, 40px);
    color: #0f172a;
    background: rgba(248, 250, 252, 0.97);
    box-shadow: 0 26px 70px rgba(15, 23, 42, 0.22);
    border: 1px solid rgba(218, 220, 224, 0.95);
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: clamp(18px, 3vw, 38px);
    align-items: stretch;
  }
  .btw-mock-paywall__content {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .btw-mock-paywall__side {
    border-left: 1px solid rgba(218, 220, 224, 0.9);
    padding-left: clamp(16px, 2.6vw, 30px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: linear-gradient(180deg, rgba(232, 240, 254, 0.7), rgba(255, 255, 255, 0));
    border-radius: 10px;
  }
  .btw-mock-paywall__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.1);
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .btw-mock-paywall__title {
    margin: 14px 0 10px;
    font-size: clamp(32px, 4.2vw, 50px);
    line-height: 1.02;
    letter-spacing: -0.04em;
  }
  .btw-mock-paywall__sub {
    margin: 0 0 22px;
    color: #475569;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.55;
  }
  .btw-mock-paywall__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }
  .btw-mock-paywall__list li {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #0f172a;
    font-size: 15px;
  }
  .btw-mock-paywall__tick {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }
  .btw-mock-paywall__actions {
    display: grid;
    gap: 10px;
    margin-top: auto;
    padding-top: 10px;
  }
  .btw-mock-paywall__cta {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 84px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    border: 0;
    cursor: pointer;
  }
  .btw-mock-paywall__cta {
    color: #fff;
    background: linear-gradient(135deg, #1a73e8 0%, #1765cc 100%);
    box-shadow: 0 8px 18px rgba(26, 115, 232, 0.36);
  }
  .btw-mock-paywall__price {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.1;
  }
  .btw-mock-paywall__billing {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.3;
  }
  @media (max-width: 640px) {
    .btw-mock-paywall {
      padding: 10px;
      align-items: center;
    }
    .btw-mock-paywall__card {
      width: 100%;
      min-height: min(760px, 96vh);
      padding: 20px 16px 16px;
      border-radius: 12px;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .btw-mock-paywall__side {
      border-left: 0;
      padding-left: 0;
      border-top: 1px solid rgba(218, 220, 224, 0.9);
      padding-top: 14px;
      border-radius: 0;
      background: transparent;
    }
    .btw-mock-paywall__title {
      font-size: clamp(28px, 9vw, 38px);
    }
    .btw-mock-paywall__sub {
      font-size: 15px;
    }
  }
</style>`;

  const overlay = `
<div class="btw-mock-paywall" role="dialog" aria-modal="true" aria-label="Unlock website preview">
  <div class="btw-mock-paywall__scrim"></div>
  <div class="btw-mock-paywall__card">
    <div class="btw-mock-paywall__content">
      <h2 class="btw-mock-paywall__title">Subscribe to access and generate websites</h2>
      <p class="btw-mock-paywall__sub">
        Generate more sites for other businesses, download the HTML, and publish each one under a shareable URL.
      </p>
      <ul class="btw-mock-paywall__list">
        <li><span class="btw-mock-paywall__tick">✓</span>Generate unlimited sites across multiple businesses</li>
        <li><span class="btw-mock-paywall__tick">✓</span>Reuse the workflow for every new lead you want to pitch</li>
        <li><span class="btw-mock-paywall__tick">✓</span>Publish each finished site to a client-ready URL in one click</li>
      </ul>
    </div>
    <div class="btw-mock-paywall__side">
      <div class="btw-mock-paywall__actions">
        <a
          class="btw-mock-paywall__cta"
          href="/api/checkout"
          target="_blank"
          rel="noreferrer"
        >
          <span class="btw-mock-paywall__price">$12.99</span>
          <span class="btw-mock-paywall__billing">Charged monthly. Cancel anytime.</span>
        </a>
      </div>
    </div>
  </div>
</div>`;

  const withStyles = html.includes("</head>")
    ? html.replace("</head>", `${styles}\n</head>`)
    : `${styles}\n${html}`;

  return withStyles.includes("</body>")
    ? withStyles.replace("</body>", `${overlay}\n</body>`)
    : `${withStyles}\n${overlay}`;
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    "★".repeat(full) + (half ? "☆" : "") + "·".repeat(Math.max(0, empty))
  );
}

function SearchIcon() {
  return (
    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z" fill="currentColor" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02z" fill="currentColor" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 17.93A8 8 0 0 1 4.07 13H7a13.1 13.1 0 0 0 .89 4.6 8 8 0 0 1-1 1.33zM9 13h6a11.9 11.9 0 0 1-1.83 6.43A11.9 11.9 0 0 1 9 13zm0-2a11.9 11.9 0 0 1 1.83-6.43A11.9 11.9 0 0 1 14.83 11zm-2-2H4.07A8 8 0 0 1 10.93 4.07 13.1 13.1 0 0 0 7.11 9zm10 0a13.1 13.1 0 0 0-3.82-4.93A8 8 0 0 1 19.93 9zM17 11h2.93a8 8 0 0 1 0 4H17a14.6 14.6 0 0 0 0-4zm-2.11 8.6A13.1 13.1 0 0 0 15.89 15H19a8 8 0 0 1-4.11 4.6z" fill="currentColor" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 1.5l1.95 4.7L18.5 8l-4.55 1.8L12 14.5l-1.95-4.7L5.5 8l4.55-1.8L12 1.5zm6.5 11.5l1.2 2.9L22.5 17l-2.8 1.1L18.5 21l-1.2-2.9L14.5 17l2.8-1.1L18.5 13zm-13 0l1.2 2.9L9.5 17l-2.8 1.1L5.5 21l-1.2-2.9L1.5 17l2.8-1.1L5.5 13z"
        fill="currentColor"
      />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.71 11.29l-9-9a1 1 0 0 0-1.41 0l-9 9a1 1 0 0 0 0 1.41l9 9a1 1 0 0 0 1.41 0l9-9a1 1 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z" fill="currentColor" />
    </svg>
  );
}

// Auto-fit the map to all marker positions.
function FitToBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, 64);
  }, [map, points]);
  return null;
}

// Pan to a single point when the user clicks a card.
function PanTo({ point }: { point: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !point) return;
    map.panTo(point);
    if ((map.getZoom() || 0) < 14) map.setZoom(15);
  }, [map, point]);
  return null;
}

export default function SearchClient({
  mapsKey,
  defaultLocation,
  defaultCoords,
}: {
  mapsKey: string;
  defaultLocation: string;
  defaultCoords: { lat: number; lng: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [locationDetected, setLocationDetected] = useState(
    defaultLocation.length > 0
  );
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  // "Pending" mirrors what the user is editing in the popover but isn't yet
  // applied to the result list. Apply commits these into the real filters.
  const [pendingNoWebsite, setPendingNoWebsite] = useState(false);
  const [pendingHasPhone, setPendingHasPhone] = useState(false);
  const [pendingMinRating, setPendingMinRating] = useState(0);
  const [pendingMinReviews, setPendingMinReviews] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  function openFilters() {
    // Seed pending with the currently-applied values so editing starts
    // from the user's real state rather than from defaults.
    setPendingNoWebsite(filterNoWebsite);
    setPendingHasPhone(filterHasPhone);
    setPendingMinRating(minRating);
    setPendingMinReviews(minReviews);
    setFiltersOpen(true);
  }

  async function applyFilters() {
    setFiltersOpen(false);
    const noWebsiteChanged = pendingNoWebsite !== filterNoWebsite;
    setFilterNoWebsite(pendingNoWebsite);
    setFilterHasPhone(pendingHasPhone);
    setMinRating(pendingMinRating);
    setMinReviews(pendingMinReviews);

    // If the no-website filter changed and we already have results, the
    // useEffect below fires runSearch, which has its own min-loading delay
    // baked in. Client-only filter changes get a manual 1.2s loading flash
    // so the change feels deliberate.
    const willTriggerSearch = noWebsiteChanged && results !== null;
    if (!willTriggerSearch && results !== null) {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1200));
      setLoading(false);
    }
  }

  const activeFilterCount =
    (filterNoWebsite ? 1 : 0) +
    (filterHasPhone ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (minReviews > 0 ? 1 : 0);

  // Close the popup on outside click or Escape.
  useEffect(() => {
    if (!filtersOpen) return;
    function onDown(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    defaultCoords
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [totalBeforeFilter, setTotalBeforeFilter] = useState(0);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Website-generation overlay
  const [previewFor, setPreviewFor] = useState<Place | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewModel, setPreviewModel] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  // The raw template (with {{PLACEHOLDER}} tokens) currently displayed in
  // the iframe. Kept separately so we can re-fill it with a different
  // business's data when the user clicks another result card.
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [mockPreviewLocked, setMockPreviewLocked] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const streamCodeRef = useRef<HTMLPreElement | null>(null);

  // Transient "Copied!" feedback on the per-card copy button. Holds the
  // place id of the most recently copied URL; cleared after a couple seconds.
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  const router = useRouter();

  // In-page sign-in popup. Triggered when an anonymous visitor clicks an
  // action that requires auth (Generate website, Copy website URL).
  // `signInPromptReason` is the headline copy. `pendingAuthAction` is the
  // original action to re-fire automatically after a successful sign-in
  // so the user doesn't lose their search/results state.
  const [signInPromptReason, setSignInPromptReason] = useState<
    null | "generate" | "publish"
  >(null);
  const [pendingAuthAction, setPendingAuthAction] = useState<{
    type: "generate" | "publish";
    place: Place;
  } | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  function openSignInPrompt(reason: "generate" | "publish", place: Place) {
    setSignInPromptReason(reason);
    setPendingAuthAction({ type: reason, place });
    setSignInEmail("");
    setSignInPassword("");
    setSignInError(null);
    setSignInLoading(false);
    setVerifySent(false);
  }

  function closeSignInPrompt() {
    setSignInPromptReason(null);
  }

  async function startCheckoutSession() {
    if (!previewFor) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const r = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: previewFor.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Unable to create Stripe checkout session.");
      if (!data?.redirectUrl) throw new Error("Stripe session missing redirect URL.");
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setCheckoutError(err?.message || "Unable to start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  useEffect(() => {
    if (!mockPreviewLocked) {
      setCheckoutLoading(false);
      setCheckoutError(null);
    }
  }, [mockPreviewLocked]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setSignInLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password: signInPassword,
    });
    setSignInLoading(false);
    if (error) {
      setSignInError(error.message);
      return;
    }

    // Capture the pending action BEFORE we clear it via closeSignInPrompt.
    const next = pendingAuthAction;
    closeSignInPrompt();
    setPendingAuthAction(null);

    // Refresh server components so the header picks up the new session
    // without a full page reload (which would wipe search results).
    router.refresh();

    // Re-fire whatever the user was doing when they got bounced to sign-in.
    if (next?.type === "generate") {
      generatePreview(next.place);
    } else if (next?.type === "publish") {
      copyWebsiteUrl(next.place);
    }
  }

  // Builds the path we want to land on after an OAuth / email-verify redirect.
  // The state needed to resume is small (query, location, no-website filter,
  // and the action+place id), so we just pass it through URL params instead
  // of localStorage — stateless, no stale-data cleanup, easy to debug.
  function buildResumePath(): string {
    const params = new URLSearchParams();
    params.set("resume", "1");
    if (query) params.set("q", query);
    if (location) params.set("loc", location);
    if (filterNoWebsite) params.set("nw", "1");
    if (pendingAuthAction) {
      params.set("action", pendingAuthAction.type);
      params.set("placeId", pendingAuthAction.place.id);
    }
    return `/?${params.toString()}`;
  }

  async function handleSignUp() {
    if (!signInEmail.trim() || !signInPassword) {
      setSignInError("Enter an email and password first.");
      return;
    }
    setSignInError(null);
    setSignInLoading(true);
    const supabase = createSupabaseBrowserClient();
    const resumePath = buildResumePath();
    const { error } = await supabase.auth.signUp({
      email: signInEmail.trim(),
      password: signInPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resumePath)}`,
      },
    });
    setSignInLoading(false);
    if (error) {
      setSignInError(error.message);
      return;
    }
    setVerifySent(true);
  }

  async function handleGoogleSignIn() {
    setSignInError(null);
    const supabase = createSupabaseBrowserClient();
    const resumePath = buildResumePath();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resumePath)}`,
      },
    });
    if (error) setSignInError(error.message);
    // On success, the browser is redirected to Google by Supabase.
  }

  // Resume mount effect: if we landed here from an OAuth or email-verify
  // round-trip, the URL has ?resume=1&q=...&loc=...&action=...&placeId=...
  // — re-run the search and fire the original action so the user picks up
  // exactly where they were.
  const resumingRef = useRef(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("resume") !== "1") return;
    resumingRef.current = true;

    const q = sp.get("q") || "";
    const loc = sp.get("loc") || "";
    const nw = sp.get("nw") === "1";
    const actionType = sp.get("action") as "generate" | "publish" | null;
    const placeId = sp.get("placeId");

    // Strip the params so a manual refresh doesn't keep resuming.
    window.history.replaceState(null, "", "/");

    if (!q) return;
    setQuery(q);
    setLocation(loc);
    setFilterNoWebsite(nw);

    (async () => {
      const places = await runSearch({
        query: q,
        location: loc,
        filterNoWebsite: nw,
      });
      if (!places || !actionType || !placeId) return;
      const place = places.find((p) => p.id === placeId);
      if (!place) return;
      if (actionType === "generate") {
        generatePreview(place);
      } else if (actionType === "publish") {
        copyWebsiteUrl(place);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip geolocation when resuming — the resume effect already set
    // location, and overriding it with the detected city would be jarring.
    if (resumingRef.current) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const r = await fetch(
            `/api/reverse-geocode?lat=${latitude}&lng=${longitude}`
          );
          if (r.ok) {
            const data = await r.json();
            if (data.city) {
              setLocation(data.city);
              setLocationDetected(true);
            }
          }
        } catch {
          /* ignore */
        }
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  async function runSearch(
    overrides: {
      query?: string;
      location?: string;
      filterNoWebsite?: boolean;
    } = {}
  ): Promise<Place[] | null> {
    const q = overrides.query ?? query;
    const loc = overrides.location ?? location;
    const fnw = overrides.filterNoWebsite ?? filterNoWebsite;
    if (!q.trim()) return null;
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveId(null);

    // Artificial minimum loading time so the spinner sits long enough to
    // read as "thinking" rather than blinking on/off. Places API is usually
    // sub-second; this padding lets the UI breathe.
    const MIN_LOADING_MS = 1200;
    const minDelay = new Promise((r) => setTimeout(r, MIN_LOADING_MS));

    try {
      const body: Record<string, unknown> = {
        query: q,
        location: loc,
        filterNoWebsite: fnw,
      };
      if (coords && locationDetected && loc) {
        body.coords = coords;
      }
      const [r] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        minDelay,
      ]);
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.error || "Search failed");
      }
      const places: Place[] = data.places || [];
      setResults(places);
      setTotalBeforeFilter(data.totalBeforeFilter ?? 0);
      setPagesFetched(data.pagesFetched ?? 1);
      return places;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch();
  }

  // The no-website filter is server-side (it drives pagination), so toggling
  // it after a search must refire the request. Other filters apply client-side
  // via filteredResults and don't need this. Skipped on first mount because
  // results is still null until the user submits the form once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (results === null) return;
    runSearch();
  }, [filterNoWebsite]);

  // Client-side post-filters applied on top of whatever the server returned.
  // (No-website filtering happens server-side so pagination can target enough
  // matches; the rest filter the displayed list without changing what we
  // fetched.)
  const filteredResults = useMemo(() => {
    return (results || []).filter((p) => {
      if (filterHasPhone && !p.phone) return false;
      if (minRating > 0 && (typeof p.rating !== "number" || p.rating < minRating)) {
        return false;
      }
      if (
        minReviews > 0 &&
        (typeof p.userRatingCount !== "number" || p.userRatingCount < minReviews)
      ) {
        return false;
      }
      return true;
    });
  }, [results, filterHasPhone, minRating, minReviews]);

  const placedResults = useMemo(
    () =>
      filteredResults.filter(
        (p): p is Place & { lat: number; lng: number } =>
          typeof p.lat === "number" && typeof p.lng === "number"
      ),
    [filteredResults]
  );

  const points = useMemo(
    () => placedResults.map((p) => ({ lat: p.lat, lng: p.lng })),
    [placedResults]
  );

  const defaultCenter = coords || { lat: 39.8283, lng: -98.5795 }; // US center fallback
  const defaultZoom = coords ? 11 : 4;

  const activePlace = activeId
    ? placedResults.find((p) => p.id === activeId)
    : null;

  function focusOnPlace(p: Place) {
    if (typeof p.lat === "number" && typeof p.lng === "number") {
      setActiveId(p.id);
      setPanTarget({ lat: p.lat, lng: p.lng });
    }
    maybeSwapPreviewTo(p);
  }

  // If the preview overlay is open and the user clicks a different result,
  // refill the current template with the new business's data — instant swap,
  // no LLM call needed. Skipped while a fresh template is still streaming so
  // we don't fight an in-flight generation.
  function maybeSwapPreviewTo(p: Place) {
    if (
      !previewFor ||
      !currentTemplate ||
      previewLoading ||
      p.id === previewFor.id
    ) {
      return;
    }
    setPreviewFor(p);
    setPreviewHtml(renderPreviewHtml(currentTemplate, p));
    setPreviewError(null);
  }

  function businessInfoFromPlace(p: Place): BusinessInfo {
    return {
      name: p.name,
      primaryType: p.primaryType,
      types: p.types,
      address: p.address,
      phone: p.phone,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      hours: p.hours,
      query: query,
    };
  }

  function renderPreviewHtml(template: string, p: Place) {
    const filled = fillTemplate(
      template,
      businessInfoFromPlace(p),
      buildPreviewExtras(p)
    );
    return filled;
  }

  function resetPreviewState() {
    previewAbortRef.current?.abort();
    setPreviewFor(null);
    setPreviewHtml(null);
    setPreviewModel(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setStreamingText("");
    setCurrentTemplate(null);
    setMockPreviewLocked(false);
  }

  // Photo proxy URLs from the search API look like:
  //   https://app.example.com/api/photo/places/<id>/photos/<ref>?w=1600
  // Pull just the part after /api/photo/ so we can request the data-URL
  // variant at /api/photo-data/... for the published site.
  function extractPhotoPath(proxyUrl: string): string | null {
    try {
      const u = new URL(proxyUrl);
      const m = u.pathname.match(/^\/api\/photo\/(.+)$/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  // Fast extras for in-iframe previews: use the proxy/direct URLs we
  // already have. No extra fetching needed.
  function buildMapEmbedUrl(p: Place): string | undefined {
    // Public, no-API-key Google Maps embed. Prefer name + address so the
    // embed shows the business label card; fall back to lat/lng for a
    // plain pin if those aren't available.
    const text = [p.name, p.address].filter(Boolean).join(" ").trim();
    if (text) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(text)}&z=15&output=embed`;
    }
    if (typeof p.lat === "number" && typeof p.lng === "number") {
      return `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=15&output=embed`;
    }
    return undefined;
  }

  function buildPreviewExtras(p: Place): FillExtras {
    const extras: FillExtras = {};
    (p.photos || []).slice(0, 6).forEach((url, i) => {
      (extras as any)[`PHOTO_${i + 1}`] = url;
    });
    const embed = buildMapEmbedUrl(p);
    if (embed) extras.MAP_EMBED_URL = embed;
    return extras;
  }

  // Extras for publishing: fetch every photo as a base64 data URL so the
  // published HTML is self-contained — visitors don't need auth to load
  // images and the page survives Google CDN signed-URL expiry. Width is
  // 800px so six photos don't blow up the HTML size on insert.
  async function buildPublishExtras(p: Place): Promise<{
    extras: FillExtras;
    failures: string[];
  }> {
    const extras: FillExtras = {};
    const failures: string[] = [];

    const photoPaths = (p.photos || [])
      .slice(0, 6)
      .map(extractPhotoPath)
      .filter((s): s is string => !!s);

    const photoPromises = photoPaths.map(async (path, i) => {
      try {
        const r = await fetch(`/api/photo-data/${path}?w=800`);
        if (!r.ok) {
          const msg = await r.text().catch(() => "");
          failures.push(`Photo ${i + 1}: HTTP ${r.status} ${msg.slice(0, 120)}`);
          return null;
        }
        const text = await r.text();
        if (!text.startsWith("data:")) {
          failures.push(`Photo ${i + 1}: response wasn't a data URL`);
          return null;
        }
        return text;
      } catch (e: any) {
        failures.push(`Photo ${i + 1}: ${e?.message || e}`);
        return null;
      }
    });

    const photoDataUrls = await Promise.all(photoPromises);
    photoDataUrls.forEach((url, i) => {
      if (url) (extras as any)[`PHOTO_${i + 1}`] = url;
    });

    // The map embed is a public Google Maps iframe URL — no API key, no
    // server fetch needed. Same URL works for preview and published HTML.
    const embed = buildMapEmbedUrl(p);
    if (embed) extras.MAP_EMBED_URL = embed;
    return { extras, failures };
  }

  // Mock generation: opens the preview overlay, fetches an existing HTML
  // template from the site_templates table, and streams it chunk-by-chunk
  // into streamingText so it reads like a real Gemini run. When the
  // "stream" finishes, the preview renders in a locked state inside
  // the iframe itself.
  async function runMockGeneration(p: Place) {
    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;
    setPreviewFor(p);
    setPreviewHtml(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setStreamingText("");
    setCurrentTemplate(null);
    setMockPreviewLocked(false);
    setPreviewModel("generating · gemini-3-flash-preview");

    // Pull a template to stream. Priority:
    //   1. site_templates row matching this primary_type (per-type cache)
    //   2. fallback_mock_template — the single shared template for any
    //      business type that doesn't have its own row yet
    //   3. the hardcoded sample in this file (last-resort, table empty)
    const supabase = createSupabaseBrowserClient();
    const primaryType = p.primaryType || "business";
    let html: string;
    const { data: matched } = await supabase
      .from("site_templates")
      .select("html_template")
      .eq("primary_type", primaryType)
      .maybeSingle();
    if (matched?.html_template) {
      html = matched.html_template;
    } else {
      const { data: fallback } = await supabase
        .from("fallback_mock_template")
        .select("html_template")
        .maybeSingle();
      html = fallback?.html_template || FALLBACK_MOCK_HTML;
    }

    // Wait a bit before the first bytes appear, then stream slowly enough
    // that the mock generation feels deliberate rather than abrupt.
    const INITIAL_DELAY_MS = 7500;
    const TOTAL_MS = 32000;
    const CHUNKS = 110;
    const chunkSize = Math.max(1, Math.ceil(html.length / CHUNKS));
    const delayMs = TOTAL_MS / CHUNKS;
    await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS));
    if (ac.signal.aborted) return;
    for (let i = 0; i < html.length; i += chunkSize) {
      if (ac.signal.aborted) return;
      setStreamingText(html.slice(0, Math.min(html.length, i + chunkSize)));
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (ac.signal.aborted) return;

    setCurrentTemplate(html);
    setPreviewHtml(renderPreviewHtml(html, p));
    setPreviewModel("preview locked · gemini-3-flash-preview");
    setStreamingText("");
    setPreviewLoading(false);
    setMockPreviewLocked(true);
  }

  async function generatePreview(p: Place, forceRegenerate = false) {
    const primaryType = p.primaryType || "business";
    const supabase = createSupabaseBrowserClient();

    // Auth check is the VERY first thing. Anonymous visitors see the
    // sign-in modal after a short delay; the preview overlay never opens.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await new Promise((r) => setTimeout(r, 600));
      openSignInPrompt("generate", p);
      return;
    }

    // Paywall mode: instead of calling Gemini (or even using the cached
    // template), pretend to generate by streaming HTML from the database
    // character-by-character, then render the result in a locked iframe.
    // Flip MOCK_GENERATION off below to restore the real flow.
    if (MOCK_GENERATION) {
      await runMockGeneration(p);
      return;
    }

    // Signed in — try the cached template first.
    if (!forceRegenerate) {
      const { data: cached } = await supabase
        .from("site_templates")
        .select("html_template, model")
        .eq("primary_type", primaryType)
        .maybeSingle();

      if (cached?.html_template) {
        try {
          previewAbortRef.current?.abort();
          previewAbortRef.current = new AbortController();
          setPreviewFor(p);
          setPreviewError(null);
          setStreamingText("");
          setCurrentTemplate(cached.html_template);
          setMockPreviewLocked(false);
          setPreviewHtml(renderPreviewHtml(cached.html_template, p));
          setPreviewModel(`template · ${cached.model || "saved"}`);
          setPreviewLoading(false);
          return;
        } catch (err: any) {
          // If the saved template is somehow malformed, fall through to a
          // fresh generation rather than showing a broken page.
          // eslint-disable-next-line no-console
          console.warn("Failed to fill cached template:", err);
        }
      }
    }

    // No cache (or forced) — open the preview overlay and stream Gemini.
    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;
    setPreviewFor(p);
    setPreviewHtml(null);
    setPreviewModel(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setStreamingText("");
    setCurrentTemplate(null);
    setMockPreviewLocked(false);

    let lastErrorMsg = "Generation failed.";

    for (const model of GEMINI_MODEL_CHAIN) {
      try {
        const r = await fetch("/api/generate-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({ primaryType, model }),
        });

        if (!r.ok) {
          const text = await r.text();
          let message = text;
          try {
            message = JSON.parse(text)?.error?.message || text;
          } catch {
            /* keep text */
          }
          lastErrorMsg = message;
          if (isQuotaOrAccessError(r.status, message)) continue;
          throw new Error(message);
        }

        setPreviewModel(`generating · ${model}`);
        if (!r.body) throw new Error("No response stream.");

        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        const consumeLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) return;
          const data = trimmed.slice(5).trim();
          if (!data) return;
          try {
            const json = JSON.parse(data);
            const parts = json?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              const t = parts
                .map((part: any) => part?.text || "")
                .join("");
              if (t) {
                accumulated += t;
                setStreamingText(accumulated);
              }
            }
          } catch {
            /* skip malformed event */
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            consumeLine(line);
          }
        }
        if (buffer.trim()) consumeLine(buffer);

        if (!accumulated.trim()) throw new Error("Empty response from Gemini.");

        let templateHtml = accumulated.trim();
        const fence = /^```(?:html)?\s*([\s\S]*?)\s*```$/i.exec(templateHtml);
        if (fence) templateHtml = fence[1].trim();

        // Save the template to this signed-in user's per-type cache.
        const { error: saveErr } = await supabase
          .from("site_templates")
          .upsert(
            {
              user_id: user.id,
              primary_type: primaryType,
              html_template: templateHtml,
              model,
            },
            { onConflict: "user_id,primary_type" }
          );
        if (saveErr) {
          // eslint-disable-next-line no-console
          console.warn("Failed to save template:", saveErr.message);
        }

        setCurrentTemplate(templateHtml);
        setMockPreviewLocked(false);
        setPreviewHtml(renderPreviewHtml(templateHtml, p));
        setPreviewModel(`new · ${model}`);
        setStreamingText("");
        setPreviewLoading(false);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        lastErrorMsg = err?.message || lastErrorMsg;
        setPreviewError(lastErrorMsg);
        setPreviewLoading(false);
        return;
      }
    }

    setPreviewError(
      `${lastErrorMsg} (tried: ${GEMINI_MODEL_CHAIN.join(", ")})`
    );
    setPreviewLoading(false);
  }

  // Auto-scroll the streaming code preview to follow the latest text.
  useEffect(() => {
    if (streamCodeRef.current) {
      streamCodeRef.current.scrollTop = streamCodeRef.current.scrollHeight;
    }
  }, [streamingText]);

  function closePreview() {
    resetPreviewState();
  }


  // Build a URL-safe slug from the business name. ASCII alphanumerics +
  // hyphens, max 60 chars, no leading/trailing dashes.
  function slugifyBusinessName(name: string): string {
    const s = (name || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "");
    return s || "site";
  }

  // Publishes the filled template under a slug derived from the business
  // name. If another user already published a site at the same slug, we
  // append -2, -3, … until we find an available one. URLs look like
  // /site/tonys-pizza or /site/tonys-pizza-3. Returns the full public URL.
  async function publishSiteForPlace(p: Place): Promise<string> {
    if (!currentTemplate) throw new Error("No website template generated yet.");

    const { extras, failures } = await buildPublishExtras(p);
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.warn("Photo-data failures while publishing:", failures);
    }
    const html = fillTemplate(
      currentTemplate,
      businessInfoFromPlace(p),
      extras
    );

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const base = slugifyBusinessName(p.name);

    // Race-safe: try the base slug, then -2, -3, …, retrying on Postgres
    // unique-violation (23505) until we get one that isn't taken.
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const { error } = await supabase
        .from("published_sites")
        .insert({
          id: candidate,
          user_id: user.id,
          html,
          business_name: p.name,
        });
      if (!error) {
        return `${window.location.origin}/site/${candidate}`;
      }
      if (error.code !== "23505") {
        throw new Error(error.message);
      }
    }
    throw new Error("Too many duplicates of this business name.");
  }

  // Click handler for the "Copy website URL" button on each result card.
  // Publishes the site, copies the public URL to the clipboard, and flashes
  // a "Copied!" indicator on the button for ~2 seconds. Anonymous visitors
  // see the in-page sign-in popup first — publishing creates a database row tied to
  // their user_id, so an account is required.
  async function copyWebsiteUrl(p: Place) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await new Promise((r) => setTimeout(r, 600));
      openSignInPrompt("publish", p);
      return;
    }
    try {
      const url = await publishSiteForPlace(p);
      await navigator.clipboard.writeText(url);
      setCopiedFor(p.id);
      setTimeout(() => {
        setCopiedFor((current) => (current === p.id ? null : current));
      }, 2000);
    } catch (err: any) {
      // eslint-disable-next-line no-alert
      alert("Failed to publish: " + (err?.message || err));
    }
  }

  useEffect(() => {
    if (!previewFor) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePreview();
    }
    document.addEventListener("keydown", onKey);
    // Don't lock body scroll — the sidebar remains usable next to the preview.
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [previewFor]);

  function fakeDomainFor(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return `${slug || "your-business"}.com`;
  }

  function focusOnMarker(p: Place) {
    setActiveId(p.id);
    const node = cardRefs.current[p.id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    maybeSwapPreviewTo(p);
  }

  return (
    <APIProvider apiKey={mapsKey}>
      <div className="app-main">
        <aside className="app-panel">
          <section className="search-shell">
            <div className="search-shell-inner">
              <form onSubmit={handleSearch}>
                <div className="search-bar">
                  <div className="search-field">
                    <SearchIcon />
                    <input
                      id="query"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search businesses"
                      autoComplete="off"
                    />
                  </div>
                  <div className="search-field">
                    <LocationIcon />
                    <input
                      id="location"
                      type="text"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setLocationDetected(false);
                      }}
                      placeholder={locationDetected ? `${location} (detected)` : "Location"}
                      autoComplete="off"
                    />
                  </div>
                  <button className="btn-search" type="submit" disabled={loading}>
                    {loading ? "…" : "Search"}
                  </button>
                </div>

                <div className="chips" ref={filtersRef}>
                  <button
                    type="button"
                    className={`chip filters-trigger ${activeFilterCount > 0 ? "active" : ""}`}
                    onClick={() => (filtersOpen ? setFiltersOpen(false) : openFilters())}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A1 1 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z" fill="currentColor" />
                    </svg>
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="filters-badge">{activeFilterCount}</span>
                    )}
                  </button>

                  {filtersOpen && (
                    <div className="filters-popover" role="dialog" aria-label="Filters">
                      <div className="filters-header">
                        <strong>Filters</strong>
                        {(pendingNoWebsite ||
                          pendingHasPhone ||
                          pendingMinRating > 0 ||
                          pendingMinReviews > 0) && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setPendingNoWebsite(false);
                              setPendingHasPhone(false);
                              setPendingMinRating(0);
                              setPendingMinReviews(0);
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      <label className="filter-row">
                        <span>Business has no website</span>
                        <input
                          type="checkbox"
                          checked={pendingNoWebsite}
                          onChange={(e) => setPendingNoWebsite(e.target.checked)}
                        />
                      </label>

                      <label className="filter-row">
                        <span>Has phone number</span>
                        <input
                          type="checkbox"
                          checked={pendingHasPhone}
                          onChange={(e) => setPendingHasPhone(e.target.checked)}
                        />
                      </label>

                      <label className="filter-row">
                        <span>Minimum rating</span>
                        <select
                          value={pendingMinRating}
                          onChange={(e) => setPendingMinRating(parseFloat(e.target.value))}
                        >
                          <option value={0}>Any</option>
                          <option value={3.5}>3.5+</option>
                          <option value={4}>4.0+</option>
                          <option value={4.5}>4.5+</option>
                        </select>
                      </label>

                      <label className="filter-row">
                        <span>Minimum reviews</span>
                        <select
                          value={pendingMinReviews}
                          onChange={(e) => setPendingMinReviews(parseInt(e.target.value, 10))}
                        >
                          <option value={0}>Any</option>
                          <option value={10}>10+</option>
                          <option value={50}>50+</option>
                          <option value={100}>100+</option>
                          <option value={500}>500+</option>
                        </select>
                      </label>

                      <div className="filters-footer">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={applyFilters}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </section>

          <div className="panel-results">
            {error && <div className="banner error">{error}</div>}

            {loading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="skeleton-card" key={i}>
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line short" />
                    <div className="skeleton-line long" />
                  </div>
                ))}
              </>
            )}

            {!loading && results && filteredResults.length > 0 && (
              <>
                <p className="results-summary">
                  Showing {filteredResults.length} of {results.length} result
                  {results.length === 1 ? "" : "s"}
                  {filterNoWebsite ? ` · scanned ${totalBeforeFilter}` : ""}
                  {pagesFetched > 1 ? ` (${pagesFetched} pages)` : ""}
                </p>
                {filteredResults.map((p) => (
                  <article
                    className={`result-card ${activeId === p.id ? "active" : ""}`}
                    key={p.id}
                    ref={(el) => { cardRefs.current[p.id] = el; }}
                    onClick={() => focusOnPlace(p)}
                  >
                    {p.photos && p.photos.length > 0 && (
                      <div className="result-thumb">
                        <img
                          src={p.photos[0]}
                          alt={`${p.name} photo`}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).parentElement?.remove();
                          }}
                        />
                      </div>
                    )}
                    <div className="result-head">
                      <h2 className="result-name">{p.name}</h2>
                      {!p.websiteUri && (
                        <span className="badge no-website">No website</span>
                      )}
                    </div>
                    {typeof p.rating === "number" && (
                      <div className="result-rating">
                        <span className="stars">{renderStars(p.rating)}</span>
                        <span>{p.rating.toFixed(1)}</span>
                        {p.userRatingCount ? (
                          <span className="count">({p.userRatingCount.toLocaleString()})</span>
                        ) : null}
                      </div>
                    )}
                    {p.websiteUri ? (
                      <div className="result-meta result-website">
                        <GlobeIcon />
                        <a
                          href={p.websiteUri}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {prettyHostname(p.websiteUri)}
                        </a>
                      </div>
                    ) : (
                      <div className="result-meta result-no-website">
                        <GlobeIcon />
                        <span>No website listed</span>
                      </div>
                    )}
                    {p.primaryType && (
                      <div className="result-type">{formatType(p.primaryType)}</div>
                    )}
                    {p.address && <div className="result-meta">{p.address}</div>}
                    {p.phone && (
                      <div className="result-meta">
                        <PhoneIcon />
                        <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>
                          {p.phone}
                        </a>
                      </div>
                    )}
                    <div className="result-actions">
                      {currentTemplate ? (
                        <button
                          type="button"
                          className="action-sell"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyWebsiteUrl(p);
                          }}
                        >
                          {copiedFor === p.id ? (
                            <>
                              <CheckIcon /> Copied!
                            </>
                          ) : (
                            <>
                              <GlobeIcon /> Copy website URL
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="action-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePreview(p);
                          }}
                        >
                          <SparkIcon /> Generate website
                        </button>
                      )}
                      {p.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DirectionsIcon /> View on Maps
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </>
            )}

            {!loading && results && filteredResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-title">No results</div>
                {results.length > 0
                  ? `${results.length} place${results.length === 1 ? "" : "s"} matched your search but were excluded by the filters. Relax the rating, reviews, or "has phone" filter to see them.`
                  : filterNoWebsite && totalBeforeFilter > 0
                  ? `All ${totalBeforeFilter} place${totalBeforeFilter === 1 ? "" : "s"} we found already have a website. Toggle "No website" off to see them.`
                  : "Try a different query or location."}
              </div>
            )}

            {!loading && !results && (
              <div className="empty-state">
                <div className="empty-title">Search to get started</div>
                Type a business category and a location above.
              </div>
            )}
          </div>
        </aside>

        <div className="app-map">
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={defaultCenter}
            defaultZoom={defaultZoom}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            style={{ width: "100%", height: "100%" }}
          >
            <FitToBounds points={points} />
            <PanTo point={panTarget} />

            {placedResults.map((p) => (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                onClick={() => focusOnMarker(p)}
              >
                <Pin
                  background={!p.websiteUri ? "#f9ab00" : "#1a73e8"}
                  borderColor={!p.websiteUri ? "#b06000" : "#1765cc"}
                  glyphColor="#ffffff"
                />
              </AdvancedMarker>
            ))}

            {activePlace &&
              typeof activePlace.lat === "number" &&
              typeof activePlace.lng === "number" && (
                <InfoWindow
                  position={{ lat: activePlace.lat, lng: activePlace.lng }}
                  pixelOffset={[0, -40]}
                  onCloseClick={() => setActiveId(null)}
                >
                  <div style={{ minWidth: 180, color: "#202124" }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {activePlace.name}
                    </div>
                    {activePlace.address && (
                      <div style={{ fontSize: 12, color: "#5f6368" }}>
                        {activePlace.address}
                      </div>
                    )}
                    {!activePlace.websiteUri && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#fef7e0",
                          color: "#b06000",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        No website
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
          </Map>

          {previewFor && (
        <div
          className="preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Generated website for ${previewFor.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          <div className="preview-window">
            <div className="preview-chrome">
              <div className="chrome-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="chrome-address">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z"
                    fill="currentColor"
                  />
                </svg>
                <span>https://{fakeDomainFor(previewFor.name)}</span>
                {previewModel && (
                  <span className="model-badge">{previewModel}</span>
                )}
              </div>
              <div className="chrome-actions">
                {previewHtml && !previewLoading && (
                  <button
                    type="button"
                    className="chrome-btn"
                    onClick={() => generatePreview(previewFor, true)}
                    title="Regenerate template from scratch (will call Gemini and overwrite the cached template for this business type)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.45 11h-2.09A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="chrome-btn close"
                  onClick={closePreview}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="preview-body">
              {previewLoading && (
                <div className="preview-generating">
                  <div className="spark-pulse">
                    <SparkIcon />
                  </div>
                  <div className="preview-generating-title">
                    Designing a website for <strong>{previewFor.name}</strong>
                  </div>
                  <div className="preview-generating-sub">
                    {streamingText
                      ? `Streaming live from Gemini · ${streamingText.length.toLocaleString()} characters`
                      : "Connecting to Gemini…"}
                  </div>

                  <div className="stream-code">
                    <pre ref={streamCodeRef} className="stream-code-tail">
                      {streamingText || "<!-- waiting for first bytes -->"}
                      <span className="stream-cursor">▌</span>
                    </pre>
                  </div>
                </div>
              )}

              {previewError && !previewLoading && (
                <div className="preview-error">
                  <div className="empty-title">Generation failed</div>
                  <p>{previewError}</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => generatePreview(previewFor)}
                  >
                    Try again
                  </button>
                </div>
              )}

              {previewHtml && !previewLoading && !previewError && (
                <iframe
                  title={`Generated website for ${previewFor.name}`}
                  srcDoc={previewHtml}
                  // allow-same-origin is required so the nested Google Maps
                  // embed iframe can load its own subresources (without it
                  // both frames are treated as null-origin and Maps blocks
                  // its own internal navigation). allow-popups lets links
                  // open in new tabs.
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  className="preview-iframe"
                />
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {signInPromptReason && (
        <div
          className="signin-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSignInPrompt();
          }}
        >
          <div className="signin-modal">
            <button
              type="button"
              className="signin-close"
              onClick={closeSignInPrompt}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <h3 className="signin-title">
              {signInPromptReason === "publish"
                ? "Sign in to publish"
                : "Sign in to generate"}
            </h3>
            <p className="signin-sub">
              {signInPromptReason === "publish"
                ? "Create a free account so we can publish the website under your name."
                : "Create a free account to design a website for this business with Gemini."}
            </p>

            {verifySent ? (
              <div className="signin-success">
                <strong>Verification email sent.</strong> Click the link in
                your inbox to activate <code>{signInEmail}</code>, then come
                back and sign in.
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="signin-form">
                <label htmlFor="signin-email" className="signin-label">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="signin-input"
                  disabled={signInLoading}
                />
                <label htmlFor="signin-password" className="signin-label">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••"
                  className="signin-input"
                  disabled={signInLoading}
                  minLength={6}
                />
                {signInError && (
                  <div className="signin-error">{signInError}</div>
                )}
                <div className="signin-buttons">
                  <button
                    type="submit"
                    className="btn btn-primary signin-submit"
                    disabled={signInLoading}
                  >
                    {signInLoading ? "…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    className="btn signin-create"
                    onClick={handleSignUp}
                    disabled={signInLoading}
                  >
                    Create account
                  </button>
                </div>
              </form>
            )}

            <div className="signin-divider"><span>or</span></div>

            <button
              type="button"
              className="btn-google signin-google"
              onClick={handleGoogleSignIn}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}

      {mockPreviewLocked && previewHtml && !previewLoading && !previewError && (
        <div className="stripe-paywall-page" role="dialog" aria-modal="true" aria-label="Subscribe to access and generate websites">
          <div className="stripe-paywall-page-scrim" />
          <div className="stripe-paywall-page-modal">
            <p className="stripe-paywall-kicker">Subscription required</p>
            <h2 className="stripe-paywall-title">Subscribe to access and generate websites</h2>
            <p className="stripe-paywall-sub">Secure checkout powered by Stripe Elements.</p>
            <button type="button" className="stripe-start-btn" onClick={startCheckoutSession} disabled={checkoutLoading}>
                {checkoutLoading ? "Loading..." : "Subscribe"}
            </button>
            <div className="stripe-elements-wrap">
              {checkoutLoading && <div className="stripe-elements-status">Starting Stripe checkout session...</div>}
              {checkoutError && <div className="stripe-elements-status stripe-elements-error">{checkoutError}</div>}
            </div>
          </div>
        </div>
      )}


    </APIProvider>
  );
}

