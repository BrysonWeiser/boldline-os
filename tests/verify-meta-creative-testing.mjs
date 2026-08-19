// Automatic Meta creative testing. Run: node tests/verify-meta-creative-testing.mjs
//
// Bryson, 2026-08-19: "I want it to automatically improve the meta ad."
//
// WHY THIS SUITE IS LONGER THAN THE FEATURE. This is the second thing in the whole OS
// allowed to CHANGE a live ad account on its own, and the first to do it on Meta. It
// runs unattended every two hours against an account with a real card attached. The
// failure modes are not "a page looks wrong", they are "money was spent differently
// than anyone chose".
//
// So three properties get asserted hard, and each is proved to fail when broken:
//
//   1. THE FOUNDING INVARIANT. "May always spend LESS. May NEVER spend more without
//      asking." The Meta path may add a creative and pause a creative. It must never
//      create a campaign, create an ad set, enable something that was paused, or touch
//      a budget. Adding an ad is safe ONLY because budget lives on the campaign or the
//      ad set, never on the ad.
//   2. THE JUDGING MATHS. A wrong winner pauses the ad that was working. Exercised
//      against the REAL exported function, not a copy — a re-implementation here would
//      drift from the thing that actually runs and pass while production was wrong.
//   3. THE TIER GATE. Meta has BoldLine on Development tier, so writes are permitted
//      only to accounts BoldLine owns. Running against a client account would fail
//      every two hours forever and alert every time.
//
// No network: everything is either a pure function or a source-level assertion.

import { readFileSync } from "node:fs";
import { judgeSplit } from "../netlify/functions/ads-autopilot.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const auto = readFileSync("netlify/functions/ads-autopilot.mjs", "utf8");
const meta = readFileSync("netlify/functions/meta-ads.mjs", "utf8");

// The block that does the work, sliced so assertions cannot accidentally be satisfied
// by the Google path sitting above it.
const metaBlock = (() => {
  const i = auto.indexOf("// ── 5. META CREATIVE TESTING");
  const j = auto.indexOf("// ── persist + tell the owner ──", i);
  return i >= 0 && j > i ? auto.slice(i, j) : "";
})();
ok("the Meta creative-testing block exists", metaBlock.length > 1000, `${metaBlock.length} chars`);

// ── 1. 🔴 THE FOUNDING INVARIANT ────────────────────────────────────────────
// Read off the SOURCE of the Meta block, because this is about what the code is
// capable of doing, not what it happens to do on one input.
{
  // Everything that would raise a bill, listed by the name it would have to be called by.
  for (const forbidden of [
    "metaSetBudget",      // would change what an ad set or campaign spends
    "createCampaign",     // would create a new campaign
    "metaCampaigns(",     // (read helper — must not be re-read mid-write)
    "adsets",             // would create an ad set
    "dailyBudget",        // would touch a budget field
    "lifetime_budget",
  ]) {
    ok(`the Meta test block never mentions ${forbidden}`, !metaBlock.includes(forbidden),
      "adding an ad is budget-neutral ONLY while nothing here can move budget");
  }
  // It may pause an AD. It must never pause or enable a CAMPAIGN here.
  ok("the Meta test block pauses ads, not campaigns", metaBlock.includes("metaSetAdStatus"));
  ok("the Meta test block never sets a campaign status", !metaBlock.includes("metaSetStatus("));
  // The only status it may ever write on a loser is PAUSED.
  const statuses = [...metaBlock.matchAll(/metaSetAdStatus\([^,]+,\s*"([A-Z]+)"\)/g)].map((m) => m[1]);
  eq("the only status written to a losing ad is PAUSED", [...new Set(statuses)].join(","), "PAUSED");

  // The new ad is created ACTIVE — deliberately, since a challenger that never runs is
  // not a test — but it lands inside an ad set that is ALREADY live, so nothing that was
  // off gets switched on. That reasoning has to be written down where the code is.
  ok("the challenger is created ACTIVE", /status: "ACTIVE"/.test(metaBlock));
  ok("and the block explains why that is still safe",
    /already live|already spending|enables nothing/i.test(metaBlock + meta));

  // The API helper itself must be incapable of raising a bill.
  const addFn = meta.slice(meta.indexOf("export async function addAdToAdset"),
                           meta.indexOf("// ── Guarded write: campaign daily budget"));
  ok("addAdToAdset exists", addFn.length > 200);
  for (const forbidden of ["daily_budget", "lifetime_budget", "/campaigns", "/adsets"]) {
    ok(`addAdToAdset never posts ${forbidden}`, !addFn.includes(forbidden),
      "it may only create a creative and an ad inside an EXISTING ad set");
  }
  ok("addAdToAdset posts to the ads edge", addFn.includes("/ads"));
  ok("addAdToAdset posts to the adcreatives edge", addFn.includes("/adcreatives"));
  ok("addAdToAdset requires an existing adsetId", /adsetId required/.test(addFn));
  // A link ad with no image is rejected by Meta. Failing early beats a 400 three calls in.
  ok("addAdToAdset refuses without an image", /imageHash required/.test(addFn));

  ok("setAdStatus only accepts ACTIVE or PAUSED",
    /\["ACTIVE", "PAUSED"\]\.includes\(st\)/.test(meta));
}

