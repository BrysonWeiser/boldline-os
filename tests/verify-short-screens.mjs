// Short screens (Bryson, 2026-11-09, photo of a 1366x768 office monitor: the Ads page's "journey of one lead" cut off
// its last step and the bottom of the phone). "make sure it also fits smaller monitors". Run after building the site.
//
// What has to stay true: a section that holds the screen while you scroll (position: sticky, the full height) shows
// ALL of its words and pictures at common short screen sizes. Anything taller than the screen there can never be
// scrolled into view, which is exactly the bug. Sizes are what the browser actually gets once the taskbar and the
// browser's own bars are taken off: a 1366x768 monitor (~625 tall), 1280x720 or a laptop at 150% (~590), and a
// 1920x1080 laptop at 125% (1536x~730).
import { serveSite, SITE_PAGES } from "./helpers/marketing-site.mjs";
import { chromiumPath } from "../scripts/chromium-path.mjs";

let chromium = null, exe = "";
try { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); exe = chromiumPath(); } catch { /* no browser */ }
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
if (!chromium) { console.log("verify-short-screens: skipped (no browser here)"); process.exit(0); }

const server = await serveSite();
const browser = await chromium.launch({ executablePath: exe });
const SIZES = [[1366, 625], [1280, 590], [1536, 730]];
const paths = SITE_PAGES.map((p) => "/" + p.replace(/index\.html$/, ""));

for (const [w, h] of SIZES) for (const path of (w === 1366 ? paths : ["/", "/ads/"])) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(server.base + path); await page.waitForTimeout(300);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const cut = new Set(); let side = 0;
  for (let y = 0; y < total; y += Math.round(h / 3)) {
    await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(60);
    const r = await page.evaluate(() => {
      const vh = innerHeight, out = [];
      for (const s of document.querySelectorAll("*")) {
        const cs = getComputedStyle(s); if (cs.position !== "sticky") continue;
        const sr = s.getBoundingClientRect(); if (Math.abs(sr.top - (parseFloat(cs.top) || 0)) > 2 || sr.height < vh * 0.5) continue;
        for (const el of s.querySelectorAll("h1,h2,h3,p,li,a,button,.lj-phone,.h-visual,img")) {
          const es = getComputedStyle(el); if (es.visibility === "hidden" || es.display === "none" || +es.opacity < 0.05) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          if (r.bottom > vh + 2 || r.top < -2) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${(el.innerText || "").trim().slice(0, 28)}"`);
        }
      }
      return { out, side: document.documentElement.scrollWidth - innerWidth };
    });
    r.out.forEach((o) => cut.add(o)); side = Math.max(side, r.side);
  }
  ok(`${w}x${h} ${path}: nothing cut off while a section holds the screen`, !cut.size, [...cut].slice(0, 4).join(" | "));
  ok(`${w}x${h} ${path}: no sideways scrolling`, side <= 0, `${side}px`);
  await ctx.close();
}
await browser.close(); server.close && server.close();
if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-short-screens: ${pass} checks passed`);
