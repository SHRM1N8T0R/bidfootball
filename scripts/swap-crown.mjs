/**
 * Makes Arsenal #1, Man Utd #2 by a small margin.
 * Run: node scripts/swap-crown.mjs
 */
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync } from "fs";

function kvGet(key) {
  const tmp = `_tmp_get_${key}.json`;
  execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "${key}" > "${tmp}"`, { stdio: ["pipe", "pipe", "inherit"] });
  const data = JSON.parse(readFileSync(tmp, "utf8"));
  unlinkSync(tmp);
  return data;
}

function kvPut(key, value) {
  const tmp = `_tmp_put_${key}.json`;
  writeFileSync(tmp, JSON.stringify(value));
  execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "${key}" --path="${tmp}"`, { stdio: "inherit" });
  unlinkSync(tmp);
}

const totals = await kvGet("totals");
const feed   = await kvGet("feed");

// Arsenal overtakes — new totals
totals["ENG::Arsenal"].total        = 3050;
totals["ENG::Arsenal"].bids         = 79;
totals["ENG::Arsenal"].lastBidder   = "Gooner For Life";
totals["ENG::Arsenal"].legends      = ["Gooner For Life"];

// Man Utd stays close but second
totals["ENG::Manchester United"].total      = 2840;
totals["ENG::Manchester United"].bids       = 73;
totals["ENG::Manchester United"].lastBidder = "Red Devil Danny";
totals["ENG::Manchester United"].legends    = ["Red Devil Danny"];

// Prepend a crown-taking feed entry for Arsenal
feed.unshift({
  code: "ENG", country: "England", flag: "gb-eng",
  club: "Arsenal", clubLogo: totals["ENG::Arsenal"].clubLogo,
  amount: 1080, bidder: "Gooner For Life", tier: "Legend",
  tookCrown: true, ts: Date.now() - 60000 * 3
});

await kvPut("totals", totals);
await kvPut("feed",   feed.slice(0, 100));

console.log("\n🏆 Done! Arsenal now leads at $3,050. Man Utd second at $2,840 ($210 gap).");
