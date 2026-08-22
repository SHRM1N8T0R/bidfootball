/**
 * Audits all KV totals entries for missing/wrong logos.
 * Tries exact match first, then fuzzy match against clubs.json.
 * Run: node scripts/audit-kv-logos.mjs
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));

// Build flat lookup: name (lowercased) -> logo
const byName = {};
const byCode = {}; // code -> [{n, logo}]
for (const country of clubs) {
  if (!byCode[country.c]) byCode[country.c] = [];
  for (const club of country.clubs) {
    byName[club.n.toLowerCase()] = club.logo;
    byCode[country.c].push({ n: club.n, logo: club.logo });
  }
}

function findLogo(code, clubName) {
  const lower = clubName.toLowerCase();

  // 1. Exact match
  if (byName[lower]) return { logo: byName[lower], how: "exact" };

  // 2. Match within same country code
  const countryClubs = byCode[code] || [];
  for (const c of countryClubs) {
    if (c.n.toLowerCase() === lower) return { logo: c.logo, how: "country-exact" };
  }

  // 3. Fuzzy: clubs.json name contains KV name or vice versa (same country)
  for (const c of countryClubs) {
    const a = c.n.toLowerCase(), b = lower;
    if (a.includes(b) || b.includes(a)) return { logo: c.logo, how: `fuzzy(${c.n})` };
  }

  // 4. Global fuzzy (cross-country)
  for (const country of clubs) {
    for (const c of country.clubs) {
      const a = c.n.toLowerCase(), b = lower;
      if (a.includes(b) || b.includes(a)) return { logo: c.logo, how: `global-fuzzy(${c.n})` };
    }
  }

  return null;
}

const raw = execSync(`npx wrangler kv key get --binding=BIDS --remote --preview false "totals"`, { encoding:"utf8" });
const totals = JSON.parse(raw);

const issues = [];
let fixed = 0;

for (const [key, entry] of Object.entries(totals)) {
  const result = findLogo(entry.code, entry.club);

  if (!result) {
    console.log(`❓ NO MATCH:  [${entry.code}] "${entry.club}" — skipping`);
    continue;
  }

  const { logo, how } = result;
  const hasLogo = !!entry.clubLogo;
  const sameUrl = entry.clubLogo === logo;

  if (!hasLogo || !sameUrl) {
    console.log(`🔧 FIX [${how}]: "${entry.club}" → ${logo.substring(0,70)}`);
    entry.clubLogo = logo;
    fixed++;
    issues.push({ club: entry.club, how });
  }
}

if (fixed === 0) {
  console.log("✅ All logos already correct — no changes needed.");
  process.exit(0);
}

console.log(`\nWriting ${fixed} fixes to KV...`);
const tmp = "_tmp_audit.json";
writeFileSync(tmp, JSON.stringify(totals));
execSync(`npx wrangler kv key put --binding=BIDS --remote --preview false "totals" --path="${tmp}"`, { stdio:"inherit" });
unlinkSync(tmp);
console.log(`\n✅ Fixed ${fixed} clubs:`);
issues.forEach(i => console.log(`  - ${i.club} (${i.how})`));
