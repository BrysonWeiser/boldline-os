// "Only charge leads I mark Came in" (Bryson, 2026-11-16, KB springbok-wellness-deal). For a client who pays when the
// person actually shows up (Springbok: $40 per new patient who comes in), every lead must arrive NOT charged and be
// charged only once ticked. Forgetting a tick may undercharge; it must never overcharge. Run: node tests/verify-came-in-billing.mjs
import { readFileSync } from "node:fs";
const S = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

// The rule itself, lifted from the Billing card and run.
const m = S.match(/const chargeable = \(l\)=>[^;]+;/);
ok("the rule exists", !!m);
const make = (confirmFirst) => new Function("confirmFirst", `${m[0]} return chargeable;`)(confirmFirst);
const normal = make(false), cameIn = make(true);
const L = (o) => ({ name: "x", ...o });
ok("normal client: a new lead is charged", normal(L({})));
ok("normal client: an excluded lead is not", !normal(L({ notBillable: true })));
ok("🔴 came-in client: a new lead is NOT charged", !cameIn(L({})));
ok("came-in client: a ticked lead is charged", cameIn(L({ cameIn: true })));
ok("🔴 came-in client: a ticked but excluded lead is not", !cameIn(L({ cameIn: true, notBillable: true })));
ok("nobody is charged twice", !cameIn(L({ cameIn: true, billed: true })) && !normal(L({ billed: true })));

// Every place money is decided uses the rule.
ok("🔴 Approve marks only charged leads as billed (unticked ones wait for next month)", /const updatedLog=leadLog\.map\(\(l,i\)=> chargeable\(l\) \? \{\.\.\.l,billed:true/.test(S) && !/\(!l\.billed&&!l\.notBillable\) \? \{\.\.\.l,billed:true/.test(S));
ok("the charged list and the flagged count use the rule", /const billableLeads = unbilledLeads\.filter\(x=>chargeable\(x\.lead\)\);/.test(S) && /flaggedBillable = unbilledLeads\.filter\(x=>chargeable\(x\.lead\)/.test(S));
ok("🔴 the invoice email counts the same leads", /leadCount = \(client\.leadsLog\|\|\[\]\)\.filter\(l=>!l\.billed && !l\.notBillable && \(!client\.billingConfirmFirst \|\| l\.cameIn===true\)\)\.length;/.test(S));
ok("the setting is on the Billing card", /onChange=\{e=>onUpdate&&onUpdate\(\{\.\.\.client,billingConfirmFirst:e\.target\.checked\}\)\}/.test(S) && /Only charge \{itPlural\} I mark "Came in"/.test(S));
ok("each lead has a Came in tick", /onClick=\{\(\)=>toggleCameIn\(idx\)\}/.test(S) && /cameIn:l\.cameIn!==true/.test(S));
ok("the total says what is waiting", /waitingCount>0\?` · \$\{waitingCount\} waiting`/.test(S));

ok("a phone call is not flagged for having no name", /if \(!name\) \{ if \(src !== "call_tracking"\) reasons\.push\("No name given"\); \}/.test(S));
ok("a call shows the caller's number and 'Phone call'", /\{lead\.name\|\|\(lead\.source==="call_tracking"&&lead\.phone\)\|\|"Unknown lead"\}/.test(S) && /lead\.source==="call_tracking"\?"Phone call"/.test(S));
ok("the instruction changes to Came in", /Tick <strong style=\{\{color:C\.textDim\}\}>Came in<\/strong> for each one the client confirms/.test(S));
if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-came-in-billing: ${pass} checks passed`);
