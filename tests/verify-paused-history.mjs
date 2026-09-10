// A paused campaign that already ran, and the money the OS said it had not spent.
// Run: node tests/verify-paused-history.mjs
//
// Bryson, 2026-09-09, sent the My Ads screen for a PAUSED campaign showing
// 10,421 views, 226 clicks and $106 spent, with a line underneath reading:
//
//     "This one is paused, so every number above is zero because it has not run."
//
// and, in the campaign list below it:
//
//     "Not running, so it has not been seen by anyone and has spent nothing."
//
// It had been seen twenty thousand times and had spent a hundred and six dollars of his
// money. Worse than the wrong sentence, the LIST HID THE FIGURES ENTIRELY, so $106 of spend
// was invisible on the one screen whose job is to show him where his money went.
//
// 🔴 The wrong rule was "paused means no numbers". True only of a campaign that never
// started. A campaign paused YESTERDAY still carries thirty days of history, and pausing a
// campaign he is finished with is the normal thing he does, not an edge case.
//
// This is the same class as the bug fixed on 2026-09-04 (KB `meta-delivery-states`), where
// a LIVE campaign was labelled paused and got this same sentence. That fix corrected which
// campaigns were called paused. It did not question what the sentence claims about one that
// really is.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── The real predicate, run ──────────────────────────────────────────────────
const src = os.slice(os.indexOf("const camPastRun = (c) =>"), os.indexOf("\n", os.indexOf("const camPastRun = (c) =>")) + 1);
ok("camPastRun was extracted", /impressions/.test(src) && /spend/.test(src));
const camPastRun = new Function(`${src}\nreturn camPastRun;`)();

// The exact campaign from his screen.
ok("🔴 his paused campaign counts as having run", camPastRun({ impressions: 10421, clicks: 226, spend: 106 }),
  "10,421 views and $106 is not 'has spent nothing'");
ok("the running one does too", camPastRun({ impressions: 9433, clicks: 77, spend: 78 }));

// A campaign that genuinely never started.
ok("a built-but-never-started campaign has not run", !camPastRun({ impressions: 0, clicks: 0, spend: 0 }));
ok("a campaign with no figures at all has not run", !camPastRun({}));
ok("nor does a missing campaign throw", !camPastRun(null));

// 🔴 SPEND ALONE IS ENOUGH, and impressions alone are too. A campaign can be charged for a
// click on the boundary of the window with the impression counted outside it, and a campaign
// can be seen without being billed yet. Either one makes "has spent nothing" a lie.
ok("spend with no recorded views still counts", camPastRun({ impressions: 0, spend: 3 }));
ok("views with no recorded spend still count", camPastRun({ impressions: 500, spend: 0 }));
ok("strings from a stored snapshot are read as numbers", camPastRun({ impressions: "10421", spend: "106" }),
  "a snapshot round-tripped through the database can come back as text");
eq("and a junk value is not mistaken for history", camPastRun({ impressions: "none", spend: null }), false);

// ══════════════════════════════════════════════════════════════════════════════
// THE TWO PLACES THAT SAID IT
// ══════════════════════════════════════════════════════════════════════════════

// 1. The focused card.
{
  const i = os.indexOf('{sel&&!sel.live&&<div style={{fontSize:10.5,color:C.amber');
  const block = os.slice(i, i + 700);
  ok("the paused note was found", i >= 0);
  ok("🔴 it asks what the campaign DID, not whether the switch is on", /camPastRun\(view\)/.test(block),
    "deciding this from the switch is the whole bug");
  ok("a campaign that ran is told it is not spending TODAY", /not spending anything today/.test(block));
  ok("and that the figures are its history", /what it did over the last 30 days, while it was still running/.test(block));
  ok("a campaign that never ran still gets the plain answer", /every number above is zero because it has not run/.test(block),
    "that sentence is correct for a campaign with nothing behind it and should stay");
}

// 2. The list row, which is the half that hid the money.
{
  const i = os.indexOf("Not running, so it has not been seen by anyone and has spent nothing.");
  const before = os.slice(i - 400, i);
  ok("the list row was found", i >= 0);
  ok("🔴 the figures are only hidden when there are none", /!c\.live&&!camPastRun\(c\)/.test(before),
    "hiding them for any paused campaign is what made $106 of spend invisible");
  ok("the sentence itself is unchanged for a campaign that never ran",
    /Approve it on the Campaigns screen to set it live/.test(os.slice(i, i + 200)));
}

// Nothing anywhere may still claim a paused campaign spent nothing on the strength of the
// switch alone.
{
  // Comment lines are stripped first: BOTH sentences are also quoted in the comment above
  // the fix explaining what they used to claim, and counting those made this read 4.
  const code = os.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
  eq("the 'spent nothing' sentence survives once, now guarded",
    [...code.matchAll(/has spent nothing/g)].length, 1);
  eq("and the 'every number is zero' sentence once",
    [...code.matchAll(/every number above is zero/g)].length, 1);
  ok("neither is reachable from the switch alone",
    /!c\.live&&!camPastRun\(c\)/.test(code) && /camPastRun\(view\)/.test(code));
}

console.log(`verify-paused-history: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
