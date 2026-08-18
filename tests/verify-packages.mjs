// Package-catalog integrity. Run: node tests/verify-packages.mjs
//
// WHY THIS FILE EXISTS IN THE REPO: earlier verification suites for this project were
// written into the session scratchpad, which does not survive a container restart, so
// "16 suites passing" was true at the time and then simply gone. Anything that guards a
// live invariant belongs in git.
//
// The package catalog is a FIVE-WAY DUAL COPY — index.html (the OS), portal.mjs (what
// the client sees), contract-shared.cjs (what they sign), marketing-site/index.html
// (what they were sold), and pricing-shared.mjs (what Deal Prep and the lead scout
// quote on a call). Nothing but this test stops those five drifting, and drift here
// means the contract promises something the portal denies.
//
// PRICING MODEL, rewritten 2026-08-18: there is no monthly management fee. `price` is a
// monthly MINIMUM and the performance fee counts toward it — the client pays whichever
// is higher, never both. Lead gen bills per qualified lead; e-commerce bills a % of ad
// spend. Several assertions below changed direction because of that, most importantly
// the upgrade ladder, which now ranks by TIER instead of price: a single platform and
// the combined system deliberately share a monthly minimum at the same tier.

import { readFileSync } from "node:fs";
import * as shared from "../netlify/lib/pricing-shared.mjs";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) { pass++; return; }
  fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};
const eq = (label, actual, expected) =>
  ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const same = (label, a, b) => {
  const A = [...a].sort(), B = [...b].sort();
  const missing = B.filter((x) => !A.includes(x));
  const extra = A.filter((x) => !B.includes(x));
  ok(label, !missing.length && !extra.length,
    [missing.length && `missing ${missing.join(",")}`, extra.length && `extra ${extra.join(",")}`].filter(Boolean).join("; "));
};

// ── Extract the real data blocks rather than restating them ────────────────────
// Restating the catalog here would just create a fifth copy to drift.
// `inclusive` controls whether the end marker itself is kept: keep it when it closes
// the block (a trailing "};"), drop it when it merely marks where to stop.
const sliceBlock = (src, startNeedle, endNeedle, inclusive = true) => {
  const i = src.indexOf(startNeedle);
  if (i < 0) throw new Error(`could not find ${JSON.stringify(startNeedle)}`);
  const j = src.indexOf(endNeedle, i + startNeedle.length);
  if (j < 0) throw new Error(`could not find ${JSON.stringify(endNeedle)} after it`);
  return src.slice(i, inclusive ? j + endNeedle.length : j);
};

const loadCatalog = (path) => {
  const src = readFileSync(path, "utf8");
  // The two files declare these in a different order — portal.mjs opens with
  // PACKAGES_DB, index.html with ALL_FEATURES — so start at whichever comes first
  // rather than assuming a layout.
  const starts = ["const ALL_FEATURES = [", "const MIN_AD_BUDGET", "const PACKAGES_DB = {"]
    .map((n) => src.indexOf(n)).filter((i) => i >= 0);
  if (!starts.length) throw new Error(`no package catalog found in ${path}`);
  const block = src.slice(Math.min(...starts), src.indexOf("const getUpgradeOptions"));
  const upgrade = sliceBlock(src.slice(src.indexOf("const getUpgradeOptions")), "const getUpgradeOptions", "\n};");
  // eslint-disable-next-line no-new-func
  return new Function(`${block}\n${upgrade}\nreturn { ALL_FEATURES, PKG_FEATURES, PACKAGES_DB, ALL_PKGS, getUpgradeOptions, pkgHasFeature, FEATURE_SUPERSEDES, keepsEverything, coversFeature, calcMonthlyBill, TIER_RANK, MIN_AD_BUDGET, COMBO_MIN_BUDGET };`)();
};

const os = loadCatalog("index.html");
const portal = loadCatalog("netlify/functions/portal.mjs");
const contractSrc = readFileSync("netlify/lib/contract-shared.cjs", "utf8");
const contract = new Function(
  `${sliceBlock(contractSrc, "const PKG_FEATURES = {", "\n};")}\nreturn PKG_FEATURES;`
)();
const contractFeatures = new Function(
  `${sliceBlock(contractSrc, "const ALL_FEATURES = [", "\n];")}\nreturn ALL_FEATURES;`
)();
const site = readFileSync("marketing-site/index.html", "utf8");

