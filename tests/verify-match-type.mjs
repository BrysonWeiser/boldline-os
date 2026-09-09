// Changing the keyword match type actually changes the keywords.
// Run: node tests/verify-match-type.mjs
//
// Bryson, 2026-09-09: *"can you make sure that when a setting like that is changed to
// exact or phrase or broad the keywords are automatically updated and formated to meet the
// keyword match type. An example would be when it is set to phrase everything is
// automatically put into quotes."*
//
// It was a dropdown that set a variable. On a generated campaign it did **nothing at all**:
// every generated keyword carries its own match type, and the dropdown was only ever the
// fallback for a keyword that had none — which never happens, because the generator is
// required to supply one. So the control read "Phrase" while the account being built was
// half exact and half broad. A setting that renames itself without changing the thing it
// names is worse than no setting: it is a lie you can point at.
//
// The second half of the same message: *"if the manual section doesnt effect the generate
// full campaign section i need a way to edit whether I want to change the keyword match
// type, the target location, daily budget, etc."* He had all of those. They were sitting
// underneath a heading that said MANUAL AD COPY, because the shared settings were split in
// half by the copy boxes. Ordering is not decoration.
//
// The formatter and the reader are extracted from index.html and RUN.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE FORMATTER, RUN
// ══════════════════════════════════════════════════════════════════════════════

const tidySrc = os.slice(os.indexOf("const tidyField = {"), os.indexOf("\n};", os.indexOf("const tidyField = {")) + 3);
ok("tidyField was extracted", /kwMatch\(text, mt\)/.test(tidySrc));
const tidyField = new Function("US_STATE", tidySrc + "\nreturn tidyField;")(/^(Oregon|Arizona)$/i);

const kw = (t, m) => tidyField.kwMatch(t, m);

eq("phrase puts everything in quotes", kw("custom t shirts\nembroidery", "PHRASE"), '"custom t shirts"\n"embroidery"');
eq("exact puts everything in brackets", kw("custom t shirts\nembroidery", "EXACT"), "[custom t shirts]\n[embroidery]");
eq("broad strips the punctuation off", kw('"custom t shirts"\n[embroidery]', "BROAD"), "custom t shirts\nembroidery");

// 🔴 SWITCHING BACK AND FORTH MUST NOT NEST. ["x"] is a different keyword to Google, and
// this is the failure a dropdown gets used enough times to find.
eq("phrase then exact does not nest", kw(kw("shirts", "PHRASE"), "EXACT"), "[shirts]");
eq("exact then phrase does not nest", kw(kw("shirts", "EXACT"), "PHRASE"), '"shirts"');
eq("three switches still land clean", kw(kw(kw("shirts", "PHRASE"), "EXACT"), "BROAD"), "shirts");
eq("already-nested input is cleaned up", kw('["shirts"]', "PHRASE"), '"shirts"');

// The generated boxes print keywords in this same notation, so what he pastes back in is
// already wrapped. It must not double.
eq("re-applying the same type is a no-op", kw('"shirts"', "PHRASE"), '"shirts"');

eq("blank lines are dropped", kw("shirts\n\n  \nhats", "PHRASE"), '"shirts"\n"hats"');
eq("surrounding space goes", kw("   shirts   ", "EXACT"), "[shirts]");
eq("empty in, empty out", kw("", "PHRASE"), "");

// "MIXED" is not a match type. It is the word for "these disagree", and applying it must
// change nothing rather than wrapping every keyword in the word mixed.
eq("MIXED leaves the text alone", kw('[a]\n"b"\nc', "MIXED"), '[a]\n"b"\nc');
eq("so does a nonsense value", kw("a\nb", "SIDEWAYS"), "a\nb");
eq("and so does none at all", kw("a\nb"), "a\nb");

// ══════════════════════════════════════════════════════════════════════════════
// 2. READING THE MATCH TYPE OFF THE GENERATED GROUPS, RUN
// ══════════════════════════════════════════════════════════════════════════════

