// Are they running ads? Real answers instead of "couldn't confirm either way".
// Run: node tests/verify-ad-detection.mjs
//
// Bryson, 2026-09-28: *"so far its always said for google and meta ads that it cant confirm either way
// so at this point it is essentially useless to me is there a way we can make it so it can actually
// find out if they are or arent running ads"*.
//
// Three changes, each with the failure it must never commit:
//  1. GOOGLE'S OWN AD RECORD (Ads Transparency Center, via SerpApi). Must never turn an error into a
//     "no": a failed lookup that reads as "not advertising" puts a false claim in his mouth on a call.
//  2. LOOKING INSIDE TAG MANAGER, where most small sites hide their ad tags. Must still never say "no".
//  3. A ONE-TAP CHECK on the Outreach card, one company at a time. Must never run the paid lookup in
//     bulk, which would spend the free month (250 checks) in one tap.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = await import("../netlify/lib/scout-providers.mjs");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const SCOUT = readFileSync(join(ROOT, "netlify/functions/lead-scout.mjs"), "utf8");
const BG = readFileSync(join(ROOT, "netlify/functions/lead-scout-background.mjs"), "utf8");

let n = 0;
const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; } };

const NOW = Date.UTC(2026, 8, 28, 12);
const ts = (daysAgo) => Math.floor((NOW - daysAgo * 864e5) / 1000);
const reply = (body) => async () => ({ ok: true, body });
const rec = (body, site = "https://www.summitpools.com/") => P.googleAdsRecord(site, { apiKey: "k", now: NOW, fetchImpl: reply(body) });

// ── 1. Google's ad record ────────────────────────────────────────────────────────────────
await t("an ad shown 3 days ago means they are running Google ads", async () => {
  const r = await rec({ ad_creatives: [{ last_shown: ts(3) }, { last_shown: ts(60) }] });
  assert.equal(r.state, "yes");
  assert.match(r.note, /last shown 3 days ago/);
});
await t("two weeks is still 'running' (the record lags), fifteen days is not", async () => {
  assert.equal((await rec({ ad_creatives: [{ last_shown: ts(14) }] })).state, "yes");
  assert.equal((await rec({ ad_creatives: [{ last_shown: ts(15) }] })).state, "no");
});
await t("🔴 old ads only = 'no', and WHEN they stopped is kept", async () => {
  const r = await rec({ ad_creatives: [{ last_shown: ts(90) }] });
  assert.equal(r.state, "no");
  assert.equal(r.lastShown.slice(0, 10), new Date((ts(90)) * 1000).toISOString().slice(0, 10));
});
await t("Google's 'no results' answer is a real 'no'", async () => {
  const r = await rec({ error: "Google Ads Transparency Center hasn't returned any results for this query." });
  assert.equal(r.state, "no");
  assert.equal(r.lastShown, "");
});
await t("🔴 every OTHER failure is 'unknown' with the reason, never a silent 'no'", async () => {
  for (const body of [{ error: "Your account has run out of searches." }, { error: "Invalid API key." }]) {
    const r = await rec(body);
    assert.equal(r.state, "unknown", JSON.stringify(body));
    assert.match(r.note, /failed/);
  }
  const down = await P.googleAdsRecord("summitpools.com", { apiKey: "k", now: NOW, fetchImpl: async () => ({ ok: false, error: "timed out" }) });
  assert.equal(down.state, "unknown");
});
await t("no key and no website both say so", async () => {
  assert.match((await P.googleAdsRecord("summitpools.com", { apiKey: "", now: NOW })).note, /not connected/);
  assert.match((await P.googleAdsRecord("", { apiKey: "k", now: NOW })).note, /no website/);
});
await t("🔴 ads pointing at a DIFFERENT website are not theirs", async () => {
  const r = await rec({ ad_creatives: [{ last_shown: ts(2), target_domain: "someoneelse.com" }] });
  assert.equal(r.state, "no");
});
await t("it looks the business up by its WEBSITE, in the US", async () => {
  let asked = "";
  await P.googleAdsRecord("https://www.summitpools.com/contact", { apiKey: "k", now: NOW, fetchImpl: async (u) => { asked = u; return { ok: true, body: {} }; } });
  assert.match(asked, /engine=google_ads_transparency_center/);
  assert.match(asked, /text=summitpools\.com&/);
  assert.match(asked, /region=2840/);
});

