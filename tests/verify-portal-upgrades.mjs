// What a client is offered in their portal, and at what price.
//
// Bryson, 2026-08-26, looking at the live portal: *"the way upgrades happen and the pricing
// needs to be updated. It needs to list how to qualify for an upgrade and then from there
// tell them the monthly minimum cost."*
//
// 🔴 TWO THINGS WERE WRONG AND BOTH WOULD HAVE PRODUCED A COMPLAINT.
//
//   1. A TIER IS UNLOCKED BY AD BUDGET, NOT CHOSEN FROM A MENU. Growth requires $2,500/mo of
//      ad spend. The portal offered it to a client running $500 with a clickable button, so
//      the only way to find out you did not qualify was to ask for it and be told no.
//   2. THE FIGURE SHOWN WAS PRESENTED AS A PRICE. "$700/mo" is a monthly MINIMUM that the
//      per-qualified-lead fee counts toward, never an added fee. A client reading it as a
//      price either overestimates their bill and declines, or underestimates it and is
//      surprised later. Both are bad, and the second is worse.
//
// Rendered and read, because a portal page is generated HTML and the words are the product.

import { _internal } from "../netlify/functions/portal.mjs";

const { makePortalHTML, findPkg } = _internal;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&mdash;/g, "-").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

// The section of the page under test, so a match elsewhere cannot satisfy a check here.
const upgradeBlock = (html) => {
  const i = html.indexOf('id="upgrade-section"');
  if (i < 0) return "";
  return html.slice(i, i + 9000);
};

const CLIENT = (o = {}) => ({
  id: "abc12345", name: "Stencil & Thread", contactName: "Sebastian Perrin",
  email: "s@example.com", niche: "Custom Apparel & Screen Printing",
  packageId: "g-launch", platforms: ["Google Ads"], stage: "onboarding",
  contractStart: "Aug 26, 2026", contractEnd: "Nov 26, 2026",
  portalToken: "tok", leadToken: "lt", leadsLog: [], commLog: [], mediaLibrary: [],
  campaignSetup: {}, brandVoice: {}, ...o,
});

const render = (o) => {
  const cl = CLIENT(o);
  return makePortalHTML(cl, findPkg(cl.packageId));
};

// ── 1. The rule is explained before any number is shown ───────────────────────
{
  const b = text(upgradeBlock(render({ adBudget: "$500/mo" })));
  ok("the upgrade section renders at all", b.length > 100, `${b.length} chars`);
  ok("🔴 it says the plan is set by ad budget rather than picked from a list",
    /set by your monthly ad budget\s*,\s*not chosen from a list/i.test(b));
  ok("🔴 every figure is named a monthly minimum, not a price",
    /monthly minimum.*not an added fee/i.test(b));
  ok("and the greater-of rule is stated in the client's own words",
    /whichever is higher, never both/i.test(b));
  ok("ad spend is kept separate from fees, which is the hard business rule",
    /paid by you directly to Google and Meta/i.test(b));
  ok("their current budget is shown so the comparison is concrete", /current ad budget/i.test(b));
}

