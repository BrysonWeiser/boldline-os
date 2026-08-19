// Ad copy must never stop mid-thought.
//
// Bryson, 2026-08-19, off a live Meta ad: the description read
//   "Steady roofing leads, not just"
// That is exactly 30 characters and ends on a whole word, so the OLD mid-word fix
// (knowledge/ad-generator.md: "copy was being cut mid-word") did NOT cover it. A whole
// word is not a whole thought.
//
// This suite pins BOTH rules at once, because they pull against each other:
//   1. Nothing over the platform limit may ship (an over-length headline fails the
//      whole Google campaign build).
//   2. Nothing that reads as a fragment may ship either.
// And a third rule that is easy to lose: copy that ALREADY FITS must come back
// untouched. The dangling walk-back is only allowed to run on text that was cut.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fitWords, fitPhrase, fitSentence, cleanMeta, cleanGoogle, cleanCreatives,
  META_TOOL, GOOGLE_TOOL,
} from "../netlify/lib/ad-gen-shared.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; };

// ── The reported bug, exactly as it appeared ────────────────────────────────
t("the reported string no longer ships as a fragment", () => {
  const src = "Steady roofing leads, not just luck";
  assert.equal(fitWords(src, 30), "Steady roofing leads, not just", "precondition: the old trimmer produced the bug");
  assert.equal(fitPhrase(src, 30), "Steady roofing leads");
});

t("the whole Meta variant comes out clean", () => {
  const [v] = cleanMeta({ variants: [{
    awareness: "problem-aware", angle: "a",
    headline: "Stop chasing roofing leads that go nowhere and start",
    primaryText: "Your phone should be ringing.",
    description: "Steady roofing leads, not just luck",
  }] });
  assert.equal(v.description, "Steady roofing leads");
  assert.ok(v.description.length <= 30);
  assert.ok(v.headline.length <= 40);
  assert.ok(!/\b(not|just|and|the|to|your|for|of|with|is|are|but|so|a|an)$/i.test(v.headline),
    `headline ended on a dangling word: ${v.headline}`);
});

// ── Rule 3: text that fits is never edited ─────────────────────────────────
t("copy that already fits is returned byte-for-byte", () => {
  for (const s of [
    "Fast roofers", "Book your free quote", "Roof repair for members only",
    "Call now", "We fix roofs fast", "Storm damage? We fix it",
    // These END on words that are in the dangling list. They fit, so they are
    // complete as written and must not be touched.
    "Tell us what you need", "Leaks we can", "Everything but the",
  ]) {
    assert.equal(fitPhrase(s, 30), s, `edited copy that already fit: ${s}`);
  }
});

// ── Endings that are FINE and must survive ─────────────────────────────────
// A false positive is worse than a false negative here: leaving a slightly plain
// ending only reads plain, whereas deleting a good last word makes copy worse.
t("legitimate sentence endings survive the walk-back", () => {
  const cases = [
    // phrasal-verb particles end the phrase, they do not dangle
    ["Get roof damage checked out now please", 27, "Get roof damage checked out"],
    ["Book your free roof quote now please", 30, "Book your free roof quote now"],
    ["Roof repair for members only this week", 30, "Roof repair for members only"],
    ["Start here and see the difference", 14, "Start here"],
    // and the walk-back does fire on a real dangler right beside them
    ["We handle storm damage too and more", 30, "We handle storm damage too"],
  ];
  for (const [src, max, want] of cases) {
    assert.equal(fitPhrase(src, max), want, `walked back too far on: ${src}`);
  }
});

// ── Never over the limit, never a fragment: swept, not spot-checked ────────
t("no output ever exceeds the limit", () => {
  const words = "we fix your roof leaks fast and the storm damage repair team is on call for emergency service near you today".split(" ");
  for (let max = 8; max <= 60; max++) {
    for (let len = 1; len <= words.length; len++) {
      const out = fitPhrase(words.slice(0, len).join(" "), max);
      assert.ok(out.length <= max, `over limit at max=${max}: ${out}`);
    }
  }
});

t("no trimmed output ends on a word that cannot end a sentence", () => {
  const bad = /\s(a|an|the|this|your|our|their|and|or|but|so|if|when|that|than|of|to|in|on|at|by|for|with|from|about|is|are|was|be|has|have|will|can|not|just|very)$/i;
  const src = "we will fix your roof and the leaks in it because a storm is coming to your area";
  for (let max = 10; max <= 70; max++) {
    const out = fitPhrase(src, max);
    if (out) assert.ok(!bad.test(out), `fragment at max=${max}: "${out}"`);
  }
});

