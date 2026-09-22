// Deleting or re-statusing a prospect from a SEARCH RESULT, not just from the saved list.
// Run: node tests/verify-scout-results-actions.mjs
//
// Bryson, 2026-09-22, the night before his first cold-calling day: *"in lead scout i search some
// businesses and before i save them to my call list i want to delete the bad ones but when i press
// delete it doesnt delete them."*
//
// 🔴 TWO THINGS WERE WRONG AND ONE OF THEM WAS HIS MENTAL MODEL, which the screen had earned.
//
//  1. THERE IS NO SAVING STEP. `lead-scout-background` writes every batch to `scout_prospects` as
//     it lands, precisely so a run that dies at the 15-minute ceiling does not lose what it found.
//     So the results he was looking at were already on his call list and already in the Outreach
//     calling queue. The screen never said so.
//
//  2. THE RESULTS CARDS HAD INVENTED IDS. They were rendered straight from the run's output with
//     `id: "new-" + i`, so Delete sent `id=new-0` at a uuid column. That is an ERROR, not a
//     harmless miss, and the message surfaced somewhere he was not looking — which from where he
//     sat is a button that does nothing. The status dropdown on those same cards was broken in
//     exactly the same way, silently.
//
// The fix is that a result carries its DEDUPE KEY, which is the row's real unique handle, and the
// endpoint accepts either that or a uuid and refuses anything else in words.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const FN = readFileSync(join(ROOT, "netlify/functions/lead-scout.mjs"), "utf8");
const BG = readFileSync(join(ROOT, "netlify/functions/lead-scout-background.mjs"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── 1. A result knows which saved row it is ──────────────────────────────────
{
  ok("🔴 the run hands back the dedupe key with every prospect",
    /prospects: prospects\.map\(\(p\) => \(\{ \.\.\.p\.data, dedupeKey: p\.key \}\)\)/.test(BG),
    "without it the screen has no way to name the row that was saved, which is how it came to invent one");
  ok("and the rows really are saved as the run goes, not at the end",
    /await supabase\.from\("scout_prospects"\)\.upsert\(rows/.test(BG),
    "this is why there is no 'before I save them' moment to delete in");
}

// ── 2. No screen may invent an id for a row it did not load ──────────────────
{
  ok('🔴 the results card no longer fabricates "new-0"',
    !/id:"new-"\+i/.test(UI),
    "an invented id is worse than no id: it looks addressable and fails at the database");
  ok("it passes the real prospect through instead",
    /<ProspectCard key=\{\(d\.dedupeKey\|\|d\.name\)\+i\} p=\{\{id:"",name:d\.name/.test(UI));
  ok("🔴 and the address helper refuses anything that looks invented",
    /!\/\^new-\/\.test\(String\(p\.id\)\)/.test(UI),
    "belt and braces, so a future screen that reintroduces the old shape still cannot send it");
  ok("falling back to the dedupe key when there is no row id",
    /: \(p&&p\.data&&p\.data\.dedupeKey\) \? "key="\+encodeURIComponent\(p\.data\.dedupeKey\)/.test(UI));
  ok("and saying so plainly when it has neither, rather than firing a request that cannot work",
    /has not finished saving yet/.test(UI));
}

// ── 3. Both actions work from either screen ─────────────────────────────────
{
  ok("delete addresses the row however it can", /api\("action=delete&"\+a,\{method:"POST"\}\)/.test(UI));
  ok("🔴 and the status dropdown was broken the same way and is fixed the same way",
    /api\("action=status&"\+a,\{method:"POST"/.test(UI),
    "it sat on the same card with the same invented id and failed silently");
  ok("the helper that takes a card out of the results exists",
    /const dropFromRun=\(p\)=>\{[\s\S]{0,260}setRunResult\(r=>r\?\{\.\.\.r,prospects:\(r\.prospects\|\|\[\]\)\.filter\(x=>x\.dedupeKey!==k\)\}:r\)/.test(UI));
  // 🔴 AND IS ACTUALLY CALLED. Defining it proves nothing: deleting the one call line left the
  // card sitting there exactly as he reported, and a test that only checked the definition
  // passed anyway.
  ok("🔴 and deleting a prospect calls it, so the card really disappears",
    /setList\(l=>l\.filter\(x=>x\.id!==p\.id\)\);\s*\n\s*dropFromRun\(p\);/.test(UI),
    "removing it from `list` while the screen renders `runResult` is why nothing appeared to happen");
  ok("and a re-statused card updates there too",
    /setRunResult\(r=>r&&p\.data&&p\.data\.dedupeKey\?\{\.\.\.r,prospects:\(r\.prospects\|\|\[\]\)\.map\(x=>x\.dedupeKey===p\.data\.dedupeKey\?\{\.\.\.x,status\}:x\)\}:r\)/.test(UI));
  ok("the card shows the status it was given rather than always 'new'",
    /status:d\.status\|\|"new"/.test(UI));
}

// ── 4. The endpoint takes a key, and refuses a fake id in words ─────────────
{
  ok("delete accepts a dedupe key", /if \(action === "delete"\)[\s\S]{0,700}\.eq\("dedupe_key", key\)/.test(FN));
  ok("status accepts one too", /Same two doors as delete[\s\S]{0,600}\.eq\("dedupe_key", key\)/.test(FN));
  ok("either one is required", (FN.match(/id or key required/g) || []).length === 2);
  ok("🔴 a non-uuid id is rejected before it reaches Postgres",
    (FN.match(/if \(id && !UUID_RE\.test\(id\)\) return json\(\{ ok: false, error: "that id is not a saved prospect" \}, 400\);/g) || []).length === 2,
    "a uuid column ERRORS on 'new-0' rather than matching nothing, and that error is what he read as 'it does nothing'");
  ok("and the pattern really is a uuid, not a loose shape",
    /const UUID_RE = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i;/.test(FN));
  // Executed, because a regex that accepts everything passes every pattern test.
  const m = /const UUID_RE = (\/.+\/i);/.exec(FN);
  ok("the uuid check was found", !!m);
  const UUID_RE = m ? new Function(`return ${m[1]};`)() : null;
  ok("it accepts a real row id", UUID_RE.test("3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"));
  ok("🔴 and rejects the invented one that started all this", !UUID_RE.test("new-0"));
  ok("and rejects an empty string, a word, and a near miss",
    !UUID_RE.test("") && !UUID_RE.test("undefined") && !UUID_RE.test("3f1b2c4d5e6f4a7b8c9d0e1f2a3b4c5d"));
}

// ── 5. The screen stops implying there is a saving step ─────────────────────
{
  ok("🔴 it says the results are already on the call list",
    /These are already on your call list and in Outreach\./.test(UI),
    "he went looking for a Delete because he believed he was reviewing before saving");
  ok("and points at the better tool for a bad fit",
    /set a bad fit to <b style=\{\{color:C\.text\}\}>Not a fit<\/b>/.test(UI));
  ok("naming both of the things that then stop happening",
    /keeps them out of your calling queue and stops a future search finding them again/.test(UI),
    "the queue part is only true because dueQueue now skips it — see verify-outreach");
  ok("the delete confirmation no longer undersells what it does",
    /They come off your call list for good/.test(UI) && !/Remove \$\{p\.name\} from your list\?/.test(UI));
}

console.log(`verify-scout-results-actions: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
