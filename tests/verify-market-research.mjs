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
  researchAreas, sellsNationally, splitAreas, NATIONAL_MARKETS,
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
  // The guard is on the LIST now, not one area: a national account has no single service
  // area and does not need one, but nowhere to look at all is still a refusal.
  eq("and the function refuses to run with nowhere to look", /if \(!areas\.length\) \{/.test(FN_CODE), true);
  ok("it searches every market, not just the first", /areas\.map\(\(a\) =>\s*\n?\s*placesSearch/.test(FN_CODE));
  ok("in parallel, so a national search is not a minute of waiting", /await Promise\.all\(areas\.map/.test(FN_CODE));
  ok("and pools every market's results before ranking", /const pooled = searches\.flatMap/.test(FN_CODE));
  ok("recording how many markets were searched", /markets: areas\.length/.test(FN_CODE));
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

// ── 10. One city is not always the market ─────────────────────────────────────
// Bryson, 2026-08-22: "don't just search only in Gilbert search in other places as well
// because marketing agencies can be anywhere". A roofer's competitors are the roofers a
// customer could actually call, so one metro IS the whole market. A business that sells
// remotely has no local market at all, and searching one suburb returned a handful of
// small shops and called that the competition.
{
  ok("BoldLine itself always searches nationally", sellsNationally({ internal: true }));
  ok("so does anyone whose service area says nationwide",
    sellsNationally({ campaignSetup: { serviceArea: "Nationwide" } }));
  ok("or whose targets say United States",
    sellsNationally({ campaignSetup: { targetLocations: "United States" } }));
  ok("or who says they work remotely",
    sellsNationally({ campaignSetup: { serviceArea: "Remote" } }));
  // An e-commerce brand ships to whoever buys, so its competitor is a store, not a neighbour.
  ok("an e-commerce brand does too", sellsNationally({ niche: "E-Commerce" }));
  // 🔴 And a genuinely local business must NOT. A roofer in Mesa does not compete with a
  // roofer in Miami, and pooling them would make every conclusion about the market wrong.
  ok("a roofer in one metro does not", !sellsNationally({ niche: "Roofing", campaignSetup: { serviceArea: "Mesa, Arizona" } }));
  ok("nor a dentist", !sellsNationally({ niche: "Dental", campaignSetup: { serviceArea: "Gilbert, Arizona", targetLocations: "Gilbert, Arizona" } }));

  const house = researchAreas({ internal: true, campaignSetup: { serviceArea: "Gilbert, Arizona" } });
  ok("a national search covers several markets", house.length > 3, `got ${house.length}`);
  eq("and starts with his own, which is where he bumps into people most", house[0], "Gilbert, Arizona");
  ok("and reaches beyond his state", house.some((a) => !/Arizona/.test(a)));
  ok("every national market is a real place with a state", NATIONAL_MARKETS.every((m) => /, [A-Z][a-z]/.test(m)));

  const local = researchAreas({ niche: "Roofing", campaignSetup: { serviceArea: "Mesa, Arizona", targetLocations: "Mesa, Arizona, Tempe, Arizona" } });
  ok("a local business stays inside the places it serves",
    local.every((a) => /Arizona/.test(a)), local.join(" | "));
  ok("and is not padded out with national metros",
    !local.some((a) => NATIONAL_MARKETS.includes(a)));
  eq("with no duplicate of its own area", local.filter((a) => a === "Mesa, Arizona").length, 1);

  // 🔴 SPLITTING A SERVICE AREA IS A SOLVED PROBLEM HERE AND I RESOLVED IT WRONG FIRST.
  // The naive comma split turned "Mesa, Arizona, Tempe, Arizona" into four entries and
  // would have searched for competitors in a place called "Arizona". `toLocationLines`
  // in index.html hit exactly this; both of its known-bad inputs are pinned.
  eq("city and state stay together",
    splitAreas("Mesa, Arizona, Tempe, Arizona").join(" | "), "Mesa, Arizona | Tempe, Arizona");
  eq("but bare cities are not glued into a place nobody meant",
    splitAreas("Phoenix, Mesa, Tempe").join(" | "), "Phoenix | Mesa | Tempe");
  eq("newlines are trusted when they are there",
    splitAreas("Mesa, Arizona\nTempe, Arizona").join(" | "), "Mesa, Arizona | Tempe, Arizona");
  eq("nothing in means nothing out", splitAreas("").length, 0);

  // The prompt has to say which it is, or the model treats the markets as a boundary.
  const nat = mrPrompt({ competitors: [], areas: ["Gilbert, Arizona", "Dallas, Texas"], niche: "Marketing Agency", national: true });
  ok("a national brief says the areas are not a boundary", /DOES NOT HAVE A LOCAL MARKET/.test(nat));
  ok("and that a remote competitor counts wherever it is based", /operate entirely online/.test(nat));
  ok("and names every market searched", /Gilbert, Arizona, Dallas, Texas/.test(nat));
  const loc = mrPrompt({ competitors: [], areas: ["Mesa, Arizona"], area: "Mesa, Arizona", niche: "Roofing", national: false });
  ok("a local brief says to stay inside them", /Stay inside them/.test(loc));
  ok("and does not claim there is no local market", !/DOES NOT HAVE A LOCAL MARKET/.test(loc));
}

// ── 11. The card does not enforce a rule the server does not have ─────────────
// Bryson, 2026-08-22, on a card telling him to set a service area: "This doesn't make
// sense also there isn't a place to add that in edit". Both halves were true.
{
  // 🔴 The card kept its OWN copy of "can this run", and it contradicted the change made
  // minutes before: BoldLine sells nationally, so the job searches six metros with no
  // service area at all. The server is the only authority on whether there is anywhere
  // to look; it writes a plain reason when there is not, and the card renders it.
  ok("the run button is not gated on a service area",
    /<button onClick=\{run\} disabled=\{running\}/.test(UI));
  ok("the old contradictory message is gone",
    !/Set a service area in Edit first/.test(UI));
  ok("the card still shows whatever reason the server gave",
    /mr\.status==="error"&&!running&&<div[^>]*>\{mr\.error\}/.test(UI));
  // A national account is described as national, not as searching one suburb.
  ok("the house account is told the search is national",
    /across the country, not just near you/.test(UI));
  // And a client with no area gets a pointer to a field that now actually exists.
  ok("a client with no area is pointed at a real place",
    /Edit → Campaign → Campaign Details/.test(UI));
}

// ── 12. The fields the research needs are editable in the OS ──────────────────
// They lived ONLY on the client portal, which the house account does not have, so on
// his own account there was no way to set any of them.
{
  ok("the Edit sheet can write nested groups",
    /const setIn = \(group,k,v\) => setForm/.test(UI));
  const editCard = UI.match(/<Label>Campaign Details<\/Label>[\s\S]*?<\/Card>/);
  ok("a Campaign Details card exists in Edit", !!editCard);
  for (const k of ["serviceArea", "targetLocations", "mainOffer", "avgTicket",
                   "excludedKeywords", "leadDestination", "crmSystem"]) {
    ok(`${k} is editable`, !!editCard && editCard[0].includes(`k:"${k}"`));
  }
  ok("they write into campaignSetup", !!editCard && /setIn\("campaignSetup",k,e\.target\.value\)/.test(editCard[0]));

  const voice = UI.match(/<Label>Brand Voice<\/Label>[\s\S]*?<\/Card>/);
  ok("brand voice is editable too", !!voice);
  ok("including the competitor list", !!voice && voice[0].includes('k:"competitors"'));
  ok("and the differentiator the research proposes", !!voice && voice[0].includes('k:"differentiator"'));
  // 🔴 Tightened after this failed to bite: the loose form matched the TONE select's
  // own `setIn("brandVoice","tone",…)` while the two text inputs were broken. It has to
  // name the keyed write the inputs actually use.
  ok("the tone select writes into brandVoice", !!voice && /setIn\("brandVoice","tone",e\.target\.value\)/.test(voice[0]));
  ok("and so do the competitor and differentiator boxes",
    !!voice && /setIn\("brandVoice",k,e\.target\.value\)/.test(voice[0]));
  // One tone list, shared with the portal, so the two cannot drift apart.
  ok("the tone list is shared, not a second copy",
    /^const TONES = \["", "Professional"/m.test(UI)
    && (UI.match(/const TONES\s*=/g) || []).length === 1);

  // 🔴 The two boxes that were removed. Leads and cost per lead are computed now, so a
  // box that looks like it sets them and does not is worse than no box.
  ok("the dead Total Leads box is gone", !/l:"Total Leads Generated"/.test(UI));
  ok("the dead Average CPL box is gone", !/l:"Average CPL \(\$\)"/.test(UI));
  ok("and the screen says why there is nothing to type",
    /worked out from your real leads and real ad spend/.test(UI));
  ok("the ad budget is still editable", /set\("adBudget",e\.target\.value\)/.test(UI));
}

console.log(`verify-market-research: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
