import { notFoundResponse } from "./_clubs.js";

// Pages is configured to serve index.html (HTTP 200) for unknown paths, so
// /privacy, /robots.txt, /favicon.ico and anything else missing soft-404 to
// the homepage. Real files and routes pass through. Everything else is a 404.
const PAGES = new Set([
  "/",
  "/index.html",
  "/privacy",
  "/privacy.html",
  "/terms",
  "/terms.html",
  "/rules",
  "/rules.html",
  "/404.html",
]);

function normalize(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = url.pathname;
  const path = normalize(raw);

  if (raw !== path && raw !== "/" && (PAGES.has(path) || path.startsWith("/club/") || path.startsWith("/api/") || path === "/sitemap.xml")) {
    url.pathname = path;
    return Response.redirect(url.toString(), 301);
  }

  const res = await context.next();

  if (res.status >= 300 && res.status < 400) return res;
  if (path.startsWith("/api/") || path.startsWith("/club/") || path === "/sitemap.xml" || PAGES.has(path)) {
    return res;
  }

  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (res.ok && type && !type.includes("text/html")) return res;

  return notFoundResponse(context.env, context.request);
}
