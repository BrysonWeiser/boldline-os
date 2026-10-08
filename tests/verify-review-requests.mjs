// Review requests: ask a client's customers for a Google review, by email.
// Run: node tests/verify-review-requests.mjs
//
// Bryson, 2026-10-05: "yea lets do that". KB `service-add-ons`. Everything is RUN, not grepped:
// the rules, the sender (with fakes for the database and Resend), the owner endpoint and the
// unsubscribe page. The four failures this must never commit are marked 🔴.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as R from "../netlify/lib/review-requests.mjs";
import { runReviewSends, optOutUrl } from "../netlify/functions/review-requests-run.mjs";
import { handle } from "../netlify/functions/review-requests.mjs";
import { handleOptOut } from "../netlify/functions/review-optout.mjs";
import { readSite } from "./helpers/marketing-site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const TOML = readFileSync(join(ROOT, "netlify.toml"), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const t = async (l, fn) => { try { await fn(); } catch (e) { fails.push(`${l} — threw ${e.message}`); } };

const DAY = 864e5;
// 2026-10-06 18:00 UTC = 11am Phoenix, inside the window.
const NOON = Date.UTC(2026, 9, 6, 18);
const NIGHT = Date.UTC(2026, 9, 7, 6);   // 11pm Phoenix
const LINK = "https://g.page/r/CAbc123/review";
const CLIENT = { id: "c1", name: "Springbok Chiropractic, LLC", reviewSenderName: "Springbok Wellness", email: "owner@springbok.com",
  googleReviewUrl: LINK, businessAddress: "1400 N Gilbert Rd, Suite M, Gilbert, AZ 85234", niche: "Chiropractic" };
const row = (o) => ({ id: "r" + Math.random().toString(36).slice(2, 8), client_id: "c1", name: "Jane Smith", email: "jane@x.com",
  status: "queued", token: "ab".repeat(18), attempts: 0, created_at: new Date(NOON - 3600e3).toISOString(), ...o });

// ── 1. The Google link ──────────────────────────────────────────────────────────────────────
{
  ok("a g.page review link is accepted, https added", R.normReviewUrl("g.page/r/CAbc123/review") === LINK);
  for (const good of ["https://search.google.com/local/writereview?placeid=XYZ", "https://maps.app.goo.gl/abc", "https://www.google.com/maps/place/x"])
    ok(`accepted: ${good}`, !!R.normReviewUrl(good));
  for (const bad of ["javascript:alert(1)", "http://g.page/r/x/review", "https://boldlinemedia.com/review", "https://evilgoogle.com/x",
    "https://g.page.evil.com/r/x", "https://google.com/", "https://springbokwellness.com", "data:text/html,hi"])
    ok(`🔴 refused: ${bad}`, R.normReviewUrl(bad) === "");
  // The screen's copy must agree with the server on every one of these.
  const a = UI.indexOf("const revUrlNorm="), b = UI.indexOf("const revIsHealth=", a);
  const uiNorm = new Function(UI.slice(a, b) + "return revUrlNorm;")();
  const cases = ["g.page/r/CAbc123/review", "https://maps.app.goo.gl/abc", "javascript:alert(1)", "http://g.page/r/x/review", "https://boldlinemedia.com/x", "https://google.com/", " https://www.google.com/maps/place/x "];
  ok("the OS screen's link check matches the server's exactly", cases.every((c) => uiNorm(c) === R.normReviewUrl(c)),
    JSON.stringify(cases.map((c) => [uiNorm(c), R.normReviewUrl(c)])));
}

// ── 2. Reading what he pastes ───────────────────────────────────────────────────────────────
{
  const { customers, bad } = R.parseCustomers("Jane Smith, Jane@Gmail.com\nmike@yahoo.com\nBob Lee <bob@x.co>\nAnn\t(480) 555-1212\tann@x.com\nno email here\n\n");
  ok("four shapes of line all read", customers.length === 4, JSON.stringify(customers));
  ok("emails are lower-cased", customers[0].email === "jane@gmail.com");
  ok("names come through, phone numbers do not become names", customers[0].name === "Jane Smith" && customers[2].name === "Bob Lee" && customers[3].name === "Ann");
  ok("a line with no email is reported, not dropped silently", bad.length === 1 && bad[0] === "no email here");
}

