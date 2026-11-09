// Lead Scout's Complete mode, and the "can they pay" math on the new pricing (Bryson, 2026-11-09, KB lead-scout +
// complete-plan). Run: node tests/verify-complete-scout.mjs
//
// 🔴 Two things this guards:
//  1. Since 2026-11-07 there is no monthly minimum, but the scout still priced every prospect at the old minimum
//     ($400 a month and up) plus ad spend. That overstated the cost and quietly capped decent prospects as "can't
//     afford". What they really carry is their ad budget plus BoldLine's fee on it (and the Complete fee).
//  2. Complete mode must find businesses that fit Complete: a weak website (the free check runs first, so nothing is
//     paid for a business whose site is fine), a reputation to stand on, and room for ads plus $500 a month. Results
//     are stored as "both" (ads AND a website), shown everywhere as "Complete".

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SC = await import("../netlify/lib/scout-scoring.mjs");
const SS = await import("../netlify/lib/scout-shared.mjs");
const PI = await import("../netlify/lib/pitch.mjs");
const PS = await import("../netlify/lib/pricing-shared.mjs");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const BG = src("netlify/functions/lead-scout-background.mjs"), S = src("index.html"), DRAFT = src("netlify/functions/outreach-draft.mjs");

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1. The money math on the new pricing ──────────────────────────────────────────────────────────
const g = PS.PACKAGES.find((p) => p.id === "g-launch"), e = PS.PACKAGES.find((p) => p.id === "e-launch");
eq("ads: the cheapest way in is $500 of ad budget + ~$200 of lead fees = $700 (no minimum)", SC.monthlyCostOf(g), 700);
eq("Complete: the same plus $500 = $1,200", SC.monthlyCostOf(g, true), 1200);
eq("a store: $500 + 15% = $575", SC.monthlyCostOf(e), 575);
eq("a store's Complete: + $300 = $875", SC.monthlyCostOf(e, true), 875);
eq("lead fees are planned at 40% of the ad budget (an estimate, said so)", SC.LEAD_FEE_SHARE, 0.4);
const size = { employeesEstimate: 4, revenueEstimate: "", nicheGroup: "Home services", kind: "service" };
const ads = SC.assessAffordability({ ...size, pitch: "ads" }), comp = SC.assessAffordability({ ...size, pitch: "complete" });
ok("🔴 no line quotes a monthly minimum any more", !/\$400|minimum \+|\/mo minimum/.test(ads.lines.join(" ")) && /no monthly minimum/.test(ads.lines.join(" ")), ads.lines.join(" | "));
ok("the lead fee figure is labelled an estimate", /an estimate/.test(ads.lines.join(" ")));
eq("ads entry cost", ads.entryMonthly, 700);
eq("Complete entry cost", comp.entryMonthly, 1200);
ok("🔴 Complete asks more of the same business than Ads does", comp.ratio < ads.ratio && comp.entryName === "Complete with Launch System", `${comp.ratio} vs ${ads.ratio}`);
ok("the reading is the right way round ('covers that N times over')", /Their budget covers that [\d.]+ times over/.test(ads.lines.join(" ")) && !/× their capacity/.test(ads.lines.join(" ")));
const small = SC.assessAffordability({ employeesEstimate: 1, revenueEstimate: "$140,000", nicheGroup: "Home services", kind: "service", pitch: "complete" });
ok("a one-person shop is capped for Complete", small.cap < 100, `${small.band} cap ${small.cap}`);
const unknown = SC.assessAffordability({ employeesEstimate: 0, revenueEstimate: "", nicheGroup: "", kind: "service", pitch: "complete" });
ok("unknown size still names Complete's real cost", !unknown.known && /Complete with Launch System/.test(unknown.note) && /\$1,200/.test(unknown.note));

