// One control per audience: pick how hard to push, and get the whole campaign built.
// Run: node tests/verify-audience-ad-plan.mjs
//
// Bryson, 2026-09-15: *"what if I want to build an ad with multiple ad groups and have it do
// a/b split testing and the full works ... maybe having it so I can select each package tier
// like how I do for clients except it's for my own ads."*
//
// The tier was the wrong dial — a client's tier is decided BY their budget and controls what
// they PAY — so this is a push level instead: Test the waters, Standard, Go hard. What it
// changes is how many buckets the same money is split into.
//
// 🔴 THE TWO THINGS MOST WORTH GUARDING:
//
//   1. THE "CAN THIS EVEN LEARN" WARNING IS BUILT ON AUTOPILOT'S OWN NUMBERS. It tells him how
//      many days until a winner can be called, using the click counts autopilot actually
//      requires before it will judge one. If those drift apart, the screen promises a verdict
//      the system will never give, which is worse than showing no estimate at all. So the
//      numbers are read out of `ads-autopilot.mjs` and compared.
//   2. A BUILD SPENDS MONEY. The real build() runs here against fakes, and every refusal is
//      checked to have sent NOTHING.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const AUTOPILOT = readFileSync(new URL("../netlify/functions/ads-autopilot.mjs", import.meta.url), "utf8");
const META = readFileSync(new URL("../netlify/functions/meta-ads.mjs", import.meta.url), "utf8");

