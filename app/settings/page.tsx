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
    <main className="container">
      <nav className="topnav">
        <Link href="/">← Search</Link>
        <form action="/auth/signout" method="post">
          <button className="link" type="submit">Sign out</button>
        </form>
      </nav>

      <h1>Settings</h1>
      <p className="subtitle">
        Bring your own keys. Each is stored in your private row in Supabase
        (row-level security) and only ever used server-side.
      </p>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <section className="key-section">
        <h2>Google Maps API key</h2>
        <p className="muted">
          Used for place search and city detection. Get one at{" "}
          <a
            href="https://mapsplatform.google.com/maps-demo-key/"
            target="_blank"
            rel="noreferrer"
          >
            mapsplatform.google.com/maps-demo-key
          </a>
          . The key needs <strong>Places API (New)</strong> and{" "}
          <strong>Geocoding API</strong> enabled.
        </p>

        {mapsKey && (
          <div className="key-status">
            <p className="result-meta">
              <strong>Saved key:</strong> <code>{maskKey(mapsKey)}</code>
            </p>
            <form action={deleteGoogleMapsKey} style={{ marginTop: "0.5rem" }}>
              <button className="danger" type="submit">Remove key</button>
            </form>
          </div>
        )}

        <form action={saveGoogleMapsKey} className="key-form">
          <label htmlFor="mapsKey">
            {mapsKey ? "Replace key" : "Add key"}
          </label>
          <input
            id="mapsKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder="AIza…"
            required
          />
          <button className="primary" type="submit">Save Google Maps key</button>
        </form>
      </section>

      <section className="key-section">
        <h2>Gemini API key</h2>
        <p className="muted">
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
            <p className="result-meta">
              <strong>Saved key:</strong> <code>{maskKey(geminiKey)}</code>
            </p>
            <form action={deleteGeminiKey} style={{ marginTop: "0.5rem" }}>
              <button className="danger" type="submit">Remove key</button>
            </form>
          </div>
        )}

        <form action={saveGeminiKey} className="key-form">
          <label htmlFor="geminiKey">
            {geminiKey ? "Replace key" : "Add key"}
          </label>
          <input
            id="geminiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder="AIza…"
            required
          />
          <button className="primary" type="submit">Save Gemini key</button>
        </form>
      </section>

      {row?.updated_at && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Last updated {new Date(row.updated_at).toLocaleString()}
        </p>
      )}
    </main>
  );
}
