// The Showcase website design, and Aurora's retirement (KB website-builder).
// Run: node tests/verify-showcase-design.mjs
//
// Bryson, 2026-11-03: "the aurora one might be out of date or just there might be a better style", then "yes" to a
// photo-first design. What this stops, worst first:
//  1. A star rating on a client's website that isn't their real one (an invented rating is a lie a customer reads).
//  2. A site already on Aurora changing under its owner.
//  3. Aurora still being offered, or new sites and demos still starting on it.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite, ratingOf, PICK_THEMES, THEME_IDS, SITE_THEMES, pickThemesFor, THEME_DEFAULT, motionRecipe } from "../netlify/lib/site-render.mjs";
import { demoClientOf, DEMO_THEME_DEFAULT } from "../netlify/lib/demo-site.mjs";
import { demoThemeFor } from "../netlify/functions/demo-site-background.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const BASE = "https://example.com/site/x";
const site = (extra = {}, page = "home") => renderSite({ ...DEMO_DETAIL, ...extra, website: { ...DEMO_DETAIL.website, theme: "showcase", ...(extra.website || {}) } }, page, { base: BASE, noindex: true });
const shown = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n));

// ── 1. The rating chip: real or nothing ─────────────────────────────────────────
ok("🔴 no rating known: no chip at all", !/class="rate"/.test(site()));
ok("their Google profile's real rating shows, with its count", /class="rate"[\s\S]{0,400}4\.9 <small>from 61 Google reviews<\/small>/.test(site({ gbpStats: { average: 4.9, total: 61 } })));
ok("a rating he typed shows with its own source", /4\.7 <small>from 23 Yelp reviews<\/small>/.test(site({ website: { rating: { stars: 4.7, count: 23, source: "Yelp" } } })));
ok("🔴 a rating with no count, a zero, or above five is never shown", [{ stars: 4.8, count: 0 }, { stars: 0, count: 9 }, { stars: 6, count: 9 }].every((r) => ratingOf({ website: { rating: r } }) === null));
ok("🔴 a source can't smuggle markup", ratingOf({ website: { rating: { stars: 5, count: 3, source: "<b>x</b>" } } }).source === "");
const demo = demoClientOf({ id: "p1", name: "Desert Shine", niche: "Car Detailing", data: { rating: 4.9, reviewCount: 88, reviewSource: "Google" } }, { content: DEMO_DETAIL.website.content });
ok("a demo carries the rating the research found", ratingOf(demo) && ratingOf(demo).count === 88 && ratingOf(demo).source === "Google");
ok("a demo with no research rating carries none", ratingOf(demoClientOf({ id: "p2", name: "X", data: {} }, {})) === null);

