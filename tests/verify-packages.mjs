// Package-catalog integrity. Run: node tests/verify-packages.mjs
//
// WHY THIS FILE EXISTS IN THE REPO: earlier verification suites for this project were
// written into the session scratchpad, which does not survive a container restart, so
// "16 suites passing" was true at the time and then simply gone. Anything that guards a
// live invariant belongs in git.
//
// The package catalog is a FOUR-WAY DUAL COPY — index.html (the OS), portal.mjs (what
// the client sees), contract-shared.cjs (what they sign), marketing-site/index.html
// (what they were sold) — plus a fifth partial copy in pricing-shared.mjs that carries
// prices but no capability flags. Nothing but this test stops those four drifting, and
// drift here means the contract promises something the portal denies.

import { readFileSync } from "node:fs";

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
  const starts = ["const ALL_FEATURES = [", "const PACKAGES_DB = {"]
    .map((n) => src.indexOf(n)).filter((i) => i >= 0);
  if (!starts.length) throw new Error(`no package catalog found in ${path}`);
  const block = src.slice(Math.min(...starts), src.indexOf("const getUpgradeOptions"));
  const upgrade = sliceBlock(src.slice(src.indexOf("const getUpgradeOptions")), "const getUpgradeOptions", "\n};");
  // eslint-disable-next-line no-new-func
  return new Function(`${block}\n${upgrade}\nreturn { ALL_FEATURES, PKG_FEATURES, PACKAGES_DB, ALL_PKGS, getUpgradeOptions, pkgHasFeature, FEATURE_SUPERSEDES, keepsEverything, coversFeature };`)();
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
// The whole point of c-* is bundling two single-platform tiers at a discount, so a
// feature present in either half must survive the bundle. c-growth was missing
// split_testing, which m-growth has at $550 while c-growth costs $1,000.
const union = (a, b) => [...new Set([...os.PKG_FEATURES[a], ...os.PKG_FEATURES[b]])];
for (const [combined, g, m] of [["c-launch","g-launch","m-launch"], ["c-growth","g-growth","m-growth"], ["c-acquisition","g-acquisition","m-acquisition"]]) {
  const missing = union(g, m).filter((f) => !os.PKG_FEATURES[combined].includes(f));
  ok(`${combined} keeps everything from ${g} + ${m}`, missing.length === 0, `missing ${missing.join(",")}`);
  ok(`${combined} costs less than ${g} + ${m} separately`,
    osPkgs[combined].price < osPkgs[g].price + osPkgs[m].price);
}

// ── 4. No cheaper package outranks a dearer one on capability ────────────────
// The optics problem Bryson hit on a sales call: a prospect comparing two columns
// should never find the cheaper one strictly better equipped.
for (const a of SELLABLE) {
  for (const b of SELLABLE) {
    if (osPkgs[a].price <= osPkgs[b].price) continue;
    // Only compare within a product line; ecom and lead gen sell different things.
    if (a.split("-")[0] === "e" !== (b.split("-")[0] === "e")) continue;
    const bHas = os.PKG_FEATURES[b].filter((f) => !os.PKG_FEATURES[a].includes(f));
    const aHas = os.PKG_FEATURES[a].filter((f) => !os.PKG_FEATURES[b].includes(f));
    ok(`$${osPkgs[a].price} ${a} is not strictly beaten by $${osPkgs[b].price} ${b}`,
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
    ok(`${id} -> ${up} actually costs more`, osPkgs[up].price > osPkgs[id].price);
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
ok("c-launch -> c-growth is still offered (monthly_opt becomes weekly_opt)",
  os.getUpgradeOptions("c-launch").some((p) => p.id === "c-growth"));

// The top rung closes both Acquisition dead ends. Assert the paths exist AND that they
// are genuinely additive, since that was the whole reason c-growth could not serve here.
for (const from of ["g-acquisition", "m-acquisition", "c-growth", "c-launch"]) {
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
ok("c-acquisition is cheaper than buying both Acquisition tiers separately",
  osPkgs["c-acquisition"].price < osPkgs["g-acquisition"].price + osPkgs["m-acquisition"].price);
ok("c-acquisition setup is cheaper than both separately",
  osPkgs["c-acquisition"].setup < osPkgs["g-acquisition"].setup + osPkgs["m-acquisition"].setup);
eq("only c-acquisition carries the Most Powerful tag",
  os.ALL_PKGS.filter((p) => p.tag === "Most Powerful").map((p) => p.id).join(","), "c-acquisition");

// The four paths that violated the rule must stay gone.
for (const [from, to, why] of [
  ["g-growth", "c-launch", "strips the custom landing page, call tracking, weekly optimization and more"],
  ["m-growth", "c-launch", "strips the custom landing page, retargeting, lookalikes and split testing"],
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
const cards = [...site.matchAll(/<h3>([^<]+)<\/h3>[\s\S]{0,400}?Management starting at <b>\$([\d,]+)\/mo<\/b>[\s\S]{0,200}?Typical ad budget: ([^<]+)</g)]
  .map((m) => ({ title: m[1].trim(), price: Number(m[2].replace(/,/g, "")), budget: m[3].trim() }));
eq("site shows every package", cards.length, os.ALL_PKGS.length);
// The site writes "Full System: Launch", the catalog "Full System — Launch". Same product.
const norm = (n) => n.replace(/\s*[—:]\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
os.ALL_PKGS.forEach((p, i) => {
  const c = cards[i];
  ok(`site card ${i + 1} is ${p.id}`, !!c && norm(c.title) === norm(p.name), c ? `site says "${c.title}"` : "missing");
  if (!c) return;
  eq(`${p.id} price matches the site`, c.price, p.price);
  eq(`${p.id} ad budget matches the site`, c.budget.replace(/\u2013|\u2014/g, "-"), String(p.adSpend).replace(/\u2013|\u2014/g, "-"));
});
// The site deliberately does not publish setup or per-lead fees (those come up on the
// call). If that ever changes, these numbers have to be kept in step too.
ok("site still does not publish setup fees", !/setup fee/i.test(site));

ok("Full System: Growth card advertises split testing and multi-campaign", (() => {
  const i = site.indexOf("<h3>Full System: Growth</h3>");
  if (i < 0) return false;
  const card = site.slice(i, site.indexOf("</ul>", i));
  return card.includes('data-term="split-testing"') && card.includes('data-term="multi-campaign"');
})());
for (const card of ["Full System: Launch"]) {
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
