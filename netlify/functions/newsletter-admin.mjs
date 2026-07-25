// Owner panel backend for the weekly newsletter. Same owner-JWT gate as
// blog-admin. Quick DB actions + subscriber/analytics reads. AI generation runs
// in newsletter-write-background.mjs (long-running); sending runs in the
// scheduled newsletter-autopublish.mjs (or send-now here, gated).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { getSubscriberStats, sendBroadcast } from "../lib/newsletter-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const LIST_COLS = "id, post_slug, subject, preview, status, scheduled_for, sent_at, recipients, source, created_at";

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
  const action = String(body.action || "list");

  try {
    if (action === "list") {
      const { data, error } = await supabase
        .from("newsletter_emails").select(LIST_COLS)
        .neq("status", "deleted")
        .order("scheduled_for", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return json({ ok: true, action, emails: data || [], sendingEnabled: process.env.NEWSLETTER_SENDING_ENABLED === "1" });
    }

    if (action === "get") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const { data, error } = await supabase.from("newsletter_emails").select("*").eq("id", body.id).single();
      if (error) throw error;
      return json({ ok: true, action, email: data });
    }

    if (action === "update") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const patch = {};
      for (const k of ["subject", "preview", "body_html"]) if (body[k] != null) patch[k] = String(body[k]);
      if (!Object.keys(patch).length) return json({ ok: false, error: "nothing to update" }, 400);
      patch.source = "manual";
      const { data, error } = await supabase.from("newsletter_emails").update(patch).eq("id", body.id).select(LIST_COLS).single();
      if (error) throw error;
      return json({ ok: true, action, email: data });
    }

    if (action === "reschedule") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const when = new Date(body.when || "");
      if (isNaN(when) || when.getTime() <= Date.now()) return json({ ok: false, error: "Pick a valid future date/time" }, 400);
      const { data, error } = await supabase.from("newsletter_emails")
        .update({ scheduled_for: when.toISOString(), status: "scheduled" })
        .eq("id", body.id).neq("status", "sent").select(LIST_COLS).single();
      if (error) throw error;
      return json({ ok: true, action, email: data });
    }

    if (action === "delete") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const { error } = await supabase.from("newsletter_emails").update({ status: "deleted" }).eq("id", body.id);
      if (error) throw error;
      return json({ ok: true, action });
    }

    if (action === "send-now") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      if (process.env.NEWSLETTER_SENDING_ENABLED !== "1")
        return json({ ok: false, error: "Sending is off until boldlinemedia.com is verified in Resend (set NEWSLETTER_SENDING_ENABLED=1 after that)." }, 400);
      const { data: em, error } = await supabase.from("newsletter_emails").select("*").eq("id", body.id).single();
      if (error) throw error;
      if (em.status === "sent") return json({ ok: false, error: "Already sent." }, 400);
      const res = await sendBroadcast(em);
      const { data, error: upErr } = await supabase.from("newsletter_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipients: res.recipients || null, resend_broadcast_id: res.broadcastId || null })
        .eq("id", body.id).select(LIST_COLS).single();
      if (upErr) throw upErr;
      return json({ ok: true, action, email: data });
    }

    if (action === "subscribers") {
      const stats = await getSubscriberStats(supabase);
      return json({ ok: true, action, ...stats });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("newsletter-admin error:", e && e.message);
    return json({ ok: false, error: (e && e.message) || "Request failed" }, 500);
  }
};
