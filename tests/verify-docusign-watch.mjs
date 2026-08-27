// The job that notices a client signed, by RUNNING it.
//
// Bryson, 2026-08-27, an hour after DocuSign went live: *"can you make it so the os
// automatically knows when he signed and updates it and sends me a notification."*
//
// 🔴 THE BUG THIS SUITE EXISTS TO STOP: A CONTRACT MARKED ACTIVE THAT NOBODY SIGNED.
// DocuSign calls an envelope "delivered" the moment the recipient OPENS the email. It is
// the single most misread status in that API. Reading it as signed would flip a client to
// active, fire "they signed!" to Bryson's phone, and send the client a confirmation that
// their agreement is on file — before they had read a word of it. Every other guard here
// protects the same thing from a different direction: an API that errors, a save that
// fails, a status nobody has seen before.
//
// The real loop runs, with its four outside edges handed in as functions (KB `repo-tests`:
// a harness more permissive than production is not a test). So the guards that only fire
// on a bad day are executed here, not reasoned about.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  needsCheck, decideFromEnvelope, decideNudge, daysWaiting,
  IN_FLIGHT, NUDGE_AFTER_DAYS, isSigned,
} from "../netlify/lib/docusign-status.mjs";
import { runWatch, summaryLine } from "../netlify/functions/docusign-watch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const SENT = "2026-08-27T18:00:00.000Z";
const client = (o = {}) => ({
  name: "Stencil & Thread", contactName: "Sebastian Perrin", email: "s@stencil.com",
  packageId: "g-launch", docusignEnvelopeId: "env-1", docusignSentAt: SENT, portalToken: "t",
  ...o,
});
const day = (n) => new Date(new Date(SENT).getTime() + n * 864e5);

// ── 1. Who is even worth asking DocuSign about ────────────────────────────────
{
  ok("a client with an outstanding envelope is checked", needsCheck(client()));
  ok("a client that never went through DocuSign is not", !needsCheck(client({ docusignEnvelopeId: "" })));
  // 🔴 The re-flip guard. Without it every run would re-alert on the same signature
  // forever, which is how a notification channel gets muted and then misses the next one.
  ok("🔴 an already-signed client is never checked again", !needsCheck(client({ contractSigned: true })));
  ok("the house account is skipped", !needsCheck(client({ internal: true })));
  ok("a missing client does not throw", needsCheck(null) === false && needsCheck(undefined) === false);
}

// ── 2. 🔴 THE STATUS TABLE, ONE ROW AT A TIME ─────────────────────────────────
{
  const c = client();
  const d = decideFromEnvelope(c, { status: "completed", completedDateTime: "2026-08-28T15:04:00.000Z" });
  ok("completed marks the contract signed", d.patch.contractSigned === true);
  ok("completed makes the contract active", d.patch.contractStatus === "active");
  ok("completed records WHEN they signed, from DocuSign's own timestamp",
    d.patch.contractSignedAt === "2026-08-28T15:04:00.000Z");
  ok("completed alerts Bryson", !!d.alert && d.alert.severity === "green");
  ok("the alert names the client so a phone notification is readable on its own",
    d.alert.title.includes("Stencil & Thread") && d.alert.smsText.includes("Stencil & Thread"),
    `${d.alert.title} / ${d.alert.smsText}`);
  ok("the alert says what to do next", /ad account/i.test(d.alert.body));
  ok("the client gets their confirmation email", d.email === "contract_signed");
}

// 🔴 THE HEADLINE GUARD. Each in-flight status, checked for all four wrong outcomes.
for (const status of IN_FLIGHT) {
  const d = decideFromEnvelope(client(), { status });
  ok(`🔴 "${status}" does NOT mark the contract signed`, !(d.patch || {}).contractSigned,
    `"${status}" means in flight; "delivered" in particular only means they opened the email`);
  ok(`🔴 "${status}" does NOT make the contract active`, (d.patch || {}).contractStatus !== "active");
  ok(`🔴 "${status}" does NOT alert Bryson`, d.alert === null);
  ok(`🔴 "${status}" does NOT email the client a signed confirmation`, d.email === null);
  ok(`"${status}" is still recorded so the OS can show where it got to`, d.patch.docusignStatus === status);
}
{
  ok("🔴 isSigned agrees: only completed counts",
    isSigned("completed") && !IN_FLIGHT.some(isSigned) && !isSigned("declined") && !isSigned("voided"));
  // Nothing to save when the status has not moved, so nothing is written every 15 minutes.
  const same = decideFromEnvelope(client({ docusignStatus: "delivered" }), { status: "delivered" });
  ok("a status that has not changed writes nothing", same.patch === null && same.note === "unchanged");
  const moved = decideFromEnvelope(client({ docusignStatus: "sent" }), { status: "delivered" });
  ok("but a status that HAS moved is written", moved.patch.docusignStatus === "delivered");
}

