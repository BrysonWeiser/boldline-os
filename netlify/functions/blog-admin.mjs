// Blog admin actions — owner-authenticated management for the AI-written
// marketing blog. Mirrors the google-ads/docusign-send auth gate: any valid
// owner Supabase session is trusted, no separate role check.
//
// POST body: { action, ... }
//   "list"          -> all non-deleted posts, newest first (for the admin table).
//   "generate-now"  -> writes + publishes a brand-new AI post immediately.
//   "regenerate"    -> { postId } rewrites an existing post's content in place,
//                       same id/slug, bumped to newest.
//   "delete"        -> { postId } soft-delete (status='deleted').
//   "get-settings"  -> current posts_per_week cadence.
//   "set-cadence"   -> { postsPerWeek } updates posts_per_week.
//
// Required Netlify env vars: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { createAndPublishPost, regeneratePost } from "../lib/blog-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: owner's Supabase session (same gate as docusign-send / google-ads).
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
        .from("blog_posts")
        .select("id, slug, title, category, excerpt, status, source, read_minutes, published_at, created_at")
        .neq("status", "deleted")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return json({ ok: true, action, posts: data || [] });
    }

    if (action === "generate-now") {
      const post = await createAndPublishPost();
      return json({ ok: true, action, post });
    }

    if (action === "regenerate") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const post = await regeneratePost(body.postId);
      return json({ ok: true, action, post });
    }

    if (action === "delete") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const { error } = await supabase.from("blog_posts").update({ status: "deleted" }).eq("id", body.postId);
      if (error) throw error;
      return json({ ok: true, action });
    }

    if (action === "get-settings") {
      const { data, error } = await supabase.from("blog_settings").select("posts_per_week").eq("id", 1).single();
      if (error) throw error;
      return json({ ok: true, action, postsPerWeek: data.posts_per_week });
    }

    if (action === "set-cadence") {
      const n = Math.round(Number(body.postsPerWeek));
      if (!Number.isFinite(n) || n < 1 || n > 14) return json({ ok: false, error: "postsPerWeek must be 1-14" }, 400);
      const { error } = await supabase.from("blog_settings").update({ posts_per_week: n }).eq("id", 1);
      if (error) throw error;
      return json({ ok: true, action, postsPerWeek: n });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("blog-admin failed:", action, err && err.message);
    return json({ ok: false, error: err.message || "Blog admin request failed" }, 500);
  }
};
