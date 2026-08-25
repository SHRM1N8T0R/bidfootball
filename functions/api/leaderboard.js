import { json, getTotals, getFeed, computeGlobalCrown, rankAllClubs } from "../_shared.js";

export async function onRequestGet({ env }) {
  const [totals, feed, clicksRaw] = await Promise.all([getTotals(env), getFeed(env), env.BIDS.get("clicks")]);
  const clicks   = clicksRaw ? JSON.parse(clicksRaw) : {};
  const crown    = computeGlobalCrown(totals);
  const ranked   = rankAllClubs(totals, 50);
  const grandTotal = Object.values(totals).reduce((s, c) => s + c.total, 0);
  const totalBids  = Object.values(totals).reduce((s, c) => s + c.bids,  0);
  return json({ crown, ranked, feed, totals, clicks, grandTotal, totalBids, updated: Date.now() });
}
