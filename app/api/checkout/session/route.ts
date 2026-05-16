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

  const stripe = new Stripe(secretKey);
  try {
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page" as any,
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl,
        client_reference_id: placeId || undefined,
        wallet_options: {
          link: { display: "never" as any },
        } as any,
      });
    } catch (e: any) {
      // Back-compat with accounts/API versions that still expect `embedded`.
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded" as any,
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl,
        client_reference_id: placeId || undefined,
        wallet_options: {
          link: { display: "never" as any },
        } as any,
      });
    }

    if (!session.client_secret) return jsonError(500, "Stripe session missing client_secret.");
    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return jsonError(500, err?.raw?.message || err?.message || "Stripe failed to create checkout session.");
  }
}
