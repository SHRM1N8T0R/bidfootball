import { getTotals, getFeed, computeGlobalCrown, rankAllClubs } from "../_shared.js";

// Edge-cached for 20s so a burst of visitors (each polling every 60s) is served
// from cache instead of hitting KV every time — keeps us well under the free-tier
// read budget. A new purchase shows up within ~20s (cache) + the client poll.
export async function onRequestGet(context) {
  const { env, request, waitUntil } = context;
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [totals, feed, clicksRaw] = await Promise.all([
    getTotals(env), getFeed(env), env.BIDS.get("clicks"),
  ]);
  const clicks     = clicksRaw ? JSON.parse(clicksRaw) : {};
  const crown      = computeGlobalCrown(totals);
  const ranked     = rankAllClubs(totals, 50);
  const grandTotal = Object.values(totals).reduce((s, c) => s + c.total, 0);
  const totalBids  = Object.values(totals).reduce((s, c) => s + c.bids, 0);

  const res = new Response(
    JSON.stringify({ crown, ranked, feed, totals, clicks, grandTotal, totalBids, updated: Date.now() }),
    { headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=20" } },
  );
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
