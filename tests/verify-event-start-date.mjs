// THE TERM STARTS WHEN THE ADS DO, NOT ON A DATE SOMEBODY GUESSED.
//
// Bryson, 2026-09-17: *"yea do that"*, after working out for himself that a fixed start date in
// a signed agreement cannot be moved without an amendment.
//
// 🔴 THE PROBLEM. A contract was signed with a date chosen a week or two ahead, before anyone
// knew when the client would hand over their ad account. That date is an operative term of a
// frozen PDF, and this agreement's own amendment clause requires a signed writing from both
// parties for anything but upgrades and renewals. So every slipped launch cost an amendment.
// It happened to Stencil & Thread, who were given the concession by hand, and was about to
// happen to Air Suds. Twice is a pattern, so it became the wording.
//
// From terms v5 the Start Date IS the day the first campaign begins delivering. A slip is then
// the agreement working as written rather than a change to it: nothing to amend, nothing to
// re-sign. `ads-sync` recognises that day from the platforms' own spend and records it.
//
// 🔴 WHAT MUST NOT HAPPEN, and most of this file is about these two:
//   1. A client on v4 or earlier has a FIXED date in their signed PDF. Rewriting their start
//      date automatically would recreate, at scale, the exact drift fixed the day before.
//   2. The date must come from the PLATFORMS' spend, not from our own launch button. A campaign
//      can be switched on and sit in review delivering nothing, and a campaign can be started
//      by hand in Ads Manager where our button never ran.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import {
  TERMS_EVENT_START, usesEventStart, hasSpent, shiftEnd, fmtDate, goLiveDecision,
} from "../netlify/lib/campaign-live.mjs";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const SYNC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
const CJS = readFileSync(join(ROOT, "netlify/lib/contract-shared.cjs"), "utf8");
const { makeContractHTML } = require(join(ROOT, "netlify/lib/contract-shared.cjs"));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const PKG = { id: "e-launch", name: "Store Launch", platform: "Meta Ads", price: 400, setup: 800, tier: "launch", pricingModel: "ad_spend_pct", adSpendPct: 15 };
const CL = {
  id: "cl-1", name: "Air Suds", contactName: "Constantine", email: "c@airsuds.test",
  packageId: "e-launch", contractStart: "Oct 1, 2026", contractEnd: "Jan 1, 2027",
  contractTermMonths: 3, adBudget: "$1,000/mo",
};
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// ── 1. What the agreement says before the ads run ────────────────────────────
{
  const t = text(makeContractHTML(CL, PKG));
  ok("🔴 the Start Date is the event, not the guess", /Start Date The day the ads go live/.test(t), t.slice(t.indexOf("Start Date"), t.indexOf("Start Date") + 80));
  ok("the guess is still shown, marked as an estimate", /The day the ads go live estimated Oct 1, 2026/.test(t));
  ok("the End Date follows the same way", /End Date 3 months after the Start Date estimated Jan 1, 2027/.test(t));
  ok("🔴 and section 2 says what starts the term",
    /The Start Date is the date on which the first advertising campaign under this Agreement begins delivering, as recorded by the advertising platform/.test(t));
  ok("🔴 and says the printed date does not", /is an estimate for planning and does not itself begin the term/.test(t),
    "without this the estimate could be argued to be the operative date, which is the bug");
  ok("and promises to confirm it", /Agency will confirm the Start Date to Client in writing once it occurs/.test(t));
  ok("no minimum accrues before then", /No Monthly Minimum accrues before the Start Date/.test(t));

  // 🔴 THE EFFECTIVE DATE SPLITS OFF FROM THE START DATE. Before v5 they were one field, which
  // put the fourteen-day handover clock AFTER the day we need the handover in order to launch.
  ok("🔴 the Effective Date is signature, not the start date",
    /Effective Date: the date of last signature/.test(text(makeContractHTML(CL, PKG))),
    "an unsigned agreement must not print a planning estimate as the date it takes effect");
  const signed = { ...CL, contractSigned: true, contractSignedAt: "2026-09-18T00:00:00Z" };
  ok("and once signed it is the signature date", /Effective Date: September 18, 2026/.test(text(makeContractHTML(signed, PKG))));
  ok("🔴 the handover clock runs from the Effective Date, so it starts at signing",
    /provide these within fourteen \(14\) days of the Effective Date/.test(text(makeContractHTML(signed, PKG))),
    "running it from the Start Date would ask for the account access after the launch it enables");
  ok("🔴 but the money in that clause runs from the Start Date",
    /Monthly Minimum remains payable for each month or part month from the Start Date/.test(text(makeContractHTML(signed, PKG))),
    "billing from signature would charge for time before the term began, which 2.2 says it does not");
}

// ── 2. Once the ads are running, it is just a date ───────────────────────────
{
  const live = { ...CL, contractTermsVersion: 5, campaignLiveAt: "2026-10-06T18:00:00Z", contractStart: "Oct 6, 2026", contractEnd: "Jan 6, 2027" };
  const t = text(makeContractHTML(live, PKG));
  ok("the Start Date prints the real day", /Start Date Oct 6, 2026/.test(t));
  ok("and the End Date with it", /End Date Jan 6, 2027/.test(t));
  ok("nothing still calls it an estimate", !/estimated/.test(t) && !/The day the ads go live/.test(t));
}

