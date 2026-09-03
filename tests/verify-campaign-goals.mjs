// What a campaign is told to go and buy, and the one rule that makes it safe.
//
// Bryson, 2026-09-02: *"Can you make a way for me to be able to select whether I want an ad
// I'm making to go for leads clicks etc"*.
//
// Until now the goal was INFERRED. A Meta campaign chased leads if a pixel id happened to
// be sitting on the client record and page views otherwise, and Google always used manual
// CPC. That inference is how the house campaign spent $87 on 6,997 page views and zero
// leads while everyone involved believed it was hunting for leads.
//
// 🔴 THE RULE THIS WHOLE SUITE EXISTS TO DEFEND: A GOAL IS NEVER SILENTLY DOWNGRADED.
// Asking for leads without the tracking to count them must FAIL AT BUILD TIME. The
// tempting alternative — quietly fall back to traffic — is strictly WORSE than the
// original bug, because he would have deliberately chosen "Leads", seen a success message,
// and still be buying clicks. A campaign that refuses to build costs nothing. One that
// builds and buys the wrong thing costs money every hour until somebody notices.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GOALS, GOAL_IDS, DEFAULT_GOAL, resolveGoal } from "../netlify/lib/campaign-goals.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// ── 🔴 THE RULE ────────────────────────────────────────────────────────────────
t("asking for leads with no tracking is refused, on both platforms", () => {
  for (const platform of ["meta", "google"]) {
    const r = resolveGoal("leads", { tracking: false, platform });
    assert.ok(r.error, `${platform}: leads was allowed with no tracking`);
    assert.equal(r.goal, undefined, `${platform}: a goal came back alongside the error, so a caller could use it`);
  }
});

t("🔴 and it is refused, not quietly turned into traffic", () => {
  const r = resolveGoal("leads", { tracking: false, platform: "meta" });
  assert.ok(!/traffic/i.test(String(r.goal || "")), "leads was downgraded to traffic instead of refused");
});

t("the refusal says what is missing and where to fix it", () => {
  const m = resolveGoal("leads", { tracking: false, platform: "meta" }).error;
  assert.match(m, /Pixel/i, `the Meta message does not name the pixel: ${m}`);
  assert.match(m, /My Ads/i, `the Meta message does not say which screen: ${m}`);
  assert.match(m, /[Nn]othing was created/, `the message does not say the build was abandoned: ${m}`);

  const g = resolveGoal("leads", { tracking: false, platform: "google" }).error;
  assert.match(g, /conversion tracking/i, `the Google message does not name conversion tracking: ${g}`);
  // 🔴 The two platforms need DIFFERENT instructions. One generic message sends him to the
  // wrong screen, which has already cost an evening this week over two similarly named
  // Netlify sites.
  assert.notEqual(g, m, "both platforms give the same instruction, so one of them is wrong");
  assert.ok(!/Pixel/i.test(g), `the Google message tells him to add a Meta pixel: ${g}`);
});

t("leads WITH tracking goes through", () => {
  assert.deepEqual(resolveGoal("leads", { tracking: true, platform: "meta" }), { goal: "leads" });
  assert.deepEqual(resolveGoal("leads", { tracking: true, platform: "google" }), { goal: "leads" });
});

t("traffic never needs tracking", () => {
  assert.deepEqual(resolveGoal("traffic", { tracking: false, platform: "meta" }), { goal: "traffic" });
});

// ── Silence must keep meaning what it always meant ─────────────────────────────
t("🔴 an unnamed goal defaults to traffic, not leads", () => {
  // client-autobuild builds client campaigns without naming a goal, on live accounts
  // spending real money on their owners' cards. A default of "leads" would make every one
  // of those either fail outright or start optimising for an event the client's site may
  // never fire, without anybody asking for the change.
  assert.equal(DEFAULT_GOAL, "traffic");
  for (const v of ["", "   ", null, undefined]) {
    assert.deepEqual(resolveGoal(v, { tracking: false, platform: "meta" }), { goal: "traffic" },
      "a caller that names no goal was given something other than the old behaviour");
  }
  // And it does NOT fail just because tracking is absent.
  assert.ok(!resolveGoal("", { tracking: false, platform: "google" }).error);
});

