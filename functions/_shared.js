// Shared helpers for the bidfootball Pages Functions.
// Files/folders prefixed with "_" are NOT treated as routes by Cloudflare Pages,
// so this module is safe to import from the route handlers.

export const CROWNS_KEY = "crowns"; // { [countryCode]: crown }
export const FEED_KEY = "feed";     // array of recent bids (newest first)
export const FEED_MAX = 60;

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function getCrowns(env) {
  const raw = await env.BIDS.get(CROWNS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getFeed(env) {
  const raw = await env.BIDS.get(FEED_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Encode a flat object as application/x-www-form-urlencoded (Stripe's format).
// Supports nested keys via bracket notation already present in the key string.
export function formEncode(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) params.append(k, String(v));
  }
  return params.toString();
}

// Call the Stripe REST API directly (no SDK / no node deps).
export async function stripe(env, path, method = "POST", body) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body ? formEncode(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed: ${data?.error?.message || res.status}`);
  }
  return data;
}

// Verify a Stripe webhook signature using Web Crypto (no SDK).
// Mirrors Stripe's scheme: signed payload is `${timestamp}.${rawBody}`,
// HMAC-SHA256 with the endpoint secret, compared to the v1 signature.
export async function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    })
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  // Reject old timestamps (replay protection).
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isNaN(age) || age > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = enc.encode(`${timestamp}.${rawBody}`);
  const mac = await crypto.subtle.sign("HMAC", key, signed);
  const computed = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computed, expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Basic sanitisation for user-supplied display strings.
export function clean(str, max = 40) {
  return String(str || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}