// ── 3. The two that need a phone call today ───────────────────────────────────
{
  const d = decideFromEnvelope(client(), { status: "declined", declinedReason: "Wants a lower rate" });
  ok("🔴 declined is loud", d.alert && d.alert.severity === "red");
  ok("🔴 declined never marks the contract signed", !(d.patch || {}).contractSigned);
  ok("declined leaves the contract pending, not active", d.patch.contractStatus === "pending");
  ok("the reason they gave is passed through", d.alert.body.includes("Wants a lower rate"));
  ok("declined does not email the client anything", d.email === null,
    "a client who just refused to sign must not receive 'your agreement is on file'");
  ok("it tells him to call rather than email", /call them today/i.test(d.alert.body));

  const bare = decideFromEnvelope(client(), { status: "declined" });
  ok("a decline with no reason still alerts, and says so", /no reason given/i.test(bare.alert.body));
}
{
  const d = decideFromEnvelope(client(), { status: "voided", voidedReason: "Expired" });
  ok("🔴 voided is loud", d.alert && d.alert.severity === "red");
  ok("🔴 voided never marks the contract signed", !(d.patch || {}).contractSigned);
  ok("voided tells him to send a fresh one", /fresh one|new one/i.test(d.alert.body + d.alert.smsText));
  ok("voided does not email the client", d.email === null);
}

// ── 4. 🔴 UNCERTAINTY CHANGES NOTHING ─────────────────────────────────────────
// Every one of these is a shape a real API returns on a bad day.
{
  const blanks = [
    ["a status nobody has seen before", { status: "correcting" }],
    ["an empty status", { status: "" }],
    ["a body with no status at all", { foo: "bar" }],
    ["an empty object", {}],
    ["null", null],
    ["undefined", undefined],
  ];
  for (const [what, env] of blanks) {
    const d = decideFromEnvelope(client(), env);
    ok(`🔴 ${what} changes nothing`, d.patch === null && d.alert === null && d.email === null,
      JSON.stringify(d));
  }
  // And the belt-and-braces version: even a genuine "completed" cannot re-flip someone
  // who is already signed, so a stale row can never fire a second alert.
  const done = decideFromEnvelope(client({ contractSigned: true }), { status: "completed" });
  ok("🔴 a completed envelope for an already-signed client does nothing",
    done.patch === null && done.alert === null && done.email === null);
}

// ── 5. The chase reminder, said once ──────────────────────────────────────────
{
  ok("days waiting counts from when it was sent", daysWaiting(client(), day(4)) === 4);
  ok("a client with no send date has no clock", daysWaiting(client({ docusignSentAt: "" }), day(9)) === null);

  // The boundary, both sides of it — the day before must be silent or the threshold is fiction.
  ok(`🔴 nothing on day ${NUDGE_AFTER_DAYS - 1}`, decideNudge(client(), day(NUDGE_AFTER_DAYS - 1)) === null);
  const n = decideNudge(client(), day(NUDGE_AFTER_DAYS));
  ok(`a nudge on day ${NUDGE_AFTER_DAYS}`, !!n && n.alert.severity === "yellow");
  ok("the nudge says how long it has been", n.alert.body.includes(`${NUDGE_AFTER_DAYS} days`));
  ok("the nudge records that it was said", !!n.patch.docusignNudgedAt);
  // 🔴 This job runs 96 times a day. Without this guard it is 96 notifications a day.
  ok("🔴 and it is never said twice", decideNudge(client({ docusignNudgedAt: SENT }), day(30)) === null);
  ok("a signed client is never nudged", decideNudge(client({ contractSigned: true }), day(30)) === null);
}

