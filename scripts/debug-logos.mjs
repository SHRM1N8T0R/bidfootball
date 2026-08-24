// Debug: test PSG and Inter Milan download
import { writeFileSync } from "fs";

const tests = [
  { name: "PSG", url: "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg" },
  { name: "Inter", url: "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg" },
  { name: "AC Milan", url: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg" },
  { name: "Napoli", url: "https://upload.wikimedia.org/wikipedia/commons/4/4d/SSC_Napoli_2025_%28white_and_azure%29.svg" },
];

for (const { name, url } of tests) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bidfootball/1.0)", "Accept": "image/svg+xml,*/*" },
      redirect: "follow",
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const isXml = buf.slice(0,5).toString().includes("<") || buf.slice(0,5).toString().includes("PK");
    console.log(`${name}: ${r.status} | ${buf.length} bytes | starts: "${buf.slice(0,30).toString().replace(/\n/g,' ')}" | SVG: ${isXml}`);
    if (buf.length > 300) writeFileSync(`public/club-logos/${name.toLowerCase().replace(/ /g,"-")}.svg`, buf);
  } catch(e) {
    console.log(`${name}: ERROR - ${e.message}`);
  }
}
