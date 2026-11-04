// Previews in the business's own colours, read off its current website (KB brand-kit, "from their website").
// Bryson, 2026-11-04: "make sure any previews are done in the brands colors using anything we can from their website".
// Run: node tests/verify-site-brand.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { paletteFrom, fontsFrom, currentSiteOf, brandFromSite, brandish } from "../netlify/lib/brand-scrape.mjs";
import { brandColorOf, renderSite } from "../netlify/lib/site-render.mjs";
import { brandAccents, brandFonts } from "../netlify/lib/brand-style.mjs";
import { demoClientOf, pitchClientOf } from "../netlify/lib/demo-site.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const ta = async (name, fn) => { try { ok(name, await fn()); } catch (e) { ok(name, false, e.message); } };

// ── 1. Reading a page ───────────────────────────────────────────────────────────
const PAGE = `<html><head><meta name="theme-color" content="#0F4C81"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&amp;family=Open+Sans&display=swap" rel="stylesheet">
<style>:root{--brand-primary:#0f4c81;--accent:#F2A900}.btn,.book{background:#F2A900}body{color:#333;background:#fff}a{color:#337ab7}.x{color:#337ab7}.y{color:#337ab7}.z{color:#337ab7}</style></head>
<body><img class="logo" src="/img/logo.svg"></body></html>`;
const pal = paletteFrom(PAGE);
ok("the site's own colour wins (theme colour and --brand-primary)", pal.primary === "#0F4C81", JSON.stringify(pal));
ok("the button colour comes second", pal.second === "#F2A900");
ok("🔴 a toolkit default never counts, however often it appears (Bootstrap's link blue)", !Object.values(pal).includes("#337AB7") && !brandish("#337ab7"));
ok("greys, white and black are never a brand", !brandish("#333333") && !brandish("#ffffff") && !brandish("#050505"));
ok("a vector logo's colours count most", paletteFrom("<style>.a{color:#2244aa}</style>", [], '<svg><path fill="#C8102E"/></svg>').primary === "#C8102E");
ok("nothing usable: null, so the design keeps its own colours", paletteFrom("<style>body{color:#222;background:#fafafa}</style>") === null);
ok("its Google fonts, heading first", JSON.stringify(fontsFrom(PAGE)) === JSON.stringify({ headingFont: "Montserrat", bodyFont: "Open Sans" }));

// ── 2. Where their current site is ──────────────────────────────────────────────
ok("a prospect's found site", currentSiteOf({ domain: "desertgloss.com" }) === "https://desertgloss.com/");
ok("a client's typed site, or the address they gave in the portal", currentSiteOf({ website: "http://acme.co" }) === "https://acme.co/" && currentSiteOf({ website: {}, websiteIntake: { domain: "acmepools.com" } }) === "https://acmepools.com/");
ok("🔴 never a social profile, a directory, BoldLine, 'none', or an internal address", ["facebook.com/acme", "https://www.yelp.com/biz/x", "boldlinemedia.com", "none", "localhost", "https://10.0.0.1"].every((v) => currentSiteOf({ domain: v }) === ""));
ok("not their own domain once our new site is live on it (it would read our colours back)", currentSiteOf({ websiteDeal: { domain: { host: "acme.com", live: true } } }) === "");

// ── 3. The whole fetch, with a stand-in for the internet ────────────────────────
const fake = (map) => async (u) => { const b = map[u]; return b == null ? { ok: false, status: 404, headers: new Headers() } : { ok: true, status: 200, headers: new Headers(), text: async () => b }; };
await ta("reads the page, its own stylesheet and its vector logo", async () => {
  const r = await brandFromSite("https://acme.com", { fetchImpl: fake({
    "https://acme.com/": '<link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/vendor/bootstrap.min.css"><img class="logo" src="/logo.svg">',
    "https://acme.com/site.css": ".btn{background:#E4572E}", "https://acme.com/vendor/bootstrap.min.css": ".a{color:#10B981}.b{color:#10B981}.c{color:#10B981}", "https://acme.com/logo.svg": '<svg fill="#1B4D8C"/>' }) });
  return r && r.primary === "#1B4D8C" && r.second === "#E4572E" && r.logo === "https://acme.com/logo.svg" && !Object.values(r).includes("#10B981");
});
await ta("a site that won't answer gives nothing, quietly", async () => (await brandFromSite("https://down.example", { fetchImpl: fake({}) })) === null);

