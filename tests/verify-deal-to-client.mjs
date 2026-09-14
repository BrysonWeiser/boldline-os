// Deal Prep's meeting questions, and the one button that turns them into a client.
// Run: node tests/verify-deal-to-client.mjs
//
// Bryson, 2026-09-14: *"a section in the os where I can do the deal prep and then in there
// there is the list of meeting questions to go over and then a place to put the answers and
// then from there a button ... to take all the information I gathered into a client that way
// I don't have to manually put everything in"*.
//
// 🔴 THE FAILURE THIS FILE EXISTS TO PREVENT is not a crash. It is a client created with a
// field quietly empty, discovered weeks later when a campaign build reads something nobody
// filled in. Two things cause it: a question whose answer is written to a field the client
// record does not use, and a client shape here that has drifted from the one the Add Client
// sheet produces. Both are checked against the real code below, not against a copy of it.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const S = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── Run the REAL block, not a copy of it ─────────────────────────────────────
const START = "// ── MEETING QUESTIONS ─────────────────────────────────────── DEALPREP-QUESTIONS-START";
const END = "// ───────────────────────────────────────────────────────────── DEALPREP-QUESTIONS-END";
const a = S.indexOf(START), b = S.indexOf(END);
ok("the meeting-questions block is still in the app", a > 0 && b > a,
  "its boundary comments are how this suite finds it; renaming them silently unhooks the whole file");
const src = S.slice(a, b);

const scope = {
  uid: () => "testid",
  fmt: (d) => String(d),
  today: new Date("2026-09-14T12:00:00Z"),
  addMonths: (d, n) => new Date(d),
  makeSlug: (n) => String(n).toLowerCase().replace(/\s+/g, "-"),
  crypto: { randomUUID: () => "uuid-0000" },
};
const { MEETING_QUESTIONS, setPath, clientFromMeeting } = new Function(
  ...Object.keys(scope),
  src + "\nreturn { MEETING_QUESTIONS, setPath, clientFromMeeting };"
)(...Object.values(scope));

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 EVERY QUESTION LANDS SOMEWHERE THE CLIENT RECORD ACTUALLY USES
// ══════════════════════════════════════════════════════════════════════════════
// The fields the rest of the OS reads, taken from the Add Client sheet's own literal, so
// this cannot drift from the shape a hand-added client gets.
{
  const sheet = (/onSave\(\{\.\.\.form,id:uid\(\)[\s\S]*?\}\);/.exec(S) || [""])[0];
  ok("the Add Client sheet is still findable", sheet.length > 200,
    "this suite compares the two client shapes; without it the comparison is silently skipped");

  const blank = clientFromMeeting({}, {});
  // Containers the questions write into must exist on a fresh record, or setPath invents
  // them and the field lands somewhere nothing reads.
  for (const holder of ["campaignSetup", "brandVoice", "salesNotes"]) {
    ok(`a new client has a ${holder} to write into`, blank[holder] && typeof blank[holder] === "object");
  }
  for (const q of MEETING_QUESTIONS) {
    const top = q.path.split(".")[0];
    ok(`${q.id} writes somewhere the record has (${q.path})`, Object.prototype.hasOwnProperty.call(blank, top),
      `nothing on the client record is called "${top}", so this answer would vanish`);
  }
  // 🔴 The two shapes must agree on the fields that matter, or a client made here behaves
  // differently from one made by hand.
  for (const f of ["portalToken", "leadToken", "landingSlug", "landingPage", "contractStatus",
                   "intakeComplete", "contractSigned", "leadsLog", "commLog", "mediaLibrary"]) {
    ok(`a meeting-made client has ${f}, same as a hand-added one`, Object.prototype.hasOwnProperty.call(blank, f),
      "two ways of making a client is two shapes to keep in step");
    ok(`and the Add Client sheet still sets ${f}`, sheet.includes(f),
      "if the sheet dropped it, this list is now the one that is wrong");
  }
}

