"use client";

import { useEffect, useState } from "react";

type Place = {
  id: string;
  name: string;
  address?: string;
  websiteUri?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
};

export default function Home() {
  const [query, setQuery] = useState("restaurants");
  const [location, setLocation] = useState("");
  const [locationDetected, setLocationDetected] = useState(false);
  const [filterNoWebsite, setFilterNoWebsite] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [totalBeforeFilter, setTotalBeforeFilter] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      () => {
        /* user denied — leave location blank */
      },
      { timeout: 8000 }
    );
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
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
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Business Finder</h1>
      <p className="subtitle">
        Search local businesses by category and city. By default, only shows
        businesses that don&apos;t appear to have a website.
      </p>

      <form onSubmit={handleSearch}>
        <div className="controls">
          <div className="field">
            <label htmlFor="query">What to search for</label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. plumbers, coffee shops"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="location">
              Location {locationDetected && <span className="muted">(detected)</span>}
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setLocationDetected(false);
              }}
              placeholder="City or area"
              autoComplete="off"
            />
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <label className="filter-row">
          <input
            type="checkbox"
            checked={filterNoWebsite}
            onChange={(e) => setFilterNoWebsite(e.target.checked)}
          />
          Filter for businesses without a website
        </label>
      </form>

      {error && <div className="error">{error}</div>}

      {results && (
        <div className="results">
          {results.length === 0 ? (
            <p className="muted">
              No results
              {filterNoWebsite && totalBeforeFilter > 0
                ? ` — all ${totalBeforeFilter} match(es) had a website. Uncheck the filter to see them.`
                : "."}
            </p>
          ) : (
            <>
              <p className="muted">
                Showing {results.length} result{results.length === 1 ? "" : "s"}
                {filterNoWebsite
                  ? ` without a website (of ${totalBeforeFilter} total found)`
                  : ""}
                .
              </p>
              {results.map((p) => (
                <div className="result" key={p.id}>
                  <p className="result-name">
                    {p.name}
                    {!p.websiteUri && (
                      <span className="no-website-badge">No website</span>
                    )}
                  </p>
                  {p.address && <p className="result-meta">{p.address}</p>}
                  {p.phone && <p className="result-meta">{p.phone}</p>}
                  {typeof p.rating === "number" && (
                    <p className="result-meta">
                      ★ {p.rating.toFixed(1)}{" "}
                      {p.userRatingCount ? `(${p.userRatingCount} reviews)` : ""}
                    </p>
                  )}
                  {p.websiteUri && (
                    <p className="result-meta">
                      <a href={p.websiteUri} target="_blank" rel="noreferrer">
                        {p.websiteUri}
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </main>
  );
}
