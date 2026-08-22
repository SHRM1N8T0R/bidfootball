import { json, getCrowns, stripe, clean } from "../_shared.js";

// POST /api/checkout
// Body: { code, country, flag, club, clubLogo, amount, bidder }
// Validates the bid beats the current crown, then creates a Stripe Checkout
// Session. The bid details ride along in session metadata; the crown is only
// awarded later, in the webhook, once payment actually completes.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const code = clean(body.code, 3).toUpperCase();
  const country = clean(body.country, 60);
  const flag = clean(body.flag, 200);
  const club = clean(body.club, 60);
  const clubLogo = clean(body.clubLogo, 300);
  const bidder = clean(body.bidder, 40) || "Anonymous";
  const amount = Math.floor(Number(body.amount));

  if (!code || !country || !club) {
    return json({ error: "Missing country or club" }, 400);
  }
  if (!Number.isFinite(amount) || amount < 1) {
    return json({ error: "Minimum bid is $1" }, 400);
  }

  // The bid must beat the current highest bid for this country.
  const crowns = await getCrowns(env);
  const current = crowns[code];
  const floor = current ? current.amount : 0;
  if (amount <= floor) {
    return json(
      { error: `Bid must beat the current $${floor}. Try $${floor + 1} or more.`, current: floor },
      409
    );
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Payments are not configured yet." }, 503);
  }

  const origin = env.SITE_URL || new URL(request.url).origin;

  try {
    const session = await stripe(env, "checkout/sessions", "POST", {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": amount * 100,
      "line_items[0][price_data][product_data][name]": `Crown bid: ${club} (${country})`,
      "line_items[0][price_data][product_data][description]": `Claim the ${country} football crown for ${club}.`,
      "metadata[code]": code,
      "metadata[country]": country,
      "metadata[flag]": flag,
      "metadata[club]": club,
      "metadata[clubLogo]": clubLogo,
      "metadata[amount]": amount,
      "metadata[bidder]": bidder,
      success_url: `${origin}/?paid=1&code=${encodeURIComponent(code)}`,
      cancel_url: `${origin}/?canceled=1`,
    });
    return json({ url: session.url });
  } catch (err) {
    return json({ error: "Could not start checkout. " + err.message }, 502);
  }
}
