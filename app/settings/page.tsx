import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  saveGoogleMapsKey,
  deleteGoogleMapsKey,
  saveGeminiKey,
  deleteGeminiKey,
} from "./actions";

type SearchParams = { [key: string]: string | string[] | undefined };

function maskKey(key: string) {
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.max(8, key.length - 8))}${key.slice(-4)}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("user_api_keys")
    .select("google_maps_api_key, gemini_api_key, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const notice = typeof params.notice === "string" ? params.notice : null;

  const mapsKey: string | null = row?.google_maps_api_key ?? null;
  const geminiKey: string | null = row?.gemini_api_key ?? null;

  return (
    <>
      <header className="app-header">
        <Link href="/" className="app-brand">
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
          <Link href="/">Search</Link>
          <form action="/auth/signout" method="post">
            <button className="btn-link" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <main className="settings-shell">
        <h1>Settings</h1>
        <p className="settings-intro">
          Bring your own keys. Each is stored in your private row in Supabase
          with row-level security and only used server-side when you search.
        </p>

        {notice && <div className="banner success">{notice}</div>}
        {error && <div className="banner error">{error}</div>}

        <section className="key-section">
          <h2>Google Maps API key</h2>
          <p className="key-desc">
            Used for place search and city detection. Get one at{" "}
            <a
              href="https://mapsplatform.google.com/maps-demo-key/"
              target="_blank"
              rel="noreferrer"
            >
              mapsplatform.google.com/maps-demo-key
            </a>
            . Make sure <strong>Places API (New)</strong> and{" "}
            <strong>Geocoding API</strong> are enabled.
          </p>

          {mapsKey && (
            <div className="key-status">
              <span>
                Saved: <code>{maskKey(mapsKey)}</code>
              </span>
              <form action={deleteGoogleMapsKey}>
                <button className="btn btn-danger" type="submit">Remove</button>
              </form>
            </div>
          )}

          <form action={saveGoogleMapsKey} className="key-form">
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={mapsKey ? "Replace with new key" : "AIza…"}
              required
            />
            <button className="btn btn-primary" type="submit">
              Save key
            </button>
          </form>
        </section>

        <section className="key-section">
          <h2>Gemini API key</h2>
          <p className="key-desc">
            For AI-powered features. Get one at{" "}
            <a
              href="https://aistudio.google.com/app/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              aistudio.google.com/app/api-keys
            </a>
            .
          </p>

          {geminiKey && (
            <div className="key-status">
              <span>
                Saved: <code>{maskKey(geminiKey)}</code>
              </span>
              <form action={deleteGeminiKey}>
                <button className="btn btn-danger" type="submit">Remove</button>
              </form>
            </div>
          )}

          <form action={saveGeminiKey} className="key-form">
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={geminiKey ? "Replace with new key" : "AIza…"}
              required
            />
            <button className="btn btn-primary" type="submit">
              Save key
            </button>
          </form>
        </section>

        {row?.updated_at && (
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            Last updated {new Date(row.updated_at).toLocaleString()}
          </p>
        )}
      </main>
    </>
  );
}
