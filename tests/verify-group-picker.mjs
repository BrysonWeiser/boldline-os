// Choosing which generated ad groups get built, and which button builds what.
// Run: node tests/verify-group-picker.mjs
//
// Written 2026-09-09. The generator writes several themed ad groups, and until now the
// card built ALL of them with no way to say "not that one" — and the single Build button
// silently switched meaning the moment anything had been generated, so the manual copy
// boxes became unreachable. Two things had to be true and neither was:
//
//   1. HE PICKS. Tick boxes choose the groups; an unticked group is not built at all,
//      rather than built and paused (a paused ad group in a client's account is a thing
//      to remember to delete later, and forgetting is the normal outcome).
//   2. THE BUTTONS SAY WHAT THEY DO. One button under the generated list builds the
//      ticked groups; the one at the bottom builds the manual copy. Neither infers.
//
// And the note above the button used to state, falsely, that the campaign name, daily
// budget, landing page, locations, negatives and goal were "ignored" for a generated
// build. They are all sent. Bryson read that note and concluded he had no way to set the
// budget for a generated campaign, which is exactly what a wrong label costs.
//
// No network, no React: the real source of `launch` and `editGroup` is extracted from
// index.html and RUN against fakes, so a payload that stops carrying the budget fails
// here rather than in a client's ad account.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const card = os.slice(os.indexOf("function GoogleLaunchCard("), os.indexOf("function MetaLaunchCard("));
ok("the Google launch card was found", card.length > 2000, `got ${card.length} chars`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE REAL launch(), RUN
// ══════════════════════════════════════════════════════════════════════════════

const launchSrc = card.slice(card.indexOf("const launch=async(mode)=>{"), card.indexOf("\n  if(!linked) return ("));
ok("launch() was extracted", /gadsCall\(\{action:"createCampaign"/.test(launchSrc), "the extraction missed the body");
ok("launch takes an explicit mode", /const launch=async\(mode\)=>/.test(launchSrc),
  "inferring the source from 'is there a generation' is the bug this replaced");

const groups = () => ([
  { name: "Custom Tees", intent: "buy", theme: "t", keywords: [{ text: "custom t shirts", matchType: "PHRASE" }], headlines: ["a", "b", "c"], descriptions: ["d", "e"] },
  { name: "Embroidery", intent: "buy", theme: "t", keywords: [{ text: "embroidery", matchType: "BROAD" }], headlines: ["a", "b", "c"], descriptions: ["d", "e"] },
  { name: "Bulk Orders", intent: "buy", theme: "t", keywords: [{ text: "bulk shirts", matchType: "EXACT" }], headlines: ["a", "b", "c"], descriptions: ["d", "e"] },
]);

const fields = (over = {}) => ({
  name: "Stencil & Thread — Search",
  dailyBudgetDollars: "40",
  landingUrl: "https://quote.stencilandthread.com",
  matchType: "PHRASE",
  headlinesText: "Custom Tees Fast\nScreen Printing\nEugene Print Shop",
  descriptionsText: "We print shirts.\nQuick turnaround.",
  keywordsText: "custom shirts\nscreen printing",
  locationsText: "Eugene, Oregon\nSpringfield, Oregon",
  negativeKeywordsText: "free\njobs",
  goal: "leads",
  ...over,
});

// Runs the real launch body with fakes for everything it touches, and reports what it
// sent to Google (or the error it refused with).
async function run({ mode, gen = null, picked = null, f = fields(), client = { name: "Stencil & Thread", googleAdsCustomerId: "924", conversionActions: { lead: 1 } } }) {
  let sent = null, state = "idle", msg = "";
  const scope = {
    gen, picked, f, client,
    setState: (v) => { state = v; },
    setMsg: (v) => { msg = v; },
    humanizeAdCopy: (s) => String(s).trim(),
    gadsCall: async (payload) => {
      sent = payload;
      return { campaignResourceName: "customers/924/campaigns/77", adGroupsCreated: (payload.adGroups || []).length || 1, adGroupNames: (payload.adGroups || []).map(g => g.name), keywordsCreated: 5, locationsTargeted: ["Eugene"], negativeKeywordsCreated: 2 };
    },
    onUpdate: () => {},
    makeApproval: (a) => a,
    notifyClientApproval: () => {},
    fmt: () => "2026-09-09",
  };
  const fn = new Function(...Object.keys(scope), `${launchSrc}\nreturn launch;`)(...Object.values(scope));
  await fn(mode);
  return { sent, state, msg };
}

// A generated build sends the ticked groups and nothing else.
{
  const picked = new Set([0, 2]);
  const { sent, state } = await run({ mode: "gen", gen: { adGroups: groups() }, picked });
  eq("a generated build sends only the ticked groups", (sent.adGroups || []).map(g => g.name), ["Custom Tees", "Bulk Orders"]);
  ok("it does not send the manual headlines", !("headlines" in sent), "the manual copy would become a fourth ad group nobody asked for");
  ok("it does not send the manual keywords", !("keywords" in sent));
  eq("it did not error", state, "done");
}

// Untouched tick boxes mean every group.
{
  const { sent } = await run({ mode: "gen", gen: { adGroups: groups() }, picked: null });
  eq("no picking yet means all three groups", (sent.adGroups || []).length, 3);
}

// THE POINT OF THE WHOLE FIX: the campaign-level settings ARE sent with a generated build.
{
  const { sent } = await run({ mode: "gen", gen: { adGroups: groups() }, picked: null });
  eq("the campaign name is sent", sent.name, "Stencil & Thread — Search");
  eq("the daily budget is sent", sent.dailyBudgetDollars, 40);
  eq("the landing page is sent", sent.landingUrl, "https://quote.stencilandthread.com");
  eq("the locations are sent", sent.locations, ["Eugene, Oregon", "Springfield, Oregon"]);
  eq("the negatives are sent", sent.negativeKeywords, ["free", "jobs"]);
  eq("the goal is sent", sent.goal, "leads");
}

// The manual button still builds the manual copy even when a generation is on screen.
{
  const { sent, state } = await run({ mode: "manual", gen: { adGroups: groups() }, picked: null });
  eq("the manual button did not error with a generation present", state, "done");
  eq("it sends the typed headlines", sent.headlines, ["Custom Tees Fast", "Screen Printing", "Eugene Print Shop"]);
  ok("it sends no ad groups", !("adGroups" in sent), "that is the whole point of the second button");
  eq("it still sends the campaign settings", sent.dailyBudgetDollars, 40);
}

// Ticking nothing refuses, rather than quietly building everything.
{
  const { sent, state, msg } = await run({ mode: "gen", gen: { adGroups: groups() }, picked: new Set() });
  eq("an empty selection refuses", state, "error");
  ok("nothing was sent to Google", sent === null);
  ok("it says to tick a group", /tick at least one ad group/i.test(msg), msg);
}

// A generated build must NOT be blocked by the manual copy rules.
{
  const f = fields({ headlinesText: "", descriptionsText: "", keywordsText: "" });
  const { state, sent } = await run({ mode: "gen", gen: { adGroups: groups() }, picked: null, f });
  eq("empty manual boxes do not block a generated build", state, "done");
  eq("and the groups still went", (sent.adGroups || []).length, 3);
}

// ...but they still guard the manual build.
{
  const f = fields({ headlinesText: "Only one" });
  const { state, msg } = await run({ mode: "manual", f });
  eq("too few headlines still refuses a manual build", state, "error");
  ok("and says so", /3 headlines/.test(msg), msg);
}

// Settings that are wrong refuse in BOTH modes — a generated build is not a way around them.
for (const mode of ["gen", "manual"]) {
  {
    const { state, msg } = await run({ mode, gen: { adGroups: groups() }, f: fields({ dailyBudgetDollars: "0" }) });
    eq(`${mode}: a zero budget refuses`, state, "error");
    ok(`${mode}: and says why`, /daily budget/i.test(msg), msg);
  }
  {
    const { state, msg } = await run({ mode, gen: { adGroups: groups() }, f: fields({ locationsText: "" }) });
    eq(`${mode}: no locations refuses`, state, "error");
    ok(`${mode}: and says why`, /location/i.test(msg), msg);
  }
  {
    const { state } = await run({ mode, gen: { adGroups: groups() }, f: fields({ landingUrl: "" }) });
    eq(`${mode}: no landing page refuses`, state, "error");
  }
}

// Asking for a generated build when nothing was generated falls back to the manual copy
// rather than sending an empty campaign.
{
  const { sent, state } = await run({ mode: "gen", gen: null });
  eq("no generation means the manual copy is used", state, "done");
  ok("and headlines were sent", Array.isArray(sent.headlines) && sent.headlines.length === 3);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. THE TICK BOX, RUN
// ══════════════════════════════════════════════════════════════════════════════

const toggleSrc = card.match(/onClick=\{\(\)=>setPicked\(p=>\{([\s\S]*?)\}\)\}/);
ok("the tick box handler was found", !!toggleSrc);
{
  // Replays the real handler over a fake setPicked, the way React would.
  const body = toggleSrc[1];
  const toggle = new Function("gen", "i", "p", `const f=(p)=>{${body}};return f(p);`);
  const gen = { adGroups: groups() };

  const afterFirst = toggle(gen, 1, null);
  ok("the first untick starts from ALL groups, not from none", afterFirst.has(0) && afterFirst.has(2),
    "starting from an empty set would silently drop every other group");
  ok("and the tapped group came off", !afterFirst.has(1));

  const afterSecond = toggle(gen, 1, afterFirst);
  ok("tapping it again puts it back", afterSecond.has(1));
  eq("and nothing else changed", afterSecond.size, 3);
}

// The visual state of the box has to agree with what launch() filters on, or a box reads
// ticked while its group is skipped.
ok("a box is ticked when there is no selection yet, or it is in the selection",
  /const on2 = !picked \|\| picked\.has\(i\)/.test(card));
ok("launch filters on the same rule", /filter\(\(g,i\)=>!picked\|\|picked\.has\(i\)\)/.test(card),
  "the tick and the filter must be the same test");

// ══════════════════════════════════════════════════════════════════════════════
// 3. EDITING A GENERATED AD GROUP, RUN
// ══════════════════════════════════════════════════════════════════════════════

const editSrc = card.slice(card.indexOf("const editGroup = (i, field, text) =>"), card.indexOf("const [genState,setGenState]"));
ok("editGroup() was extracted", /adGroups: groups/.test(editSrc));
{
  let held = { adGroups: groups(), notes: "keep me" };
  const scope = { setGen: (fn) => { held = fn(held); } };
  const editGroup = new Function(...Object.keys(scope), `${editSrc}\nreturn editGroup;`)(...Object.values(scope));

  editGroup(1, "headlines", "New One\n  New Two  \n\nNew Three\n");
  eq("headlines are rewritten, trimmed, blanks dropped", held.adGroups[1].headlines, ["New One", "New Two", "New Three"]);
  eq("the other groups are untouched", held.adGroups[0].headlines, ["a", "b", "c"]);
  eq("the rest of the generation survives", held.notes, "keep me");
  eq("the group keeps its name", held.adGroups[1].name, "Embroidery");

  editGroup(0, "keywords", '[exact one]\n"phrase two"\nbroad three');
  eq("keyword match types come from the punctuation", held.adGroups[0].keywords, [
    { text: "exact one", matchType: "EXACT" },
    { text: "phrase two", matchType: "PHRASE" },
    { text: "broad three", matchType: "BROAD" },
  ]);

  editGroup(0, "descriptions", "Just one line");
  eq("descriptions are rewritten too", held.adGroups[0].descriptions, ["Just one line"]);

  // An edit has to reach the payload, or he edits into a void.
  const { sent } = await run({ mode: "gen", gen: held, picked: new Set([0]) });
  eq("an edited group is what gets built", sent.adGroups[0].keywords.map(k => k.text), ["exact one", "phrase two", "broad three"]);

  // Nothing generated: editing must not invent a structure.
  let empty = null;
  const eg2 = new Function("setGen", `${editSrc}\nreturn editGroup;`)((fn) => { empty = fn(null); });
  eg2(0, "headlines", "x");
  eq("editing with nothing generated is a no-op", empty, null);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE TWO BUTTONS, AND THE NOTE THAT USED TO LIE
// ══════════════════════════════════════════════════════════════════════════════

ok("there is a build button for the generated groups", /onClick=\{\(\)=>launch\("gen"\)\}/.test(card));
ok("there is a build button for the manual copy", /onClick=\{\(\)=>launch\("manual"\)\}/.test(card));
ok("no button calls launch with no mode", !/onClick=\{launch\}/.test(card),
  "a mode-less call would take the manual branch and silently ignore the ad groups");

// The generated button must live inside the generated block, or it renders with nothing
// to build.
{
  const genBlock = card.slice(card.indexOf("{gen&&gen.adGroups&&("), card.indexOf("Campaign settings <span"));
  ok("the generated button is under the generated ad groups", /launch\("gen"\)/.test(genBlock));
  ok("the manual button is not", !/launch\("manual"\)/.test(genBlock));
  ok("the button counts the ticked groups", /Build these \$\{n\} ad group/.test(genBlock), "he should see how many he is about to build");
  ok("it refuses to look pressable with nothing ticked", /Tick at least one ad group/.test(genBlock));
}

// The false sentence is gone and cannot come back.
ok("the note no longer claims the settings below are ignored",
  !/ignored while this is here/.test(card),
  "the campaign name, budget, landing page, locations, negatives and goal are all sent");
ok("the note says the settings below DO apply", /they apply to this build/.test(card));
ok("and says which boxes really are the manual fallback",
  /headline, description and keyword boxes down there do <b style=\{\{color:C\.textDim\}\}>not<\/b>/.test(card));

// The summary has to name every setting that actually travels, so reading it is the same
// as reading the payload.
for (const label of ["Campaign name", "Daily budget", "Landing page", "Locations", "Negatives", "Goal"]) {
  ok(`the summary shows ${label}`, card.includes(`["${label}",`) || card.includes(`["${label}"`), "he cannot check a setting he cannot see");
}
ok("a missing setting is called out rather than shown blank",
  /String\(v\)\.startsWith\("—"\)\?C\.amber/.test(card));

// Headings, so the fields below are findable from the note that points at them.
ok("the shared settings are headed 'Campaign settings'", /Campaign settings <span/.test(card));
ok("the heading says both buttons use them", (card.match(/used by both build buttons/g) || []).length >= 2);
ok("the copy boxes are headed as manual", /Manual ad copy <span/.test(card));

// Regenerating and discarding both clear the selection, or ticks from an old set of
// groups silently apply to a new one by position.
ok("generating clears the selection", /setGen\(d\); setPicked\(null\);/.test(card));
ok("discarding clears it too", /setGen\(null\);setGenMsg\(""\);setPicked\(null\);/.test(card));

// ══════════════════════════════════════════════════════════════════════════════
console.log(`verify-group-picker: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
