// Guards the automated Market Research step (Bryson, 2026-08-22: "Can you automate that
// so that way the bots research my own competitors (same thing for clients for the
// future) and then also ads what makes me different"). KB `market-research`.
//
// 🔴 THE INVARIANT THAT MATTERS MORE THAN THE FEATURE. A differentiator is a promise made
// in public, in a paid ad, with money behind it. `brandVoice.differentiator` is read by
// every Google ad, every Meta ad and every landing page the OS writes. A model asked
// "what makes them different" will happily answer "24 hour emergency response" for a
// business that offers no such thing, and it will sound completely reasonable.
//
// So the gate is mechanical, not just prompt text, and this suite runs THE REAL GATE:
//   1. a proposal with no evidence is DROPPED, never shown with a caveat,
//   2. only a proposal traceable to what the business itself stated may be used without
//      confirmation, and
//   3. nothing anywhere in the pipeline writes brandVoice on its own.
//
// The shared module is pure and importable, so this is the real code (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cleanResearch, needsConfirmation, rankCompetitors, isSelf, researchArea, researchNiche,
  MR_TOOL, mrSystem, mrPrompt, BASES, MAX_DIFF,
} from "../netlify/lib/market-research-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI  = readFileSync(join(ROOT, "index.html"), "utf8");
const FN  = readFileSync(join(ROOT, "netlify/functions/market-research-background.mjs"), "utf8");
const SHARED = readFileSync(join(ROOT, "netlify/lib/market-research-shared.mjs"), "utf8");
const stripComments = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const FN_CODE = stripComments(FN);
const UI_CODE = stripComments(UI);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const cl = { name: "BoldLine Media", internal: true, website: "https://boldlinemedia.com",
             niche: "Marketing Agency", campaignSetup: { serviceArea: "Gilbert, Arizona" } };

// ── 1. An unevidenced claim never reaches the screen ──────────────────────────
{
  const out = cleanResearch({
    competitorsLine: "A, B", landscape: "Busy market.", commonClaims: ["free quotes"], gaps: [],
    differentiators: [
      { text: "You keep your own ad account", basis: "record", evidence: "Stated in their own package terms", why: "Nobody else offers it" },
      { text: "24 hour emergency response", basis: "gap", evidence: "", why: "Nobody claims it" },
      { text: "Lifetime warranty on everything", basis: "gap", why: "Nobody claims it" },
      { text: "", basis: "record", evidence: "something", why: "x" },
    ],
  }, cl);
  eq("only the evidenced proposal survives", out.differentiators.length, 1);
  eq("and it is the right one", out.differentiators[0].text, "You keep your own ad account");
  // 🔴 Dropped, not shown with a warning. A warning beside a good-sounding line is not a
  // defence: the line still gets read, remembered and used.
  ok("the invented claim is gone entirely, not flagged",
    !JSON.stringify(out).includes("24 hour emergency response"));
  ok("and so is the one with no evidence field at all",
    !JSON.stringify(out).includes("Lifetime warranty"));
}

// ── 2. Only what the business itself said may be used unchallenged ────────────
{
  eq("something the business stated needs no confirming", needsConfirmation("record"), false);
  eq("something merely observed does", needsConfirmation("observed"), true);
  eq("a gap the competitors leave certainly does", needsConfirmation("gap"), true);
  eq("an unknown basis defaults to needing confirmation", needsConfirmation("anything else"), true);
  eq("a missing basis does too", needsConfirmation(undefined), true);
  // The whole point: "gap" is the valuable kind AND the dangerous kind. It is an opening
  // nobody has verified this business can fill.
  const out = cleanResearch({ differentiators: [{ text: "Same day quotes", basis: "gap", evidence: "None of the six list a response time", why: "x" }] }, cl);
  eq("a gap-based proposal is marked", out.differentiators[0].needsConfirmation, true);
  const rec = cleanResearch({ differentiators: [{ text: "You own the ad account", basis: "record", evidence: "Their own terms say so", why: "x" }] }, cl);
  eq("a record-based one is not", rec.differentiators[0].needsConfirmation, false);
  // A basis the model made up must not slip through as trustworthy.
  const bogus = cleanResearch({ differentiators: [{ text: "Best in town", basis: "verified", evidence: "e", why: "w" }] }, cl);
  eq("an invented basis is forced to gap", bogus.differentiators[0].basis, "gap");
  eq("and therefore needs confirming", bogus.differentiators[0].needsConfirmation, true);
}

