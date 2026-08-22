import {
  json,
  getCrowns,
  getFeed,
  verifyStripeSignature,
  CROWNS_KEY,
  FEED_KEY,
  FEED_MAX,
} from "../_shared.js";

// POST /api/webhook  (Stripe webhook endpoint)
// The crown is only awarded here, after Stripe confirms the payment.
export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  const ok = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Invalid signature" }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Bad payload" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  const m = session.metadata || {};
  const code = (m.code || "").toUpperCase();
  const amount = Math.floor(Number(m.amount));

  if (!code || !Number.isFinite(amount)) {
    return json({ received: true, note: "missing metadata" });
  }

  // Re-read the current crown at award time. The highest bid holds the crown
  // and there are NO refunds (outbid.lol-style): if this bid no longer beats the
  // current crown (a rare race where someone else bid higher mid-checkout), the
  // payment is kept but the crown does not change hands.
  const crowns = await getCrowns(env);
  const current = crowns[code];
  const floor = current ? current.amount : 0;

  if (amount <= floor) {
    return json({ received: true, outbid: true });
  }

  const crown = {
    code,
    country: m.country || "",
    flag: m.flag || "",
    club: m.club || "",
    clubLogo: m.clubLogo || "",
    amount,
    bidder: m.bidder || "Anonymous",
    ts: Date.now(),
  };
  crowns[code] = crown;

  const feed = await getFeed(env);
  feed.unshift({
    code,
    country: crown.country,
    flag: crown.flag,
    club: crown.club,
    clubLogo: crown.clubLogo,
    amount,
    bidder: crown.bidder,
    ts: crown.ts,
  });

  await Promise.all([
    env.BIDS.put(CROWNS_KEY, JSON.stringify(crowns)),
    env.BIDS.put(FEED_KEY, JSON.stringify(feed.slice(0, FEED_MAX))),
  ]);

  return json({ received: true, crowned: crown.club });
}