const byId = (cat) => Object.fromEntries(cat.ALL_PKGS.map((p) => [p.id, p]));
const osPkgs = byId(os);
const SELLABLE = os.ALL_PKGS.map((p) => p.id);

// ── 1. The four copies agree ──────────────────────────────────────────────────
eq("catalog sizes match (os vs portal)", os.ALL_PKGS.length, portal.ALL_PKGS.length);
const FLAGS = ["price","setup","leadFee","optimizationFreq","callTracking","weeklyOptimization",
  "customLandingPage","retargeting","splitTesting","crmIntegration","multiCampaign"];
for (const id of SELLABLE) {
  const a = osPkgs[id], b = byId(portal)[id];
  ok(`portal knows ${id}`, !!b);
  if (!b) continue;
  for (const f of FLAGS) eq(`${id}.${f} agrees (os vs portal)`, b[f], a[f]);
  same(`${id} features agree (os vs portal)`, portal.PKG_FEATURES[id] || [], os.PKG_FEATURES[id] || []);
  same(`${id} features agree (os vs contract)`, contract[id] || [], os.PKG_FEATURES[id] || []);
}

// ── 2. The capability FLAG and the FEATURE LIST never disagree ────────────────
// These are two independent encodings of the same fact, which is exactly how
// c-growth ended up with multiCampaign:false while priced above g-acquisition.
const FLAG_TO_FEATURE = {
  splitTesting: "split_testing",
  multiCampaign: "multi_campaign",
  callTracking: "call_tracking",
  crmIntegration: "crm_integration",
  retargeting: "retargeting",
};
for (const id of SELLABLE) {
  for (const [flag, feat] of Object.entries(FLAG_TO_FEATURE)) {
    eq(`${id}: flag ${flag} matches feature ${feat}`,
      !!osPkgs[id][flag], os.PKG_FEATURES[id].includes(feat));
  }
}

// ── 3. A combined package is never weaker than what it combines ──────────────
// The whole point of c-* is bundling two single-platform tiers, so a feature present in
// either half must survive the bundle. c-growth was once missing split_testing, which
// m-growth had at a lower price.
const union = (a, b) => [...new Set([...os.PKG_FEATURES[a], ...os.PKG_FEATURES[b]])];
for (const [combined, g, m] of [["c-growth","g-growth","m-growth"], ["c-acquisition","g-acquisition","m-acquisition"]]) {
  const missing = union(g, m).filter((f) => !os.PKG_FEATURES[combined].includes(f));
  ok(`${combined} keeps everything from ${g} + ${m}`, missing.length === 0, `missing ${missing.join(",")}`);
  // The SETUP is where combined legitimately costs more (two builds) but still beats
  // buying both. The monthly MINIMUM is deliberately identical — see rule 2 below.
  ok(`${combined} setup costs less than ${g} + ${m} separately`,
    osPkgs[combined].setup < osPkgs[g].setup + osPkgs[m].setup);
  ok(`${combined} setup costs more than one platform alone`,
    osPkgs[combined].setup > osPkgs[g].setup, "two builds is more work than one");
}
eq("there is no combined Launch tier", os.ALL_PKGS.filter((p) => p.id === "c-launch").length, 0);

// ── 3b. PLATFORM IS A CHOICE, NOT A PRICE ────────────────────────────────────
// The old catalog charged $600 for Google Growth and $550 for Meta Growth for no
// defensible reason. A prospect who wants Facebook instead of Google is not buying a
// different-value product, so the price may not move. Setup may not move either: both
// are one build. Only COMBINED costs more, and only in setup.
for (const tier of ["launch", "growth", "acquisition"]) {
  const inTier = os.ALL_PKGS.filter((p) => p.tier === tier && !p.id.startsWith("e-"));
  const single = inTier.filter((p) => !p.id.startsWith("c-"));
  ok(`${tier}: both single platforms exist`, single.length === 2, `found ${single.map((p) => p.id).join(",")}`);
  eq(`${tier}: Google and Meta share a monthly minimum`, single[0].price, single[1].price);
  eq(`${tier}: Google and Meta share a setup fee`, single[0].setup, single[1].setup);
  for (const p of inTier) {
    eq(`${tier}: ${p.id} carries the tier minimum`, p.price, single[0].price);
  }
}