const genSrc = os.slice(os.indexOf("const generatedMatchType = (gen)"), os.indexOf("\n};", os.indexOf("const generatedMatchType = (gen)")) + 3);
const generatedMatchType = new Function(genSrc + "\nreturn generatedMatchType;")();

const G = (...types) => ({ adGroups: [{ keywords: types.map((t) => ({ text: "k", matchType: t })) }] });

eq("all phrase reads as phrase", generatedMatchType(G("PHRASE", "PHRASE")), "PHRASE");
eq("all exact reads as exact", generatedMatchType(G("EXACT", "EXACT")), "EXACT");
eq("all broad reads as broad", generatedMatchType(G("BROAD")), "BROAD");
eq("🔴 a mix reads as MIXED, not as the first one", generatedMatchType(G("EXACT", "PHRASE", "PHRASE")), "MIXED",
  "claiming Phrase while four keywords are exact is the bug this whole control had");
eq("it reads ACROSS groups, not just the first", generatedMatchType({ adGroups: [
  { keywords: [{ text: "a", matchType: "PHRASE" }] },
  { keywords: [{ text: "b", matchType: "EXACT" }] },
]}), "MIXED");
eq("a keyword with no type counts as phrase", generatedMatchType(G(undefined, "PHRASE")), "PHRASE");
eq("lowercase from an older payload still matches", generatedMatchType(G("phrase", "PHRASE")), "PHRASE");
eq("nothing generated reads as nothing", generatedMatchType(null), null);
eq("a generation with no keywords reads as nothing", generatedMatchType({ adGroups: [{ keywords: [] }] }), null);
eq("a malformed generation does not throw", generatedMatchType({ adGroups: [null, { keywords: null }] }), null);

// ══════════════════════════════════════════════════════════════════════════════
// 3. APPLYING IT, RUN — BOTH PLACES, WHICH IS THE WHOLE REQUEST
// ══════════════════════════════════════════════════════════════════════════════

