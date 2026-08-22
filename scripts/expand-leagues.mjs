/**
 * Adds full league rosters using TheSportsDB (official badges, one call per league).
 * Run: node scripts/expand-leagues.mjs
 */
import { readFileSync, writeFileSync } from "fs";

// TheSportsDB league names → clubs.json country mapping
const LEAGUES = [
  { league: "English Premier League",   code: "ENG", flag: "gb-eng", country: "England",     region: "Europe" },
  { league: "Spanish La Liga",          code: "ESP", flag: "es",     country: "Spain",        region: "Europe" },
  { league: "German Bundesliga",        code: "GER", flag: "de",     country: "Germany",      region: "Europe" },
  { league: "Italian Serie A",          code: "ITA", flag: "it",     country: "Italy",        region: "Europe" },
  { league: "French Ligue 1",          code: "FRA", flag: "fr",     country: "France",       region: "Europe" },
  { league: "Scottish Premier League",   code: "SCT", flag: "gb-sct", country: "Scotland",     region: "Europe" },
  { league: "Portuguese Primeira Liga", code: "POR", flag: "pt",     country: "Portugal",     region: "Europe" },
  { league: "Dutch Eredivisie",         code: "NED", flag: "nl",     country: "Netherlands",  region: "Europe" },
  { league: "Turkish Süper Lig",        code: "TUR", flag: "tr",     country: "Turkey",       region: "Europe" },
  { league: "Belgian First Division A", code: "BEL", flag: "be",     country: "Belgium",      region: "Europe" },
];

// Name overrides: TheSportsDB name → our preferred display name
const NAME_MAP = {
  "Manchester City":          "Manchester City",
  "Manchester United":        "Manchester United",
  "Wolverhampton Wanderers":  "Wolverhampton",
  "Brighton and Hove Albion": "Brighton",
  "Tottenham Hotspur":        "Tottenham",
  "West Bromwich Albion":     "West Brom",
  "Sheffield Wednesday":      "Sheffield Wed",
  "Nottingham Forest":        "Nottingham Forest",
  "Leeds United":             "Leeds United",
  "FC Barcelona":             "Barcelona",
  "Atlético Madrid":          "Atlético Madrid",
  "Athletic Club Bilbao":     "Athletic Bilbao",
  "Deportivo Alavés":         "Deportivo Alavés",
  "Bayern Munich":            "Bayern München",
  "Borussia Mönchengladbach": "Borussia Mönchengladbach",
  "VfB Stuttgart":            "VfB Stuttgart",
  "Eintracht Frankfurt":      "Eintracht Frankfurt",
  "Paris Saint-Germain":      "Paris Saint-Germain",
  "Olympique Lyonnais":       "Lyon",
  "Olympique Marseille":      "Marseille",
  "Stade Rennais FC":         "Rennes",
  "Stade de Reims":           "Reims",
  "Sporting de Charleroi":    "Charleroi",
  "PSV Eindhoven":            "PSV",
  "AFC Ajax":                 "Ajax",
  "Feyenoord Rotterdam":      "Feyenoord",
  "Internazionale":           "Inter Milan",
  "AC Milan":                 "AC Milan",
  "SSC Napoli":               "Napoli",
  "AS Roma":                  "Roma",
  "SS Lazio":                 "Lazio",
  "ACF Fiorentina":           "Fiorentina",
  "Atalanta BC":              "Atalanta",
  "Hellas Verona":            "Verona",
  "FC Augsburg":              "Augsburg",
  "SC Freiburg":              "Freiburg",
  "1. FC Heidenheim":         "Heidenheim",
  "TSG 1899 Hoffenheim":      "Hoffenheim",
  "1. FSV Mainz 05":          "Mainz",
  "SV Werder Bremen":         "Werder Bremen",
  "VfL Bochum":               "Bochum",
  "VfL Wolfsburg":            "Wolfsburg",
  "1. FC Union Berlin":       "Union Berlin",
  "FC St. Pauli":             "St. Pauli",
  "Holstein Kiel":            "Holstein Kiel",
  "Beşiktaş JK":              "Beşiktaş",
  "Galatasaray SK":           "Galatasaray",
  "Fenerbahçe SK":            "Fenerbahçe",
  "Sporting CP":              "Sporting CP",
  "SL Benfica":               "Benfica",
  "Celtic FC":                "Celtic",
  "Rangers FC":               "Rangers",
  "Heart of Midlothian":      "Hearts",
  "Hibernian FC":             "Hibernian",
  "Aberdeen FC":              "Aberdeen",
  "Anderlecht":               "Anderlecht",
  "Club Brugge":              "Club Brugge",
  "Racing Genk":              "Genk",
};

async function fetchLeague(leagueName) {
  await new Promise(r => setTimeout(r, 500));
  const url = `https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=${encodeURIComponent(leagueName)}`;
  const r = await fetch(url, { headers: { "User-Agent": "bidfootball/1.0" } });
  if (!r.ok) { console.log(`  ⚠️  HTTP ${r.status} for ${leagueName}`); return []; }
  const d = await r.json();
  return d?.teams || [];
}

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
const byCode = {};
for (const c of clubs) byCode[c.c] = c;

let added = 0, updated = 0, skipped = 0;

for (const { league, code, flag, country, region } of LEAGUES) {
  console.log(`\n📋 ${league}...`);
  const teams = await fetchLeague(league);
  if (!teams.length) { console.log("  No teams returned"); continue; }

  let countryEntry = byCode[code];
  if (!countryEntry) {
    countryEntry = { c: code, f: flag, n: country, r: region, clubs: [] };
    clubs.push(countryEntry);
    byCode[code] = countryEntry;
  }

  for (const team of teams) {
    const rawName = team.strTeam;
    const displayName = NAME_MAP[rawName] || rawName;
    const logo = team.strLogo || team.strBadge || "";

    // Check if already exists (by display name OR raw name)
    const existing = countryEntry.clubs.find(
      c => c.n === displayName || c.n === rawName
    );

    if (existing) {
      // Only fill if logo is missing — never overwrite a working logo
      if (logo && !existing.logo) {
        existing.logo = logo;
        existing.n = displayName;
        console.log(`  🔄 Logo filled: ${displayName}`);
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    console.log(`  ✅ Adding: ${displayName}`);
    countryEntry.clubs.push({ n: displayName, logo });
    added++;
  }
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`\n🏆 Done — added ${added}, updated ${updated} logos to SportsDB, skipped ${skipped}.`);
