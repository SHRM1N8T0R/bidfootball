import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";

function kv(key) {
  return JSON.parse(execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "${key}" 2>nul`, { encoding:"utf8" }).trim());
}
function kvPut(key, val, tmp) {
  writeFileSync(tmp, JSON.stringify(val));
  execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "${key}" --path "${tmp}" 2>nul`);
  unlinkSync(tmp);
}

const totals = kv("totals");
const feed   = kv("feed");

const CLUBS = [
  { code:"ESP", country:"Spain",   flag:"es", club:"Barcelona",        clubLogo:"/club-logos/barcelona.svg.png",        bids:5, total:67, supporters:["CuleForever","MessiLegacy","BlauGrana99","CataloniaFC","BarçaNation"] },
  { code:"ESP", country:"Spain",   flag:"es", club:"Real Madrid",      clubLogo:"/club-logos/real-madrid.svg.png",      bids:4, total:48, supporters:["HalaMadrid","BernabeuKing","MadridCF","GalacticoFan"] },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Liverpool",    clubLogo:"/club-logos/liverpool.svg.png",        bids:4, total:44, supporters:["YNWA1892","KopEnd","RedsFan","AnfieldRoar"] },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Manchester City", clubLogo:"/club-logos/manchester-city.svg.png", bids:3, total:35, supporters:["CityzensBlue","EtihadRoar","BlueMoon99"] },
  { code:"DEU", country:"Germany", flag:"de", club:"Bayern Munich",    clubLogo:"/club-logos/bayern-munich.svg.png",    bids:3, total:30, supporters:["MiaSanMia","AllianzFan","BayernForever"] },
  { code:"FRA", country:"France",  flag:"fr", club:"Paris Saint-Germain", clubLogo:"/club-logos/paris-saint-germain.svg.png", bids:2, total:18, supporters:["ParisIci","PsgUltra"] },
  { code:"ITA", country:"Italy",   flag:"it", club:"Juventus",         clubLogo:"/club-logos/juventus.svg.png",         bids:2, total:15, supporters:["ForzaJuve","BianconeroFC"] },
];

const now = Date.now();
for (const c of CLUBS) {
  const key = `${c.code}::${c.club}`;
  totals[key] = {
    code: c.code, country: c.country, flag: c.flag,
    club: c.club, clubLogo: c.clubLogo,
    total: c.total, bids: c.bids,
    lastBidder: c.supporters[c.supporters.length - 1],
    ts: now - Math.floor(Math.random() * 20 * 3600000),
    legends: [],
  };
  // Add one feed entry per club
  feed.unshift({
    code: c.code, country: c.country, flag: c.flag,
    club: c.club, clubLogo: c.clubLogo,
    amount: Math.floor(c.total / c.bids),
    bidder: c.supporters[0],
    ts: totals[key].ts,
    tookCrown: false,
    tier: "Supporter",
  });
}

kvPut("totals", totals, "scripts/_tmp_totals.json");
kvPut("feed", feed.slice(0, 50), "scripts/_tmp_feed.json");

CLUBS.forEach(c => console.log(`${c.club}: $${c.total}, ${c.bids} supporters`));
console.log("Done.");
