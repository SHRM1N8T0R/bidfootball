import { json, clean, cleanLink, MIN_BID } from "../_shared.js";

// Creates a Polar checkout session. Polar is the merchant of record — it handles
// payment, tax and payout. Until POLAR_ACCESS_TOKEN + POLAR_PRODUCT_ID are set,
// this returns a friendly "checkout launching soon" placeholder.
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }

  const code     = clean(body.code, 3).toUpperCase();
  const country  = clean(body.country, 60);
  const flag     = clean(body.flag, 10);
  const club     = clean(body.club, 60);
  const clubLogo = clean(body.clubLogo, 400);
  const bidder   = clean(body.bidder, 40) || "Anonymous";
  const link     = cleanLink(body.link, 200);
  const amount   = Math.floor(Number(body.amount)); // EUR

  if (!code || !country || !club) return json({ error: "Missing fields" }, 400);
  if (!Number.isFinite(amount) || amount < MIN_BID) return json({ error: `Minimum listing is €${MIN_BID}` }, 400);

  // Payments not wired yet → graceful placeholder the frontend shows nicely.
  if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_PRODUCT_ID) {
    return json({ error: "Checkout is launching very soon — follow @bidfootball on X to be first when it opens.", placeholder: true }, 503);
  }

  const debug = new URL(request.url).searchParams.has("debug");

  try {
    const origin = env.SITE_URL || new URL(request.url).origin;
    const apiBase = env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
    const token = String(env.POLAR_ACCESS_TOKEN).trim();
    const productId = String(env.POLAR_PRODUCT_ID).trim();

    // Polar rejects empty-string metadata values (min_length 1), so drop blanks.
    const metadata = {};
    for (const [k, v] of Object.entries({ code, country, flag, club, clubLogo, bidder, link, amount })) {
      if (v !== "" && v != null) metadata[k] = v;
    }

    const res = await fetch(`${apiBase}/v1/checkouts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        products: [productId],
        amount: amount * 100,                       // EUR cents (product must be pay-what-you-want)
        success_url: `${origin}/?paid=1&c=${encodeURIComponent(code)}&club=${encodeURIComponent(club)}&amt=${amount}`,
        metadata,
      }),
    });

    const raw = await res.text();
    if (debug) return json({ debug: true, status: res.status, apiBase, productIdLen: productId.length, tokenLen: token.length, raw: raw.slice(0, 1500) }, 200);

    let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!res.ok || !data?.url) {
      const errMsg = (Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail) || data?.error || `Checkout failed (${res.status}).`;
      return json({ error: String(errMsg) }, 502);
    }
    return json({ url: data.url });
  } catch (err) {
    return json({ error: "Checkout failed. " + (err?.message || String(err)) }, 502);
  }
}
