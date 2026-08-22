/**
 * Adds missing UEFA countries + clubs to clubs.json and fetches their logos.
 * Run: node scripts/add-uefa.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const NEW_COUNTRIES = [
  { c:"ISR", f:"il",     n:"Israel",           r:"Europe", clubs:["Maccabi Tel Aviv","Maccabi Haifa","Hapoel Tel Aviv","Beitar Jerusalem"] },
  { c:"SUI", f:"ch",     n:"Switzerland",       r:"Europe", clubs:["Young Boys","FC Basel","Servette FC","Grasshopper Club"] },
  { c:"AUT", f:"at",     n:"Austria",           r:"Europe", clubs:["Red Bull Salzburg","Rapid Wien","Austria Wien"] },
  { c:"POL", f:"pl",     n:"Poland",            r:"Europe", clubs:["Legia Warsaw","Lech Poznań","Wisła Kraków"] },
  { c:"CZE", f:"cz",     n:"Czech Republic",    r:"Europe", clubs:["Sparta Prague","Slavia Prague","Viktoria Plzeň"] },
  { c:"HUN", f:"hu",     n:"Hungary",           r:"Europe", clubs:["Ferencváros","MTK Budapest"] },
  { c:"ROU", f:"ro",     n:"Romania",           r:"Europe", clubs:["FCSB","CFR Cluj","Dinamo Bucharest"] },
  { c:"WAL", f:"gb-wls", n:"Wales",             r:"Europe", clubs:["Cardiff City","Swansea City","The New Saints"] },
  { c:"IRL", f:"ie",     n:"Republic of Ireland", r:"Europe", clubs:["Shamrock Rovers","Bohemian FC","Shelbourne"] },
  { c:"SVK", f:"sk",     n:"Slovakia",          r:"Europe", clubs:["Slovan Bratislava","Spartak Trnava"] },
  { c:"BIH", f:"ba",     n:"Bosnia & Herzegovina", r:"Europe", clubs:["FK Sarajevo","Zrinjski Mostar","FK Željezničar"] },
  { c:"MDA", f:"md",     n:"Moldova",           r:"Europe", clubs:["Sheriff Tiraspol","FC Milsami"] },
  { c:"AZE", f:"az",     n:"Azerbaijan",        r:"Europe", clubs:["Qarabağ FK","Neftchi Baku"] },
  { c:"CYP", f:"cy",     n:"Cyprus",            r:"Europe", clubs:["APOEL FC","Omonia Nicosia","AEK Larnaca"] },
  { c:"SVN", f:"si",     n:"Slovenia",          r:"Europe", clubs:["NK Maribor","NK Olimpija Ljubljana"] },
  { c:"BUL", f:"bg",     n:"Bulgaria",          r:"Europe", clubs:["Ludogorets","CSKA Sofia","Levski Sofia"] },
  { c:"GEO", f:"ge",     n:"Georgia",           r:"Europe", clubs:["Dinamo Tbilisi","FC Shakhtar Karagandy"] },
  { c:"ALB", f:"al",     n:"Albania",           r:"Europe", clubs:["FK Partizani","KF Skënderbeu","FK Tirana"] },
  { c:"MNE", f:"me",     n:"Montenegro",        r:"Europe", clubs:["FK Budućnost Podgorica","FK Sutjeska"] },
  { c:"MKD", f:"mk",     n:"North Macedonia",   r:"Europe", clubs:["FK Vardar","FK Shkupi"] },
];

// TheSportsDB search — returns badge URL
async function sportsdb(name) {
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`);
    const d = await r.json();
    const team = d?.teams?.[0];
    if (team?.strTeamBadge) return team.strTeamBadge + "/preview";
  } catch {}
  return null;
}

// Wikipedia REST summary thumbnail
async function wikipedia(name) {
  const titles = [
    name,
    name + " F.C.",
    name + " FC",
  ];
  for (const t of titles) {
    try {
      await new Promise(r => setTimeout(r, 250));
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`,
        { headers: { "User-Agent": "bidfootball-logo-bot/1.0 (contact@bidfootball.lol)" } });
      if (!r.ok) continue;
      const d = await r.json();
      const img = d?.originalimage?.source || d?.thumbnail?.source;
      if (img && (img.includes(".svg") || img.includes(".png"))) return img;
    } catch {}
  }
  return null;
}

// Specific overrides for tricky names
const OVERRIDES = {
  "Maccabi Tel Aviv":          "https://www.thesportsdb.com/images/media/team/badge/maccabi-tel-aviv.png/preview",
  "Maccabi Haifa":             null,
  "Hapoel Tel Aviv":           null,
  "Beitar Jerusalem":          null,
  "Young Boys":                null,
  "Servette FC":               null,
  "Grasshopper Club":          null,
  "Red Bull Salzburg":         null,
  "Rapid Wien":                null,
  "Austria Wien":              null,
  "Legia Warsaw":              null,
  "Lech Poznań":               null,
  "Wisła Kraków":              null,
  "Sparta Prague":             null,
  "Slavia Prague":             null,
  "Viktoria Plzeň":            null,
  "Ferencváros":               null,
  "FCSB":                      null,
  "CFR Cluj":                  null,
  "Dinamo Bucharest":          null,
  "Slovan Bratislava":         null,
  "Sheriff Tiraspol":          null,
  "Qarabağ FK":                null,
  "APOEL FC":                  null,
  "NK Maribor":                null,
  "NK Olimpija Ljubljana":     null,
  "Ludogorets":                null,
  "CSKA Sofia":                null,
  "Dinamo Tbilisi":            null,
};

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
const existingCodes = new Set(clubs.map(c => c.c));

let added = 0;
for (const country of NEW_COUNTRIES) {
  if (existingCodes.has(country.c)) { console.log(`⏭  ${country.n} already exists`); continue; }

  console.log(`\n🌍 ${country.n}`);
  const clubEntries = [];
  for (const clubName of country.clubs) {
    let logo = null;

    // Try TheSportsDB first
    logo = await sportsdb(clubName);
    if (logo) { console.log(`  ✅ ${clubName} → TheSportsDB`); }

    // Fall back to Wikipedia
    if (!logo) {
      logo = await wikipedia(clubName);
      if (logo) console.log(`  ✅ ${clubName} → Wikipedia`);
      else console.log(`  ⚽ ${clubName} → no logo found`);
    }

    clubEntries.push({ n: clubName, logo: logo || "" });
    await new Promise(r => setTimeout(r, 300));
  }

  clubs.push({ c: country.c, f: country.f, n: country.n, r: country.r, clubs: clubEntries });
  added++;
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`\n✅ Added ${added} new countries. Total: ${clubs.length} countries, ${clubs.reduce((s,c)=>s+c.clubs.length,0)} clubs.`);