// ── 6. 🔴 THE WHOLE LOOP, RUN FOR REAL ────────────────────────────────────────
// The decision above is pure; this is the part that writes to the database and sends
// things. Everything it touches is handed in, so the failure paths actually execute.
const harness = (rows, envelopes, opts = {}) => {
  const saved = [], alerts = [], emails = [], fetched = [];
  const run = runWatch({
    loadClients: async () => rows,
    fetchEnvelope: async (id) => {
      fetched.push(id);
      if (opts.fetchThrows) throw new Error("401 expired token");
      if (!(id in envelopes)) throw new Error("404 not found");
      return envelopes[id];
    },
    saveClient: async (id, data) => {
      if (opts.saveThrows) throw new Error("supabase write failed");
      saved.push({ id, data });
    },
    alert: async (a) => { if (opts.alertThrows) throw new Error("push gateway down"); alerts.push(a); },
    sendEmail: async (cl, type) => { if (opts.emailThrows) throw new Error("resend 500"); emails.push({ cl, type }); },
    now: () => opts.now || day(0),
  });
  return run.then((summary) => ({ summary, saved, alerts, emails, fetched }));
};

{
  const rows = [
    { id: "a", data: client({ name: "Signed Co" }) },
    { id: "b", data: client({ name: "Opened Co", docusignEnvelopeId: "env-2" }) },
    { id: "c", data: client({ name: "Done Already", contractSigned: true, docusignEnvelopeId: "env-3" }) },
    { id: "d", data: { name: "Never Sent", packageId: "g-launch" } },
    { id: "e", data: client({ name: "House", internal: true, docusignEnvelopeId: "env-5" }) },
  ];
  const r = await harness(rows, {
    "env-1": { status: "completed", completedDateTime: "2026-08-28T15:04:00.000Z" },
    "env-2": { status: "delivered" },
    "env-3": { status: "completed" },
    "env-5": { status: "completed" },
  });
  ok("only the outstanding envelopes are looked up", r.summary.pending === 2, JSON.stringify(r.summary));
  // 🔴 Not "the right count" but "the right ones": a signed client's envelope must never
  // be requested, because the row that is never read is the row that can never be re-flipped.
  ok("🔴 no API call is made for a client already signed, never sent, or internal",
    !r.fetched.includes("env-3") && !r.fetched.includes("env-5") && r.fetched.length === 2,
    r.fetched.join(","));
  ok("the signature is saved", r.summary.signed === 1);
  const signed = r.saved.find((s) => s.id === "a");
  ok("the saved record is the whole client plus the change, not a replacement",
    signed.data.email === "s@stencil.com" && signed.data.packageId === "g-launch" && signed.data.contractSigned === true,
    "a partial write here would silently wipe a client's record");
  ok("a note goes in their history", signed.data.commLog[0].note.includes("signed via DocuSign"));
  ok("the note is filed under the contract", signed.data.commLog[0].cat === "contract");
  ok("exactly one alert is raised", r.alerts.length === 1 && r.alerts[0].severity === "green");
  ok("exactly one client email goes out", r.emails.length === 1 && r.emails[0].type === "contract_signed");
  ok("🔴 the client who only OPENED it gets no email and no alert",
    !r.emails.some((e) => e.cl.name === "Opened Co") && r.alerts.length === 1);
  ok("but their opened status is recorded", (r.saved.find((s) => s.id === "b") || {}).data.docusignStatus === "delivered");
}

