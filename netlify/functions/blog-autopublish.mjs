// Blog publishing pipeline (runs every 15 minutes -- see
// [functions."blog-autopublish"] in netlify.toml). Review-first model
// (Bryson, 2026-07-03): posts are written AHEAD of time as scheduled drafts
// with an exact publish timestamp, so the owner can review/edit/AI-rewrite
// them in the OS Website tab before they go live.
//
// FIXED WEEKLY SCHEDULE (Bryson, 2026-07-03): exactly one post per week,
// published MONDAY 08:00 America/Phoenix, with the next one written+scheduled
// the preceding TUESDAY 08:00 AZ. Each run does two things:
//   1. PUBLISH DUE DRAFTS -- any status='draft' post whose published_at has
//      arrived is flipped to 'published' (the timestamp already on it becomes
//      the official publish time) and the owner gets the "now live" email.
//   2. WEEKLY CREATE (once per Tue->Mon cycle) -- if no post is already
//      scheduled or published for the current cycle (most recent Tue 08:00 AZ
//      through +7 days), the AI writes one and schedules it for that cycle's
//      Monday 08:00 AZ, then emails a "scheduled for <date> -- review it"
//      notice. The per-cycle guard means it fires ~Tuesday 08:00 and never
//      floods; deleting the pending draft makes the next run refill it.
//
// 🔴 Since 2026-10-07 this function WRITES NOTHING ITSELF: Netlify stops it at 30 seconds and an
// article takes longer. It decides, then starts blog-write-background (../lib/blog-jobs.mjs).
//
// ?test=1 reports what a real run would do (due drafts, pipeline state)
// without publishing/writing/emailing the real notices -- mirrors
// lead-followup.mjs's dry-run convention.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail } from "../lib/report-shared.mjs";
import { azMostRecent, htmlProblems, applyBlogContent } from "../lib/blog-shared.mjs";
import { pingPostPublished } from "../lib/indexnow-shared.mjs";
import { SITE_URL, fmtWhen, noticeEmailHTML, publishEmailHTML } from "../lib/blog-notify.mjs";
import { startBlogJob } from "../lib/blog-jobs.mjs";

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("blog-autopublish: missing SUPABASE_SERVICE_ROLE_KEY");
    return new Response("error", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  try {
    const { data: due, error: dueErr } = await supabase
      .from("blog_posts")
      .select("id, slug, title, category, excerpt, published_at, body_html")
      .eq("status", "draft")
      .lte("published_at", nowISO);
    if (dueErr) throw dueErr;

    // One post per Tuesday->Monday cycle: has a post already been scheduled or
    // published for THIS week's cycle (most recent Tue 08:00 AZ + 7 days)?
    const lastTue = azMostRecent(now, 2, 8);
    const weekStartISO = new Date(lastTue).toISOString();
    const weekEndISO = new Date(lastTue + 7 * 864e5).toISOString();
    const { count: cycleCount, error: cycErr } = await supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .neq("status", "deleted")
      .gte("published_at", weekStartISO)
      .lt("published_at", weekEndISO);
    if (cycErr) throw cycErr;
    const targetMs = lastTue + 6 * 864e5;                 // Monday 08:00 AZ
    const needsPost = (cycleCount || 0) === 0 && targetMs > now;

    if (testMode) {
      const msg = `Pipeline check: ${(due || []).length} draft(s) due to publish now. This Tue->Mon cycle has ${cycleCount || 0} post(s). ${needsPost ? `The next real run will write one and schedule it for ${fmtWhen(new Date(targetMs).toISOString())}.` : "Nothing to schedule -- this week's post is already handled."}\n\nStatus check only. Nothing was published, written, or announced.`;
      console.log("blog-autopublish (test):", msg);
      await sendEmail({ to: process.env.OWNER_EMAIL, subject: "[TEST] BoldLine blog pipeline check", html: noticeEmailHTML("Blog pipeline status check", msg), text: msg });
      return new Response(JSON.stringify({ ok: true, due: (due || []).length, cycleCount: cycleCount || 0, needsPost, target: needsPost ? new Date(targetMs).toISOString() : null, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // 🔴 THIS FUNCTION MAY ONLY RUN 30 SECONDS (Netlify's limit for scheduled functions), and
    // writing one article takes longer. So nothing here writes: it decides, does the quick
    // database work, and hands any writing to blog-write-background (see ../lib/blog-jobs.mjs).
    // Writing is started at most once an hour (the first pass after the hour), so a topic the
    // model keeps failing on costs 24 attempts a day, not 96.
    const firstPassOfHour = new Date(now).getUTCMinutes() < 15;
    const jobs = [];
    const start = async (action, body) => {
      try { if (await startBlogJob(action, body)) jobs.push(action); }
      catch (e) { console.error(`blog-autopublish: could not start ${action}:`, e && e.message); }
    };

    // 1. Hand-written content first: quick, and it must never wait behind the AI again.
    try {
      const c = await applyBlogContent(supabase, now);
      if (c.edited.length) console.log("blog-autopublish: wording fixed on", c.edited.join(", "));
      if (c.scheduled.length) {
        const msg = `New hand-written posts are scheduled, one per Monday at 8am Arizona time. Read or edit them in the Website tab of BoldLine OS before they go out:\n\n${c.scheduled.map((x) => `${fmtWhen(x.when)}: ${x.title}`).join("\n")}`;
        try { await sendEmail({ to: process.env.OWNER_EMAIL, subject: `${c.scheduled.length} new blog posts scheduled`, html: noticeEmailHTML("New blog posts scheduled", msg), text: msg }); } catch (err) { console.error(err); }
      }
    } catch (e) { console.error("blog-autopublish: content step failed:", e && e.message); }

    // 2. Publish anything whose scheduled time has arrived.
    for (const post of due || []) {
      // 🔴 Never publish a broken article (six went live as two paragraphs and empty headings).
      // It is rewritten in the background on the same topic; it keeps its time, so the next pass
      // publishes it. If the rewrite fails, the job holds it a week and tells Bryson once.
      const bad = htmlProblems(post.body_html);
      if (bad.length) {
        if (firstPassOfHour) await start("job-fix-draft", { postId: post.id });
        console.error(`blog-autopublish: NOT publishing "${post.title}", it is incomplete (${bad.join(", ")})`);
        continue;
      }
      const { error } = await supabase.from("blog_posts").update({ status: "published" }).eq("id", post.id);
      if (error) throw error;
      console.log(`blog-autopublish: published scheduled post "${post.title}" (${post.slug})`);
      await pingPostPublished(post.slug);   // fail-soft; never blocks the publish
      try {
        await sendEmail({
          to: process.env.OWNER_EMAIL,
          subject: `Blog post now live: ${post.title}`,
          html: publishEmailHTML(post),
          text: `${post.title}\n\n${post.excerpt}\n\n${SITE_URL}/blog/${post.slug}/`,
        });
      } catch (err) {
        console.error("blog-autopublish: publish succeeded but notification email failed:", err);
      }
    }

    // 3. A broken PUBLISHED post: the background job rewrites one per start (same date and address).
    if (firstPassOfHour) {
      try {
        const { data: live } = await supabase.from("blog_posts").select("id, body_html").eq("status", "published").limit(200);
        if ((live || []).some((p) => htmlProblems(p.body_html).length)) await start("job-repair", {});
      } catch (e) { console.error("blog-autopublish: repair check failed:", e && e.message); }
    }

    // 4. Once per cycle, the AI writes next Monday's post and schedules it for review.
    if (needsPost && firstPassOfHour) await start("job-weekly", { slot: new Date(targetMs).toISOString() });

    if (jobs.length) console.log("blog-autopublish: started", jobs.join(", "));
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("blog-autopublish failed:", err);
    return new Response("error", { status: 500 });
  }
};
