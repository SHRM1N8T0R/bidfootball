/**
 * Fixes clubs that have JPEG logos (photos, not crests).
 * Uses TheSportsDB first, then specific Wikipedia article title overrides.
 * Run: node scripts/fix-jpeg-logos.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const OVERRIDES = {
  "Barcelona":    "FC_Barcelona",
  "Sevilla":      "Sevilla_FC",
  "Valencia":     "Valencia_CF",
  "Napoli":       "S.S.C._Napoli",
  "Marseille":    "Olympique_de_Marseille",
  "Lyon":         "Olympique_Lyonnais",
  "Porto":        "FC_Porto",
  "Beşiktaş":     "Beşiktaş_JK",
  "Anderlecht":   "R.S.C._Anderlecht",
  "Brøndby":      "Brøndby_IF",
  "São Paulo":    "São_Paulo_FC",
  "Guadalajara":  "Club_Deportivo_Guadalajara",
  "Monterrey":    "C.F._Monterrey",
  "Zamalek":      "Zamalek_SC",
  "Enyimba":      "Enyimba_FC",
  "Shanghai Port":"Shanghai_Port_FC",
};

async function sportsdb(name) {
  try {
    await new Promise(r => setTimeout(r, 300));
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`);
    const d = await r.json();
    const team = d?.teams?.[0];
    if (team?.strTeamBadge) return team.strTeamBadge + "/preview";
  } catch {}
  return null;
}

async function wikipedia(articleTitle) {
  try {
    await new Promise(r => setTimeout(r, 350));
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`,
      { headers: { "User-Agent": "bidfootball-logo-fix/1.0" } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const img = d?.originalimage?.source || d?.thumbnail?.source;
    // Only accept SVG or PNG — reject JPEG (photos)
    if (img && (img.toLowerCase().includes(".svg") || img.toLowerCase().includes(".png"))) return img;
  } catch {}
  return null;
}

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
let fixed = 0;

for (const country of clubs) {
  for (const club of country.clubs) {
    if (!club.logo || !club.logo.match(/\.jpg|\.jpeg/i)) continue;

    const articleTitle = OVERRIDES[club.n];
    if (!articleTitle) { console.log(`⚠️  No override for ${club.n} — skipping`); continue; }

    console.log(`\n🔧 Fixing ${club.n} (${country.n})...`);

    // Try TheSportsDB first
    let logo = await sportsdb(club.n);
    if (logo) {
      console.log(`  ✅ TheSportsDB: ${logo.substring(0, 70)}`);
    } else {
      logo = await wikipedia(articleTitle);
      if (logo) console.log(`  ✅ Wikipedia [${articleTitle}]: ${logo.substring(0, 70)}`);
      else console.log(`  ❌ No logo found — keeping old`);
    }

    if (logo) { club.logo = logo; fixed++; }
  }
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`\n✅ Fixed ${fixed} logos.`);
