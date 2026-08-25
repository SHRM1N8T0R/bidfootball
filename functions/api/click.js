import { json } from "../_shared.js";

// Counts a click-through to a user's listing link. Keyed by the exact link URL
// (matches the frontend's f.link). Deduped per IP+URL for 1h so a refresh spam
// doesn't inflate the number. Cosmetic ROI metric — best-effort, not audited.
export async function onRequestPost({ request, env }) {
  let url = "";
  try { const b = await request.json(); url = String(b.url || "").trim().slice(0, 200); } catch {}
  if (!/^https?:\/\//i.test(url)) return json({ error: "bad url" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const dedupeKey = `clk:${ip}:${url}`;

  const [seen, raw] = await Promise.all([
    env.BIDS.get(dedupeKey),
    env.BIDS.get("clicks"),
  ]);
  const clicks = raw ? JSON.parse(raw) : {};

  if (!seen) {
    clicks[url] = (clicks[url] || 0) + 1;
    await Promise.all([
      env.BIDS.put("clicks", JSON.stringify(clicks)),
      env.BIDS.put(dedupeKey, "1", { expirationTtl: 3600 }),
    ]);
  }
  return json({ url, count: clicks[url] || 0 });
}