// ── 3. It has to fit in an ad, and carry no dashes ────────────────────────────
{
  const long = "a".repeat(400);
  const out = cleanResearch({ differentiators: [{ text: long, basis: "record", evidence: "e", why: "w" }] }, cl);
  ok("a proposal is trimmed to ad length", out.differentiators[0].text.length <= MAX_DIFF);
  const dashed = cleanResearch({
    landscape: "Everyone offers free quotes — nobody offers a timeline.",
    differentiators: [{ text: "Done - for - you ads", basis: "record", evidence: "Their terms — page 2", why: "w" }],
  }, cl);
  const all = JSON.stringify(dashed);
  ok("no joining dash survives anywhere in the report", !/—|–/.test(all), all);
  // The standing rule bans a spaced hyphen as a joiner too, since it is the commonest tell.
  ok("nor a spaced hyphen", !/\s-\s/.test(all), all);
}

// ── 4. A business is never its own competitor ─────────────────────────────────
{
  ok("its exact name is caught", isSelf("BoldLine Media", cl));
  ok("a trading suffix does not fool it", isSelf("BoldLine Media LLC", cl));
  ok("nor different capitalisation and punctuation", isSelf("boldline  media.", cl));
  ok("its own domain under another name is caught", isSelf("boldlinemedia", cl));
  ok("a real competitor is not excluded", !isSelf("Desert Digital Marketing", cl));
  ok("an empty name is treated as unusable", isSelf("", cl));

  const ranked = rankCompetitors([
    { name: "BoldLine Media LLC", reviewCount: 900 },
    { name: "Quiet Agency", reviewCount: 3 },
    { name: "Ads R Us", reviewCount: 10, runningAds: true },
    { name: "Ads R Us", reviewCount: 10, runningAds: true },
    { name: "Big Reviews Co", reviewCount: 400 },
  ], cl, 8);
  ok("the business itself is removed from its own list", !ranked.some((c) => /BoldLine/i.test(c.name)));
  eq("duplicates are collapsed", ranked.filter((c) => c.name === "Ads R Us").length, 1);
  // Someone already buying ads is bidding against you today, which outranks review volume.
  eq("a competitor already running ads ranks first", ranked[0].name, "Ads R Us");
  ok("the internal weight is not leaked to the UI", ranked.every((c) => c._w === undefined));
  eq("the cap is honoured", rankCompetitors(Array.from({ length: 30 }, (_, i) => ({ name: "C" + i })), cl, 5).length, 5);
}

