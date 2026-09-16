// What each package includes, on the Deal Prep screen, so he can answer on the call.
// Run: node tests/verify-deal-prep-includes.mjs
//
// Bryson, 2026-09-16: *"in deal prep when it gives me the recommended package ... like how we do
// in the client portal can we also have each package list what it includes that way I can tell
// the client if they ask."*
//
// 🔴 THE ONE THING THAT MATTERS MORE THAN THE UI: this is read out loud to a prospect who later
// signs a contract, and the contract's inclusions come from `PKG_FEATURES`. A list written for
// this screen would let him promise something the agreement does not say. So Deal Prep must
// render the SAME list, and the check that the OS, the portal and the contract agree with each
// other already lives in verify-packages — this suite proves Deal Prep is on that list rather
// than beside it.
//
// 🔴 AND SCOPE IS CHECKED, NOT ASSUMED. Deal Prep shipped broken once before, when handlers
// landed in the neighbouring component because the insertion anchor was not unique and every
// grep-based assertion passed anyway (KB `deal-prep-to-client`). Everything here is asserted
// against a SLICE of the component.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CONTRACT = readFileSync(new URL("../netlify/lib/contract-shared.cjs", import.meta.url), "utf8");

// The component, and only the component.
const screen = os.slice(os.indexOf("function DealPrepScreen("), os.indexOf("function LeadScoutScreen("));
ok("the Deal Prep screen was found", screen.length > 5000, `got ${screen.length} chars`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 IT IS IN DEAL PREP, NOT IN THE COMPONENT NEXT DOOR
// ══════════════════════════════════════════════════════════════════════════════
{
  ok("🔴 the open/closed state is inside Deal Prep", /const \[openPkg,setOpenPkg\]=useState\(undefined\);/.test(screen),
    "it landed somewhere else and this screen will throw on render");
  ok("🔴 so is the list that draws it", /What&rsquo;s included \(\{feats\.length\}\)/.test(screen),
    "the button is not in this component");
  ok("and the toggle is wired to the state", /setOpenPkg\(open\?null:pkg\.id\)/.test(screen));
  // Exactly once each: a second copy means the insertion also landed somewhere it should not.
  eq("the state is declared once", (os.match(/const \[openPkg,setOpenPkg\]/g) || []).length, 1);
  eq("and rendered once", (os.match(/What&rsquo;s included \(/g) || []).length, 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 THE SAME LIST THE CONTRACT PROMISES
// ══════════════════════════════════════════════════════════════════════════════
{
  ok("🔴 it reads the shared feature list", /ALL_FEATURES\.filter\(f=>pkgHasFeature\(pkg\.id,f\.id\)\)/.test(screen),
    "Deal Prep is building its own idea of what a package includes");
  // A list literal in this component would be that second idea. Feature ids are snake_case
  // strings; a run of them in quotes here is the shape to refuse.
  const ownList = /\[\s*"[a-z_]+"\s*,\s*"[a-z_]+"\s*,/.test(screen);
  ok("🔴 and does not carry a list of its own", !ownList,
    "a hand-written list here can promise what the contract does not");
}

// The real lists, run.
const block = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)) + end.length);
const OS = new Function(
  block(os, "const ALL_FEATURES = [", "\n];") + "\n" +
  block(os, "const PKG_FEATURES = {", "\n};") + "\n" +
  block(os, "const PACKAGES_DB = {", "\n};") + "\n" +
  "const pkgHasFeature = (pkgId, featureId) => (PKG_FEATURES[pkgId]||[]).includes(featureId);" +
  "\nreturn { ALL_FEATURES, PKG_FEATURES, PACKAGES_DB, pkgHasFeature };")();
const CON = new Function(
  block(CONTRACT, "const ALL_FEATURES = [", "\n];") + "\n" +
  block(CONTRACT, "const PKG_FEATURES = {", "\n};") +
  "\nreturn { ALL_FEATURES, PKG_FEATURES };")();

// What the screen would actually show, built the way the screen builds it.
const shown = (pkgId) => OS.ALL_FEATURES.filter((f) => OS.pkgHasFeature(pkgId, f.id)).map((f) => f.label);
// What the signed agreement lists.
const promised = (pkgId) => (CON.PKG_FEATURES[pkgId] || [])
  .map((id) => (CON.ALL_FEATURES.find((f) => f.id === id) || {}).label)
  .filter(Boolean);

const everyPkg = Object.values(OS.PACKAGES_DB).flat();
ok("there are packages to check", everyPkg.length >= 8, `found ${everyPkg.length}`);
for (const p of everyPkg) {
  // Sorted: the contract lists them in its own order, and the screen in the master order.
  // What must match is the SET of promises, not the sequence.
  eq(`🔴 ${p.id}: what he reads out is what the contract promises`,
    shown(p.id).slice().sort(), promised(p.id).slice().sort());
  ok(`${p.id} has something to show`, shown(p.id).length > 0,
    "the toggle would open onto nothing, which reads as a package that includes nothing");
}

// ── And the check can fail ────────────────────────────────────────────────────
{
  const fake = { ...CON.PKG_FEATURES, "g-launch": [...(CON.PKG_FEATURES["g-launch"] || []), "retargeting"] };
  const promisedFake = (fake["g-launch"] || []).map((id) => (CON.ALL_FEATURES.find((f) => f.id === id) || {}).label).filter(Boolean);
  ok("🔴 and a drift between the two really would be caught",
    JSON.stringify(shown("g-launch").slice().sort()) !== JSON.stringify(promisedFake.slice().sort()),
    "the comparison above cannot tell the two lists apart, so it proves nothing");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE REAL OPEN/CLOSED RULE, RUN
// ══════════════════════════════════════════════════════════════════════════════
{
  // 🔴 MATCHED LOOSELY ON PURPOSE. Pinning the exact expression meant that rewriting it — which
  // is what a real regression looks like — made this check fail with "the rule was found: no"
  // and then CRASH on the null, hiding every behavioural assertion below it. Whatever the rule
  // says, it gets run, and the behaviour is what is judged.
  const line = screen.match(/const open=[^;]+;/);
  ok("the open rule was found", !!line, "there is no open/closed rule in this component at all");
  const isOpen = line
    ? new Function("openPkg", "rec", "pkg", `${line[0]}\nreturn open;`)
    : () => { throw new Error("no rule to run"); };

  // 🔴 Untouched: the recommended one is already open. It is the list he is about to read.
  ok("🔴 the recommended package starts open", isOpen(undefined, true, { id: "g-growth" }));
  ok("and the others start closed", !isOpen(undefined, false, { id: "g-launch" }));

  // After a tap, only what he tapped.
  ok("tapping another opens it", isOpen("g-launch", false, { id: "g-launch" }));
  ok("🔴 and closes the recommended one", !isOpen("g-launch", true, { id: "g-growth" }),
    "two open lists at once is how he reads the wrong one out");

  // Closing means closed, including the recommended one.
  ok("nothing is open after closing", !isOpen(null, true, { id: "g-growth" }) && !isOpen(null, false, { id: "g-launch" }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE COUNT ON THE BUTTON IS THE COUNT IN THE LIST
// ══════════════════════════════════════════════════════════════════════════════
{
  // Both come from `feats`, so they cannot disagree — this pins that they still share it,
  // because a count computed separately is the classic way a label starts lying.
  const i = screen.indexOf("const feats=ALL_FEATURES.filter");
  const region = screen.slice(i, i + 3400);
  ok("🔴 the number on the button is the length of the list drawn", /\{feats\.length\}\)/.test(region) && /feats\.map\(f=>/.test(region),
    "the count and the list come from different places and will drift");
  ok("a package with nothing to list shows no toggle", /\{!!feats\.length&&\(/.test(region),
    "an empty toggle invites him to open a package that lists nothing");
}

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-deal-prep-includes: ${pass} checks passed`);
