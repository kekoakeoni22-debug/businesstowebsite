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

export default function SearchClient({ mapsKey }: { mapsKey: string }) {
  const [query, setQuery] = useState("restaurants");
  const [location, setLocation] = useState("");
  const [locationDetected, setLocationDetected] = useState(false);
  const [filterNoWebsite, setFilterNoWebsite] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [totalBeforeFilter, setTotalBeforeFilter] = useState(0);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
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

  const placedResults = useMemo(
    () =>
      (results || []).filter(
        (p): p is Place & { lat: number; lng: number } =>
          typeof p.lat === "number" && typeof p.lng === "number"
      ),
    [results]
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
  }

  function focusOnMarker(p: Place) {
    setActiveId(p.id);
    const node = cardRefs.current[p.id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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

                <div className="chips">
                  <label className={`chip ${filterNoWebsite ? "active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={filterNoWebsite}
                      onChange={(e) => setFilterNoWebsite(e.target.checked)}
                    />
                    <span className="chip-check"><CheckIcon /></span>
                    No website only
                  </label>
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

            {!loading && results && results.length > 0 && (
              <>
                <p className="results-summary">
                  Showing {results.length} result{results.length === 1 ? "" : "s"}
                  {filterNoWebsite
                    ? ` without a website · scanned ${totalBeforeFilter}`
                    : ` · ${totalBeforeFilter} found`}
                  {pagesFetched > 1 ? ` (${pagesFetched} pages)` : ""}
                </p>
                {results.map((p) => (
                  <article
                    className={`result-card ${activeId === p.id ? "active" : ""}`}
                    key={p.id}
                    ref={(el) => { cardRefs.current[p.id] = el; }}
                    onClick={() => focusOnPlace(p)}
                  >
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

            {!loading && results && results.length === 0 && (
              <div className="empty-state">
                <div className="empty-title">No results</div>
                {filterNoWebsite && totalBeforeFilter > 0
                  ? `All ${totalBeforeFilter} place${totalBeforeFilter === 1 ? "" : "s"} we found already have a website. Toggle "No website only" off to see them.`
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
        </div>
      </div>
    </APIProvider>
  );
}
