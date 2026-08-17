// Demo client safety + shape. Run: node tests/verify-demo-client.mjs
//
// The demo account exists so the OS renders something when there are no real clients.
// It carries an ACTIVE contract, an email and sample leads on purpose, which is exactly
// what makes it dangerous: server-side jobs read every client row and cannot tell that
// the numbers are invented. Without the `demo` flag the Monday weekly-report job would
// email a performance report built from fake data, and lead-followup would text and
// email the sample leads.
//
// This file guards both halves: that the flag is set and the contact details are
// unroutable, and that every outbound job actually checks the flag.

import { readFileSync } from "node:fs";
const s = readFileSync("index.html", "utf8");
const grab = (start, end) => { const i = s.indexOf(start); return s.slice(i, s.indexOf(end, i)); };

// pull the helpers makeDemoClient depends on
const src = [
  "const today=new Date();",
  "const addDays=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};",
  'const fmt=(d)=>new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});',
  "const uid=()=>Math.random().toString(36).slice(2,9);",
  'const makeSlug=(n)=>String(n).toLowerCase().replace(/[^a-z0-9]+/g,"-");',
  "const crypto={randomUUID:()=>'u-'+Math.random().toString(36).slice(2)};",
  grab("const ALL_FEATURES = [", "const getUpgradeOptions"),
  grab("const buildBots", "\n};") + "\n};",
  grab("function makeDemoClient()", "\nfunction AddClientSheet"),
  "return makeDemoClient();",
].join("\n");
const c = new Function(src)();

let pass = 0; const fails = [];
const ok = (l, cond, d) => cond ? pass++ : fails.push(l + (d ? " — " + d : ""));

ok("demo flag is set", c.demo === true);
ok("not internal", c.internal === false);
ok("has a package", !!c.packageId);
ok("contract is active so the screens look alive", c.contractStatus === "active");
ok("email is unroutable (RFC 2606)", /@example\.com$/.test(c.email), c.email);
ok("all lead emails unroutable", c.leadsLog.every(l => /@example\.com$/.test(l.email)));
ok("all phones are in the reserved 555-01xx range",
  [c.businessPhone, ...c.leadsLog.map(l => l.phone)].every(p => /\)\s*555-01\d\d$/.test(p)),
  [c.businessPhone, ...c.leadsLog.map(l => l.phone)].join(" "));
ok("no lead is left in status new (nothing looks overdue)", c.leadsLog.every(l => l.status !== "new"));
ok("name says DEMO", /DEMO/.test(c.name));
ok("has bot statuses", Object.keys(c.botStatuses).length > 15);
ok("pipeline is mid-flight, not all-done", (() => {
  const v = Object.values(c.botStatuses);
  return v.includes("done") && v.includes("active") && v.includes("waiting");
})());
ok("has comm history", c.commLog.length >= 3);
ok("has leads", c.leadsLog.length >= 3);
ok("no ad account linked (so ads-sync and autopilot skip it)",
  !c.googleAdsCustomerId && !c.metaAdAccountId);

// the server-side gates
const rs = readFileSync("netlify/lib/report-shared.mjs", "utf8");
ok("isReportable checks the demo flag", /isDemo\(client\)/.test(rs.split("const isReportable")[1].slice(0, 200)));
ok("isOwnerBriefable checks the demo flag", /isDemo\(client\)/.test(rs.split("const isOwnerBriefable")[1].slice(0, 300)));
const lf = readFileSync("netlify/functions/lead-followup.mjs", "utf8");
ok("lead-followup skips demo clients in the main loop", /client\.demo\) return \{ id: row\.id, skipped: "demo client" \}/.test(lf));
ok("lead-followup skips demo clients in test mode too", /client\.demo\) continue/.test(lf));

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ demo client: ${pass} checks passed`);
console.log(`\n  ${c.name} | ${c.niche} | ${c.packageId} | ${c.stage} | ${c.leads} leads @ $${c.cpl} CPL`);
console.log(`  contract ${c.contractStart} → ${c.contractEnd}`);
process.exit(fails.length ? 1 : 0);
