import { findClub, loadClubs, notFoundResponse, escAttr } from "../_clubs.js";

const SITE = "https://bidfootball.lol";

function personalize(html, { title, description, url }) {
  const t = escAttr(title);
  const d = escAttr(description);
  const u = escAttr(url);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`);
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const slug = decodeURIComponent(String(params.slug || "")).toLowerCase();
  let clubs;
  try { clubs = await loadClubs(env, request); }
  catch { return notFoundResponse(env, request); }

  const hit = findClub(clubs, slug);
  if (!hit) return notFoundResponse(env, request);

  const origin = new URL(request.url).origin;
  const indexRes = await env.ASSETS.fetch(new URL("/index.html", origin));
  if (!indexRes.ok) return notFoundResponse(env, request);

  const clubName = hit.club.n;
  const countryName = hit.country.n;
  const title = `${clubName} on BidFootball`;
  const description = `Put your name and socials on ${clubName}'s board (${countryName}). Listings from €5. The biggest board wears the world crown.`;
  const url = `${SITE}/club/${hit.slug}`;
  const html = personalize(await indexRes.text(), { title, description, url });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