// ── 3. Who may be added ─────────────────────────────────────────────────────────────────────
{
  const existing = [
    { email: "gone@x.com", status: "reminded", created_at: new Date(NOON - 200 * DAY).toISOString(), opted_out_at: new Date(NOON - 150 * DAY).toISOString() },
    { email: "recent@x.com", status: "sent", created_at: new Date(NOON - 10 * DAY).toISOString() },
    { email: "old@x.com", status: "reminded", created_at: new Date(NOON - 120 * DAY).toISOString() },
    { email: "bounced@x.com", status: "failed", created_at: new Date(NOON - 5 * DAY).toISOString() },
  ];
  const { add, skipped } = R.addVerdicts([{ email: "gone@x.com" }, { email: "recent@x.com" }, { email: "old@x.com" }, { email: "bounced@x.com" },
    { email: "new@x.com" }, { email: "NEW@x.com" }, { email: "nope" }], existing, { now: NOON });
  const why = (e) => (skipped.find((s) => s.email === e) || {}).reason || "";
  ok("🔴 an unsubscribed address is refused forever, even 150 days later", /unsubscribed/.test(why("gone@x.com")));
  ok("someone asked 10 days ago is not asked again", /90 days/.test(why("recent@x.com")));
  ok("someone asked 120 days ago can be asked again", add.some((a) => a.email === "old@x.com"));
  ok("an address that failed to send can be retried", add.some((a) => a.email === "bounced@x.com"));
  ok("the same address twice in one paste is added once", add.filter((a) => a.email === "new@x.com").length === 1 && /twice/.test(why("new@x.com")));
  ok("junk is reported", /not an email/.test(why("nope")));
}

