// The OS start-up screen (Bryson, 2026-10-07: "I didn't get the cool loading screen you showed me in the preview,
// it just gave me the old loading your dashboard screen").
// What has to stay true:
//  1. It is plain HTML that shows before React, Babel or Supabase arrive, and sits outside #root.
//  2. The app tells it when something real is on screen: the login screen, and Today after the data load.
//  3. 🔴 It can never hide a problem: every error path hides it first, and it always leaves within 25 seconds.
//  4. He can skip it, and it respects "reduce motion".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond) => { if (cond) pass++; else fails.push(what); };

const boot = S.indexOf('<div id="osboot"'), root = S.indexOf('<div id="root"></div>');
const js = S.slice(S.indexOf("<script>", boot), S.indexOf("</script>", boot));

// 1
ok("the start-up screen exists, before #root and before the compiled app", boot > 0 && boot < root && boot < S.indexOf('data-presets="react"'));
ok("it is plain script, no React and no arrow functions", js.length > 200 && !/React\.|=>/.test(js));
ok("it is a sibling of #root, so the blank-screen watchdog still sees an empty root", !S.slice(boot, root).includes('id="root"') && S.slice(boot, root).includes("</div>\n  <script>"));
ok("the old spinner text is never what he sees on a normal load", S.indexOf("if (window.__osReady) window.__osReady();\n  if (dataState===\"error\")") > S.indexOf("Loading your dashboard"));

// 2
ok("the login screen marks it ready", /if \(!session\) \{ if \(window\.__osReady\) window\.__osReady\(\); return <LoginScreen\/>; \}/.test(S));
ok("Today marks it ready only after the data has loaded", /if \(window\.__osReady\) window\.__osReady\(\);\n  if \(dataState==="error"\)/.test(S));
ok("it waits for ready before finishing, with a short minimum", /i>=LINES\.length&&ready&&Date\.now\(\)-t0>=MIN/.test(js) && /MIN=reduce\?0:1500/.test(js));

// 3
ok("🔴 a thrown error hides it", /window\.onerror=function\(m,s,l,c,e\)\{\s*if\(window\.__osBootHide\) window\.__osBootHide\(\);/.test(S));
ok("🔴 a missing library hides it", /if \(!gone\.length\) return;[^\n]*\n\s*if \(window\.__osBootHide\) window\.__osBootHide\(\);/.test(S));
ok("🔴 a React crash hides it", /componentDidCatch\(err, info\)\{\n\s*if \(window\.__osBootHide\) window\.__osBootHide\(\);/.test(S));
ok("🔴 it always leaves within 25 seconds whatever happened", /setTimeout\(finish,25000\)/.test(js));
ok("it removes itself after fading, so nothing invisible sits over the app", /el\.parentNode\.removeChild\(el\)/.test(js));

// 4
ok("a click or any key skips it", /el\.addEventListener\("click",finish\)/.test(js) && /addEventListener\("keydown"/.test(js));
ok("reduce motion turns the animation off", /prefers-reduced-motion:reduce\)\{#osboot/.test(S));
ok("no emoji in it", !/\p{Extended_Pictographic}/u.test(S.slice(S.lastIndexOf("<style>", boot), root)));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-os-boot: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
