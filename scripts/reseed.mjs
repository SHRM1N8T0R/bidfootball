/**
 * Resets KV to a clean launch state: Arsenal $22 (crown), Man Utd $20.
 * Run: node scripts/reseed.mjs
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
function logo(code, name) {
  return clubs.find(c => c.c === code)?.clubs.find(c => c.n === name)?.logo || "";
}

const totals = {
  "ENG::Arsenal": {
    code:"ENG", country:"England", flag:"gb-eng", club:"Arsenal",
    clubLogo: logo("ENG","Arsenal"),
    total:22, bids:1, lastBidder:"Gooner For Life", legends:[],
    ts: Date.now() - 1000*60*14
  },
  "ENG::Manchester United": {
    code:"ENG", country:"England", flag:"gb-eng", club:"Manchester United",
    clubLogo: logo("ENG","Manchester United"),
    total:20, bids:1, lastBidder:"Red Devil Danny", legends:[],
    ts: Date.now() - 1000*60*22
  },
};

const feed = [
  { code:"ENG", country:"England", flag:"gb-eng", club:"Arsenal",
    clubLogo: logo("ENG","Arsenal"),
    amount:22, bidder:"Gooner For Life", tier:"Supporter", tookCrown:true,
    ts: Date.now() - 1000*60*14 },
  { code:"ENG", country:"England", flag:"gb-eng", club:"Manchester United",
    clubLogo: logo("ENG","Manchester United"),
    amount:20, bidder:"Red Devil Danny", tier:"Supporter", tookCrown:false,
    ts: Date.now() - 1000*60*22 },
];

function kvPut(key, value) {
  const tmp = `_reseed_${key}.json`;
  writeFileSync(tmp, JSON.stringify(value));
  execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "${key}" --path="${tmp}"`, { stdio:"inherit" });
  unlinkSync(tmp);
}

kvPut("totals", totals);
kvPut("feed",   feed);

console.log("\n🏆 Done! Arsenal 👑 $22 | Man Utd $20 | Gap: $2");
