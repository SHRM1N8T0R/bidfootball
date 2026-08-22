// Resolves OFFICIAL club crests via Wikidata's P154 "logo image" property —
// the same crest you see in club infoboxes on Wikipedia. No AI-generated art.
// Falls back to Wikipedia's pageimages API if Wikidata has no logo.
// Clubs still unresolved get logo:null and the frontend shows a ball placeholder.
//
//   node scripts/fetch-logos.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "clubs.json");

const UA = "bidfootball-logo-fetcher/1.0 (https://bidfootball.lol; dagos1555@gmail.com)";

// Base URL for Wikimedia Commons file API — converts a file name to a thumb URL
const THUMB_BASE = "https://commons.wikimedia.org/w/index.php?action=raw&title=Special:Redirect/file/";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WD_API    = "https://www.wikidata.org/w/api.php";
const WP_API    = "https://en.wikipedia.org/w/api.php";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Wikidata: search entity + read P154 logo ────────────────────────────────

async function wdSearch(name) {
  const url = WD_API + "?" + new URLSearchParams({
    action: "wbsearchentities", format: "json", language: "en",
    type: "item", limit: "3", search: name,
  });
  const d = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  return (d.search || []).map(x => x.id);
}

async function wdLogoFilename(qid) {
  const url = WD_API + "?" + new URLSearchParams({
    action: "wbgetclaims", format: "json", entity: qid, property: "P154",
  });
  const d = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const claims = d.claims?.P154;
  if (!claims?.length) return null;
  return claims[0].mainsnak?.datavalue?.value || null;
}

// Convert a Commons filename to a thumb URL via the imageinfo API
async function commonsFileUrl(filename) {
  const title = "File:" + filename;
  const url = COMMONS_API + "?" + new URLSearchParams({
    action: "query", format: "json", prop: "imageinfo",
    iiprop: "url", iiurlwidth: "300", titles: title,
  });
  const d = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const pages = d.query?.pages || {};
  for (const id in pages) {
    const src = pages[id]?.imageinfo?.[0]?.thumburl || pages[id]?.imageinfo?.[0]?.url;
    if (src) return src;
  }
  return null;
}

async function logoViaWikidata(clubName, wikiTitle) {
  // Try the wiki title first (more precise), then the club display name
  for (const q of [wikiTitle, clubName]) {
    const ids = await wdSearch(q);
    for (const qid of ids) {
      const fn = await wdLogoFilename(qid);
      if (fn) {
        const url = await commonsFileUrl(fn);
        if (url) return url;
      }
      await sleep(80);
    }
    await sleep(80);
  }
  return null;
}

// ── Wikipedia fallback: pageimages ──────────────────────────────────────────

async function logoViaWikipedia(wikiTitle, displayName) {
  const grab = async (titles) => {
    const url = WP_API + "?" + new URLSearchParams({
      action: "query", format: "json", prop: "pageimages",
      piprop: "original|thumbnail", pithumbsize: "300",
      redirects: "1", titles,
    });
    const d = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
    const pages = d.query?.pages || {};
    for (const id in pages) {
      const p = pages[id];
      const src = p?.original?.source || p?.thumbnail?.source;
      if (src) return src;
    }
    return null;
  };
  return (await grab(wikiTitle)) || (await grab(displayName));
}

// ── Master resolver ─────────────────────────────────────────────────────────

async function resolveLogo(displayName, wikiTitle) {
  try {
    const wd = await logoViaWikidata(displayName, wikiTitle);
    if (wd) return wd;
  } catch (e) {
    console.warn("    wikidata err:", displayName, e.message);
  }
  try {
    return await logoViaWikipedia(wikiTitle, displayName);
  } catch (e) {
    console.warn("    wikipedia err:", displayName, e.message);
    return null;
  }
}

// ── Club data ────────────────────────────────────────────────────────────────

