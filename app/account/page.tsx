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

  const creditsRaw =
    user.user_metadata?.credits ??
    user.app_metadata?.credits ??
    user.user_metadata?.btw_credits ??
    user.app_metadata?.btw_credits ??
    0;
  const credits =
    typeof creditsRaw === "number"
      ? creditsRaw
      : Number.parseInt(String(creditsRaw || 0), 10) || 0;

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
    <main className="account-page">
      <div className="account-card">
        <h1>Our account</h1>
        <p className="muted">{user.email}</p>
        <div className="account-metric">
          <span>Subscription status</span>
          <strong>{subscriptionStatus}</strong>
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
              <button className="btn-link" type="submit">Cancel renewal</button>
            </form>
          )}
          <form action="/auth/signout" method="post">
            <button className="btn-link" type="submit">Log out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