const card = os.slice(os.indexOf("function GoogleLaunchCard("), os.indexOf("function MetaLaunchCard("));
const applySrc = card.slice(card.indexOf("const applyMatchType = (v) => {"), card.indexOf("\n  };", card.indexOf("const applyMatchType = (v) => {")) + 5);
ok("applyMatchType was extracted", /setGen\(prev=>/.test(applySrc) && /setF\(prev=>/.test(applySrc));

function apply(v, { f, gen }) {
  let outF = f, outGen = gen;
  const scope = {
    tidyField,
    setF: (fn) => { outF = fn(outF); },
    setGen: (fn) => { outGen = fn(outGen); },
  };
  new Function(...Object.keys(scope), `${applySrc}\nreturn applyMatchType;`)(...Object.values(scope))(v);
  return { f: outF, gen: outGen };
}

const startGen = () => ({ notes: "keep me", adGroups: [
  { name: "Custom Tees", keywords: [{ text: "custom t shirts", matchType: "EXACT" }, { text: "tee printing", matchType: "PHRASE" }] },
  { name: "Embroidery", keywords: [{ text: "embroidery", matchType: "BROAD" }] },
]});
const startF = () => ({ matchType: "MIXED", keywordsText: "custom shirts\n[screen printing]", landingUrl: "https://x.test" });

// The example he gave, checked as he gave it.
{
  const { f, gen } = apply("PHRASE", { f: startF(), gen: startGen() });
  eq("🔴 setting phrase puts the manual keywords in quotes", f.keywordsText, '"custom shirts"\n"screen printing"');
  eq("and every generated keyword becomes phrase",
    gen.adGroups.flatMap(g => g.keywords.map(k => k.matchType)), ["PHRASE", "PHRASE", "PHRASE"]);
  eq("the stored value follows", f.matchType, "PHRASE");
  eq("the keyword TEXT is untouched", gen.adGroups[0].keywords.map(k => k.text), ["custom t shirts", "tee printing"]);
  eq("and nothing else on the form is disturbed", f.landingUrl, "https://x.test");
  eq("nor on the generation", gen.notes, "keep me");
  eq("the ad groups keep their names", gen.adGroups.map(g => g.name), ["Custom Tees", "Embroidery"]);
}

{
  const { f, gen } = apply("EXACT", { f: startF(), gen: startGen() });
  eq("exact brackets the manual keywords", f.keywordsText, "[custom shirts]\n[screen printing]");
  eq("and every generated keyword becomes exact",
    gen.adGroups.flatMap(g => g.keywords.map(k => k.matchType)), ["EXACT", "EXACT", "EXACT"]);
}

{
  const { f, gen } = apply("BROAD", { f: startF(), gen: startGen() });
  eq("broad strips the manual keywords bare", f.keywordsText, "custom shirts\nscreen printing");
  eq("and every generated keyword becomes broad",
    gen.adGroups.flatMap(g => g.keywords.map(k => k.matchType)), ["BROAD", "BROAD", "BROAD"]);
}

// It must work with nothing generated, and must not invent a generation.
{
  const { f, gen } = apply("PHRASE", { f: startF(), gen: null });
  eq("the manual box still formats with nothing generated", f.keywordsText, '"custom shirts"\n"screen printing"');
  eq("and no generation is invented", gen, null);
}

// A value that is not a match type must change nothing at all, in either place.
for (const bad of ["MIXED", "", "phrase", undefined]) {
  const { f, gen } = apply(bad, { f: startF(), gen: startGen() });
  eq(`"${bad}" leaves the manual box alone`, f.keywordsText, "custom shirts\n[screen printing]");
  eq(`"${bad}" leaves the generated types alone`,
    gen.adGroups.flatMap(g => g.keywords.map(k => k.matchType)), ["EXACT", "PHRASE", "BROAD"]);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE CONTROL SHOWS WHAT IS TRUE, AND IS WIRED TO THE APPLY
// ══════════════════════════════════════════════════════════════════════════════

ok("the dropdown shows what the keywords actually are, not a stored value",
  /const liveMatch = generatedMatchType\(gen\) \|\| f\.matchType;/.test(card),
  "observed, never stored — the same rule as every other status in the OS");
ok("the dropdown reads liveMatch", /<select value=\{liveMatch\}/.test(card));
ok("and changing it applies", /onChange=\{e=>applyMatchType\(e\.target\.value\)\}/.test(card));
ok("🔴 it no longer just sets a variable", !/onChange=\{e=>set\("matchType",e\.target\.value\)\}/.test(card),
  "that is what made the control a decoration on a generated campaign");
ok("Mixed is offered only when the keywords really are mixed",
  /\{liveMatch==="MIXED"&&<option value="MIXED"/.test(card),
  "a permanent Mixed option would be a way to pick a state that means nothing");
ok("and the note explains that picking one rewrites every keyword",
  /rewrites <b style=\{\{color:C\.textDim\}\}>every<\/b> keyword/.test(card));
ok("the manual box formats itself on blur too",
  /tidyField\.kwMatch\(tidyField\.keywords\(e\.target\.value\),liveMatch\)/.test(card));
ok("generating adopts what the generator chose",
  /const mt=generatedMatchType\(d\); if\(mt&&mt!=="MIXED"\) set\("matchType",mt\);/.test(card),
  "otherwise the control keeps claiming the type from before the generation");

// MIXED must never reach Google — it is not a value the API accepts.
ok("🔴 the build never sends MIXED",
  /matchType:\(\["EXACT","PHRASE","BROAD"\]\.includes\(f\.matchType\)\?f\.matchType:"PHRASE"\)/.test(card),
  "Google rejects an unknown match type, and the error does not say which field");

console.log(`verify-match-type: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