// ── 3. 🔴 EVERY EXISTING CLIENT'S AGREEMENT IS UNTOUCHED ─────────────────────
// This is the half that matters most. A client signed under v4 has a fixed date in a frozen PDF.
for (const v of [1, 2, 3, 4]) {
  const t = text(makeContractHTML({ ...CL, contractTermsVersion: v }, PKG));
  ok(`🔴 a v${v} agreement still names a fixed start date`, /Start Date Oct 1, 2026/.test(t),
    "changing how an older agreement reads is the drift this was built to stop");
  ok(`a v${v} agreement keeps the old section 2.1`, /2.1 This Agreement begins on the Start Date and continues for the Committed Term/.test(t));
  ok(`a v${v} agreement's Effective Date is unchanged`, /Effective Date: Oct 1, 2026/.test(t));
  if (v >= 2) ok(`a v${v} delay clause still bills from the Effective Date`, /part month from the Effective Date/.test(t));
}

// ── 4. The numbering does not collide ────────────────────────────────────────
// v5 inserts a new 2.2, so the two clauses after it shift. A duplicated number in a contract is
// the kind of sloppiness a client notices and a lawyer enjoys.
{
  const v5 = text(makeContractHTML(CL, PKG));
  for (const n of ["2.1", "2.2", "2.3", "2.4"]) {
    ok(`v5 has exactly one ${n}`, (v5.match(new RegExp(`\\s${n.replace(".", "\\.")}\\s`, "g")) || []).length === 1,
      `${(v5.match(new RegExp(`\\s${n.replace(".", "\\.")}\\s`, "g")) || []).length} of them`);
  }
  ok("v5 renumbers renewal to 2.3", /2\.3 At the end of any term, the parties may renew/.test(v5));
  ok("v5 renumbers holdover to 2.4", /2\.4 Holdover/.test(v5));
  const v4 = text(makeContractHTML({ ...CL, contractTermsVersion: 4 }, PKG));
  ok("🔴 v4 keeps its original numbering", /2\.2 At the end of any term/.test(v4) && /2\.3 Holdover/.test(v4));
  ok("and has no 2.4", !/\s2\.4\s/.test(v4));
}

// ── 5. The version was actually bumped in every place that names one ─────────
{
  ok("🔴 the renderer's current version is 5", /const TERMS_CURRENT = 5;/.test(CJS));
  ok("and the OS copy agrees", /const TERMS_CURRENT = 5;/.test(UI));
  ok("🔴 and the renewal stamp was bumped with it", /const CONTRACT_TERMS_VERSION = 5;/.test(UI),
    "a renewal that stamps an older version writes the client back onto terms they are not signing");
  ok("the gate matches the module the sync reads", TERMS_EVENT_START === 5);
}

// ── 6. Which clients the new wording applies to ──────────────────────────────
{
  ok("a v5 client uses the event start", usesEventStart({ contractTermsVersion: 5 }));
  ok("a v6 client would too", usesEventStart({ contractTermsVersion: 6 }));
  ok("🔴 a v4 client does not", !usesEventStart({ contractTermsVersion: 4 }));
  ok("and neither does one with nothing recorded", !usesEventStart({}) && !usesEventStart(null),
    "an absent version is an OLD client, because new ones are stamped");
}

// ── 7. 🔴 SPEND IS THE PROOF, NOT A SWITCH ───────────────────────────────────
{
  ok("money moved counts", hasSpent({ totals: { spend30d: 0.42 } }));
  ok("🔴 a live campaign that has spent nothing does NOT", !hasSpent({ totals: { liveCampaigns: 3, spend30d: 0 } }),
    "a campaign can be switched on and sit in review delivering nothing, and starting a client's "
    + "term on a day nothing ran is the same unfairness as guessing the date");
  ok("no sync data at all does not", !hasSpent(null) && !hasSpent({}) && !hasSpent({ totals: {} }));
  ok("a junk figure does not", !hasSpent({ totals: { spend30d: "lots" } }));
}