// ── 3c. TIER IS DECIDED BY AD BUDGET, AND THE BANDS DO NOT OVERLAP OR GAP ────
const TIER_ORDER = ["launch", "growth", "acquisition"];
const tierMin = (t) => os.ALL_PKGS.find((p) => p.tier === t).price;
ok("tier minimums increase", tierMin("launch") < tierMin("growth") && tierMin("growth") < tierMin("acquisition"),
  TIER_ORDER.map((t) => `${t}=$${tierMin(t)}`).join(" "));
for (const p of os.ALL_PKGS) {
  ok(`${p.id} has a known tier`, TIER_ORDER.includes(p.tier), `got ${JSON.stringify(p.tier)}`);
  ok(`${p.id} has an ad-budget floor`, p.minBudget >= os.MIN_AD_BUDGET,
    `${p.minBudget} is below the ${os.MIN_AD_BUDGET} minimum ad budget`);
  ok(`${p.id} budget band is ordered`, p.maxBudget === null || p.maxBudget > p.minBudget);
  // The top tier is open-ended; everything else must hand over to the next one exactly.
  if (p.tier === "acquisition") eq(`${p.id} top tier is open-ended`, p.maxBudget, null);
}
for (const t of ["launch", "growth"]) {
  const next = TIER_ORDER[TIER_ORDER.indexOf(t) + 1];
  const singles = os.ALL_PKGS.filter((p) => p.tier === t && !p.id.startsWith("c-"));
  for (const p of singles) {
    eq(`${p.id} hands over to the ${next} tier with no gap`, p.maxBudget,
      os.ALL_PKGS.find((q) => q.tier === next && !q.id.startsWith("c-")).minBudget);
  }
}

// ── 3d. COMBINED IS A BUDGET UNLOCK ──────────────────────────────────────────
// Splitting a small budget across two platforms means neither learns. This is the
// honest reason there is no combined Launch tier, and it must hold in the data.
for (const p of os.ALL_PKGS.filter((x) => x.id.startsWith("c-"))) {
  ok(`${p.id} requires at least $${os.COMBO_MIN_BUDGET} of ad budget`, p.minBudget >= os.COMBO_MIN_BUDGET,
    `minBudget is ${p.minBudget}`);
  ok(`${p.id} is not a Launch tier`, p.tier !== "launch");
}
// Same reasoning on the e-commerce side: nothing below the combined floor runs two
// platforms. Store Growth lost Google Shopping for exactly this reason.
for (const p of os.ALL_PKGS) {
  const twoPlatforms = /\+/.test(p.platform) || os.PKG_FEATURES[p.id].includes("google_shopping");
  if (!twoPlatforms) continue;
  ok(`${p.id} runs two platforms only above $${os.COMBO_MIN_BUDGET} of ad budget`,
    p.minBudget >= os.COMBO_MIN_BUDGET, `${p.platform} at a $${p.minBudget} floor`);
}

// ── 3e. THE TWO BILLING MODELS ARE CLEANLY SPLIT ─────────────────────────────
for (const p of os.ALL_PKGS) {
  const ecom = p.id.startsWith("e-");
  eq(`${p.id} pricing model`, p.pricingModel, ecom ? "ad_spend_pct" : "per_lead");
  eq(`${p.id} leadFee flag matches its model`, !!p.leadFee, !ecom);
  if (ecom) ok(`${p.id} has an ad-spend percentage`, p.adSpendPct > 0 && p.adSpendPct < 100, String(p.adSpendPct));
  else ok(`${p.id} has no ad-spend percentage`, p.adSpendPct === undefined);
}
// E-commerce percentages must not go UP with tier: a bigger spender pays a smaller share.
{
  const pcts = ["e-launch", "e-growth", "e-domination"].map((id) => osPkgs[id].adSpendPct);
  ok("e-commerce percentage never rises with tier", pcts[0] >= pcts[1] && pcts[1] >= pcts[2], pcts.join(" -> "));
}
// The ROAS bonus was a second fee stacked on a retainer — the exact thing this rewrite
// removed. If it comes back anywhere, the contract renders a clause for a fee nobody quoted.
for (const p of os.ALL_PKGS) ok(`${p.id} carries no ROAS bonus`, p.roas === undefined, String(p.roas));
ok("no ROAS bonus survives in the contract copy", !/roas/i.test(contractSrc) || !/pkg\.roas/.test(contractSrc),
  "contract still branches on pkg.roas");

