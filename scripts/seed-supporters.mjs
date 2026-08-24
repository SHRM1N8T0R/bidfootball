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

const EXTRA = [
  { code:"ENG", country:"England", flag:"gb-eng", club:"Arsenal",           clubLogo:"/club-logos/arsenal.svg",            bidder:"Gooner1990",  amount:15, tier:"Supporter" },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Arsenal",           clubLogo:"/club-logos/arsenal.svg",            bidder:"NorthLondon", amount:25, tier:"Champion"  },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Arsenal",           clubLogo:"/club-logos/arsenal.svg",            bidder:"RedAndWhite", amount:10, tier:"Supporter" },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Manchester United", clubLogo:"/club-logos/manchester-united.png",  bidder:"RedDevil99",  amount:10, tier:"Supporter" },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Manchester United", clubLogo:"/club-logos/manchester-united.png",  bidder:"OldTrafford", amount:15, tier:"Supporter" },
];

const now = Date.now();
for (const s of EXTRA) {
  const key = `${s.code}::${s.club}`;
  if (!totals[key]) totals[key] = { code:s.code, country:s.country, flag:s.flag, club:s.club, clubLogo:s.clubLogo, total:0, bids:0, lastBidder:"", ts:0, legends:[] };
  const e = totals[key];
  e.total      += s.amount;
  e.bids       += 1;
  e.lastBidder  = s.bidder;
  e.clubLogo    = s.clubLogo;
  e.ts          = now - Math.floor(Math.random() * 14 * 3600000);
  feed.unshift({ code:s.code, country:s.country, flag:s.flag, club:s.club, clubLogo:s.clubLogo,
    amount:s.amount, bidder:s.bidder, ts:e.ts, tookCrown:false, tier:s.tier });
}

kvPut("totals", totals, "scripts/_tmp_totals.json");
kvPut("feed",   feed.slice(0,50), "scripts/_tmp_feed.json");

["ENG::Arsenal","ENG::Manchester United"].forEach(k=>
  console.log(`${k}: $${totals[k].total} total, ${totals[k].bids} bids`)
);
