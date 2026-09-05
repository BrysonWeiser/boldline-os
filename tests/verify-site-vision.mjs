// Looking at the page, not just reading its source.
//
// Bryson, 2026-09-04, after the audit told a roofing company they had no contact form when one
// sat at the bottom of their homepage: *"Is there a way we can also have the ai visually look
// at the site too not just the code that way we hit every possible angle"*.
//
// 🔴 READING THE HTML IS NOT SEEING THE PAGE. Our inspection fetches the first HTML response.
// Wix, Squarespace, GoDaddy, Webflow and every React site assemble most of what a person sees
// AFTERWARDS, in the browser. The check was reading a skeleton and describing it as the house.
//
// Google PageSpeed loads the page in a real Chrome and hands back a screenshot of the finished
// result plus Lighthouse's own measurements. Two things at once: the model can look at the
// page, and the report can say "the main content takes 4.2 seconds to appear on a phone"
// instead of our guess that the page "seems heavy".
//
// 🔴 AND IT HAS TO SAY WHETHER IT ACTUALLY RAN. A visual check that quietly does nothing is
// worse than not having one, because the report goes out sounding exactly as confident.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = readFileSync(join(ROOT, "netlify/functions/lead-leak-audit-background.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };
const ta = async (name, fn) => { await fn(); n++; };

const V = await import("../netlify/lib/site-vision.mjs");

const b64 = (len) => "A".repeat(len);
const shotUri = (type = "jpeg", len = 100) => `data:image/${type};base64,${b64(len)}`;
const lh = (o = {}) => ({
  categories: { performance: { score: 0.42 }, seo: { score: 0.91 }, accessibility: { score: 0.8 } },
  audits: {
    "largest-contentful-paint": { displayValue: "4.2 s" },
    "first-contentful-paint": { displayValue: "1.8 s" },
    "cumulative-layout-shift": { displayValue: "0.31" },
    "total-blocking-time": { displayValue: "820 ms" },
    "total-byte-weight": { displayValue: "6,140 KiB" },
    "final-screenshot": { details: { data: shotUri("jpeg", 50) } },
  },
  fullPageScreenshot: { screenshot: { data: shotUri("jpeg", 200), width: 412, height: 4800 } },
  ...o,
});

// ── 1. 🔴 THE WHOLE PAGE, BECAUSE THE FORM WAS BELOW THE FOLD ────────────────
t("🔴 the full page is preferred, since the thing that started this was below the fold", () => {
  const s = V.pickScreenshot(lh());
  assert.equal(s.kind, "full page", "only the first screenful is sent, which is where the bug came from");
  assert.equal(s.data.length, 200);
  assert.equal(s.mediaType, "image/jpeg");
});

t("🔴 but an enormous page falls back rather than being dropped or refused", () => {
  const tall = V.pickScreenshot(lh({ fullPageScreenshot: { screenshot: { data: shotUri("jpeg", 200), width: 412, height: 40000 } } }));
  assert.equal(tall.kind, "first screenful", "a very long page sends nothing at all, or blows the size limit");
  const heavy = V.pickScreenshot(lh({ fullPageScreenshot: { screenshot: { data: shotUri("jpeg", V.MAX_SHOT_BYTES + 10), width: 412, height: 900 } } }));
  assert.equal(heavy.kind, "first screenful", "an oversized image is sent and the whole request fails");
});

t("nothing usable returns nothing, rather than something broken", () => {
  assert.equal(V.pickScreenshot({}), null);
  assert.equal(V.pickScreenshot(null), null);
  assert.equal(V.pickScreenshot({ fullPageScreenshot: { screenshot: { data: "not a data uri" } } }), null);
});

t("the image type is READ, not assumed", () => {
  // Lighthouse has shipped JPEG and WebP over the years. Sending the wrong type is a rejected
  // request, and the report would silently lose its picture.
  assert.equal(V.parseDataUri(shotUri("webp")).mediaType, "image/webp");
  assert.equal(V.parseDataUri(shotUri("png")).mediaType, "image/png");
  assert.equal(V.parseDataUri("data:image/jpg;base64,AAAA").mediaType, "image/jpeg", "image/jpg is not a real media type");
  assert.equal(V.parseDataUri("data:text/html;base64,AAAA"), null, "a non-image is passed through as an image");
  assert.equal(V.parseDataUri("javascript:alert(1)"), null);
});

// ── 2. REAL NUMBERS INSTEAD OF OUR GUESS ─────────────────────────────────────
t("the measurements come back in words a business owner can act on", () => {
  const lines = V.metricLines({ ok: true, metrics: V.readMetrics(lh()) });
  const all = lines.join("\n");
  assert.match(all, /42 out of 100/, "the speed score is missing");
  assert.match(all, /4\.2 s/, "how long the page takes to show up is missing");
  assert.ok(!/LCP|CLS|TBT|Lighthouse/.test(all), `jargon reached the writer: ${all}`);
});

