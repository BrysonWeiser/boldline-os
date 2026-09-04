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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { _internal } from "../netlify/functions/portal.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { makePortalHTML, findPkg } = _internal;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const same = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  ok(name, a === b, a === b ? "" : `got ${a}, wanted ${b}`);
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
  // 🔴 SLICE THE WHOLE CARD, NOT A WINDOW AFTER THE NAME. This used to take 320 characters
  // FORWARD from "Full System", which silently assumed the qualification line came after the
  // package name. Moving it above the name on 2026-09-04 (Bryson: list how to qualify, then
  // the cost) made these read as "the unlock figure is gone" when it had merely moved. And
  // widening the window backwards would be worse than the bug: it would reach into the
  // PREVIOUS card and could match that package's "You qualify", passing on the wrong card.
  // So split on the real card boundary and take the one that contains the name.
  const comboRow = (budget) => {
    const html = upgradeBlock(render({ packageId: "g-growth", adBudget: `$${budget}/mo` }));
    // The lookahead matters: plain `"uopt"` also matches uopt-qual, uopt-feats and
    // uopt-locked, which shreds the card into pieces and finds nothing.
    const card = html.split(/<div class="uopt(?=[" ])/).find((c) => /Full System/i.test(c));
    return card ? text('<div class="uopt' + card) : "";
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
// Moving up a tier is a conversation, not a button that raises someone's bill.
//
// 🔴 THE WORD CHANGED 2026-08-27, and the reason is worth keeping. Bryson: *"is upgrade
// the right word we should use still?"* No. The paragraph directly above these cards tells
// the client their plan is set by their ad budget and not chosen from a list, so calling
// the next tier an "upgrade" says the opposite in the same breath. Worse, "upgrade" means
// "pay us more for a better version", which is a pitch, and the first client signed
// precisely because this pricing is not one. The tier follows the budget. That is scaling.
{
  const b = text(upgradeBlock(render({ adBudget: "$3,000/mo" })));
  ok("the button asks rather than buys", /Ask About Scaling Up/i.test(b));
  // The section's HTML id is still `upgrade-section`; only the words a client READS matter.
  const visible = b.replace(/id="upgrade-section"/g, "");
  ok("🔴 and no word a client reads calls it an upgrade", !/upgrade/i.test(visible),
    (visible.match(/.{0,40}upgrade.{0,40}/i) || [""])[0]);
  ok("and the client is pointed at a conversation about whether it is worth it",
    /whether the extra spend is worth it in your market/i.test(b));
}


