// What the website promises, against what a package actually includes.
// Run: node tests/verify-site-matches-packages.mjs
//
// 🔴 FOUND 2026-09-16, AND NOTHING WAS LOOKING FOR IT. The marketing site's **Store Launch** card
// said "Landing page included". `PKG_FEATURES["e-launch"]` did not list a landing page. So the
// site sold something the package did not record, which means a Store Launch client's AGREEMENT
// listed no landing page at all — a promise made in public and missing from the document they
// sign. 1,140 assertions in verify-packages passed the whole time, because every one of them
// compares the OS, the portal and the contract with EACH OTHER. All three agreed. They were all
// wrong together, and the only thing that disagreed was the website nobody was comparing.
//
// This suite closes that loop: for every package card on the public site, each bullet it
// advertises must be a feature that package really has.
//
// It is deliberately a SMALL, EXPLICIT vocabulary rather than clever prose matching. A bullet
// nobody has mapped is reported, not ignored — an unmapped bullet is the exact shape of the bug
// (a promise nothing checks), so silence would rebuild the hole this was written to close.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));

const SITE = readFileSync(new URL("../marketing-site/index.html", import.meta.url), "utf8");
const OS = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const block = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)) + end.length);
const { PKG_FEATURES, ALL_FEATURES, FEATURE_SUPERSEDES } = new Function(
  block(OS, "const ALL_FEATURES = [", "\n];") + "\n" +
  block(OS, "const PKG_FEATURES = {", "\n};") + "\n" +
  block(OS, "const FEATURE_SUPERSEDES = {", "\n};") +
  "\nreturn { PKG_FEATURES, ALL_FEATURES, FEATURE_SUPERSEDES };")();

// A package HAS a feature if it lists it, or lists something that supersedes it (a custom
// landing page is a standard one and more).
const has = (pkgId, feat) => {
  const f = PKG_FEATURES[pkgId] || [];
  return f.includes(feat) || f.some((t) => (FEATURE_SUPERSEDES[t] || []).includes(feat));
};

// panel + card heading -> package id. The headings repeat across tabs (two "Launch System"
// cards), so the panel is part of the key.
const ID = {
  "google|Launch System": "g-launch", "google|Growth System": "g-growth", "google|Acquisition System": "g-acquisition",
  "meta|Launch System": "m-launch", "meta|Growth System": "m-growth", "meta|Acquisition System": "m-acquisition",
  "combined|Full System: Growth": "c-growth", "combined|Full System: Acquisition": "c-acquisition",
  "ecom|Store Launch": "e-launch", "ecom|Store Growth": "e-growth", "ecom|Store Domination": "e-domination",
};
// bullet text -> the feature it promises.
const CLAIMS = [
  [/landing page/i, "std_landing"],
  [/fully custom design|custom design/i, "custom_landing"],
  [/weekly .*optimization/i, "weekly_opt"],
  [/monthly .*optimization/i, "monthly_opt"],
  [/retargeting/i, "retargeting"],
  [/split testing/i, "split_testing"],
  [/multi-campaign/i, "multi_campaign"],
  [/call tracking/i, "call_tracking"],
  [/keyword research/i, "keyword_research"],
  [/competitor research/i, "competitor_research"],
  [/lookalike/i, "lookalike"],
  [/google shopping|performance max/i, "google_shopping"],
  [/abandoned cart/i, "abandoned_cart"],
  [/full funnel|full-funnel/i, "full_funnel"],
  [/scaling roadmap/i, "scaling_roadmap"],
  [/priority (support|communication)/i, "priority_comms"],
  [/conversion tracking|lead form/i, "lead_form"],
  [/crm/i, "crm_integration"],
  [/audience (building|targeting)/i, "advanced_targeting"],
];

// Every .pkg card, tagged with the panel it sits in.
const cards = [];
{
  const panelAt = (idx) => {
    const before = SITE.lastIndexOf('data-panel="', idx);
    return before < 0 ? "" : SITE.slice(before + 12, SITE.indexOf('"', before + 12));
  };
  const re = /<div class="pkg">([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = re.exec(SITE))) {
    const body = m[1];
    const name = (body.match(/<h3>([^<]+)<\/h3>/) || [])[1];
    if (!name) continue;
    const items = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map((x) => x[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    cards.push({ panel: panelAt(m.index), name, items });
  }
}

ok("🔴 every package card on the site was found", cards.length === 11,
  `found ${cards.length}: ${JSON.stringify(cards.map((c) => `${c.panel}|${c.name}`))}`);

for (const c of cards) {
  const id = ID[`${c.panel}|${c.name}`];
  ok(`the card "${c.panel}|${c.name}" is a package we know`, !!id,
    "a card on the public site maps to no package, so nothing checks what it promises");
  if (!id) continue;
  ok(`${id} exists in the catalog`, !!PKG_FEATURES[id]);
  ok(`${id} advertises something`, c.items.length > 0, "a card with no bullets promises nothing");

  for (const item of c.items) {
    const claim = CLAIMS.find(([re]) => re.test(item));
    // 🔴 An unmapped bullet is REPORTED. Skipping it silently is how "Landing page included"
    // sat on the site for weeks with nothing checking it.
    ok(`🔴 the site's "${item.slice(0, 40)}" on ${id} is a claim this suite understands`, !!claim,
      "add it to CLAIMS, or the site can promise it and no package has to deliver it");
    if (!claim) continue;
    ok(`🔴 ${id} really includes "${item.slice(0, 40)}"`, has(id, claim[1]),
      `the site sells ${claim[1]} on this package and PKG_FEATURES does not list it, so the client's agreement will not either`);
  }
}

// And the check can fail: a feature deliberately absent everywhere must not read as present.
ok("🔴 the comparison is capable of failing", !has("e-launch", "call_tracking"),
  "has() says yes to everything, so every assertion above is vacuous");
ok("and every mapped feature is a real feature",
  CLAIMS.every(([, f]) => ALL_FEATURES.some((x) => x.id === f)),
  "a typo in a feature id makes its check impossible to satisfy");

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-site-matches-packages: ${pass} checks passed`);
