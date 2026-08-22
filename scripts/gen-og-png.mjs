import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

const svg = readFileSync("public/og.svg", "utf8");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
const png = resvg.render().asPng();
writeFileSync("public/og.png", png);
console.log(`✅ og.png written (${(png.length/1024).toFixed(0)} KB)`);
