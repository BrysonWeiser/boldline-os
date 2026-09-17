// MOVING A SIGNED CONTRACT'S START DATE.
//
// Bryson, 2026-09-16, about sending Constantine the agreement before his Shopify store exists:
// *"can I set it for a week from now as the start date and then go into edit in his client tab
// and change the start date and have it automatically update the end date?"*
//
// 🔴 IT DID NOT, AND THAT IS THE BUG THIS FILE EXISTS FOR. The Add Client screen moved the two
// dates together. The EDIT sheet had two independent text boxes, so pushing a start date back a
// week and saving quietly handed the client a term a week SHORT of what they signed for. Nothing
// says a word: the agreement re-renders with the new start, the countdown on the client screen,
// the renewal warning and the scorecard's runway all just take the wrong number.
//
// The rule is SHIFT, not recompute. The end moves by the same number of days the start moved, so
// a term somebody set by hand for a reason survives. Recomputing from the committed term would
// silently overwrite it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

// 🔴 THE REAL FUNCTION, EXTRACTED AND RUN — never a stand-in. Re-implementing the rule here
// would test this file's idea of the rule, which is exactly how three suites in this repo passed
// while the page was wrong (KB `repo-tests`).
const grab = (name, src) => {
  const start = src.indexOf(`const ${name} = `);
  if (start < 0) return null;
  const end = src.indexOf("\n};", start);
  return end < 0 ? null : src.slice(start, end + 3);
};
const deps = ["const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };",
  'const fmt     = (d)   => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});'];
const addMonthsSrc = grab("addMonths", UI);
const reslotSrc = grab("reslotTerm", UI);
ok("the shared date helper is still in the page", !!addMonthsSrc);
ok("the reslot rule is still in the page", !!reslotSrc);
// The two helper lines above are pinned to the page's own text so an edit to either is caught
// rather than silently diverging from what this file runs.
for (const d of deps) ok(`the page still defines ${d.slice(6, 19).trim()}`, UI.includes(d));

const reslotTerm = new Function(`${deps.join("\n")}\n${addMonthsSrc}\n${reslotSrc}\nreturn reslotTerm;`)();

// ── 1. The thing he actually asked for ───────────────────────────────────────
{
  // Signed today for a start a week out, three months long. Then the store slips by five days.
  const start = "Sep 24, 2026", end = "Dec 24, 2026";
  const moved = reslotTerm(start, "Sep 29, 2026", end, 3);
  ok("🔴 pushing the start back pushes the end back the same amount", moved === "Dec 29, 2026", moved);
  const back = reslotTerm(start, "Sep 20, 2026", end, 3);
  ok("and pulling it forward does the same in reverse", back === "Dec 20, 2026", back);
}

// ── 2. The term length is preserved, not recalculated ────────────────────────
{
  // A six month term somebody set on purpose must not quietly become three.
  const moved = reslotTerm("Sep 24, 2026", "Oct 1, 2026", "Mar 24, 2027", 3);
  // Seven days later on both ends. Mar 24 plus seven is Mar 31, not Apr 1, which is the whole
  // reason this shifts by DAYS rather than trying to be clever about months.
  ok("🔴 a custom term keeps its length", moved === "Mar 31, 2027", moved);
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  ok("sanity: the gap is identical before and after",
    days("Sep 24, 2026", "Mar 24, 2027") === days("Oct 1, 2026", moved));
}

// ── 3. Nothing to shift, so fall back to the committed term ──────────────────
{
  ok("no end date yet: three months from the new start",
    reslotTerm("", "Sep 24, 2026", "", 3) === "Dec 24, 2026");
  ok("a six month client gets six months", reslotTerm("", "Sep 24, 2026", "", 6) === "Mar 24, 2027");
  ok("a missing term falls back to three months rather than to nothing",
    reslotTerm("", "Sep 24, 2026", "", 0) === "Dec 24, 2026");
  ok("an end date that is not after the start is not treated as a term",
    reslotTerm("Sep 24, 2026", "Oct 1, 2026", "Sep 24, 2026", 3) === "Jan 1, 2027");
}

// ── 4. 🔴 IT MUST NOT FIRE WHILE HE IS STILL TYPING ──────────────────────────
// The box is free text, so every keystroke calls this. "Sep 2" parses to the year 2001 in V8,
// which would set the end date to 2001 and leave it there once he finished the word.
{
  for (const half of ["", "S", "Sep", "Sep 2", "Sep 24", "Sep 24,", "not a date", "24/"])
    ok(`leaves the end date alone for ${JSON.stringify(half)}`, reslotTerm("Sep 24, 2026", half, "Dec 24, 2026", 3) === null);
  ok("but acts the moment there is a real date", reslotTerm("Sep 24, 2026", "Sep 29, 2026", "Dec 24, 2026", 3) !== null);
  ok("a four-digit year that still will not parse is refused too",
    reslotTerm("Sep 24, 2026", "Sxp 99, 2026", "Dec 24, 2026", 3) === null);
}

// ── 5. Month ends, where naive date arithmetic goes wrong ────────────────────
{
  ok("the end of a short month does not roll into the next one",
    reslotTerm("", "Jan 31, 2026", "", 1) === "Feb 28, 2026");
  ok("a leap year is handled by the same helper", reslotTerm("", "Jan 31, 2028", "", 1) === "Feb 29, 2028");
}

// ── 6. The sheet actually uses it ────────────────────────────────────────────
{
  const sheet = UI.slice(UI.indexOf("function EditClientSheet"), UI.indexOf("function EditClientSheet") + 60000);
  ok("🔴 the start box calls the shifting setter, not the plain one",
    /onChange=\{e=>setStart\(e\.target\.value\)\}/.test(sheet),
    "a plain set() here is the original bug: the start moves and the end stays put");
  ok("and that setter is the one that shifts the end", /const setStart = \(val\) => setForm\(p=>\{[\s\S]{0,400}reslotTerm\(/.test(sheet));
  ok("the end date is still editable by hand", /onChange=\{e=>set\("contractEnd",e\.target\.value\)\}/.test(sheet));
  // He cannot read a date arithmetic bug, so the sheet says how long the term works out to.
  ok("the sheet says how long the term comes to", /That is \$\{d\} days/.test(sheet));
  ok("and warns when it is under the three month commitment", /Shorter than the three month commitment/.test(sheet));
}

// ── 7. 🔴 BREAK EVERY GUARD ONCE ─────────────────────────────────────────────
{
  ok("caught: the end is recomputed from the term instead of shifted",
    (() => {
      const src = reslotSrc.replace(/if \(span > 0\) return fmt\(addDays\(ns, span\)\);/, "");
      const f = new Function(`${deps.join("\n")}\n${addMonthsSrc}\n${src}\nreturn reslotTerm;`)();
      return f("Sep 24, 2026", "Oct 1, 2026", "Mar 24, 2027", 3) !== "Mar 31, 2027";
    })(),
    "a six month term would silently become three");
  ok("caught: the half-typed guard is removed",
    (() => {
      const src = reslotSrc.replace(/if \(!\/\\b\\d\{4\}\\b\/\.test\(String\(nextStart \|\| ""\)\)\) return null;/, "");
      const f = new Function(`${deps.join("\n")}\n${addMonthsSrc}\n${src}\nreturn reslotTerm;`)();
      return f("Sep 24, 2026", "Sep 2", "Dec 24, 2026", 3) !== null;
    })(),
    "the end date would land in 2001 while he was still typing the word");
}

console.log(`verify-contract-dates: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
