import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ paid: false });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ paid: false });

  try {
    const stripe = new Stripe(stripeKey);
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return NextResponse.json({ paid: false });

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });

    const paid = subs.data.some((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    );
    return NextResponse.json({ paid });
  } catch {
    return NextResponse.json({ paid: false });
  }
}