// 🔴 The bad-day paths.
{
  const rows = [{ id: "a", data: client() }];
  const r = await harness(rows, { "env-1": { status: "completed" } }, { fetchThrows: true });
  ok("🔴 a DocuSign lookup that throws changes nothing", r.saved.length === 0 && r.alerts.length === 0 && r.emails.length === 0);
  ok("and it is counted as an error, not as 'unchanged'", r.summary.errors === 1 && r.summary.signed === 0);
  ok("and the run does not crash", r.summary.pending === 1);
}
{
  const rows = [{ id: "a", data: client() }, { id: "b", data: client({ name: "Second", docusignEnvelopeId: "env-2" }) }];
  const r = await harness(rows, { "env-2": { status: "completed" } });
  ok("🔴 one client failing does not stop the next one being checked", r.summary.signed === 1 && r.saved.length === 1);
  ok("the one that worked is the one that was saved", r.saved[0].data.name === "Second");
}
{
  const rows = [{ id: "a", data: client() }];
  const r = await harness(rows, { "env-1": { status: "completed" } }, { saveThrows: true });
  // 🔴 The worst possible outcome is Bryson being told a contract is active while the
  // record still says pending. He would act on it, and nothing would ever correct him.
  ok("🔴 if the save fails, Bryson is NOT told they signed", r.alerts.length === 0);
  ok("🔴 and the client is NOT sent a confirmation", r.emails.length === 0);
  ok("the failure is counted", r.summary.errors === 1 && r.summary.signed === 0);
}
{
  const rows = [{ id: "a", data: client() }];
  const r = await harness(rows, { "env-1": { status: "completed" } }, { alertThrows: true });
  ok("a dead notification channel does not undo a recorded signature", r.saved.length === 1 && r.summary.signed === 1);
  ok("and the client confirmation still goes out", r.emails.length === 1);
  const r2 = await harness(rows, { "env-1": { status: "completed" } }, { emailThrows: true });
  ok("a bounced client email does not undo it either", r2.saved.length === 1 && r2.alerts.length === 1);
}
{
  // The nudge, through the real loop, and then not again.
  const rows = [{ id: "a", data: client() }];
  const r = await harness(rows, { "env-1": { status: "sent" } }, { now: day(NUDGE_AFTER_DAYS + 1) });
  ok("an envelope sitting unsigned raises the chase reminder", r.summary.nudged === 1 && r.alerts.length === 1);
  ok("the reminder is a nudge, not an emergency", r.alerts[0].severity === "yellow");
  ok("and it is stamped so it cannot repeat", !!r.saved[0].data.docusignNudgedAt);

  // 🔴 Opened AND overdue is one write, not a race between them. An envelope moving from
  // sent to delivered is only a bookkeeping change, so it must not swallow the reminder
  // that the thing has been sitting there for days.
  const both = await harness([{ id: "a", data: client({ docusignStatus: "sent" }) }],
    { "env-1": { status: "delivered" } }, { now: day(NUDGE_AFTER_DAYS + 2) });
  ok("🔴 an envelope that was opened and is also overdue still nudges", both.summary.nudged === 1);
  ok("and the same write records both facts",
    both.saved[0].data.docusignStatus === "delivered" && !!both.saved[0].data.docusignNudgedAt);

  const again = await harness([{ id: "a", data: r.saved[0].data }], { "env-1": { status: "sent" } }, { now: day(NUDGE_AFTER_DAYS + 9) });
  ok("🔴 the next run does not nudge again", again.alerts.length === 0 && again.summary.nudged === 0);
  ok("🔴 and writes nothing at all, so it is not touching the database every 15 minutes",
    again.saved.length === 0 && again.summary.unchanged === 1);
}
{
  // A signature arriving on an envelope that is also overdue must read as the signature.
  const rows = [{ id: "a", data: client() }];
  const r = await harness(rows, { "env-1": { status: "completed" } }, { now: day(NUDGE_AFTER_DAYS + 5) });
  ok("🔴 a late signature alerts as SIGNED, not as a chase reminder",
    r.alerts.length === 1 && r.alerts[0].severity === "green", JSON.stringify(r.alerts));
  ok("and is not stamped as nudged", !r.saved[0].data.docusignNudgedAt);
}
{
  const r = await harness([], {});
  ok("no outstanding envelopes is a quiet no-op", r.summary.pending === 0 && r.alerts.length === 0);
  ok("the summary line reads as English", /0 awaiting, 0 checked/.test(summaryLine(r.summary)), summaryLine(r.summary));
}

// ── 7. It has to actually be scheduled, and the email it names has to exist ───
{
  const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
  ok("🔴 the watcher is on a schedule, or none of the above ever runs",
    /\[functions\."docusign-watch"\][\s\S]{0,120}schedule\s*=/.test(toml),
    "a scheduled function with no cron entry is a file that never executes");

  const { EMAIL_TYPES } = await import("../netlify/lib/client-emails-shared.mjs");
  ok("🔴 the email the watcher auto-sends is a real template",
    EMAIL_TYPES.some((t) => t.id === "contract_signed"),
    "autoSendClientEmail would fail silently on a template id that does not exist");

  // The send path has to store the envelope id, or nothing is ever watched.
  const app = readFileSync(join(ROOT, "index.html"), "utf8");
  ok("🔴 sending via DocuSign stores the envelope id on the client",
    /docusignEnvelopeId:\s*d\.envelopeId/.test(app));
  ok("and stores when it was sent, which the chase reminder counts from",
    /docusignSentAt:\s*new Date\(\)\.toISOString\(\)/.test(app));
}

console.log(`verify-docusign-watch: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