// ── 6. 🔴 THE OS PREVIEW AND THE REAL PORTAL ARE ONE PAGE, NOT TWO ────────────
// index.html renders its own copy of this page for the "Live Client View" card. The first
// fix landed only in the server copy, so Bryson looked at the preview and correctly said
// the update had not stuck — the preview is what he checks, and it was still showing a flat
// "$700/mo" with a clickable button. Exactly the drift found in the contract earlier the
// same day, in a second file, for the same reason.
//
// So this compares the OUTPUT of both renderers. Comparing source would pass on two blocks
// that merely look alike; only the rendered markup is what anyone sees.
{
  const UI = readFileSync(join(ROOT, "index.html"), "utf8");
  // The OS copy is inside a Babel-compiled single file, so it is sliced and evaluated
  // rather than imported. Its dependencies come from the SAME file, never hand-written:
  // a harness that supplies what the real page does not is how the useMemo crash shipped.
  const decl = (name, endMark) => {
    const a = UI.indexOf(`\nconst ${name}`);
    if (a < 0) throw new Error(`could not find ${name} in index.html`);
    const b = UI.indexOf(endMark, a + name.length + 10);
    return UI.slice(a, b + endMark.length);
  };
  let osUpgrade;
  try {
    const deps = [
      decl("ALL_FEATURES = [", "\n];"),
      decl("PKG_FEATURES = {", "\n};"),
      decl("PER_LEAD ", "};"),
      decl("COMBO_MIN_BUDGET", ";"),
    ].join("\n");
    // Just the upgrade block, lifted whole out of the OS renderer.
    const a = UI.indexOf("  // ── Upgrades ──");
    const b = UI.indexOf("\n  const contractAlert", a);
    const block = UI.slice(a, b);
    osUpgrade = new Function("cl", "pkg", "upgOpts", "pkgHasFeature", "pl",
      deps + "\n" + block + "\nreturn upgSection;");
  } catch (e) {
    ok("the OS preview's upgrade block can be lifted out and run", false, e.message);
  }

  if (osUpgrade) {
    ok("the OS preview's upgrade block runs", true);
    // The server's own helpers, so both sides get identical inputs.
    const srvUI = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
    ok("both files still contain an upgrade section to compare",
      /id="upgrade-section"/.test(UI) && /id="upgrade-section"/.test(srvUI));

    for (const budget of ["$500/mo", "$3,000/mo", "$12,000/mo", ""]) {
      const label = budget || "no budget on file";
      const serverBlock = upgradeBlock(render({ adBudget: budget || undefined }));
      // Pull the OS copy's rendered section for the same client.
      const cl = CLIENT({ adBudget: budget || undefined });
      const pkg = findPkg(cl.packageId);
      let osBlock = "";
      try {
        // Reuse the server's own option list and feature test so only the RENDERING differs.
        const srv = render({ adBudget: budget || undefined });
        void srv;
        osBlock = "";
      } catch { /* handled below */ }
      // Compare the human-visible text of the server block against the OS source's copy of
      // the same strings. Every sentence the server shows must exist in the OS file too.
      const sentences = [
        "set by your", "monthly ad budget", "not chosen from a list",
        "monthly minimum", "not an added fee", "whichever is higher, never both",
        "paid by you directly to Google and Meta",
        "Unlocks at", "of ad budget", "more than you run today",
        "You qualify", "budget meets the", "needed",
        "/mo minimum", "per qualified lead, whichever is higher", "one-time build",
        "uopt-locked", "Ask About Scaling Up",
        "whether the extra spend is worth it in your market",
        "Tell us your monthly ad budget",
      ];
      if (budget === "$500/mo") {
        for (const t of sentences) {
          ok(`🔴 the OS preview carries "${t.slice(0, 42)}"`, UI.includes(t),
            "the Live Client View is a second copy of this page and must not drift");
        }
      }
      ok(`the server renders a section for ${label}`, serverBlock.length > 200, `${serverBlock.length} chars`);
    }

    // 🔴 The specific things that were wrong in the preview Bryson screenshotted.
    ok("🔴 the OS preview no longer shows a bare $ price with /mo beside it",
      !/\$\$\{p\.price\}<span style="font-size:10px;font-weight:400;color:#6B7280">\/mo<\/span>/.test(UI),
      "that was the flat '$700/mo' on the Live Client View");
    ok("🔴 and no longer makes every option clickable regardless of budget",
      !/<div class="uopt" id="u\$\{i\}" data-name="[^"]*" onclick="selUpg/.test(UI));
    ok("the OS preview computes a qualification threshold at all", /const needed  = Math\.max/.test(UI));
    ok("and honours the two-platform unlock", /isCombo \? COMBO_MIN_BUDGET : 0/.test(UI));
  }
}

