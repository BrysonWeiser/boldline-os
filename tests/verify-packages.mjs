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
  return new Function(`${block}\n${upgrade}\nreturn { ALL_FEATURES, PKG_FEATURES, PACKAGES_DB, ALL_PKGS, getUpgradeOptions, pkgHasFeature };`)();
};

const os = loadCatalog("index.html");
const portal = loadCatalog("netlify/functions/portal.mjs");
const contractSrc = readFileSync("netlify/lib/contract-shared.cjs", "utf8");
const contract = new Function(
  `${sliceBlock(contractSrc, "const PKG_FEATURES = {", "\n};")}\nreturn PKG_FEATURES;`
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
for (const [combined, g, m] of [["c-launch","g-launch","m-launch"], ["c-growth","g-growth","m-growth"]]) {
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
eq("c-growth is the top of the lead-gen ladder", os.getUpgradeOptions("c-growth").length, 0);
eq("house account is never sold anything", os.getUpgradeOptions("bl-house").length, 0);
ok("g-launch is no longer offered an e-commerce package",
  !os.getUpgradeOptions("g-launch").some((p) => fam(p.id) === "e"));

// ── 6. The marketing site matches what the OS believes it sells ──────────────
// A prospect reads the site; the contract and portal have to agree with it.
const liBullets = site.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) || [];
const bulletCount = (term) => liBullets.filter((li) => li.includes(`data-term="${term}"`)).length;
const flagCount = (flag) => os.ALL_PKGS.filter((p) => p[flag]).length;
eq("site multi-campaign bullets match multiCampaign packages", bulletCount("multi-campaign"), flagCount("multiCampaign"));
eq("site split-testing bullets match splitTesting packages", bulletCount("split-testing"), flagCount("splitTesting"));
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
