// Review requests: after a job, ask the client's customer for a Google review, by email.
//
// Bryson, 2026-10-05, after a car detailer told him his agency also manages his Google listing:
// "yea lets do that" to building review requests as BoldLine's first add-on. Email first, because
// texting is off (Twilio trial) and business texting has to be registered per client (KB
// `client-text-back`). Email works today: boldlinemedia.com is verified in Resend.
//
// EVERY RULE LIVES HERE, as pure functions, so the endpoint, the scheduled sender and the tests
// cannot disagree. The functions in netlify/functions only read, claim, send and write.
//
// 🔴 THE FOUR THINGS THIS MUST NEVER DO, each with a test:
//  1. EMAIL ONE PERSON TWICE FOR ONE ASK. A row is CLAIMED (conditional update) before it is sent,
//     and every send carries an idempotency key, so even a retry after a crash is one email.
//  2. EMAIL SOMEONE WHO UNSUBSCRIBED. An opt-out blocks that address for that client forever, at
//     add time AND at send time (belt and braces: the legal problem is the second one).
//  3. GATE REVIEWS. Google bans asking only happy customers or screening first ("how did we do?",
//     a star picker that only sends 4s and 5s to Google). Everyone gets the same email with one
//     link straight to Google. No incentives either: Google and the FTC both ban paying for reviews.
//  4. EAT THE DAILY EMAIL ALLOWANCE. Resend's free plan is 100 emails a day for EVERYTHING the OS
//     sends, client emails included. A pasted list of 300 past customers goes out over days.

export const REMIND_AFTER_DAYS = 3;          // one reminder, three days after the first email
export const RECENT_ASK_DAYS = 90;           // a repeat customer is not asked again within this
export const MAX_ATTEMPTS = 3;               // a send that fails this many times stops trying
export const STUCK_AFTER_MIN = 30;           // a claim older than this crashed mid-send
export const MAX_PER_ADD = 300;              // one paste
export const DEFAULT_DAILY_CAP = 40;         // across every client, leaves room for client emails
export const DEFAULT_CLIENT_DAILY_CAP = 20;  // one client's backlog cannot starve the others
export const SEND_WINDOW = { startHour: 10, endHour: 18 }; // Phoenix clock; 9am to 8pm across the US

const DAY = 864e5;
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;

export const normEmail = (s) => {
  const e = String(s || "").trim().toLowerCase().replace(/^mailto:/, "");
  return EMAIL_RE.test(e) ? e : "";
};

// ── The Google review link ────────────────────────────────────────────────────────────────
// 🔴 ONLY GOOGLE. The button in a customer's inbox goes wherever this says, so a typo'd or pasted
// wrong link (the client's own site, a BoldLine page, anything) is refused rather than mailed out.
const REVIEW_HOSTS = [/^g\.page$/, /^(www\.)?google\.[a-z.]{2,6}$/, /^(search|maps|business)\.google\.com$/, /^maps\.app\.goo\.gl$/, /^goo\.gl$/];
export const normReviewUrl = (raw) => {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:") return "";
  const host = u.hostname.toLowerCase();
  if (!REVIEW_HOSTS.some((re) => re.test(host))) return "";
  if (u.pathname === "/" && !u.search) return "";   // google.com on its own is not a review link
  return u.toString();
};

// The name the customer sees in their inbox. A legal name ("Springbok Chiropractic, LLC") is not
// what a patient knows the business as, so there is a separate field and the suffix is dropped.
export const senderName = (client) => {
  const raw = String((client && (client.reviewSenderName || client.name)) || "").trim();
  return raw.replace(/,?\s+(LLC|L\.L\.C\.|Inc\.?|PLLC|LLP|Corp\.?|Co\.)$/i, "").trim() || "Our team";
};

// Health businesses: a patient's email in a vendor's hands is protected health information.
export const isHealthBusiness = (client) =>
  /chiro|dental|dentist|orthodon|med ?spa|medical|clinic|therap|physio|wellness|dermatolog|optom|audiolog|\baba\b|counsel|psych|doctor|physician|pharm|hospice|home health/i
    .test(`${(client && client.niche) || ""} ${(client && client.name) || ""}`);

