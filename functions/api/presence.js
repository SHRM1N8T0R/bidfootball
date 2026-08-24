import { json } from "../_shared.js";

// Lightweight real-presence counter. Each open tab POSTs a heartbeat with a
// stable session id every ~25s; we keep a { id: lastSeenTs } map in KV and count
// the ids seen within the last WINDOW ms. Cosmetic — races just self-heal on the
// next heartbeat. The whole key auto-expires if all traffic stops.
const WINDOW = 45000; // ms a heartbeat counts as "online"
const MAX = 800;      // cap map size to bound the KV value

export async function onRequestPost({ request, env }) {
  let id = "";
  try { const b = await request.json(); id = String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 40); } catch {}
  if (!id) return json({ online: 0 });

  const now = Date.now();
  let map = {};
  try { map = JSON.parse((await env.BIDS.get("presence")) || "{}"); } catch {}

  // Drop stale heartbeats, then record this one.
  for (const k of Object.keys(map)) if (now - map[k] > WINDOW) delete map[k];
  map[id] = now;

  // Keep only the most-recent MAX ids if it somehow grows large.
  let keys = Object.keys(map);
  if (keys.length > MAX) {
    keys.sort((a, b) => map[b] - map[a]);
    const keep = {};
    for (const k of keys.slice(0, MAX)) keep[k] = map[k];
    map = keep;
    keys = Object.keys(map);
  }

  // expirationTtl refreshes each write, so the key clears itself when traffic stops.
  await env.BIDS.put("presence", JSON.stringify(map), { expirationTtl: 60 });
  return json({ online: keys.length });
}
