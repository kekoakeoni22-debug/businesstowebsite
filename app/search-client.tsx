"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  buildTemplatePrompt,
  fillTemplate,
  GEMINI_MODEL_CHAIN,
  isQuotaOrAccessError,
  type BusinessInfo,
  type FillExtras,
} from "@/lib/generate-site/prompt";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM4 8V6h16v2H4zm0 4h16v6H4v-6zm2 2v2h6v-2H6z"
        fill="currentColor"
      />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"
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
  geminiKey,
  defaultLocation,
  defaultCoords,
}: {
  mapsKey: string;
  geminiKey: string | null;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

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
  const previewAbortRef = useRef<AbortController | null>(null);
  const streamCodeRef = useRef<HTMLPreElement | null>(null);

  // Sell-this-website popup
  const [sellFor, setSellFor] = useState<Place | null>(null);

  useEffect(() => {
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

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveId(null);
    try {
      const body: Record<string, unknown> = {
        query,
        location,
        filterNoWebsite,
      };
      if (coords && locationDetected && location) {
        body.coords = coords;
      }
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.error || "Search failed");
      }
      setResults(data.places || []);
      setTotalBeforeFilter(data.totalBeforeFilter ?? 0);
      setPagesFetched(data.pagesFetched ?? 1);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
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
    const info = businessInfoFromPlace(p);
    setPreviewFor(p);
    setPreviewHtml(fillTemplate(currentTemplate, info, buildPreviewExtras(p)));
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

  async function generatePreview(p: Place, forceRegenerate = false) {
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

    const info = businessInfoFromPlace(p);
    const primaryType = p.primaryType || "business";

    const supabase = createSupabaseBrowserClient();

    // Try the cached template first unless the user asked for a regenerate.
    if (!forceRegenerate) {
      const { data: cached } = await supabase
        .from("site_templates")
        .select("html_template, model")
        .eq("primary_type", primaryType)
        .maybeSingle();

      if (cached?.html_template) {
        try {
          const filled = fillTemplate(
            cached.html_template,
            info,
            buildPreviewExtras(p)
          );
          setCurrentTemplate(cached.html_template);
          setPreviewHtml(filled);
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

    // No template yet (or forced) — generate one with Gemini, then save it.
    if (!geminiKey) {
      setPreviewError(
        "No Gemini API key on file. Add one in Settings, then refresh."
      );
      setPreviewLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPreviewError("Not signed in.");
      setPreviewLoading(false);
      return;
    }

    const prompt = buildTemplatePrompt(primaryType);
    const requestBody = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 32768,
        responseMimeType: "text/plain",
      },
    });

    let lastErrorMsg = "Generation failed.";

    for (const model of GEMINI_MODEL_CHAIN) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
          geminiKey
        )}`;

        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: requestBody,
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

        // Save the template for future reuse.
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

        const filled = fillTemplate(templateHtml, info, buildPreviewExtras(p));
        setCurrentTemplate(templateHtml);
        setPreviewHtml(filled);
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
    previewAbortRef.current?.abort();
    setPreviewFor(null);
    setPreviewHtml(null);
    setPreviewModel(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setStreamingText("");
    setCurrentTemplate(null);
  }

  function openSellFor(p: Place) {
    setSellFor(p);
  }

  function closeSell() {
    setSellFor(null);
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
  // /site/tonys-pizza or /site/tonys-pizza-3.
  async function openFilledWebsiteForPlace(p: Place) {
    if (!currentTemplate) return;

    const newTab = window.open("about:blank", "_blank");
    if (!newTab) {
      // eslint-disable-next-line no-alert
      alert("Pop-up was blocked. Allow pop-ups for this site and try again.");
      return;
    }

    try {
      // Build self-contained HTML: every photo becomes a base64 data: URL
      // so the published /site/<slug> page works even after Google's signed
      // CDN URLs expire. The map is a public Google Maps embed iframe.
      newTab.document.body.innerHTML =
        "<p style='font-family:sans-serif;padding:2rem'>Building your site…</p>";
      const photoCount = (p.photos || []).length;

      // DEBUG: unconditional alert so we can see what's happening end to end.
      // Lists each proxy URL Places gave us and the path we'd extract from it.
      // eslint-disable-next-line no-alert
      alert(
        `DEBUG buildPublishExtras start\n` +
          `business: ${p.name}\n` +
          `p.photos.length: ${photoCount}\n` +
          `urls:\n${(p.photos || []).map((u, i) => `  ${i + 1}. ${u}`).join("\n") || "  (none)"}\n` +
          `extracted paths:\n${(p.photos || [])
            .map((u, i) => `  ${i + 1}. ${extractPhotoPath(u) ?? "(failed to extract)"}`)
            .join("\n") || "  (none)"}`
      );

      const { extras, failures } = await buildPublishExtras(p);
      const photoSuccess = (Object.keys(extras) as (keyof FillExtras)[]).filter(
        (k) => k.startsWith("PHOTO_")
      ).length;
      if (failures.length > 0) {
        // eslint-disable-next-line no-console
        console.warn("Photo-data failures while publishing:", failures);
        // Surface failures inline so the user doesn't need DevTools open.
        // eslint-disable-next-line no-alert
        alert(
          `${failures.length} of ${photoCount} photo(s) couldn't be embedded. The site will publish without them.\n\n` +
            failures.join("\n")
        );
      } else if (photoCount > 0 && photoSuccess === 0) {
        // eslint-disable-next-line no-alert
        alert(
          `Places API returned ${photoCount} photo reference(s) for this business, but none could be extracted. The published site will have no gallery.`
        );
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
      if (!user) {
        newTab.document.body.innerText = "Not signed in.";
        return;
      }

      const base = slugifyBusinessName(p.name);

      // Race-safe: try the base slug, then -2, -3, …, retrying on the
      // Postgres unique-violation error (code 23505) until we get an id.
      let chosen: string | null = null;
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
          chosen = candidate;
          break;
        }
        // 23505 = unique_violation. Anything else is a real error.
        if (error.code !== "23505") {
          newTab.document.body.innerText =
            "Failed to publish: " + error.message;
          return;
        }
        // Slug taken — try the next number.
      }

      if (!chosen) {
        newTab.document.body.innerText =
          "Failed to publish: too many duplicates of this name.";
        return;
      }

      newTab.location.href = `${window.location.origin}/site/${chosen}`;
    } catch (err: any) {
      newTab.document.body.innerText = "Failed to publish: " + (err?.message || err);
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

  useEffect(() => {
    if (!sellFor) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSell();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sellFor]);

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
                    onClick={() => setFiltersOpen((v) => !v)}
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
                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setFilterNoWebsite(false);
                              setFilterHasPhone(false);
                              setMinRating(0);
                              setMinReviews(0);
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
                          checked={filterNoWebsite}
                          onChange={(e) => setFilterNoWebsite(e.target.checked)}
                        />
                      </label>

                      <label className="filter-row">
                        <span>Has phone number</span>
                        <input
                          type="checkbox"
                          checked={filterHasPhone}
                          onChange={(e) => setFilterHasPhone(e.target.checked)}
                        />
                      </label>

                      <label className="filter-row">
                        <span>Minimum rating</span>
                        <select
                          value={minRating}
                          onChange={(e) => setMinRating(parseFloat(e.target.value))}
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
                          value={minReviews}
                          onChange={(e) => setMinReviews(parseInt(e.target.value, 10))}
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
                          onClick={() => setFiltersOpen(false)}
                        >
                          Done
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
                            openSellFor(p);
                          }}
                        >
                          <DollarIcon /> Sell website
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
                      {p.websiteUri && (
                        <a
                          href={p.websiteUri}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GlobeIcon /> Website
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

      {sellFor && (
        <div
          className="sell-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Sell website to ${sellFor.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSell();
          }}
        >
          <div className="sell-modal">
            <div className="sell-header">
              <div>
                <div className="sell-eyebrow">Sell this website to</div>
                <h3>{sellFor.name}</h3>
              </div>
              <button
                type="button"
                className="chrome-btn close"
                onClick={closeSell}
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

            <div className="sell-actions">
              {sellFor.phone ? (
                <a
                  className="sell-action"
                  href={`tel:${sellFor.phone}`}
                >
                  <PhoneIcon />
                  <div>
                    <div className="sell-action-title">Call the business</div>
                    <div className="sell-action-sub">{sellFor.phone}</div>
                  </div>
                </a>
              ) : (
                <div className="sell-action disabled">
                  <PhoneIcon />
                  <div>
                    <div className="sell-action-title">Call the business</div>
                    <div className="sell-action-sub">No phone on file</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="sell-action"
                onClick={() => openFilledWebsiteForPlace(sellFor)}
              >
                <GlobeIcon />
                <div>
                  <div className="sell-action-title">Open the generated website</div>
                  <div className="sell-action-sub">Opens in a new tab</div>
                </div>
              </button>

              <a
                className="sell-action"
                href="https://buy.stripe.com/test_placeholder"
                target="_blank"
                rel="noreferrer"
              >
                <CardIcon />
                <div>
                  <div className="sell-action-title">Send Stripe payment link</div>
                  <div className="sell-action-sub">
                    Placeholder — wire up real Stripe later
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </APIProvider>
  );
}
