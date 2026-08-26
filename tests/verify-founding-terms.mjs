// The terms a client actually signs, checked by RUNNING the contract generator.
//
// Bryson, 2026-08-26, about to send his first agreement: *"i didnt go over with sebastian
// was the $400 minimum. if i remember correctly we only discussed $50 per qualified lead."*
// He was right, and the near miss was worse than a missing paragraph.
//
// 🔴 THE THING THIS SUITE EXISTS TO STOP: A TERM IN THE CONTRACT THAT THE CLIENT WAS NEVER
// TOLD. At $50 a lead a client would need eight qualified leads in a month to reach a $400
// floor, against an expectation of two to five. So the floor, not the rate, would have been
// what he paid nearly every month, and $400 on a $500 ad budget is 80% of ad spend from a
// client who had already rejected pricing in writing for being too large a share of budget.
// A number a client meets for the first time inside a signed document is how a first client
// becomes a former client.
//
// Two real bugs were found here and both are guarded below:
//   1. A WAIVED MINIMUM WAS IMPOSSIBLE TO EXPRESS. `cl.billingMonthly || pkg.price` treats
//      zero as absent, so waiving the floor silently printed the full package price.
//   2. THE CONTRACT AND THE INVOICE DISAGREED. Billing reads `cl.billingPerLead`; the
//      contract read only the niche default table. A client could sign one rate and be
//      invoiced another.
//
// The generator is sliced out of index.html and EXECUTED, never pattern-matched, because
// what matters is the sentence on the page the client signs (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");

// Sliced on the declarations themselves rather than line numbers, so an unrelated edit
// above cannot silently shift the window and leave this suite testing nothing.
function decl(name, endMark) {
  const start = S.indexOf(`\nconst ${name}`);
  if (start < 0) throw new Error(`could not find ${name}`);
  const end = S.indexOf(endMark, start + name.length + 10);
  if (end < 0) throw new Error(`could not find the end of ${name}`);
  return S.slice(start, end + endMark.length);
}
const DEPS = [
  'var LOGO="";',                       // an image, irrelevant to the terms
  decl("ALL_FEATURES = [", "\n];"),
  decl("PKG_FEATURES = {", "\n};"),
  decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"),
  decl("makeContractHTML=", "\n};"),
].join("\n");

