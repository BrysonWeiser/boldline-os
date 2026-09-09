// Fields with a required shape are given that shape, and told what still needs a person.
//
// Bryson, 2026-09-09: *"make sure that anything that requires a specific format like the one
// area per line is automatically formatted like that"*. He had typed
//
//     Eugene and Lane County
//     Oregon
//
// into a box whose own label says one per line. Google would have been asked for a place
// called "Eugene and Lane County" and then the whole state of Oregon, on a $17 a day budget.
// The box explained the format underneath it. Explaining a format is not applying one.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const UI = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

// 🔴 EXTRACTED AND RUN. The value of a formatter is entirely in what it returns.
// 🔴 The formatters are deliberately one contiguous block of PLAIN JS, with no component
// among them, so this slice can eval them. `FieldNotes` renders their output and lives with
// the other components for exactly that reason: JSX in the middle of this range breaks both
// this test and verify-campaign-launch, which extracts the same helpers.
const helpers = S.slice(S.indexOf("const US_STATE ="), S.indexOf("\nfunction FieldNotes("));
const { tidyField, locationNotes, lineNotes } =
  new Function(helpers + "\nreturn {tidyField,locationNotes,lineNotes};")();

// ── The exact input he typed ─────────────────────────────────────────────────
{
  const out = tidyField.locations("Eugene and Lane County\nOregon");
  ok("🔴 his real input becomes one place per line",
    out === "Eugene\nLane County\nOregon", JSON.stringify(out));
  ok("and what is left needing a decision is said out loud, not guessed",
    locationNotes(out).length === 3 && /whole state/.test(locationNotes(out).join(" ")),
    "deciding the Oregon underneath was meant as the state for both is a GUESS, and a wrong guess buys ads in the wrong town silently");
  ok("the note names the line it is about",
    locationNotes(out).every((n) => /"[^"]+"/.test(n)),
    "\"one of these is wrong\" is not useful on a phone");
}

// ── Locations ────────────────────────────────────────────────────────────────
{
  const L = tidyField.locations;
  ok("a City, State pair survives its own comma", L("Eugene, Oregon") === "Eugene, Oregon");
  ok("🔴 a run of them is split correctly", L("Gilbert, Arizona, Mesa, Arizona") === "Gilbert, Arizona\nMesa, Arizona");
  ok("🔴 but two bare cities are NOT paired into one nonsense place",
    L("Phoenix, Mesa") === "Phoenix\nMesa",
    "pairing every other chunk produces \"Phoenix, Mesa\", and targeting the wrong town is the failure this whole area exists to prevent");
  ok("semicolons and stray spacing are cleaned up",
    L("Eugene , Oregon ;  Springfield, Oregon") === "Eugene, Oregon\nSpringfield, Oregon");
  ok("duplicates go", L("Eugene, Oregon\nEugene, Oregon") === "Eugene, Oregon");
  ok("a country on its own is left alone", L("Canada") === "Canada");
  ok("empty stays empty", L("") === "" && L(null) === "");
  ok("an ampersand splits too", L("Eugene & Springfield") === "Eugene\nSpringfield");
}

// ── Ad copy: tidy it, never rewrite it ───────────────────────────────────────
{
  ok("headlines are de-duplicated and trimmed",
    tidyField.adLines("  Fast service \nFast service\n\nGet a quote ") === "Fast service\nGet a quote");
  ok("🔴 an over-length headline is NOT truncated",
    tidyField.adLines("Professional Custom Apparel And Screen Printing You Can Trust")
      === "Professional Custom Apparel And Screen Printing You Can Trust",
    "auto-trimming to 30 produced the headline \"Serving Eugene and Lane\", which is not a shorter sentence, it is a broken one");
  ok("it is flagged instead, with its length and how much to cut",
    /is 61 characters.*limit is 30.*shorten it by 31/.test(
      lineNotes("Professional Custom Apparel And Screen Printing You Can Trust", 30, 3, "headlines").join(" ")),
    "cutting text to fit is a decision about wording and belongs to a person");
  ok("too few lines is flagged as well",
    /at least 3 headlines. There is 1/.test(lineNotes("One line", 30, 3, "headlines").join(" ")));
  ok("a list that is fine says nothing at all",
    lineNotes("Short one\nShort two\nShort three", 30, 3, "headlines").length === 0,
    "a field that always complains gets ignored");
}

