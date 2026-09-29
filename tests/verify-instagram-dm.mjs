// Instagram DM mode: find the handle, open it, write the DM, send it by hand.
// Run: node tests/verify-instagram-dm.mjs
//
// Bryson, 2026-09-28: *"make a section in the os that'll search instagram for those kinds of niches and
// give me a dm to copy and paste"*, then *"build what you think we should do for instagram dm"*.
// Instagram gives tools no search and no way to START a conversation, and automated DMs get accounts
// banned, so: handles come from the business's own website (free) or from him, DMs are written here,
// and he sends them himself in the app. What this suite protects:
//  1. A link to a POST or a REEL is never mistaken for their account.
//  2. The DM writer is fed the fields prospects actually have (it was reading ones that do not exist).
//  3. Nothing in the OS ever sends a DM.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const UI = read("index.html");
const IG = await import("../netlify/lib/instagram.mjs");
const P = await import("../netlify/lib/scout-providers.mjs");
const DR = await import("../netlify/functions/outreach-draft.mjs");
const DRAFT_SRC = read("netlify/functions/outreach-draft.mjs");
const OUT_SRC = read("netlify/functions/outreach.mjs");
const SCOUT_SRC = read("netlify/functions/lead-scout.mjs");
const BG_SRC = read("netlify/functions/lead-scout-background.mjs");

let n = 0;
const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; } };

// ── 1. Reading a handle ─────────────────────────────────────────────────────────────────
await t("every way a handle gets pasted comes out the same", () => {
  for (const v of ["@SummitPools", "summitpools", "https://www.instagram.com/summitpools/", "instagram.com/summitpools?igsh=abc", "http://instagram.com/SummitPools"])
    assert.equal(IG.normInstagram(v), "summitpools", v);
});
await t("🔴 links to posts, reels and Instagram's own pages are NOT an account", () => {
  for (const v of ["https://www.instagram.com/p/Cx12/", "instagram.com/reel/abc", "instagram.com/explore", "instagram.com/accounts/login", "instagram"])
    assert.equal(IG.normInstagram(v), "", v);
});
await t("junk is refused rather than stored", () => {
  for (const v of ["", "a..b", ".abc", "abc.", "has space", "x".repeat(31)]) assert.equal(IG.normInstagram(v), "", v);
});
await t("🔴 on a page, the first PROFILE link wins, even after a post link", () => {
  const html = '<a href="https://www.instagram.com/p/Cx1/">post</a> <a href="https://instagram.com/summitpools/">Follow us</a>';
  assert.equal(IG.extractInstagram(html), "summitpools");
  assert.equal(IG.extractInstagram("<p>no social links</p>"), "");
});
await t("the profile URL is built from the clean handle", () => {
  assert.equal(IG.instagramUrl("@Summit_Pools"), "https://www.instagram.com/summit_pools/");
  assert.equal(IG.instagramUrl("instagram.com/p/x"), "");
});

