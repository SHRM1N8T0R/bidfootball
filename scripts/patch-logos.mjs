// Patches clubs.json: for each club without a logo, calls the Wikipedia REST
// page summary API (returns the page thumbnail — reliably the crest for clubs).
// Polite 300ms gap between requests; no rate-limiting issues.
//
//   node scripts/patch-logos.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "public", "clubs.json");
const UA = "bidfootball-logo-fetcher/1.0 (https://bidfootball.lol; dagos1555@gmail.com)";

// Wikipedia article title for each club that's still missing a logo.
// Exact title is important (spaces → underscores are handled below).
const WIKI_TITLES = {
  "Manchester City":      "Manchester_City_F.C.",
  "Manchester United":    "Manchester_United_F.C.",
  "Chelsea":              "Chelsea_F.C.",
  "Newcastle United":     "Newcastle_United_F.C.",
  "Atlético Madrid":      "Atlético_Madrid",
  "Benfica":              "S.L._Benfica",
  "Celtic":               "Celtic_F.C.",
  "Fenerbahçe":           "Fenerbahçe_S.K._(football)",
  "Olympiacos":           "Olympiacos_F.C.",
  "Shakhtar Donetsk":     "FC_Shakhtar_Donetsk",
  "Spartak Moscow":       "FC_Spartak_Moscow",
  "CSKA Moscow":          "PFC_CSKA_Moscow",
  "FC Copenhagen":        "F.C._Copenhagen",
  "Brøndby":              "Brøndby_IF",
  "Malmö FF":             "Malmö_FF",
  "AIK":                  "AIK_Fotboll",
  "Bodø/Glimt":           "FK_Bodø/Glimt",
  "Rosenborg":            "Rosenborg_BK",
  "Flamengo":             "Clube_de_Regatas_do_Flamengo",
  "Palmeiras":            "Sociedade_Esportiva_Palmeiras",
  "Corinthians":          "Sport_Club_Corinthians_Paulista",
  "São Paulo":            "São_Paulo_FC",
  "Santos":               "Santos_FC",
  "Boca Juniors":         "Boca_Juniors",
  "River Plate":          "Club_Atlético_River_Plate",
  "Racing Club":          "Racing_Club_de_Avellaneda",
  "Peñarol":              "Club_Atlético_Peñarol",
  "Nacional":             "Club_Nacional_de_Football",
  "Atlético Nacional":    "Atlético_Nacional",
  "Millonarios":          "Millonarios_F.C.",
  "Colo-Colo":            "Colo-Colo",
  "Universidad de Chile": "Universidad_de_Chile_(football_club)",
  "Barcelona SC":         "Barcelona_S.C.",
  "LDU Quito":            "L.D.U._Quito",
  "Olimpia":              "Club_Olimpia",
  "Club América":         "Club_América",
  "Al Ahly":              "Al_Ahly_SC",
  "Zamalek":              "Zamalek_SC",
  "Raja CA":              "Raja_CA",
  "Wydad AC":             "Wydad_AC",
  "Mamelodi Sundowns":    "Mamelodi_Sundowns_F.C.",
  "Kaizer Chiefs":        "Kaizer_Chiefs_F.C.",
  "Orlando Pirates":      "Orlando_Pirates_F.C.",
  "Enyimba":              "Enyimba_F.C.",
  "Rivers United":        "Rivers_United_F.C.",
  "Espérance de Tunis":   "Espérance_de_Tunis",
  "Étoile du Sahel":      "Étoile_Sportive_du_Sahel",
  "ES Sétif":             "ES_Sétif",
  "CR Belouizdad":        "CR_Belouizdad",
  "TP Mazembe":           "TP_Mazembe",
  "AS Vita Club":         "AS_Vita_Club",
  "Asante Kotoko":        "Asante_Kotoko_S.C.",
  "Hearts of Oak":        "Accra_Hearts_of_Oak_S.C.",
  "Urawa Red Diamonds":   "Urawa_Red_Diamonds",
  "Kashima Antlers":      "Kashima_Antlers",
  "Yokohama F. Marinos":  "Yokohama_F._Marinos",
  "Jeonbuk Hyundai":      "Jeonbuk_Hyundai_Motors_FC",
  "Ulsan HD":             "Ulsan_HD_FC",
  "Shanghai Port":        "Shanghai_Port_F.C.",
  "Shandong Taishan":     "Shandong_Taishan_F.C.",
  "Al Hilal":             "Al_Hilal_SFC",
  "Al Nassr":             "Al_Nassr_FC",
  "Al Ittihad":           "Al-Ittihad_Club_(Jeddah)",
  "Al Ahli":              "Al-Ahli_Saudi_FC",
  "Al Ain":               "Al_Ain_FC",
  "Shabab Al Ahli":       "Shabab_Al-Ahli_Dubai_FC",
  "Al Sadd":              "Al_Sadd_SC",
  "Al Duhail":            "Al-Duhail_SC",
  "Persepolis":           "Persepolis_FC",
  "Esteghlal":            "Esteghlal_FC",
  "Al Shorta":            "Al-Shorta_SC",
  "Al Quwa Al Jawiya":    "Al-Quwa_Al-Jawiya",
  "Buriram United":       "Buriram_United_F.C.",
  "Bangkok United":       "Bangkok_United_F.C.",
  "Mohun Bagan":          "Mohun_Bagan_Super_Giant",
  "Bengaluru FC":         "Bengaluru_FC",
  "Melbourne City":       "Melbourne_City_FC",
  "Sydney FC":            "Sydney_FC",
  "Melbourne Victory":    "Melbourne_Victory",
  "Auckland City":        "Auckland_City_FC",
};

async function getWikiThumb(title) {
  const encoded = encodeURIComponent(title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  const d = await res.json();
  return d.thumbnail?.source || d.originalimage?.source || null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const clubs = JSON.parse(await readFile(DATA_PATH, "utf8"));
  let patched = 0, stillMissing = 0, total = 0;

  for (const country of clubs) {
    for (const club of country.clubs) {
      if (club.logo) continue; // already resolved
      const title = WIKI_TITLES[club.n];
      if (!title) { stillMissing++; console.warn(`  No title mapping: ${club.n}`); continue; }
      total++;
      try {
        const url = await getWikiThumb(title);
        if (url) {
          club.logo = url;
          patched++;
          process.stdout.write(`  ✓ ${club.n}\n`);
        } else {
          stillMissing++;
          console.warn(`  ✗ no thumb: ${club.n}`);
        }
      } catch (e) {
        stillMissing++;
        console.warn(`  ! ${club.n}: ${e.message}`);
      }
      await sleep(300);
    }
  }

  await writeFile(DATA_PATH, JSON.stringify(clubs, null, 2));
  console.log(`\nPatched ${patched}/${total} missing logos. Still null: ${stillMissing}.`);
}

run().catch(e => { console.error(e); process.exit(1); });
