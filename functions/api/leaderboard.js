import { json, getCrowns, getFeed } from "../_shared.js";

// GET /api/leaderboard
// Returns the current crown for every country that has one, plus the live feed.
export async function onRequestGet({ env }) {
  const [crowns, feed] = await Promise.all([getCrowns(env), getFeed(env)]);
  return json({
    crowns,               // { [code]: { code, country, flag, club, clubLogo, amount, bidder, ts } }
    feed,                 // [ { code, country, club, amount, bidder, ts } ]
    total: Object.keys(crowns).length,
    updated: Date.now(),
  });
}
