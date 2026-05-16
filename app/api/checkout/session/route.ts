import Stripe from "stripe";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey) return jsonError(500, "STRIPE_SECRET_KEY is not set on the server.");
  if (!priceId) return jsonError(500, "STRIPE_PRICE_ID is not set on the server.");

  const body = await req.json().catch(() => ({}));
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  const origin = new URL(req.url).origin;
  const returnUrl = process.env.STRIPE_SUCCESS_URL || `${origin}/?checkout=success`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || `${origin}/?checkout=cancelled`;

  const stripe = new Stripe(secretKey);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: returnUrl,
      cancel_url: cancelUrl,
      client_reference_id: placeId || undefined,
      allow_promotion_codes: true,
    });
    if (!session.url) return jsonError(500, "Stripe checkout session is missing redirect URL.");
    return new Response(JSON.stringify({ redirectUrl: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return jsonError(500, err?.message || "Stripe failed to create checkout session.");
  }
}
