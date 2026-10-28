// Monday 8am Phoenix: put each business's waiting Google post up, the way the blog and newsletter go out (Bryson,
// 2026-10-28: "just like the blogs and newsletter where its made on tuesday and posted on monday at 8am"). KB google-listing.
//
// Only a draft that is DUE (its `scheduledFor` has passed) and NOT on hold goes up, with the words as they stand in the
// Google listing card, so an edit he saved is what gets posted. Review replies are never touched here: they still wait
// for him. Runs every 15 minutes through Monday morning (netlify.toml), so a Google hiccup at 8:00 retries at 8:15.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { gbpReady, loadConn, accessToken, createPost, postPayload, postDue } from "../lib/gbp.mjs";

const phx = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });

// Pure-ish: publish every due post in `rows`. `post` is createPost bound to a token, passed in so tests see every call.
export async function runPosts(db, rows, { post, now = Date.now(), alert = dispatchAlert } = {}) {
  const done = [], failed = [];
  for (const r of rows || []) {
    const cl = r.data || {};
    const dr = (cl.gbpDrafts || {}).post;
    if (!cl.gbp || !cl.gbp.location || !postDue(dr, now)) continue;
    const body = postPayload(cl.gbp, dr);
    if (body.text.length < 20) { failed.push(`${cl.name}: the post is too short to publish`); continue; }
    try { await post(cl.gbp, body); }
    catch (e) { failed.push(`${cl.name}: ${e.message}`); console.error("gbp-post-run:", cl.name, e.message); continue; }
    const at = new Date(now).toISOString();
    // Write onto a fresh read, and only clear the draft if it is still the one that was posted.
    const { data: fresh } = await db.from("clients").select("data").eq("id", r.id).maybeSingle();
    const d = (fresh && fresh.data) || cl, drs = { ...(d.gbpDrafts || {}) };
    if (drs.post && drs.post.scheduledFor === dr.scheduledFor) delete drs.post;
    await db.from("clients").update({ data: { ...d, gbpDrafts: drs,
      gbpLog: [{ type: "post", text: body.text, cta: body.cta, at, forSlot: dr.scheduledFor, auto: true }, ...(d.gbpLog || [])].slice(0, 100),
      commLog: [{ date: phx(at), note: `Posted this week's update on ${d.name}'s Google profile.`, cat: "update", ts: now }, ...(d.commLog || [])].slice(0, 200) },
      updated_at: at }).eq("id", r.id);
    done.push(cl.name);
  }
  if (done.length || failed.length) {
    try { await alert({ severity: failed.length ? "amber" : "blue", title: failed.length ? "A Google post didn't go up" : "This week's Google posts are up",
      body: [done.length && `Posted: ${done.join(", ")}.`, failed.length && `Not posted: ${failed.join("; ")}. It tries again every 15 minutes this morning, or post it from the Google listing card.`].filter(Boolean).join("\n"),
      smsText: failed.length ? `Google post failed: ${failed[0]}` : `Google posts up: ${done.join(", ")}` }); } catch (e) {}
  }
  return { done, failed };
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !gbpReady()) return new Response("not configured", { status: 200 });
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!(await loadConn(db))) return new Response("gbp-post-run: Google not connected", { status: 200 });
  const rows = (await loadAllClients(db, "gbp-post-run")).filter((r) => r.data && r.data.gbp && postDue((r.data.gbpDrafts || {}).post));
  if (!rows.length) return new Response("gbp-post-run: nothing due", { status: 200 });
  const tok = await accessToken(db);
  const res = await runPosts(db, rows, { post: (link, body) => createPost(tok, link, body) });
  return new Response(`gbp-post-run: posted ${res.done.length}, failed ${res.failed.length}`, { status: 200 });
};
export default withFailureAlert("gbp-post-run", handler);
