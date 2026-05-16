import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SearchClient from "./search-client";

export default async function Home() {
  const h = await headers();
  // Vercel injects geo headers on every request. Use the city as a default
  // location so the search box is pre-filled without waiting on browser
  // geolocation (which requires a permission prompt the user may decline).
  const ipCity = h.get("x-vercel-ip-city");
  const ipRegion = h.get("x-vercel-ip-country-region");
  const ipLat = h.get("x-vercel-ip-latitude");
  const ipLng = h.get("x-vercel-ip-longitude");
  const defaultLocation = ipCity
    ? `${decodeURIComponent(ipCity)}${ipRegion ? `, ${ipRegion}` : ""}`
    : "";
  const defaultCoords =
    ipLat && ipLng
      ? { lat: parseFloat(ipLat), lng: parseFloat(ipLng) }
      : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("user_api_keys")
    .select("google_maps_api_key, gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const mapsKey: string | null = row?.google_maps_api_key ?? null;
  const geminiKey: string | null = row?.gemini_api_key ?? null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/" className="app-brand" aria-label="Business To Website AI home">
          <span className="app-brand-logo" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                fill="currentColor"
              />
            </svg>
          </span>
          Business To Website AI
        </Link>
        <div className="app-user">
          <span className="email muted">{user.email}</span>
          <Link href="/settings">Settings</Link>
          <form action="/auth/signout" method="post">
            <button className="btn-link" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      {!mapsKey ? (
        <main className="results-shell">
          <div className="banner info">
            <span>
              You haven&apos;t added a Google Maps API key yet.{" "}
              <Link href="/settings">Add one in Settings</Link> to start searching.
            </span>
          </div>
        </main>
      ) : (
        <SearchClient
          mapsKey={mapsKey}
          geminiKey={geminiKey}
          defaultLocation={defaultLocation}
          defaultCoords={defaultCoords}
        />
      )}
    </div>
  );
}
