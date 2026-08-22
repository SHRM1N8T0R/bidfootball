import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
const barcaLogo = clubs.find(c=>c.c==="ESP")?.clubs.find(c=>c.n==="Barcelona")?.logo || "";

const raw = execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "totals"`, { encoding:"utf8" });
const totals = JSON.parse(raw);

for (const [key, entry] of Object.entries(totals)) {
  if (entry.club === "FC Barcelona") {
    entry.clubLogo = barcaLogo;
    console.log(`Fixed FC Barcelona logo: ${barcaLogo}`);
  }
}

const tmp = "_tmp_totals.json";
writeFileSync(tmp, JSON.stringify(totals));
execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "totals" --path="${tmp}"`, { stdio:"inherit" });
unlinkSync(tmp);
console.log("Done.");
