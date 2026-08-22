/**
 * Adds more clubs to the leaderboard with small seeded amounts.
 * Run: node scripts/add-clubs-seed.mjs
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
function logo(code, name) {
  return clubs.find(c => c.c === code)?.clubs.find(c => c.n === name)?.logo || "";
}

function kvPut(key, value) {
  const tmp = `_tmp_${key.replace(/\W/g,"_")}.json`;
  writeFileSync(tmp, JSON.stringify(value));
  execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "${key}" --path="${tmp}"`, { stdio:"inherit" });
  unlinkSync(tmp);
}

// Read existing totals
const raw = execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "totals"`, { encoding:"utf8" });
const totals = JSON.parse(raw);

const raw2 = execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "feed"`, { encoding:"utf8" });
const feed = JSON.parse(raw2);

const NEW_SEEDS = [
  { code:"ESP", country:"Spain",    flag:"es",     club:"Real Madrid",          total:8, bids:2, bidder:"HalaMadrid" },
  { code:"ESP", country:"Spain",    flag:"es",     club:"FC Barcelona",         total:7, bids:2, bidder:"VisCatala" },
  { code:"GER", country:"Germany",  flag:"de",     club:"Bayern München",       total:6, bids:1, bidder:"MiaSanMia" },
  { code:"FRA", country:"France",   flag:"fr",     club:"Paris Saint-Germain",  total:6, bids:2, bidder:"AlleezPSG" },
  { code:"TUR", country:"Turkey",   flag:"tr",     club:"Galatasaray",          total:5, bids:1, bidder:"CimbomFan" },
  { code:"ITA", country:"Italy",    flag:"it",     club:"Inter Milan",          total:5, bids:1, bidder:"ForceInter" },
  { code:"ITA", country:"Italy",    flag:"it",     club:"AC Milan",             total:4, bids:1, bidder:"SempreMilan" },
  { code:"ENG", country:"England",  flag:"gb-eng", club:"Liverpool",            total:4, bids:1, bidder:"YNWA1892" },
  { code:"ENG", country:"England",  flag:"gb-eng", club:"Chelsea",              total:3, bids:1, bidder:"BlueIsTheColour" },
  { code:"ENG", country:"England",  flag:"gb-eng", club:"Manchester City",      total:3, bids:1, bidder:"CityzensUnited" },
  { code:"POR", country:"Portugal", flag:"pt",     club:"Benfica",              total:3, bids:1, bidder:"GloriosaBenfica" },
  { code:"KSA", country:"Saudi Arabia", flag:"sa", club:"Al Nassr",             total:3, bids:1, bidder:"CristianoKingdom" },
  { code:"ARG", country:"Argentina",flag:"ar",     club:"Boca Juniors",         total:2, bids:1, bidder:"BocaEterno" },
  { code:"BRA", country:"Brazil",   flag:"br",     club:"Flamengo",             total:2, bids:1, bidder:"MengãoFan" },
  { code:"TUR", country:"Turkey",   flag:"tr",     club:"Fenerbahçe",           total:2, bids:1, bidder:"FenerFan" },
  { code:"NED", country:"Netherlands",flag:"nl",   club:"Ajax",                 total:2, bids:1, bidder:"GloriousAjax" },
  { code:"SCT", country:"Scotland", flag:"gb-sct", club:"Celtic",               total:1, bids:1, bidder:"HailHailCeltic" },
];

const now = Date.now();
for (const s of NEW_SEEDS) {
  const key = `${s.code}::${s.club}`;
  if (totals[key]) { console.log(`⏭  ${s.club} already exists — skipping`); continue; }
  totals[key] = {
    code:s.code, country:s.country, flag:s.flag, club:s.club,
    clubLogo: logo(s.code, s.club),
    total:s.total, bids:s.bids,
    lastBidder:s.bidder, legends:[],
    ts: now - Math.floor(Math.random()*3600000*48),
  };
  feed.push({
    code:s.code, country:s.country, flag:s.flag, club:s.club,
    clubLogo: logo(s.code, s.club),
    amount:s.total, bidder:s.bidder, tier:"Supporter", tookCrown:false,
    ts: now - Math.floor(Math.random()*3600000*48),
  });
  console.log(`✅ Added ${s.club} — €${s.total}`);
}

// Sort feed by ts desc
feed.sort((a,b) => b.ts - a.ts);

kvPut("totals", totals);
kvPut("feed", feed.slice(0, 100));

console.log(`\n🏆 Done! ${Object.keys(totals).length} clubs now on the board.`);
