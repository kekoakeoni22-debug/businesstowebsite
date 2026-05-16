import Stripe from "stripe";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey) {
    return jsonError(500, "STRIPE_SECRET_KEY is not set on the server.");
  }
  if (!priceId) {
    return jsonError(500, "STRIPE_PRICE_ID is not set on the server.");
  }

  const origin = new URL(req.url).origin;
  const successUrl =
    process.env.STRIPE_SUCCESS_URL || `${origin}/?checkout=success`;
  const cancelUrl =
    process.env.STRIPE_CANCEL_URL || `${origin}/?checkout=cancelled`;

  const stripe = new Stripe(secretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: "auto",
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return jsonError(500, "Stripe session did not return a redirect URL.");
  }

  return Response.redirect(session.url, 303);
}
