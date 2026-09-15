// Choosing which landing page an ad points at, and refusing to spend on one that is not live.
// Run: node tests/verify-landing-target.mjs
//
// Bryson, 2026-09-15: *"when i make the ads and i want to select the landing page i said to use
// how do i do that?"* The honest answer was: he could not. Both launch cards carried a bare text
// box pre-filled with the account's single page, so pointing an ad at one of his audience pages
// meant leaving the screen, copying the address, coming back, and pasting it. On his own account
// that box pre-filled with /get-started, so every campaign started aimed at the wrong page and
// stayed that way unless he remembered every single time.
//
// 🔴 THE PART THAT COSTS MONEY IS NOT THE PICKER, IT IS THE GUARD. `landing.mjs` serves the real
// page only when the page is published AND has a headline, and returns a coming-soon holder
// otherwise. An ad pointed at such an address looks completely correct in the OS, in the ad, and
// in the campaign report, and every click it buys lands on a placeholder. So the rule is checked
// at SPEND time in both cards, not just at pick time: greying out a button does nothing about a
// pasted address, a page unpublished after the draft was written, or a draft reopened next week.
//
// No React and no network: the real helpers and the real launch() bodies are extracted from
// index.html and RUN, and the "live" rule is checked against the actual renderer rather than
// against a second copy of the rule written here (a test that restates the rule it is testing
// passes forever while the two drift apart).

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE REAL HELPERS, RUN
// ══════════════════════════════════════════════════════════════════════════════

const helpersSrc = os.slice(os.indexOf("const AUDIENCE_PAGE_BASE ="),
                            os.indexOf("function LandingTargetPicker("));
ok("the helpers were extracted", /deadAudienceTarget/.test(helpersSrc), `got ${helpersSrc.length} chars`);
const { audienceTargets, sameUrl, deadAudienceTarget } =
  new Function(`${helpersSrc}\nreturn { audienceTargets, sameUrl, deadAudienceTarget };`)();

const page = (over = {}) => ({ headline: "More roofing jobs", published: true, ...over });
const acct = (pages) => ({ name: "BoldLine Media", internal: true, landingPages: pages });

{
  const t = audienceTargets(acct([
    { id: "a", label: "Roofers", slug: "roofers", page: page() },
    { id: "b", label: "Car Detailers", slug: "car-detailers", page: page({ published: false }) },
    { id: "c", label: "Dentists", slug: "dentists", page: page({ headline: "" }) },
    { id: "d", label: "No page yet", slug: "no-page-yet" },
  ]));
  eq("every page is offered, live or not", t.map(x => x.label),
    ["Roofers", "Car Detailers", "Dentists", "No page yet"]);
  eq("the address is the public one, not the OS path", t[0].url, "https://boldlinemedia.com/for/roofers");
  eq("a written, published page is live", t[0].live, true);
  eq("an unpublished page is not", t[1].live, false);
  // 🔴 Both flags, because the renderer checks both. This one is the easy half to forget:
  // the page exists, it is switched on, and it has no words in it.
  eq("🔴 a published page with no headline is NOT live", t[2].live, false);
  eq("a page never written at all is not live", t[3].live, false);
}

{
  // A slug-less row would produce ".../for/undefined", which is a real address that answers.
  eq("a row with no address is dropped entirely", audienceTargets(acct([{ id: "x", label: "Broken" }])).length, 0);
  eq("an account with no audience pages offers nothing", audienceTargets({ name: "X" }).length, 0);
  eq("a missing list is not a crash", audienceTargets({}).length, 0);
  eq("no client at all is not a crash", audienceTargets(null).length, 0);
}

{
  ok("a trailing slash is the same address", sameUrl("https://boldlinemedia.com/for/roofers/", "https://boldlinemedia.com/for/roofers"));
  ok("case is the same address", sameUrl("HTTPS://BoldLineMedia.com/for/Roofers", "https://boldlinemedia.com/for/roofers"));
  ok("surrounding space is the same address", sameUrl("  https://boldlinemedia.com/for/roofers ", "https://boldlinemedia.com/for/roofers"));
  ok("a different page is not the same address", !sameUrl("https://boldlinemedia.com/for/roofers", "https://boldlinemedia.com/for/dentists"));
  // Empty on both sides must not read as a match, or every blank field looks like a chosen page.
  ok("two blanks are not a match", !sameUrl("", ""));
}

