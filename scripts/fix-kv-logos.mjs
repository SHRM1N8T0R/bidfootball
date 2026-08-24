/**
 * Updates clubLogo in KV totals to match the fixed logos in clubs.json.
 * Run: node scripts/fix-kv-logos.mjs
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));

function getLogo(code, name) {
  return clubs.find(c => c.c === code)?.clubs.find(c => c.n === name)?.logo || "";
}

const raw = execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "totals"`, { encoding: "utf8" });
const totals = JSON.parse(raw);

let fixed = 0;
for (const [key, entry] of Object.entries(totals)) {
  const newLogo = getLogo(entry.code, entry.club);
  if (newLogo && newLogo !== entry.clubLogo) {
    console.log(`🔧 ${entry.club}: updating logo`);
    entry.clubLogo = newLogo;
    fixed++;
  }
}

console.log(`\nUpdating ${fixed} logos in KV...`);
const tmp = "_tmp_totals.json";
writeFileSync(tmp, JSON.stringify(totals));
execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "totals" --path="${tmp}"`, { stdio: "inherit" });
unlinkSync(tmp);
console.log(`✅ Done.`);
