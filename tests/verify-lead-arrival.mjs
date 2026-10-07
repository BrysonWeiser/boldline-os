// The moment someone enquires on boldlinemedia.com (Bryson, 2026-10-07: "add both of those things").
// What has to stay true:
//  1. A contact-form or pricing-quiz enquiry gets ONE instant reply: claimed on the row first, so the
//     instant path and the 15-minute safety net can never both send it. Never late, never to a lead
//     Bryson already moved on, never more than three attempts.
//  2. The reply reads like Bryson: no em dash, no emoji, a booking link, and replies reach him.
//  3. The website tells the OS the instant a lead is saved, with nothing but its id, and the OS acts
//     only on a genuinely new row. No shared password between the two sites.
//  4. The free check is started from inside the OS in the 15-minute background function, never
//     written inside a 30-second scheduled one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const L = await import("../netlify/lib/lead-arrival.mjs");
const CE = await import("../netlify/lib/client-emails-shared.mjs");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const NOW = Date.UTC(2026, 9, 7, 22, 0);
const ago = (ms) => new Date(NOW - ms).toISOString();
const row = (o = {}) => ({ id: "11111111-2222-3333-4444-555555555555", form: "contact", name: "Jamie Cole", email: "jamie@example.com", status: "new", created_at: ago(30e3), payload: {}, ...o });

// 1. Who is owed a reply
ok("a fresh contact enquiry is owed a reply", L.needsAck(row(), NOW));
ok("so is the pricing quiz's 'email me a plan'", L.needsAck(row({ form: "recommendation", name: null }), NOW));
ok("🔴 the free check is not (its report IS the reply)", !L.needsAck(row({ form: "lead_leak" }), NOW));
ok("a booking is not (Calendly confirms it)", !L.needsAck(row({ form: "calendly" }), NOW));
ok("no reply to an address that is not one", !L.needsAck(row({ email: "not an email" }), NOW));
ok("🔴 never twice", !L.needsAck(row({ payload: { ackSentAt: ago(1e3) } }), NOW));
ok("🔴 never late: nothing after two hours", !L.needsAck(row({ created_at: ago(L.ACK_WINDOW_MS + 60e3) }), NOW) && L.needsAck(row({ created_at: ago(L.ACK_WINDOW_MS - 60e3) }), NOW));
ok("never to a lead Bryson already moved on", !L.needsAck(row({ status: "contacted" }), NOW));
ok("at most three attempts", !L.needsAck(row({ payload: { ackTries: L.MAX_ACK_TRIES } }), NOW));
ok("a claim in progress is left alone, a stale one is not", !L.needsAck(row({ payload: { ackClaimAt: ago(60e3) } }), NOW) && L.needsAck(row({ payload: { ackClaimAt: ago(30 * 60e3) } }), NOW));
ok("rubbish rows do not throw", [null, {}, { form: "contact" }].every((r) => { try { L.needsAck(r, NOW); return true; } catch { return false; } }));

// The claim, run against a fake database
const fakeDb = ({ claimWins = true } = {}) => {
  const writes = [];
  const q = (op) => { const st = { op, filters: [] }; const b = {
    eq(k, v) { st.filters.push(["eq", k, v]); return b; }, or(x) { st.filters.push(["or", x]); return b; }, is(k, v) { st.filters.push(["is", k, v]); return b; },
    select() { writes.push(st); return Promise.resolve({ data: claimWins ? [{ id: "x" }] : [], error: null }); },
    then(res) { writes.push(st); return Promise.resolve({ error: null }).then(res); },
  }; return b; };
  return { writes, from: () => ({ update: (v) => q({ update: v }) }) };
};
{
  const db = fakeDb(); const sent = [];
  const r = await L.ackEnquiry(db, row(), { now: NOW, send: async (m) => sent.push(m) });
  ok("🔴 the reply is sent once the claim wins", r.sent === true && sent.length === 1);
  const claim = db.writes[0];
  ok("🔴 the claim only succeeds on a row nobody else has claimed or sent", claim.filters.some((f) => f[0] === "or" && /ackClaimAt\.is\.null/.test(f[1])) && claim.filters.some((f) => f[0] === "is" && f[1] === "payload->>ackSentAt" && f[2] === null));
  ok("and success is recorded, so it never goes again", db.writes.some((w) => w.op.update && w.op.update.payload && w.op.update.payload.ackSentAt));
  ok("it goes to the person who enquired, as Bryson", sent[0].to === "jamie@example.com" && sent[0].fromName === "Bryson at BoldLine Media" && !sent[0].replyTo);
}
{
  const db = fakeDb({ claimWins: false }); const sent = [];
  const r = await L.ackEnquiry(db, row(), { now: NOW, send: async (m) => sent.push(m) });
  ok("🔴 if the other path claimed it first, nothing is sent", r.skipped && sent.length === 0);
}
{
  const db = fakeDb();
  const r = await L.ackEnquiry(db, row(), { now: NOW, send: async () => { throw new Error("resend down"); } });
  const last = db.writes[db.writes.length - 1].op.update.payload;
  ok("a failed send releases the claim for a retry and keeps the try count", r.ok === false && last.ackClaimAt === null && last.ackTries === 1 && /resend down/.test(last.ackError));
}

