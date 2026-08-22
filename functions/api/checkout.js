import { json, getTotals, computeGlobalCrown, stripe, clean, MIN_BID, clubKey } from "../_shared.js";

// Fetch live USD→EUR rate; fallback to 0.92 if API is down
async function usdToEurRate() {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", { cf: { cacheTtl: 3600 } });
    const d = await r.json();
    return d?.rates?.EUR || 0.92;
  } catch {
    return 0.92;
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }

  const code     = clean(body.code, 3).toUpperCase();
  const country  = clean(body.country, 60);
  const flag     = clean(body.flag, 10);
  const club     = clean(body.club, 60);
  const clubLogo = clean(body.clubLogo, 400);
  const bidder   = clean(body.bidder, 40) || "Anonymous";
  const amount   = Math.floor(Number(body.amount)); // in USD (display)

  if (!code || !country || !club) return json({ error: "Missing fields" }, 400);
  if (!Number.isFinite(amount) || amount < MIN_BID) return json({ error: `Minimum contribution is $${MIN_BID}` }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments not configured yet" }, 503);

  const [totals, rate] = await Promise.all([getTotals(env), usdToEurRate()]);
  const crown     = computeGlobalCrown(totals);
  const key       = clubKey(code, club);
  const myTotal   = (totals[key]?.total || 0) + amount;
  const crownTotal = crown?.total || 0;
  const gapToCrown = Math.max(0, crownTotal - myTotal + 1);
  const isTakingCrown = myTotal > crownTotal;

  // Convert to EUR cents for Stripe: add $0.50 fee cover, then convert
  const eurCents = Math.round((amount + 0.5) * rate * 100);

  const origin = env.SITE_URL || new URL(request.url).origin;

  try {
    const session = await stripe(env, "checkout/sessions", "POST", {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": eurCents,
      "line_items[0][price_data][product_data][name]":
        isTakingCrown ? `👑 ${club} takes the WORLD CROWN!` : `Support ${club} — ${country}`,
      "line_items[0][price_data][product_data][description]":
        isTakingCrown
          ? `Your $${amount} puts ${club} at the top of the world. The crown is theirs!`
          : `Add $${amount} to ${club}'s pot. Current total: $${myTotal}. Gap to crown: $${gapToCrown}.`,
      "metadata[code]":     code,
      "metadata[country]":  country,
      "metadata[flag]":     flag,
      "metadata[club]":     club,
      "metadata[clubLogo]": clubLogo,
      "metadata[amount]":   amount,   // store USD amount in KV (display currency)
      "metadata[bidder]":   bidder,
      success_url: `${origin}/?paid=1&club=${encodeURIComponent(club)}`,
      cancel_url:  `${origin}/?canceled=1`,
    });
    return json({ url: session.url, myTotal, gapToCrown, isTakingCrown });
  } catch (err) {
    return json({ error: "Checkout failed. " + err.message }, 502);
  }
}
