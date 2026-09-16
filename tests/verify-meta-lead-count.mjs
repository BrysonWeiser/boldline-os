// How many leads Meta actually reported, against how many the OS says.
// Run: node tests/verify-meta-lead-count.mjs
//
// 🔴 FOUND BY BRYSON ON 2026-09-16, LOOKING AT ADS MANAGER: *"on the dashboard its showing 1
// website lead for the roofers ad which is what i got in the os"*. The OS had been reporting
// **2** for that campaign.
//
// A week earlier the same gap was blamed on the marketing site's backup form firing its
// conversion on the submit event (KB `lead-double-count`). That form really was broken and the
// fix was worth making. **It was not what produced the 2.**
//
// Meta returns ONE conversion under MORE THAN ONE action type: a granular row
// (`offsite_conversion.fb_pixel_lead`) and a roll-up row (`lead`). The OS added every lead-ish
// row together, so one website lead read as two. Ads Manager's own Results column reports a
// single number, which is why the dashboard and the OS disagreed.
//
// 🔴 EXPENSIVE, NOT UNTIDY. Cost per lead read HALF what it really was. The "the platform counted
// more than the OS" warning fired on healthy campaigns, which teaches him to ignore a warning
// that is usually telling the truth. And a client report would have claimed leads nobody got.
//
// 🔴 THE FIX IS NOT "TAKE THE MAX INSTEAD OF THE SUM". A campaign can genuinely run website leads
// AND on-Facebook instant forms at the same time, and then the granular rows are different real
// conversions whose sum IS the answer. Both readings are computed and the larger wins, which is
// right in every case below and cannot double count or undercount.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${b}, got ${a}`);

const SRC = readFileSync(new URL("../netlify/functions/meta-ads.mjs", import.meta.url), "utf8");
const from = SRC.indexOf("const LEAD_ROLLUP");
ok("the counter was found", from > 0, "LEAD_ROLLUP is gone, so this suite is testing nothing");
const leadsFromActions = new Function(
  SRC.slice(from, SRC.indexOf("\n}", SRC.indexOf("function leadsFromActions", from)) + 2) +
  "\nreturn leadsFromActions;")();

// Meta returns values as STRINGS, and mixes in every other action the campaign produced.
const A = (type, value) => ({ action_type: type, value: String(value) });
const NOISE = [A("link_click", 47), A("landing_page_view", 31), A("post_engagement", 88),
               A("page_engagement", 88), A("video_view", 12)];

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE EXACT CASE HE CAUGHT
// ══════════════════════════════════════════════════════════════════════════════
{
  // One website lead, as Meta reports it: the pixel row AND the roll-up row.
  const oneWebsiteLead = [...NOISE, A("offsite_conversion.fb_pixel_lead", 1), A("lead", 1)];
  eq("🔴 one website lead counts as ONE", leadsFromActions(oneWebsiteLead), 1);
  // Belt and braces: the old behaviour, stated as the thing that must not happen.
  ok("🔴 and specifically not two", leadsFromActions(oneWebsiteLead) !== 2,
    "this is the number that disagreed with Ads Manager and got a working form blamed for it");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. IT STILL COUNTS EVERYTHING THAT IS REALLY THERE
// ══════════════════════════════════════════════════════════════════════════════
eq("two website leads count as two",
  leadsFromActions([...NOISE, A("offsite_conversion.fb_pixel_lead", 2), A("lead", 2)]), 2);

eq("🔴 website leads AND instant-form leads add up",
  // 2 from the site, 3 from on-Facebook forms. The roll-up agrees at 5.
  leadsFromActions([...NOISE, A("offsite_conversion.fb_pixel_lead", 2), A("leadgen.other", 3), A("lead", 5)]), 5,
  "taking the max of the granular rows alone would report 3 and lose two real leads");

// 🔴 THE CASE THAT PROVES "TAKE THE MAX" IS NOT THE FIX. Two different real sources, and no
// roll-up row to fall back on. Anything that picks the largest granular row instead of adding
// them reports 3 here and silently loses two leads — and with a roll-up present the mistake
// hides, which is exactly why this case has no roll-up.
eq("🔴 two real sources with no roll-up are ADDED, not picked between",
  leadsFromActions([...NOISE, A("offsite_conversion.fb_pixel_lead", 2), A("leadgen.other", 3)]), 5);

eq("granular rows with no roll-up still count",
  leadsFromActions([...NOISE, A("offsite_conversion.fb_pixel_lead", 4)]), 4,
  "Meta does not always send the roll-up, and those leads are real");

eq("a roll-up with no granular rows still counts",
  leadsFromActions([...NOISE, A("lead", 6)]), 6);

eq("on-Facebook grouped leads count",
  leadsFromActions([A("onsite_conversion.lead_grouped", 3)]), 3);

// 🔴 The roll-up must be counted ONCE, on its own side of the branch. If it ever lands in both
// tallies, a campaign with a roll-up and nothing else doubles again — the original bug, wearing
// a different hat.
eq("🔴 the roll-up is not also counted as a granular row",
  leadsFromActions([A("lead", 4)]), 4);

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 NOTHING THAT IS NOT A LEAD GETS IN
// ══════════════════════════════════════════════════════════════════════════════
eq("clicks and views are not leads", leadsFromActions(NOISE), 0,
  "a campaign with 47 clicks and no leads would report 47 of them");
eq("a purchase is not a lead",
  leadsFromActions([A("offsite_conversion.fb_pixel_purchase", 9), A("purchase", 9)]), 0,
  "a shop's sales would be reported as leads, and billed as leads");
eq("an add-to-cart is not a lead", leadsFromActions([A("offsite_conversion.fb_pixel_add_to_cart", 5)]), 0);

// ══════════════════════════════════════════════════════════════════════════════
// 4. RUBBISH IN DOES NOT BECOME A NUMBER
// ══════════════════════════════════════════════════════════════════════════════
eq("no actions at all is zero", leadsFromActions(undefined), 0);
eq("an empty list is zero", leadsFromActions([]), 0);
eq("not a list is zero", leadsFromActions({ lead: 4 }), 0);
eq("a null row does not throw", leadsFromActions([null, A("lead", 2)]), 2);
eq("a row with no value is zero, not NaN", leadsFromActions([{ action_type: "lead" }]), 0);
eq("an unparseable value is ignored", leadsFromActions([A("lead", "abc"), A("lead", 3)]), 3);
ok("the result is always a real number",
  [undefined, [], [{}], [A("lead", "x")], NOISE].every((x) => Number.isFinite(leadsFromActions(x))),
  "a NaN here propagates into cost per lead and into a client's report");

// ══════════════════════════════════════════════════════════════════════════════
// 5. EVERY PLACE THAT REPORTS LEADS USES THIS ONE COUNTER
// ══════════════════════════════════════════════════════════════════════════════
{
  const code = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const uses = (code.match(/leadsFromActions\(/g) || []).length;
  ok("🔴 the campaign list, the ad reader and the detail panel all use it", uses >= 4,
    `only ${uses} references — a second way of counting leads is how half of them drift`);
  ok("🔴 and nothing adds lead rows up by hand somewhere else",
    !/action_type[\s\S]{0,120}reduce\(/.test(code.replace(/function leadsFromActions[\s\S]*?\n\}/, "")),
    "a hand-rolled sum elsewhere reintroduces exactly the bug this file just fixed");
}

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-meta-lead-count: ${pass} checks passed`);