// ── 2. What the search hunts for, and what it is told ─────────────────────────────────────────────────
const disc = SS.discoverySystem({ niche: "Pool service", areas: ["Phoenix, AZ"], count: 5, pitch: "complete" });
ok("Complete mode hunts for the Complete fit", /COMPLETE PLAN/.test(disc) && /solid reputation/.test(disc) && /NO website of their own, or one that is plainly outdated/.test(disc) && /fund an ad budget/.test(disc));
ok("and not a business with a strong modern website, or a franchise", /strong modern website is NOT a fit/.test(disc) && /Franchise and corporate-owned locations are NOT a fit/.test(disc));
const brief = SS.enrichSystem({ niche: "Pool service", kind: "service", leadFee: 55, areas: ["Phoenix"], pitch: "complete" });
ok("the research brief quotes Complete from the price list", brief.includes(`$${PS.COMPLETE_PLAN.monthly} a month plus`) && /about \$55 in this industry/.test(brief) && /no monthly minimum/.test(brief));
ok("it looks at the Google profile too", /Their Google profile/.test(brief) && /unanswered reviews/.test(brief));
ok("its package pick is the ad plan inside Complete", /recommended_package_id is the AD PLAN inside Complete/.test(brief) && /g-growth/.test(brief) && !/w-standard/.test(brief));
ok("no dash in the Complete brief's own wording (the shared accuracy rules are internal)", !/[—–]/.test(brief.slice(0, brief.indexOf("ACCURACY RULES"))));
const storeBrief = SS.enrichSystem({ niche: "Candles", kind: "ecom", leadFee: 0, areas: [], pitch: "complete" });
ok("a store's Complete brief: $300, share of ad spend, no website build", storeBrief.includes(`$${PS.COMPLETE_STORE.monthly} a month plus a share of ad spend`) && !/website free/.test(storeBrief) && /e-growth/.test(storeBrief));
ok("🔴 the ads brief no longer describes a minimum", !/MINIMUM|whichever is higher/.test(SS.enrichSystem({ niche: "Roofing", kind: "service", leadFee: 75, areas: [], pitch: "ads" })));

// ── 3. The run ────────────────────────────────────────────────────────────────────────────────────────
ok("the run accepts Complete", /const pitch = \["website", "complete"\]\.includes\(input\.pitch\) \? input\.pitch : "ads";/.test(BG) && /pitch: \["website", "complete"\]\.includes\(body\.pitch\) \? body\.pitch : "ads",/.test(BG));
ok("🔴 Complete checks every website first, for free (shares website mode's filter)", /const website = pitch === "website" \|\| pitch === "complete";/.test(BG) && /if \(website\) \{\n\s*const cap =/.test(BG));
ok("the website check scores the gap for Complete too", /pitch === "website" \|\| pitch === "complete" \? \{ site: siteNeed\(siteCheck\) \}/.test(BG));
ok("results are stored as 'both' (ads and a website)", /pitch: pitch === "website" \? "website" : pitch === "complete" \? "both" : "ads",/.test(BG));
ok("🔴 'don't pitch above their budget' compares ad budgets, not old minimums", /\(Number\(rec\.minBudget\) \|\| 0\) > \(Number\(afford\.minBudget\) \|\| 0\)/.test(BG) && !/rec\.price > afford\.price/.test(BG));

// ── 4. Labels and filters ─────────────────────────────────────────────────────────────────────────────
eq("'both' is shown as Complete", PI.PITCHES.find((p) => p.id === "both").label, "Complete");
ok("the Complete filter takes exactly the Complete leads", PI.matchesPitch({ data: { pitch: "both" } }, "both") && !PI.matchesPitch({ data: { pitch: "website" } }, "both") && !PI.matchesPitch({ data: {} }, "both"));
ok("and a Complete lead still shows under Ads and Websites", PI.matchesPitch({ data: { pitch: "both" } }, "ads") && PI.matchesPitch({ data: { pitch: "both" } }, "website"));
ok("Lead Scout offers Complete as a third choice", /\["complete","Complete","Good reputation, weak website, and big enough to fund ads plus \$500 a month\. Your best customers\."\]/.test(S) && /"🔎 Find Complete prospects"/.test(S));
ok("Outreach has a Complete filter with its count", /\["both","Complete",pitchCounts&&pitchCounts\.both\]/.test(S) && /\["ads","website","both"\]\.includes\(v\)/.test(S));
ok("the saved list has a Complete filter", /<option value="both">Complete<\/option>/.test(S));
ok("OS labels say Complete", /both:"Complete lead"/.test(S) && /\{id:"both",label:"Complete"\}/.test(S) && /both:"Complete"\}\)\[outPitchOf/.test(S));
ok("🔴 Deal Prep is told it is a Complete lead", /"the Complete plan \(ads plus a new website built free, Google profile and the rest\)"/.test(S));
ok("the outreach drafts describe Complete", /the Complete plan: their ads plus a new website built free/.test(DRAFT));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-complete-scout: ${pass} checks passed`);