// ── 3f. "WHICHEVER IS MORE" ──────────────────────────────────────────────────
// Bryson, 2026-08-18: "if we would only make $180 off of the leads we generated but the
// bottom is $200 then they pay the $200 but if we make more than the bottom then we take
// whichever is more." Asserted on the real function, in both models and at the boundary.
{
  const g = osPkgs["g-growth"];       // $700 floor, per lead
  const e = osPkgs["e-growth"];       // $700 floor, 15% of ad spend
  const bill = (pkg, args) => os.calcMonthlyBill(pkg, args);

  eq("under the floor bills the floor", bill(g, { qualifiedLeads: 4, perLeadFee: 45 }).billed, 700);
  eq("under the floor is flagged", bill(g, { qualifiedLeads: 4, perLeadFee: 45 }).atFloor, true);
  eq("over the floor bills what was earned", bill(g, { qualifiedLeads: 30, perLeadFee: 45 }).billed, 1350);
  eq("over the floor is not flagged", bill(g, { qualifiedLeads: 30, perLeadFee: 45 }).atFloor, false);
  eq("exactly the floor bills the floor once", bill(g, { qualifiedLeads: 14, perLeadFee: 50 }).billed, 700);
  eq("exactly the floor is not 'at floor'", bill(g, { qualifiedLeads: 14, perLeadFee: 50 }).atFloor, false);
  eq("a dead month still bills the floor", bill(g, { qualifiedLeads: 0, perLeadFee: 45 }).billed, 700);
  // THE WHOLE POINT: the two halves are never added together. This is the assertion that
  // would have caught the model Stencil & Thread turned down.
  ok("the floor and the fee are never both charged",
    bill(g, { qualifiedLeads: 30, perLeadFee: 45 }).billed < 700 + 1350);

  eq("ecom under the floor bills the floor", bill(e, { adSpend: 3000 }).billed, 700);
  eq("ecom over the floor bills the percentage", bill(e, { adSpend: 8000 }).billed, 1200);
  eq("ecom ignores lead counts", bill(e, { adSpend: 8000, qualifiedLeads: 99, perLeadFee: 99 }).billed, 1200);
  eq("lead gen ignores ad spend", bill(g, { adSpend: 90000, qualifiedLeads: 2, perLeadFee: 45 }).billed, 700);
  eq("no package bills nothing", bill(null, {}).billed, 0);

  // The portal must reach the same number as the OS, or a client is shown one figure and
  // invoiced another. Same for what Deal Prep quotes on the call.
  for (const args of [{ qualifiedLeads: 4, perLeadFee: 45 }, { qualifiedLeads: 30, perLeadFee: 45 }, { adSpend: 8000 }]) {
    for (const id of ["g-growth", "e-growth", "c-acquisition"]) {
      eq(`portal agrees on the bill for ${id} ${JSON.stringify(args)}`,
        portal.calcMonthlyBill(byId(portal)[id], args).billed, os.calcMonthlyBill(osPkgs[id], args).billed);
      eq(`pricing-shared agrees on the bill for ${id} ${JSON.stringify(args)}`,
        shared.calcMonthlyBill(shared.PACKAGES.find((p) => p.id === id), args).billed,
        os.calcMonthlyBill(osPkgs[id], args).billed);
    }
  }
}

