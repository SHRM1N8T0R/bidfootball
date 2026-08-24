import { json, clean, cleanLink, recordListing, MIN_BID } from "../_shared.js";

const enc = new TextEncoder();

function b64ToBytes(b64) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return Uint8Array.from(atob(norm), c => c.charCodeAt(0));
}

async function hmacB64(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

// Try every plausible key×message combination and report which (if any) matches
// the signature Polar actually sent. Returns { ok, match, debug }.
async function verifyPolar(rawBody, headers, secret) {
  const id  = headers.get("webhook-id");
  const ts  = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (!id || !ts || !sig || !secret) return { ok: false, match: null, debug: { reason: "missing headers", id: !!id, ts: !!ts, sig: !!sig, secret: !!secret } };

  const noPrefix = secret.trim().startsWith("whsec_") ? secret.trim().slice(6) : secret.trim();

  const keys = {
    "b64decoded":       b64ToBytes(noPrefix),          // Standard Webhooks canonical
    "utf8_noprefix":    enc.encode(noPrefix),          // raw string bytes, no prefix
    "utf8_full":        enc.encode(secret.trim()),     // raw string bytes, whole secret
    "b64decoded_full":  (() => { try { return b64ToBytes(secret.trim()); } catch { return null; } })(),
  };
  const msgs = {
    "id.ts.body": `${id}.${ts}.${rawBody}`,   // Standard Webhooks canonical
    "ts.body":    `${ts}.${rawBody}`,
    "body":       rawBody,
  };

  // Received signature values (space-delimited "v1,<sig>" entries)
  const received = sig.split(" ").map(p => (p.includes(",") ? p.split(",")[1] : p));

  let match = null;
  const computed = {};
  for (const [kn, kb] of Object.entries(keys)) {
    if (!kb) continue;
    for (const [mn, mv] of Object.entries(msgs)) {
      const val = await hmacB64(kb, mv);
      computed[`${kn} | ${mn}`] = val;
      if (received.includes(val)) match = `${kn} | ${mn}`;
    }
  }

  return {
    ok: !!match,
    match,
    debug: { id, ts, received, computed },
  };
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const url = new URL(request.url);
  const debugMode = url.searchParams.get("debug") === "1";

  const result = await verifyPolar(rawBody, request.headers, env.POLAR_WEBHOOK_SECRET);

  if (!result.ok) {
    // On failure, expose diagnostics in the response body (Polar stores it, so we
    // can read it back). Never includes the secret itself — only derived HMACs.
    return json({ error: "Invalid signature", match: result.match, debug: result.debug }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Bad payload" }, 400); }

  if (event.type !== "order.created" && event.type !== "order.paid")
    return json({ received: true, ignored: event.type, matchedScheme: result.match });

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

  return json({ received: true, club, newTotal, tookCrown, matchedScheme: result.match });
}