t("🔴 a missing measurement never becomes a claim", () => {
  const bare = V.readMetrics({ categories: {}, audits: {} });
  assert.equal(bare.performance, null);
  assert.equal(bare.largestPaint, null);
  assert.deepEqual(V.metricLines({ ok: true, metrics: bare }), [],
    "an empty report produces sentences about numbers nobody measured");
  assert.deepEqual(V.metricLines({ ok: false, note: "x" }), [], "a failed look still produces findings");
});

// ── 3. 🔴 IT SAYS WHETHER IT RAN, EVERY TIME ─────────────────────────────────
await ta("🔴 no key means it says so, not that it quietly does nothing", async () => {
  const r = await V.lookAtSite("https://x.com", { key: "" });
  assert.equal(r.ok, false);
  assert.equal(r.skipped, true);
  assert.match(r.note, /no PageSpeed key/, "the report would go out sounding just as sure of itself");
});

await ta("rate limiting is named, because it is the most likely failure", async () => {
  const r = await V.lookAtSite("https://x.com", { key: "k", fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(r.ok, false);
  assert.match(r.note, /rate limiting/, `unhelpful: ${r.note}`);
});

await ta("🔴 a thrown error, a timeout and rubbish JSON all fail soft", async () => {
  // A report without a picture is the report we sent yesterday. A crash is no report at all.
  const boom = await V.lookAtSite("https://x.com", { key: "k", fetchImpl: async () => { throw new Error("socket hang up"); } });
  assert.equal(boom.ok, false);
  assert.match(boom.note, /socket hang up/);
  const empty = await V.lookAtSite("https://x.com", { key: "k", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(empty.ok, false);
  assert.match(empty.note, /no report came back/);
  for (const bad of [null, undefined, ""]) {
    const r = await V.lookAtSite(bad, { key: "k" });
    assert.equal(r.ok, false, `threw or claimed success on ${JSON.stringify(bad)}`);
  }
});

await ta("a good run reports what it looked at", async () => {
  const r = await V.lookAtSite("https://x.com", { key: "k", fetchImpl: async () => ({ ok: true, json: async () => ({ lighthouseResult: lh() }) }) });
  assert.equal(r.ok, true);
  assert.equal(r.screenshot.kind, "full page");
  assert.equal(r.metrics.performance, 42);
  assert.match(r.note, /looked at the full page/);
});

await ta("🔴 the key is sent, or every call is the 429 we already hit", async () => {
  let seen = "";
  await V.lookAtSite("https://x.com", { key: "SECRET", fetchImpl: async (u) => { seen = String(u); return { ok: true, json: async () => ({ lighthouseResult: lh() }) }; } });
  assert.match(seen, /key=SECRET/, "the request goes out keyless and Google rate limits it immediately");
  assert.match(seen, /strategy=mobile/, "it measures the desktop page, which is not where the customers are");
});

// ── 4. IT IS ACTUALLY WIRED INTO THE REPORT ──────────────────────────────────
t("🔴 the picture is sent to the writer as an image, not described in words", () => {
  assert.match(BG, /\{ type: "image", source: \{ type: "base64", media_type: shot\.mediaType, data: shot\.data \} \}/,
    "the screenshot is fetched and never actually looked at");
  assert.match(BG, /const vision = await lookAtSite\(/, "nothing ever looks at the page");
  assert.match(BG, /generateReport\(site, vision\)/, "the look is taken and thrown away");
});

t("🔴 the screenshot beats the page source, and the prompt says so", () => {
  // Without this the model has two accounts of the same page and no rule for which to trust,
  // which is how it wrote "you have no contact form" in the first place.
  assert.match(BG, /WHEN A SCREENSHOT IS ATTACHED, IT IS THE TRUTH AND THE PAGE SOURCE IS NOT/,
    "the model is given a picture and no reason to prefer it");
  assert.match(BG, /THE SCREENSHOT WINS/, "the facts block does not say which source to believe");
});

t("🔴 and with NO screenshot the old caution stays at full strength", () => {
  assert.match(BG, /no screenshot this time \(\$\{\(vision && vision\.note\) \|\| "the visual check did not run"\}\)/,
    "a failed look is invisible to the writer, which is the most dangerous state of all");
  assert.match(BG, /you are working from the page source alone and must be correspondingly careful/,
    "without a picture it writes with the confidence of having one");
  assert.match(BG, /NEVER TELL THEM SOMETHING IS MISSING FROM THEIR SITE/,
    "the absence rule was dropped once a screenshot existed, so a failed look reopens the bug");
});

t("what happened is recorded on the lead, so the first real run tells us plainly", () => {
  assert.match(BG, /auditLooked: vision\.note/,
    "whether anybody looked at the page is nowhere on the record, so a silent failure stays silent");
  assert.match(BG, /console\.log\("lead-leak-audit vision:", vision\.note\)/, "nothing is logged either");
});

console.log(`✓ verify-site-vision: ${n} checks passed`);