// ── The real maths, run ───────────────────────────────────────────────────────
const helpers = os.slice(os.indexOf("const PUSH_LEVELS = ["), os.indexOf("function AudienceAdPlanCard("));
ok("the level maths was extracted", /const adPlan = /.test(helpers), `got ${helpers.length} chars`);
const { PUSH_LEVELS, pushLevel, adPlan, measuredCpc, VERDICT_CLICKS, ASSUMED_CPC } =
  new Function(`${helpers}\nreturn { PUSH_LEVELS, pushLevel, adPlan, measuredCpc, VERDICT_CLICKS, ASSUMED_CPC };`)();

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE WARNING IS BUILT ON NUMBERS THE SYSTEM ACTUALLY USES
// ══════════════════════════════════════════════════════════════════════════════
{
  const num = (name) => {
    const m = AUTOPILOT.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`));
    ok(`${name} still exists in autopilot`, !!m, "the constant this screen quotes is gone");
    return m ? Number(m[1]) : null;
  };
  eq("🔴 the Google click count matches autopilot's", VERDICT_CLICKS.google, num("SPLIT_MIN_CLICKS_EACH"));
  eq("🔴 the Meta click count matches autopilot's", VERDICT_CLICKS.meta, num("META_SPLIT_MIN_CLICKS_EACH"));
  ok("and they are not the same number, so this check is discriminating",
    VERDICT_CLICKS.google !== VERDICT_CLICKS.meta);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. THE ARITHMETIC
// ══════════════════════════════════════════════════════════════════════════════
{
  // Standard on Google: 3 ad groups, each eventually holding the original ad plus the
  // challenger autopilot writes, each needing 30 clicks. 180 clicks at $8 is $1,440.
  const p = adPlan({ level: "standard", platform: "google", monthlyBudget: 1440, cpc: 8 });
  eq("the buckets are the ad groups on Google", p.buckets, 3);
  eq("a verdict needs both ads in every group to get their clicks", p.clicksNeeded, 180);
  eq("which is about a month of that budget", p.days, 31);
  eq("and a month is called tight, not fine", p.verdict, "tight");
  eq("with the lighter level named", p.lower.id, "toe");
}

{
  // Meta buckets are the ads themselves: 3 versions, 50 clicks each.
  const p = adPlan({ level: "standard", platform: "meta", monthlyBudget: 1000, cpc: 1.5 });
  eq("the buckets are the ad versions on Meta", p.buckets, 3);
  eq("one lot of clicks each", p.clicksNeeded, 150);
  eq("which that budget covers quickly", p.verdict, "ok");
}

{
  // 🔴 The whole point of the warning: the SAME budget, judged differently by level.
  const thin = adPlan({ level: "hard", platform: "google", monthlyBudget: 1000, cpc: 8 });
  eq("🔴 pushing hard on that budget is called too thin", thin.verdict, "thin");
  ok("and it says which level to drop to", thin.lower && thin.lower.id === "standard");
  const fine = adPlan({ level: "toe", platform: "google", monthlyBudget: 1000, cpc: 8 });
  eq("🔴 while the lightest level on the same money is fine", fine.verdict, "ok");
  ok("so the warning discriminates rather than always firing", thin.days > fine.days * 3,
    `hard ${thin.days}d vs toe ${fine.days}d`);

  // 🔴 AND IT IS ALLOWED TO SAY NO TO EVERYTHING. At $400/mo against $8 clicks the account
  // buys about fifty clicks a MONTH, and no arrangement of them produces a verdict. A warning
  // that softened here to look less discouraging would be lying at exactly the moment it
  // matters most.
  ok("🔴 a budget too small for any split test says so at every level",
    PUSH_LEVELS.every((l) => adPlan({ level: l.id, platform: "google", monthlyBudget: 400, cpc: 8 }).verdict !== "ok"),
    "fifty clicks a month cannot settle anything, whatever it is split into");
}

{
  // 🔴 An empty form must not read as the healthiest possible answer.
  eq("no budget is 'cannot say', not 'instant'", adPlan({ level: "standard", platform: "google", monthlyBudget: 0, cpc: 8 }).verdict, "unknown");
  eq("no click price is too", adPlan({ level: "standard", platform: "google", monthlyBudget: 900, cpc: 0 }).verdict, "unknown");
  eq("and neither reports zero days as good", adPlan({ level: "standard", platform: "google", monthlyBudget: 0, cpc: 0 }).days, 0);
}

{
  // More buckets is never faster. The levels must be ordered, or the control is decorative.
  const days = PUSH_LEVELS.map((l) => adPlan({ level: l.id, platform: "google", monthlyBudget: 2000, cpc: 8 }).days);
  ok("🔴 pushing harder always takes longer to learn", days[0] < days[1] && days[1] < days[2], JSON.stringify(days));
}

// ── The click price ───────────────────────────────────────────────────────────
{
  const withHistory = { adPerf: { google: { spend30d: 800, clicks: 100 }, meta: { spend30d: 60, clicks: 40 } } };
  eq("his own average is used when there is one", measuredCpc(withHistory, "google"), 8);
  eq("per platform, not pooled", measuredCpc(withHistory, "meta"), 1.5);
  // 🔴 A handful of clicks is noise, and a wrong number anchored on screen is worse than an
  // honest assumption.
  eq("🔴 too few clicks is not an average", measuredCpc({ adPerf: { google: { spend30d: 200, clicks: 3 } } }, "google"), 0);
  eq("no history at all is not a crash", measuredCpc({}, "google"), 0);
  eq("nor is no client", measuredCpc(null, "google"), 0);
  ok("the fallbacks are not optimistic", ASSUMED_CPC.google >= 5,
    "BoldLine bids on ad-management keywords; a cheap guess makes every plan look affordable");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE REAL build(), RUN
// ══════════════════════════════════════════════════════════════════════════════
const card = os.slice(os.indexOf("function AudienceAdPlanCard("), os.indexOf("function AudiencePagesCard("));
const buildSrc = card.slice(card.indexOf("const build = async () => {"), card.indexOf("\n  if(!targets.length) return ("));
ok("build() was extracted", /createCampaign/.test(buildSrc), `got ${buildSrc.length} chars`);


const PAGES = [
  { id: "p1", label: "Roofers", slug: "roofers", page: { published: true, headline: "h" } },
  { id: "p2", label: "Car Detailers", slug: "car-detailers", page: { published: true, headline: "h" } },
];
const CLIENT = { id: "own", name: "BoldLine Media", internal: true, landingPages: PAGES,
  googleAdsCustomerId: "924", metaAdAccountId: "act_1", metaPageId: "pg1",
  mediaLibrary: [{ url: "https://img/one.jpg", category: "ad-creative" }],
  campaignSetup: { serviceArea: "United States" } };

const { audienceTargets } = new Function(
  os.slice(os.indexOf("const AUDIENCE_PAGE_BASE ="), os.indexOf("function LandingTargetPicker(")) +
  "\nreturn { audienceTargets };")();

// 🔴 The other half of the dead-page rule, which the spend-time guard hides: a page that is
// not live must not be OFFERED. Without this the dropdown lists pages he cannot use and the
// only way to find out is to press build. The card's own line is run, not a copy of it.
{
  const pickable = (pages) => new Function("audienceTargets", "client",
    card.slice(card.indexOf("const targets = audienceTargets"), card.indexOf("\n  const [pageId")) +
    "\nreturn targets;")(audienceTargets, { landingPages: pages });
  eq("🔴 only live pages are offered",
    pickable([{ id: "a", label: "Live", slug: "live", page: { published: true, headline: "h" } },
              { id: "b", label: "Off", slug: "off", page: { published: false, headline: "h" } },
              { id: "c", label: "Empty", slug: "empty", page: { published: true } }]).map((t) => t.label),
    ["Live"]);
  eq("and nothing live means nothing to offer",
    pickable([{ id: "b", label: "Off", slug: "off", page: { published: false } }]).length, 0);
}

async function run({ level = "standard", platform = "google", monthly = "2000", client = CLIENT,
                     locations = "United States", gen = null, forceChosen = null } = {}) {
  let sentGads = null, sentMeta = null, state = "idle", msg = "", updated = null;
  // 🔴 THE CARD'S OWN LINE, not a copy of it. Re-implementing "which pages may be picked"
  // here made the harness disagree with the component: a mutation that deleted the card's
  // live-only filter changed nothing in this test, because this test was doing its own
  // filtering. A harness that supplies what the real page does not is a second
  // implementation that happens to agree.
  const targets = new Function("audienceTargets", "client",
    card.slice(card.indexOf("const targets = audienceTargets"), card.indexOf("\n  const [pageId")) +
    "\nreturn targets;")(audienceTargets, client);
  const scope = {
    chosen: forceChosen !== null ? forceChosen : (targets[0] || null),
    L: pushLevel(level), platform, monthly, locations, client,
    audienceTargets,
    metaImage: ((client.mediaLibrary || [])[0] || {}).url || "",
    linked: platform === "google" ? !!client.googleAdsCustomerId : !!(client.metaAdAccountId && client.metaPageId),
    setState: (v) => { state = v; }, setMsg: (v) => { msg = v; }, setStep: () => {},
    onUpdate: (c) => { updated = c; },
    humanizeAdCopy: (s) => String(s || "").trim(),
    adGenBackground: async () => gen || (platform === "google"
      ? { adGroups: Array.from({ length: 5 }, (_, i) => ({ name: `Group ${i + 1}`, headlines: ["a"], descriptions: ["d"], keywords: [{ text: "k", matchType: "PHRASE" }] })),
          negativeKeywords: ["free"] }
      : { variants: Array.from({ length: 4 }, (_, i) => ({ headline: `Head ${i + 1}`, primaryText: `Body ${i + 1}`, description: "" })) }),
    gadsCall: async (p) => { sentGads = p; return { campaignResourceName: "customers/924/campaigns/77", adGroupsCreated: (p.adGroups || []).length, keywordsCreated: 4 }; },
    metaCall: async (p) => { sentMeta = p; return { campaignId: "c9", adsCreated: 1 + (p.extraAds || []).length }; },
  };
  const fn = new Function(...Object.keys(scope), `${buildSrc}\nreturn build;`)(...Object.values(scope));
  await fn();
  return { sentGads, sentMeta, state, msg, updated };
}

// ── Google ────────────────────────────────────────────────────────────────────
for (const [level, groups] of [["toe", 1], ["standard", 3], ["hard", 5]]) {
  const { sentGads, state } = await run({ level });
  eq(`${level} builds ${groups} ad group${groups === 1 ? "" : "s"}`, (sentGads.adGroups || []).length, groups);
  eq(`${level} did not error`, state, "done");
}

{
  const { sentGads, updated } = await run({ level: "standard" });
  eq("🔴 the ads point at that audience's own page", sentGads.landingUrl, "https://boldlinemedia.com/for/roofers");
  eq("the monthly budget becomes a daily one", sentGads.dailyBudgetDollars, 65.79);
  eq("the generator's negatives are carried through", sentGads.negativeKeywords, ["free"]);
  eq("it chases leads rather than clicks", sentGads.goal, "leads");
  ok("an approval is queued so a paused campaign cannot be forgotten",
    (updated.pendingActions || []).some((a) => a.exec && a.exec.campaignId === "77" && a.exec.kind === "enable_campaign"));
}

// ── Meta: the split test starts on day one ────────────────────────────────────
for (const [level, ads] of [["toe", 2], ["standard", 3], ["hard", 4]]) {
  const { sentMeta, state } = await run({ level, platform: "meta" });
  eq(`${level} sends ${ads - 1} extra version${ads - 1 === 1 ? "" : "s"}`, (sentMeta.extraAds || []).length, ads - 1);
  eq(`${level} on Meta did not error`, state, "done");
}

{
  const { sentMeta } = await run({ level: "standard", platform: "meta" });
  ok("🔴 the extra versions are different copy, not the same ad twice",
    new Set([sentMeta.headline, ...sentMeta.extraAds.map((a) => a.headline)]).size === 3,
    "a test between identical ads teaches nothing");
  eq("they point at the same audience page", sentMeta.landingUrl, "https://boldlinemedia.com/for/roofers");
  ok("the picture comes from the library", !!sentMeta.imageUrl);
}

{
  // A writer that returns fewer versions than the level wants must not break the build.
  const { sentMeta, state } = await run({ level: "hard", platform: "meta",
    gen: { variants: [{ headline: "One", primaryText: "B" }, { headline: "Two", primaryText: "B" }] } });
  eq("fewer versions than asked for still builds", state, "done");
  eq("and sends only what it got", (sentMeta.extraAds || []).length, 1);
}

// ── 🔴 Every refusal sends nothing ────────────────────────────────────────────
{
  const noBudget = await run({ monthly: "0" });
  eq("no budget refuses", noBudget.state, "error");
  ok("🔴 and nothing was built", noBudget.sentGads === null && noBudget.sentMeta === null);

  const noLink = await run({ client: { ...CLIENT, googleAdsCustomerId: "" } });
  eq("an unlinked account refuses", noLink.state, "error");
  ok("🔴 and nothing was built", noLink.sentGads === null);

  const noWhere = await run({ locations: "  " });
  eq("no target location refuses", noWhere.state, "error");
  ok("🔴 and nothing was built", noWhere.sentGads === null,
    "without a location Google shows the ads in every country on earth");

  const noPic = await run({ platform: "meta", client: { ...CLIENT, mediaLibrary: [] } });
  eq("Meta with no picture refuses", noPic.state, "error");
  ok("🔴 and nothing was built", noPic.sentMeta === null, "Meta rejects a link ad with no image");

  const noPage = await run({ client: { ...CLIENT, landingPages: [{ id: "x", label: "Draft", slug: "draft", page: { published: false } }] } });
  eq("an audience with no live page refuses", noPage.state, "error");
  ok("🔴 and nothing was built", noPage.sentGads === null,
    "clicks would land on a coming-soon holder while the ads kept spending");

  // 🔴 AND THE SECOND GUARD ON ITS OWN. The case above is caught by the list filter before
  // build() is even reached, so it proves nothing about the re-check inside build(). This
  // hands build() a selection that is no longer live — which is what any other caller, or a
  // page switched off while this form sat open, looks like from in here. Constructed on
  // purpose: two guards that can only ever be tested together are one guard with a spare.
  const wentDark = await run({
    client: { ...CLIENT, landingPages: [{ id: "p1", label: "Roofers", slug: "roofers", page: { published: false } }] },
    forceChosen: { id: "p1", label: "Roofers", url: "https://boldlinemedia.com/for/roofers", live: true },
  });
  eq("🔴 a page switched off after it was picked still refuses", wentDark.state, "error");
  ok("🔴 and nothing was built", wentDark.sentGads === null);
  ok("and it names the page", /roofers/i.test(wentDark.msg), wentDark.msg);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE SERVER REALLY BUILDS THE EXTRA ADS
// ══════════════════════════════════════════════════════════════════════════════
{
  const code = META.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const i = code.indexOf("const extras = Array.isArray(p.extraAds)");
  ok("createCampaign takes extra ads at all", i > 0, "the second version has nowhere to go");
  const body = code.slice(i, i + 2200);
  ok("🔴 they go into the SAME ad set", /adset_id: adset\.id/.test(body),
    "a second ad set would double the spend instead of splitting it");
  ok("🔴 they are PAUSED like everything else", /status: "PAUSED"/.test(body),
    "an ad that can spend before he approves the campaign is the one thing this must never do");
  ok("🔴 they reuse the same picture", /vLink\.image_hash = imageHash/.test(body),
    "changing the picture and the words at once means a winner tells you nothing about either");
  ok("a blank version is skipped, not sent", /if \(!headline \|\| !body\) continue;/.test(body));
  ok("🔴 one failed extra does not fail the whole build", /catch \(e\) \{[\s\S]{0,400}console\.warn\("createCampaign: extra ad/.test(body),
    "the campaign and its first ad already exist by then, so throwing makes him build it twice");
  ok("and there is a cap", /slice\(0, 3\)/.test(body));
}

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-audience-ad-plan: ${pass} checks passed`);
