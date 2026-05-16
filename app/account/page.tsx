import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/");
  }

  const { data: creditData } = await supabase.rpc("get_user_credits", {
    p_user_id: user.id,
    p_monthly: 4000,
  });
  const credits =
    typeof creditData === "number"
      ? creditData
      : Number.parseInt(String(creditData || 4000), 10) || 4000;

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  let subscriptionStatus: "Paid" | "Free" = "Free";
  let renewsAtLabel = "N/A";
  let cancelAtPeriodEnd = false;
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
        const chosen =
          subs.data.find((s) =>
            ["active", "trialing", "past_due", "unpaid"].includes(s.status)
          ) || subs.data[0];
        if (chosen) {
          const paid = ["active", "trialing", "past_due", "unpaid"].includes(
            chosen.status
          );
          subscriptionStatus = paid ? "Paid" : "Free";
          cancelAtPeriodEnd = Boolean(chosen.cancel_at_period_end);
          const periodEnd =
            (chosen as any).current_period_end ||
            (chosen.items?.data?.[0] as any)?.current_period_end;
          if (periodEnd) {
            renewsAtLabel = new Date(periodEnd * 1000).toLocaleDateString();
          }
        }
      }
    } catch {
      // Keep graceful fallback so account page still renders.
    }
  }

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
        </div>
      </header>
      <main className="account-page">
        <div className="account-card">
          <h1>My account</h1>
          <p className="muted">{user.email}</p>
          <div className="account-metric">
            <span>Subscription status</span>
            <strong>
              {subscriptionStatus}
              {subscriptionStatus === "Paid" && cancelAtPeriodEnd ? " (cancelled)" : ""}
            </strong>
          </div>
          <div className="account-metric">
            <span>{cancelAtPeriodEnd ? "Access until" : "Renews on"}</span>
            <strong>{renewsAtLabel}</strong>
          </div>
          <div className="account-metric">
            <span>Credits remaining</span>
            <strong>{credits}</strong>
          </div>
          <div className="account-actions">
            <Link href="/" className="btn-link">Back to search</Link>
            {subscriptionStatus === "Paid" && !cancelAtPeriodEnd && (
              <form action="/api/subscription/cancel" method="post">
                <label className="cancel-confirm-row">
                  <input type="checkbox" name="confirm" value="yes" required /> Are you sure?
                </label>
                <textarea
                  name="reason"
                  className="cancel-reason-input"
                  required
                  minLength={3}
                  placeholder="Reason for cancellation"
                />
                <button className="btn-link" type="submit">Cancel renewal</button>
              </form>
            )}
            {(subscriptionStatus === "Free" || cancelAtPeriodEnd) && (
              <Link href="/" className="btn-link">Upgrade</Link>
            )}
            <form action="/auth/signout" method="post">
              <button className="btn-link" type="submit">Log out</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