const DATA = [
  // ---------- Europe ----------
  { c: "ENG", f: "gb-eng", n: "England", r: "Europe", k: [
    ["Manchester City",    "Manchester City F.C."],
    ["Manchester United",  "Manchester United F.C."],
    ["Liverpool",          "Liverpool F.C."],
    ["Arsenal",            "Arsenal F.C."],
    ["Chelsea",            "Chelsea F.C."],
    ["Tottenham Hotspur",  "Tottenham Hotspur F.C."],
    ["Newcastle United",   "Newcastle United F.C."] ] },
  { c: "ESP", f: "es", n: "Spain", r: "Europe", k: [
    ["Real Madrid",        "Real Madrid CF"],
    ["Barcelona",          "FC Barcelona"],
    ["Atlético Madrid",    "Atlético Madrid"],
    ["Sevilla",            "Sevilla FC"],
    ["Valencia",           "Valencia CF"] ] },
  { c: "GER", f: "de", n: "Germany", r: "Europe", k: [
    ["Bayern München",     "FC Bayern Munich"],
    ["Borussia Dortmund",  "Borussia Dortmund"],
    ["RB Leipzig",         "RB Leipzig"],
    ["Bayer Leverkusen",   "Bayer 04 Leverkusen"] ] },
  { c: "ITA", f: "it", n: "Italy", r: "Europe", k: [
    ["Juventus",           "Juventus FC"],
    ["Inter Milan",        "Inter Milan"],
    ["AC Milan",           "AC Milan"],
    ["Napoli",             "SSC Napoli"],
    ["Roma",               "AS Roma"] ] },
  { c: "FRA", f: "fr", n: "France", r: "Europe", k: [
    ["Paris Saint-Germain","Paris Saint-Germain F.C."],
    ["Marseille",          "Olympique de Marseille"],
    ["Monaco",             "AS Monaco FC"],
    ["Lyon",               "Olympique Lyonnais"] ] },
  { c: "POR", f: "pt", n: "Portugal", r: "Europe", k: [
    ["Benfica",            "S.L. Benfica"],
    ["Porto",              "FC Porto"],
    ["Sporting CP",        "Sporting CP"] ] },
  { c: "NED", f: "nl", n: "Netherlands", r: "Europe", k: [
    ["Ajax",               "AFC Ajax"],
    ["PSV",                "PSV Eindhoven"],
    ["Feyenoord",          "Feyenoord"] ] },
  { c: "SCT", f: "gb-sct", n: "Scotland", r: "Europe", k: [
    ["Celtic",             "Celtic F.C."],
    ["Rangers",            "Rangers F.C."] ] },
  { c: "TUR", f: "tr", n: "Turkey", r: "Europe", k: [
    ["Galatasaray",        "Galatasaray S.K. (football)"],
    ["Fenerbahçe",         "Fenerbahçe S.K. (football)"],
    ["Beşiktaş",           "Beşiktaş J.K."] ] },
  { c: "BEL", f: "be", n: "Belgium", r: "Europe", k: [
    ["Club Brugge",        "Club Brugge KV"],
    ["Anderlecht",         "R.S.C. Anderlecht"] ] },
  { c: "GRE", f: "gr", n: "Greece", r: "Europe", k: [
    ["Olympiacos",         "Olympiacos F.C."],
    ["Panathinaikos",      "Panathinaikos F.C."],
    ["AEK Athens",         "AEK Athens F.C."] ] },
  { c: "UKR", f: "ua", n: "Ukraine", r: "Europe", k: [
    ["Shakhtar Donetsk",   "FC Shakhtar Donetsk"],
    ["Dynamo Kyiv",        "FC Dynamo Kyiv"] ] },
  { c: "CRO", f: "hr", n: "Croatia", r: "Europe", k: [
    ["Dinamo Zagreb",      "GNK Dinamo Zagreb"],
    ["Hajduk Split",       "HNK Hajduk Split"] ] },
  { c: "SRB", f: "rs", n: "Serbia", r: "Europe", k: [
    ["Red Star Belgrade",  "Red Star Belgrade"],
    ["Partizan",           "FK Partizan"] ] },
  { c: "RUS", f: "ru", n: "Russia", r: "Europe", k: [
    ["Zenit",              "FC Zenit Saint Petersburg"],
    ["Spartak Moscow",     "FC Spartak Moscow"],
    ["CSKA Moscow",        "PFC CSKA Moscow"] ] },
  { c: "DEN", f: "dk", n: "Denmark", r: "Europe", k: [
    ["FC Copenhagen",      "F.C. Copenhagen"],
    ["Brøndby",            "Brøndby IF"] ] },
  { c: "SWE", f: "se", n: "Sweden", r: "Europe", k: [
    ["Malmö FF",           "Malmö FF"],
    ["AIK",                "AIK Fotboll"] ] },
  { c: "NOR", f: "no", n: "Norway", r: "Europe", k: [
    ["Bodø/Glimt",         "FK Bodø/Glimt"],
    ["Rosenborg",          "Rosenborg BK"] ] },
  // ---------- South America ----------
  { c: "BRA", f: "br", n: "Brazil", r: "South America", k: [
    ["Flamengo",           "Clube de Regatas do Flamengo"],
    ["Palmeiras",          "Sociedade Esportiva Palmeiras"],
    ["Corinthians",        "Sport Club Corinthians Paulista"],
    ["São Paulo",          "São Paulo FC"],
    ["Santos",             "Santos FC"] ] },
  { c: "ARG", f: "ar", n: "Argentina", r: "South America", k: [
    ["Boca Juniors",       "Boca Juniors"],
    ["River Plate",        "Club Atlético River Plate"],
    ["Racing Club",        "Racing Club de Avellaneda"] ] },
  { c: "URU", f: "uy", n: "Uruguay", r: "South America", k: [
    ["Peñarol",            "Club Atlético Peñarol"],
    ["Nacional",           "Club Nacional de Football"] ] },
  { c: "COL", f: "co", n: "Colombia", r: "South America", k: [
    ["Atlético Nacional",  "Atlético Nacional"],
    ["Millonarios",        "Millonarios F.C."] ] },
  { c: "CHI", f: "cl", n: "Chile", r: "South America", k: [
    ["Colo-Colo",          "Colo-Colo"],
    ["Universidad de Chile","Universidad de Chile (football club)"] ] },
  { c: "ECU", f: "ec", n: "Ecuador", r: "South America", k: [
    ["Barcelona SC",       "Barcelona S.C."],
    ["LDU Quito",          "L.D.U. Quito"] ] },
  { c: "PAR", f: "py", n: "Paraguay", r: "South America", k: [
    ["Olimpia",            "Club Olimpia"],
    ["Cerro Porteño",      "Club Cerro Porteño"] ] },
  { c: "PER", f: "pe", n: "Peru", r: "South America", k: [
    ["Alianza Lima",       "Alianza Lima"],
    ["Universitario",      "Universitario de Deportes"] ] },
  // ---------- North America ----------
  { c: "USA", f: "us", n: "United States", r: "North America", k: [
    ["LAFC",               "Los Angeles FC"],
    ["Inter Miami",        "Inter Miami CF"],
    ["LA Galaxy",          "LA Galaxy"],
    ["Seattle Sounders",   "Seattle Sounders FC"],
    ["Atlanta United",     "Atlanta United FC"] ] },
  { c: "MEX", f: "mx", n: "Mexico", r: "North America", k: [
    ["Club América",       "Club América"],
    ["Guadalajara",        "C.D. Guadalajara"],
    ["Cruz Azul",          "Cruz Azul"],
    ["Tigres UANL",        "Tigres UANL"],
    ["Monterrey",          "C.F. Monterrey"] ] },
  { c: "CAN", f: "ca", n: "Canada", r: "North America", k: [
    ["Toronto FC",         "Toronto FC"],
    ["CF Montréal",        "CF Montréal"],
    ["Vancouver Whitecaps","Vancouver Whitecaps FC"] ] },
  { c: "CRC", f: "cr", n: "Costa Rica", r: "North America", k: [
    ["Saprissa",           "Deportivo Saprissa"],
    ["Alajuelense",        "L.D. Alajuelense"] ] },
  // ---------- Africa ----------
  { c: "EGY", f: "eg", n: "Egypt", r: "Africa", k: [
    ["Al Ahly",            "Al Ahly SC"],
    ["Zamalek",            "Zamalek SC"] ] },
  { c: "MAR", f: "ma", n: "Morocco", r: "Africa", k: [
    ["Raja CA",            "Raja CA"],
    ["Wydad AC",           "Wydad AC"] ] },
  { c: "RSA", f: "za", n: "South Africa", r: "Africa", k: [
    ["Mamelodi Sundowns",  "Mamelodi Sundowns F.C."],
    ["Kaizer Chiefs",      "Kaizer Chiefs F.C."],
    ["Orlando Pirates",    "Orlando Pirates F.C."] ] },
  { c: "NGA", f: "ng", n: "Nigeria", r: "Africa", k: [
    ["Enyimba",            "Enyimba F.C."],
    ["Rivers United",      "Rivers United F.C."] ] },
  { c: "TUN", f: "tn", n: "Tunisia", r: "Africa", k: [
    ["Espérance de Tunis", "Espérance de Tunis"],
    ["Étoile du Sahel",    "Étoile Sportive du Sahel"] ] },
  { c: "ALG", f: "dz", n: "Algeria", r: "Africa", k: [
    ["ES Sétif",           "ES Sétif"],
    ["CR Belouizdad",      "CR Belouizdad"] ] },
  { c: "COD", f: "cd", n: "DR Congo", r: "Africa", k: [
    ["TP Mazembe",         "TP Mazembe"],
    ["AS Vita Club",       "AS Vita Club"] ] },
  { c: "GHA", f: "gh", n: "Ghana", r: "Africa", k: [
    ["Asante Kotoko",      "Asante Kotoko S.C."],
    ["Hearts of Oak",      "Accra Hearts of Oak S.C."] ] },
  // ---------- Asia ----------
  { c: "JPN", f: "jp", n: "Japan", r: "Asia", k: [
    ["Urawa Red Diamonds", "Urawa Red Diamonds"],
    ["Kashima Antlers",    "Kashima Antlers"],
    ["Yokohama F. Marinos","Yokohama F. Marinos"] ] },
  { c: "KOR", f: "kr", n: "South Korea", r: "Asia", k: [
    ["Jeonbuk Hyundai",    "Jeonbuk Hyundai Motors FC"],
    ["Ulsan HD",           "Ulsan HD FC"] ] },
  { c: "CHN", f: "cn", n: "China", r: "Asia", k: [
    ["Shanghai Port",      "Shanghai Port F.C."],
    ["Shandong Taishan",   "Shandong Taishan F.C."] ] },
  { c: "KSA", f: "sa", n: "Saudi Arabia", r: "Asia", k: [
    ["Al Hilal",           "Al Hilal SFC"],
    ["Al Nassr",           "Al Nassr FC"],
    ["Al Ittihad",         "Al-Ittihad Club (Jeddah)"],
    ["Al Ahli",            "Al-Ahli Saudi FC"] ] },
  { c: "UAE", f: "ae", n: "United Arab Emirates", r: "Asia", k: [
    ["Al Ain",             "Al Ain FC"],
    ["Shabab Al Ahli",     "Shabab Al-Ahli Dubai FC"] ] },
  { c: "QAT", f: "qa", n: "Qatar", r: "Asia", k: [
    ["Al Sadd",            "Al Sadd SC"],
    ["Al Duhail",          "Al-Duhail SC"] ] },
  { c: "IRN", f: "ir", n: "Iran", r: "Asia", k: [
    ["Persepolis",         "Persepolis FC"],
    ["Esteghlal",          "Esteghlal FC"] ] },
  { c: "IRQ", f: "iq", n: "Iraq", r: "Asia", k: [
    ["Al Shorta",          "Al-Shorta SC"],
    ["Al Quwa Al Jawiya",  "Al-Quwa Al-Jawiya"] ] },
  { c: "THA", f: "th", n: "Thailand", r: "Asia", k: [
    ["Buriram United",     "Buriram United F.C."],
    ["Bangkok United",     "Bangkok United F.C."] ] },
  { c: "IND", f: "in", n: "India", r: "Asia", k: [
    ["Mohun Bagan",        "Mohun Bagan Super Giant"],
    ["Bengaluru FC",       "Bengaluru FC"] ] },
  // ---------- Oceania ----------
  { c: "AUS", f: "au", n: "Australia", r: "Oceania", k: [
    ["Melbourne City",     "Melbourne City FC"],
    ["Sydney FC",          "Sydney FC"],
    ["Melbourne Victory",  "Melbourne Victory"] ] },
  { c: "NZL", f: "nz", n: "New Zealand", r: "Oceania", k: [
    ["Auckland City",      "Auckland City FC"] ] },
];

// ── Run ──────────────────────────────────────────────────────────────────────

async function run() {
  const out = [];
  let resolved = 0, missing = 0;

  for (const country of DATA) {
    const clubs = [];
    process.stdout.write(`${country.n} `);
    for (const [name, hint] of country.k) {
      const logo = await resolveLogo(name, hint);
      if (logo) { resolved++; process.stdout.write("✓"); }
      else       { missing++;  process.stdout.write("✗"); console.warn(`\n  MISSING: ${name}`); }
      clubs.push({ n: name, logo });
      await sleep(150);
    }
    process.stdout.write("\n");
    out.push({ c: country.c, f: country.f, n: country.n, r: country.r, clubs });
  }

  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${OUT}`);
  console.log(`✓ ${resolved} logos resolved, ✗ ${missing} missing.`);
}

run();
