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
  const resumePlace =
    body?.resumePlace && typeof body.resumePlace === "object"
      ? JSON.stringify(body.resumePlace)
      : "";
  const query = typeof body?.query === "string" ? body.query : "";
  const location = typeof body?.location === "string" ? body.location : "";
  const filterNoWebsite = body?.filterNoWebsite === true;
  const origin = new URL(req.url).origin;
  const returnUrlBase = process.env.STRIPE_SUCCESS_URL || `${origin}/`;
  const returnUrl = new URL(returnUrlBase);
  returnUrl.searchParams.set("resume", "1");
  returnUrl.searchParams.set("action", "generate");
  returnUrl.searchParams.set("checkout", "success");
  if (placeId) returnUrl.searchParams.set("placeId", placeId);
  if (resumePlace) returnUrl.searchParams.set("rp", encodeURIComponent(resumePlace));
  if (query) returnUrl.searchParams.set("q", query);
  if (location) returnUrl.searchParams.set("loc", location);
  if (filterNoWebsite) returnUrl.searchParams.set("nw", "1");

  const stripe = new Stripe(secretKey);
  try {
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page" as any,
        payment_method_types: ["card", "us_bank_account", "cashapp"],
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl.toString(),
        client_reference_id: placeId || undefined,
      });
    } catch (e: any) {
      // Back-compat with accounts/API versions that still expect `embedded`.
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded" as any,
        payment_method_types: ["card", "us_bank_account", "cashapp"],
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: returnUrl.toString(),
        client_reference_id: placeId || undefined,
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
