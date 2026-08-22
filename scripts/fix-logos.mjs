// Replaces all club logos using TheSportsDB (sports-specific, verified crests).
// Falls back to Wikipedia REST API only if TheSportsDB has no match.
//
//   node scripts/fix-logos.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "public", "clubs.json");
const UA = "bidfootball/1.0 (https://bidfootball.lol)";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// TheSportsDB free API — returns strTeamBadge (actual crest, not a photo)
async function sportsdbLogo(name, altName) {
  for (const q of [name, altName].filter(Boolean)) {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const d = await res.json();
    const teams = d.teams;
    if (!teams?.length) continue;
    // Pick first team that looks like a football/soccer club
    const team = teams.find(t =>
      t.strSport === "Soccer" || t.strLeague?.toLowerCase().includes("football") ||
      t.strSport === "Football"
    ) || teams[0];
    if (team?.strTeamBadge) return team.strTeamBadge + "/preview"; // /preview gives a reasonable size PNG
  }
  return null;
}

// Wikipedia REST fallback — uses exact page title
async function wikiThumb(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const d = await res.json();
  return d.thumbnail?.source || null;
}

// Exact wiki titles for ambiguous clubs (avoids wrong-country matches)
const WIKI_OVERRIDE = {
  "Arsenal":            "Arsenal F.C.",
  "Liverpool":          "Liverpool F.C.",
  "Santos":             "Santos FC",
  "Barcelona SC":       "Barcelona S.C.",
  "Nacional":           "Club Nacional de Football",
  "Olimpia":            "Club Olimpia",
  "Corinthians":        "Sport Club Corinthians Paulista",
  "Racing Club":        "Racing Club de Avellaneda",
  "Al Ahly":            "Al Ahly SC",
  "Al Ahli":            "Al-Ahli Saudi FC",
  "Al Ain":             "Al Ain FC",
  "Persepolis":         "Persepolis FC",
  "Esteghlal":          "Esteghlal FC",
  "Hearts of Oak":      "Accra Hearts of Oak S.C.",
  "Mohun Bagan":        "Mohun Bagan Super Giant",
};

// TheSportsDB alternate search names for clubs with tricky names
const SPORTSDB_ALT = {
  "Manchester City":    "Manchester City",
  "Manchester United":  "Manchester United",
  "Atlético Madrid":    "Atletico Madrid",
  "Benfica":            "SL Benfica",
  "Fenerbahçe":         "Fenerbahce",
  "Beşiktaş":           "Besiktas",
  "Brøndby":            "Brondby",
  "Malmö FF":           "Malmo FF",
  "Bodø/Glimt":         "Bodo Glimt",
  "Flamengo":           "Flamengo",
  "Palmeiras":          "Palmeiras",
  "São Paulo":          "Sao Paulo",
  "Peñarol":            "Penarol",
  "Atlético Nacional":  "Atletico Nacional",
  "Colo-Colo":          "Colo Colo",
  "Universidad de Chile": "Universidad de Chile",
  "Barcelona SC":       "Barcelona SC",
  "Club América":       "Club America",
  "CF Montréal":        "CF Montreal",
  "Espérance de Tunis": "Esperance de Tunis",
  "Étoile du Sahel":    "Etoile du Sahel",
  "ES Sétif":           "ES Setif",
  "Asante Kotoko":      "Asante Kotoko",
  "Urawa Red Diamonds": "Urawa Red Diamonds",
  "Yokohama F. Marinos":"Yokohama Marinos",
  "Jeonbuk Hyundai":    "Jeonbuk Motors",
  "Shanghai Port":      "Shanghai Port",
  "Shandong Taishan":   "Shandong Taishan",
  "Al Hilal":           "Al Hilal",
  "Al Nassr":           "Al-Nassr",
  "Al Ittihad":         "Al-Ittihad",
  "Al Ahli":            "Al Ahli Saudi",
  "Al Ain":             "Al Ain",
  "Al Sadd":            "Al-Sadd",
  "Al Duhail":          "Al-Duhail",
  "Persepolis":         "Persepolis",
  "Esteghlal":          "Esteghlal",
  "Buriram United":     "Buriram United",
  "Bangkok United":     "Bangkok United",
  "Mohun Bagan":        "Mohun Bagan",
  "Melbourne City":     "Melbourne City",
  "Melbourne Victory":  "Melbourne Victory",
  "Auckland City":      "Auckland City",
};

async function resolveLogo(clubName) {
  const alt = SPORTSDB_ALT[clubName];
  const wikiTitle = WIKI_OVERRIDE[clubName];

  // 1) TheSportsDB — most accurate (sports-specific)
  let logo = await sportsdbLogo(clubName, alt);
  if (logo) return logo;

  await sleep(100);

  // 2) Wikipedia with exact title override if we have one
  if (wikiTitle) {
    logo = await wikiThumb(wikiTitle);
    if (logo) return logo;
  }

  // 3) Wikipedia with display name
  logo = await wikiThumb(clubName);
  return logo;
}

async function run() {
  const clubs = JSON.parse(await readFile(DATA_PATH, "utf8"));
  let resolved = 0, failed = 0;

  for (const country of clubs) {
    process.stdout.write(`${country.n}: `);
    for (const club of country.clubs) {
      try {
        const logo = await resolveLogo(club.n);
        if (logo) {
          club.logo = logo;
          process.stdout.write("✓");
          resolved++;
        } else {
          process.stdout.write("✗");
          console.warn(`\n  MISSING: ${club.n}`);
          failed++;
        }
      } catch (e) {
        process.stdout.write("!");
        console.warn(`\n  ERROR ${club.n}: ${e.message}`);
        failed++;
      }
      await sleep(300);
    }
    process.stdout.write("\n");
  }

  await writeFile(DATA_PATH, JSON.stringify(clubs, null, 2));
  console.log(`\n✓ ${resolved} resolved, ✗ ${failed} failed.`);
}

run().catch(e => { console.error(e); process.exit(1); });
