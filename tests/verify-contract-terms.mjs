// What a client is CONTRACTED to pay, not what their package lists.
//
// Bryson, 2026-09-09, looking at Sebastian's Overview: *"make sure the actual revenue tracker
// for each client is accurate based on the contract not just the package"*. The card read
// **$400/mo min · $750 setup**. Sebastian is a founding client: setup WAIVED, NO monthly
// minimum, $50 a qualified lead. All three numbers were the price list, not the agreement.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const UI = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

// Extracted and RUN. The value of this helper is entirely in the numbers it returns.
const m = /const contractTerms = \(client, pkg\) => \{[\s\S]*?\n\};/.exec(S);
if (!m) { console.log("  FAIL  contractTerms could not be extracted"); process.exit(1); }
const contractTerms = new Function("PER_LEAD", "return " + m[0].replace(/^const contractTerms = /, "").replace(/;$/, ""))(
  { Roofing: 75, "Med Spa": 35, "Auto Detailing": 15 });

const PKG = { price: 400, setup: 750 };

// ── Sebastian's actual record ────────────────────────────────────────────────
{
  const t = contractTerms({ billingMonthly: 0, billingSetup: 0, billingPerLead: 50, niche: "Screen printing" }, PKG);
  ok("🔴 a waived setup reads as zero, not the package's $750",
    t.setup === 0,
    "this is the number that was on his screen, and it is money the client was told he would not pay");
  ok("🔴 no monthly minimum reads as zero, not $400", t.monthly === 0);
  ok("his agreed per-lead rate is used", t.perLead === 50);
  ok("and the deal is recognised as results-only", t.resultsOnly === true);
  ok("both waivers are flagged, so a founding deal is not 'corrected' later",
    t.setupWaived === true && t.monthlyWaived === true,
    "\"waived\" and \"this package has no setup fee\" read the same on screen and mean different things to a client");
}

// ── 🔴 THE BUG CLASS: zero is falsy ─────────────────────────────────────────
ok("🔴 a waived fee is not silently replaced by the package price",
  contractTerms({ billingSetup: 0 }, PKG).setup === 0
  && contractTerms({ billingMonthly: 0 }, PKG).monthly === 0,
  "`client.billingSetup || pkg.setup` reinstates the fee he waived, because the discount is stored as 0 and 0 is falsy");
ok("and an empty string is treated as 'not set' rather than zero",
  contractTerms({ billingSetup: "" }, PKG).setup === 750,
  "a cleared field means fall back to the package, not charge nothing");

// ── A normal client still gets the package ──────────────────────────────────
{
  const t = contractTerms({ niche: "Roofing" }, PKG);
  ok("no overrides falls back to the package price", t.monthly === 400 && t.setup === 750);
  ok("and to the niche's standard per-lead rate", t.perLead === 75);
  ok("a normal client is not marked as waived or results-only",
    !t.setupWaived && !t.monthlyWaived && !t.resultsOnly);
}
{
  const t = contractTerms({ billingMonthly: 600, billingSetup: 900 }, PKG);
  ok("an override ABOVE the package is honoured too", t.monthly === 600 && t.setup === 900);
  ok("and a package with no setup fee is not called 'waived'",
    contractTerms({ billingSetup: 0 }, { price: 400, setup: 0 }).setupWaived === false,
    "there is nothing to waive, and saying so would be a claim to the client that is not true");
}
ok("nothing at all is safe input",
  contractTerms(null, null).monthly === 0 && contractTerms({}, {}).setup === 0);

// ── Every surface uses it ───────────────────────────────────────────────────
{
  ok("🔴 the Overview revenue card reads the contract",
    /const t = contractTerms\(client, pkg\);/.test(UI)
    && !/\$\{pkg\.price\.toLocaleString\(\)\}<span[^>]*>\/mo min/.test(UI),
    "this is the card in the screenshot");
  ok("a results-only client leads with the per-lead rate, not a minimum he does not pay",
    /\/qualified lead/.test(UI) && /t\.resultsOnly \?/.test(UI));
  ok("a waived setup says so rather than showing a fee",
    /t\.setupWaived \? "Setup waived"/.test(UI));
  ok("and founding terms are named next to the list price they replace",
    /Founding terms\. The package lists/.test(UI),
    "a deal that reads like a mistake gets 'corrected' by somebody six months from now");
  ok("the Monthly minimum tile agrees with the card beside it",
    /\{l:"Monthly minimum",v:pkg\?\(contractTerms\(client,pkg\)\.monthly>0/.test(UI));
  ok("🔴 the dashboard total counts contracted floors, not list prices",
    /clients\.reduce\(\(s,c\)=>s\+contractTerms\(c,findPkg\(c\.packageId\)\)\.monthly,0\)/.test(UI),
    "summing package prices reports money that will never be invoiced");
  ok("and the revenue screen's rows use it for setup as well as monthly",
    /const t=contractTerms\(cl,pkg\); return \{cl,pkg,floor:t\.monthly,setup:t\.setup\}/.test(UI));
  ok("nothing on a client screen still quotes the raw package price as what they pay",
    !/\{l:"Monthly minimum",v:pkg\?`\$\$\{pkg\.price\}\/mo`/.test(UI));
}

console.log(`verify-contract-terms: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
