// On-demand AI blog generation, run as a Netlify BACKGROUND function.
//
// Why this exists: writing a full post with Claude takes ~20-40s, which blows
// past the ~10s limit on a normal synchronous function -- the OS buttons were
// getting a 502 ("Request failed"). Netlify runs any function whose name ends
// in "-background" asynchronously (returns 202 immediately, up to 15 min to
// finish), so generation always completes. The OS kicks this off and then
// polls the blog-admin "list" action until the new/updated post appears.
//
// POST body: { action, postId?, when? }
//   "generate-now"       -> write + publish a new post immediately.
//   "generate-scheduled" -> write a new post, schedule it for the next open
//                            Monday 08:00-AZ slot (or an explicit { when }).
//   "regenerate"         -> { postId } rewrite an existing post in place.
//
// Same owner-JWT auth as blog-admin. The 202 response body is ignored by the
// client; this function's job is the side effect (the DB write).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { createAndPublishPost, createScheduledPost, nextOpenWeeklySlotISO, regeneratePost } from "../lib/blog-shared.mjs";

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
    if (action === "generate-now") {
      const post = await createAndPublishPost();
      console.log(`blog-write-background: published "${post.title}" (${post.slug})`);
      return json({ ok: true, action, post });
    }
    if (action === "generate-scheduled") {
      let slot = body.when;
      if (slot) {
        const d = new Date(slot);
        if (isNaN(d) || d.getTime() <= Date.now()) return json({ ok: false, error: "Scheduled time must be in the future" }, 400);
        slot = d.toISOString();
      } else {
        slot = await nextOpenWeeklySlotISO(supabase);
      }
      const post = await createScheduledPost(slot);
      if (!post) {
        console.log(`blog-write-background: week ${slot} already covered -- no duplicate created.`);
        return json({ ok: true, action, post: null, note: "That week already has a post scheduled." });
      }
      console.log(`blog-write-background: scheduled "${post.title}" (${post.slug}) for ${slot}`);
      return json({ ok: true, action, post });
    }
    if (action === "regenerate") {
      if (!body.postId) return json({ ok: false, error: "postId required" }, 400);
      const post = await regeneratePost(body.postId);
      console.log(`blog-write-background: regenerated "${post.title}" (${post.slug})`);
      return json({ ok: true, action, post });
    }
    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("blog-write-background failed:", action, err && err.message);
    return json({ ok: false, error: err.message || "Generation failed" }, 500);
  }
};