// ── 5. Where to look, and refusing to guess ───────────────────────────────────
{
  eq("the service area wins", researchArea(cl), "Gilbert, Arizona");
  eq("target locations are the fallback, first one only",
    researchArea({ campaignSetup: { targetLocations: "Mesa, Arizona, Tempe, Arizona" } }), "Mesa");
  eq("the business address is the last resort",
    researchArea({ campaignSetup: {}, businessAddress: "Phoenix, AZ" }), "Phoenix, AZ");
  // 🔴 Never invent one. Searching the wrong city returns real businesses that are the
  // wrong competitors, and every conclusion drawn from them is wrong.
  eq("no area means no guess", researchArea({ campaignSetup: {} }), "");
  eq("and the function refuses to run without one", /if \(!area\) \{/.test(FN_CODE), true);
  ok("saying so rather than failing silently", /No service area is set/.test(FN));
  eq("the niche comes off the record", researchNiche(cl), "Marketing Agency");
}

// ── 6. The contract the model must answer against ─────────────────────────────
{
  const props = MR_TOOL.input_schema.properties;
  ok("every proposal must carry its evidence and its basis",
    props.differentiators.items.required.includes("evidence")
    && props.differentiators.items.required.includes("basis"));
  ok("the basis is a closed list, not free text",
    JSON.stringify(props.differentiators.items.properties.basis.enum) === JSON.stringify(BASES));
  ok("a gap must say what was seen", props.gaps.items.required.includes("why"));
  ok("what everyone already says is asked for too", !!props.commonClaims);

  const sys = mrSystem({ isAgency: true, name: "BoldLine Media", area: "Gilbert, Arizona" });
  ok("the prompt forbids inventing a capability", /NEVER propose a capability the business has not told you it has/.test(sys));
  ok("it names the specific traps", /Same day service, 24 hour response, lifetime warranties/.test(sys));
  ok("when in doubt it is a gap", /When in doubt it is a gap/.test(sys));
  ok("it says a short true report beats a long invented one", /A short, true report is worth more/i.test(sys));
  ok("the agency branch refuses to invent results it does not have", /NO CLIENTS YET/.test(sys));
  ok("and keeps the standing national wording rule", /NEVER describe their customers as "local businesses"/.test(sys));
  ok("the no-dash rule is in the prompt", /NEVER use a dash to join or interrupt a sentence/.test(sys));
  // A client prompt must not inherit the agency's own true-facts list as if it were theirs.
  const clientSys = mrSystem({ isAgency: false, name: "Cornerstone Plumbing", niche: "Plumbing", area: "Mesa, Arizona" });
  ok("a client prompt does not carry BoldLine's own claims", !/own and is billed for their own ad account/.test(clientSys));

  const p = mrPrompt({ competitors: [{ name: "Ads R Us", rating: "4.6", reviewCount: 88, runningAds: true, adsNote: "Google + Meta" }], area: "Gilbert, Arizona", niche: "Marketing Agency" });
  ok("verified listings are handed over as facts to build on", /measured facts/.test(p));
  ok("with the ad finding included", /IS running ads/.test(p));
  const off = mrPrompt({ competitors: [], area: "x", niche: "y", placesOff: true });
  ok("with no listings it says to find them and name only real ones", /only name businesses you can actually see/i.test(off));
}

// ── 7. Nothing writes the answer for him ──────────────────────────────────────
// The whole design rests on this: the job PROPOSES, a person presses Use.
{
  ok("the background job never touches brandVoice", !/brandVoice/.test(FN_CODE));
  ok("it stores a proposal instead", /marketResearch/.test(FN_CODE));
  ok("and merges rather than overwriting the record",
    /const next = \{ \.\.\.prev, marketResearch:/.test(FN_CODE));
  ok("the card writes brandVoice only from a click",
    /const use = \(key,value,label\) => \{[\s\S]{0,200}onUpdate\(\{\.\.\.client, brandVoice:/.test(UI));
  ok("and logs what was changed, so it is not a silent edit",
    /Set the ad differentiator to/.test(UI));
  ok("a proposal needing confirmation says so on the card in plain words",
    /Only use it if it is true/.test(UI));
  ok("the card states nothing changes until he presses Use",
    /Nothing here changes your ads until you press Use/.test(UI));
  ok("evidence is shown beside every proposal", /Based on:/.test(UI));
}

// ── 8. It is wired to the pipeline and to the ads ─────────────────────────────
{
  ok("the card renders for clients too, not just the house account",
    /<MarketResearchCard client=\{client\} onUpdate=\{onUpdate\}\/>/.test(UI));
  // Market Research earned its way off the hand-tracked list by gaining a real artifact.
  const manual = UI_CODE.match(/const MANUAL_BOTS = \[[^\]]*\]/);
  ok("Market Research is no longer hand-tracked", !!manual && !/"research"/.test(manual[0]), manual && manual[0]);
  ok("the four with no artifact still are", !!manual
    && ["avatar", "funnel", "scaling", "success"].every((id) => manual[0].includes(`"${id}"`)));
  // 🔴 Done only when the research has been USED. A finished report nobody acted on has
  // changed nothing about the ads.
  ok("the step is done only once both fields are set",
    /research:\s+\(bv\.competitors && bv\.differentiator\) \? s\("done"/.test(UI));
  ok("a finished but unused report reads as still in progress",
    /mr\.status === "done" \? s\("active"/.test(UI));
  // And the payoff: the fields it fills are the ones the ad writer already reads.
  const adGen = readFileSync(join(ROOT, "netlify/lib/ad-gen-shared.mjs"), "utf8");
  ok("the ad brief still reads the differentiator", /push\("What makes them different", b\.differentiator\)/.test(adGen));
  ok("both launch cards still send it",
    (UI.match(/differentiator: \(client\.brandVoice&&client\.brandVoice\.differentiator\)\|\|""/g) || []).length >= 2);
  const landing = readFileSync(join(ROOT, "netlify/functions/generate-landing.mjs"), "utf8");
  ok("the landing page writer reads it too", /bv\.differentiator/.test(landing));
}

// ── 9. Honest when a source is unavailable ────────────────────────────────────
{
  ok("a missing Places key is reported, not hidden", /placesOff/.test(FN_CODE) && /Google Places is not connected/.test(FN));
  ok("the run records which sources answered", /sources: \{/.test(FN_CODE));
  ok("the card shows that note when there is one", /mr\.sources\.placesNote/.test(UI));
  ok("an unreadable competitor site is recorded as unknown, not as no ads",
    /runningAds: null, adsNote:/.test(FN_CODE));
  ok("only a definite yes counts as running ads",
    /String\(t\.googleAds \|\| ""\)\.toLowerCase\(\) === "yes"/.test(FN_CODE));
  ok("the card distinguishes unknown from no", /c\.runningAds===true\?pill\("Running ads"/.test(UI)
    && /c\.runningAds===false\?pill\("No ads"/.test(UI) && /:null/.test(UI));
}

console.log(`verify-market-research: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
