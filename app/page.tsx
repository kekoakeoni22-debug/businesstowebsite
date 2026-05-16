import Link from "next/link";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SearchClient from "./search-client";
import Stripe from "stripe";

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

  // No sign-in wall anymore. Middleware auto-creates an anonymous Supabase
  // session for first-time visitors so the search and publish flows work
  // without auth. A real Google sign-in is still available via the header,
  // and surfaces the user's email + Sign out once they upgrade.
  const isAnonymous = !user || user.is_anonymous === true;
  let credits = 0;
  if (user && !isAnonymous) {
    let paid = false;
    const stripeKey = process.env.STRIPE_SECRET_KEY || "";
    if (stripeKey && user.email) {
      try {
        const stripe = new Stripe(stripeKey);
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        const customer = customers.data[0];
        if (customer) {
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: "all",
            limit: 10,
          });
          paid = subs.data.some((s) =>
            ["active", "trialing", "past_due", "unpaid"].includes(s.status)
          );
        }
      } catch {
        paid = false;
      }
    }
    const { data: creditData } = await supabase.rpc("get_user_credits", {
      p_user_id: user.id,
      p_monthly: paid ? 4000 : 0,
    });
    credits =
      typeof creditData === "number"
        ? creditData
        : Number.parseInt(String(creditData || (paid ? 4000 : 0)), 10) ||
          (paid ? 4000 : 0);
  }

  const mapsKey: string | null =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;

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
          {!isAnonymous ? (
            <>
              <Link href="/account" className="btn-link">My account</Link>
              <details className="account-menu">
                <summary className="account-menu-trigger" aria-label="Account menu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" fill="currentColor" />
                  </svg>
                </summary>
                <div className="account-menu-popover">
                  <div className="account-menu-row">
                    <span className="muted">Credits</span>
                    <strong>{credits}</strong>
                  </div>
                  <Link href="/account" className="account-menu-link">My account</Link>
                  <form action="/auth/signout" method="post">
                    <button className="account-menu-link account-menu-logout" type="submit">Log out</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/?openSignIn=1" className="btn-link">Sign in</Link>
          )}
        </div>
      </header>

      {!mapsKey ? (
        <main className="results-shell">
          <div className="banner info">
            <span>
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY isn&apos;t set on the server.
              Add it to the Vercel project&apos;s environment variables and
              redeploy.
            </span>
          </div>
        </main>
      ) : (
        <SearchClient
          mapsKey={mapsKey}
          defaultLocation={defaultLocation}
          defaultCoords={defaultCoords}
        />
      )}
    </div>
  );
}
