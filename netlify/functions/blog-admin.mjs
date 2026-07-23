// Blog admin actions — owner-authenticated management for the AI-written
// marketing blog. Mirrors the google-ads/docusign-send auth gate: any valid
// owner Supabase session is trusted, no separate role check.
//
// POST body: { action, ... }
//   "list"          -> all non-deleted posts, newest first (for the admin table).
//                       Includes scheduled drafts (status='draft', published_at
//                       in the future = the exact go-live time).
//   "generate-now"  -> writes + publishes a brand-new AI post immediately.
//   "generate-scheduled" -> writes a new AI post as a scheduled draft at the
//                       next cadence slot (or an explicit { when }).
//   "publish-now"   -> { postId } flips a scheduled draft live immediately.
//   "reschedule"    -> { postId, when } moves a scheduled draft's go-live time.
//   "regenerate"    -> { postId } rewrites an existing post's content in place,
//                       same id/slug, bumped to newest.
//   "delete"        -> { postId } soft-delete (status='deleted').
//   "delete-all"    -> soft-deletes every non-deleted post in one shot. Used by
//                       the owner UI's "Rebuild From Scratch" flow, which then
//                       calls "generate-now" in a loop client-side to write a
//                       fresh set -- kept as two thin calls (not one slow
//                       server-side loop) so each AI generation stays inside
//                       a single function invocation's timeout.
//   "get"           -> { postId } one post including body_html (for the editor).
//   "update"        -> { postId, title?, category?, excerpt?, meta_description?,
//                       body_html? } manual owner edit; recomputes read_minutes
//                       when the body changes; slug/created_at/published_at
//                       never change so URLs and quota are unaffected.
//   "get-settings"  -> current posts_per_week cadence.
//   "set-cadence"   -> { postsPerWeek } updates posts_per_week.
//
// Required Netlify env vars: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { createAndPublishPost, createScheduledPost, nextOpenWeeklySlotISO, regeneratePost, respaceScheduledDrafts } from "../lib/blog-shared.mjs";

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

    if (action === "generate-scheduled") {
      // Writes the next post as a scheduled draft at the next OPEN Monday
      // 08:00-AZ slot (or an explicit body.when), for review before it goes
      // live. Repeat clicks stack future weeks instead of piling onto one day.
      let when = body.when ? new Date(body.when) : null;
      if (when && (isNaN(when) || when.getTime() <= Date.now())) return json({ ok: false, error: "Scheduled time must be in the future" }, 400);
      const slot = when ? when.toISOString() : await nextOpenWeeklySlotISO(supabase);
      const post = await createScheduledPost(slot);
      if (!post) return json({ ok: true, action, post: null, note: "That week already has a post scheduled." });
      return json({ ok: true, action, post });
    }

    if (action === "publish-now") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const { data, error } = await supabase
        .from("blog_posts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", body.postId)
        .eq("status", "draft")
        .select("id, slug, title, category, excerpt, status, source, read_minutes, published_at, created_at")
        .single();
      if (error) throw error;
      return json({ ok: true, action, post: data });
    }

    if (action === "reschedule") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const when = new Date(body.when || "");
      if (isNaN(when) || when.getTime() <= Date.now()) return json({ ok: false, error: "Scheduled time must be a valid future date/time" }, 400);
      const { data, error } = await supabase
        .from("blog_posts")
        .update({ published_at: when.toISOString() })
        .eq("id", body.postId)
        .eq("status", "draft")   // only scheduled drafts can move; published history stays put
        .select("id, slug, title, category, excerpt, status, source, read_minutes, published_at, created_at")
        .single();
      if (error) throw error;
      return json({ ok: true, action, post: data });
    }

    if (action === "regenerate") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const post = await regeneratePost(body.postId);
      return json({ ok: true, action, post });
    }

    if (action === "respace-schedule") {
      // Enforce one-post-per-week on existing scheduled drafts: spread them
      // across consecutive open Monday slots, one per week. DB-only (no AI),
      // so it's fast enough for the synchronous function.
      const result = await respaceScheduledDrafts(supabase);
      return json({ ok: true, action, ...result });
    }

    if (action === "delete") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const { error } = await supabase.from("blog_posts").update({ status: "deleted" }).eq("id", body.postId);
      if (error) throw error;
      return json({ ok: true, action });
    }

    if (action === "delete-all") {
      const { data, error } = await supabase
        .from("blog_posts")
        .update({ status: "deleted" })
        .neq("status", "deleted")
        .select("id");
      if (error) throw error;
      return json({ ok: true, action, count: (data || []).length });
    }

    if (action === "get") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, category, excerpt, meta_description, body_html, status, source, read_minutes, published_at, created_at")
        .eq("id", body.postId)
        .single();
      if (error) throw error;
      return json({ ok: true, action, post: data });
    }

    if (action === "update") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const fields = {};
      for (const k of ["title", "category", "excerpt", "meta_description", "body_html"]) {
        if (typeof body[k] === "string" && body[k].trim()) fields[k] = body[k].trim();
      }
      if (!Object.keys(fields).length) return json({ ok: false, error: "Nothing to update" }, 400);
      if (fields.body_html) {
        // Honest re-estimate at ~200 wpm, clamped to the same 3-12 range the AI uses
        const words = fields.body_html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
        fields.read_minutes = Math.max(3, Math.min(12, Math.round(words / 200) || 3));
      }
      const { data, error } = await supabase
        .from("blog_posts")
        .update(fields)
        .eq("id", body.postId)
        .select("id, slug, title, category, excerpt, status, source, read_minutes, published_at, created_at")
        .single();
      if (error) throw error;
      return json({ ok: true, action, post: data });
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