// ── 2. Where handles come from ──────────────────────────────────────────────────────────
await t("🔴 the free homepage scan returns their Instagram", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html><footer><a href="https://www.instagram.com/summitpools/">IG</a></footer></html>', { status: 200 });
  try { const r = await P.inspectAdTech("summitpools.com"); assert.equal(r.instagram, "summitpools"); }
  finally { globalThis.fetch = real; }
});
await t("new scout results store it", () => assert.match(BG_SRC, /instagram: \(verified\.adTech && verified\.adTech\.instagram\) \|\| "",/));
await t("🔴 the free bulk re-check fills it in for the existing list, never overwriting one he typed", () => {
  assert.match(SCOUT_SRC, /instagram: d\.instagram \|\| \(tech && tech\.instagram\) \|\| "",/);
  assert.match(SCOUT_SRC, /instagram: withIg/);
});
await t("he can add or fix one himself, cleaned on the server", () => {
  assert.match(OUT_SRC, /if \(action === "instagram"\)/);
  assert.match(OUT_SRC, /const handle = normInstagram\(raw\);/);
  assert.match(OUT_SRC, /if \(raw && !handle\) return json\(\{ ok: false, error: "That does not look like an Instagram handle/);
});

// ── 3. The DM writer gets real facts ────────────────────────────────────────────────────
const PROSPECT = { name: "Summit Pools", niche: "Pool Construction", area: "Mesa, AZ", notes: "call after 3",
  data: { ownerName: "Dave", rating: "4.8", reviewCount: 62, googleAds: "no", googleAdsLastSeen: "2026-06-30T00:00:00Z",
    metaAds: "unknown", instagram: "summitpools", yearsInBusiness: "since 2019", gaps: ["No remodel page"], services: ["Remodels"] } };
await t("🔴 reviews, ads, years, gaps, services and his own notes reach the writer", () => {
  const L = DR.researchLines(PROSPECT).join("\n");
  for (const want of ["4.8 stars from 62 reviews", "ran Google ads until 2026-06 and stopped", "since 2019", "No remodel page", "Remodels", "call after 3", "@summitpools"])
    assert.ok(L.includes(want), `missing: ${want}\n${L}`);
});
await t("🔴 it no longer reads fields no prospect has", () => {
  assert.doesNotMatch(DRAFT_SRC, /d\.runningAds|d\.scoreFactors|d\.summary \|\||add\("Reviews", d\.reviews/);
});
await t("an unknown ad status is left out rather than guessed", () => {
  assert.ok(!DR.researchLines(PROSPECT).some((l) => /^Facebook and Instagram ads:/.test(l)));
});
await t("🔴 'tried calling' is only offered when he really did call", () => {
  assert.ok(DR.researchLines(PROSPECT, { callsTried: 2 }).some((l) => /already called them 2 times/.test(l)));
  assert.ok(!DR.researchLines(PROSPECT, { callsTried: 0 }).some((l) => /called/.test(l)));
  assert.match(UI, /callsTried:touches\.filter\(t=>t\.prospect_id===cur\.id&&t\.channel==="call"\)\.length/);
});
await t("the writer does not stall thinking, and tries the second model on any failure but billing", () => {
  assert.match(DRAFT_SRC, /max_tokens: 6000, \.\.\.\(model === "claude-sonnet-5" \? \{ thinking: \{ type: "disabled" \} \} : \{\}\)/);
  assert.match(DRAFT_SRC, /if \(\/credit\|balance\|quota\|insufficient\/i\.test\(m\)\) break;/);
});

// ── 4. The screen ───────────────────────────────────────────────────────────────────────
const H = (() => {
  const a = UI.indexOf("const outIg=");
  const b = UI.indexOf("// Google has answered within the last week", a);
  assert.ok(a > 0 && b > a, "the Instagram helpers are gone");
  return new Function(UI.slice(a, b) + "return { outIg, outIgUrl, outIgSearch };")();
})();
await t("the screen reads the stored handle and opens the profile", () => {
  assert.equal(H.outIg({ data: { instagram: "summitpools" } }), "summitpools");
  assert.equal(H.outIg({ data: {} }), "");
  assert.equal(H.outIgUrl("summitpools"), "https://www.instagram.com/summitpools/");
});
await t("'Find it' searches Instagram for the business by name and city", () => {
  const u = decodeURIComponent(H.outIgSearch({ name: "Summit Pools", data: { city: "Mesa", state: "AZ" } }));
  assert.match(u, /site:instagram\.com "Summit Pools" Mesa AZ/);
});
await t("DM mode shows Open, Find it, add-your-own, and Next with Instagram", () => {
  assert.match(UI, /Open @\{ig\} in Instagram ↗/);
  assert.match(UI, />Find it ↗</);
  assert.match(UI, /placeholder="Paste their profile link or @handle"/);
  assert.match(UI, />Next with Instagram →</);
});
await t("🔴 no DMs are written for a company with nowhere to send them", () => {
  assert.match(UI, /disabled=\{drafting\|\|\(channel==="dm"&&!ig\)\}/);
});
await t("'Next with Instagram' skips companies without one and wraps round", () => {
  assert.match(UI, /for\(let k=1;k<=queue\.length;k\+\+\)\{ const j=\(i\+k\)%queue\.length; if\(outIg\(queue\[j\]\)\)/);
});
await t("every Instagram and search link opens safely in a new tab", () => {
  assert.match(UI, /<a href=\{outIgUrl\(ig\)\} target="_blank" rel="noopener noreferrer"/);
  assert.match(UI, /<a href=\{outIgSearch\(cur\)\} target="_blank" rel="noopener noreferrer"/);
});

// ── 5. 🔴 Nothing sends ─────────────────────────────────────────────────────────────────
await t("🔴 no code anywhere calls an Instagram or Messenger send endpoint", () => {
  for (const [name, src] of [["outreach", OUT_SRC], ["outreach-draft", DRAFT_SRC], ["lead-scout", SCOUT_SRC], ["index.html", UI]])
    assert.doesNotMatch(src, /graph\.(facebook|instagram)\.com\/[^"'`\s]*\/messages|\/me\/messages|instagram_manage_messages/, name);
});

console.log(`${process.exitCode ? "✗" : "✓"} verify-instagram-dm: ${n} checks passed`);