// ── 3g. The fifth copy (Deal Prep + lead scout) agrees ───────────────────────
// This copy is what gets quoted OUT LOUD on a sales call, so it drifting is the most
// expensive kind. It was never checked before.
eq("pricing-shared has the same packages", shared.PACKAGES.length, os.ALL_PKGS.length);
eq("pricing-shared agrees on the ad-budget floor", shared.MIN_AD_BUDGET, os.MIN_AD_BUDGET);
eq("pricing-shared agrees on the combined unlock", shared.COMBO_MIN_BUDGET, os.COMBO_MIN_BUDGET);
eq("portal agrees on the ad-budget floor", portal.MIN_AD_BUDGET, os.MIN_AD_BUDGET);
eq("portal agrees on the combined unlock", portal.COMBO_MIN_BUDGET, os.COMBO_MIN_BUDGET);
for (const p of os.ALL_PKGS) {
  const q = shared.PACKAGES.find((x) => x.id === p.id);
  ok(`pricing-shared knows ${p.id}`, !!q);
  if (!q) continue;
  for (const f of ["name", "price", "setup", "leadFee", "pricingModel", "adSpendPct", "tier", "adSpend", "minBudget", "maxBudget"]) {
    eq(`${p.id}.${f} agrees (os vs pricing-shared)`, q[f], p[f]);
  }
}
// The quote block a model reads aloud must not describe a retainer PLUS a fee.
{
  const block = shared.packagesPromptBlock(75);
  ok("the quote block says MINIMUM", /MINIMUM/.test(block));
  ok("the quote block says whichever is higher", /whichever is higher/i.test(block));
  ok("the quote block says never both", /never both/i.test(block));
  ok("the quote block never says management fee", !/management/i.test(block));
  ok("the quote block never mentions a ROAS bonus", !/roas/i.test(block));
  ok("the quote block covers every package", os.ALL_PKGS.every((p) => block.includes(p.id)));
}

// ── 4. No cheaper package outranks a dearer one on capability ────────────────
// The optics problem Bryson hit on a sales call: a prospect comparing two columns
// should never find the cheaper one strictly better equipped.
// Compared by TIER now, because two packages sharing a price is deliberate under the
// 2026-08-18 model. The optics problem is unchanged: a prospect reading two columns must
// never find the lower tier strictly better equipped.
for (const a of SELLABLE) {
  for (const b of SELLABLE) {
    if ((os.TIER_RANK[osPkgs[a].tier] || 0) <= (os.TIER_RANK[osPkgs[b].tier] || 0)) continue;
    // Only compare within a product line; ecom and lead gen sell different things.
    if (a.split("-")[0] === "e" !== (b.split("-")[0] === "e")) continue;
    const bHas = os.PKG_FEATURES[b].filter((f) => !os.PKG_FEATURES[a].includes(f));
    const aHas = os.PKG_FEATURES[a].filter((f) => !os.PKG_FEATURES[b].includes(f));
    ok(`${osPkgs[a].tier} ${a} is not strictly beaten by ${osPkgs[b].tier} ${b}`,
      !(bHas.length > 0 && aHas.length === 0), `${b} adds ${bHas.join(",")} and gives up nothing`);
  }
}

// ── 5. Upgrade ladders stay inside the product line ──────────────────────────
const fam = (id) => id.split("-")[0];
for (const id of SELLABLE) {
  const opts = os.getUpgradeOptions(id).map((p) => p.id);
  same(`upgrade ladder agrees (os vs portal) for ${id}`, portal.getUpgradeOptions(id).map((p) => p.id), opts);
  for (const up of opts) {
    ok(`${id} is not offered ${up} across product lines`, (fam(up) === "e") === (fam(id) === "e"),
      "e-commerce and lead gen must never cross-sell");
    ok(`${id} is not offered ${up} (would drop a channel)`, !(fam(id) === "c" && fam(up) !== "c"),
      "a combined client must not be sold a single-platform package");
    // Not "costs more": Google Growth -> Full System Growth is the single best upsell in
    // the catalog and carries the SAME monthly minimum. What makes it an upgrade is the
    // tier holding and the feature set growing, which the next assertion checks.
    ok(`${id} -> ${up} never drops a tier`,
      (os.TIER_RANK[osPkgs[up].tier] || 0) >= (os.TIER_RANK[osPkgs[id].tier] || 0));
    ok(`${id} -> ${up} never lowers the monthly minimum`, osPkgs[up].price >= osPkgs[id].price);
    const gains = os.PKG_FEATURES[up].filter((f) => !os.PKG_FEATURES[id].includes(f));
    ok(`${id} -> ${up} adds something`, gains.length > 0, "an upgrade with nothing new is not an upgrade");
  }
}
eq("house account is never sold anything", os.getUpgradeOptions("bl-house").length, 0);
ok("g-launch is no longer offered an e-commerce package",
  !os.getUpgradeOptions("g-launch").some((p) => fam(p.id) === "e"));

