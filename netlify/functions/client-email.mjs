// Owner-only backend for the client-email center (OS "Emails" tab).
// Renders a branded dark-theme lifecycle email filled with a client's specifics
// (preview), and sends it to the client on one click. Same owner-JWT gate as
// blog-admin/newsletter-admin. Sending reuses report-shared.sendEmail (Resend),
// which already delivers client reports — so no new config is required.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail } from "../lib/report-shared.mjs";
import { EMAIL_TYPES, renderClientEmail } from "../lib/client-emails-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const action = String(body.action || "");

  try {
    if (action === "types") {
      return json({ ok: true, action, types: EMAIL_TYPES });
    }

    if (action === "render") {
      if (!body.type) return json({ ok: false, error: "type required" }, 400);
      const { subject, html } = renderClientEmail(body.type, body.ctx || {});
      return json({ ok: true, action, subject, html });
    }

    if (action === "send") {
      if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL)
        return json({ ok: false, error: "Email sending isn't configured yet (RESEND_API_KEY / REPORTS_FROM_EMAIL)." }, 400);
      const to = String(body.to || "");
      if (!isEmail(to)) return json({ ok: false, error: "The client has no valid email on file." }, 400);
      const subject = String(body.subject || "").trim();
      const html = String(body.html || "");
      if (!subject || !html) return json({ ok: false, error: "Nothing to send — subject and body are required." }, 400);
      await sendEmail({ to, subject, html });
      return json({ ok: true, action, to });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("client-email error:", e && e.message);
    return json({ ok: false, error: (e && e.message) || "Request failed" }, 500);
  }
};