// ── 2. 🔴 A client is told what unlocks a tier, and whether they qualify ──────
{
  // $500 of ad spend: Growth needs $2,500, so this client does not qualify.
  const b = text(upgradeBlock(render({ adBudget: "$500/mo" })));
  ok("🔴 a locked tier says what budget unlocks it", /Unlocks at \$2,500\/mo of ad budget/i.test(b), b.slice(0, 400));
  ok("🔴 and how far short they are, so the ask is concrete",
    /\$2,000\/mo more than you run today/i.test(b),
    "naming the gap is the difference between a price list and a path");
  ok("it does not claim they qualify", !/You qualify/i.test(b));
}
{
  // $3,000: Growth is open, but a combined package still needs $5,000.
  const b = text(upgradeBlock(render({ adBudget: "$3,000/mo" })));
  ok("a client whose budget clears the tier is told they qualify", /You qualify/i.test(b), b.slice(0, 500));
  ok("and the comparison names both numbers", /\$3,000 budget meets the \$2,500 needed/i.test(b));
}
{
  // 🔴 THE COMBINED UNLOCK, TESTED AT THE BOUNDARY.
  // The first version of this block asserted that a combined package states $5,000 while a
  // client sat on $3,000. That reads well and CANNOT FAIL: c-growth's own minBudget is
  // already 5000, so the Math.max against COMBO_MIN_BUDGET changes nothing and reverting it
  // passed clean. An assertion guaranteed by the data is not a test.
  // What is actually worth guarding is the BOUNDARY: one dollar below the two-platform
  // unlock a combined package must be locked, and at the unlock it must open. That fails if
  // the comparison is ever written as > instead of >=, or if the floor drifts.
  const comboRow = (budget) => {
    const b = text(upgradeBlock(render({ packageId: "g-growth", adBudget: `$${budget}/mo` })));
    const i = b.search(/Full System/i);
    return i < 0 ? "" : b.slice(i, i + 320);
  };
  const under = comboRow(4999);
  const at    = comboRow(5000);
  ok("a combined package is offered to a Growth client at all", !!under && !!at,
    "if it never appears, everything below is vacuous");
  if (under && at) {
    ok("🔴 one dollar under the two-platform unlock, combined is NOT open",
      !/You qualify/i.test(under), under);
    ok("🔴 exactly at the unlock, combined IS open",
      /You qualify/i.test(at), at);
    ok("and the under case names the figure they need to reach",
      /\$5,000\/mo of ad budget/i.test(under), under);
    ok("and the shortfall is the real gap, to the dollar",
      /\$1\/mo more than you run today/i.test(under), under);
  }
}

{
  // No budget on file: never guess, never claim they qualify.
  const b = text(upgradeBlock(render({})));
  ok("with no budget on file it asks for one rather than guessing",
    /Tell us your monthly ad budget/i.test(b));
  ok("🔴 and never tells an unknown client they qualify", !/You qualify/i.test(b));
  ok("it still shows what each tier unlocks at", /Unlocks at \$2,500\/mo of ad budget/i.test(b));
}

// ── 3. The money is described the way the contract describes it ───────────────
{
  const b = text(upgradeBlock(render({ adBudget: "$3,000/mo", billingPerLead: 50 })));
  ok("the tier figure is labelled a monthly minimum", /\$700 \/mo minimum/i.test(b.replace(/\s+/g, " ")) || /700.*mo minimum/i.test(b));
  ok("🔴 the per-lead alternative is shown beside it",
    /or \$50 per qualified lead, whichever is higher/i.test(b),
    "a minimum shown alone reads as a flat price");
  ok("the one-time build cost is disclosed too", /one-time build/i.test(b));
}
{
  // A client with no per-lead rate must not be shown a $0 one.
  const b = text(upgradeBlock(render({ adBudget: "$3,000/mo", billingPerLead: 0 })));
  ok("no per-lead line when there is no rate", !/\$0 per qualified lead/i.test(b));
}

// ── 4. A locked option cannot be selected ─────────────────────────────────────
{
  const html = upgradeBlock(render({ adBudget: "$500/mo" }));
  const locked = (html.match(/uopt-locked/g) || []).length;
  ok("🔴 an option they do not qualify for is marked locked", locked > 0, "otherwise it looks available");
  // Each rendered option div either carries the locked class or an onclick, never neither
  // and never both.
  const opts = html.match(/<div class="uopt[^"]*" id="u\d+"[^>]*>/g) || [];
  ok("every option is rendered", opts.length > 0, `${opts.length} found`);
  const bad = opts.filter((o) => /uopt-locked/.test(o) === /onclick=/.test(o));
  ok("🔴 locked options carry no click handler, and unlocked ones do", bad.length === 0, bad.join("\n"));
}
{
  const html = upgradeBlock(render({ adBudget: "$12,000/mo", packageId: "g-growth" }));
  const opts = html.match(/<div class="uopt[^"]*" id="u\d+"[^>]*>/g) || [];
  const clickable = opts.filter((o) => /onclick=/.test(o));
  ok("a client whose budget clears everything can actually select something",
    clickable.length > 0, `${clickable.length} of ${opts.length} selectable at $12,000/mo`);
}

// ── 5. Nothing promises an instant change ─────────────────────────────────────
// An upgrade is a conversation, not a button that raises someone's bill.
{
  const b = text(upgradeBlock(render({ adBudget: "$3,000/mo" })));
  ok("the button asks rather than buys", /Request This Upgrade/i.test(b));
  ok("and the client is pointed at a conversation about whether it is worth it",
    /whether the extra spend is worth it in your market/i.test(b));
}

console.log(`verify-portal-upgrades: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
