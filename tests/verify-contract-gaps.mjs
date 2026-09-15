// An agreement with a gap in it CANNOT be sent, and the message says what and where.
//
// Bryson, 2026-09-15: *"if there is a contract that is missing information such as missing the
// package, the cost per qualified lead, etc. instead of letting me send it dont let me send it
// and then give a message for what is missing that way I dont ever accidentally send out
// contracts with missing information again."*
//
// 🔴 THE INCIDENT THIS EXISTS FOR. On 14 September he sent Brendon an agreement with no package
// on it: Service Package "—", Advertising Platform "—", $0/mo, and — the dangerous part — the
// ENTIRE per-qualified-lead section silently absent, because that clause is gated on the
// package's pricing model. Nothing warned him. He spotted it himself minutes later and had to
// void it. A contract with a gap does not throw and does not look broken; it renders a complete,
// professional, signable document that happens to be missing the clause about money.
//
// 🔴 EVERY GAP IS PROVED BY RENDERING THE REAL CONTRACT WITHOUT THAT FIELD AND FINDING THE
// DAMAGE. A list of fields that merely felt important would drift into blocking sends for no
// reason, which is its own way of making the feature useless.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const { makeContractHTML } = createRequire(import.meta.url)("../netlify/lib/contract-shared.cjs");

const fails = [];
let pass = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fails.push(`${name} — ${e.message}`); } };

// 🔴 THE REAL FUNCTION, LIFTED OUT OF THE OS AND RUN. Re-implementing it here would only
// prove this file agrees with itself; the whole lesson of the last two days is that a test
// which restates its subject's assumptions catches nothing.
const src = (S.match(/function contractGaps\(cl, pkg\) \{[\s\S]*?\n\}\n/) || [])[0];
assert.ok(src, "contractGaps is not in the OS any more, so nothing below proves anything");
const PER_LEAD = { Roofing: 75, "Med Spa": 35, "Auto Detailing": 15 };
const contractGaps = new Function("PER_LEAD", `${src} return contractGaps;`)(PER_LEAD);

const PKG = { id: "g-launch", name: "Google Launch System", platform: "Google Ads", price: 400,
  setup: 750, adSpend: "$500-$2,500/mo", pricingModel: "per_lead", optimizationFreq: "Monthly" };
const ECOM = { ...PKG, id: "e-launch", name: "Store Launch", pricingModel: "ad_spend_pct", adSpendPct: 15 };
const FULL = { id: "k3m9xz2", name: "Brendon Co", contactName: "Brendon", email: "b@example.com",
  businessAddress: "1 Main St, Phoenix AZ", niche: "Roofing", packageId: "g-launch",
  billingMonthly: 400, billingSetup: 750, billingPerLead: 50, contractTermMonths: 3,
  contractStart: "2026-09-15" };