t("a single unfittable word is dropped, not mangled", () => {
  assert.equal(fitPhrase("Weatherproofingspecialists", 10), "");
  assert.equal(fitPhrase("Roofing and", 9), "", "one surviving word is not worth shipping");
});

// ── Google headlines: trimmed, not thrown away ─────────────────────────────
t("an over-length Google headline is trimmed instead of dropped", () => {
  const g = cleanGoogle({
    adGroups: [{
      name: "Emergency", theme: "t", intent: "emergency",
      keywords: [{ text: "emergency roof repair", matchType: "PHRASE" }],
      headlines: [
        "Emergency roof repair available right now and today", // 51, would have been dropped
        "Roof leaking? Call us",
        "Same day roof repair",
        "Free roof inspection",
      ],
      descriptions: ["We fix roof leaks the same day you call.", "Free inspection, no obligation quote."],
    }],
    negativeKeywords: ["jobs"], notes: "n",
  });
  assert.equal(g.adGroups.length, 1, "the ad group survived");
  const hs = g.adGroups[0].headlines;
  assert.ok(hs.every((h) => h.length <= 30), `over-length headline shipped: ${JSON.stringify(hs)}`);
  assert.ok(hs.includes("Emergency roof repair"), `long headline was not salvaged: ${JSON.stringify(hs)}`);
});

t("creative kickers and subs are phrase-safe", () => {
  const [a] = cleanCreatives({ angles: [{
    id: "x", label: "Test", kicker: "For roofers who are tired of chasing", accent: 0,
    head: ["Roof leads", "That answer"],
    sub: "Steady work every single week from people who already want the job done and who are ready to book it in right now",
    why: "w",
  }] });
  assert.ok(a.kicker.length <= 30);
  assert.ok(!/\s(of|are|who|and|to|the)$/i.test(a.kicker), `kicker fragment: ${a.kicker}`);
  assert.ok(a.sub.length <= 90);
  assert.ok(!/\s(to|and|are|who|the)$/i.test(a.sub), `sub fragment: ${a.sub}`);
});

t("fitSentence still prefers a finished sentence", () => {
  assert.equal(
    fitSentence("We fix roofs. Then we clean up after ourselves and leave", 30),
    "We fix roofs.",
  );
});

// ── The prompt has to carry its half of this ───────────────────────────────
// The trimmer is a safety net. The real fix is the model finishing the thought
// inside the limit, so the field descriptions must actually say so.
t("the tool schemas demand a complete thought inside the limit", () => {
  const desc = META_TOOL.input_schema.properties.variants.items.properties.description.description;
  assert.ok(/30 characters/i.test(desc));
  assert.ok(/finished|complete/i.test(desc), "the description field does not require a finished phrase");
  assert.ok(/not|just/i.test(desc), "the description field does not name the dangling-word failure");

  const gh = GOOGLE_TOOL.input_schema.properties.adGroups.items.properties.headlines.description;
  assert.ok(/complete thought/i.test(gh), "Google headlines do not require a complete thought");
});

// ── The OS seeds its own headlines, so it needs the same rule ──────────────
// index.html pre-fills the campaign builder from the client's niche, offer and service
// area before the AI is ever called. Those seeds go into real ads, and a long niche made
// "Commercial Roofing And Restoration Experts" land as "Commercial Roofing And". The
// server-side fix does not reach them, so the browser has its own copy of the walk-back
// and this pins it.
t("the OS trims its own seed headlines to a complete phrase", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const from = src.indexOf("const clWords = (s,max)");
  const to = src.indexOf("\n", src.indexOf("const cl90 = (s) => clPhrase(s,90);"));
  assert.ok(from > 0 && to > from, "could not find the OS trimmer block in index.html");
  const { cl30, cl90 } = new Function(src.slice(from, to) + "\nreturn { cl30, cl90 };")();

  assert.equal(cl30("Commercial Roofing And Restoration Experts"), "Commercial Roofing");
  assert.equal(cl30("Emergency Roof Repair Available Now And Today"), "Emergency Roof Repair");
  // already fits: untouched, including one that ends on a dangling-list word
  assert.equal(cl30("Get Your Free Quote Today"), "Get Your Free Quote Today");
  assert.equal(cl30("Roofers You Can"), "Roofers You Can");
  assert.ok(cl30("Fast Roofing Experts").length <= 30);
  assert.ok(!/\s(and|the|to|for|your|of|is|but)$/i.test(
    cl90("We run Google and Meta ads for commercial roofing contractors so you get a steady flow of brand new customers and")));
});

console.log(`✅ ad copy fit: ${n} checks passed`);
