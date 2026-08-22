import { readFileSync, writeFileSync } from "fs";

const clubs = JSON.parse(readFileSync("public/clubs.json", "utf8"));
let fixed = 0;

for (const country of clubs) {
  for (const club of country.clubs) {
    if (club.logo && club.logo.includes("?utm_")) {
      club.logo = club.logo.split("?utm_")[0];
      fixed++;
    }
  }
}

writeFileSync("public/clubs.json", JSON.stringify(clubs, null, 2));
console.log(`Stripped UTM params from ${fixed} logos.`);
