/**
 * Replaces blocked r2.thesportsdb.com logos using Wikidata P154 (logo image property).
 * P154 is the official logo field — way more reliable than scraping article images.
 * Run: node scripts/fix-sportsdb-logos.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const ARTICLE = {
  "Aston Villa":            "Aston_Villa_F.C.",
  "Bournemouth":            "AFC_Bournemouth",
  "Brentford":              "Brentford_F.C.",
  "Brighton":               "Brighton_%26_Hove_Albion_F.C.",
  "Coventry City":          "Coventry_City_F.C.",
  "Crystal Palace":         "Crystal_Palace_F.C.",
  "Everton":                "Everton_F.C.",
  "Fulham":                 "Fulham_F.C.",
  "West Ham United":        "West_Ham_United_F.C.",
  "Wolverhampton":          "Wolverhampton_Wanderers_F.C.",
  "Nottingham Forest":      "Nottingham_Forest_F.C.",
  "Leicester City":         "Leicester_City_F.C.",
  "Ipswich Town":           "Ipswich_Town_F.C.",
  "Southampton":            "Southampton_F.C.",
  "Athletic Bilbao":        "Athletic_Club",
  "Celta Vigo":             "RC_Celta_de_Vigo",
  "Deportivo Alavés":       "Deportivo_Alavés",
  "Deportivo de A Coruña":  "RC_Deportivo_de_La_Coruña",
  "Elche":                  "Elche_CF",
  "Espanyol":               "RCD_Espanyol",
  "Getafe":                 "Getafe_CF",
  "Levante":                "Levante_UD",
  "Augsburg":               "FC_Augsburg",
  "Borussia Mönchengladbach":"Borussia_Mönchengladbach",
  "Eintracht Frankfurt":    "Eintracht_Frankfurt",
  "Elversberg":             "SV_Elversberg",
  "Freiburg":               "SC_Freiburg",
  "Hamburg":                "Hamburger_SV",
  "Hoffenheim":             "TSG_1899_Hoffenheim",
  "Mainz":                  "1._FSV_Mainz_05",
  "Union Berlin":           "1._FC_Union_Berlin",
  "Werder Bremen":          "SV_Werder_Bremen",
  "Wolfsburg":              "VfL_Wolfsburg",
  "St. Pauli":              "FC_St._Pauli",
  "Bochum":                 "VfL_Bochum",
  "Holstein Kiel":          "Holstein_Kiel",
  "VfB Stuttgart":          "VfB_Stuttgart",
  "Heidenheim":             "1._FC_Heidenheim_1846",
  "Atalanta":               "Atalanta_B.C.",
  "Bologna":                "Bologna_F.C._1909",
  "Cagliari":               "Cagliari_Calcio",
  "Como":                   "Como_1907",
  "Fiorentina":             "ACF_Fiorentina",
  "Frosinone":              "Frosinone_Calcio",
  "Genoa":                  "Genoa_C.F.C.",
  "Lazio":                  "S.S._Lazio",
  "Lecce":                  "U.S._Lecce",
  "Monza":                  "AC_Monza",
  "Torino":                 "Torino_F.C.",
  "Udinese":                "Udinese_Calcio",
  "Venezia":                "Venezia_F.C.",
  "Verona":                 "Hellas_Verona_F.C.",
  "Empoli":                 "Empoli_F.C.",
  "Angers":                 "SCO_Angers",
  "Auxerre":                "AJ_Auxerre",
  "Brest":                  "Stade_Brestois_29",
  "Le Havre":               "Le_Havre_AC",
  "Le Mans":                "Le_Mans_FC",
  "Lens":                   "RC_Lens",
  "Lille":                  "Lille_OSC",
  "Lorient":                "FC_Lorient",
  "Montpellier":            "Montpellier_HSC",
  "Nantes":                 "FC_Nantes",
  "Nice":                   "OGC_Nice",
  "Reims":                  "Stade_de_Reims",
  "Rennes":                 "Stade_Rennais_FC",
  "Saint-Étienne":          "AS_Saint-Étienne",
  "Strasbourg":             "RC_Strasbourg_Alsace",
  "Toulouse":               "Toulouse_FC",
  "Aberdeen":               "Aberdeen_F.C.",
  "Dundee":                 "Dundee_F.C.",
  "Dundee United":          "Dundee_United_F.C.",
  "Falkirk":                "Falkirk_F.C.",
  "Hearts":                 "Heart_of_Midlothian_F.C.",
  "Hibernian":              "Hibernian_F.C.",
  "Kilmarnock":             "Kilmarnock_F.C.",
  "Motherwell":             "Motherwell_F.C.",
  "Académico de Viseu":     "Académico_de_Viseu_FC",
  "Alverca":                "FC_Alverca",
  "Arouca":                 "FC_Arouca",
  "Braga":                  "S.C._Braga",
  "Casa Pia":               "Casa_Pia_A.C.",
  "Estoril Praia":          "G.D._Estoril_Praia",
  "Estrela Amadora":        "CF_Estrela",
  "Famalicao":              "FC_Famalicão",
  "Gil Vicente":            "Gil_Vicente_FC",
  "ADO Den Haag":           "ADO_Den_Haag",
  "AZ Alkmaar":             "AZ_Alkmaar",
  "Cambuur":                "SC_Cambuur",
  "Excelsior":              "SBV_Excelsior",
  "Fortuna Sittard":        "Fortuna_Sittard",
  "Go Ahead Eagles":        "Go_Ahead_Eagles",
  "Groningen":              "FC_Groningen",
  "Heerenveen":             "SC_Heerenveen",
  "Alanyaspor":             "Alanyaspor",
  "Amed":                   "Amedspor",
  "Çorum":                  "Çorum_FK",
  "Erzurumspor":            "BB_Erzurumspor",
  "Eyüpspor":               "Eyüpspor",
  "Gaziantep":              "Gaziantep_FK",
  "Gençlerbirliği":         "Gençlerbirliği_S.K.",
  "Trabzonspor":            "Trabzonspor",
  "Kasımpaşa":              "Kasımpaşa_S.K.",
  "Kayserispor":            "Kayserispor",
  "Konyaspor":              "Konyaspor",
  "Sivasspor":              "Sivasspor",
  "Hatayspor":              "Hatayspor",
};

// Wikidata P154 = logo image property
async function wikidataLogo(articleTitle) {
  await new Promise(r => setTimeout(r, 450));
  try {
    // Get Wikidata entity via Wikipedia article title
    const entResp = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(articleTitle)}&props=claims&format=json`,
      { headers: { "User-Agent": "bidfootball/1.0" } }
    );
    const entData = await entResp.json();
    const entity = Object.values(entData.entities || {})[0];
    if (!entity || entity.missing) return null;

    const p154 = entity.claims?.P154;
    if (!p154?.length) return null;

    const filename = p154[0].mainsnak.datavalue.value;

    // Resolve filename → actual CDN URL via Special:FilePath redirect
    const fileResp = await fetch(
      `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=250`,
      { redirect: "follow", headers: { "User-Agent": "bidfootball/1.0" } }
    );
    const url = fileResp.url.split("?")[0];
    if (url.includes("upload.wikimedia.org")) return url;
  } catch {}
  return null;
}

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
let fixed = 0, kept = 0;

for (const country of clubs) {
  for (const club of country.clubs) {
    if (!club.logo?.includes("thesportsdb")) continue;

    const article = ARTICLE[club.n];
    if (!article) { console.log(`⚠️  No article mapping: ${club.n}`); kept++; continue; }

    process.stdout.write(`🔍 ${club.n}... `);
    const logo = await wikidataLogo(article);
    if (logo) {
      club.logo = logo;
      console.log(`✅ ${logo.slice(-40)}`);
      fixed++;
    } else {
      console.log(`❌ keeping TheSportsDB`);
      kept++;
    }
  }
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`\n✅ Fixed ${fixed} via Wikidata P154. ${kept} still on TheSportsDB.`);
