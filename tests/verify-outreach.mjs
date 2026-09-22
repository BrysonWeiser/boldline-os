// Working a cold list: the rules, the queue, the counters, and the two things not built.
// Run: node tests/verify-outreach.mjs
//
// Bryson, 2026-09-21: *"what if we build a cold outreach section in the os"*, then *"build
// everything but what you flagged we shouldnt do"*.
//
// 🔴 THE TWO THINGS NOT BUILT ARE TESTED AS HARD AS THE THINGS THAT WERE, because their absence is
// a decision and absences rot. Nothing may send a cold email, and nothing may send a DM:
//   • Cold email at volume earns spam complaints, and complaints poison the sending domain. That
//     is the same domain client reports and INVOICES go out on, so a stranger hitting "spam" could
//     land a client's invoice in their junk folder.
//   • Instagram and LinkedIn ban accounts for automated messaging, and that account carries his
//     name and his audience.
// The OS writes both and logs that they were sent. A future "just add a send button" is a change
// to that decision, and this suite is what makes somebody notice they are making it.
//
// The rules are imported and executed, never re-implemented (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  OUTCOMES, CHANNELS, CADENCE_DAYS, MAX_STEPS,
  outcomeById, outcomesFor, nextDueAt, applyTouch, isBlocked, dueQueue, rollup, rollupByChannel,
  buildManualProspect, manualAddVerdict, isManual, cleanPhone, prettyPhone, cleanEmail, MANUAL_SOURCE,
  isQueueable, QUEUE_SKIP_STATUS,
} from "../netlify/lib/outreach.mjs";
import { dedupeKeyFor } from "../netlify/lib/scout-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const FN = readFileSync(join(ROOT, "netlify/functions/outreach.mjs"), "utf8");
const DRAFT = readFileSync(join(ROOT, "netlify/functions/outreach-draft.mjs"), "utf8");
const SQL = readFileSync(join(ROOT, "docs/sql/outreach-schema.sql"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const T0 = new Date("2026-09-21T17:00:00Z").getTime();
const DAY = 864e5;

// ── 1. 🔴 "TAKE ME OFF YOUR LIST" IS ENFORCED, NOT REMEMBERED ────────────────
//
// This is the one rule with legal weight, and the one Bryson will hand to a setter. "Please
// remember not to call that one" is not a control.
{
  const o = outcomeById("do_not_contact");
  ok("the outcome exists", !!o);
  ok("and it ends the sequence", o.ends === true);
  ok("🔴 and it BLOCKS, which is a separate and stronger thing", o.blocks === true,
    "ends means stop working them; blocks means they may never be surfaced again");

  const applied = applyTouch({ status: "new", step: 0 }, { outcome: "do_not_contact" }, T0);
  ok("🔴 a block writes its own field", !!applied.patch.blocked_at,
    "status is a sales stage a dropdown can move back; this must not be undoable by accident");
  eq("and never schedules another attempt", applied.patch.next_due_at, null);

  const blocked = { id: "b", blocked_at: new Date(T0).toISOString(), score: 100, next_due_at: null, step: 0 };
  ok("isBlocked says so", isBlocked(blocked));
  eq("🔴 and the queue cannot surface them, even at the top score",
    dueQueue([blocked, { id: "ok", score: 1, step: 0 }], T0).map((p) => p.id).join(","), "ok");
  eq("not even when they are overdue",
    dueQueue([{ ...blocked, next_due_at: new Date(T0 - DAY).toISOString(), step: 2 }], T0).length, 0);

  // 🔴 AND THE SERVER REFUSES ONE DIRECTLY. The screen hiding them is not enough: a stale tab or a
  // replayed request must not be able to contact someone who asked not to be.
  ok("🔴 the endpoint refuses to log a touch on a blocked prospect",
    /if \(isBlocked\(prospect\)\) return json\(\{ ok: false/.test(FN),
    "hiding them in the UI is a display rule, not a control");
  ok("and the queue query filters them in SQL too",
    /\.is\("blocked_at", null\)/.test(FN),
    "two independent guards, because this one failing is a legal problem rather than a bug");
  ok("the column exists and is separate from status",
    /add column if not exists blocked_at/.test(SQL) && /add column if not exists next_due_at/.test(SQL));
}

// ── 2. The cadence ───────────────────────────────────────────────────────────
{
  ok("the gaps widen", CADENCE_DAYS.every((d, k) => k === 0 || d >= CADENCE_DAYS[k - 1]),
    "chasing daily reads as pestering; " + CADENCE_DAYS.join(","));
  ok("and it ends rather than looping for ever", MAX_STEPS === CADENCE_DAYS.length + 1);

  const due = nextDueAt({ outcome: "no_answer", step: 1, at: T0 });
  eq("a first no-answer comes back on the first gap", due, new Date(T0 + CADENCE_DAYS[0] * DAY).toISOString());
  eq("🔴 the last step is the last", nextDueAt({ outcome: "no_answer", step: MAX_STEPS, at: T0 }), null);
  eq("an ending outcome never schedules another", nextDueAt({ outcome: "not_interested", step: 1, at: T0 }), null);

  // 🔴 A time they gave you is a fact; a cadence gap is a guess.
  const when = new Date(T0 + 3 * DAY).toISOString();
  eq("a callback uses the time THEY named", nextDueAt({ outcome: "callback", step: 1, at: T0, when }), when);
  ok("and a callback with no time still gets tried rather than dropped",
    !!nextDueAt({ outcome: "callback", step: 1, at: T0 }));
  eq("a booking leaves the working queue", nextDueAt({ outcome: "booked", step: 1, at: T0, when }), null);
}

// ── 3. What one attempt does ─────────────────────────────────────────────────
{
  const p = { status: "new", step: 0 };
  const a = applyTouch(p, { outcome: "no_answer" }, T0);
  eq("the step advances", a.patch.step, 1);
  eq("a new prospect becomes contacted", a.patch.status, "contacted");
  eq("a booking marks a meeting", applyTouch(p, { outcome: "booked", when: new Date(T0 + DAY).toISOString() }, T0).patch.status, "meeting");
  eq("and records when", applyTouch(p, { outcome: "booked", when: new Date(T0 + DAY).toISOString() }, T0).patch.meeting_at, new Date(T0 + DAY).toISOString());
  eq("a no becomes dead", applyTouch(p, { outcome: "not_interested" }, T0).patch.status, "dead");
  ok("an unknown outcome is refused rather than guessed", !!applyTouch(p, { outcome: "nonsense" }, T0).error);

  // 🔴 A status never goes BACKWARDS. A later no-answer on a booked prospect must not demote them.
  const booked = { status: "meeting", step: 3 };
  ok("a later attempt does not un-book them", applyTouch(booked, { outcome: "no_answer" }, T0).patch.status === undefined,
    "only a more advanced stage is written, so 'meeting' survives");
}

// ── 4. Who is next ───────────────────────────────────────────────────────────
{
  const never = { id: "never", step: 0, score: 40 };
  const overdue = { id: "overdue", step: 2, score: 10, next_due_at: new Date(T0 - DAY).toISOString() };
  const future = { id: "future", step: 1, score: 99, next_due_at: new Date(T0 + DAY).toISOString() };
  const q = dueQueue([never, future, overdue], T0);
  eq("an untouched prospect is due now", q.some((p) => p.id === "never"), true);
  eq("🔴 a prospect not due yet is NOT offered, however good", q.some((p) => p.id === "future"), false,
    "calling early is the cadence being ignored, which is what makes a list get burned through");
  eq("someone already in the sequence comes before a fresh name",
    q[0].id, "overdue");

  // Among equals, the better prospect first.
  const [a, b] = dueQueue([{ id: "lo", step: 0, score: 5 }, { id: "hi", step: 0, score: 90 }], T0);
  eq("and the best untouched one is first", a.id, "hi");
  ok("both still offered", !!b);
}

// ── 5. 🔴 A BOOKING IS A PROMISE; A SHOW IS THE RESULT ───────────────────────
//
// This is the number a setter gets paid on, so it is the one number that must not be inferred.
{
  const meetingAt = new Date(T0 - DAY).toISOString();
  const touches = [
    { channel: "call", outcome: "no_answer" },
    { channel: "call", outcome: "gatekeeper" },
    { channel: "call", outcome: "booked", meeting_at: meetingAt, showed: true },
    { channel: "call", outcome: "booked", meeting_at: meetingAt, showed: false },
    { channel: "call", outcome: "booked", meeting_at: meetingAt },
  ];
  const r = rollup(touches, { now: T0 });
  eq("attempts counts everything", r.attempts, 5);
  eq("🔴 a gatekeeper IS a conversation", r.conversations, 4,
    "dials to conversations is how you tell a bad LIST from a bad SCRIPT, and a gatekeeper is a human");
  ok("🔴 a voicemail is NOT", outcomeById("voicemail").reached === false);
  eq("bookings count", r.booked, 3);
  eq("🔴 but only the one that showed counts as showed", r.showed, 1);
  eq("a no-show is counted, not ignored", r.noShowed, 1);
  eq("🔴 and the unanswered one is named rather than guessed either way", r.pendingShow, 1);
  eq("the show rate ignores the unanswered one", r.showRate, 0.5);

  // 🔴 null, never 0: "we have not called anybody" must not read as "nobody ever answers".
  const empty = rollup([], { now: T0 });
  eq("no attempts means unknown, not zero percent", empty.convRate, null);
  eq("and no conversations too", empty.bookRate, null);
  eq("and nothing judged", empty.showRate, null);

  const byCh = rollupByChannel(touches, { now: T0 });
  eq("counted per channel too", byCh.call.attempts, 5);
  eq("and a channel with nothing is zero, not missing", byCh.dm.attempts, 0);
}

// ── 6. An outcome only where it can happen ───────────────────────────────────
{
  ok("no answer is a call thing", !outcomesFor("email").some((o) => o.id === "no_answer"));
  ok("no reply is not", !outcomesFor("call").some((o) => o.id === "no_reply"));
  ok("booking works on every channel", CHANNELS.every((c) => outcomesFor(c.id).some((o) => o.id === "booked")));
  ok("🔴 so does do-not-contact", CHANNELS.every((c) => outcomesFor(c.id).some((o) => o.id === "do_not_contact")),
    "somebody can ask to be left alone by email just as easily as on the phone");
  ok("the endpoint checks the pairing rather than trusting the screen",
    /if \(!o\.channels\.includes\(channel\)\)/.test(FN));
}

// ── 7. 🔴 BOTH COPIES OF THE RULES AGREE ─────────────────────────────────────
// The OS cannot import the library, so it mirrors it. Two copies of "what counts as a
// conversation" is two different numbers on two screens.
{
  const i = UI.indexOf("const OUT_OUTCOMES = [");
  const j = UI.indexOf("\nfunction OutreachScreen", i);
  ok("the OS copy was found", i > 0 && j > i);
  const os = new Function(UI.slice(i, j) + "\nreturn { OUT_OUTCOMES, OUT_CHANNELS, outOutcome, outFor, outRollup };")();

  eq("the same number of outcomes", os.OUT_OUTCOMES.length, OUTCOMES.length);
  for (const o of OUTCOMES) {
    const m = os.outOutcome(o.id);
    ok(`🔴 both copies define ${o.id}`, !!m);
    if (!m) continue;
    eq(`  ${o.id}: same label`, m.label, o.label);
    eq(`  ${o.id}: same channels`, (m.channels || []).join(","), o.channels.join(","));
    eq(`  ${o.id}: same reached`, !!m.reached, !!o.reached);
    eq(`  ${o.id}: same ends`, !!m.ends, !!o.ends);
    eq(`  ${o.id}: same blocks`, !!m.blocks, !!o.blocks);
    eq(`  ${o.id}: same books`, !!m.books, !!o.books);
  }
  eq("the same channels", os.OUT_CHANNELS.map((c) => c.id).join(","), CHANNELS.map((c) => c.id).join(","));

  const sample = [
    { channel: "call", outcome: "gatekeeper" },
    { channel: "call", outcome: "voicemail" },
    { channel: "email", outcome: "booked", meeting_at: new Date(T0 - DAY).toISOString(), showed: true },
    { channel: "email", outcome: "booked", meeting_at: new Date(T0 - DAY).toISOString() },
  ];
  const a = os.outRollup(sample), b = rollup(sample, { now: Date.now() });
  for (const k of ["attempts", "conversations", "booked", "showed", "noShowed", "convRate", "bookRate", "showRate"]) {
    eq(`🔴 both copies agree on ${k}`, a[k], b[k]);
  }
}

// ── 8. 🔴 NOTHING SENDS ──────────────────────────────────────────────────────
//
// The absence is the feature. Checked by looking for the machinery that sending would need, in
// every file this section owns, so adding a send button means deleting a test on purpose.
{
  // 🔴 LOOK FOR THE MACHINERY, NOT THE WORD. A first version banned the strings "instagram" and
  // "linkedin" anywhere in the file, and failed on this feature's own explanation of why it does
  // not send to them, and on the sentence on screen telling Bryson to send it himself. A guard
  // that fires on its own documentation gets deleted, so it has to match a SEND: an import of the
  // mail sender, or a request aimed at a messaging endpoint.
  const SENDS_MAIL = /import[^;]*\bsendEmail\b|\bsendEmail\s*\(|new\s+Resend\(|api\.resend\.com/;
  const SENDS_DM = /fetch\(\s*[`'"][^`'"]*(graph\.facebook|api\.linkedin|instagram\.com|\/me\/messages)/i;
  const files = [["the outreach endpoint", FN], ["the draft writer", DRAFT], ["the screen", UI.slice(UI.indexOf("function OutreachScreen"), UI.indexOf("function HomeScreen"))]];
  for (const [where, src] of files) {
    ok(`🔴 ${where} does not wire in the mail sender`, !SENDS_MAIL.test(src),
      "cold email from the address that sends client invoices is how an invoice lands in spam");
    ok(`🔴 ${where} does not post to a messaging API`, !SENDS_DM.test(src),
      "Instagram and LinkedIn ban accounts for automated messaging");
  }
  // 🔴 AND THE DETECTORS MUST BE ABLE TO FIRE. Two guards that can never trip are two guards that
  // say nothing, and this whole section is a guard against something NOT being there.
  ok("the mail detector really detects a mail sender",
    SENDS_MAIL.test('import { sendEmail } from "../lib/report-shared.mjs";')
    && SENDS_MAIL.test("await sendEmail({ to, subject, html });"));
  ok("and the DM detector really detects a DM send",
    SENDS_DM.test('fetch(`https://graph.facebook.com/v21.0/${id}/messages`)')
    && SENDS_DM.test("fetch('https://api.linkedin.com/v2/messages')"));
  ok("and neither fires on this feature's own explanation of why it does not send",
    !SENDS_MAIL.test("we do not send cold email from this domain")
    && !SENDS_DM.test("Instagram and LinkedIn ban accounts for automated messaging"));
  // The draft writer's whole job is to return text.
  ok("the draft writer returns drafts and nothing else", /return json\(\{ ok: true, channel, drafts, model \}\)/.test(DRAFT));
  ok("🔴 and says out loud why there is no send", /NO COLD EMAIL SENDER/.test(DRAFT) && /NO AUTOMATED DMs/.test(DRAFT),
    "an unexplained absence gets 'fixed' by the next person");
  // And the screen tells Bryson, because a missing Send button looks like a missing feature.
  ok("🔴 the screen explains the absence to him too",
    /sent by you, from your own email or Instagram/.test(UI),
    "otherwise it reads as unfinished and he asks for the button");
}

// ── 9. The dash rule reaches generated outreach ──────────────────────────────
{
  ok("the draft writer bans the dash in the prompt", /NEVER use a dash to join or interrupt/.test(DRAFT));
  ok("🔴 and strips it whether or not the model complied",
    /humanizeDeep\(use\.input\)/.test(DRAFT),
    "a prompt is guidance; this is the guarantee");
  ok("and forbids inventing a client roster BoldLine does not have",
    /never imply a roster, case studies or testimonials that do not exist/.test(DRAFT));
}


// ── 10. Adding one company by hand ───────────────────────────────────────────
//
// Bryson, 2026-09-22: *"yes add it"*, after being told the only way in was a whole Lead Scout search.
//
// 🔴 THE TWO THINGS THAT MAKE THIS SAFE RATHER THAN CONVENIENT are tested hardest: a typed row must
// land under the SAME dedupe key the scout would have used, and typing the name of somebody who
// asked not to be contacted must be refused rather than quietly obeyed.
{
  const good = { name: "Summit Roofing", city: "Phoenix, AZ", phone: "602-555-0123" };

  // The floor: a name, and one way to reach them.
  ok("a company with a name and a phone builds a row", !!buildManualProspect(good).row);
  ok("🔴 a name with no phone, email or website is refused",
    /phone number, an email or a website/.test(buildManualProspect({ name: "Summit Roofing" }).error || ""),
    "a row that cannot be actioned reaches the top of the queue and is skipped every morning");
  ok("an email alone is enough", !!buildManualProspect({ name: "A Co", email: "hi@aco.com" }).row);
  ok("a website alone is enough", !!buildManualProspect({ name: "A Co", website: "aco.com" }).row);
  ok("a blank name is refused", !!buildManualProspect({ phone: "6025550123" }).error);
  ok("whitespace is not a name", !!buildManualProspect({ name: "   ", phone: "6025550123" }).error);

  // Typos are caught rather than stored, because an unreachable row is worse than no row.
  ok("a short phone number is a typo, not a number", !!buildManualProspect({ name: "A Co", phone: "5550123" }).error);
  ok("a nonsense email is refused", !!buildManualProspect({ name: "A Co", email: "dave at aco" }).error);
  eq("ten digits survive punctuation", cleanPhone("(602) 555-0123"), "6025550123");
  eq("and are shown back readably", prettyPhone("6025550123"), "(602) 555-0123");
  eq("a leading 1 is not mistaken for an area code", prettyPhone("16025550123"), "(602) 555-0123");
  eq("letters are not a phone number", cleanPhone("call me"), "");
  eq("an email is lowercased", cleanEmail("  Dave@ACo.COM "), "dave@aco.com");

  // 🔴 THE DEDUPE KEY IS THE WHOLE DUPLICATE GUARANTEE, and it is the scout's, not a second one.
  const built = buildManualProspect({ name: "The Summit Roofing Co., LLC", city: "Phoenix, AZ", phone: "6025550123" });
  eq("🔴 a typed row uses the SAME dedupe key the scout would have written",
    built.dedupeKey, dedupeKeyFor({ name: "Summit Roofing", city: "Phoenix AZ" }));
  ok("so a company found last week cannot be typed in again as a second copy",
    built.dedupeKey === buildManualProspect({ name: "summit roofing", city: "phoenix, az", phone: "6025550123" }).dedupeKey);

  // The row has to be the shape every other part of the screen already reads.
  const row = built.row;
  eq("it is new", row.status, "new");
  eq("it belongs to no search", row.run_id, null);
  eq("the website is normalised", buildManualProspect({ name: "A Co", website: "https://WWW.ACo.com/about" }).row.domain, "aco.com");
  ok("the phone lands where the card looks for it", row.data.phones[0].number === "(602) 555-0123");
  ok("an email lands where the card looks for it",
    buildManualProspect({ name: "A Co", email: "hi@aco.com" }).row.data.emails[0].address === "hi@aco.com");
  eq("and it is marked as typed rather than found", row.data.source, MANUAL_SOURCE);
  ok("which `isManual` reads", isManual(row) && !isManual({ data: { source: "scout" } }) && !isManual(null));

  // 🔴 SCORE 0 IS DELIBERATE, SO ORDERING HAS TO CARRY IT.
  eq("🔴 a typed row carries no invented research score", row.score, 0);
  const scouted = { id: "s", name: "Scouted", score: 92, step: 0, data: {} };
  const typed   = { id: "m", name: "Typed",   score: 0,  step: 0, data: { source: MANUAL_SOURCE } };
  eq("🔴 so the company he typed in comes before a 92-scoring one a search found",
    dueQueue([scouted, typed])[0].id, "m",
    "with score alone it sorts below thirty scraped businesses and never gets called");
  const promised = { id: "p", name: "Promised", score: 10, step: 1, next_due_at: new Date(Date.now() - 6e4).toISOString(), data: {} };
  eq("but a callback he promised still comes first", dueQueue([typed, promised])[0].id, "p");
  ok("a typed row is due immediately", dueQueue([typed]).length === 1);
  eq("and a blocked one can never be queued, typed or not",
    dueQueue([{ ...typed, blocked_at: new Date().toISOString() }]).length, 0);

  // ── What happens when the name is already on the list ─────────────────────
  //
  // 🔴 RUN, DO NOT READ. This is the point where a do-not-contact request either holds or quietly
  // stops holding, so it is a function the test executes.
  const blockedRow = { id: "b", name: "Weston Roofing", blocked_at: new Date().toISOString() };
  const liveRow    = { id: "l", name: "Weston Roofing", blocked_at: null };
  eq("🔴 a company that asked not to be contacted cannot be typed back in",
    manualAddVerdict(blockedRow).verdict, "blocked",
    "otherwise typing a name hands a blocked company straight back to the top of the queue");
  eq("and the refusal is a 409, not a pretend success", manualAddVerdict(blockedRow).status, 409);
  ok("and it says why, by name", /asked not to be contacted/.test(manualAddVerdict(blockedRow).message));
  eq("a company already on the list is reported, not duplicated", manualAddVerdict(liveRow).verdict, "duplicate");
  eq("a name nobody has is inserted", manualAddVerdict(null).verdict, "insert");
  eq("and an undefined lookup is not mistaken for a free name check", manualAddVerdict(undefined).verdict, "insert");

  // ── The endpoint ──────────────────────────────────────────────────────────
  ok("the endpoint exposes the add action", /if \(action === "add"\)/.test(FN));
  ok("and only by POST", /action === "add"[\s\S]{0,240}POST required/.test(FN));
  ok("🔴 it hands the row it found straight to that verdict, deciding nothing itself",
    /const existing = \(clash \|\| \[\]\)\[0\] \|\| null;\s*const verdict = manualAddVerdict\(existing\);/.test(FN),
    "an endpoint that re-decides this is an endpoint where the block can be lost in an edit");
  ok("and returns the verdict's own status and words",
    /verdict\.verdict === "blocked"[\s\S]{0,160}verdict\.message \}, verdict\.status/.test(FN));
  ok("it checks the website as a second duplicate test, like the scout does",
    /dedupe_key\.eq\.\$\{built\.dedupeKey\},domain\.eq\.\$\{domain\}/.test(FN));
  ok("an existing company is reported as already there, not inserted twice",
    /duplicate: true, id: existing\.id/.test(FN));
  ok("🔴 and a race that beats the check is caught by the unique index, not by hope",
    /duplicate key\|23505/.test(FN),
    "two taps in the same second must not create a second copy");
  ok("the row itself is built by the shared rules, never re-decided in the endpoint",
    /buildManualProspect\(body\)/.test(FN) && !/dedupe_key: /.test(FN));

  // ── The screen ────────────────────────────────────────────────────────────
  ok("the screen offers the button", /Add a company by hand/.test(UI));
  ok("it asks for a company name", /Company name \*/.test(UI));
  ok("and posts to the add action", /api\("action=add",\{method:"POST"/.test(UI));
  ok("it reloads the queue so the new company is actually there", /if\(!d\.duplicate\) await loadQueue\(\);/.test(UI));
  ok("🔴 and the form stays open and empties itself rather than closing",
    /setAddForm\(\{name:"",phone:"",email:"",website:"",city:"",niche:"",ownerName:"",notes:""\}\);\s*setAddMsg\(/.test(UI)
    && !/setAddOpen\(false\); await loadQueue/.test(UI),
    "referrals arrive in threes, and closing it takes the confirmation down with it");
  // 🔴 Narrow on purpose: it looks for the LIB'S OWN SENTENCES appearing in the screen, not for
  // words like "valid", so ordinary help text can never trip it. A guard that fires on innocent
  // copy gets deleted, and then it guards nothing.
  const SCREEN = UI.split("function OutreachScreen")[1].split("\nfunction ")[0] || "";
  ok("🔴 the screen never re-decides what is valid — the server answers, once",
    !/doesn't look right|there is no way to reach them|too long/.test(SCREEN),
    "two copies of the validation rules is two different answers to the same question");
  ok("and it shows whatever the server said rather than its own guess",
    /catch\(e\)\{ setAddErr\(setupMsg\(e\.message\)\|\|e\.message\); \}/.test(SCREEN));
  ok("🔴 a typed company is never shown a score of 0 as though it were a verdict",
    /outIsManual\(cur\)[\s\S]{0,240}Added by you/.test(UI),
    "a referral labelled 0 reads as worthless");
  ok("🔴 and Lead Scout's own badge does not label it SKIP in red",
    /const ScoreBadge=\(\{score,manual\}\)=>\{ const t=manual\?\{label:"Added by you"/.test(UI)
    && /<ScoreBadge score=\{p\.score\} manual=\{outIsManual\(p\)\}\/>/.test(UI),
    "scoutTier(0) is 'Skip', which is exactly the wrong word for a company he chose");
  ok("the empty list points at both doors, not just Lead Scout",
    /add one company by hand with the button above/.test(UI));
  ok("the two copies of `isManual` agree on what marks a typed row",
    /data\.source === "manual"/.test(UI) && MANUAL_SOURCE === "manual");

  // 🔴 The new door must not become a sending door.
  ok("🔴 adding a company sends nothing to anybody",
    !/action === "add"[\s\S]{0,2000}(sendMail|sgMail|resend|transporter|twilio)/i.test(FN));
}


// ── 11. A prospect you rejected must stop being offered ──────────────────────
//
// Bryson, 2026-09-22, weeding a fresh search: *"i want to delete the bad ones but when i press
// delete it doesnt delete them."* Fixing Delete is only half of it. Marking somebody **"Not a
// fit"** in Lead Scout left them sitting in the calling queue at step 0 with nothing due, so they
// came back the next morning anyway and the weeding was pointless either way.
//
// 🔴 THIS IS NOT THE DO-NOT-CONTACT GUARD AND MUST NEVER BE CONFUSED WITH IT. A status is a
// dropdown somebody can change back; `blocked_at` is a legal instruction that cannot be. Both
// checks exist, separately, and the blocked one is still the one with teeth.
{
  const at = (status) => ({ id: status, name: status, status, step: 0, score: 50, data: {} });
  eq("a new prospect is callable", dueQueue([at("new")]).length, 1);
  eq("so is one already contacted", dueQueue([at("contacted")]).length, 1);
  eq('🔴 one marked "Not a fit" is not', dueQueue([at("dead")]).length, 0,
    "weeding the list has to actually take them off the calling queue");
  eq("🔴 nor is a client you already won", dueQueue([at("client")]).length, 0,
    "cold calling an existing client is the worst call you can make");
  ok("both are named in one place", QUEUE_SKIP_STATUS.includes("dead") && QUEUE_SKIP_STATUS.includes("client"));
  ok("`isQueueable` answers the same question on its own",
    isQueueable(at("new")) && !isQueueable(at("dead")) && !isQueueable(at("client")) && !isQueueable(null));

  // 🔴 THE TWO GUARDS ARE INDEPENDENT. A status must never be able to stand in for a block, and
  // undoing a status must never quietly undo a block.
  ok("🔴 a blocked prospect stays out whatever their status says",
    dueQueue([{ ...at("new"), blocked_at: new Date().toISOString() }]).length === 0
    && dueQueue([{ ...at("contacted"), blocked_at: new Date().toISOString() }]).length === 0,
    "a sales stage is a dropdown; a do-not-contact request is not");
  ok("and `isBlocked` still only reads the block",
    isBlocked({ blocked_at: "2026-01-01" }) && !isBlocked({ status: "dead" }),
    "if a status could imply a block, changing the status could un-imply it");

  // And filtered in SQL as well, the same belt and braces the blocked check already had.
  ok("the queue query drops them before they are ever read",
    /\.not\("status", "in", `\(\$\{QUEUE_SKIP_STATUS\.join\(","\)\}\)`\)/.test(FN),
    "one filter is a filter; two that fail independently is a guarantee");
  ok("and it is the shared list, not a second copy of the same two words",
    /QUEUE_SKIP_STATUS \} from "\.\.\/lib\/outreach\.mjs"/.test(FN));
}

console.log(`verify-outreach: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