// Structure of the spec itself.
{
  const ids = MEETING_QUESTIONS.map((q) => q.id);
  eq("no question is listed twice", ids.length, new Set(ids).size);
  ok("there are questions for both calls",
    MEETING_QUESTIONS.some((q) => q.ask === "first") && MEETING_QUESTIONS.some((q) => q.ask === "intake"));
  for (const q of MEETING_QUESTIONS) {
    ok(`${q.id} is asked at a real point`, ["first", "intake"].includes(q.ask), q.ask);
    ok(`${q.id} has a question`, typeof q.q === "string" && q.q.length > 8);
    ok(`${q.id} says what it feeds`, typeof q.feeds === "string" && q.feeds.length > 2,
      "the tag is why he is asking; without it this is just a form");
    ok(`${q.id} is grouped`, typeof q.sec === "string" && q.sec.length > 2);
  }
  // 🔴 A FIRST CALL IS SHORT ON PURPOSE. Every question added to it is friction that costs
  // the deal, so the list growing is a decision, not an accident.
  const first = MEETING_QUESTIONS.filter((q) => q.ask === "first").length;
  ok("the sales-call list stays short", first <= 14, `${first} questions on a first call is a survey, not a sale`);
}

// The questions that carry real money.
{
  const byId = Object.fromEntries(MEETING_QUESTIONS.map((q) => [q.id, q]));
  ok("🔴 the qualified-lead question is asked on the FIRST call", byId.qualifiedLead && byId.qualifiedLead.ask === "first",
    "asked after money is involved it is a negotiation; asked before, it is just their opinion");
  eq("and it lands on the client where billing can see it", byId.qualifiedLead.path, "qualifiedLeadDef");
  ok("the average job value is captured", byId.avgTicket && byId.avgTicket.path === "campaignSetup.avgTicket");
  ok("so is their capacity", !!byId.capacity,
    "selling more leads than they can service is how a happy client becomes a churned one");
  ok("and how fast they answer the phone", !!byId.speedToLead,
    "speed to lead is the product; nobody picking up is a deal breaker, not a detail");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 THE ANSWERS ACTUALLY ARRIVE
// ══════════════════════════════════════════════════════════════════════════════
{
  const answers = {
    avgTicket: "1000", closeRate: "7 in 10", capacity: "about 6 more a week",
    qualifiedLead: "someone who books and never shows",
    contactName: "Brendon", email: "brendon@example.test", businessPhone: "555 0100",
    mainOffer: "new patient exam", competitors: "the place on 5th", tone: "warm",
    excludedKeywords: "free, student discount",
  };
  const cl = clientFromMeeting(answers, { companyName: "Springbok Wellness", niche: "chiropractor", notes: "met Thursday" });

  eq("the business name comes across", cl.name, "Springbok Wellness");
  eq("the niche comes across", cl.niche, "chiropractor");
  eq("a plain field lands", cl.contactName, "Brendon");
  eq("a nested field lands", cl.campaignSetup.avgTicket, "1000");
  eq("a second nested field lands beside it", cl.campaignSetup.mainOffer, "new patient exam");
  eq("and does not clobber its siblings", cl.campaignSetup.excludedKeywords, "free, student discount");
  eq("a different holder lands too", cl.brandVoice.tone, "warm");
  eq("🔴 the qualified-lead definition is on the record", cl.qualifiedLeadDef, "someone who books and never shows");
  eq("an answer with no field of its own is still kept", cl.salesNotes.closeRate, "7 in 10",
    "what he told you about his close rate is the question you ask in month two");
  ok("and the record knows when it was captured", !!cl.salesNotes.capturedAt);
  eq("untouched fields stay empty rather than undefined", cl.campaignSetup.serviceArea, "");
  eq("the brief's notes come across", cl.notes, "met Thursday");
}

// 🔴 A GOOD MEETING IS NOT A SIGNATURE. Standing rule in CLAUDE.md as of 2026-09-14: nothing
// may count a client who has not signed. A record created here must not look signed.
{
  const cl = clientFromMeeting({ contactName: "X" }, { companyName: "Someone" });
  eq("🔴 it is not marked signed", cl.contractSigned, false);
  eq("🔴 nor active", cl.contractStatus, "pending");
  eq("it starts at onboarding", cl.stage, "onboarding");
  eq("with no package chosen", cl.packageId, "");
  eq("and no intake ticked off", cl.intakeComplete, false);
  ok("so the founding count still ignores it", !cl.contractSigned && cl.contractStatus !== "active",
    "isFoundingClient counts on contractSigned or an active contract; this must satisfy neither");
}

// Empty and junk input must not produce a broken record.
{
  const blank = clientFromMeeting({}, {});
  ok("a client made from nothing still has a name", typeof blank.name === "string" && blank.name.length > 0);
  ok("and a slug", typeof blank.landingSlug === "string" && blank.landingSlug.length > 0);
  eq("blank answers do not write empty strings over the defaults", blank.contactName, "");
  const spaces = clientFromMeeting({ contactName: "   " }, { companyName: "Co" });
  eq("whitespace-only answers are ignored", spaces.contactName, "",
    "a field of spaces reads as filled in everywhere downstream");
  ok("junk in does not throw", !!clientFromMeeting(null, null));
  const trimmed = clientFromMeeting({ contactName: "  Brendon  " }, { companyName: "Co" });
  eq("answers are trimmed", trimmed.contactName, "Brendon");
}

// setPath on its own.
{
  const o = { a: { keep: 1 } };
  setPath(o, "a.b", "x");
  eq("it writes deep", o.a.b, "x");
  eq("and leaves siblings alone", o.a.keep, 1);
  setPath(o, "top", "y");
  eq("it writes shallow", o.top, "y");
  setPath(o, "new.deep.leaf", "z");
  eq("it builds missing levels", o.new.deep.leaf, "z");
  const guard = { a: "not an object" };
  setPath(guard, "a.b", "x");
  eq("it replaces a non-object in the way rather than throwing", guard.a.b, "x");
  ok("an empty path is a no-op", setPath({ k: 1 }, "", "x").k === 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 IN THE RIGHT COMPONENT, NOT JUST SOMEWHERE IN THE FILE
// ══════════════════════════════════════════════════════════════════════════════
// 2026-09-14: the handlers for this feature were inserted into `LeadFeeFinder`, the component
// that happens to sit directly above DealPrepScreen and also has a `const run=async()=>{`.
// DealPrepScreen then referenced `answered`, which was declared two components away, and the
// screen crashed with "answered is not defined" the moment Bryson opened it.
//
// EVERY ASSERTION IN THE SECTION BELOW PASSED WHILE THAT WAS TRUE, because they were regex
// greps over a 1.1MB file and the code they were looking for genuinely existed. It was just in
// the wrong place. That is the identical mistake this suite's own commit had just fixed in
// verify-app-boots, made again, in the same afternoon, by the person who wrote the fix.
//
// So: slice the component and check scope, rather than asking whether a string appears.
const bodyOf = (fnName) => {
  const at = S.indexOf(`function ${fnName}(`);
  if (at < 0) return "";
  const end = S.indexOf("\nfunction ", at + fnName.length + 10);
  return S.slice(at, end < 0 ? S.length : end);
};
{
  const dp = bodyOf("DealPrepScreen");
  ok("DealPrepScreen is findable", dp.length > 2000, `${dp.length} chars`);

  // Everything this feature introduces has to be DECLARED inside DealPrepScreen.
  const declared = [
    "const [briefId,setBriefId]", "const [answers,setAnswers]", "const [askList,setAskList]",
    "const [notesState,setNotesState]", "const [made,setMade]", "const saveTimer=",
    "const answer=(id)=>", "const makeClient=", "const answered=",
  ];
  for (const d of declared) {
    ok(`🔴 ${d.replace(/const |=.*/g, "").trim()} is declared inside DealPrepScreen`, dp.includes(d),
      "declared in another component is exactly how this crashed: the name exists in the file and is out of scope on screen");
  }

  // And USED there, so a declaration that drifts away from its use is caught from both ends.
  for (const u of ["answered>0", "onChange={answer(q.id)}", "onClick={makeClient}", "value={answers[q.id]"]) {
    ok(`${u} is used inside DealPrepScreen`, dp.includes(u));
  }

  // 🔴 And NOT sitting in the neighbour it landed in. Named explicitly because that is the
  // component the insertion anchor actually matched.
  const lf = bodyOf("LeadFeeFinder");
  ok("LeadFeeFinder is findable", lf.length > 500);
  for (const d of ["const answered=", "const makeClient=", "const answer=(id)=>", "const [answers,setAnswers]"]) {
    ok(`LeadFeeFinder does not carry ${d.replace(/const |=.*/g, "").trim()}`, !lf.includes(d),
      "the meeting-notes code belongs to Deal Prep; in here it is both dead and a crash");
  }

  // The generic version of the same rule: nothing the panel reads may be declared elsewhere.
  const usedNames = ["answers", "answered", "askList", "notesState", "made", "briefId", "saveTimer", "makeClient", "answer"];
  const missing = usedNames.filter((n) => !new RegExp(`(const|let|var)\\s*\\[?\\s*${n}\\b`).test(dp));
  eq("🔴 every name the panel uses is declared in the same component", missing, [],
    "a name declared in a different component reads fine in a grep and throws on screen");
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. IT IS ACTUALLY WIRED UP
// ══════════════════════════════════════════════════════════════════════════════
{
  ok("Deal Prep takes a way to create a client", /function DealPrepScreen\(\{[^}]*onCreateClient/.test(S));
  // The tag itself contains `=>`, so a [^>] scan stops inside it. Match the attribute directly.
  ok("and the app hands it the real one", /DealPrepScreen[\s\S]{0,400}?onCreateClient=\{addClient\}/.test(S),
    "a second creation path would save a client the main list never sees");
  ok("the button calls it", /const makeClient=\(\)=>\{[\s\S]{0,400}onCreateClient\(cl\)/.test(S));
  ok("the button is on screen", S.includes("Create the client from these answers"));
  ok("and it refuses to run on an empty form", /disabled=\{!answered\}/.test(S),
    "a client made from no answers is a blank record he then has to fill in by hand anyway");
  ok("answers are typed into a real field per question", /value=\{answers\[q\.id\]\|\|""\}/.test(S));
  ok("each question shows what it feeds", /\{q\.feeds\}/.test(S));

  // 🔴 Losing a call's notes to a page reload is the whole reason this saves server-side.
  ok("answers save without being asked to", /action=notes/.test(S));
  {
    // A debounce that fires immediately is not a debounce. Assert the actual delay, not the
    // presence of a timer.
    const wait = Number((/\},(\d+)\);\s*\n\s*\}\s*\n\s*return next;/.exec(S) || [])[1]);
    ok("and not on every keystroke", wait >= 300 && wait <= 3000,
      `the save waits ${Number.isFinite(wait) ? wait + "ms" : "an unreadable delay"}; one write per character during a call is a lot of writes`);
  }
  ok("he can see whether they saved", S.includes('notesState==="saved"') && S.includes('notesState==="error"'),
    "a silent save that failed is a call he thinks is recorded and is not");
}

// The endpoint half.
{
  const fn = readFileSync(new URL("../netlify/functions/deal-research.mjs", import.meta.url), "utf8");
  ok("the endpoint takes notes", fn.includes('action === "notes"'));
  ok("it refuses a GET", /action === "notes"[\s\S]{0,300}POST required/.test(fn));
  ok("🔴 it merges rather than overwrites", /\.\.\.\(row\.input \|\| \{\}\)/.test(fn),
    "a blind write drops whatever else the brief was created with");
  ok("and reading a brief hands the answers back", /answers: \(\(data\.input \|\| \{\}\)\.meetingAnswers\)/.test(fn),
    "without this, reopening a brief shows an empty form and he retypes a call he already had");
  ok("no new database table was needed", !/create table|alter table/i.test(fn),
    "a migration he has to remember to run is how Lead Scout hung silently");
}

console.log(`verify-deal-to-client: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
