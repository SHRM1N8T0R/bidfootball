export const TOTALS_KEY = "totals"; // { [code_clubName]: { total, bids, code, country, flag, club, clubLogo, lastBidder, ts, legends } }
export const FEED_KEY   = "feed";
export const FEED_MAX   = 100;

export const MIN_BID = 5;
export const TIERS = [
  { label: "Legend",    min: 50,  icon: "👑" },
  { label: "Champion",  min: 25,  icon: "⚡" },
  { label: "Supporter", min: 5,   icon: "🤝" },
];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function clubKey(code, club) {
  return `${code}::${club}`;
}

export async function getTotals(env) {
  const raw = await env.BIDS.get(TOTALS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getFeed(env) {
  const raw = await env.BIDS.get(FEED_KEY);
  return raw ? JSON.parse(raw) : [];
}

// The one global crown — club with the highest total across everything.
export function computeGlobalCrown(totals) {
  let best = null;
  for (const entry of Object.values(totals)) {
    if (!best || entry.total > best.total) best = entry;
  }
  return best;
}

// All clubs sorted by total descending.
export function rankAllClubs(totals, limit = 50) {
  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function tierFor(amount) {
  for (const t of TIERS) if (amount >= t.min) return t;
  return null;
}

export function formEncode(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null) p.append(k, String(v));
  return p.toString();
}

export async function stripe(env, path, method = "POST", body) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: body ? formEncode(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${data?.error?.message || res.status}`);
  return data;
}

export async function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(kv => { const i = kv.indexOf("="); return [kv.slice(0,i), kv.slice(i+1)]; }));
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSec) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  const computed = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2,"0")).join("");
  let diff = 0;
  if (computed.length !== v1.length) return false;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export function clean(str, max = 60) {
  return String(str || "").replace(/[<>]/g, "").trim().slice(0, max);
}