let make;
try { make = new Function(DEPS + "\nreturn makeContractHTML;")(); }
catch (e) { console.error(`  FAIL  could not build the contract generator: ${e.message}`); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const PKG = {
  id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750,
  leadFee: true, pricingModel: "per_lead", tier: "launch", optimizationFreq: "monthly",
};
const BASE = {
  id: "abc12345", name: "Stencil & Thread", contactName: "Sebastian Perrin",
  niche: "Custom Apparel", packageId: "g-launch", contractTermMonths: 3,
  contractStart: "Aug 27, 2026", contractEnd: "Nov 26, 2026",
};

// ── 1. A founding client: pays per result, no floor, no setup ─────────────────
{
  const h = make({ ...BASE, billingPerLead: 50, billingMonthly: 0, billingSetup: 0 }, PKG);
  ok("the rate that was actually agreed appears", h.includes("$50 per qualified lead"));
  ok("🔴 the floor he was never told about does NOT appear anywhere", !h.includes("$400"),
    "a client must never meet a number for the first time inside a signed document");
  ok("the waiver is named as a term, not printed as a zero", h.includes("None during the Initial Term"));
  ok("so it never reads as $0/mo", !h.includes("$0/mo"));
  ok("the setup fee reads Waived", h.includes("Waived") && !h.includes("$750"));
  ok("🔴 a month with no leads costs him nothing", h.includes("Client owes Agency nothing for that month"));
  // Disclosed UP FRONT, which is the entire difference between an introductory rate and a
  // bait and switch.
  ok("🔴 the future minimum is disclosed in the agreement he signs today",
    h.includes("From any renewal term onward a Monthly Minimum will apply"));
  ok("and renewing is explicitly his choice", h.includes("under no obligation to renew"));
  ok("nothing is billed in advance, because there is no floor to bill", h.includes("Nothing is billed in advance"));
  ok("he is billed for results already delivered", h.includes("billed in arrears"));
  // 🔴 The clause that would have hurt most. The standard exit recovers the gap between the
  // standard rate and a rate DISCOUNTED IN EXCHANGE FOR THE TERM. A founding waiver is not
  // that, and applying it would bill the full minimum for every month he had paid nothing on.
  ok("🔴 there is no early-termination fee", h.includes("THERE IS NO EARLY-TERMINATION FEE AND NO RATE CLAWBACK"));
  ok("🔴 and the waived minimum can never be clawed back", !h.includes("discounted rate actually paid"));
  ok("the greater-of rule is gone, there being no floor to be greater than",
    !h.includes("THE TWO ARE NEVER CHARGED TOGETHER"));
  ok("the section is titled for what it actually is", h.includes("4. Performance Fee"));
  // Everything protective must survive the swap. A half-adapted agreement is what a
  // dispute turns on.
  ok("the qualified-lead definition survives", h.includes("&ldquo;Qualified Lead&rdquo;"));
  ok("so does the disputes window", h.includes("ten (10) days of the invoice date"));
  ok("and the no-results warranty", h.includes("does not warrant that any lead will become a paying customer"));
  ok("and the ad-spend firewall", h.toLowerCase().includes("never held or advanced") || h.includes("Client&rsquo;s own"));
}

// ── 2. A standard client is untouched by any of it ────────────────────────────
{
  const h = make({ ...BASE, billingPerLead: 75 }, PKG);
  ok("a standard client still carries the monthly minimum", h.includes("$400/mo"));
  ok("and the greater-of rule", h.includes("THE TWO ARE NEVER CHARGED TOGETHER"));
  ok("and the standard section title", h.includes("4. Monthly Minimum and Performance Fee"));
  ok("and the standard setup fee", h.includes("$750"));
  ok("and the early-termination fee", h.includes("early-termination fee equal to"));
  ok("their own agreed rate is used", h.includes("$75 per qualified lead"));
  ok("🔴 and it beats the niche default rather than the other way round", !h.includes("$50 per qualified lead"));
}

// ── 3. An explicit zero is not the same as an unset field ─────────────────────
// The two overrides are independent, and conflating them is how one waiver quietly grants
// another that was never agreed.
{
  const h = make({ ...BASE, billingPerLead: 50, billingSetup: 0 }, PKG);
  ok("waiving setup alone leaves the monthly minimum standing", h.includes("$400/mo"));
  ok("while the setup still reads Waived", h.includes("Waived") && !h.includes("$750"));
}
{
  const h = make({ ...BASE, billingPerLead: 50, billingMonthly: 0 }, PKG);
  ok("waiving the minimum alone leaves the setup fee standing", h.includes("$750"));
  ok("while the minimum reads as waived", h.includes("None during the Initial Term"));
}

// ── 4. The niche default still works when nothing is overridden ───────────────
{
  const h = make({ ...BASE, niche: "Roofing" }, PKG);
  ok("a client with no agreed rate falls back to the niche table", h.includes("$75 per qualified lead"));
}


// ── 5. The Billing card must agree with the contract ──────────────────────────
// 🔴 THE SAME FALSY BUG LIVED IN TWO PLACES. The card Bryson reads would have shown $400 to
// a founding client whose signed agreement said the minimum was waived. Two surfaces
// disagreeing about what someone owes is the failure this whole file exists to prevent, so
// the shape of that read is pinned rather than left to a future edit.
{
  const at = S.indexOf("function BillingCard");
  // Comments in this component explain the very rule being checked, so a prose mention
  // would satisfy a regex that the code did not (KB `repo-tests`, the comment trap).
  const card = S.slice(at, at + 2600).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("the billing card reads the minimum with a null check, not a falsy one",
    /client\.billingMonthly!=null\?Number\(client\.billingMonthly\)/.test(card),
    "`||` treats a waived $0 minimum as unset and shows the package price instead");
  ok("🔴 and no longer uses the falsy form", !/client\.billingMonthly\|\|\(pkg/.test(card));
  ok("the setup fee beside it still uses a null check too",
    /client\.billingSetup!=null/.test(card));
}


// ── 6. The Billing card must be able to EXPRESS these terms ───────────────────
// 🔴 THE ORDERING BUG BRYSON HIT. The per-qualified-lead rate is a CONTRACT TERM, printed
// in the agreement the client signs. It was only editable once Stripe billing was active,
// which happens after signing, so the one number defining what the client agreed to was
// unreachable at the moment it had to be set. And a $0 monthly was refused outright with
// "Stripe requires a recurring amount" — true of a SUBSCRIPTION, but results-only pricing
// creates no subscription at all, so that constraint belonged on the Stripe button.
{
  const at = S.indexOf("function BillingCard");
  const card = S.slice(at, S.indexOf("function ", at + 20) > 0 ? S.indexOf("\nfunction ", at + 20) : at + 20000)
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

  ok("🔴 the per-lead rate can be set before billing is ever live",
    /adjPerLead/.test(card) && /Per Qualified Lead/.test(card),
    "it is a contract term, so it must be settable before the contract is generated");
  ok("and the editor saves it onto the client", /billingPerLead:rate/.test(card));
  ok("opening the editor pre-fills the rate already agreed", /setAdjPerLead\(perLeadRate>0/.test(card));

  ok("🔴 a zero monthly is no longer refused outright",
    !/Monthly fee must be greater than zero/.test(card),
    "that message blocked every results-only client");
  ok("it is refused only when there is no per-lead rate either, which bills nothing ever",
    /!\(m>0\)&&!\(effRate>0\)/.test(card));
  ok("the Stripe constraint sits on the Stripe button instead", /monthly>0\s*\n?\s*\?\s*<button onClick=\{setupBilling\}/.test(card));
  ok("and a results-only client is told why there is no subscription",
    /no subscription to create/.test(card));

  ok("🔴 the card no longer calls it a management fee",
    !/management fee/i.test(card),
    "that model was rejected in writing by the first client and replaced on 2026-08-18");
  ok("it shows the per-lead rate beside the minimum", /qualified lead/.test(card));
  ok("and says plainly when there is no minimum", /No monthly minimum/.test(card));
}

console.log(`verify-founding-terms: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
