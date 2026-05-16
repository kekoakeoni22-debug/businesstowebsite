import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveApiKey, deleteApiKey } from "./actions";

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
    .select("google_maps_api_key, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const notice = typeof params.notice === "string" ? params.notice : null;

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
        Bring your own Google Maps API key. It&apos;s stored in your private row
        in Supabase (row-level security) and only ever used server-side when
        you search.
      </p>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      {row?.google_maps_api_key && (
        <div className="key-status">
          <p className="result-meta">
            <strong>Saved key:</strong> <code>{maskKey(row.google_maps_api_key)}</code>
          </p>
          <p className="result-meta muted">
            Last updated {new Date(row.updated_at).toLocaleString()}
          </p>
          <form action={deleteApiKey} style={{ marginTop: "0.5rem" }}>
            <button className="danger" type="submit">Remove key</button>
          </form>
        </div>
      )}

      <form action={saveApiKey} className="key-form">
        <label htmlFor="apiKey">
          {row?.google_maps_api_key ? "Replace key" : "Add key"}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="AIza…"
          required
        />
        <p className="muted">
          The key needs <strong>Places API (New)</strong> and{" "}
          <strong>Geocoding API</strong> enabled in Google Cloud.
        </p>
        <button className="primary" type="submit">Save key</button>
      </form>
    </main>
  );
}
