// The platforms count more leads than arrive, and the screen he looks at has to say so.
// Run: node tests/verify-lead-gap-visible.mjs
//
// Bryson, 2026-09-09: *"can you fix the glitch that saying I have two leads but in reality
// it's one, or is that not possible"*. Meta counted 2 on the Roofers campaign; exactly 1
// person reached the OS.
//
// 🔴 THE 2 IS META'S OWN NUMBER AND CANNOT BE UN-COUNTED HERE. It lives in Facebook's
// records. The cause was fixed at source the same evening (KB `lead-double-count`), so it
// will not recur, but the historic figure stays what Meta says it is. What the OS controls
// is whether it repeats that number as though it were fact.
//
// It did. The combined view carried an honest note about the difference, but that note was
// gated on `!sel` — so tapping into the campaign, which is the screen he was actually
// looking at, showed the 2 with no caveat at all.
//
// Worse: the cost per lead there is spend ÷ THAT number. $78 ÷ 2 = $39, when the real
// figure for a lead that reached him is $78. A cost per lead reading half its true value is
// not a display quirk, it is the number a budget gets decided on.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = os.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

// ── The real gap test, extracted and run ─────────────────────────────────────
const line = os.slice(os.indexOf("const leadGap = !!("), os.indexOf("\n", os.indexOf("const leadGap = !!(")) + 1);
ok("the gap test was extracted", /st\.conversions/.test(line) && /st\.leads30/.test(line));
const gap = (st) => new Function("st", `${line}\nreturn leadGap;`)(st);

// His exact numbers.
ok("🔴 two counted against one arrived is a gap", gap({ conversions: 2, leads30: 1, leadsSyncedAt: "now" }));
ok("equal numbers are not", !gap({ conversions: 1, leads30: 1, leadsSyncedAt: "now" }));
ok("zero against zero is not", !gap({ conversions: 0, leads30: 0, leadsSyncedAt: "now" }));

// 🔴 MORE IN THE OS THAN THE PLATFORMS COUNTED IS NORMAL, NOT A GAP: a lead can arrive from
// a phone call, a direct visit or an ad click outside the platform's attribution window.
// Warning about that direction would cry wolf on a healthy account.
ok("more in the OS than the platforms counted is not a gap", !gap({ conversions: 1, leads30: 3, leadsSyncedAt: "now" }));

// Never warn before the lead side has been read, or the gap is against an unknown.
ok("no gap is claimed before the leads have been checked", !gap({ conversions: 2, leads30: 0 }),
  "with no lead sync yet, 'nothing reached the OS' is not a fact");
ok("strings from a stored snapshot are compared as numbers", gap({ conversions: "2", leads30: "1", leadsSyncedAt: "now" }),
  "'2' > '1' happens to work as strings, but '10' > '9' does not");
ok("and the ten-versus-nine case proves it", gap({ conversions: "10", leads30: "9", leadsSyncedAt: "now" }));
ok("missing figures do not invent a gap", !gap({ leadsSyncedAt: "now" }));

// ══════════════════════════════════════════════════════════════════════════════
// THE WARNING IS ON BOTH SCREENS
// ══════════════════════════════════════════════════════════════════════════════

ok("🔴 the campaign view warns too", /\{sel&&leadGap&&<div/.test(code),
  "gating this on !sel is what left the number bare on the screen he taps into");
ok("the combined view still warns", /\{!sel&&leadGap&&<div/.test(code));
ok("both read the same test", [...code.matchAll(/leadGap&&<div/g)].length === 2);

{
  // 🔴 Bounded at its own closing tag. A fixed 600-char slice ran straight into the NEXT
  // warning, which is also amber, so downgrading this one to grey passed.
  const i = code.indexOf("{sel&&leadGap&&<div");
  const block = code.slice(i, code.indexOf("</div>}", i) + 7);
  ok("the campaign warning block was bounded", block.length > 150 && block.length < 700, `got ${block.length} chars`);
  ok("and it does not swallow the account warning", !/\{!sel&&leadGap/.test(block));
  ok("it names whose count it is", /is \{sel\.platform==="meta"\?"Meta":"Google"\}'s own count/.test(block));
  ok("it gives both figures", /\{st\.conversions\}/.test(block) && /\{st\.leads30\}/.test(block));
  ok("🔴 it says the cost per lead above is a best case", /treat the cost per lead above as a best case/.test(block),
    "that tile reads half its true value and nothing else on the screen says so");
  ok("and that the real one is higher", /The real one is higher/.test(block));
  ok("it is amber, not quiet grey", /color:C\.amber/.test(block));
  // 🔴 An account-level gap does not say WHICH campaign lost the person, and inventing a
  // per-campaign arrived-count would be a worse lie than the one being fixed.
  ok("it does not pretend to know which campaign lost the lead", /Across the whole account/.test(block));
}

// ══════════════════════════════════════════════════════════════════════════════
// THE COST PER LEAD IS NAMED AFTER ITS SOURCE
// ══════════════════════════════════════════════════════════════════════════════

ok("the tile takes its caption from the view", /view\.cplSub/.test(code));
ok("🔴 which says whose count it divided by when they disagree",
  /cplSub: leadGap \? "spend ÷ what "\+plat\+" counted" : "spend ÷ leads"/.test(code),
  "'spend ÷ leads' on a figure divided by Meta's inflated count is the misleading part");
ok("the combined view keeps the plain caption", /cpl: st\.cpl, cplSub: "spend ÷ leads"/.test(code));
ok("and an unmeasurable cost per lead still says why", /needs a lead and some spend/.test(code));

// The arithmetic itself is unchanged and still the platform's, which is the honest thing to
// show as long as it is labelled: inventing a per-campaign figure from an account-level gap
// would be a worse lie than the one being fixed.
{
  const i = code.indexOf("cpl: (conv>0&&spend>0) ? spend/conv : null");
  ok("the campaign cost per lead is still spend over the platform's count", i >= 0);
}

console.log(`verify-lead-gap-visible: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