// ── 2. The page itself ───────────────────────────────────────────────────────────
const H = site({ gbpStats: { average: 4.9, total: 61 } });
ok("the hero is their photo, loaded first", /<section class="hero sc"><div class="scbg"><img src="https:\/\/images\.pexels\.com[^"]+" alt="[^"]+" fetchpriority="high">/.test(H));
ok("services are photo tiles that open the Services page", /<div class="bento n3">/.test(H) && (H.match(/<a class="rv d\d" href="https:\/\/example\.com\/site\/x\/services\/#s\d"/g) || []).length === 3);
ok("no 3D backdrop: the photo is the hero and the page stays light", !/getContext\('webgl'/.test(H));
ok("🔴 no em dashes or emojis a visitor reads", !/[—–]/.test(shown(H)) && [...shown(H).matchAll(/\p{Extended_Pictographic}/gu)].every((m) => ["★", "✓", "✦", "©"].includes(m[0])));
ok("every page renders", ["services", "about", "reviews", "contact"].every((p) => site({}, p).length > 5000));
ok("a site with no photos still gets a hero", /<div class="scbg"><\/div>/.test(site({ website: { stock: [], photos: [] } })));

// ── 3. Aurora retired, not removed ───────────────────────────────────────────────
ok("🔴 a site on Aurora still renders Aurora", /data-theme="aurora"/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "aurora" } }, "home", { base: BASE })) && THEME_IDS.includes("aurora") && SITE_THEMES.aurora.retired === true);
ok("Aurora is offered nowhere new; Showcase is first", PICK_THEMES.join() === "showcase,cinematic,editorial" && pickThemesFor("cinematic").join() === PICK_THEMES.join());
ok("a site already on Aurora still sees it in its own switcher", pickThemesFor("aurora").includes("aurora"));
ok("🔴 existing sites keep their motion: Showcase was added last", THEME_IDS.indexOf("showcase") === THEME_IDS.length - 1);
ok("Showcase gets its own scene and entrance among the three offered", (() => { const c = { id: "zz9" }; return new Set(PICK_THEMES.map((t) => motionRecipe(c, t).scene)).size === 3; })());
ok("new demos start on Showcase, and a rebuilt Aurora demo moves to it", DEMO_THEME_DEFAULT === "showcase" && THEME_DEFAULT === "showcase" && demoThemeFor("Car Detailing") === "showcase" && demoThemeFor("x", "aurora") === "showcase" && demoThemeFor("Chiropractic") === "editorial");
ok("the OS offers Showcase first, starts new sites on it, and keeps Aurora only for a site already on it",
  /const SITE_THEME_LIST=\[\["showcase","Showcase"/.test(UI) && !/const SITE_THEME_LIST=\[[^\n]*"aurora"/.test(UI) && /theme:w\.theme\|\|"showcase",previewKey/.test(UI) && /siteThemeListFor\(theme\)\.map/.test(UI));

// ── 4. Cinematic: their photo, never a random bubble ────────────────────────────
// Bryson, 2026-11-04: "cinematic still has the bubble and I feel like that should change where we don't have a random bubble".
{
  const cin = (extra = {}) => renderSite({ ...DEMO_DETAIL, ...extra, website: { ...DEMO_DETAIL.website, theme: "cinematic", ...(extra.website || {}) } }, "home", { base: BASE });
  const C = cin();
  ok("🔴 Cinematic draws no 3D orb, on the home page or any other", !/getContext\('webgl'/.test(C) && !/<canvas/.test(C) && ["services", "about"].every((p) => !/<canvas/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "cinematic" } }, p, { base: BASE }))) && motionRecipe({ id: "a" }, "cinematic").gl === null);
  ok("their photo sits in a frame beside the first line, before the second, and tilts", /<h1 class="disp lA hl">[\s\S]*?<div class="cdr"><div class="ph rv d1 cfr" data-tilt><img src="https:\/\/images\.pexels\.com[^"]+" alt="[^"]+" fetchpriority="high"><\/div><\/div><\/div>\s*<div class="cbot"><h2 class="disp lB/.test(C));
  ok("🔴 on a phone the photo follows the buttons (booking stays on the first screen)", /@media \(max-width:899px\)\{[^}]*\.hero \.copy:has\(\.cdr\)\{display:flex;flex-direction:column[\s\S]{0,200}\.hero \.cdr\{order:3/.test(C));
  ok("🔴 the photo's drift never opens a gap in the frame (Bryson's phone showed a grey strip): it stays inside the 12% zoom", /\.cfr\.in img\{transform:translate3d\(0,calc\(var\(--y,0\) \* \.08%\),0\) scale\(1\.12\)/.test(C) && /Math\.min\(y\*\.1,60\)/.test(C));
  ok("on a phone the frame doesn't drift into the buttons, and 'Scroll to explore' is dropped", /cdr\.style\.transform=innerWidth>=900\?/.test(C) && /\.hero \.copy:has\(\.cdr\) \.scroll\{display:none\}/.test(C));
  ok("🔴 a refresh opens at the top, not where the visitor left off; a link to a section still lands on it", /history\.scrollRestoration='manual';if\(!location\.hash\)scrollTo\(0,0\);/.test(C) && ["showcase", "editorial"].every((t) => /scrollRestoration='manual'/.test(site({ website: { theme: t } }))));
  ok("no photos: no empty frame", !/class="cdr"/.test(cin({ website: { stock: [], photos: [] } })));
  ok("the services section starts on a different photo than the hero", (() => { const m = [...C.matchAll(/<img src="([^"]+)"/g)].map((x) => x[1]); return m.length > 2 && m[0] !== m[1]; })());
  ok("aurora (retired) keeps its 3D for a site already on it", /getContext\('webgl'/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "aurora" } }, "home", { base: BASE })));
  ok("the design is described by what it shows", SITE_THEMES.cinematic.blurb.includes("photo") && !/orb/.test(SITE_THEMES.cinematic.blurb) && /\["cinematic","Cinematic","[^"]*photo[^"]*"\]/.test(UI));
}

console.log(`verify-showcase-design: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
