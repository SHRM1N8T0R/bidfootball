import { allClubPaths, loadClubs } from "./_clubs.js";

const SITE = "https://bidfootball.lol";

export async function onRequestGet(context) {
  const paths = ["/", "/privacy", "/terms", "/rules"];
  try {
    const clubs = await loadClubs(context.env, context.request);
    paths.push(...allClubPaths(clubs));
  } catch { /* still publish the static URLs */ }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map((p) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
