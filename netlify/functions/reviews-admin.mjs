// Review moderation for the OS (owner-JWT gated, same auth as blog-admin). Powers
// the ReviewsManagementCard in the Website tab. Actions:
//   list        -> all reviews (newest first) for the moderation queue
//   set-status  -> approve / reject / send back to pending  ({id, status})
//   feature     -> pin/unpin a review to the top of the site ({id, featured})
//   delete      -> remove a review ({id})
// Only 'approved' reviews are served to the public site (reviews-list on the
// marketing site). Same Supabase project, so both read/write the reviews table.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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
    if (action === "list") {
      const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ ok: true, reviews: data || [] });
    }
    if (action === "set-status") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!id || !["pending", "approved", "rejected"].includes(status)) return json({ ok: false, error: "bad args" }, 400);
      const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "feature") {
      const id = String(body.id || "");
      if (!id) return json({ ok: false, error: "bad args" }, 400);
      const { error } = await supabase.from("reviews").update({ featured: !!body.featured }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ ok: false, error: "bad args" }, 400);
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/relation|does not exist|schema cache|could not find/i.test(msg)) {
      return json({ ok: false, error: "Run docs/sql/reviews-schema.sql in Supabase once, then reload." }, 500);
    }
    console.error("reviews-admin failed:", msg);
    return json({ ok: false, error: msg }, 500);
  }
};
