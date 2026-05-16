import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.redirect(new URL("/account", req.url));
  }

  const form = await req.formData().catch(() => null);
  const confirm = form?.get("confirm") === "yes";
  const reason = String(form?.get("reason") || "").trim();
  if (!confirm || !reason) {
    return NextResponse.redirect(new URL("/account?cancel_error=missing_reason", req.url));
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.redirect(new URL("/account", req.url));
  }

  const stripe = new Stripe(stripeKey);
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  const customer = customers.data[0];
  if (customer) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });
    const activeSub = subs.data.find((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    );
    if (activeSub && !activeSub.cancel_at_period_end) {
      await supabase.from("subscription_cancellations").insert({
        user_id: user.id,
        stripe_customer_id: customer.id,
        stripe_subscription_id: activeSub.id,
        reason,
      });
      await stripe.subscriptions.update(activeSub.id, {
        cancel_at_period_end: true,
      });
    }
  }

  return NextResponse.redirect(new URL("/account", req.url));
}
