// "Switched on" and "serving right now" are two questions, and each non-serving state means
// something different.
//
// Bryson, 2026-09-04, minutes after pausing the views campaign and raising the budget on the
// leads one, sent a screenshot of a campaign reading **Live · Not delivering**, under:
//   "Meta says this campaign is on, but it isn't serving (in process) — usually the ad set or
//    the ad underneath is paused. Fix it in Meta Ads Manager."
// on a campaign with 786 views and $9.05 of spend.
//
// 🔴 TWO BUGS, AND THE SECOND ONE HAD NOT SURFACED YET.
//
// One: `IN_PROCESS` IS NOT A FAULT. It is Facebook applying an edit, which is the single most
// likely thing to be true straight after changing a budget from the OS, and it clears itself.
// One sentence was shown for EVERY non-serving state, so a normal transient state got the
// explanation for a broken one. A wrong explanation is worse than none: none makes him ask,
// wrong makes him act, and it sent him into Ads Manager hunting a problem that did not exist.
//
// Two: TWO DEFINITIONS OF "LIVE" THAT DISAGREED. The Campaigns screen read the campaign's own
// switch, so it said Live. The hourly snapshot read `effectiveStatus || status`, so within the
// hour the SAME campaign would have appeared in My Ads as **Paused**, under "Not running, so
// it has not been seen by anyone and has spent nothing" — of a campaign seen 786 times that
// had spent real money. Both halves false, from one word being asked to mean two things.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const SYNC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
const AUTO = readFileSync(join(ROOT, "netlify/functions/ads-autopilot.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const LIB = await import("../netlify/lib/meta-status.mjs");

// 🔴 The browser cannot import the lib, so the delivery explanations live in index.html. They
// are extracted and RUN here rather than pattern-matched, because the whole complaint was
// about which sentence appears for which state.
const start = S.indexOf("const META_DELIVERY = {");
assert.ok(start > 0, "the delivery-state table is gone, so this suite is checking nothing");
const end = S.indexOf("// ─── CHANGE ONE CAMPAIGN'S DAILY BUDGET", start);
assert.ok(end > start, "the table's end anchor moved");
const B = new Function(S.slice(start, end) + "\nreturn { META_DELIVERY, metaDelivery, campaignIsOn };")();

// The campaign in the screenshot, as Meta reported it.
const ROOFERS = { id: "1", name: "BoldLine Media — Roofers", status: "ACTIVE",
  effectiveStatus: "IN_PROCESS", platform: "meta", impressions: 786, spend: 9.05, dailyBudget: 14 };

// ── 1. 🔴 THE SCREENSHOT ITSELF ──────────────────────────────────────────────
t("🔴 the campaign in the screenshot is ON", () => {
  assert.equal(LIB.metaOn(ROOFERS), true,
    "a campaign with 786 views and $9 of spend is reported as switched off");
  assert.equal(B.campaignIsOn(ROOFERS), true, "the browser and the server disagree about the same campaign");
});

t("🔴 and it is correctly reported as not serving this minute", () => {
  assert.equal(LIB.metaDelivering(ROOFERS), false, "a campaign Meta says is in process is reported as serving");
});

t("🔴 THE SENTENCE HE WAS SHOWN: 'in process' no longer blames the ad set", () => {
  const d = B.metaDelivery("IN_PROCESS");
  assert.ok(d, "nothing is said at all now, which loses a real signal");
  assert.equal(d.fault, false, "a normal transient state is still coloured and counted as a fault");
  assert.ok(!/ad set/i.test(d.note),
    `it still blames the ad set for a state that has nothing to do with the ad set: ${d.note}`);
  assert.match(d.note, /applying a change/i, "it does not say what is actually happening");
  assert.match(d.note, /clears on its own|within the hour/i,
    "it does not say it fixes itself, so he goes to Ads Manager anyway");
  assert.ok(!/Fix it|fix it/.test(d.note), "it still tells him to go and fix something that is not broken");
});

// ── 2. EVERY OTHER STATE SAYS ITS OWN THING ──────────────────────────────────
t("🔴 the state that DOES mean the ad set is paused still says so", () => {
  const d = B.metaDelivery("ADSET_PAUSED");
  assert.equal(d.fault, true, "a genuinely stopped campaign is no longer flagged");
  assert.match(d.note, /ad set/i, "the one case the old sentence was written for lost its explanation");
  assert.match(d.note, /Meta Ads Manager/, "it does not say where to fix it");
});

t("a rejected ad and a missing payment method are told apart", () => {
  assert.match(B.metaDelivery("DISAPPROVED").note, /rejected/i);
  assert.equal(B.metaDelivery("DISAPPROVED").fault, true);
  assert.match(B.metaDelivery("PENDING_BILLING_INFO").note, /payment method/i);
  assert.equal(B.metaDelivery("PENDING_BILLING_INFO").fault, true);
});

t("review is not a fault either, because waiting is not breaking", () => {
  assert.equal(B.metaDelivery("PENDING_REVIEW").fault, false);
  assert.match(B.metaDelivery("PENDING_REVIEW").note, /reviewing/i);
});

t("nothing is said when there is nothing to say", () => {
  for (const v of ["", null, undefined, "ACTIVE", "active"]) {
    assert.equal(B.metaDelivery(v), null, `a serving campaign is being given a warning (${v})`);
  }
});

t("🔴 a state Facebook invents later still gets an honest line", () => {
  // The old code at least printed the raw status. A table alone would print nothing at all for
  // anything unlisted, which is a silent loss of a real signal.
  const d = B.metaDelivery("SOME_NEW_STATE");
  assert.ok(d, "a blocked state the table does not list now says NOTHING, which is a silent loss of a real signal");
  assert.equal(d.fault, true, "an unknown blocked state is treated as fine");
  assert.match(d.note, /some new state/, "it does not say which state, so it cannot be looked up");
});

t("every explanation is written for someone who does not know the jargon", () => {
  for (const [k, v] of Object.entries(B.META_DELIVERY)) {
    assert.ok(!/effective|status|adset|API/i.test(v.note), `${k} still uses jargon: ${v.note}`);
    assert.ok(!/—|–/.test(v.note), `${k} uses a dash, which he has asked never to appear: ${v.note}`);
    assert.ok(v.chip.length <= 18, `${k}'s chip is too long for a phone row: ${v.chip}`);
  }
});

// ── 3. 🔴 ONE DEFINITION OF "ON", ACROSS SCREENS AND ACROSS THE SERVER ───────
t("🔴 on is the switch, on both platforms and in both places", () => {
  assert.equal(LIB.metaOn({ status: "ACTIVE" }), true);
  assert.equal(LIB.metaOn({ status: "PAUSED", effectiveStatus: "ACTIVE" }), false,
    "a paused campaign is called on because of what is underneath it");
  assert.equal(LIB.googleOn({ status: "ENABLED" }), true);
  assert.equal(LIB.googleOn({ status: "PAUSED" }), false);
  assert.equal(B.campaignIsOn({ status: "ENABLED", platform: "google" }), true);
  assert.equal(B.campaignIsOn({ status: "ACTIVE", platform: "meta" }), true);
  assert.equal(B.campaignIsOn({ status: "PAUSED", platform: "meta" }), false);
});

t("delivering means serving, and a campaign that is off is never serving", () => {
  assert.equal(LIB.metaDelivering({ status: "ACTIVE" }), true, "no reported state should mean the switch stands");
  assert.equal(LIB.metaDelivering({ status: "ACTIVE", effectiveStatus: "ACTIVE" }), true);
  assert.equal(LIB.metaDelivering({ status: "ACTIVE", effectiveStatus: "ADSET_PAUSED" }), false);
  assert.equal(LIB.metaDelivering({ status: "PAUSED" }), false);
});

t("🔴 a snapshot written before the status was kept still reads sensibly", () => {
  // Old rows carry only the flag the server worked out. Falling back to it beats calling every
  // one of them paused.
  assert.equal(B.campaignIsOn({ live: true }), true, "every campaign in an older snapshot becomes paused");
  assert.equal(B.campaignIsOn({ live: false }), false);
  assert.equal(B.campaignIsOn(null), false, "a missing campaign throws instead of reading as off");
});

t("malformed input does not throw anywhere", () => {
  for (const c of [null, undefined, {}, { status: 7 }]) {
    for (const f of [LIB.metaOn, LIB.metaDelivering, LIB.googleOn, B.campaignIsOn]) {
      assert.doesNotThrow(() => f(c), `threw on ${JSON.stringify(c)}`);
    }
  }
});

// ── 4. THE SNAPSHOT STORES BOTH ANSWERS ──────────────────────────────────────
t("🔴 the hourly snapshot marks a campaign live from the SWITCH, not from delivery", () => {
  assert.ok(!/effectiveStatus \|\| c\.status/.test(SYNC),
    "the snapshot still collapses on and serving into one word, which is the bug");
  assert.match(SYNC, /summarize\(await metaCampaigns\(mid\), metaOn, metaDelivering, "spend"\)/,
    "Meta's snapshot does not pass both answers");
  assert.match(SYNC, /summarize\(await gadsCampaigns\(accessToken, gid\), googleOn, googleDelivering, "cost"\)/,
    "Google's snapshot does not pass both answers");
  assert.match(SYNC, /live: isLive\(c\), delivering: isDelivering\(c\)/,
    "each campaign row does not carry both answers");
});

t("🔴 the autopilot deliberately asks the OTHER question, and says why", () => {
  // It moves money between campaigns on performance. A campaign that is on but held up has no
  // performance to judge, so shifting budget into it would be shifting it into nothing.
  assert.match(AUTO, /const metaLive = metaDelivering;/, "the autopilot no longer picks by delivery");
  assert.match(AUTO, /const googleLive = googleDelivering;/, "the Google half drifted from the Meta half");
  assert.match(AUTO, /THIS JOB WANTS "SERVING", NOT "SWITCHED ON", AND THAT IS DELIBERATE/,
    "the difference from ads-sync is unexplained, so the next person will 'fix' one to match the other");
});

// ── 5. BOTH SCREENS SHOW IT ──────────────────────────────────────────────────
t("🔴 the Campaigns screen shows the right state and the right sentence", () => {
  assert.ok(!/usually the ad set or the ad underneath is paused/.test(S),
    "the one-size sentence that blamed the ad set for everything is still on screen");
  assert.match(UI, /const deliveryState=\(r\)=>r\.platform==="meta"&&isOn\(r\)\?metaDelivery\(r\.c\.effectiveStatus\):null;/,
    "the row no longer works out what state it is in");
  assert.match(UI, /\{dstate&&<Chip label=\{dstate\.chip\} color=\{dstate\.fault\?C\.amber:C\.textMuted\} small\/>\}/,
    "every state is still chipped as an amber fault, including the ones that are not");
  assert.match(UI, /\{dstate&&<div style=\{\{fontSize:10,color:dstate\.fault\?C\.amber:C\.textMuted[^}]*\}\}>\{dstate\.note\}<\/div>\}/,
    "the explanation is not rendered, so the chip says a thing with nothing to explain it");
});

t("🔴 and it uses the SAME definition of on as everywhere else", () => {
  assert.match(UI, /const isOn=\(r\)=>campaignIsOn\(\{\.\.\.r\.c,platform:r\.platform\}\);/,
    "this screen has its own private idea of what on means, which is how the two disagreed");
});

t("🔴 My Ads decides on from the switch rather than trusting the stored flag", () => {
  // 🔴 Without this the fix would not reach him until the next hourly check, and the screen he
  // reported from would keep saying the campaign had never run.
  assert.match(UI, /const on = campaignIsOn\(c\);/, "the card still trusts whatever the snapshot flagged");
  assert.match(UI, /return c2\.live===on \? c2 : \{\.\.\.c2,live:on\};/, "the corrected answer is never applied");
});

t("🔴 a campaign that is on but not serving keeps its real numbers", () => {
  // The old row had two branches, so this state had to borrow one, and it borrowed "never ran".
  const i = UI.indexOf("Not running, so it has not been seen by anyone and has spent nothing");
  assert.ok(i > 0, "the paused explanation is gone");
  const branch = UI.slice(Math.max(0, i - 400), i);
  assert.match(branch, /\{!c\.live/, "the never-ran sentence is no longer gated on the campaign being off");
  assert.match(UI, /const dstate = c\.live&&c\.platform==="meta" \? metaDelivery\(c\.effectiveStatus\) : null;/,
    "a running campaign that is not serving says nothing about why");
});

t("the focused campaign explains it too, since that is where he looks at one", () => {
  assert.match(UI, /\{sel&&sel\.live&&sel\.platform==="meta"&&\(\(\)=>\{ const d=metaDelivery\(sel\.effectiveStatus\);/,
    "tapping the campaign gives numbers with no explanation of why they are not moving");
});

console.log(`✓ verify-delivery-states: ${n} checks passed`);
