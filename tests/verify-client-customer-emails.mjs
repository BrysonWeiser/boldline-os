// "Bring back past customers" for CLIENTS (KB business-emails, "Clients too").
// Run: node tests/verify-client-customer-emails.mjs
//
// Bryson, 2026-11-06, said yes to folding the customer emails (reminder before a job, review request after, "time for
// another") into doing all of a client's marketing. They ran for his own businesses only. What this stops, worst first:
//  1. A client's customers hearing from us before the client agreed (off until he switches it on).
//  2. A patient's email in our hands without a privacy agreement (health businesses are blocked).
//  3. An unsubscribe link in a client's email that doesn't work.
//  4. Sending as anyone but the business itself.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { customerEmailsAllowed, customerEmailsSetupAllowed, customerEmailsHealthBlocked, customerEmailsClient, dueCustomerEmails, customerEmailsOf } from "../netlify/lib/biz-email.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const NOW = Date.parse("2026-11-06T18:00:00Z");
const booking = { on: true, packages: [{ id: "full", name: "Full Detail", price: "$199", minutes: 180 }] };
const client = (x = {}) => ({ id: "c1", name: "Tint Ninja", niche: "Window tint", email: "owner@tintninja.com", booking,
  emailSender: { address: "hello@tintninja.com" }, emailSenderStatus: { address: "hello@tintninja.com", verified: true },
  bookings: [{ id: "b1", name: "Sam", email: "sam@x.com", start: new Date(NOW + 20 * 3600e3).toISOString(), end: new Date(NOW + 23 * 3600e3).toISOString(), createdAt: new Date(NOW - 5 * 864e5).toISOString() }], ...x });

// ── 1. Who ──────────────────────────────────────────────────────────────────────────────────────────────────────────
ok("🔴 a client is OFF until he switches it on", !customerEmailsAllowed(client()) && dueCustomerEmails(client(), NOW).length === 0);
ok("🔴 switched on, their customer gets the reminder before the job", customerEmailsAllowed(client({ customerEmails: { clientOn: true } })) && dueCustomerEmails(client({ customerEmails: { clientOn: true } }), NOW).some((d) => d.kind === "reminder"));
ok("only a client whose BoldLine website takes bookings (that's where the customers come from)", !customerEmailsClient(client({ booking: { on: false, packages: [] } })) && !customerEmailsAllowed(client({ booking: { on: false, packages: [] }, customerEmails: { clientOn: true } })));
const health = client({ name: "Springbok Wellness", niche: "Chiropractic", customerEmails: { clientOn: true } });
ok("🔴 never a health business, even switched on, and the setup is refused too", !customerEmailsAllowed(health) && !customerEmailsSetupAllowed(health) && customerEmailsHealthBlocked(health) && dueCustomerEmails(health, NOW).length === 0);
ok("never BoldLine's own account or a demo", !customerEmailsAllowed(client({ internal: true, customerEmails: { clientOn: true } })) && !customerEmailsAllowed(client({ demo: true, customerEmails: { clientOn: true } })));
ok("🔴 sent only from the business's own proven address: without it, nothing", dueCustomerEmails(client({ customerEmails: { clientOn: true }, emailSenderStatus: { verified: false } }), NOW).length === 0);
ok("a client who said no to review requests never gets the review email", customerEmailsOf(client({ declinedFeatures: ["review_requests"] })).review === false && customerEmailsOf(client()).review === true);
ok("his own businesses work exactly as before", customerEmailsAllowed({ internal: true, owned: true, name: "Corvane" }));

// ── 2. Wired in ─────────────────────────────────────────────────────────────────────────────────────────────────────
const JOB = src("netlify/functions/biz-customer-emails.mjs"), SET = src("netlify/functions/biz-email.mjs"), OPT = src("netlify/functions/optout.mjs"), UI = src("index.html");
ok("the hourly job sends for exactly the businesses the rules allow", /if \(!customerEmailsAllowed\(cl\)\) continue;/.test(JOB) && !/isOwned\(cl\)/.test(JOB));
ok("setting up the sending address works for an allowed client, and says why for a health business", /!customerEmailsSetupAllowed\(row\.data\)/.test(SET) && /Customer emails are off for health businesses/.test(SET));
ok("🔴 the unsubscribe link works for a client's customers (anything but BoldLine's own account or a demo)", /row\.data\.demo \|\| \(row\.data\.internal && !isOwned\(row\.data\)\)/.test(OPT) && !/!isOwned\(row\.data\)\) return page/.test(OPT));
ok("the card shows on a client whose website takes bookings, website-only or not", /\(isOwned\(client\)\|\|custEmailsClientOS\(client\)\)&&<CustomerEmailsCard/.test(UI) && /custEmailsClientOS\(client\)&&<div style=\{\{marginTop:11\}\}><CustomerEmailsCard/.test(UI));
ok("🔴 for a client it carries the switch, and says to tick it only once they've agreed", /checked=\{!!ce\.clientOn\} onChange=\{e=>setCE\(\{clientOn:e\.target\.checked\}\)\}/.test(UI) && /Only tick this once they've agreed\./.test(UI));
ok("a health business sees why it's off", /Off for health businesses\. A patient's email address is private health information/.test(UI));

console.log(`verify-client-customer-emails: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