// ── 4. When and how much ────────────────────────────────────────────────────────────────────
{
  ok("11am Phoenix is inside the window, 11pm is not", R.inSendWindow(NOON) && !R.inSendWindow(NIGHT));
  ok("9:59am no, 10am yes, 6pm no", !R.inSendWindow(Date.UTC(2026, 9, 6, 16, 59)) && R.inSendWindow(Date.UTC(2026, 9, 6, 17)) && !R.inSendWindow(Date.UTC(2026, 9, 7, 1)));
  const clientsById = { c1: CLIENT, c2: { ...CLIENT, id: "c2" } };
  const many = Array.from({ length: 60 }, (_, i) => row({ id: "q" + i, client_id: i % 2 ? "c2" : "c1", email: `p${i}@x.com` }));
  const p = R.planReviewSends(many, { clientsById, now: NOON, maxThisRun: 100 });
  ok("🔴 never more than the daily cap in a day", p.sends.length === R.DEFAULT_DAILY_CAP, `${p.sends.length}`);
  ok("and one client cannot take it all", p.sends.filter((s) => s.row.client_id === "c1").length <= R.DEFAULT_CLIENT_DAILY_CAP);
  const used = Array.from({ length: 38 }, () => ({ client_id: "c2", sent_at: new Date(NOON - 3600e3).toISOString() }));
  const p2 = R.planReviewSends(many, { clientsById, history: used, now: NOON, maxThisRun: 100 });
  ok("🔴 sends earlier today count against the cap", p2.sends.length === 2, `${p2.sends.length}`);
  const yesterday = Array.from({ length: 40 }, () => ({ client_id: "c2", sent_at: new Date(NOON - 25 * 3600e3).toISOString() }));
  ok("yesterday's sends do not", R.planReviewSends(many, { clientsById, history: yesterday, now: NOON, maxThisRun: 100 }).sends.length === 40);

  const sent2 = row({ status: "sent", sent_at: new Date(NOON - 2 * DAY).toISOString() });
  const sent3 = row({ status: "sent", sent_at: new Date(NOON - 3 * DAY).toISOString() });
  const done = row({ status: "reminded", sent_at: new Date(NOON - 9 * DAY).toISOString(), reminded_at: new Date(NOON - 6 * DAY).toISOString() });
  const p3 = R.planReviewSends([sent2, sent3, done], { clientsById, now: NOON });
  ok("one reminder, three days after, not before, and never a second", p3.sends.length === 1 && p3.sends[0].row === sent3 && p3.sends[0].kind === "reminder");

  const out = row({ email: "out@x.com" });
  const p4 = R.planReviewSends([out, row({ status: "sent", email: "out@x.com", sent_at: new Date(NOON - 4 * DAY).toISOString() })],
    { clientsById, optedOut: new Set(["c1|out@x.com"]), now: NOON });
  ok("🔴 an unsubscribed address is never sent to, first email or reminder", p4.sends.length === 0 && p4.stops.length === 2);

  const stuck = row({ status: "sending", claimed_at: new Date(NOON - 45 * 60e3).toISOString() });
  const fresh = row({ status: "sending", claimed_at: new Date(NOON - 2 * 60e3).toISOString() });
  const p5 = R.planReviewSends([stuck, fresh], { clientsById, now: NOON });
  ok("a send that crashed 45 minutes ago goes back in line, one 2 minutes old is left alone",
    p5.resets.length === 1 && p5.resets[0].row === stuck && p5.resets[0].to === "queued" && p5.sends.length === 0);
  ok("a client with no review link waits, untouched", R.planReviewSends([row({})], { clientsById: { c1: { ...CLIENT, googleReviewUrl: "" } }, now: NOON }).sends.length === 0);
  ok("a client no longer in the OS is stopped", R.planReviewSends([row({ client_id: "zz" })], { clientsById, now: NOON }).stops[0].reason === "client_gone");

  const f1 = R.afterSend({ attempts: 0 }, "first", false, "boom", NOON);
  const f3 = R.afterSend({ attempts: 2 }, "first", false, "boom", NOON);
  ok("a failed send tries again, up to three times, then gives up", f1.status === "queued" && f1.attempts === 1 && f3.status === "failed");
  ok("a sent one records when", R.afterSend({}, "first", true, "", NOON).sent_at === new Date(NOON).toISOString());
}

