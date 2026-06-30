// Netlify automatically calls a function named "submission-created" whenever a
// verified form submission comes in. We use it to (1) save the lead into the OS
// database so it shows up in the OS "Leads" section, and (2) send an on-brand
// HTML email to the BoldLine inbox (instead of Netlify's plain default).
//
// Sends via Resend, reusing the same env vars as the OS:
//   RESEND_API_KEY      - Resend API key (secret; set in Netlify env, never in repo). REQUIRED.
//   REPORTS_FROM_EMAIL  - optional verified "from" address; falls back to Resend's
//                         onboarding@resend.dev (which delivers to the Resend account's
//                         own email, i.e. theboldlinemedia@gmail.com).
// DB save uses SUPABASE_SERVICE_ROLE_KEY (already set for the blog functions),
// which bypasses RLS. Both steps are best-effort: one failing never blocks the
// other, and the submission is always still stored in Netlify's Forms tab.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const OWNER_EMAIL = "theboldlinemedia@gmail.com";
const GOLD = "#C8A84B";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Pretty labels for the fields we know; anything else gets title-cased.
const LABELS = {
  name: "Name",
  business: "Business",
  email: "Email",
  message: "Biggest challenge",
  recommended: "Recommended package",
};
const prettyLabel = (k) =>
  LABELS[k] || k.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Fields we never show in the email / store as columns.
const HIDDEN = new Set(["form-name", "bot-field"]);

const clean = (v) => (v == null ? null : (String(v).trim() || null));

const saveLead = async (formName, data) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("website_leads").insert({
    form: formName,
    name: clean(data.name),
    business: clean(data.business),
    email: clean(data.email),
    message: clean(data.message),
    recommended: clean(data.recommended),
    payload: data,
  });
  if (error) throw error;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL || "BoldLine Media <onboarding@resend.dev>", to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
};

const fieldRow = (label, valueHTML) => `
  <tr>
    <td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#6B7280;font-size:11px;letter-spacing:.5px;text-transform:uppercase;width:38%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#F5F3ED;font-size:14px;line-height:1.5;vertical-align:top;">${valueHTML}</td>
  </tr>`;

const buildHTML = ({ badge, heading, when, rowsHTML, replyHTML }) => `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0a0c11;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c11;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12141b;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Arial,sans-serif;">
        <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,.08);">
          <span style="font-size:13px;font-weight:bold;letter-spacing:2.5px;color:${GOLD};text-transform:uppercase;">BoldLine Media</span>
        </td></tr>
        <tr><td style="padding:30px 28px 4px;">
          <span style="display:inline-block;background:rgba(200,168,75,.14);color:${GOLD};font-size:10.5px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:6px 13px;border-radius:20px;">${esc(badge)}</span>
          <h1 style="margin:16px 0 4px;font-size:22px;color:#ffffff;font-weight:bold;">${esc(heading)}</h1>
          <p style="margin:0;color:#9CA3AF;font-size:12.5px;">Submitted ${esc(when)}</p>
        </td></tr>
        <tr><td style="padding:16px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHTML}</table>
        </td></tr>
        ${replyHTML ? `<tr><td style="padding:20px 28px 30px;">${replyHTML}</td></tr>` : `<tr><td style="height:14px;"></td></tr>`}
        <tr><td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.015);">
          <p style="margin:0;color:#6B7280;font-size:11px;line-height:1.6;">This lead came in through boldlinemedia.com and is now in your OS Leads section. Replying within a few minutes gives you the best shot at winning the job.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const emailOwner = async (formName, data, createdAt) => {
  if (!process.env.RESEND_API_KEY) {
    console.log("submission-created: RESEND_API_KEY not set, skipping branded email");
    return;
  }
  const isQuiz = formName === "recommendation";
  const badge = isQuiz ? "Quiz Lead" : "New Website Lead";
  const heading = isQuiz ? "Someone used the package finder." : "Someone wants to talk.";

  let when;
  try {
    when = new Date(createdAt || Date.now()).toLocaleString("en-US", {
      timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }) + " (AZ)";
  } catch { when = "just now"; }

  const order = ["name", "business", "email", "recommended", "message"];
  const keys = [...new Set([...order, ...Object.keys(data)])]
    .filter((k) => !HIDDEN.has(k) && data[k] != null && String(data[k]).trim() !== "");

  const email = (data.email || "").trim();
  const rowsHTML = keys.map((k) => {
    const v = String(data[k]).trim();
    const valueHTML = k === "email"
      ? `<a href="mailto:${esc(v)}" style="color:${GOLD};text-decoration:none;">${esc(v)}</a>`
      : esc(v).replace(/\n/g, "<br>");
    return fieldRow(prettyLabel(k), valueHTML);
  }).join("");

  const replyHTML = email
    ? `<a href="mailto:${esc(email)}?subject=${encodeURIComponent("Re: your message to BoldLine Media")}" style="display:inline-block;background:${GOLD};color:#15110A;font-weight:bold;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:10px;">Reply to ${esc(data.name || "this lead")}</a>`
    : "";

  const text = `${heading}\nSubmitted ${when}\n\n${keys.map((k) => `${prettyLabel(k)}: ${String(data[k]).trim()}`).join("\n")}`;

  await sendEmail({
    to: OWNER_EMAIL,
    subject: isQuiz
      ? `New quiz lead${data.recommended ? `: ${data.recommended}` : ""}`
      : `New website lead: ${data.name || data.business || data.email || "someone"}`,
    html: buildHTML({ badge, heading, when, rowsHTML, replyHTML }),
    text,
  });
};

export const handler = async (event) => {
  let payload = {};
  try { payload = (JSON.parse(event.body || "{}")).payload || {}; }
  catch (e) { console.error("submission-created: unparseable body:", e && e.message); return { statusCode: 200, body: "bad body" }; }
  const data = payload.data || {};
  const formName = payload.form_name || "form";

  // Both steps are best-effort and independent: a failure in one is logged but
  // never blocks the other, and never fails the submission (always return 200).
  const results = await Promise.allSettled([
    saveLead(formName, data),
    emailOwner(formName, data, payload.created_at),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`submission-created ${i === 0 ? "DB save" : "email"} failed:`, r.reason && r.reason.message);
    }
  });

  return { statusCode: 200, body: "ok" };
};
