// No zooming on an iPhone (Bryson, 2026-10-08, a screenshot of the contact page cut off on the right
// after he sent a test message). Safari on iPhone zooms the page in whenever someone taps a form box
// whose text is under 16px, and it stays zoomed after they submit, so the page reads as broken.
// Nearly every form box on the marketing site was 13 to 15px, and so were the ones on client landing
// pages and client websites, so their customers got it too.
// What has to stay true:
//  1. One rule (every form box 16px on phones and touch screens) in every place we serve forms from:
//     the marketing site, the standalone get-started page, client landing pages, client websites, the portal.
//  2. The rule reaches the built pages, including the sample sites.
//  3. Nothing a client or visitor opens blocks pinch zoom (maximum-scale), which hides the problem and
//     hurts anyone who needs to zoom.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const RULE = "@media (max-width:1024px),(pointer:coarse){input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=button]):not([type=hidden]),select,textarea{font-size:16px!important}}";

// 1. The same rule everywhere forms are served from
for (const f of ["marketing-src/base.css", "marketing-site/get-started/index.html", "netlify/functions/landing.mjs", "netlify/lib/site-render.mjs", "netlify/functions/portal.mjs"]) {
  ok(`🔴 ${f} carries the no-zoom rule`, src(f).includes(RULE));
}
ok("🔴 it is !important, because several form boxes set their size inline", RULE.includes("16px!important"));
ok("checkboxes and sliders are left alone (they never trigger the zoom)", RULE.includes(":not([type=checkbox])") && RULE.includes(":not([type=range])"));

// 2. It reaches what is served
ok("the built site stylesheet has it", src("marketing-site/site.css").includes(RULE));
for (const f of ["marketing-site/examples/aurora/contact/index.html", "marketing-site/examples/car-detailing/landing/index.html"]) {
  ok(`the built sample page ${f.split("/").slice(2, 4).join("/")} has it`, src(f).includes(RULE));
}
{
  const { IOS_NO_ZOOM: L } = await import("../netlify/functions/landing.mjs");
  const { IOS_NO_ZOOM: S } = await import("../netlify/lib/site-render.mjs");
  ok("the landing page and website renderers export the identical rule", L === RULE && S === RULE);
  ok("🔴 a client landing page actually renders it", /\$\{css\}\$\{kitCss\}(\$\{[a-zA-Z]+\})*\$\{IOS_NO_ZOOM\}<\/style>/.test(src("netlify/functions/landing.mjs")));
  ok("🔴 a client website actually renders it", /<style>\$\{css\(theme, P, cl\)\}\$\{IOS_NO_ZOOM\}<\/style>/.test(src("netlify/lib/site-render.mjs")));
  const P = await import("../netlify/functions/portal.mjs");
  const html = P._internal.makePortalHTML({ name: "A", packageId: "g-launch", portalToken: "t" }, P._internal.findPkg("g-launch"));
  ok("🔴 the portal renders it", html.includes(RULE));
  // 3. Pinch zoom is never blocked on anything a client or visitor opens
  ok("🔴 the portal no longer blocks pinch zoom", !/maximum-scale/.test(html));
}
for (const f of ["marketing-site/index.html", "marketing-site/contact/index.html", "marketing-site/get-started/index.html", "marketing-site/examples/aurora/contact/index.html"]) {
  ok(`${f.split("/").slice(1, -1).join("/") || "home"}: pinch zoom is not blocked`, !/maximum-scale|user-scalable=no/.test(src(f)));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-no-ios-zoom: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
