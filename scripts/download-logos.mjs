/**
 * Downloads all club logos and self-hosts them in public/club-logos/.
 * For Wikipedia URLs, fetches the original SVG/PNG (not the thumbnail).
 * Run: node scripts/download-logos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = "public/club-logos";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function slug(name) {
  return name.toLowerCase()
    .replace(/[àáâãä]/g,"a").replace(/[èéêë]/g,"e").replace(/[ìíîï]/g,"i")
    .replace(/[òóôõöø]/g,"o").replace(/[ùúûü]/g,"u").replace(/[ýÿ]/g,"y")
    .replace(/ñ/g,"n").replace(/[çć]/g,"c").replace(/ß/g,"ss")
    .replace(/[şș]/g,"s").replace(/ğ/g,"g").replace(/ı/g,"i")
    .replace(/[čć]/g,"c").replace(/[žź]/g,"z").replace(/æ/g,"ae")
    .replace(/œ/g,"oe").replace(/ø/g,"o").replace(/å/g,"a")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

// Convert Wikipedia thumbnail URL → original file URL
// /thumb/a/b/File.svg/330px-File.svg.png  →  /a/b/File.svg
function wikiOriginalUrl(url) {
  if (!url.includes("upload.wikimedia.org")) return url;
  const m = url.match(/upload\.wikimedia\.org\/wikipedia\/(en|commons)\/thumb\/([a-f0-9]+\/[a-f0-9]+\/.+?)\//);
  if (!m) return url;
  return `https://upload.wikimedia.org/wikipedia/${m[1]}/${m[2]}`;
}

function fileExt(url) {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".svg")) return ".svg";
  if (u.endsWith(".png")) return ".png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return ".jpg";
  return ".png";
}

async function download(url, dest) {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; bidfootball-logo/1.0; +https://bidfootball.lol)",
        "Accept": "image/svg+xml,image/png,image/*,*/*",
      },
      redirect: "follow",
    });
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 300) return false;
    writeFileSync(dest, buf);
    return true;
  } catch { return false; }
}

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
let downloaded = 0, skipped = 0, failed = 0;

for (const country of clubs) {
  for (const club of country.clubs) {
    // Already local or no logo
    if (!club.logo || club.logo.startsWith("/club-logos/")) { skipped++; continue; }

    const s = slug(club.n);
    const fetchUrl = wikiOriginalUrl(club.logo);
    const e = fileExt(fetchUrl);
    const filename = s + e;
    const dest = join(OUT_DIR, filename);

    // Already downloaded this session
    if (existsSync(dest)) {
      club.logo = `/club-logos/${filename}`;
      skipped++;
      continue;
    }

    process.stdout.write(`⬇️  ${club.n}... `);
    const ok = await download(fetchUrl, dest);
    if (ok) {
      club.logo = `/club-logos/${filename}`;
      console.log(`✅ (${fileExt(fetchUrl)})`);
      downloaded++;
    } else {
      console.log(`❌`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 600));
  }
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`\n✅ Downloaded ${downloaded}. Already done ${skipped}. Failed ${failed}.`);
