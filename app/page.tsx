import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SearchClient from "./search-client";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("user_api_keys")
    .select("google_maps_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasKey = Boolean(row?.google_maps_api_key);

  return (
    <main className="container">
      <nav className="topnav">
        <span className="muted">{user.email || "Signed in"}</span>
        <div className="topnav-right">
          <Link href="/settings">Settings</Link>
          <form action="/auth/signout" method="post">
            <button className="link" type="submit">Sign out</button>
          </form>
        </div>
      </nav>

      <h1>Business Finder</h1>
      <p className="subtitle">
        Search local businesses by category and city. By default, only shows
        businesses that don&apos;t appear to have a website.
      </p>

      {!hasKey ? (
        <div className="notice">
          You haven&apos;t added a Google Maps API key yet.{" "}
          <Link href="/settings">Add one in Settings</Link> to start searching.
        </div>
      ) : (
        <SearchClient />
      )}
    </main>
  );
}