// ── Reading a pasted list ─────────────────────────────────────────────────────────────────
// One customer per line, in whatever shape he copies it in: "Jane Doe, jane@x.com",
// "jane@x.com", "Jane Doe <jane@x.com>", tab separated from a spreadsheet, or with a phone column.
export const parseCustomers = (text) => {
  const out = [], bad = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const m = raw.match(/[^\s<>(),;"']+@[^\s<>(),;"']+/);
    const email = m ? normEmail(m[0]) : "";
    if (!email) { bad.push(raw); continue; }
    const name = raw.replace(m[0], " ").replace(/[<>()"]/g, " ").split(/[,;\t]/)
      .map((x) => x.trim()).filter((x) => x && !/^\+?[\d\s().-]{7,}$/.test(x))[0] || "";
    out.push({ name: name.slice(0, 80), email });
  }
  return { customers: out, bad };
};

// ── Who may be added ──────────────────────────────────────────────────────────────────────
// `existing` is every row already on file for THIS client. Returns what to insert and why the
// rest were skipped, in words he can act on.
export const addVerdicts = (customers, existing, { now = Date.now() } = {}) => {
  const optedOut = new Set((existing || []).filter((r) => r.opted_out_at).map((r) => normEmail(r.email)));
  const recent = new Set((existing || [])
    .filter((r) => r.status !== "failed" && now - new Date(r.created_at).getTime() < RECENT_ASK_DAYS * DAY)
    .map((r) => normEmail(r.email)));
  const seen = new Set(), add = [], skipped = [];
  for (const c of customers || []) {
    const email = normEmail(c && c.email);
    const label = (c && c.email) || "(blank)";
    if (!email) { skipped.push({ email: label, reason: "not an email address" }); continue; }
    if (seen.has(email)) { skipped.push({ email, reason: "listed twice" }); continue; }
    seen.add(email);
    if (optedOut.has(email)) { skipped.push({ email, reason: "unsubscribed, never email again" }); continue; }
    if (recent.has(email)) { skipped.push({ email, reason: `already asked in the last ${RECENT_ASK_DAYS} days` }); continue; }
    if (add.length >= MAX_PER_ADD) { skipped.push({ email, reason: `over ${MAX_PER_ADD} at once, add the rest next` }); continue; }
    add.push({ name: String((c && c.name) || "").trim().slice(0, 80), email });
  }
  return { add, skipped };
};

// ── The send window ───────────────────────────────────────────────────────────────────────
// Arizona never changes its clocks, so UTC-7 is right all year. 10am to 6pm Phoenix is 9am to
// 5pm Pacific in summer and noon to 8pm Eastern in winter: never the middle of anybody's night.
export const phoenixHour = (now) => new Date(now - 7 * 3600e3).getUTCHours();
export const inSendWindow = (now) => { const h = phoenixHour(now); return h >= SEND_WINDOW.startHour && h < SEND_WINDOW.endHour; };

// ── What to send on this run ──────────────────────────────────────────────────────────────
// `rows`: open rows (queued / sending / sent / reminding). `history`: every row with a send in the
// last 24 hours (for the caps). `clientsById`: { id: clientData }. Returns, in order:
//   sends:   [{ row, kind: "first" | "reminder", from }]   from = the status to claim it out of
//   resets:  [{ row, to }]   claims that crashed mid-send, handed back so they go again
//   stops:   [{ row, reason }] rows that can never send (client gone, opted out)
export const planReviewSends = (rows, { clientsById = {}, history = [], optedOut = new Set(), now = Date.now(),
  dailyCap = DEFAULT_DAILY_CAP, clientDailyCap = DEFAULT_CLIENT_DAILY_CAP, maxThisRun = 25 } = {}) => {
  const sends = [], resets = [], stops = [];
  const since = now - DAY;
  const sentAt = (r) => [r.sent_at, r.reminded_at].filter(Boolean).map((t) => new Date(t).getTime()).filter((t) => t > since);
  let globalUsed = 0; const perClient = {};
  for (const r of history || []) for (const _ of sentAt(r)) { globalUsed++; perClient[r.client_id] = (perClient[r.client_id] || 0) + 1; }

  const ordered = (rows || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const r of ordered) {
    const client = clientsById[r.client_id];
    const pairOut = optedOut.has(`${r.client_id}|${normEmail(r.email)}`) || !!r.opted_out_at;
    if (r.status === "sending" || r.status === "reminding") {
      const age = now - new Date(r.claimed_at || r.created_at).getTime();
      if (age > STUCK_AFTER_MIN * 60e3) resets.push({ row: r, to: r.status === "sending" ? "queued" : "sent" });
      continue;
    }
    if (pairOut) { stops.push({ row: r, reason: "opted_out" }); continue; }
    if (!client) { stops.push({ row: r, reason: "client_gone" }); continue; }
    let kind = null;
    if (r.status === "queued") kind = "first";
    else if (r.status === "sent" && r.sent_at && now - new Date(r.sent_at).getTime() >= REMIND_AFTER_DAYS * DAY) kind = "reminder";
    if (!kind) continue;
    if (!normReviewUrl(client.googleReviewUrl)) continue;  // waits, untouched, until the link is fixed
    if (sends.length >= maxThisRun) break;
    if (globalUsed >= dailyCap) break;
    if ((perClient[r.client_id] || 0) >= clientDailyCap) continue;
    sends.push({ row: r, kind, from: r.status });
    globalUsed++; perClient[r.client_id] = (perClient[r.client_id] || 0) + 1;
  }
  return { sends, resets, stops };
};

// What a row becomes after a send attempt.
export const afterSend = (row, kind, ok, error, now = Date.now()) => {
  const iso = new Date(now).toISOString();
  if (ok) return kind === "first"
    ? { status: "sent", sent_at: iso, attempts: 0, last_error: null, claimed_at: null }
    : { status: "reminded", reminded_at: iso, last_error: null, claimed_at: null };
  const attempts = (Number(row.attempts) || 0) + 1;
  const err = String(error || "send failed").slice(0, 300);
  if (attempts >= MAX_ATTEMPTS) return kind === "first"
    ? { status: "failed", attempts, last_error: err, claimed_at: null }
    : { status: "stopped", stopped_at: iso, attempts, last_error: err, claimed_at: null };
  return { status: kind === "first" ? "queued" : "sent", attempts, last_error: err, claimed_at: null };
};

// ── The email ─────────────────────────────────────────────────────────────────────────────
// Written by hand, not by a model, and checked by a test for dashes and emojis: it goes to the
// client's customers, so it is client-facing twice over (CLAUDE.md). Same words for everyone.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const firstName = (name) => {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  return /^[A-Za-z][A-Za-z'.]{0,30}$/.test(f) ? f.charAt(0).toUpperCase() + f.slice(1) : "";
};

export const fromAddress = (client, reportsFrom) => {
  const m = String(reportsFrom || "").match(/<([^>]+)>/);
  const addr = normEmail(m ? m[1] : reportsFrom);
  if (!addr) return "";
  const name = senderName(client).replace(/["<>\r\n]/g, "").slice(0, 70);
  return `"${name}" <${addr}>`;
};

export const renderReviewEmail = (client, row, kind, { unsubscribeUrl = "" } = {}) => {
  const brand = senderName(client);
  const link = normReviewUrl(client && client.googleReviewUrl);
  const hi = firstName(row && row.name) ? `Hi ${firstName(row.name)},` : "Hi there,";
  const lines = kind === "reminder"
    ? [`Just a quick follow up in case our last email got buried.`,
       `If you have a minute, a Google review would mean a lot to us. It helps other people find ${brand}.`]
    : [`Thank you for choosing ${brand}. We really appreciate your business.`,
       `If you have a minute, would you leave us a quick review on Google? It helps other people find us, and we read every one.`];
  const after = kind === "reminder" ? `If you already left one, thank you. This is the last email we'll send about it.` : `Thanks again,`;
  const subject = kind === "reminder" ? `A quick reminder from ${brand}` : `Thanks for choosing ${brand}`;
  const address = String((client && client.businessAddress) || "").trim();
  const footer = `Sent by ${brand}${address ? `, ${address}` : ""}.`;

  const text = [hi, "", ...lines.flatMap((l) => [l, ""]), `Leave a Google review: ${link}`, "", after,
    kind === "reminder" ? "" : brand, "", footer, unsubscribeUrl ? `Don't want these emails? Unsubscribe: ${unsubscribeUrl}` : ""]
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const p = (s, extra = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1F2937${extra}">${esc(s)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F5F5F4">`
    + `<div style="max-width:520px;margin:0 auto;padding:28px 22px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">`
    + `<div style="background:#FFFFFF;border-radius:12px;padding:26px 24px;border:1px solid #E7E5E4">`
    + p(hi) + lines.map((l) => p(l)).join("")
    + `<p style="margin:22px 0 22px"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#1A73E8;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none">Leave a Google review</a></p>`
    + p(after) + (kind === "reminder" ? "" : p(brand, ";font-weight:600"))
    + `</div>`
    + `<p style="margin:16px 4px 0;font-size:12px;line-height:1.6;color:#78716C">${esc(footer)}`
    + (unsubscribeUrl ? ` <a href="${esc(unsubscribeUrl)}" style="color:#78716C">Unsubscribe</a>` : "") + `</p>`
    + `</div></body></html>`;
  return { subject, html, text };
};

// The counts the OS card shows.
export const reviewStats = (rows) => {
  const s = { queued: 0, sent: 0, reminded: 0, optedOut: 0, stopped: 0, failed: 0, total: 0 };
  for (const r of rows || []) {
    s.total++;
    if (r.opted_out_at || r.status === "opted_out") s.optedOut++;
    else if (r.status === "queued" || r.status === "sending") s.queued++;
    else if (r.status === "sent" || r.status === "reminding") s.sent++;
    else if (r.status === "reminded") s.reminded++;
    else if (r.status === "stopped") s.stopped++;
    else if (r.status === "failed") s.failed++;
  }
  return s;
};

// Postgres "relation does not exist", as PostgREST reports it, so a migration nobody ran says so
// instead of looking like an outage.
export const isMissingTable = (error) => !!error && (error.code === "42P01" || error.code === "PGRST205"
  || /relation .* does not exist|could not find the table/i.test(String(error.message || "")));

export const newToken = () => {
  const b = new Uint8Array(18);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