// ── 5b. AN UPGRADE NEVER TAKES SOMETHING AWAY ────────────────────────────────
// Bryson, 2026-08-17: "each time a client upgrades they keep what they paid for
// before and they gain each time they upgrade." The portal shows the client only
// what an upgrade GAINS, so offering one that silently drops a paid-for feature is
// a misrepresentation, not just an inelegance.
for (const id of SELLABLE) {
  for (const up of os.getUpgradeOptions(id)) {
    const lost = os.PKG_FEATURES[id].filter((f) => !os.coversFeature(os.PKG_FEATURES[up.id], f));
    ok(`${id} -> ${up.id} keeps everything paid for`, lost.length === 0, `loses ${lost.join(",")}`);
  }
}
// Supersession is the ONLY reason a literal superset test is not used, so the map has
// to stay small and real: both sides must be actual features, and the replacement must
// never be cheaper-tier than the thing it replaces.
for (const [better, replaced] of Object.entries(os.FEATURE_SUPERSEDES)) {
  ok(`supersession target ${better} is a real feature`, os.ALL_FEATURES.some((f) => f.id === better));
  for (const r of replaced) {
    ok(`superseded feature ${r} is a real feature`, os.ALL_FEATURES.some((f) => f.id === r));
    ok(`${better} and ${r} never appear in the same package`,
      !SELLABLE.some((id) => os.PKG_FEATURES[id].includes(better) && os.PKG_FEATURES[id].includes(r)),
      "if a package has both, one does not replace the other");
  }
}
same("supersession map agrees (os vs portal)",
  Object.keys(portal.FEATURE_SUPERSEDES), Object.keys(os.FEATURE_SUPERSEDES));
// The basic ladder must survive the rule — this is what a naive superset test broke.
ok("g-launch -> g-growth is still offered (std_landing becomes custom_landing)",
  os.getUpgradeOptions("g-launch").some((p) => p.id === "g-growth"));
// The same-minimum upsell that the old price-ranked ladder hid entirely.
for (const [from, to] of [["g-growth", "c-growth"], ["m-growth", "c-growth"], ["g-launch", "c-growth"]]) {
  ok(`${from} -> ${to} is offered even though the monthly minimum is unchanged`,
    os.getUpgradeOptions(from).some((p) => p.id === to),
    `only offered ${os.getUpgradeOptions(from).map((p) => p.id).join(",") || "nothing"}`);
}
eq("g-growth -> c-growth really is the same monthly minimum", osPkgs["c-growth"].price, osPkgs["g-growth"].price);

// The top rung closes both Acquisition dead ends. Assert the paths exist AND that they
// are genuinely additive, since that was the whole reason c-growth could not serve here.
for (const from of ["g-acquisition", "m-acquisition", "c-growth"]) {
  const opts = os.getUpgradeOptions(from).map((p) => p.id);
  ok(`${from} can upgrade to c-acquisition`, opts.includes("c-acquisition"), `only offered ${opts.join(",") || "nothing"}`);
}
ok("c-acquisition carries everything from both Acquisition tiers and c-growth", (() => {
  const need = [...new Set([...os.PKG_FEATURES["g-acquisition"], ...os.PKG_FEATURES["m-acquisition"], ...os.PKG_FEATURES["c-growth"]])];
  return need.every((f) => os.coversFeature(os.PKG_FEATURES["c-acquisition"], f));
})());
ok("c-acquisition invents no feature of its own", (() => {
  const need = [...new Set([...os.PKG_FEATURES["g-acquisition"], ...os.PKG_FEATURES["m-acquisition"], ...os.PKG_FEATURES["c-growth"]])];
  return os.PKG_FEATURES["c-acquisition"].every((f) => need.includes(f));
})(), "it is defined as the union of what it bundles, nothing more");
ok("c-acquisition setup is cheaper than both Acquisition tiers separately",
  osPkgs["c-acquisition"].setup < osPkgs["g-acquisition"].setup + osPkgs["m-acquisition"].setup);