// ── 4. 🔴 Hand-set always wins; theirs fills the gaps ───────────────────────────
const sb = { primary: "#FF6600", second: "#345C52", accent: "#F2A900", logo: "https://acme.com/logo.png", headingFont: "Montserrat", bodyFont: "Open Sans" };
ok("their website's colour is used when nothing is set by hand", brandColorOf({ siteBrand: sb }) === "#FF6600");
ok("🔴 a Brand kit, a typed colour or the landing page colour all beat it", brandColorOf({ siteBrand: sb, brandKit: { primary: "#112233" } }) === "#112233" && brandColorOf({ siteBrand: sb, brandColor: "#445566" }) === "#445566" && brandColorOf({ siteBrand: sb, landingPage: { brandColor: "#778899" } }) === "#778899");
ok("their second and accent colours come along with their main one", brandAccents({ siteBrand: sb }, "#FF6600").second === "#345C52");
ok("🔴 but never beside a different hand-set main colour (they could clash)", brandAccents({ siteBrand: sb }, "#112233").second === "#112233");
ok("their fonts when no kit fonts are set; kit fonts win", brandFonts({ siteBrand: sb }).heading === "Montserrat" && brandFonts({ siteBrand: sb, brandKit: { headingFont: "Lora" } }).heading === "Lora");
const H = renderSite({ ...DEMO_DETAIL, brandColor: undefined, siteBrand: sb, mediaLibrary: [], website: { ...DEMO_DETAIL.website, brandColor: undefined, theme: "showcase" } }, "home", { base: "https://example.com/s" });
ok("the page is painted with it, and shows their logo", /--ac:#FF6600/i.test(H) && /src="https:\/\/acme\.com\/logo\.png"/.test(H));

// ── 5. Every kind of preview carries it ─────────────────────────────────────────
ok("a prospect demo", brandColorOf(demoClientOf({ id: "p", name: "X", data: {} }, { brand: sb })) === "#FF6600");
const pc = pitchClientOf({ id: "c", data: { name: "Y", brandKit: { primary: "#123456" }, mediaLibrary: [{ category: "logo", url: "https://x.com/l.png" }, { category: "photo", url: "https://x.com/p.jpg" }], siteBrand: sb } }, {});
ok("🔴 a pitch preview keeps the client's own Brand kit and logo (the first version dropped them)", brandColorOf(pc) === "#123456" && pc.mediaLibrary.length === 1 && pc.siteBrand.primary === "#FF6600");
const BG = read("netlify/functions/demo-site-background.mjs"), SB = read("netlify/functions/site-build-background.mjs"), UI = read("index.html");
ok("demos and pitch previews read the site while the words are written", (BG.match(/brandFromSite\(site\)\.catch\(\(\) => null\)/g) || []).length === 2);
ok("a client's real website build reads it too, at most every 30 days", /fresh = sb && Date\.now\(\) - Date\.parse\(sb\.at \|\| 0\) < 30 \* 864e5/.test(SB) && /saveSiteBrand\(supabase, clientId, brand\)/.test(SB));
ok("it is server-owned, and both preview cards can refresh it without rewriting the words", /SERVER_OWNED_KEYS=\[[^\]]*"siteBrand"/.test(UI) && (UI.match(/>Use their website's colours<\/button>/g) || []).length === 2);

console.log(`verify-site-brand: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
