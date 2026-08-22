// Guards the reason the bot chat's message box was invisible (Bryson, 2026-08-22: "when
// I try to chat with the bots I can't see the message box"). KB `sheet-layering`.
//
// The box was always rendered. The fixed bottom nav was painting on top of it, because
// the screen wrapper `.os-content` animates opacity with `fill-mode: both` — which makes
// it a permanent STACKING CONTEXT, so every z-index inside it stopped being comparable
// with the nav's. Two independent fixes, both pinned here:
//   1. `.os-content` uses `backwards` rather than `both`, so the context is released when
//      the fade ends. This is what rescues the centred modals (z-index 200/400) that had
//      the same latent flaw and nobody had noticed yet.
//   2. `Sheet` portals to <body>, so a sheet is outside every screen's stacking context
//      no matter where it is opened from — the durable guarantee, independent of how any
//      given engine treats a filling animation.
//
// The first half also runs the real layering in a headless browser BOTH ways, so the
// claim "this is what fixed it" is measured rather than asserted. A pure regex suite
// could not tell the difference between a fix and a plausible-looking edit.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

// ── 1. The stacking context is released ───────────────────────────────────────
{
  const anim = UI.match(/\.os-content\{animation:osIn [^}]*\}/);
  ok("the screen wrapper still fades in", !!anim);
  ok("it does NOT use fill-mode both, which never releases the stacking context",
    !!anim && !/\bboth\b/.test(anim[0]), anim ? anim[0] : "");
  ok("it uses backwards, which still prevents the first-frame flash",
    !!anim && /\bbackwards\b/.test(anim[0]), anim ? anim[0] : "");
}

// ── 2. Sheets are portalled out of any screen ─────────────────────────────────
{
  const sheet = UI.match(/function Sheet\(\{children[\s\S]*?\n\}/);
  ok("the Sheet component still exists", !!sheet);
  const body = sheet ? sheet[0] : "";
  ok("a sheet renders into <body>, not in place",
    /ReactDOM\.createPortal\(sheet, document\.body\)/.test(body));
  ok("the overlay carries the app typeface, which <body> does not set",
    /fontFamily:APP_FONT/.test(body));
  ok("and the app text colour", /color:C\.text/.test(body));
  ok("APP_FONT is a real font stack", /const APP_FONT = "-apple-system,/.test(UI));
}

// ── 3. The chat bar clears the phone's home indicator ─────────────────────────
{
  ok("the chat bar is tagged for the safe-area rule", /className="os-chatbar"/.test(UI));
  ok("and that rule adds the inset to its bottom padding",
    /\.os-chatbar\{padding-bottom:calc\(20px \+ env\(safe-area-inset-bottom\)\)!important\}/.test(UI));
  // The pinned Save bars already had this; the chat bar was simply missed.
  ok("pinned action bars still have theirs",
    /\.os-sheet-actions\{padding-bottom:calc\(16px \+ env\(safe-area-inset-bottom\)\)!important\}/.test(UI));
}

// ── 4. The bot chat still renders a message box at all ────────────────────────
// The layering fix is worthless if the composer stops being rendered, and the empty
// state on his screenshot looked exactly like "no input exists".
{
  const botChat = UI.match(/\{botTab==="chat"&&\(\s*<>[\s\S]*?<\/>\s*\)\}/);
  ok("the bot sheet's chat tab renders a ChatBar", !!botChat && /<ChatBar /.test(botChat[0]));
  ok("the chat area flexes and the bar does not, so the bar stays pinned",
    !!botChat && /flex:1,overflowY:"auto"/.test(botChat[0]));
  ok("the sheet is a flex column, which is what pins the bar to the bottom",
    /className="os-sheet"[^>]*flexDirection:"column"/.test(UI));
}

// ── 4b. The CSS block is still a valid template literal ───────────────────────
// 🔴 THIS CAUGHT A WHITE SCREEN. The app's stylesheet lives inside a JSX template
// literal, so a single backtick in a CSS comment ends the string early and the whole
// page fails to parse — not a broken style, a blank OS. The first draft of the comment
// explaining the fix above did exactly that. No dependency needed to catch it: the
// style block simply must not contain a backtick.
{
  const style = UI.match(/<style>\{`([\s\S]*?)`\}<\/style>/);
  ok("the app stylesheet is still one template literal", !!style);
  ok("and contains no backtick, which would end it early and blank the app",
    !!style && !style[1].includes("`"));
  // Cheap sanity that the extraction really grabbed the stylesheet and not something else.
  ok("the extracted block is the real stylesheet", !!style && /\.os-sheet\{/.test(style[1]));
}

// ── 5. MEASURED: the fill mode really is what decides who paints on top ────────
// Not a regex. A real browser, the real rule, both ways round. Skipped (not failed)
// when no browser is available, so the suite still runs anywhere.
let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser in this environment */ }

if (chromium) {
  const dir = join(tmpdir(), "bl-sheet-layering");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "repro.html");
  // Mirrors the real structure: a screen wrapper running the app's own keyframes, an
  // overlay inside it, and the fixed bottom nav as a SIBLING of the wrapper.
  writeFileSync(file, `<!doctype html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
@keyframes osIn{from{opacity:0}to{opacity:1}}
.both{animation:osIn .2s ease both}
.backwards{animation:osIn .2s ease backwards}
.nav{position:fixed;bottom:0;left:0;right:0;height:64px;background:#123;z-index:50}
.overlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.5)}
</style></head><body>
<div id="screen" class="both"><div class="overlay" id="overlay"></div></div>
<div class="nav" id="nav"></div>
</body></html>`);

  const browser = await chromium.launch({ executablePath: exe });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("file://" + file);
    const topAt = async (fillMode) => {
      await page.evaluate((c) => { document.getElementById("screen").className = c; }, fillMode);
      await page.waitForTimeout(500);        // let the .2s animation finish and stop filling
      return page.evaluate(() => {
        const el = document.elementFromPoint(195, 820);  // inside the nav's band
        return el ? (el.id || el.className) : "none";
      });
    };
    // The bug, reproduced: with `both` the nav wins even though the overlay asks for 80.
    ok("with fill-mode both the nav paints OVER the overlay (the reported bug)",
      (await topAt("both")) === "nav");
    // The fix, measured.
    ok("with fill-mode backwards the overlay paints over the nav (the fix)",
      (await topAt("backwards")) === "overlay");
  } finally {
    await browser.close();
  }
} else {
  console.log("  (skipped the browser measurement: no Playwright in this environment)");
}

console.log(`verify-sheet-layering: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