// ── 8. The decision itself ───────────────────────────────────────────────────
{
  const perf = { totals: { spend30d: 12.5 } };
  const AT = new Date("2026-10-06T18:00:00Z");
  const v5 = { ...CL, contractTermsVersion: 5 };

  const d = goLiveDecision(v5, perf, AT);
  ok("🔴 the start date moves to the day the ads ran", d.patch.contractStart === "Oct 6, 2026", JSON.stringify(d.patch));
  ok("and the end date moves with it, keeping the term the same length", d.patch.contractEnd === "Jan 6, 2027");
  ok("the go-live is recorded as a real moment", d.patch.campaignLiveAt === AT.toISOString());
  ok("and it says there is nothing to re-sign", /nothing to re-sign/.test(d.note));

  ok("🔴 it happens once and once only", goLiveDecision({ ...v5, campaignLiveAt: "2026-10-06T18:00:00Z" }, perf, AT).patch === null,
    "re-stamping on every sync would walk a client's term forward for ever");
  ok("nothing happens before anything has run", goLiveDecision(v5, { totals: { spend30d: 0 } }, AT).patch === null);
  ok("the house account is skipped", goLiveDecision({ ...v5, internal: true }, perf, AT).patch === null);

  // 🔴 THE ONE THAT PROTECTS EVERY EXISTING CLIENT.
  const old = goLiveDecision({ ...CL, contractTermsVersion: 4 }, perf, AT);
  ok("🔴 a client on fixed-date terms keeps their dates", !old.patch.contractStart && !old.patch.contractEnd,
    "their signed PDF names a date, and moving the OS's copy recreates the drift just fixed");
  ok("their go-live is still recorded", old.patch.campaignLiveAt === AT.toISOString());
  ok("and Bryson is told why nothing changed", /fixed start date/.test(old.note) && /written amendment/.test(old.note));

  // Already right to the day: record it, change nothing.
  const same = goLiveDecision({ ...v5, contractStart: "Oct 6, 2026" }, perf, AT);
  ok("a launch on the planned day changes no dates", !same.patch.contractStart, JSON.stringify(same.patch));
  ok("but is still recorded", same.patch.campaignLiveAt === AT.toISOString());

  // A term set by hand survives.
  const six = goLiveDecision({ ...v5, contractStart: "Oct 1, 2026", contractEnd: "Apr 1, 2027" }, perf, AT);
  ok("🔴 a six month term stays six months", six.patch.contractEnd === "Apr 6, 2027",
    "recomputing from the committed term would silently make it three");
  ok("a client with no end date on record does not get an invented one",
    !("contractEnd" in goLiveDecision({ ...v5, contractEnd: "" }, perf, AT).patch));
}

// ── 9. The shift rule is the same one the edit sheet uses ────────────────────
// 🔴 It exists twice: `shiftEnd` on the server and `reslotTerm` in the browser bundle, because
// the OS is one static file that cannot import it. Both are RUN and compared, not read.
{
  const src = UI.slice(UI.indexOf("const reslotTerm = "), UI.indexOf("\n};", UI.indexOf("const reslotTerm = ")) + 3);
  ok("the OS copy of the rule is still there", /reslotTerm/.test(src) && src.length > 100);
  const deps = ["const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };",
    'const fmt     = (d)   => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});',
    UI.slice(UI.indexOf("const addMonths = "), UI.indexOf("\n};", UI.indexOf("const addMonths = ")) + 3)].join("\n");
  const reslot = new Function(`${deps}\n${src}\nreturn reslotTerm;`)();
  for (const [ps, ns, pe] of [
    ["Oct 1, 2026", "Oct 6, 2026", "Jan 1, 2027"],
    ["Oct 1, 2026", "Sep 28, 2026", "Jan 1, 2027"],
    ["Jan 31, 2026", "Feb 3, 2026", "Apr 30, 2026"],
    ["Oct 1, 2026", "Oct 1, 2026", "Apr 1, 2027"],
  ]) {
    ok(`🔴 both shift rules agree moving ${ps} to ${ns}`, shiftEnd(ps, ns, pe) === reslot(ps, ns, pe, 3),
      `server ${shiftEnd(ps, ns, pe)} vs OS ${reslot(ps, ns, pe, 3)}`);
  }
  ok("an unreadable date shifts nothing", shiftEnd("", "Oct 6, 2026", "") === "" && shiftEnd("Oct 1, 2026", "nope", "Jan 1, 2027") === "");
  ok("and an end before the start is refused", shiftEnd("Oct 1, 2026", "Oct 6, 2026", "Sep 1, 2026") === "");
  ok("the date format matches what the OS writes", fmtDate(new Date("2026-10-06T18:00:00Z")) === "Oct 6, 2026");
}

// ── 10. The sync is where it happens, and it writes once ─────────────────────
{
  ok("🔴 the sync asks the question", /const live = goLiveDecision\(cl, adPerf, new Date\(\)\);/.test(SYNC));
  ok("🔴 and it reads the platforms' own figures, not our launch button",
    /goLiveDecision\(cl, adPerf/.test(SYNC) && !/goLiveDecision\([^)]*pendingActions/.test(SYNC),
    "adPerf is built from Google's and Meta's reporting in this same run");
  ok("the patch is merged into the write that was happening anyway",
    /\.\.\.\(live\.patch \|\| \{\}\),/.test(SYNC),
    "a second write would be a second chance to half-apply it");
  ok("the client's history records it", /cat: "contract"/.test(SYNC) && /live\.note/.test(SYNC));
  ok("🔴 Bryson is told, and told differently when nothing moved",
    /severity: live\.patch\.contractStart \? "green" : "yellow"/.test(SYNC),
    "a client whose dates could not move needs a decision from him, not a congratulation");
  ok("an alert that fails does not lose the write",
    /\.catch\(\(e\) => console\.error\("ads-sync: go-live alert failed/.test(SYNC));
}

console.log(`verify-event-start-date: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
