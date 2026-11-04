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
import { renderSite, ratingOf, PICK_THEMES, THEME_IDS, SITE_THEMES, pickThemesFor, THEME_DEFAULT, motionRecipe, MODES, NATURAL_MODE, modeOf, siteBrandKit } from "../netlify/lib/site-render.mjs";
import { demoClientOf, pitchClientOf, demoBarHTML, DEMO_THEME_DEFAULT } from "../netlify/lib/demo-site.mjs";
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

// ── 4. Cinematic, rebuilt: a split screen told scene by scene ───────────────────
// Bryson, 2026-11-04: first "cinematic still has the bubble", then "redo one of them the whole layout and animations
// that way the three templates give three completely different options for clients".
{
  const cin = (extra = {}, page = "home") => renderSite({ ...DEMO_DETAIL, ...extra, website: { ...DEMO_DETAIL.website, theme: "cinematic", ...(extra.website || {}) } }, page, { base: BASE });
  const C = cin();
  const scenes = [...C.matchAll(/<div class="cn-sc[^"]*" data-l="([^"]*)"/g)].map((m) => m[1]);
  const imgs = (C.match(/<img class="cn-img/g) || []).length;
  ok("🔴 no 3D orb and no bubble, anywhere", !/getContext\('webgl'/.test(C) && !/<canvas/.test(C) && ["services", "about"].every((p) => !/<canvas/.test(cin({}, p))) && motionRecipe({ id: "a" }, "cinematic").gl === null);
  ok("the home page is one split screen: the top, each service, the story and 'why us' as scenes", /<section class="cn cn-top" data-cn>/.test(C) && scenes.length === 2 + DEMO_DETAIL.website.content.services.length + 1 && /<h1 class="disp hl">/.test(C), scenes.join(" | "));
  ok("🔴 one photo per scene on the pinned half, the first loaded first; the others wait their turn", imgs === scenes.length && /<img class="cn-img on" src="[^"]+" alt="" fetchpriority="high">/.test(C) && (C.match(/class="cn-img on"/g) || []).length === 1);
  ok("the scenes don't repeat one photo back to back", (() => { const u = [...C.matchAll(/<img class="cn-img[^"]*" src="([^"]+)"/g)].map((m) => m[1]); return u.every((x, i) => !i || x !== u[i - 1]); })());
  ok("🔴 every word is readable without the script: only the motion class dims a waiting scene", /html\.mo \.cn-sc>\*\{opacity:\.16/.test(C) && !/(^|\n)\.cn-sc>\*\{opacity/.test(C));
  ok("the script lights the scene being read, swaps the photo and fills the progress line", /function cnUpd\(\)/.test(C) && /c\.im\[j\]\.classList\.toggle\('on',j===k\)/.test(C) && /c\.bar\.style\.transform='scaleX\('/.test(C) && /function frame\(\)\{tk=false;var y=scrollY;cnUpd\(\);/.test(C));
  ok("🔴 on a phone the photos become a band pinned under the header, and booking is in the first scene", /\.cn\{display:block;padding-top:76px\}\s*\.cn-media\{position:sticky;top:0;height:30svh/.test(C) && /class="cn-sc act" data-l="Scroll to explore"><div class="top">[\s\S]{0,900}class="btn"/.test(C));
  ok("🔴 on a phone the menu never covers the photo band: the band moves to sit under it as it slides in and out (Bryson: 'a bit tight')", /function cnTop\(\)\{[^}]*innerWidth<900&&hd[^}]*hd\.classList\.contains\('hide'\)\?b:b\+hd\.offsetHeight/.test(C) && /cnTop\(\);last=y;/.test(C) && /\.cn-media\{[^}]*transition:top \.5s/.test(C));
  ok("on a phone the words fade under the band, and the 'more on' links are light text links", /\.cn-media\{[^}]*box-shadow:0 22px 24px -4px var\(--bg\)/.test(C) && /\.cn-sc \.go \.btn\.ghost\{min-height:44px;padding:0;border:0;background:none/.test(C));
  ok("each service scene opens its own part of the Services page, which tells them the same way", C.includes(`href="${BASE}/services/#s1" data-page="services"`) && /<div class="cn-sc[^"]*" data-l="[^"]+" id="s1">/.test(cin({}, "services")));
  ok("the inside pages open on the same split, and the site closes on a photo end card", /<section class="cnh">/.test(cin({}, "about")) && /<section class="cn-end" data-scene="pass">/.test(C) && !/class="ctab/.test(C));
  ok("🔴 his order and his hidden parts still rule: a hidden story is no scene", !/data-l="Our story"/.test(cin({ website: { layout: { home: [{ key: "story", hidden: true }] } } })));
  ok("no photos: the split still works, with a colour panel", /<div class="cn-img cn-none on"><\/div>/.test(cin({ website: { stock: [], photos: [] } })));
  ok("the design is described by what it does", /[Ss]plit/.test(SITE_THEMES.cinematic.blurb) && /\["cinematic","Cinematic","[^"]*[Ss]plit[^"]*"\]/.test(UI));
  ok("aurora (retired) keeps its 3D for a site already on it", /getContext\('webgl'/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "aurora" } }, "home", { base: BASE })));
}

// ── 5. The three designs offered never look alike ───────────────────────────────
// Bryson, 2026-11-04: "there is basically no difference between editorial and cinematic we need to make sure the 3
// template options are unique". Showcase: bright, a full-screen photo. Cinematic: dark. Editorial: paper, rules, no boxes.
{
  const pal = (t) => renderSite({ ...DEMO_DETAIL, brandColor: undefined, website: { ...DEMO_DETAIL.website, theme: t } }, "home", { base: BASE });
  const bgOf = (h) => (h.match(/--bg:(#[0-9A-Fa-f]{6})/) || [])[1];
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };
  const [S, Ci, E] = PICK_THEMES.map(pal);
  ok("left alone, Cinematic shows dark and the other two light", lum(bgOf(Ci)) < 0.15 && lum(bgOf(S)) > 0.85 && lum(bgOf(E)) > 0.85, [S, Ci, E].map(bgOf).join());
  ok("🔴 each has its own hero: a full-screen photo, a framed photo beside giant type, a magazine split", /class="hero sc"/.test(S) && /class="cn cn-top"/.test(Ci) && /class="wrap ed"/.test(E) && !/class="cn |class="wrap ed"/.test(S) && !/class="hero sc"|class="wrap ed"/.test(Ci) && !/class="hero sc"|class="cn /.test(E));
  ok("each has its own typeface", /Plus\+Jakarta/.test(S) && /Archivo/.test(Ci) && /Fraunces/.test(E));
  ok("Editorial uses thin rules where the others use boxes, and a paper closing panel", /\.card\{background:none;border:0;border-top:1px solid var\(--ink\)/.test(E) && /\.ctab\{border-radius:0;background:var\(--bg2\)/.test(E) && !/\.card\{background:none;border:0/.test(S + Ci));
  ok("the descriptions say what each one looks like", /[Ss]plit/.test(SITE_THEMES.cinematic.blurb) && /[Mm]agazine/.test(SITE_THEMES.editorial.blurb));
}

// ── 6. Light or dark, on every design ───────────────────────────────────────────
// Bryson, 2026-11-04: "some businesses would want a style but have it either light or dark and that should be an
// option for all templates".
{
  const r = (theme, mode, extra = {}) => renderSite({ ...DEMO_DETAIL, brandColor: undefined, ...extra, website: { ...DEMO_DETAIL.website, theme, mode } }, "home", { base: BASE });
  const bg = (h) => (h.match(/:root\{--bg:(#[0-9A-Fa-f]{6})/) || [])[1];
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };
  ok("🔴 every offered design comes in light and in dark", PICK_THEMES.every((t) => lum(bg(r(t, "light"))) > 0.85 && lum(bg(r(t, "dark"))) < 0.15), PICK_THEMES.map((t) => bg(r(t, "light")) + "/" + bg(r(t, "dark"))).join(" "));
  ok("🔴 the mode changes colours only: the same layout either way", PICK_THEMES.every((t) => { const strip = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/data-mode="\w+"/, "").replace(/<meta name="theme-color" content="#\w+">/, ""); const a = strip(r(t, "light")), b = strip(r(t, "dark")); return a === b; }));
  ok("the page says which mode it is in, and carries the other one so a preview can flip instantly", /<html lang="en" data-mode="dark">/.test(r("showcase", "dark")) && /html\[data-mode=light\]\{--bg:#F8F7F4/.test(r("showcase", "dark")));
  ok("unset, each design keeps its natural mode; a nonsense value is ignored", MODES.every((m) => NATURAL_MODE.showcase && modeOf({ website: {} }, "showcase") === "light" && modeOf({ website: {} }, "cinematic") === "dark") && modeOf({ website: { mode: "<x>" } }, "editorial") === "light");
  ok("🔴 Aurora (retired) stays exactly as it was: dark, with no switch", modeOf({ website: { mode: "light" } }, "aurora") === "dark" && !/html\[data-mode=/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "aurora", mode: "light" } }, "home", { base: BASE }).replace(/html\[data-mode=dark\] \.map/, "")));
  ok("a navy brand stays visible on a dark page: the small touches lift, the buttons keep the true colour", (() => { const h = renderSite({ id: "n1", name: "Navy Co", website: { theme: "editorial", mode: "dark", brandColor: "#0A1F44" } }, "home", { base: BASE }); const root = h.match(/:root\{[^}]*\}/)[0]; return /--ac:#0A1F44/.test(root) && !/--ac3:#0A1F44/.test(root) && /html\[data-mode=light\]\{[^}]*--ac3:#0A1F44/.test(h); })());
  ok("a demo and a pitch preview carry the mode Bryson picked, and only a real one", demoClientOf({ id: "p", name: "X", data: {} }, { mode: "dark", theme: "showcase" }).website.mode === "dark" && !("mode" in demoClientOf({ id: "p", name: "X", data: {} }, { mode: "<x>" }).website) && pitchClientOf({ id: "c", data: { name: "Y" } }, { mode: "light" }).website.mode === "light");
  const GET = readFileSync(join(ROOT, "netlify/functions/demo-site.mjs"), "utf8");
  ok("🔴 the server only stores light, dark or 'the design's own', for demos and pitches alike", (GET.match(/if \(!\["", \.\.\.MODES\]\.includes\(body\.mode\)\) return json\(\{ ok: false, error: "Unknown mode" \}, 400\);/g) || []).length === 2);
  ok("the OS offers Light / Dark on the Website tab and on both preview cards, and keeps it when a preview becomes their site", (UI.match(/<ModePills /g) || []).length === 3 && /onPick=\{m=>save\(\{mode:m\}\)\}/.test(UI) && /\.\.\.\(full\.mode\?\{mode:full\.mode\}:\{\}\)/.test(UI) && /\.\.\.\(demo\.mode\?\{mode:demo\.mode\}:\{\}\)/.test(UI));
  const bar = demoBarHTML("X", [], "bl-mode:t");
  ok("🔴 the preview strip flips light and dark on the spot, saves nothing, and does nothing on a page without modes", /class="bl-mode"/.test(bar) && /if\(!h\.getAttribute\('data-mode'\)\)return;/.test(bar) && !/fetch|XMLHttpRequest|sendBeacon|localStorage/.test(bar));
  ok("the landing page follows the website's mode", siteBrandKit({ website: { theme: "editorial", mode: "dark" } }).dark === true && siteBrandKit({ website: { theme: "editorial" } }).dark === false);
}

console.log(`verify-showcase-design: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
