import { json, clean, cleanLink, recordListing, MIN_BID } from "../_shared.js";

// Verify Polar webhook (Standard Webhooks spec: base64 HMAC-SHA256).
async function verifyPolarSignature(rawBody, headers, secret) {
  const id  = headers.get("webhook-id");
  const ts  = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (!id || !ts || !sig || !secret) return false;
  // Replay window: 5 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;

  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${ts}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // webhook-signature is space-delimited "v1,<sig>" entries
  return sig.split(" ").some(part => {
    const s = part.includes(",") ? part.split(",")[1] : part;
    return s === expected;
  });
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  if (!await verifyPolarSignature(rawBody, request.headers, env.POLAR_WEBHOOK_SECRET))
    return json({ error: "Invalid signature" }, 400);

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Bad payload" }, 400); }

  // Record on a paid order. Polar fires order.created / order.paid for completed purchases.
  if (event.type !== "order.created" && event.type !== "order.paid")
    return json({ received: true, ignored: event.type });

  const m = event.data?.metadata || event.data?.checkout?.metadata || {};
  const code   = clean(m.code, 3).toUpperCase();
  const club   = clean(m.club, 60);
  const amount = Math.floor(Number(m.amount));
  if (!code || !club || !Number.isFinite(amount) || amount < MIN_BID)
    return json({ received: true, note: "bad metadata" });

  const { newTotal, tookCrown } = await recordListing(env, {
    code, country: clean(m.country, 60), flag: clean(m.flag, 10),
    club, clubLogo: clean(m.clubLogo, 400), amount,
    bidder: clean(m.bidder, 40) || "Anonymous", link: cleanLink(m.link, 200),
  });

  return json({ received: true, club, newTotal, tookCrown });
}