// ── Keywords ─────────────────────────────────────────────────────────────────
{
  ok("🔴 a comma inside a keyword becomes a new keyword",
    tidyField.keywords("screen printing, Eugene") === "screen printing\nEugene",
    "Google reads a comma as the end of the keyword, so what runs is not what was typed");
  ok("and the list is de-duplicated",
    tidyField.keywords("tees\ntees\nhoodies") === "tees\nhoodies");
  ok("negative keywords go through the same one",
    /onBlur=\{e=>set\("negativeKeywordsText",tidyField\.keywords/.test(UI));
}

// ── Ids and links ────────────────────────────────────────────────────────────
{
  ok("🔴 a pasted Google Customer ID gets its dashes",
    tidyField.customerId("9248506870") === "924-850-6870",
    "Google prints it both ways in its own interface and the OS should not care which he copied");
  ok("one already formatted is left as it is", tidyField.customerId("924-850-6870") === "924-850-6870");
  ok("something that is not ten digits is left alone rather than mangled",
    tidyField.customerId("12345") === "12345",
    "half-formatting a half-typed number hides the fact that it is incomplete");
  ok("a Meta id keeps only its digits", tidyField.digits("act_1234567890") === "1234567890");
  ok("🔴 a link with no scheme gets one",
    tidyField.url("theirsite.com/privacy.html") === "https://theirsite.com/privacy.html",
    "these are the pages filed with the phone carriers, and one without a scheme is not a link");
  ok("a real link is untouched", tidyField.url("https://x.com/p") === "https://x.com/p");
  ok("blank stays blank, because blank is a real answer on every field this is used for",
    tidyField.url("  ") === "");
}

// ── Wiring ───────────────────────────────────────────────────────────────────
{
  ok("🔴 every formatter runs on BLUR, never on change",
    !/onChange=\{e=>set\([^)]*tidyField\./.test(UI),
    "reformatting under the cursor while he is still typing moves the cursor and eats characters");
  for (const [field, fn] of [["headlinesText","adLines"],["descriptionsText","adLines"],
                             ["keywordsText","keywords"],["locationsText","locations"]]) {
    ok(`${field} is formatted on blur`,
      new RegExp(`onBlur=\\{e=>set\\("${field}",tidyField\\.${fn}`).test(UI));
  }
  ok("both launch cards format their locations, not just the Google one",
    (UI.match(/onBlur=\{e=>set\("locationsText",tidyField\.locations/g) || []).length === 2,
    "the Meta card has the same box and would have kept the old behaviour");
  ok("the Customer ID and the Meta ids are formatted in Edit",
    /tidyField\.customerId\(e\.target\.value\) : tidyField\.digits/.test(UI));
  ok("and the three carrier-filed URLs are",
    /\/Url\$\/\.test\(k\) \? tidyField\.url/.test(UI));
  ok("one component renders every note, so a new field cannot invent a new way of saying it",
    /function FieldNotes\(\{notes\}\)/.test(UI)
    && (UI.match(/<FieldNotes /g) || []).length >= 5);
}

// ── The client types links too ───────────────────────────────────────────────
// 🔴 These three are the pages FILED WITH THE PHONE CARRIERS. One of them without a scheme
// is not a link, and the consequence is that a new lead silently stops getting a text.
{
  const PORTAL = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
  for (const [name, src] of [["the live portal", PORTAL], ["the owner-side copy", S]]) {
    ok(`${name} fixes a link the client types without https`,
      /function blUrl\(el\)\{[^}]*https:\/\//.test(src),
      "the portal lives in two files; changing one and not the other is the standing trap here");
    ok(`${name} applies it to all three carrier-filed pages`,
      (src.match(/onblur="blUrl\(this\)"/g) || []).length === 3,
      "privacy, terms and SMS consent are filed together and are checked together");
  }
  // Run the real thing rather than trusting the regex.
  const m = /function blUrl\(el\)\{[\s\S]*?\}(?=function saveInfo)/.exec(PORTAL);
  const blUrl = new Function(m[0] + "\nreturn blUrl;")();
  const el = (v) => { const o = { value: v }; blUrl(o); return o.value; };
  ok("🔴 it adds the scheme and keeps the path, including the .html the carriers want",
    el("theirsite.com/privacy.html") === "https://theirsite.com/privacy.html");
  ok("a real link is left exactly as it is", el("https://x.com/p") === "https://x.com/p");
  ok("blank stays blank, because not texting leads is a real answer", el("   ") === "");
}

console.log(`verify-field-formats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