const plain = (cl, pkg) => makeContractHTML(cl, pkg, "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const hasFeeClause = (cl, pkg) => /per qualified lead|of your ad spend|of ad spend/i.test(plain(cl, pkg));

// ── 1. A complete agreement is never blocked ────────────────────────────────
// This matters as much as the blocking does. A guard that fires on a finished contract is a
// guard he will learn to route around, and then it protects nothing.
t("a complete agreement has nothing missing", () => {
  assert.deepEqual(contractGaps(FULL, PKG), [], JSON.stringify(contractGaps(FULL, PKG)));
});

t("a store on a percentage of ad spend is complete too", () => {
  const cl = { ...FULL, packageId: "e-launch", billingPerLead: null, niche: "Retail" };
  assert.deepEqual(contractGaps(cl, ECOM), [], JSON.stringify(contractGaps(cl, ECOM)));
});

t("a blank per-lead field is fine when the niche has a standard rate", () => {
  // Roofing has one, so the document renders a real fee. Blocking here would be wrong.
  const cl = { ...FULL, billingPerLead: null };
  assert.deepEqual(contractGaps(cl, PKG), []);
  assert.ok(hasFeeClause(cl, PKG), "the fixture is wrong: this renders no fee clause");
});

// ── 2. 🔴 THE TWO THAT DELETE THE MONEY CLAUSE ──────────────────────────────
t("🔴 no package is caught, and really does gut the document", () => {
  const cl = { ...FULL, packageId: "" };
  const g = contractGaps(cl, null);
  assert.ok(g.some((x) => /package/i.test(x.what)), JSON.stringify(g));
  // The damage, in the real rendered contract: this is what Brendon received.
  const txt = plain(cl, null);
  assert.match(txt, /Service Package —/, "the fixture no longer reproduces the incident");
  assert.match(txt, /Advertising Platform —/);
  assert.ok(!hasFeeClause(cl, null), "🔴 the contract kept its fee clause, so this gap is not what broke Brendon's");
});

t("🔴 a per-lead package with no rate is caught, and really does drop the fee clause", () => {
  // The nastier one: everything else on the page looks finished.
  const cl = { ...FULL, billingPerLead: 0 };
  const g = contractGaps(cl, PKG);
  assert.ok(g.some((x) => /per qualified lead/i.test(x.what)), JSON.stringify(g));
  assert.ok(!hasFeeClause(cl, PKG), "the fixture does not actually lose the clause");
  assert.match(plain(cl, PKG), /Google Launch System/, "and the rest of it still reads as a finished contract");
});

t("🔴 a niche with no standard rate is caught, which checking for a filled-in field would miss", () => {
  const cl = { ...FULL, billingPerLead: null, niche: "Dog Grooming" };
  assert.ok(contractGaps(cl, PKG).some((x) => /per qualified lead/i.test(x.what)),
    "billingPerLead is blank and the niche has no rate, so the fee renders as zero");
  assert.ok(!hasFeeClause(cl, PKG));
});

t("🔴 a store with no percentage is caught, and really does drop its fee clause", () => {
  const cl = { ...FULL, packageId: "e-launch", billingSpendPct: 0, billingPerLead: null };
  const pkg = { ...ECOM, adSpendPct: 0 };
  assert.ok(contractGaps(cl, pkg).some((x) => /ad spend/i.test(x.what)), JSON.stringify(contractGaps(cl, pkg)));
  assert.ok(!hasFeeClause(cl, pkg));
});

// ── 3. The party and the dates ──────────────────────────────────────────────
for (const [field, phrase] of [["name", "business name"], ["contactName", "contact name"],
  ["email", "email"], ["businessAddress", "business address"], ["contractStart", "start date"]]) {
  t(`a missing ${phrase} is caught`, () => {
    const g = contractGaps({ ...FULL, [field]: "" }, PKG);
    assert.equal(g.length, 1, `expected exactly this one gap, got ${JSON.stringify(g)}`);
    assert.match(g[0].what.toLowerCase(), new RegExp(phrase));
  });
}

t("every gap says where to fix it, not just what is wrong", () => {
  // A block that does not tell you how to get past it is a locked door.
  const g = contractGaps({ id: "x" }, null);
  assert.ok(g.length >= 5, `only ${g.length} gaps on an empty client`);
  for (const x of g) {
    assert.ok(x.where && x.where.length > 20, `"${x.what}" has no instructions`);
    assert.match(x.where, /tab/i, `"${x.what}" does not say which tab to go to`);
  }
});

// ── 4. 🔴 THE BLOCK IS REAL, IN BOTH PLACES ─────────────────────────────────
{
  const i = S.indexOf("const sendDocuSign=async()=>{");
  const handler = S.slice(i, S.indexOf("\n  };", i));
  const card = S.slice(S.indexOf("{!client.contractSigned&&<Card"), S.indexOf("{dsState===\"sent\"&&<div"));

  t("🔴 the send handler refuses on its own, not only the button", () => {
    // Disabling a button is a hint, not a guard: one stale render, one Enter key or one
    // restored tab away from firing, and what it fires is an irreversible email to a client.
    assert.match(handler, /if\(gaps\.length\)\{[\s\S]{0,400}?return;\s*\}/,
      "the handler will send a gapped agreement if it is ever reached");
    // And it refuses BEFORE the network call, not after it.
    assert.ok(handler.indexOf("if(gaps.length){") < handler.indexOf("docusign-send"),
      "the refusal comes after the envelope has already gone out");
  });

  t("🔴 the button is disabled while anything is missing", () => {
    assert.match(card, /disabled=\{gaps\.length>0\|\|/, "the button is still clickable with gaps present");
  });

  t("the missing items are listed on screen, above the button", () => {
    assert.ok(card.indexOf("Can&rsquo;t send yet") < card.indexOf("<button onClick={sendDocuSign}"),
      "the list is below the button, where it is read after the mistake");
    assert.match(card, /gaps\.map\(\(g,i\)=>\(/, "the gaps are not rendered individually");
    assert.match(card, /\{g\.where\}/, "the screen says what is missing but not where to fix it");
  });

  t("the gaps are computed from the same function the test just ran", () => {
    assert.match(S, /const gaps=contractGaps\(client,pkg\);/,
      "the card builds its own list, which can disagree with the one that blocks the send");
  });
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-contract-gaps: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
