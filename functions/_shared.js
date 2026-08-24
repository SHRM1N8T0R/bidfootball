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

// Only accept http/https URLs. Returns "" for anything else (javascript:, data:, etc.).
export function cleanLink(str, max = 200) {
  const s = String(str || "").trim().slice(0, max);
  if (!s) return "";
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
  } catch { return ""; }
}

// Records a paid listing into totals + feed. Shared by every payment webhook.
// listing: { code, country, flag, club, clubLogo, amount, bidder, link }
export async function recordListing(env, listing) {
  const [totals, feed] = await Promise.all([getTotals(env), getFeed(env)]);
  const key = clubKey(listing.code, listing.club);

  if (!totals[key]) {
    totals[key] = { code: listing.code, country: listing.country || "", flag: listing.flag || "", club: listing.club, clubLogo: listing.clubLogo || "", total: 0, bids: 0, lastBidder: "", ts: 0, legends: [] };
  }
  const e = totals[key];
  e.total     += listing.amount;
  e.bids      += 1;               // "bids" = number of listings on this club's board
  e.clubLogo   = listing.clubLogo || e.clubLogo;
  e.lastBidder = listing.bidder || "Anonymous";
  e.ts         = Date.now();

  const tier = tierFor(listing.amount);
  if (tier?.label === "Legend" && e.legends) {
    if (!e.legends.includes(listing.bidder)) e.legends.push(listing.bidder);
    if (e.legends.length > 20) e.legends = e.legends.slice(-20);
  }

  const prevCrown = computeGlobalCrown(Object.fromEntries(
    Object.entries(totals).filter(([k]) => k !== key)
  ));
  const tookCrown = !prevCrown || e.total > prevCrown.total;

  feed.unshift({
    code: listing.code, country: listing.country, flag: listing.flag,
    club: listing.club, clubLogo: listing.clubLogo,
    amount: listing.amount, bidder: listing.bidder || "Anonymous",
    link: listing.link || "", ts: e.ts, tookCrown, tier: tier?.label || null,
  });

  await Promise.all([
    env.BIDS.put(TOTALS_KEY, JSON.stringify(totals)),
    env.BIDS.put(FEED_KEY,   JSON.stringify(feed.slice(0, FEED_MAX))),
  ]);

  return { newTotal: e.total, tookCrown };
}
