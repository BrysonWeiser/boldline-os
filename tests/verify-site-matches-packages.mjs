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


// ── 🔴 THE FOUNDER QUOTE IS A PROMISE, SO IT MUST MATCH THE PRICING ──────────
//
// Same failure this suite exists for, in prose rather than a bullet: a line on the site that
// says more than the product does. Bryson, 2026-09-20, replacing a quote about keeping the team
// small: *"companies don't care who runs their ads personally they usually just want the most
// efficient way to guarantee their money makes them more money"*. Right, so the quote is now
// about the money.
//
// 🔴 AND THAT IS EXACTLY WHY IT NEEDS A GUARD. "I only make more when your ads do" is true on
// every plan, because the upside really is entirely performance. "I only get paid when your ads
// work" would be FALSE for any client on a monthly minimum, and the pricing block two screens up
// would contradict it on the same page. A quote is easy to reword warmly and a warmer version of
// this one is a lie.
{
  const quote = (SITE.match(/<blockquote>([\s\S]*?)<\/blockquote>/) || [])[1] || "";
  ok("the founder quote was found", quote.length > 40, JSON.stringify(quote.slice(0, 60)));

  // The site promises the minimum OR the performance fee, whichever is higher. So a quote may
  // say the UPSIDE depends on results. It may not say the whole fee does.
  const overclaims = [
    /only (get |getting |)paid when/i,
    // Both directions of the same claim: what THEY pay, and what HE gets. A guard that only
    // catches "you don't pay unless" misses "I don't get paid unless", which promises the
    // identical thing from the other side of the table.
    /(don'?t|never|not) (get |getting |)paid( a cent| a dime| anything|)( at all|) (unless|until|when|if)/i,
    /don'?t pay (me |us |)(a cent |a dime |anything |)(unless|until)/i,
    /no results,? no (fee|charge|pay)/i,
    // 🔴 THE OBJECT IN THE MIDDLE IS THE WHOLE POINT. A first draft of this guard read
    // /you only pay (for|when|if)/ and a mutation of "you only pay ME when your ads work"
    // sailed straight through it, which is the exact warm reword this is here to stop.
    /only pays? (me |us |anything |a cent |a dime |)?(when|if|for|unless)/i,
    /work(s)? for free/i,
  ].filter((re) => re.test(quote));
  ok("🔴 the quote does not promise results-only pricing",
    overclaims.length === 0,
    "the pricing section on this same page says the minimum or the performance fee, whichever "
    + "is higher, so this reads as a contradiction and a client will quote it back: "
    + overclaims.map(String).join(", "));
  ok("and the pricing section it has to agree with is still there",
    /whichever of those is higher/.test(SITE) && /Never both added together/.test(SITE));

  // 🔴 IT IS THE ONE PERSONAL MOMENT ON THE PAGE, SO IT MUST NOT REPEAT THE PAGE. The old quote
  // opened on keeping the roster small, which the fit section already says in its own words.
  ok("🔴 the quote does not restate what another section already says",
    !/roster/i.test(quote) && !/junior/i.test(quote),
    "the fit section already says the roster is kept focused, so spending the founder's voice "
    + "on it says nothing new");
  ok("and it is not about ad account ownership either",
    !/\bad account\b/i.test(quote) && !/keep the keys/i.test(quote),
    "that is the section directly above it");
}

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-site-matches-packages: ${pass} checks passed`);