// ── 2. How the answers combine ───────────────────────────────────────────────────────────
await t("🔴 Google's record beats the AI, which beats a website tag", () => {
  assert.equal(P.combineAdsState("yes", "likely", { state: "no" }), "no");
  assert.equal(P.combineAdsState("unknown", "unknown", { state: "yes" }), "yes");
  assert.equal(P.combineAdsState("no", "likely", null), "no");
  assert.equal(P.combineAdsState("unknown", "likely", { state: "unknown" }), "likely");
  assert.equal(P.combineAdsState("likely", "unknown", null), "likely");
  assert.equal(P.combineAdsState("unknown", "unknown", null), "unknown");
});
await t("the scout run uses that rule and keeps the date", () => {
  assert.match(BG, /googleAds: combineAdsState\(adsState\(p\.google_ads\), verified\.adTech && verified\.adTech\.googleAds, verified\.googleAdsRecord\)/);
  assert.match(BG, /googleAdsLastSeen: \(verified\.googleAdsRecord && verified\.googleAdsRecord\.lastShown\) \|\| ""/);
  assert.match(BG, /GOOGLE'S OWN AD RECORD/, "the model must be told the record, or it will contradict it in the verdict");
});

// ── 3. Looking inside Tag Manager ────────────────────────────────────────────────────────
const withFetch = async (pages, fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const hit = Object.entries(pages).find(([k]) => String(u).includes(k));
    return hit ? new Response(hit[1], { status: 200 }) : new Response("nope", { status: 404 });
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
};
const HOME = '<html><script src="https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD"></script></html>';
await t("🔴 ad tags hidden inside Tag Manager are found", async () => {
  const r = await withFetch({ "gtm.js?id=GTM-AB12CD": 'x={"function":"__awct","vtp_conversionId":"123"};y="<script>fbq(\\"init\\", \\"999\\")</script>"', "acme.com": HOME },
    () => P.inspectAdTech("acme.com"));
  assert.equal(r.googleAds, "likely");
  assert.equal(r.metaAds, "likely");
  assert.ok(r.evidence.some((e) => /inside Tag Manager GTM-AB12CD/.test(e)), JSON.stringify(r.evidence));
});
await t("🔴 an empty container still never produces a 'no'", async () => {
  const r = await withFetch({ "gtm.js?id=GTM-AB12CD": "x={}", "acme.com": HOME }, () => P.inspectAdTech("acme.com"));
  assert.equal(r.googleAds, "unknown");
  assert.equal(r.metaAds, "unknown");
  assert.match(r.note, /Tag Manager: no advertising tags in either/);
});
await t("an unreadable container falls back to the old honest note", async () => {
  const r = await withFetch({ "acme.com": HOME }, () => P.inspectAdTech("acme.com"));
  assert.equal(r.gtmOnly, true);
});

// ── 4. The one-tap check, and never in bulk ──────────────────────────────────────────────
await t("🔴 the paid lookup only runs for ONE prospect", () => {
  assert.match(SCOUT, /const useRecord = !!id;/);
  assert.match(SCOUT, /useRecord \? googleAdsRecord\(site\)/);
});
await t("a failed lookup never overwrites an earlier real answer", () => {
  assert.match(SCOUT, /const recUse = rec && rec\.state !== "unknown" \? rec : prevRec;/);
  assert.match(SCOUT, /\.\.\.\(rec && rec\.state !== "unknown" \? \{ googleAdsLastSeen/);
});
await t("the endpoint hands the updated company back so the card changes at once", () => {
  assert.match(SCOUT, /\.\.\.\(single \? \{ prospect: single \} : \{\}\)/);
  assert.match(UI, /if\(got&&got\.data\) setQueue\(q=>q\.map\(x=>x\.id===id\?\{\.\.\.x,data:got\.data\}:x\)\);/);
});

// The screen's helpers, RUN.
const helpers = (() => {
  const a = UI.indexOf("const outNeedsGoogleCheck=");
  const b = UI.indexOf("const outFacts=", a);
  assert.ok(a > 0 && b > a, "the card's ad helpers are gone");
  return new Function(UI.slice(a, b) + "return { outNeedsGoogleCheck, outMetaAdsUrl, outGoogleCheckMsg };")();
})();
await t("the button hides for a week after a real answer, and shows otherwise", () => {
  assert.equal(helpers.outNeedsGoogleCheck({ data: {} }), true);
  assert.equal(helpers.outNeedsGoogleCheck({ data: { googleAdsCheckedAt: new Date().toISOString() } }), false);
  assert.equal(helpers.outNeedsGoogleCheck({ data: { googleAdsCheckedAt: new Date(Date.now() - 8 * 864e5).toISOString() } }), true);
});
await t("🔴 the Meta link is the same Ad Library search the scout builds", () => {
  const name = "Summit Peak Pools & Spas";
  assert.equal(helpers.outMetaAdsUrl({ name, data: {} }), P.adLibraryUrl(name));
  assert.equal(helpers.outMetaAdsUrl({ name, data: { adLibraryUrl: "https://x" } }), "https://x");
});
await t("every reason Google could not answer is said as what to do", () => {
  assert.match(helpers.outGoogleCheckMsg("Google ad record not connected (SERPAPI_API_KEY is not set)"), /SerpApi key added in Netlify/);
  assert.match(helpers.outGoogleCheckMsg("Google ad record check failed: Your account has run out of searches."), /used up/);
  assert.match(helpers.outGoogleCheckMsg("no website to look up in Google's ad record"), /No website on file/);
  assert.match(helpers.outGoogleCheckMsg("Google ad record check failed: 500"), /Try again/);
});
await t("the Meta link opens safely, in a new tab", () => {
  assert.match(UI, /<a href=\{outMetaAdsUrl\(cur\)\} target="_blank" rel="noopener noreferrer"/);
});
await t("Lead Scout reports whether the Google record is connected", () => {
  assert.equal(typeof P.providerStatus().googleAdsRecord, "boolean");
});

console.log(`${process.exitCode ? "✗" : "✓"} verify-ad-detection: ${n} checks passed`);