t("a goal that is not a goal is refused rather than guessed at", () => {
  for (const v of ["clicks", "sales", "LEADS!", "awareness", "reach", 7, {}]) {
    const r = resolveGoal(v, { tracking: true, platform: "meta" });
    assert.ok(r.error, `nonsense goal accepted: ${String(v)}`);
  }
  // Case and padding are not nonsense, though.
  assert.deepEqual(resolveGoal("  LEADS ", { tracking: true, platform: "meta" }), { goal: "leads" });
});

// ── Meta: the goal has to actually reach the API call ──────────────────────────
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");

t("Meta asks the resolver and stops on its error", () => {
  assert.match(META, /resolveGoal\(p\.goal, \{ tracking: !!pixelId, platform: "meta" \}\)/,
    "meta-ads no longer resolves the goal, so the picker changes nothing");
  assert.match(META, /if \(g\.error\) throw/, "meta-ads ignores the resolver's refusal and builds anyway");
});

t("🔴 the objective and the optimisation goal both follow the choice", () => {
  // Both matter and they fail differently. A campaign with OUTCOME_LEADS but
  // LANDING_PAGE_VIEWS optimisation still buys views; Meta only hunts converters when the
  // ad set is told to, and only counts them when promoted_object names the pixel.
  assert.match(META, /objective: chaseLeads \? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC"/);
  assert.match(META, /optimization_goal: chaseLeads \? "OFFSITE_CONVERSIONS" : "LANDING_PAGE_VIEWS"/);
  assert.match(META, /promoted_object: JSON\.stringify\(\{ pixel_id: pixelId, custom_event_type: "LEAD" \}\)/);
  assert.match(META, /const chaseLeads = g\.goal === "leads"/,
    "chaseLeads is decided by something other than the chosen goal");
});

// ── Google: the goal picks the bidding strategy ────────────────────────────────
const GOOG = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");

t("Google asks the resolver too", () => {
  assert.match(GOOG, /resolveGoal\(p\.goal, \{ tracking: !!p\.hasConversionTracking, platform: "google" \}\)/);
  assert.match(GOOG, /if \(gRes\.error\) throw err\(gRes\.error\)/);
});

t("leads buys conversions and visits buys clicks", () => {
  assert.match(GOOG, /goal === "leads" \? \{ maximizeConversions: \{\} \}/);
  assert.match(GOOG, /\{ targetSpend: \{\} \}/);
});

t("🔴 a caller that names no goal still gets exactly the old bidding", () => {
  // client-autobuild builds live client campaigns without a goal. Re-bidding those because
  // a new control appeared elsewhere in the OS is not a change anybody asked for.
  assert.match(GOOG, /!askedGoal \? \{ manualCpc: \{\} \}/,
    "an unnamed goal no longer keeps manual CPC, so existing client campaigns silently changed how they bid");
  assert.match(GOOG, /const askedGoal = !!String\(p\.goal/,
    "nothing distinguishes 'no goal named' from 'traffic', so the two cannot behave differently");
});

// ── 🔴 THE TWO COPIES ──────────────────────────────────────────────────────────
// The browser cannot import a server module, so the goal list exists twice. This repo has
// been bitten by exactly that shape more than once (the portal, the contract, the package
// catalog), so the browser copy is EXTRACTED from the shipping file and compared, rather
// than a second list being written here and trusted.
t("the OS's goal list is the server's goal list, word for word", () => {
  const m = /const CAMPAIGN_GOALS = (\[[\s\S]*?\n\]);/.exec(S);
  assert.ok(m, "the OS no longer carries a goal list this test can find");
  const browser = new Function(`return ${m[1]}`)();
  assert.deepEqual(browser.map((g) => g.id), GOALS.map((g) => g.id), "the two lists offer different goals");
  for (const g of GOALS) {
    const b = browser.find((x) => x.id === g.id);
    assert.equal(b.label, g.label, `"${g.id}" is labelled differently in the OS than on the server`);
    // 🔴 The blurb is the only explanation he gets of what the button does. If the two
    // drift, the OS is describing behaviour the server does not implement.
    assert.equal(b.blurb, g.blurb, `"${g.id}" is described differently in the OS than on the server`);
  }
});

t("every goal is offered, none is stranded", () => {
  assert.equal(GOAL_IDS.length, GOALS.length);
  assert.ok(GOALS.every((g) => g.label && g.blurb), "a goal is missing its label or its explanation");
  // Reach and awareness are deliberately absent: they buy eyeballs that never visit, which
  // cannot produce a customer for a business paid per job. Pinned so they are not added
  // back without someone reading why they were left out.
  assert.ok(!GOAL_IDS.includes("reach") && !GOAL_IDS.includes("awareness"),
    "an awareness goal was added; it buys views that cannot become a customer");
});

// ── The picker itself ──────────────────────────────────────────────────────────
t("both launch cards show the picker", () => {
  const uses = (S.match(/<GoalPicker value=\{f\.goal\}/g) || []).length;
  assert.equal(uses, 2, `the picker appears on ${uses} launch card(s), not both`);
});

t("both cards send the goal to their function", () => {
  assert.match(S, /goal:f\.goal,\s*hasConversionTracking:/, "the Google card does not send the goal");
  assert.ok(/goal:f\.goal,\n/.test(S), "the Meta card does not send the goal");
});

t("🔴 the Leads option is not hidden when tracking is missing", () => {
  // A control that vanishes teaches nothing. He would be left wondering where the choice
  // went, with no hint that tracking is what brings it back. It stays pickable and the
  // card says what is missing.
  const i = S.indexOf("function GoalPicker");
  const body = S.slice(i, i + 2200);
  // 🔴 Scoped to the block that BUILDS THE BUTTONS, not to the whole component. A first
  // version banned the word "ready" anywhere in the picker and failed on the clean file,
  // because the warning line legitimately reads `!ready`. What must not happen is `ready`
  // deciding which options exist.
  // 🔴 Anchored on "CAMPAIGN_GOALS" alone, not on "CAMPAIGN_GOALS.map". The first version
  // anchored on the map call, so a mutation that inserted a `.filter(...)` before it moved
  // the anchor and the test failed on "could not find the block" instead of on the thing it
  // is meant to catch. A guard that fails for the wrong reason is one edit away from
  // failing for no reason, and the next person deletes it.
  const a = body.indexOf("CAMPAIGN_GOALS");
  const b = body.indexOf("blurb", a);
  assert.ok(a > 0 && b > a, "could not find the block that renders the options");
  const opts = body.slice(a, b);
  assert.ok(!/\bready\b/.test(opts),
    "the list of goals is filtered by `ready`, so the Leads option disappears instead of explaining itself");
  assert.match(body, /value==="leads"&&!ready&&/, "there is no warning when leads is picked without tracking");
});

t("each card's warning names that platform's tracking", () => {
  assert.match(S, /Add the Meta Pixel ID first/, "the Meta card does not say what is missing");
  assert.match(S, /Set up conversion tracking for this client first/, "the Google card does not say what is missing");
});

t("neither card defaults to a goal its own server would refuse", () => {
  // 🔴 A Build button that fails on first press reads as broken software, not as a missing
  // setting. Both cards start on Leads only when the thing that counts a lead is present.
  assert.match(S, /goal: client\.metaPixelId \? "leads" : "traffic"/, "the Meta card's default ignores the pixel");
  assert.match(S, /goal: \(client\.conversionActions && Object\.keys\(client\.conversionActions\)\.length\) \? "leads" : "traffic"/,
    "the Google card's default ignores whether conversion tracking exists");
});

console.log(`✓ verify-campaign-goals: ${n} checks passed`);
