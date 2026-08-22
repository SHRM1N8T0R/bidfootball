/**
 * Seeds KV with initial data so the site looks alive at launch.
 * Run: node scripts/seed-kv.mjs
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));

function clubLogo(code, name) {
  const country = clubs.find(c => c.c === code);
  const club = country?.clubs.find(c => c.n === name);
  return club?.logo || "";
}

const SEED = [
  { code:"ENG", country:"England",    flag:"gb-eng", club:"Manchester United",   total:2840, bids:73 },
  { code:"ENG", country:"England",    flag:"gb-eng", club:"Arsenal",             total:1970, bids:52 },
  { code:"ENG", country:"England",    flag:"gb-eng", club:"Liverpool",           total:1640, bids:41 },
  { code:"ESP", country:"Spain",      flag:"es",     club:"Real Madrid",         total:980,  bids:28 },
  { code:"TUR", country:"Turkey",     flag:"tr",     club:"Galatasaray",         total:760,  bids:21 },
  { code:"ESP", country:"Spain",      flag:"es",     club:"FC Barcelona",        total:620,  bids:17 },
  { code:"GER", country:"Germany",    flag:"de",     club:"Bayern Munich",       total:480,  bids:14 },
  { code:"BRA", country:"Brazil",     flag:"br",     club:"Flamengo",            total:320,  bids:11 },
  { code:"ARG", country:"Argentina",  flag:"ar",     club:"River Plate",         total:280,  bids:9  },
  { code:"FRA", country:"France",     flag:"fr",     club:"Paris Saint-Germain", total:220,  bids:7  },
  { code:"ITA", country:"Italy",      flag:"it",     club:"Juventus",            total:175,  bids:5  },
  { code:"POR", country:"Portugal",   flag:"pt",     club:"SL Benfica",          total:130,  bids:4  },
];

const FEED_RAW = [
  { code:"ENG", country:"England",   flag:"gb-eng", club:"Manchester United",   amount:500, bidder:"Red Devil Danny",   tier:"Legend",    tookCrown:true,  ts: Date.now()-3600000*2  },
  { code:"ENG", country:"England",   flag:"gb-eng", club:"Arsenal",             amount:200, bidder:"Gooner For Life",   tier:"Legend",    tookCrown:false, ts: Date.now()-3600000*5  },
  { code:"ESP", country:"Spain",     flag:"es",     club:"Real Madrid",         amount:100, bidder:"HalaMadrid",        tier:"Champion",  tookCrown:false, ts: Date.now()-3600000*8  },
  { code:"TUR", country:"Turkey",    flag:"tr",     club:"Galatasaray",         amount:50,  bidder:"CimbomFan",         tier:"Champion",  tookCrown:false, ts: Date.now()-3600000*10 },
  { code:"ENG", country:"England",   flag:"gb-eng", club:"Liverpool",           amount:300, bidder:"YNWA Forever",      tier:"Legend",    tookCrown:false, ts: Date.now()-3600000*14 },
  { code:"GER", country:"Germany",   flag:"de",     club:"Bayern Munich",       amount:75,  bidder:"Mia San Mia",      tier:"Champion",  tookCrown:false, ts: Date.now()-3600000*20 },
  { code:"BRA", country:"Brazil",    flag:"br",     club:"Flamengo",            amount:25,  bidder:"Mengão Power",     tier:"Supporter", tookCrown:false, ts: Date.now()-3600000*30 },
];

// Build totals
const totals = {};
for (const s of SEED) {
  const key = `${s.code}::${s.club}`;
  const feedEntry = FEED_RAW.find(f => f.code === s.code && f.club === s.club);
  totals[key] = {
    code: s.code, country: s.country, flag: s.flag, club: s.club,
    clubLogo: clubLogo(s.code, s.club),
    total: s.total, bids: s.bids,
    lastBidder: feedEntry?.bidder || "Anonymous",
    ts: feedEntry?.ts || Date.now() - 3600000 * 48,
    legends: FEED_RAW.filter(f => f.code === s.code && f.club === s.club && f.tier === "Legend").map(f => f.bidder),
  };
}

// Build feed
const feed = FEED_RAW.map(f => ({ ...f, clubLogo: clubLogo(f.code, f.club) }));

console.log(`Seeding ${Object.keys(totals).length} clubs + ${feed.length} feed entries…\n`);

function kvPut(key, value) {
  const tmp = `_seed_${key.replace(/\W/g,"_")}.json`;
  writeFileSync(tmp, JSON.stringify(value));
  try {
    execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "${key}" --path="${tmp}"`, { stdio: "inherit" });
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

kvPut("totals", totals);
kvPut("feed", feed);

console.log("\n🏆 Done! Man Utd leads at $2,840. Deploy and check live.");
