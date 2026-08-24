import { json, clean, cleanLink, recordListing, MIN_BID } from "../_shared.js";

const enc = new TextEncoder();

async function hmacB64(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

// Verify a Polar webhook. Signed content is `${webhook-id}.${webhook-timestamp}.${body}`.
// Empirically Polar keys the HMAC with the raw UTF-8 bytes of the FULL `whsec_...`
// secret (prefix included) — NOT the base64-decoded key the Standard Webhooks spec
// describes. We accept either, so we stay correct if Polar ever switches to the spec.
async function verifyPolarSignature(rawBody, headers, secret) {
  const id  = headers.get("webhook-id");
  const ts  = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (!id || !ts || !sig || !secret) return false;
  // Replay window: 5 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;

  const s = secret.trim();
  const msg = `${id}.${ts}.${rawBody}`;

  // Key candidates: full secret as UTF-8 (what Polar uses today) + spec-compliant
  // base64-decoded key (fallback, in case Polar aligns to Standard Webhooks later).
  const keyCandidates = [enc.encode(s)];
  try {
    const noPrefix = s.startsWith("whsec_") ? s.slice(6) : s;
    const norm = noPrefix.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(noPrefix.length / 4) * 4, "=");
    keyCandidates.push(Uint8Array.from(atob(norm), c => c.charCodeAt(0)));
  } catch { /* not valid base64 — skip */ }

  const received = sig.split(" ").map(p => (p.includes(",") ? p.split(",")[1] : p));
  for (const kb of keyCandidates) {
    const expected = await hmacB64(kb, msg);
    if (received.includes(expected)) return true;
  }
  return false;
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