eq("only c-acquisition carries the Most Powerful tag",
  os.ALL_PKGS.filter((p) => p.tag === "Most Powerful").map((p) => p.id).join(","), "c-acquisition");

// The four paths that violated the rule must stay gone.
// (The two c-launch rows that used to live here are gone with the package itself — the
// 2026-08-18 model has no combined Launch tier to downgrade into.)
for (const [from, to, why] of [
  ["g-acquisition", "c-growth", "drops the scaling roadmap and priority communication"],
  ["m-acquisition", "c-growth", "drops the full funnel, scaling roadmap and priority communication"],
]) {
  ok(`${from} is NOT offered ${to}`, !os.getUpgradeOptions(from).some((p) => p.id === to), why);
}

// Both guards are load-bearing. Without the family rule, an e-commerce store on
// e-launch would be offered m-growth, which IS a feature superset of it — the
// "keeps everything" test alone would let that through.
ok("m-growth really is a superset of e-launch (so the family guard is doing work)",
  os.keepsEverything("e-launch", "m-growth"));
ok("but e-launch is never offered m-growth",
  !os.getUpgradeOptions("e-launch").some((p) => p.id === "m-growth"));

// Dead ends are locked in deliberately: if a catalog edit strands a package that
// used to have somewhere to go, this fails and forces the decision to be made
// rather than silently shipping a client with no upgrade path.
const LADDER_TOPS = ["c-acquisition", "e-domination"];
for (const id of SELLABLE) {
  const opts = os.getUpgradeOptions(id).map((p) => p.id);
  if (LADDER_TOPS.includes(id)) eq(`${id} is a ladder top (no upgrade)`, opts.length, 0);
  else ok(`${id} has somewhere to upgrade to`, opts.length > 0, "stranded with no upgrade path");
}

// ── 6. The marketing site matches what the OS believes it sells ──────────────
// A prospect reads the site; the contract and portal have to agree with it.
const liBullets = site.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) || [];
const bulletCount = (term) => liBullets.filter((li) => li.includes(`data-term="${term}"`)).length;
const flagCount = (flag) => os.ALL_PKGS.filter((p) => p[flag]).length;
eq("site multi-campaign bullets match multiCampaign packages", bulletCount("multi-campaign"), flagCount("multiCampaign"));
eq("site split-testing bullets match splitTesting packages", bulletCount("split-testing"), flagCount("splitTesting"));
// EVERY package, price and budget band on the site must match the catalog, in order.
// Previously only two feature bullets were checked, so a price could drift silently and
// a prospect would read one number on the site and hear another on the call.
const cards = [...site.matchAll(/<h3>([^<]+)<\/h3>[\s\S]{0,400}?class="price">From <b>\$([\d,]+)\/mo<\/b>[\s\S]{0,60}?class="pnote">([\s\S]*?)<\/div>[\s\S]{0,200}?Typical ad budget: ([^<]+)</g)]
  .map((m) => ({ title: m[1].trim(), price: Number(m[2].replace(/,/g, "")), perf: m[3].trim(), budget: m[4].trim() }));
