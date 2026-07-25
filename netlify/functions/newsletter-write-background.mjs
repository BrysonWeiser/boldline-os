// Long-running AI work for the newsletter (Netlify runs *-background functions
// async, up to 15 min — a Claude call is past the ~10s sync limit). Same
// owner-JWT gate. The OS calls this, then polls newsletter-admin `list` until
// the new/changed email appears. Actions: generate (companion draft for the
// latest post) | regenerate (rewrite one email from its post).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { ensureCompanionDraft, generateNewsletterEmail } from "../lib/newsletter-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing config" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const action = String(body.action || "generate");

  try {
    if (action === "generate") {
      const row = await ensureCompanionDraft(supabase);
      return json({ ok: true, action, email: row, note: row ? undefined : "The latest post already has a companion email." });
    }

    if (action === "regenerate") {
      if (!body.id) return json({ ok: false, error: "id required" }, 400);
      const { data: em, error } = await supabase.from("newsletter_emails").select("*").eq("id", body.id).single();
      if (error) throw error;
      if (em.status === "sent") return json({ ok: false, error: "Can't rewrite an email that already sent." }, 400);
      const { data: post, error: pErr } = await supabase
        .from("blog_posts").select("slug, title, category, excerpt, meta_description").eq("slug", em.post_slug).single();
      if (pErr || !post) return json({ ok: false, error: "The linked blog post no longer exists." }, 400);
      const fresh = await generateNewsletterEmail(post);
      const { data, error: upErr } = await supabase.from("newsletter_emails")
        .update({ subject: fresh.subject, preview: fresh.preview, body_html: fresh.body_html, source: "ai" })
        .eq("id", body.id).select().single();
      if (upErr) throw upErr;
      return json({ ok: true, action, email: data });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("newsletter-write-background error:", e && e.message);
    return json({ ok: false, error: (e && e.message) || "Generation failed" }, 500);
  }
};
