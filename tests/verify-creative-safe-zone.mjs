// A story creative must keep its footer clear of the platform's own CTA button.
// Run: node tests/verify-creative-safe-zone.mjs
//
// Bryson, 2026-08-20, screenshotting his own live ad on Instagram:
//   "we need to edit the images because the button covers the website url"
//
// He was right, and it was measurable. Both renderers used ONE padding value for the top
// and the bottom of a story (300px), so the footer's baseline sat exactly 300px off the
// bottom edge. Instagram paints its "Learn more" CTA over roughly the bottom 250-450px, so
// the URL line was underneath the button on every single impression.
//
// It only affected the 1080x1920 story size, which is the one placement where the CTA is
// drawn ON the image instead of underneath it. That is why it survived every earlier check:
// the square and portrait creatives were fine, and the overflow guard only ever asked
// whether content spilled OFF the canvas, never whether it landed somewhere unreadable.
//
// TWO RENDERERS DRAW THESE AND BOTH HAD THE BUG:
//   scripts/build-ad-creatives.js   the offline batch (69 files)
//   index.html                       the Ad Creative Studio, which made his live ad
// They are separate code with no shared module, so this pins both.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0; const fails = [];
const t = (name, fn) => { try { fn(); n++; } catch (e) { fails.push(`${name}: ${e.message}`); } };

// Instagram's CTA sticker reaches ~450px up from the bottom of a 1920px story on the
// tallest devices. Anything below this is at risk of being covered.
const MIN_STORY_BOTTOM = 450;

const script = readFileSync(new URL("../scripts/build-ad-creatives.js", import.meta.url), "utf8");
const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const num = (src, re, label) => {
  const m = src.match(re);
  assert.ok(m, `could not find ${label}`);
  return Number(m[1]);
};

t("the offline generator clears the CTA zone", () => {
  const bottom = num(script, /const padBottom = story \? (\d+)/, "padBottom in build-ad-creatives.js");
  assert.ok(bottom >= MIN_STORY_BOTTOM,
    `story footer sits ${bottom}px off the bottom; Instagram's button reaches ${MIN_STORY_BOTTOM}px`);
});

t("the Ad Creative Studio clears it too", () => {
  const bottom = num(os, /const padBottom=Math\.round\(story\?(\d+)/, "padBottom in the Studio canvas");
  assert.ok(bottom >= MIN_STORY_BOTTOM,
    `story footer sits ${bottom}px off the bottom; this is the renderer that made the live ad`);
});

// 🔴 THE ACTUAL BUG WAS ONE VALUE SERVING BOTH ENDS. If a single padY ever comes back, the
// bottom is silently tied to whatever the top needs, and the top wants to be small.
t("top and bottom are separate values, not one shared padding", () => {
  // Comments are stripped first: both files explain the old padY by name, and matching
  // that would fail on prose rather than behaviour. Same trap as the nationwide-targeting
  // assertion earlier today.
  const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.ok(!/\bpadY\b/.test(code(script)), "build-ad-creatives.js still uses a single padY");
  assert.ok(!/\bpadY\b/.test(code(os)), "the Studio still uses a single padY");
  assert.ok(/padTop/.test(script) && /padBottom/.test(script));
  assert.ok(/padTop/.test(os) && /padBottom/.test(os));
});

t("the top is not padded as heavily as the bottom", () => {
  const top = num(script, /const padTop = story \? (\d+)/, "padTop");
  const bottom = num(script, /const padBottom = story \? (\d+)/, "padBottom");
  assert.ok(bottom > top, "the bottom needs more room than the top; the CTA lives there");
});

t("the Studio's footer is measured from the bottom padding", () => {
  assert.ok(/const footBase=h-padBottom;/.test(os),
    "the footer must sit above padBottom, or the split value achieves nothing");
});

t("the logo row still uses the top padding", () => {
  assert.ok(/ctx\.drawImage\(o\.logo,padX,padTop,/.test(os));
  assert.ok(/const zoneTop=padTop\+logoS/.test(os));
});

// Non-story sizes were never affected and must not be disturbed: on those placements the
// CTA sits BELOW the image, so extra bottom padding would just waste canvas.
t("square, portrait and landscape padding is unchanged", () => {
  assert.ok(/wide \? 58 : 96/.test(script), "the non-story values changed");
  assert.ok(/wide\?58:96/.test(os), "the Studio's non-story values changed");
});

console.log(fails.length ? `✕ ${fails.length} failed, ${n} passed\n  ` + fails.join("\n  ")
  : `✓ verify-creative-safe-zone: ${n} checks passed`);
process.exit(fails.length ? 1 : 0);