// ── 2. 🔴 THE TIER GATE ─────────────────────────────────────────────────────
{
  // Pinned to the GATE CONDITION itself, not to any mention of `cl.internal`. The first
  // version of this assertion matched `systemFor(!!cl.internal)` inside the prompt call
  // and therefore passed with the gate deleted — a test that could not fail, guarding the
  // one thing that would have Meta rejecting writes every two hours forever.
  ok("Meta creative testing is gated to owned accounts",
    /if \(ap\.splitTest !== false && mid && cl\.internal &&/.test(metaBlock),
    "Development tier refuses writes to accounts BoldLine does not own");
  ok("the gate is findable by name for the day it is removed", /META-TIER-GATE/.test(auto));
  ok("and the removal instruction is written down", /delete/i.test(auto.slice(auto.indexOf("META-TIER-GATE") - 900, auto.indexOf("META-TIER-GATE") + 300)));
  // The Google path must NOT have picked up the same restriction by accident.
  const googleBlock = auto.slice(auto.indexOf("if (ap.splitTest !== false && gid"), auto.indexOf("// ── 5. META CREATIVE TESTING"));
  ok("Google split testing is NOT gated to internal accounts", !/&& cl\.internal/.test(googleBlock),
    "Google has standard access and works for every client");
  // Both honour the same per-client opt-out.
  ok("Meta testing honours the splitTest opt-out", /ap\.splitTest !== false/.test(metaBlock));
}

// ── 3. 🔴 THE JUDGING MATHS, against the real function ──────────────────────
const ad = (id, { imps = 1000, clicks = 60, conv = 0, leads = 0 } = {}) =>
  ({ id, impressions: imps, clicks, conversions: conv, leads });

{
  const G = { minClicks: 30, minLift: 0.25, convKey: "conversions" };
  const M = { minClicks: 50, minLift: 0.30, convKey: "leads" };

  // Not enough evidence is a REFUSAL, not a coin flip.
  eq("one ad cannot win a test", judgeSplit([ad("a", { conv: 9 })], G), null);
  eq("no ads is not a crash", judgeSplit([], G), null);
  eq("undefined is not a crash", judgeSplit(undefined, G), null);
  eq("an ad under the click floor is not judged",
    judgeSplit([ad("a", { clicks: 29, conv: 9 }), ad("b", { clicks: 200, conv: 1 })], G), null);
  eq("Meta's higher click floor is enforced",
    judgeSplit([ad("a", { clicks: 49, leads: 9 }), ad("b", { clicks: 200, leads: 1 })], M), null);
  ok("but Meta judges at exactly its floor",
    !!judgeSplit([ad("a", { clicks: 50, leads: 9 }), ad("b", { clicks: 50, leads: 1 })], M));

  // THE RULE THAT MATTERS MOST: conversions beat clicks whenever conversions exist.
  // An ad with a great click rate and no leads must never beat one with leads.
  {
    const clickBait = ad("bait", { imps: 1000, clicks: 300, leads: 0 });
    const converter = ad("real", { imps: 1000, clicks: 60, leads: 12 });
    const v = judgeSplit([clickBait, converter], M);
    ok("a converting ad beats a click-bait ad", !!v && v.win.id === "real",
      v ? `winner was ${v.win.id}` : "no verdict");
    eq("and the verdict says it judged on conversions", v && v.anyConv, true);
  }
  // With NO conversions anywhere, click-through is the only signal left.
  {
    const v = judgeSplit([ad("a", { imps: 1000, clicks: 200 }), ad("b", { imps: 1000, clicks: 60 })], M);
    ok("with no conversions, the higher click rate wins", !!v && v.win.id === "a");
    eq("and the verdict says it judged on clicks", v && v.anyConv, false);
  }

  // The noise threshold. A 20% lift must not pause anything at a 30% threshold.
  {
    eq("a 20% lift is inside Meta's noise threshold",
      judgeSplit([ad("a", { clicks: 60, leads: 12 }), ad("b", { clicks: 60, leads: 10 })], M), null);
    ok("a 60% lift is decisive",
      !!judgeSplit([ad("a", { clicks: 60, leads: 16 }), ad("b", { clicks: 60, leads: 10 })], M));
    // Google's threshold is looser, so there is a band where the SAME numbers decide on
    // Google and are refused on Meta. 13/100 vs 10/100 is a lift of exactly 30%: over
    // Google's 25% bar, and exactly ON Meta's 30% bar — which the strict comparison
    // treats as not beaten, so it also pins that boundary.
    ok("a 30% lift is decisive at Google's looser threshold",
      !!judgeSplit([ad("a", { clicks: 100, conv: 13 }), ad("b", { clicks: 100, conv: 10 })], G));
    eq("but exactly 30% is refused at Meta's threshold (strictly greater, not equal)",
      judgeSplit([ad("a", { clicks: 100, leads: 13 }), ad("b", { clicks: 100, leads: 10 })], M), null);
  }

  // Degenerate inputs that must not pause a live ad.
  eq("two identical ads produce no verdict",
    judgeSplit([ad("a", { clicks: 60, leads: 5 }), ad("b", { clicks: 60, leads: 5 })], M), null);
  eq("zero impressions on both is not a division-by-zero winner",
    judgeSplit([ad("a", { imps: 0, clicks: 60 }), ad("b", { imps: 0, clicks: 60 })], M), null);
  {
    // A loser scoring exactly zero is beatable — otherwise an ad delivering nothing
    // would be immortal, which is the opposite of the point.
    const v = judgeSplit([ad("a", { clicks: 60, leads: 6 }), ad("b", { clicks: 60, leads: 0 })], M);
    ok("an ad with zero conversions can be beaten", !!v && v.lose.id === "b");
  }
  // The reported click count is the pair's, and it is what the owner alert quotes.
  {
    const v = judgeSplit([ad("a", { clicks: 80, leads: 16 }), ad("b", { clicks: 60, leads: 4 })], M);
    eq("the verdict reports the combined clicks", v && v.clicks, 140);
  }
}

// ── 4. The challenger is a real test, not a reworded twin ───────────────────
{
  ok("the image is held constant", /imageHash: champion\.imageHash/.test(metaBlock));
  ok("and the reason is written down where it is done",
    /held constant on purpose|teaches (you )?nothing about which/i.test(metaBlock + meta));
  ok("the prompt tells the model the picture is not changing",
    /picture is NOT changing/.test(metaBlock));
  ok("the prompt demands a different angle", /genuinely DIFFERENT angle/.test(metaBlock));
  ok("the prompt bans a reworded twin", /reworded version of the same idea/.test(metaBlock));
  ok("the challenger is written against live local conditions", /localCond\.block/.test(metaBlock));
  ok("the champion's copy is shown so it is not rewritten", /must BEAT/.test(metaBlock));

  // An ad built by hand in Ads Manager may carry none of what a challenger needs.
  // Guessing any of these would post an ad pointing somewhere nobody chose.
  ok("an ad missing its page, link or image is skipped, not guessed",
    /!champion\.pageId \|\| !champion\.linkUrl \|\| !champion\.imageHash/.test(metaBlock));

  // Em dashes are the tell Bryson named. cleanMeta strips them, so the challenger
  // cannot ship one even if the model writes one.
  ok("copy goes through cleanMeta", /cleanMeta\(data\)/.test(metaBlock));
  ok("and cleanMeta strips dashes", /stripDashes\(v\.headline\)/.test(readFileSync("netlify/lib/ad-gen-shared.mjs", "utf8")));
}

// ── 5. The brakes ───────────────────────────────────────────────────────────
{
  const num = (name) => {
    const m = auto.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`));
    return m ? Number(m[1]) : null;
  };
  eq("one challenger at a time, never a pile", num("META_SPLIT_MAX_ADS_PER_SET"), 2);
  ok("Meta needs more impressions than Google before a test is worth writing",
    num("META_SPLIT_MIN_IMPRESSIONS") > num("SPLIT_MIN_IMPRESSIONS"),
    "Meta front-loads whichever ad it thinks will win, so early numbers are its guess");
  ok("Meta needs more clicks than Google before judging",
    num("META_SPLIT_MIN_CLICKS_EACH") > num("SPLIT_MIN_CLICKS_EACH"));
  ok("Meta needs a bigger lift than Google to call a winner",
    num("META_SPLIT_MIN_LIFT") > num("SPLIT_MIN_LIFT"));
  eq("at most one action per ad set per week", num("META_SPLIT_COOLDOWN_HOURS"), 168);

  ok("the cooldown is actually applied", /META_SPLIT_COOLDOWN_HOURS \* 3600e3/.test(metaBlock));
  ok("the impressions floor is actually applied", /setImpressions < META_SPLIT_MIN_IMPRESSIONS/.test(metaBlock));
  ok("the per-set ad cap is actually applied", /META_SPLIT_MAX_ADS_PER_SET/.test(metaBlock));
  ok("the blast-radius cap applies to Meta too", /MAX_ACTIONS_PER_CLIENT/.test(metaBlock));
  ok("the global kill switch still covers it", /ADS_AUTOPILOT/.test(auto));

  // A test is between ads competing for the SAME money, so it must group by ad set.
  ok("ads are grouped by ad set", /bySet/.test(metaBlock));
  ok("only ACTIVE ads count as running",
    /effectiveStatus \|\| a\.status \|\| ""\)\.toUpperCase\(\) === "ACTIVE"/.test(metaBlock));

  // A read failure must skip the client, never fall through into a write.
  ok("a failed ad read skips rather than writing blind", /meta ad read failed/.test(metaBlock));
  ok("every write is wrapped so one failure cannot stop the run",
    (metaBlock.match(/catch \(e\) \{ failures\+\+/g) || []).length >= 2);
}

// ── 6. It reports what it did ───────────────────────────────────────────────
{
  ok("a challenger is logged", /action: "split-challenger"/.test(metaBlock));
  ok("a winner is logged", /action: "split-winner"/.test(metaBlock));
  ok("actions are tagged as Meta", /platform: "meta"/.test(metaBlock));
  ok("the log says budget was untouched", /Budget unchanged/.test(metaBlock));
  ok("the log explains the challenger in plain English", /Same picture, different words, same budget/.test(metaBlock));
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-meta-creative-testing: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
