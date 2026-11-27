// Club slug + asset helpers shared by /club/:slug and /sitemap.xml.
// Slugs come from the logo filename in clubs.json (/club-logos/manchester-united.svg.png
// → manchester-united). The same rules are inlined in public/index.html.

export function clubSlug(logo, name) {
  if (typeof logo === "string" && logo.startsWith("/club-logos/")) {
    const base = logo.split("/").pop() || "";
    const slug = base.replace(/(\.(?:svg|png|jpe?g|webp))+$/i, "");
    if (slug) return slug.toLowerCase();
  }
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findClub(clubs, slug) {
  const want = String(slug || "").toLowerCase();
  for (const country of clubs) {
    for (const club of country.clubs || []) {
      if (clubSlug(club.logo, club.n) === want) return { country, club, slug: want };
    }
  }
  return null;
}

export function allClubPaths(clubs) {
  const slugs = [];
  for (const country of clubs) {
    for (const club of country.clubs || []) {
      const slug = clubSlug(club.logo, club.n);
      if (slug) slugs.push(slug);
    }
  }
  return [...new Set(slugs)].sort().map((slug) => `/club/${slug}`);
}

export async function loadClubs(env, request) {
  const origin = new URL(request.url).origin;
  const res = await env.ASSETS.fetch(new URL("/clubs.json", origin));
  if (!res.ok) throw new Error("clubs.json unavailable");
  return res.json();
}

export async function notFoundResponse(env, request) {
  const origin = new URL(request.url).origin;
  let body = "<!doctype html><meta charset=utf-8><title>Page not found — BidFootball</title><p>That page does not exist. <a href=\"/\">Back to BidFootball</a></p>";
  try {
    const res = await env.ASSETS.fetch(new URL("/404.html", origin));
    if (res.ok) body = await res.text();
  } catch { /* fall through to the plain fallback */ }
  return new Response(body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
