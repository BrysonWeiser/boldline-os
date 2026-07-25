// Major-issue alerting for BoldLine OS (Bryson, 2026-07-25: "if something major
// comes up I should get an alert about it" — via SMS + email + in-app).
//
// This module is the PUSH side (SMS + email) shared by the watchers. The IN-APP
// side is derived live in index.html's getAlerts() from the same stored client
// fields, so nothing needs to be persisted for an alert to show in the bell.
//
// dispatchAlert is fail-soft on every channel: one channel failing (e.g. the
// Twilio trial A2P block) never stops the others, and never throws.

import { sendEmail, sendSMS, GOLD, escapeHTML } from "./report-shared.mjs";

const alertEmailHTML = ({ title, body, severity }) => {
  const bar = severity === "red" ? "#DC2626" : "#D97706";
  const lines = String(body).split("\n").filter(Boolean)
    .map((l) => `<p style="margin:0 0 10px;line-height:1.6;color:#1F2937">${escapeHTML(l)}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:16px;text-align:center">
    <div style="font-size:15px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="font-size:11px;color:#6B7280;margin-top:6px">Automated Alert</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-left:4px solid ${bar};border-radius:12px;padding:22px 22px">
    <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:12px">${escapeHTML(title)}</div>
    ${lines}
  </div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Sent automatically by BoldLine OS because something needs your attention.</div>
</div>
</body></html>`;
};

// One call = email + SMS. severity: "red" | "yellow". smsText keeps the text
// short; falls back to the title. Returns per-channel status; never throws.
export const dispatchAlert = async ({ title, body = "", severity = "red", smsText }) => {
  const result = {};
  const icon = severity === "red" ? "🔴" : "⚠️";

  if (process.env.RESEND_API_KEY && process.env.REPORTS_FROM_EMAIL && process.env.OWNER_EMAIL) {
    try {
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: `${icon} BoldLine Alert — ${title}`,
        html: alertEmailHTML({ title, body, severity }),
        text: `${title}\n\n${body}`,
      });
      result.email = "sent";
    } catch (e) { result.email = "failed"; console.error("dispatchAlert email failed:", e.message); }
  } else { result.email = "skipped (email not configured)"; }

  try {
    await sendSMS({ to: process.env.OWNER_PHONE, body: (smsText || `BoldLine: ${title}`).slice(0, 300) });
    result.sms = "sent";
  } catch (e) { result.sms = "failed"; console.error("dispatchAlert sms failed:", e.message); }

  return result;
};

// Wrap a scheduled-job handler so any unhandled failure becomes a "system /
// integration failure" alert (Bryson asked for these) instead of a silent
// outage. Re-throws after alerting so Netlify still records the failure.
export const withFailureAlert = (jobName, handler) => async (...args) => {
  try {
    return await handler(...args);
  } catch (err) {
    const msg = String((err && err.message) || err);
    console.error(`${jobName} crashed:`, msg);
    await dispatchAlert({
      title: `${jobName} failed to run`,
      body: `The scheduled "${jobName}" job hit an error and did not finish:\n${msg}\nCheck the Netlify function logs.`,
      severity: "red",
      smsText: `BoldLine: ${jobName} job FAILED — ${msg.slice(0, 120)}`,
    });
    return new Response("job failed", { status: 500 });
  }
};