{
  const cl = acct([
    { id: "a", label: "Roofers", slug: "roofers", page: page() },
    { id: "b", label: "Car Detailers", slug: "car-detailers", page: page({ published: false }) },
  ]);
  eq("a live page is not flagged", deadAudienceTarget(cl, "https://boldlinemedia.com/for/roofers"), null);
  eq("an unlive page is flagged, by name", (deadAudienceTarget(cl, "https://boldlinemedia.com/for/car-detailers") || {}).label, "Car Detailers");
  // 🔴 The paste path is the one the picker cannot police.
  eq("🔴 and it is flagged when pasted with a trailing slash", (deadAudienceTarget(cl, "https://boldlinemedia.com/for/car-detailers/") || {}).label, "Car Detailers");
  eq("somebody else's URL is left alone", deadAudienceTarget(cl, "https://quote.stencilandthread.com"), null);
  eq("a blank URL is not flagged here", deadAudienceTarget(cl, ""), null);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 "LIVE" MEANS WHAT THE SERVER MEANS
//
// The whole guard rests on one claim: that a page the picker calls not-live really would
// serve a placeholder to anyone who clicks the ad. Asserting that against a second copy of
// the rule written here would prove nothing, so the REAL gate is lifted out of landing.mjs
// and run. If the server ever relaxes or tightens what it serves, this fails instead of the
// picker quietly disagreeing with it.
// ══════════════════════════════════════════════════════════════════════════════

const LANDING = readFileSync(new URL("../netlify/functions/landing.mjs", import.meta.url), "utf8");
const serverGate = (() => {
  const from = LANDING.indexOf('const key = String(url.searchParams.get("preview")');
  ok("the publish gate was found in landing.mjs", from > 0);
  const src = LANDING.slice(from, LANDING.indexOf("return html(renderLandingPage(cl));", from))
    .replace("return comingSoonPage(cl.name);", 'return "placeholder";') + '\nreturn "the real page";';
  return new Function("url", "lp", `const comingSoonPage=()=>"placeholder";const cl={};${src}`);
})();
const servedFor = (lp) => serverGate(new URL("https://x.test/for/roofers"), lp);

// Every shape the picker judges, put to the server. The two must agree on all of them.
for (const [what, lp] of [
  ["a written, published page", page()],
  ["an unpublished page", page({ published: false })],
  ["🔴 a published page with no headline", page({ headline: "" })],
  ["a page never written at all", {}],
]) {
  const pickerSays = audienceTargets(acct([{ id: "z", label: "X", slug: "x", page: lp }]))[0].live;
  const serverSays = servedFor(lp) === "the real page";
  eq(`${what}: the picker and the server agree`, pickerSays, serverSays);
}

ok("🔴 and the server really does withhold some of them", servedFor(page({ published: false })) === "placeholder",
  "if the server served everything, 'not live' would mean nothing and every check here is checking nothing");
ok("🔴 and really does serve a live one", servedFor(page()) === "the real page",
  "if the server served nothing, the picker could grey out every page and still pass");

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE REAL launch() BODIES REFUSE TO SPEND
// ══════════════════════════════════════════════════════════════════════════════

const gCard = os.slice(os.indexOf("function GoogleLaunchCard("), os.indexOf("function MetaLaunchCard("));
const mCard = os.slice(os.indexOf("function MetaLaunchCard("));

const gLaunch = gCard.slice(gCard.indexOf("const launch=async(mode)=>{"), gCard.indexOf("\n  if(!linked) return ("));
const mLaunch = mCard.slice(mCard.indexOf("const launch=async()=>{"), mCard.indexOf("\n  if(!linked) return ("));
ok("the Google launch body was extracted", /gadsCall\(\{action:"createCampaign"/.test(gLaunch), `got ${gLaunch.length} chars`);
ok("the Meta launch body was extracted", /metaCall\(\{action:"createCampaign"/.test(mLaunch), `got ${mLaunch.length} chars`);

const CLIENT = acct([
  { id: "a", label: "Roofers", slug: "roofers", page: page() },
  { id: "b", label: "Car Detailers", slug: "car-detailers", page: page({ published: false }) },
]);

async function runGoogle(landingUrl) {
  let sent = null, state = "idle", msg = "";
  const scope = {
    gen: null, picked: null,
    f: { name: "Roofer ads", dailyBudgetDollars: "20", landingUrl, matchType: "PHRASE",
         headlinesText: "One\nTwo\nThree", descriptionsText: "Aaa.\nBbb.", keywordsText: "roofing ads",
         locationsText: "Phoenix, Arizona", negativeKeywordsText: "", goal: "leads" },
    client: { ...CLIENT, googleAdsCustomerId: "924", conversionActions: { lead: 1 } },
    deadAudienceTarget, humanizeAdCopy: (s) => String(s).trim(),
    setState: (v) => { state = v; }, setMsg: (v) => { msg = v; },
    gadsCall: async (p) => { sent = p; return { campaignResourceName: "customers/924/campaigns/7", adGroupsCreated: 1, adGroupNames: ["a"], keywordsCreated: 1, locationsTargeted: [], negativeKeywordsCreated: 0 }; },
    onUpdate: () => {}, makeApproval: (a) => a, notifyClientApproval: () => {}, fmt: () => "2026-09-15",
  };
  const fn = new Function(...Object.keys(scope), `${gLaunch}\nreturn launch;`)(...Object.values(scope));
  await fn("manual");
  return { sent, state, msg };
}

async function runMeta(landingUrl) {
  let sent = null, state = "idle", msg = "";
  const scope = {
    f: { name: "Roofer ads", dailyBudgetDollars: "20", landingUrl, headline: "Roofing leads",
         primaryText: "We run the ads.", description: "", imageUrl: "https://x/i.jpg" },
    client: { ...CLIENT, metaAdAccountId: "act_1", metaPageId: "p1" },
    deadAudienceTarget,
    setState: (v) => { state = v; }, setMsg: (v) => { msg = v; },
    metaCall: async (p) => { sent = p; return { campaignId: "c1", adSetId: "s1", adId: "a1" }; },
    onUpdate: () => {}, makeApproval: (a) => a, notifyClientApproval: () => {}, fmt: () => "2026-09-15",
    humanizeAdCopy: (s) => String(s).trim(),
  };
  const fn = new Function(...Object.keys(scope), `${mLaunch}\nreturn launch;`)(...Object.values(scope));
  await fn();
  return { sent, state, msg };
}

for (const [who, run] of [["Google", runGoogle], ["Meta", runMeta]]) {
  const dead = await run("https://boldlinemedia.com/for/car-detailers");
  eq(`🔴 ${who} refuses a page that is not live`, dead.state, "error");
  ok(`🔴 ${who} sent nothing to the platform`, dead.sent === null,
    "the campaign would have been built and every click would land on a placeholder");
  ok(`${who} names the page and says how to fix it`, /car detailers/i.test(dead.msg) && /live/i.test(dead.msg), dead.msg);

  const good = await run("https://boldlinemedia.com/for/roofers");
  ok(`${who} builds against a live page`, good.sent !== null, `state ${good.state}: ${good.msg}`);
  eq(`${who} sends that exact address`, good.sent.landingUrl, "https://boldlinemedia.com/for/roofers");

  // Not every URL belongs to us. A client's own domain must sail straight through.
  const other = await run("https://quote.stencilandthread.com");
  ok(`${who} does not second-guess an outside address`, other.sent !== null, `state ${other.state}: ${other.msg}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE PICKER IS ON BOTH CARDS
//
// A picker on one card and not the other is how the other card quietly keeps sending
// traffic to the wrong page, which is the exact bug being fixed.
// ══════════════════════════════════════════════════════════════════════════════

for (const [who, src] of [["Google", gCard], ["Meta", mCard]]) {
  const at = src.indexOf('k==="landingUrl"');
  ok(`🔴 the ${who} card shows the picker under the landing page field`,
    at > -1 && /LandingTargetPicker/.test(src.slice(at, at + 400)),
    "the field is still a bare text box on this card");
  ok(`the ${who} picker writes back to the landing field`,
    /onPick=\{u=>set\("landingUrl",u\)\}/.test(src),
    "picking a page would change nothing");
  ok(`the ${who} picker offers the main page too`, /defaultUrl=\{landingDefault\}/.test(src),
    "there would be no way back to the account's own page after picking an audience page");
}

const picker = os.slice(os.indexOf("function LandingTargetPicker("), os.indexOf("function GoogleLaunchCard("));
ok("the picker was found", picker.length > 500, `got ${picker.length} chars`);
ok("🔴 a page that is not live cannot be picked", /disabled=\{!t\.live\}/.test(picker),
  "the easy mistake stays easy to make");
ok("and it says why rather than just being grey", /not live yet/.test(picker));
ok("an account with no audience pages sees no picker at all", /if \(!targets\.length\) return null;/.test(picker),
  "a client with one page would get an empty row of buttons");

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach(f => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-landing-target: ${pass} checks passed`);
