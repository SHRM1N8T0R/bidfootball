/**
 * Shrink club logos in place. Filenames stay the same (clubs.json and KV point at them).
 * PNGs larger than 512px on a side are resized to fit inside 512px (the UI shows them at most 96px).
 * SVGs are optimised. Ones that are still heavy are redrawn as a 512px-wide SVG image
 * so the crest stays sharp on screen without shipping a multi-megabyte path.
 */
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { optimize } from "svgo";
import { Resvg } from "@resvg/resvg-js";

const DIR = "public/club-logos";
const MAX = 512;
const SVG_RASTER_IF_OVER = 48 * 1024;

const isPng = (buf) => buf.length > 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG";
const looksSvg = (buf) => {
  const head = buf.subarray(0, 400).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype svg");
};

async function pngBuffer(buf) {
  const meta = await sharp(buf, { limitInputPixels: false, animated: false }).metadata();
  let pipeline = sharp(buf, { limitInputPixels: false, animated: false }).rotate();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > MAX || h > MAX) {
    pipeline = pipeline.resize(MAX, MAX, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" });
  }
  return pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer();
}

function rasterSvg(text) {
  let rendered = new Resvg(text, { fitTo: { mode: "width", value: MAX } }).render();
  if (rendered.height > MAX) {
    rendered = new Resvg(text, { fitTo: { mode: "height", value: MAX } }).render();
  }
  const png = Buffer.from(rendered.asPng());
  const w = rendered.width;
  const h = rendered.height;
  const b64 = png.toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="data:image/png;base64,${b64}" width="${w}" height="${h}"/></svg>\n`;
  return Buffer.from(svg);
}

const files = (await readdir(DIR)).filter((f) => !f.startsWith("."));
let before = 0;
let after = 0;
let changed = 0;

for (const name of files) {
  const file = path.join(DIR, name);
  const buf = await readFile(file);
  before += buf.length;
  let next = buf;
  try {
    if (isPng(buf)) {
      next = await pngBuffer(buf);
    } else if (looksSvg(buf)) {
      const optimized = optimize(buf.toString("utf8"), {
        path: file,
        multipass: true,
        plugins: [{
          name: "preset-default",
          params: { overrides: { removeViewBox: false } },
        }],
      });
      let svgBuf = Buffer.from(optimized.data);
      if (svgBuf.length > SVG_RASTER_IF_OVER) {
        const raster = rasterSvg(optimized.data);
        if (raster.length < svgBuf.length) svgBuf = raster;
      }
      next = svgBuf;
    }
  } catch (err) {
    console.warn("skip", name, err.message);
    next = buf;
  }
  if (next.length < buf.length * 0.98 && next.length > 32) {
    await writeFile(file, next);
    changed++;
    after += next.length;
  } else {
    after += buf.length;
  }
}

const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log(`logos ${files.length}: ${kb(before)} → ${kb(after)} (${changed} files rewritten)`);
