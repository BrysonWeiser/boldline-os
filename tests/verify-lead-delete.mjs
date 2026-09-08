// 🔴 A client's leads could not be removed. From anywhere. On any device.
//
// Found 2026-09-07: Bryson went to clear two fake test leads off Stencil & Thread, BoldLine's
// first client, and there was no control to do it. I had told him to use the Delete button he
// had seen on a website lead, which is a different list in a different table.
//
// It is the list where rubbish costs money. Leads here are what the per-lead invoice is built
// from, they feed the health score and the cost per lead, and a fake one suppresses the
// "no leads yet" alert by making a dead account look productive. The two test leads were
// doing all three at once.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const UI = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

ok("a client lead can be deleted at all",
  /const deleteLead = \(idx\) =>/.test(UI),
  "every other list in the OS can be cleaned up; this was the one that could not");
ok("it actually removes the row rather than flagging it",
  /leadsLog: leads\.filter\(\(_,i\)=>i!==idx\)/.test(UI));

// 🔴 THE GUARD THAT MATTERS MOST.
ok("🔴 a BILLED lead can never be deleted",
  /if \(!l \|\| l\.billed\) return;/.test(UI),
  "a line on an invoice must stay explainable months later; deleting it leaves money charged against nothing");
ok("and the guard is in the function, not only in the button",
  /const deleteLead = \(idx\) => \{[\s\S]{0,220}l\.billed\) return;/.test(UI),
  "a UI-only guard is bypassed by the next caller that forgets it");
ok("a billed lead says why it cannot go, instead of just missing a button",
  /Billed, so it stays on the record/.test(UI),
  "a control that silently is not there reads as a bug");

// Irreversible, on a phone, with one thumb.
ok("🔴 deleting always takes two taps",
  /confirmDelLead===idx/.test(UI) && /Delete this lead for good\?/.test(UI),
  "he works the OS one-handed on a phone; a single destructive tap is a matter of time");
// 🔴 The confirm pair is bigger than the OS's other controls ON PURPOSE. Measured at 19px
// tall on the first attempt, which is not a thumb target for an irreversible action.
ok("🔴 the confirm buttons are a real tap target on a phone",
  /Delete<\/button>/.test(UI) && /minHeight:36[\s\S]{0,140}>Delete</.test(UI),
  "19px tall was the first version; he taps this one-handed and it cannot be undone");
ok("the confirm step offers a way out",
  /setConfirmDelLead\(null\)[\s\S]{0,200}Cancel/.test(UI));

// It leaves a trace.
ok("🔴 a deletion is written to the client's history",
  /Lead removed from record:/.test(UI) && /commLog: \[\{ at:new Date\(\)\.toISOString\(\)/.test(UI),
  "without this the lead count simply changes one day and nothing says why");
ok("the note names the lead, so the record is readable later",
  /l\.name \|\| l\.email \|\| l\.phone \|\| "unnamed"/.test(UI));

console.log(`verify-lead-delete: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
