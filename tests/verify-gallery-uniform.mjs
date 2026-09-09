// The gallery is UNIFORM and every photo still fills its tile, measured in a real browser.
//
// Bryson, 2026-09-09: *"add a rule to make sure they are all still uniform that way one image
// isnt one size and shape and another image is completely different size and shape"*.
//
// 🔴 THE FIXTURES ARE DATA URIs ON PURPOSE. A first version used remote placeholder URLs,
// which never load in this sandbox, so the images had NO intrinsic size and "fills its box"
// was trivially true of a zero-sized image. The check passed while proving nothing.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import zlib from "node:zlib";

let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser in this environment */ }
if (!chromium) { console.log("verify-gallery-uniform: skipped, no browser in this environment"); process.exit(0); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A real PNG of exact dimensions, built here so nothing has to be fetched.
const png = (w, h, rgb) => {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))])));
  const ch = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]); return Buffer.concat([Buffer.alloc(4), b, Buffer.alloc(4)]).fill(0, 0, 4) && Buffer.concat([(() => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return l; })(), b, (() => { const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32 ? zlib.crc32(b) : crc(b)); return c; })()]); };
  const crc = (buf) => { let c = ~0; for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const mk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  return "data:image/png;base64," + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), mk("IHDR", ihdr), mk("IDAT", zlib.deflateSync(raw)), mk("IEND", Buffer.alloc(0))]).toString("base64");
};
const D = { portraitA: png(90,120,[34,51,68]), portraitB: png(90,120,[136,136,136]), landscape: png(120,90,[17,68,204]) };
const { renderLandingPage } = await import(join(ROOT, "netlify/functions/landing.mjs"));
// Real shapes: two portrait 3:4 phone photos and one landscape, which is what a client sends.
const html = renderLandingPage({
  name:"Stencil & Thread", niche:"Screen printing",
  campaignSetup:{ serviceArea:"Eugene, Oregon", mainOffer:"Custom apparel" },
  landingPage:{ published:true, headline:"Custom shirts, done right", subheadline:"Fast turnarounds." },
  mediaLibrary:[
    { category:"photo", label:"Navy tee", url:D.portraitA, w:90, h:120 },
    { category:"photo", label:"Grey hoodie", url:D.portraitB, w:90, h:120 },
    { category:"photo", label:"Blue tee", url:D.landscape, w:120, h:90 },
  ],
});
const tmp = join(ROOT, ".gallery-check.html");
writeFileSync(tmp, html);
const b = await chromium.launch({ executablePath: exe });
let bad = 0;
for (const w of [360,390,768,1280,1600]) {
  const pg = await b.newPage({ viewport:{width:w,height:1000} });
  await pg.goto("file://" + tmp);
  await pg.waitForTimeout(700);
  const r = await pg.evaluate(() => {
    const items=[...document.querySelectorAll(".gitem")];
    if(!items.length) return {none:true};
    const gal=document.querySelector(".gal");
    const boxes = items.map(it=>{ const im=it.querySelector("img"); const a=it.getBoundingClientRect(), b=im.getBoundingClientRect();
      return { fillW: Math.round(b.width)===Math.round(a.width), fillH: Math.abs(b.height-a.height)<=1,
               gapW: Math.round(a.width-b.width), gapH: Math.round(a.height-b.height),
               ratio:+(b.width/b.height).toFixed(2) }; });
    return { uni: gal.classList.contains("uni"), galr: gal.style.getPropertyValue("--galr"),
             sameShape: new Set(boxes.map(b=>b.ratio)).size===1,
             sameSize: new Set(boxes.map(b=>Math.round(b.gapW))).size===1, boxes };
  });
  const gaps = r.boxes ? r.boxes.filter(x=>!x.fillW||!x.fillH) : [];
  const overflow = await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  console.log(w, "uniform:", r.uni, "ratio:", r.galr, "all same shape:", r.sameShape, "| gaps:", gaps.length, "| overflowX:", overflow);
  const galr = Number(r.galr);
  const fitsThesePhotos = Math.abs(galr - 0.75) < 0.02;
  if (!fitsThesePhotos) console.log(`    ^ shape ${r.galr} is not the median of these photos (0.75), so it was chosen rather than measured`);
  if (gaps.length || overflow > 0 || !r.uni || !r.sameShape || !fitsThesePhotos) bad++;
  await pg.close();
}
await b.close();
try { (await import("node:fs")).unlinkSync(tmp); } catch {}
console.log(bad ? `verify-gallery-uniform: FAILED at ${bad} width(s)` : "verify-gallery-uniform: every tile is the same shape and fills its box, at every width");
process.exit(bad?1:0);