{
  // The fuller claim filter is refused: the plain one must still send.
  const writes = []; let first = true; const sent = [];
  const db = { from: () => ({ update: (v) => { const st = { v, f: [] }; const b = {
    eq(k, x) { st.f.push(["eq", k, x]); return b; }, or(x) { st.f.push(["or", x]); return b; }, is(k, x) { st.f.push(["is", k, x]); return b; },
    select() { writes.push(st); if (first) { first = false; return Promise.resolve({ data: null, error: { message: "bad filter" } }); } return Promise.resolve({ data: [{ id: "x" }], error: null }); },
    then(res) { writes.push(st); return Promise.resolve({ error: null }).then(res); } }; return b; } }) };
  const r = await L.ackEnquiry(db, row(), { now: NOW, send: async (m) => sent.push(m) });
  ok("🔴 if the database refuses the fuller claim, the plain claim still gets the reply out", r.sent === true && sent.length === 1 && writes[1].f.some((f) => f[0] === "is" && f[1] === "payload->>ackClaimAt"));
}

// 2. The words
{
  const plain = CE.renderEnquiryAck({ name: "Jamie Cole", bookUrl: L.BOOK_URL });
  const quiz = CE.renderEnquiryAck({ recommended: "Growth System on Google", bookUrl: L.BOOK_URL });
  const text = (h) => h.replace(/<[^>]+>/g, " ");
  for (const [n, m] of [["contact", plain], ["quiz", quiz]]) {
    ok(`🔴 ${n} reply: no em or en dash anywhere`, !/[—–]|&mdash;|&ndash;/.test(m.subject + m.html));
    ok(`${n} reply: no emoji`, ![...m.html].some((c) => /\p{Extended_Pictographic}/u.test(c) && c !== "→"));
    ok(`${n} reply: a booking button`, m.html.includes(L.BOOK_URL) && /Pick a Time/.test(m.html));
    ok(`${n} reply: in the shared BoldLine design, signed by Bryson`, m.html.includes("boldlinemedia.com/logo.png") && /Bryson, BoldLine Media/.test(m.html));
    ok(`${n} reply: never says local businesses`, !/local business/i.test(text(m.html)));
    ok(`${n} reply: promises nothing it cannot keep (no "today")`, !/\btoday\b/i.test(text(m.html)));
  }
  ok("the contact reply greets them by first name", /Got your message, Jamie\./.test(plain.html) && plain.subject === "Got your message, Jamie");
  ok("the quiz reply names the package they were shown", /Growth System on Google/.test(quiz.html) && /not a quote/.test(quiz.html));
  ok("a name cannot inject", !CE.renderEnquiryAck({ name: "<script>x</script>" }).html.includes("<script>x"));
  ok("no name still reads properly", /Got your message\.</.test(CE.renderEnquiryAck({}).html));
}

// 3. The instant trigger
{
  const SC = src("marketing-site/netlify/functions/submission-created.mjs");
  const AU = src("marketing-site/netlify/functions/audit.mjs");
  const LA = src("netlify/functions/lead-arrived-background.mjs");
  ok("🔴 the website tells the OS the instant the contact form is saved", /saveLead\(formName, data\)\.then\(tellOS\)/.test(SC) && /lead-arrived-background/.test(SC) && /\.select\("id"\)\.single\(\)/.test(SC));
  ok("🔴 and the website no longer sends its own reply, so there is exactly one", !/emailLead|autoReplyHTML/.test(SC));
  ok("the free check tells the OS the same way", /lead-arrived-background/.test(AU) && /body: JSON\.stringify\(\{ leadId \}\)/.test(AU));
  ok("🔴 no shared password between the sites any more", !/AUDIT_TRIGGER_SECRET/.test(AU.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")));
  ok("the OS endpoint is a background function, so the website never waits", src("netlify/functions/lead-arrived-background.mjs").length > 500 && /lead-arrived-background/.test(SC));
  ok("🔴 it accepts only an id, and reads everything else from the saved row", /if \(!UUID_RE\.test\(leadId\)\)/.test(LA) && /from\("website_leads"\)\.select\([^)]*\)\.eq\("id", leadId\)/.test(LA) && !/body\.email|body\.website/.test(LA));
  ok("🔴 it acts only on a lead created in the last few minutes", /if \(!isFresh\(row\)\) return/.test(LA) && L.isFresh({ created_at: ago(60e3) }, NOW) && !L.isFresh({ created_at: ago(L.LEAD_FRESH_MS + 60e3) }, NOW));
  ok("it buzzes his phone through the same mirror the 15-minute job runs", /await syncHouseLeads\(supabase\)/.test(LA));
  ok("🔴 a booked call buzzes his phone on the calendar check that finds it, not a run later", /if \(added\) \{\s*try \{ await syncHouseLeads\(supabase\); \}/.test(src("netlify/functions/calendly-leads.mjs")));
  ok("the 15-minute job is the safety net for the reply", /sendPendingAcks\(supabase\)/.test(src("netlify/functions/house-leads.mjs")));
}

// 4. The free check, started from the OS
{
  const sent = [];
  const okStart = await L.startAudit("11111111-2222-3333-4444-555555555555", { base: "https://os.example/", fetchImpl: async (u, o) => { sent.push({ u, o }); return { status: 202, ok: false }; } });
  ok("the free check is started in the background function", okStart && sent[0].u === "https://os.example/.netlify/functions/lead-leak-audit-background");
  ok("with the OS's own key and only the lead id", sent[0].o.headers["x-lead-job-key"] === L.leadJobKey() && JSON.stringify(JSON.parse(sent[0].o.body)) === '{"leadId":"11111111-2222-3333-4444-555555555555"}');
  ok("🔴 a wrong key is refused", !L.keyOk("nope") && L.keyOk(L.leadJobKey()));
  const BG = src("netlify/functions/lead-leak-audit-background.mjs");
  ok("the background function reads the lead from the row and only for a free-check request", /if \(!row \|\| row\.form !== "lead_leak"\)/.test(BG));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-lead-arrival: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
