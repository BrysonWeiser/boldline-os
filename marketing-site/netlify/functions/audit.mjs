// Free "Lead-Leak Check" request capture for boldlinemedia.com.
// A low-friction lead magnet: the visitor submits their website + email, and we
// save it as a lead (website_leads, form:"lead_leak") so the owner sees it in
// the OS Leads screen and follows up with the mini-audit. Mirrors subscribe.mjs:
// AJAX JSON POST, honeypot, email validation, service-role insert, fail-soft.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const OWNER_EMAIL = process.env.OWNER_EMAIL || "theboldlinemedia@gmail.com";
const GOLD = "#C8A84B";
const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Instant owner alert the moment someone requests a Lead-Leak Check. This fires
// regardless of the audit bot, so an unset secret, out-of-credits Anthropic
// account, or an unreachable prospect site all still leave the owner notified.
// The full audit sent to the prospect ALSO lands in the owner's inbox ~1 min
// later as a copy (from the OS bot). Dormant until a verified sender is set.
const notifyOwnerNewRequest = async ({ website, email, name }) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) return;
  const rows = [["Website", website], ["Email", email], ["Name", name]].filter(([, v]) => v && String(v).trim());
  const rowsHTML = rows.map(([k, v]) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#6B7280;font-size:11px;letter-spacing:.5px;text-transform:uppercase;width:34%;vertical-align:top">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#F5F3ED;font-size:14px;line-height:1.5;vertical-align:top">${k === "Email" ? `<a href="mailto:${esc(v)}" style="color:${GOLD};text-decoration:none">${esc(v)}</a>` : esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0c11">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c11;padding:28px 14px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12141b;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Arial,sans-serif">
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,.08)"><span style="font-size:13px;font-weight:bold;letter-spacing:2.5px;color:${GOLD};text-transform:uppercase">BoldLine Media</span></td></tr>
      <tr><td style="padding:30px 28px 4px">
        <span style="display:inline-block;background:rgba(200,168,75,.14);color:${GOLD};font-size:10.5px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:6px 13px;border-radius:20px">New Lead-Leak Check</span>
        <h1 style="margin:16px 0 4px;font-size:22px;color:#fff;font-weight:bold">Someone requested a free audit.</h1>
        <p style="margin:0;color:#9CA3AF;font-size:12.5px">The automated audit is generating now &mdash; a copy will land in your inbox in about a minute.</p>
      </td></tr>
      <tr><td style="padding:16px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHTML}</table></td></tr>
      <tr><td style="padding:20px 28px 30px">${email ? `<a href="mailto:${esc(email)}?subject=${encodeURIComponent("Your free Lead-Leak Check from BoldLine Media")}" style="display:inline-block;background:${GOLD};color:#15110A;font-weight:bold;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:10px">Reply to ${esc(name || "this lead")}</a>` : ""}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.015)"><p style="margin:0;color:#6B7280;font-size:11px;line-height:1.6">This request came in through the Lead-Leak Check on boldlinemedia.com and is now in your OS Leads section.</p></td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = `Someone requested a free Lead-Leak Check.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nThe automated audit is generating now; a copy will arrive in your inbox shortly.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL, to: [OWNER_EMAIL], subject: `New Lead-Leak Check request${name ? " — " + name : website ? " — " + website : ""}`, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }

  // Honeypot: real users never fill the hidden "company" field.
  if (body.company) return json({ ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "Please enter a valid email address." }, 400);
  const website = String(body.website || "").trim().slice(0, 300);
  const name = String(body.name || "").trim().slice(0, 120);
  const source = String(body.source || "lead-leak-check").slice(0, 60);

  // Durable capture as a lead the owner works in the OS (form:"lead_leak" is NOT
  // filtered out of the sales-Leads list, unlike newsletter rows). Fail-soft so
  // the visitor always gets a success response for a valid email.
  let leadId = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data, error } = await supabase.from("website_leads").insert({
        form: "lead_leak", email, name,
        payload: { website, name, source, kind: "Lead-Leak Check request" },
      }).select("id").single();
      if (error) throw error;
      leadId = data && data.id;
    } catch (e) {
      console.error("lead-leak capture failed:", e && e.message);
    }
  }

  // Instant owner alert (best-effort). Fires on every valid request, even if the
  // capture or the audit bot fails, so the owner is always notified something
  // came in. Never blocks or fails the visitor's response.
  try { await notifyOwnerNewRequest({ website, email, name }); }
  catch (e) { console.error("lead-leak owner alert failed:", e && e.message); }

  // Fire the automated Lead-Leak Check bot (best-effort). It lives on the OS
  // site as a Netlify *-background* function, so it returns 202 immediately and
  // does the slow fetch + AI + email work asynchronously — the visitor never
  // waits on it. Guarded by a shared secret set on both sites; if the secret
  // isn't set the bot simply doesn't run and the lead is handled manually.
  if (leadId && process.env.AUDIT_TRIGGER_SECRET) {
    const osOrigin = process.env.OS_ORIGIN || "https://boldlinemedia.netlify.app";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      await fetch(`${osOrigin}/.netlify/functions/lead-leak-audit-background`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, website, email, name, secret: process.env.AUDIT_TRIGGER_SECRET }),
        signal: ctrl.signal,
      }).catch(() => {});
      clearTimeout(timer);
    } catch { /* fire-and-forget: never block or fail the visitor's response */ }
  }

  return json({ ok: true });
};
