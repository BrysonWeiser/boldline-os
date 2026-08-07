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
