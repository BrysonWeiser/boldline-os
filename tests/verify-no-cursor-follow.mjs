// Nothing on any page we build follows the visitor's cursor.
// Run: node tests/verify-no-cursor-follow.mjs
//
// Bryson, 2026-11-05: "on showcase there is a circle that follows around the cursor but i dont want anything to ever
// follow someones cursor". Removed: the cursor ring and the photo that trailed the pointer over the services list (client
// websites), buttons that drifted toward the pointer, the background dots that leaned toward it and drew lines to it, and
// the light that followed it inside cards (boldlinemedia.com). A tile that TILTS in place when pointed at is not following.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite, PICK_THEMES, THEME_IDS, motionRecipe } from "../netlify/lib/site-render.mjs";
import { renderLandingPage } from "../netlify/functions/landing.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };

const pages = [];
for (const t of THEME_IDS) for (const p of ["home", "services", "about"]) for (const seed of ["a", "b", "c", "d"])
  pages.push(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: t, motionSeed: seed } }, p, { base: "https://example.com/s" }));
ok("🔴 no cursor ring on any design, for any client's mix", pages.every((h) => !/className='cur'|class="cur"/.test(h)) && THEME_IDS.every((t) => ["a", "b", "c", "x", "y"].every((s) => motionRecipe({ id: s }, t).cursor === false)));
ok("🔴 no photo trailing the pointer over the services", pages.every((h) => !/class="hov"/.test(h) && !/querySelector\('\.hov'\)/.test(h)));
ok("🔴 no button drifting toward the pointer", pages.every((h) => !/q\('\.btn'\)\.forEach\(function\(b\)\{b\.addEventListener\('pointermove'/.test(h)));
ok("the only pointer listeners left on the offered designs tilt a tile in place", PICK_THEMES.every((t) => { const h = renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: t } }, "home", { base: "https://example.com/s" }); return (h.match(/pointermove/g) || []).length <= 1 && (!/pointermove/.test(h) || /q\('\.card,\[data-tilt\]'\)/.test(h)); }));
ok("landing pages have no pointer listeners at all", !/pointermove|mousemove/.test(renderLandingPage({ name: "X", landingPage: { headline: "Hi" } })));
const SJS = read("marketing-src/site.js"), NCSS = read("marketing-src/new.css");
ok("🔴 boldlinemedia.com: the background dots no longer react to the pointer", !/mAct|ctx\.moveTo\(mx, my\)/.test(SJS) && !/window\.addEventListener\('pointermove'/.test(SJS));
ok("🔴 boldlinemedia.com: no light following the pointer inside cards", !/--mx|--my/.test(SJS) && !/b-card::after\{[^}]*var\(--mx/.test(NCSS));
ok("Editorial's floating bar: round buttons inside the round bar (Bryson's screenshot)", /\.pill \.btn\{min-height:46px;padding:0 20px;font-size:14px;border-radius:999px\}/.test(pages[0]) && !/\.pill\{border-radius:6px\}/.test(renderSite({ ...DEMO_DETAIL, website: { ...DEMO_DETAIL.website, theme: "editorial" } }, "home", { base: "https://example.com/s" })));
console.log(`verify-no-cursor-follow: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