// ── 5. The email itself ─────────────────────────────────────────────────────────────────────
{
  const unsub = optOutUrl("https://boldlinemedia.netlify.app", "ab".repeat(18));
  const r = row({ name: "jane <script>x</script>" });
  const first = R.renderReviewEmail(CLIENT, row({}), "first", { unsubscribeUrl: unsub });
  const rem = R.renderReviewEmail(CLIENT, row({}), "reminder", { unsubscribeUrl: unsub });
  const all = [first.subject, first.html, first.text, rem.subject, rem.html, rem.text].join("\n");
  ok("🔴 no em or en dashes anywhere (client-facing)", !/[—–]/.test(all));
  ok("🔴 no emojis anywhere (client-facing)", !/\p{Extended_Pictographic}/u.test(all));
  ok("it comes from the name customers know, not the legal name", /Springbok Wellness/.test(first.subject) && !/LLC/.test(first.html));
  ok("first name only, capitalised", /Hi Jane,/.test(first.text));
  const hostile = R.renderReviewEmail(CLIENT, r, "first", { unsubscribeUrl: unsub });
  const hostile2 = R.renderReviewEmail(CLIENT, row({ name: "<img src=x onerror=alert(1)>" }), "first", { unsubscribeUrl: unsub });
  ok("a name pasted with HTML in it is never rendered as HTML", !/<script>|<img/.test(hostile.html + hostile2.html) && /Hi Jane,/.test(hostile.text) && /Hi there,/.test(hostile2.text));
  const hrefs = [...first.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  ok("🔴 exactly two links: the Google review and the unsubscribe", hrefs.length === 2 && hrefs[0] === LINK && hrefs[1] === unsub, JSON.stringify(hrefs));
  ok("🔴 no review gating: no rating question, no stars, no 'how did we do'", !/how did we do|rate us|stars?\b|happy with|satisf/i.test(all));
  ok("🔴 no incentive offered for a review", !/discount|gift|reward|coupon|free|% off|enter to win/i.test(all));
  ok("the reminder lets people who already reviewed off the hook", /already left one, thank you/.test(rem.text));
  ok("the footer carries the business address", /1400 N Gilbert Rd/.test(first.text));
  ok("the From line is the business name at our verified address",
    R.fromAddress(CLIENT, "BoldLine Media <hello@boldlinemedia.com>") === '"Springbok Wellness" <hello@boldlinemedia.com>');
  ok("no From address configured means no From, not a guess", R.fromAddress(CLIENT, "") === "");
  ok("health clinics are flagged for the privacy agreement", R.isHealthBusiness(CLIENT) && !R.isHealthBusiness({ niche: "Pool Construction", name: "Summit Pools" }));
}

// ── 6. The sender, run with a fake database and a fake Resend ───────────────────────────────
const fakeWorld = (rows, { claimFails = new Set(), sendFails = new Set() } = {}) => {
  const db = new Map(rows.map((r) => [r.id, { ...r }]));
  const sent = [], alerts = [];
  return {
    db, sent, alerts,
    deps: {
      loadOpen: async () => ({ rows: [...db.values()].filter((r) => ["queued", "sending", "sent", "reminding"].includes(r.status)) }),
      loadClients: async () => [{ id: "c1", data: CLIENT }],
      loadOptOuts: async () => [...db.values()].filter((r) => r.opted_out_at),
      loadHistory: async () => [...db.values()].filter((r) => r.sent_at || r.reminded_at),
      claim: async (id, from, to, at) => {
        const r = db.get(id);
        if (claimFails.has(id) || !r || r.status !== from) return false;
        r.status = to; r.claimed_at = at; return true;
      },
      update: async (id, patch, expect) => { const r = db.get(id); if (r && r.status === expect) Object.assign(r, patch); },
      send: async (m) => { if (sendFails.has(m.to)) throw new Error("Resend 500"); sent.push(m); },
      alert: async (a) => alerts.push(a),
      reportsFrom: "BoldLine Media <hello@boldlinemedia.com>", base: "https://boldlinemedia.netlify.app",
    },
  };
};
await t("sender", async () => {
  const w = fakeWorld([row({ id: "a", email: "a@x.com" }), row({ id: "b", email: "b@x.com" })]);
  const res = await runReviewSends({ ...w.deps, now: NOON });
  ok("both queued customers get one email each", res.sent === 2 && w.sent.length === 2 && w.db.get("a").status === "sent");
  const m = w.sent[0];
  ok("🔴 every send carries its idempotency key", m.idempotencyKey === "review-a-first");
  ok("one-tap unsubscribe headers are set", /review-optout\?t=/.test(m.headers["List-Unsubscribe"]) && m.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  ok("replies go to the business owner, not to BoldLine", m.replyTo === "owner@springbok.com");
  const again = await runReviewSends({ ...w.deps, now: NOON + 15 * 60e3 });
  ok("🔴 the next run sends nothing more (no double email)", again.sent === 0 && w.sent.length === 2);
  const later = await runReviewSends({ ...w.deps, now: NOON + 3 * DAY + 60e3 });
  ok("three days later, one reminder each", later.reminded === 2 && w.sent.length === 4 && w.sent[2].idempotencyKey === "review-a-reminder");
  await runReviewSends({ ...w.deps, now: NOON + 6 * DAY });
  ok("and nothing after that, ever", w.sent.length === 4 && w.db.get("a").status === "reminded");
});
await t("sender: lost claim", async () => {
  const w = fakeWorld([row({ id: "c", email: "c@x.com" })], { claimFails: new Set(["c"]) });
  await runReviewSends({ ...w.deps, now: NOON });
  ok("🔴 a row another run already claimed is not sent by this one", w.sent.length === 0);
});
await t("sender: night", async () => {
  const w = fakeWorld([row({ id: "d", email: "d@x.com" })]);
  const res = await runReviewSends({ ...w.deps, now: NIGHT });
  ok("nothing goes out at 11pm", w.sent.length === 0 && /window/.test(res.skipped || "") && w.db.get("d").status === "queued");
});
await t("sender: failures", async () => {
  const w = fakeWorld([row({ id: "e", email: "e@x.com" })], { sendFails: new Set(["e@x.com"]) });
  await runReviewSends({ ...w.deps, now: NOON });
  ok("a failed send goes back in line with the reason", w.db.get("e").status === "queued" && w.db.get("e").attempts === 1 && /500/.test(w.db.get("e").last_error));
  await runReviewSends({ ...w.deps, now: NOON + 15 * 60e3 });
  await runReviewSends({ ...w.deps, now: NOON + 30 * 60e3 });
  ok("after three, it stops and Bryson is told once", w.db.get("e").status === "failed" && w.alerts.length === 1 && /failing/.test(w.alerts[0].title));
});
await t("sender: no table yet", async () => {
  const res = await runReviewSends({ ...fakeWorld([]).deps, loadOpen: async () => ({ missingTable: true }), now: NOON });
  ok("before the one-time setup, the job is quiet instead of alerting every 15 minutes", res.skipped === "table not set up");
});

// ── 7. The owner endpoint, with a fake Supabase ─────────────────────────────────────────────
const fakeSupabase = (clientData, existing = [], { missing = false } = {}) => {
  const inserted = [];
  const q = (table) => {
    const st = { table, filters: [], op: "select", payload: null };
    const api = {
      select() { return api; }, eq(k, v) { st.filters.push([k, v]); return api; }, in() { return api; }, order() { return api; }, limit() { return api; },
      insert(rows) { st.op = "insert"; st.payload = rows; return api; },
      update(p) { st.op = "update"; st.payload = p; return api; },
      maybeSingle() { return Promise.resolve({ data: clientData ? { id: "c1", data: clientData } : null, error: null }); },
      then(res, rej) {
        if (missing && table === "review_requests") return Promise.resolve({ data: null, error: { code: "42P01", message: 'relation "review_requests" does not exist' } }).then(res, rej);
        if (st.op === "insert") { inserted.push(...st.payload); return Promise.resolve({ data: null, error: null }).then(res, rej); }
        if (st.op === "update") return Promise.resolve({ data: [{ id: "x" }], error: null }).then(res, rej);
        return Promise.resolve({ data: existing, error: null }).then(res, rej);
      },
    };
    return api;
  };
  return { inserted, from: q };
};
const post = (qs, body) => new Request("https://x/.netlify/functions/review-requests?client=c1&" + qs, { method: "POST", body: JSON.stringify(body) });
await t("endpoint", async () => {
  const sb = fakeSupabase(CLIENT, [{ email: "recent@x.com", status: "sent", created_at: new Date(NOON - DAY).toISOString() }]);
  const r = await (await handle(post("action=add", { text: "Jane, jane@x.com\nrecent@x.com\nbad line" }), { supabase: sb, now: NOON })).json();
  ok("adding queues the new one and explains the two skipped", r.ok && r.added === 1 && r.skipped.length === 2, JSON.stringify(r));
  ok("🔴 adding only queues, it never sends", sb.inserted.length === 1 && sb.inserted[0].status === "queued" && /^[a-f0-9]{36}$/.test(sb.inserted[0].token));
  const noLink = await (await handle(post("action=add", { text: "a@x.com" }), { supabase: fakeSupabase({ ...CLIENT, googleReviewUrl: "" }), now: NOON })).json();
  ok("🔴 no review link, nothing queued", !noLink.ok && /review link/.test(noLink.error));
  const setup = await (await handle(new Request("https://x/?client=c1&action=list"), { supabase: fakeSupabase(CLIENT, [], { missing: true }) })).json();
  ok("before the one-time setup, the screen is told exactly that", setup.needsSetup === true);
});
const src = readFileSync(join(ROOT, "netlify/functions/review-requests.mjs"), "utf8");
ok("🔴 the owner endpoint has no way to send an email", !/api\.resend\.com|sendEmail|runReviewSends/.test(src));

// ── 8. The unsubscribe page ─────────────────────────────────────────────────────────────────
await t("opt-out", async () => {
  const outs = [];
  const db = { findByToken: async (tk) => tk === "ab".repeat(18) ? { client_id: "c1", email: "jane@x.com" } : null,
    client: async () => CLIENT, optOut: async (c, e, at) => outs.push([c, e, at]) };
  const u = "https://x/.netlify/functions/review-optout?t=" + "ab".repeat(18);
  const g = await handleOptOut(new Request(u), db, NOON);
  const gHtml = await g.text();
  ok("🔴 opening the link does NOT unsubscribe (email scanners open every link)", outs.length === 0 && /<form method="post">/.test(gHtml));
  ok("the page names the business, not BoldLine", /Springbok Wellness/.test(gHtml) && !/BoldLine/i.test(gHtml));
  const p = await handleOptOut(new Request(u, { method: "POST", body: "List-Unsubscribe=One-Click" }), db, NOON);
  ok("pressing the button (or Gmail's one tap) does", outs.length === 1 && outs[0][1] === "jane@x.com" && /unsubscribed/.test(await p.text()));
  const bad = await handleOptOut(new Request("https://x/?t=nope"), db, NOON);
  ok("a bad link says so and changes nothing", bad.status === 404 && outs.length === 1);
  const pages = gHtml + (await (await handleOptOut(new Request(u, { method: "POST" }), db, NOON)).text());
  ok("the page is free of dashes and emojis too", !/[—–]/.test(pages) && !/\p{Extended_Pictographic}/u.test(pages));
});

// ── 9. Wiring ───────────────────────────────────────────────────────────────────────────────
ok("the sender is scheduled", /\[functions\."review-requests-run"\]\s*\n\s*schedule = "\*\/15 \* \* \* \*"/.test(TOML));
ok("the Reviews tab exists, and not on the house account", /\["reviews","Reviews"\]/.test(UI) && /k==="log"\|\|\(isHouse\(client\)&&k==="reviews"\)/.test(UI));
ok("🔴 the screen only queues: no send path in the card", (() => { const a = UI.indexOf("function ReviewRequestsCard"); const b = UI.indexOf("\n}\n", a); const c = UI.slice(a, b); return a > 0 && !/api\.resend|action=send/.test(c) && /action=add/.test(c); })());


// ── 10. In the packages and the agreement, and the client can say no ────────────────────────
// Bryson, 2026-10-05: "add that" (one line on the packages) and "is there a safeguard incase a
// client doesnt want it so its not added into the contract".
{
  const { createRequire } = await import("node:module");
  const C = createRequire(import.meta.url)("../netlify/lib/contract-shared.cjs");
  const SITE = readSite();
  const PKG = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, leadFee: true, pricingModel: "per_lead", tier: "launch" };
  const base = { name: "Acme Pools LLC", email: "a@acme.com", packageId: "g-launch", niche: "Pool Construction", billingPerLead: 50, contactName: "Al" };
  const html = (cl) => C.makeContractHTML(cl, PKG, "");
  const listed = (cl) => /Automatic Google Review Requests/.test(html(cl));
  const clause = (cl) => /1\.4 <strong>Review requests\.<\/strong>/.test(html(cl));
  const now = new Date().toISOString();

  ok("a new agreement lists it, with the clause that lets them switch it off", listed(base) && clause(base) && /switch review requests off at any time/.test(html(base)));
  ok("🔴 an agreement SIGNED before it existed does not gain the line (Sebastian, signed 30 Aug)",
    !listed({ ...base, contractSigned: true, contractSignedAt: "2026-08-30T20:00:00Z" }) && !clause({ ...base, contractSigned: true, contractSignedAt: "2026-08-30T20:00:00Z" }));
  ok("🔴 nor one already SENT before it existed (Springbok, sent 28 Sep)", !listed({ ...base, docusignSentAt: "2026-09-28T23:00:00Z" }));
  ok("🔴 a client who said no before it went out: no line, no clause", !listed({ ...base, declinedFeatures: ["review_requests"] }) && !clause({ ...base, declinedFeatures: ["review_requests"] }));
  ok("🔴 saying no AFTER it went out does not rewrite what they were sent",
    listed({ ...base, docusignSentAt: now, contractTermsVersion: 7, contractOmits: [], declinedFeatures: ["review_requests"] }));
  ok("and saying yes after it went out without it does not add it either",
    !listed({ ...base, docusignSentAt: now, contractTermsVersion: 7, contractOmits: ["review_requests"], declinedFeatures: [] }));
  ok("a voided envelope froze nothing: the live choice applies to the next one",
    !listed({ ...base, docusignSentAt: now, docusignStatus: "voided", contractTermsVersion: 7, contractOmits: [], declinedFeatures: ["review_requests"] }));
  ok("shops and the one-off hand-off build do not get it", !C.contractFeatureIds({ packageId: "e-growth" }).includes("review_requests") && !C.contractFeatureIds({ packageId: "h-handoff" }).includes("review_requests"));
  ok("every ads package does", ["g-launch", "g-growth", "g-acquisition", "m-launch", "m-growth", "m-acquisition", "c-growth", "c-acquisition"].every((id) => C.contractFeatureIds({ packageId: id }).includes("review_requests")));
  ok("the newest terms are version 7", C.TERMS_CURRENT === 7 && C.termsVersionOf({}) === 7);

  // The OS's own copy must decide exactly the same.
  const blk = (a, b) => UI.slice(UI.indexOf(a), UI.indexOf(b, UI.indexOf(a)) + b.length);
  const os = new Function(blk("const PKG_FEATURES = {", "\n};") + "\n" + blk("const TERMS_V2_FROM", "&& off.indexOf(fid) < 0);\n}") + "\nreturn { contractFeatureIds };")();
  const cases = [base, { ...base, declinedFeatures: ["review_requests"] }, { ...base, contractSigned: true, contractSignedAt: "2026-08-30T20:00:00Z" },
    { ...base, docusignSentAt: now, contractTermsVersion: 7, contractOmits: [], declinedFeatures: ["review_requests"] }, { packageId: "e-growth" }];
  ok("🔴 the OS and the client portal's agreement agree on every case", cases.every((c) => JSON.stringify(os.contractFeatureIds(c)) === JSON.stringify(C.contractFeatureIds(c))));
  ok("sending freezes the client's choice onto the record", /contractTermsVersion:termsVersionOf\(client\),contractOmits:\(Array\.isArray\(client\.declinedFeatures\)/.test(UI));
  ok("the client portal lists what THEIR agreement says", /const inclIds = contractFeatureIds\(cl\);/.test(readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8")));

  // The switch, end to end.
  const declinedClient = { ...CLIENT, declinedFeatures: ["review_requests"] };
  const r = await (await handle(post("action=add", { text: "a@x.com" }), { supabase: fakeSupabase(declinedClient), now: NOON })).json();
  ok("🔴 the server refuses to queue for a client who said no", !r.ok && /said no/.test(r.error));
  const p = R.planReviewSends([row({}), row({ status: "sent", sent_at: new Date(NOON - 4 * DAY).toISOString() })], { clientsById: { c1: declinedClient }, now: NOON });
  ok("🔴 and anything already queued is stopped, reminders included", p.sends.length === 0 && p.stops.length === 2 && p.stops.every((x) => x.reason === "declined"));
  ok("the Reviews tab has the switch, and it disables the button", /doesn't want review requests/.test(UI) && /disabled=\{busy\|\|!savedLink\|\|declined\}/.test(UI));

  // The site: one line on every ads package, none on the shop packages.
  const cardsWith = (SITE.match(/<li>Automatic Google review requests<\/li>/g) || []).length;
  ok("the website shows it on all 8 ads packages and not on the 3 shop ones", cardsWith === 8);
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-review-requests: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
