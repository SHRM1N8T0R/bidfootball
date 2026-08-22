// Patches the clubs still missing logos after fix-logos.mjs using Wikipedia REST.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "clubs.json");
const UA = "bidfootball/1.0";

const TITLES = {
  "Chelsea":         "Chelsea F.C.",
  "Roma":            "A.S. Roma",
  "Ajax":            "AFC Ajax",
  "PSV":             "PSV Eindhoven",
  "Celtic":          "Celtic F.C.",
  "Rangers":         "Rangers F.C.",
  "Partizan":        "FK Partizan",
  "Zenit":           "FC Zenit Saint Petersburg",
  "Spartak Moscow":  "FC Spartak Moscow",
  "AIK":             "AIK Fotboll",
  "Rosenborg":       "Rosenborg BK",
  "River Plate":     "Club Atlético River Plate",
  "Al Hilal":        "Al Hilal SFC",
  "Al Ittihad":      "Al-Ittihad Club (Jeddah)",
  "Al Sadd":         "Al Sadd SC",
  "Al Duhail":       "Al-Duhail SC",
  "Melbourne City":  "Melbourne City FC",
};

async function get(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const d = await r.json();
  return d.originalimage?.source || d.thumbnail?.source || null;
}

const clubs = JSON.parse(await readFile(OUT, "utf8"));
let n = 0;
for (const country of clubs) {
  for (const club of country.clubs) {
    const title = TITLES[club.n];
    if (!title) continue;
    const url = await get(title);
    if (url) { club.logo = url; n++; process.stdout.write(`✓ ${club.n}\n`); }
    else process.stdout.write(`✗ ${club.n}\n`);
    await new Promise(r => setTimeout(r, 250));
  }
}
await writeFile(OUT, JSON.stringify(clubs, null, 2));
console.log(`Patched ${n} logos.`);
