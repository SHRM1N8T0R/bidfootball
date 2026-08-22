import { json, getTotals, getFeed, verifyStripeSignature, computeGlobalCrown, clubKey, tierFor, TOTALS_KEY, FEED_KEY, FEED_MAX } from "../_shared.js";

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET))
    return json({ error: "Invalid signature" }, 400);

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Bad payload" }, 400); }
  if (event.type !== "checkout.session.completed") return json({ received: true, ignored: event.type });

  const m      = event.data.object.metadata || {};
  const code   = (m.code || "").toUpperCase();
  const amount = Math.floor(Number(m.amount));
  if (!code || !m.club || !Number.isFinite(amount) || amount < 1) return json({ received: true, note: "bad metadata" });

  const [totals, feed] = await Promise.all([getTotals(env), getFeed(env)]);
  const key = clubKey(code, m.club);

  if (!totals[key]) {
    totals[key] = { code, country: m.country||"", flag: m.flag||"", club: m.club, clubLogo: m.clubLogo||"", total: 0, bids: 0, lastBidder: "", ts: 0, legends: [] };
  }

  const e = totals[key];
  e.total      += amount;
  e.bids       += 1;
  e.clubLogo    = m.clubLogo || e.clubLogo;
  e.lastBidder  = m.bidder || "Anonymous";
  e.ts          = Date.now();

  // Track legend-tier contributors (amount >= $100) — name shown permanently
  const tier = tierFor(amount);
  if (tier?.label === "Legend" && e.legends) {
    if (!e.legends.includes(m.bidder)) e.legends.push(m.bidder);
    if (e.legends.length > 20) e.legends = e.legends.slice(-20);
  }

  const prevCrown = computeGlobalCrown(Object.fromEntries(
    Object.entries(totals).filter(([k]) => k !== key)
  ));
  const tookCrown = !prevCrown || e.total > prevCrown.total;

  feed.unshift({
    code, country: m.country, flag: m.flag, club: m.club, clubLogo: m.clubLogo,
    amount, bidder: m.bidder||"Anonymous", ts: e.ts, tookCrown,
    tier: tier?.label || null,
  });

  await Promise.all([
    env.BIDS.put(TOTALS_KEY, JSON.stringify(totals)),
    env.BIDS.put(FEED_KEY,   JSON.stringify(feed.slice(0, FEED_MAX))),
  ]);

  return json({ received: true, club: m.club, newTotal: e.total, tookCrown });
}