eq("site shows every package", cards.length, os.ALL_PKGS.length);
// The site writes "Full System: Launch", the catalog "Full System — Launch". Same product.
const norm = (n) => n.replace(/\s*[—:]\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
os.ALL_PKGS.forEach((p, i) => {
  const c = cards[i];
  ok(`site card ${i + 1} is ${p.id}`, !!c && norm(c.title) === norm(p.name), c ? `site says "${c.title}"` : "missing");
  if (!c) return;
  eq(`${p.id} price matches the site`, c.price, p.price);
  eq(`${p.id} ad budget matches the site`, c.budget.replace(/\u2013|\u2014/g, "-"), String(p.adSpend).replace(/\u2013|\u2014/g, "-"));
  // The site must state the SAME billing model the contract will. A store card promising
  // a per-lead fee, or a service card quoting a percentage, is a mis-sale on page one.
  ok(`${p.id} states the greater-of rule on the site`, /whichever is higher, never both/.test(c.perf), c.perf);
  if (p.pricingModel === "ad_spend_pct")
    ok(`${p.id} quotes ${p.adSpendPct}% of ad spend on the site`, c.perf.includes(`${p.adSpendPct}% of your ad spend`), c.perf);
  else
    ok(`${p.id} quotes a per-lead fee on the site`, /qualified lead/.test(c.perf), c.perf);
});
// The site sold a "Performance bonus ... ROAS" for months. That was a second fee on top
// of a retainer, which is exactly what this model removed.
ok("the site no longer advertises a performance bonus", !/performance bonus/i.test(site));
// The two rules a prospect must not be able to miss.
ok("the site states the $5,000 combined unlock", /both platforms starts at \$5,000 a month/i.test(site));
ok("the site states the minimum ad budget", /smallest budget we'?.{0,3}ll take on is \$500 a month/i.test(site));
ok("the site says the two fees are never added together", /Never both added together/i.test(site));
// The recommender must not be able to recommend a combined system below the unlock.
ok("the recommender gates combined on the ad-budget band", /COMBO_MIN_BAND/.test(site));
ok("the recommender no longer offers a combined Launch tier", !/Full System: Launch/.test(site));
// The site deliberately does not publish setup or per-lead fees (those come up on the
// call). If that ever changes, these numbers have to be kept in step too.
ok("site still does not publish setup fees", !/setup fee/i.test(site));

ok("Full System: Growth card advertises split testing and multi-campaign", (() => {
  const i = site.indexOf("<h3>Full System: Growth</h3>");
  if (i < 0) return false;
  const card = site.slice(i, site.indexOf("</ul>", i));
  return card.includes('data-term="split-testing"') && card.includes('data-term="multi-campaign"');
})());
eq("the site no longer sells a combined Launch tier", site.indexOf("<h3>Full System: Launch</h3>"), -1);
for (const card of ["Launch System"]) {
  const i = site.indexOf(`<h3>${card}</h3>`);
  const body = site.slice(i, site.indexOf("</ul>", i));
  ok(`${card} card still does NOT claim multi-campaign`, !body.includes('data-term="multi-campaign"'));
}

// ── 6b. No sold feature may promise a tool that does not exist ──────────────
// "Priority Support + Slack Access" shipped on Store Domination for months with no
// BoldLine Slack workspace behind it, in the OS, the portal AND the signed service
// agreement. Renamed 2026-08-17. This stops it, or anything like it, coming back.
const VAPOUR = [/slack/i, /discord/i, /whatsapp/i, /telegram/i];
for (const f of os.ALL_FEATURES) {
  for (const re of VAPOUR) {
    ok(`feature label "${f.label}" names no tool we do not run`, !re.test(f.label),
      `matches ${re} — do not sell a channel that does not exist`);
  }
}
// All three copies must carry the same labels, not just the same ids: the contract renders
// from its own copy, so a stale label there is what a client actually signs.
for (const f of os.ALL_FEATURES) {
  const pf = portal.ALL_FEATURES.find((x) => x.id === f.id);
  const cf = contractFeatures.find((x) => x.id === f.id);
  ok(`portal label matches for ${f.id}`, !!pf && pf.label === f.label,
    pf ? `portal says "${pf.label}"` : "missing from portal");
  ok(`contract label matches for ${f.id}`, !!cf && cf.label === f.label,
    cf ? `contract says "${cf.label}"` : "missing from contract");
}

// ── 7. Every sellable package still resolves and is priced ──────────────────
for (const id of SELLABLE) {
  ok(`${id} has a positive price`, osPkgs[id].price > 0);
  ok(`${id} has features`, (os.PKG_FEATURES[id] || []).length > 0);
}
ok("house account carries every feature", (() => {
  const all = new Set(SELLABLE.flatMap((id) => os.PKG_FEATURES[id]));
  return [...all].every((f) => os.PKG_FEATURES["bl-house"].includes(f));
})());

// ── Report ───────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n✕ ${fails.length} failed, ${pass} passed\n`);
  for (const f of fails) console.error("  ✕ " + f);
  process.exit(1);
}
console.log(`✓ verify-packages: ${pass} assertions passed`);