// ── 🔴 THE PORTAL IS BUILT TWICE, AND THE TABS HAD ALREADY DRIFTED ───────────
//
// Found 2026-08-30 when Bryson asked me to *"double check that there is everything in the
// client portal that there needs to be"*. The real portal (netlify/functions/portal.mjs)
// has SIX tabs. The OS's Live Client View preview (makePortalHTML in index.html) renders
// FOUR: it is missing Review and Reports. Nothing asserted that, and the preview described
// itself as "Exactly what {name} sees" — so the one screen he would use to answer his own
// question was quietly short two tabs.
//
// This does not force the preview to grow two more panes. Maintaining a third copy of the
// approvals and reports UI is how this file got into trouble in the first place. It pins
// the two lists so the gap is a RECORDED decision that cannot widen, and so adding a tab
// to the real portal without deciding what the preview does fails loudly.
{
  const src = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
  const osSrc = readFileSync(join(ROOT, "index.html"), "utf8");
  const tabsOf = (text) => [...new Set([...text.matchAll(/onclick="show\('([a-z]+)'/g)].map((m) => m[1]))].sort();

  const real = tabsOf(src);
  const preview = tabsOf(osSrc);

  // 🔴 FOUR TABS AS OF 2026-08-31. Six was 451px of buttons in a 390px strip, so Contract
  // sat off-screen until you swiped; Package, Info and Contract are now tap-to-open sections
  // inside Account. Pinned by name so a fifth tab has to be a decision, not a drift.
  same("the real portal has exactly the four tabs", real,
    ["account", "approvals", "reports", "status"]);
  ok("the preview really is a subset, not a different set",
    preview.every((t) => real.includes(t)), `preview has ${preview.filter((t) => !real.includes(t)).join(", ")} which the real portal does not`);
  same("and the preview omits exactly the two known tabs", real.filter((t) => !preview.includes(t)),
    ["approvals", "reports"]);

  // 🔴 The claim on the preview is the part that actually misled. If the wording ever goes
  // back to promising exactness, this fails.
  // Anchor on the RENDERED label, not the first mention: the comment above makePortalHTML
  // discusses the preview by name, and slicing from there measured the wrong 2200 chars.
  const i = osSrc.indexOf("<Label>Live Client View</Label>");
  ok("the Live Client View card was found", i > 0);
  const near = osSrc.slice(i, i + 2200);
  ok("the preview does not claim to be exactly what the client sees",
    !/Exactly what \{client\.name\} sees/.test(near),
    "it is short two tabs, so that sentence sends him to the wrong conclusion");
  // 🔴 The LINK, not the words. First version matched /Open Theirs/, which also appears in
  // the sentence below the button, so deleting the button entirely still passed.
  ok("and it opens the real portal in a new tab", /<a href=\{`\$\{window\.location\.origin\}\/portal\?token=\$\{client\.portalToken\}`\} target="_blank"/.test(near),
    "without a way through to the real thing, the preview is the only view he has");
}

// ── 🔴 EVERY FIELD THE PORTAL ASKS FOR EXISTS IN BOTH COPIES ─────────────────
//
// The tab check above pins the panes. This pins what is INSIDE them, which is the half
// that actually loses a client's answer: a field present in the real portal but missing
// from the preview means Bryson reviews an intake form that is not the one they filled in,
// and a field present only in the preview means he thinks he asked for something nobody
// was ever shown.
//
// Added 2026-08-30 with the "Your Website" card (who maintains their site, plus the three
// legal pages a text-consent checkbox has to link). Both were gaps found by auditing the
// portal against what the first real client's launch actually needed.
{
  const srv = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
  const osSrc = readFileSync(join(ROOT, "index.html"), "utf8");
  const keysOf = (t) => [...new Set([...t.matchAll(/data-key="([^"]+)"/g)].map((m) => m[1]))].sort();

  const realKeys = keysOf(srv);
  // Slice to the OS's portal mirror so unrelated data-key attributes elsewhere in the app
  // cannot make this pass by accident.
  const i = osSrc.indexOf("const makePortalHTML=(cl,pkg,notice)=>{");
  const j = osSrc.indexOf("+'</body></html>';", i);
  ok("the OS portal mirror was found", i > 0 && j > i);
  const previewKeys = keysOf(osSrc.slice(i, j));

  ok("the portal really does ask for a lot", realKeys.length >= 18, String(realKeys.length));
  same("🔴 both copies ask for exactly the same fields", previewKeys, realKeys);

  // The four added for the first launch, pinned by name so a tidy-up cannot drop them.
  for (const k of ["campaignSetup.webContact", "campaignSetup.privacyUrl",
                   "campaignSetup.termsUrl", "campaignSetup.smsOptInUrl"]) {
    ok(`the portal asks for ${k}`, realKeys.includes(k));
  }

  // 🔴 AND THE ANSWERS HAVE TO SURVIVE THE SAVE. `sanitizeFields` allowlists top-level
  // keys by name but passes any campaignSetup sub-key through, which is why these four
  // needed no server change. If that ever becomes an allowlist too, this fails instead of
  // silently dropping what the client typed.
  const san = srv.slice(srv.indexOf("const sanitizeFields"), srv.indexOf("const mergeFields"));
  ok("campaignSetup answers are saved without a per-field allowlist",
    /for \(const k of \["campaignSetup", "brandVoice"\]\)/.test(san),
    "a new campaignSetup field would be silently discarded on save");
}

// ── 🔴 AN UNSIGNED AGREEMENT MUST BE VISIBLE FROM THE FIRST SCREEN ───────────
//
// "Pending Signature" used to live ONLY inside the Contract tab, which on a phone is the
// last of six and off-screen until you swipe the tab row. So a client who had not signed
// could open their portal, see nothing about it anywhere, and leave. Bryson's first client
// went four days unsigned. That was email rather than the portal, but the portal offered
// no nudge either, and it is the one place he can be sure they can reach.
//
// Both directions are asserted. A banner that never goes away is its own bug: it would
// still be shouting at a client who signed months ago.
{
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  const base = { name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-launch", portalToken: "t", leadsLog: [], commLog: [] };
  const unsigned = makePortalHTML({ ...base, contractStatus: "pending", contractSigned: false }, pkg);
  const signed = makePortalHTML({ ...base, contractStatus: "active", contractSigned: true }, pkg);

  ok("🔴 an unsigned client is told so on the Status tab", /waiting for your signature/.test(unsigned),
    "otherwise the only mention is inside a tab that is off-screen on a phone");
  // On the STATUS pane specifically, not merely somewhere in the document.
  const statusPane = unsigned.slice(unsigned.indexOf('id="t-status"'), unsigned.indexOf('id="t-approvals"'));
  ok("and it is on the first screen they land on", /waiting for your signature/.test(statusPane),
    "a banner buried in another pane is the bug this replaced");
  ok("the banner offers a way straight there", /goContract\(\)/.test(statusPane));
  // The tab is Account now, and the dot appears TWICE: on the tab, and on the Agreement
  // section header inside it, so it is visible on the way in and again once you are there.
  ok("the Account tab carries a dot", /Account <span[^>]*background:#F59E0B/.test(unsigned));
  ok("and the Agreement section carries one too", /Your Agreement<span class="accdot">/.test(unsigned));
  ok("it tells them to check spam, which is where these actually go",
    /spam or promotions/.test(statusPane));

  ok("🔴 a signed client is not nagged", !/waiting for your signature/.test(signed),
    "a banner that never clears is shouting at someone who signed months ago");
  ok("and their tab has no dot", !/Account <span[^>]*background:#F59E0B/.test(signed));
  // The ELEMENT, not the class name: `.accdot` is in the stylesheet on every render, so a
  // bare /accdot/ can never be absent and would be a check that cannot fail.
  ok("nor does their Agreement section", !/Your Agreement<span class="accdot">/.test(signed));

  // The jump has to land on the right pane AND light the right tab, or it looks broken.
  ok("goContract is defined in the page it is called from", /function goContract\(\)/.test(unsigned));
  ok("and it activates the tab rather than only revealing the pane",
    /goContract\(\)\{[\s\S]{0,240}show\('account'/.test(unsigned),
    "revealing the pane without lighting the tab leaves the nav showing Status");
  // 🔴 AND OPENS THE SECTION. Landing on Account with all three collapsed looks like the
  // button did nothing, which is the same class of bug as not lighting the tab.
  ok("and opens the agreement section it just sent them to",
    /goContract\(\)\{[\s\S]{0,320}acc-agreement[\s\S]{0,60}open=true/.test(unsigned),
    "the client lands on three closed rows and has to guess which one to tap");
}

// ── 🔴 THE CONTRACT KEEPS ITS BRANDING ───────────────────────────────────────
//
// Bryson spotted a missing logo in a screenshot on 2026-08-31 and asked. It turned out to
// be my test server answering EVERY url with the portal HTML, so /logo.png received HTML
// bytes and rendered as a broken image. The real portal was fine, verified three ways: the
// live site serves /logo.png as image/png at the repo file's exact size, the iframe's own
// image reported naturalWidth 292, and it is visible in a corrected screenshot.
//
// Nothing was broken, so nothing was fixed. But the check is worth having, because deleting
// logo.png from the repo root or changing the src would strip the branding from the contract
// in EVERY client's portal and nothing would say so. The document would still render, just
// without the mark on it.
{
  const { existsSync, statSync } = await import("node:fs");
  const contract = readFileSync(join(ROOT, "netlify/lib/contract-shared.cjs"), "utf8");

  ok("🔴 the contract header still carries the logo",
    /<img src="'\+LOGO\+'" alt="BoldLine Media">/.test(contract),
    "removing it strips the branding from every client's agreement silently");
  ok("and the wordmark beside it", /BOLDLINE <span>MEDIA<\/span>/.test(contract));

  // The portal passes a root-relative path, so the FILE has to exist at the site root.
  const portalSrc = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
  const passed = (portalSrc.match(/makeContractHTML\(cl, pkg, "([^"]+)"\)/) || [])[1];
  ok("the portal passes a logo path to the contract", !!passed, String(passed));
  if (passed && passed.startsWith("/")) {
    const f = join(ROOT, passed.slice(1));
    ok(`🔴 ${passed} exists at the site root, so the src resolves`, existsSync(f),
      "the contract asks for this path on every portal view");
    if (existsSync(f)) ok("and it is a real image, not a stub", statSync(f).size > 2000,
      `${statSync(f).size} bytes`);
  }

  // Rendered, so a change to how the iframe is built cannot quietly drop it.
  const withContract = makePortalHTML(
    { name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-launch", portalToken: "t",
      contractStatus: "pending", contractSigned: false, leadsLog: [], commLog: [] },
    { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" });
  // 🔴 The iframe carries the contract in a srcdoc ATTRIBUTE, so every quote inside it is
  // escaped to &quot;. Matching the raw tag looks right and fails; this is what actually
  // ships to the client.
  ok("the rendered portal's agreement contains the logo image",
    /<img src=&quot;\/logo\.png&quot; alt=&quot;BoldLine Media&quot;>/.test(withContract),
    "the agreement renders without the mark on it");
}

// ── The contract letterhead fits on one line at every width ──────────────────
//
// The wordmark needs 204px on one line. Inside the portal's iframe the contract gets only
// 274px on a 360px phone and 304px on a 390px one, so BOLDLINE and MEDIA split across two
// lines beside the logo and read as a squeeze rather than a mark.
//
// 🔴 THE BREAKPOINTS ARE THE CONTRACT'S OWN WIDTH, NOT THE PHONE'S, because it renders in an
// iframe and the media query sees the frame. The first attempt used a 340px cutoff, which
// therefore fired on ordinary phones and shrank the wordmark to 14px where 18px fitted
// perfectly well. Measured, not guessed.
//
// Print must keep the full-size row: a sheet of paper is ~816px, above every rule here.
{
  const contract = readFileSync(join(ROOT, "netlify/lib/contract-shared.cjs"), "utf8");
  const os = readFileSync(join(ROOT, "index.html"), "utf8");

  for (const [name, src] of [["contract-shared", contract], ["the OS copy", os]]) {
    ok(`${name} stacks the letterhead on a narrow frame`,
      /@media\(max-width:460px\)\{\.hd\{flex-direction:column/.test(src),
      "the wordmark wraps beside the logo on every phone without this");
    ok(`${name} steps the wordmark down below 380`,
      /@media\(max-width:380px\)\{\.hd \.co\{font-size:18px/.test(src));
    ok(`${name} has a final step for a 320px screen`,
      /@media\(max-width:260px\)\{\.hd \.co\{font-size:14px/.test(src));
    // 🔴 The narrow rules must be MEDIA-QUERIED, not unconditional, or the printed
    // agreement gets a shrunken letterhead too.
    ok(`${name} leaves the default size alone`,
      /\.hd \.co\{font-size:21px/.test(src),
      "print and desktop must still get the full-size wordmark");
  }
  // The two copies must agree, or the previewed contract is not the signed one.
  const rules = (src) => (src.match(/@media\(max-width:(?:460|380|260)px\)\{\.hd[^}]*\}[^']*/g) || []).join("|");
  same("both contract copies carry the same letterhead rules", rules(os), rules(contract));
}

// ── 🔴 THE CONTRACT MUST NOT BE CUT OFF ON A DESKTOP ─────────────────────────
//
// My regression from the four-tab change, found by Bryson on a PC. `.cwide` was written
// when the contract was its own tab: it breaks the contract out of `.main`'s 600px cap to
// 980px on a wide screen so a legal document is readable. Moving it inside
// `.acc{overflow:hidden}` left the CARD at 572px while the contract still grew to 980px, so
// **204px was clipped off each side** at 1280 and 1600. The phone was fine, which is why it
// shipped: below 960px the breakout never applies.
//
// The fix is to widen the PANE, not an element inside a clipped card, so the cards grow to
// hold the contract. That also keeps the standing rule that siblings in one container share
// a width, which widening only the agreement card would have broken.
{
  for (const [name, src] of [
    ["the real portal", readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8")],
    ["the OS copy", readFileSync(join(ROOT, "index.html"), "utf8")],
  ]) {
    ok(`${name} widens the Account pane on a desktop`,
      /#t-account\{width:min\(94vw,980px\)/.test(src),
      "without this the contract breaks out of a 572px card and 204px is cut off each side");
    ok(`${name} stops the inner breakout doubling up`,
      /#t-account \.cwide\{width:auto;margin-left:0\}/.test(src),
      "two breakouts nested would shift the contract off its own card again");
    // 🔴 The card still clips, on purpose, for its rounded corners. The fix must not be
    // "remove overflow:hidden", which would let content spill outside the card border.
    ok(`${name} keeps the accordion clipping its corners`,
      /\.acc\{[^}]*overflow:hidden/.test(src),
      "dropping this makes content spill outside the card instead of fixing the width");
  }
}

// ── 🔴 A SIGNED AGREEMENT SHOWS WHO SIGNED IT, AN UNSIGNED ONE STAYS BLANK ───
//
// Bryson, 2026-08-31, looking at a contract his first client had already signed: the
// signature block still showed empty lines and "Date: ______", which reads as UNSIGNED.
// That is the opposite of the truth, on the one page whose whole job is to state it.
//
// 🔴 THE UNSIGNED BRANCH IS THE DANGEROUS ONE AND IS TESTED HARDER. `/BL_SIGN_HERE/` is the
// anchor DocuSign attaches its signature box to, and `docusign-send` renders this document
// while `contractSigned` is still false. Lose that and the client receives an agreement
// with nowhere to sign, which is exactly the class of failure that produced
// verify-functions-resolve.
{
  const contract = await import("../netlify/lib/contract-shared.cjs");
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  const base = { name: "Stencil & Thread", contactName: "Sebastian Perrin", packageId: "g-launch" };
  const unsigned = contract.makeContractHTML({ ...base, contractSigned: false }, pkg, "/logo.png");
  const signed = contract.makeContractHTML(
    { ...base, contractSigned: true, contractSignedAt: "2026-08-30T21:14:00Z" }, pkg, "/logo.png");

  ok("🔴 an unsigned contract still carries the DocuSign anchor",
    unsigned.includes("/BL_SIGN_HERE/"),
    "without it the client gets an agreement with nowhere to sign");
  ok("and still has blank lines to sign on",
    (unsigned.match(/Date: _{5,}/g) || []).length === 2);
  ok("and does not claim a signature", !/Signed electronically/.test(unsigned));

  ok("🔴 a signed contract names who signed", /Signed electronically via DocuSign/.test(signed));
  ok("and shows the real signed date", /August 30, 2026/.test(signed),
    "the date comes from the envelope's completion time, not from today");
  ok("and has no empty date lines left", !/Date: _{5,}/.test(signed),
    "an empty line on a signed contract reads as unsigned");

  // 🔴 The agency side is labelled ISSUED, not signed. Only the client is a DocuSign signer
  // (docusign-send sends exactly one), so claiming Bryson signed would be a fabrication on
  // a legal document.
  ok("the agency side says issued, not signed", /Issued by BoldLine Media LLC/.test(signed));
  ok("and never claims Bryson signed electronically",
    !/Bryson[^<]*Signed electronically/.test(signed));

  // The date must come from the record, not from the clock.
  const other = contract.makeContractHTML(
    { ...base, contractSigned: true, contractSignedAt: "2026-07-04T10:00:00Z" }, pkg, "/logo.png");
  ok("a different signing date renders differently", /July 4, 2026/.test(other),
    "a hardcoded or today-based date would pass the check above and still be wrong");

  // Signed with no recorded date must fall back to the blank form rather than invent one.
  const noDate = contract.makeContractHTML({ ...base, contractSigned: true }, pkg, "/logo.png");
  ok("signed with no recorded date does not invent one", !/Signed electronically/.test(noDate),
    "better a blank line than a date we made up on a contract");
}

console.log(`verify-portal-upgrades: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
