// The OS must never be blank and silent.
//
// Bryson, 2026-09-04, from his phone: *"the os won't load it just keeps going to a white
// screen"*. An hour went into hunting a bug in the app. The app was fine.
//
// 🔴 THE FAILURE HAD NO REPORTER, WHICH IS WHY IT COST AN HOUR. Three separate safety nets
// existed and not one of them could fire:
//
//   `window.onerror`      — nothing threw, so it never ran.
//   a React error boundary — there wasn't one, and it could not have helped anyway.
//   the service worker    — it cached the shell and waved every cross-origin request through.
//
// React, ReactDOM, Babel and Supabase all come from unpkg. Lose one on a dropped bar of
// signal and `<script type="text/babel">` is never transformed, because Babel is the thing
// that transforms it. Nothing runs. Nothing throws. The page is blank forever and the person
// looking at it has no way to tell anybody anything.
//
// 🔴 THE TRANSFERABLE LESSON: an error handler only catches errors. The worst failures do not
// raise one, they just fail to happen, and nothing that waits to be told will ever notice.
// Reproduced in a real browser by blocking unpkg, both before and after.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const SW = readFileSync(join(ROOT, "service-worker.js"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l)).join("\n");
const UI = code(S), W = code(SW);
let n = 0;
const t = (name, fn) => { fn(); n++; };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── 1. 🔴 THE LIBRARIES NOT ARRIVING MUST SAY SO ─────────────────────────────
t("🔴 a missing library is detected, not waited on forever", () => {
  assert(/NEED = \[\["React"/.test(UI), "nothing checks the libraries actually arrived");
  for (const g of ["React", "ReactDOM", "Babel", "supabase"]) {
    assert(new RegExp(`\\["${g}"`).test(UI), `${g} is not checked, so losing it is still silent`);
  }
});

t("🔴 the check runs WITHOUT the libraries it is checking for", () => {
  // It has to be plain DOM. Anything it depended on is exactly what has gone missing, and a
  // detector that needs React to report that React is missing reports nothing at all.
  const i = UI.indexOf('NEED = [["React"');
  const body = UI.slice(UI.lastIndexOf("<script>", i), UI.indexOf("</script>", i));
  assert(!/React\.|ReactDOM\.|=>/.test(body.replace(/\/\/.*$/gm, "")),
    "the missing-library notice uses the libraries it exists to report as missing");
  // 🔴 It must sit OUTSIDE the block Babel compiles, or Babel not arriving takes the
  // detector with it. Checked by position, not by spelling: writing the tag name into a
  // comment here would trip the app-boots suite, which is exactly what happened once.
  assert(UI.indexOf('NEED = [["React"') < UI.indexOf('data-presets="react"'),
    "the missing-library notice sits inside the block that only runs once Babel has arrived");
});

t("it explains itself in words, and blames the right thing", () => {
  assert(/The OS could not finish loading/.test(S), "there is no message at all");
  assert(/almost always the connection rather than the OS/.test(S),
    "a blank screen with no cause named sends him hunting for a bug that is not there");
  assert(/Nothing is lost/.test(S), "the first fear is that data went with it");
  assert(/bl-retry/.test(UI), "there is nothing to press");
});

t("🔴 it never covers a working app", () => {
  // Firing on a slow-but-fine load would replace a real screen with an error, which is a
  // worse bug than the one it fixes.
  assert(/root\.innerHTML\.trim\(\)\.length > 0\) return;/.test(UI),
    "the notice can paint over an app that already rendered");
  assert(/if \(!gone\.length\) return;/.test(UI), "it shows even when everything arrived");
});

t("it gives a slow connection a second chance", () => {
  assert(/setTimeout\(show, 9000\)/.test(UI),
    "one check at load fires while a slow phone is still downloading and cries wolf");
});

// ── 2. The libraries are cached so it stops happening ────────────────────────
t("🔴 the service worker caches the libraries the app cannot start without", () => {
  assert(/url\.origin === "https:\/\/unpkg\.com"/.test(W),
    "the shell is cached and the four things that make it run are not, which is the bug");
  assert(W.indexOf('url.origin === "https://unpkg.com"') < W.indexOf("url.origin !== self.location.origin"),
    "the cross-origin bail-out comes first, so the unpkg rule is dead code");
});

t("🔴 cache FIRST for those, and only those", () => {
  // Pinned versions never change under the same URL, so there is nothing to go stale. The
  // OS's own code keeps network-first, or a deploy would never reach an installed app.
  assert(/caches\.match\(req\)\.then\(\(hit\) => hit \|\| fetch\(req\)/.test(W),
    "network-first on a library means a dropped signal still blanks the app");
  assert(/\.catch\(\(\) => caches\.match\(SHELL\)/.test(W),
    "the app shell must stay network-first so a deploy is never stale");
});

t("🔴 an error response is never cached", () => {
  assert(/res\.ok \|\| res\.type === "opaque"/.test(W),
    "caching a 404 for a library breaks the app permanently, on every future load, offline "
    + "or not");
});

t("the cache version was bumped", () => {
  // Without it, every installed app keeps its old worker and none of this ever activates.
  assert(/CACHE_VERSION = "v71"/.test(W),
    "an installed app keeps the worker it has until the version changes");
});

// ── 3. A render crash must say something too ─────────────────────────────────
t("🔴 a React crash shows a message instead of a blank page", () => {
  assert(/class CrashScreen extends React\.Component/.test(UI), "there is no error boundary");
  assert(/static getDerivedStateFromError/.test(UI), "the boundary cannot actually catch");
  assert(/React\.createElement\(CrashScreen, null, React\.createElement\(AuthGate\)\)/.test(UI),
    "the boundary exists but nothing is rendered inside it");
});

t("the crash screen says what to do, not just what happened", () => {
  assert(/Something in the OS broke/.test(S));
  assert(/Your clients, leads and campaigns are all safe/.test(S),
    "a crash screen that does not say the data is safe is a crash screen that causes panic");
  assert(/Clear and reload/.test(S), "no way out of a phone holding a half-loaded app");
  assert(/Copy details/.test(S), "he cannot send the reason, so the next one costs another hour");
});

t("🔴 Clear and reload actually clears the thing that would be stuck", () => {
  assert(/getRegistrations\(\)/.test(UI) && /r\.unregister\(\)/.test(UI),
    "an installed app keeps the code it booted with, so a plain reload cannot fix it");
  assert(/caches\.keys\(\)/.test(UI) && /caches\.delete\(k\)/.test(UI),
    "the cached shell survives, so the same broken page comes straight back");
});

t("the crash detail is shown, not only logged", () => {
  // A console he does not have is the same as no message at all. That was the whole problem.
  assert(/\{detail\}<\/pre>/.test(UI), "the reason is hidden in a console he will never open");
});

console.log(`✓ verify-white-screen: ${n} checks passed`);
