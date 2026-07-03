// Blog publishing pipeline (runs every 15 minutes -- see
// [functions."blog-autopublish"] in netlify.toml). Review-first model
// (Bryson, 2026-07-03): posts are written AHEAD of time as scheduled drafts
// with an exact publish timestamp, so the owner can review/edit/AI-rewrite
// them in the OS Website tab before they go live.
//
// Each run does two things:
//   1. PUBLISH DUE DRAFTS -- any status='draft' post whose published_at has
//      arrived is flipped to 'published' (the timestamp already on it becomes
//      the official publish time) and the owner gets the "now live" email.
//   2. TOP UP THE PIPELINE -- if no future-dated draft remains, the AI writes
//      the next post and schedules it one cadence-interval (7 / posts_per_week
//      days) after the latest post on the books, then emails the owner a
//      "scheduled for <date> -- review it" notice. This guarantees there is
//      always at least one scheduled post waiting for review, and it self-heals
//      if the owner deletes or publishes the pending one early.
//
// ?test=1 reports what a real run would do (due drafts, pipeline state)
// without publishing/writing/emailing the real notices -- mirrors
// lead-followup.mjs's dry-run convention.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, GOLD, escapeHTML } from "../lib/report-shared.mjs";
import { createScheduledPost, nextPublishSlot } from "../lib/blog-shared.mjs";

const SITE_URL = "https://boldlinemedia.com";

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

const noticeEmailHTML = (headline, message) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">${escapeHTML(headline)}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:22px 22px;font-size:14px;line-height:1.6;color:#1F2937">${escapeHTML(message).replace(/\n/g, "<br>")}</div>
</div>
</body></html>`;

const publishEmailHTML = (post) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">Scheduled blog post is now live</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:24px 22px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${GOLD};margin-bottom:8px">${escapeHTML(post.category)}</div>
    <div style="font-size:19px;font-weight:700;color:#1F2937;line-height:1.3;margin-bottom:10px">${escapeHTML(post.title)}</div>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4B5563">${escapeHTML(post.excerpt)}</p>
    <a href="${SITE_URL}/blog/${post.slug}/" style="display:inline-block;padding:11px 20px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:6px;background:${GOLD};color:#15110A;text-decoration:none">Read it live</a>
  </div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Published on its scheduled time. Need changes? Edit it any time from the Website tab in BoldLine OS.</div>
</div>
</body></html>`;

const scheduledEmailHTML = (post, whenISO) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">New post scheduled -- review before it goes live</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:24px 22px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${GOLD};margin-bottom:8px">${escapeHTML(post.category)}</div>
    <div style="font-size:19px;font-weight:700;color:#1F2937;line-height:1.3;margin-bottom:10px">${escapeHTML(post.title)}</div>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4B5563">${escapeHTML(post.excerpt)}</p>
    <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:4px">Publishes ${escapeHTML(fmtWhen(whenISO))}</div>
    <div style="font-size:12.5px;line-height:1.6;color:#6B7280">Review, edit, AI-rewrite, reschedule, or delete it in the <strong>Website</strong> tab of BoldLine OS before then. Do nothing and it publishes itself on time.</div>
  </div>
</div>
</body></html>`;

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("blog-autopublish: missing SUPABASE_SERVICE_ROLE_KEY");
    return new Response("error", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const nowISO = new Date().toISOString();

  try {
    const { data: settings, error: settingsErr } = await supabase
      .from("blog_settings").select("posts_per_week").eq("id", 1).single();
    if (settingsErr) throw settingsErr;

    const { data: due, error: dueErr } = await supabase
      .from("blog_posts")
      .select("id, slug, title, category, excerpt, published_at")
      .eq("status", "draft")
      .lte("published_at", nowISO);
    if (dueErr) throw dueErr;

    const { data: pending, error: pendErr } = await supabase
      .from("blog_posts")
      .select("id, title, published_at")
      .eq("status", "draft")
      .gt("published_at", nowISO)
      .order("published_at", { ascending: true });
    if (pendErr) throw pendErr;

    if (testMode) {
      const msg = `Pipeline check: ${(due || []).length} draft(s) due to publish now; ${(pending || []).length} scheduled for later${(pending || []).length ? ` (next: "${pending[0].title}" at ${fmtWhen(pending[0].published_at)})` : ""}. ${(pending || []).length ? "Pipeline is healthy." : "Pipeline is empty -- the next real run will write and schedule a new post for your review."}\n\nThis is a status check only. Nothing was published, written, or announced.`;
      console.log("blog-autopublish (test):", msg);
      await sendEmail({ to: process.env.OWNER_EMAIL, subject: "[TEST] BoldLine blog pipeline check", html: noticeEmailHTML("Blog pipeline status check", msg), text: msg });
      return new Response(JSON.stringify({ ok: true, due: (due || []).length, pending: (pending || []).length, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // 1. Publish anything whose scheduled time has arrived.
    for (const post of due || []) {
      const { error } = await supabase.from("blog_posts").update({ status: "published" }).eq("id", post.id);
      if (error) throw error;
      console.log(`blog-autopublish: published scheduled post "${post.title}" (${post.slug})`);
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

    // 2. Keep at least one scheduled post waiting for review.
    if ((pending || []).length === 0) {
      const slot = await nextPublishSlot(supabase, settings.posts_per_week);
      const post = await createScheduledPost(slot);
      console.log(`blog-autopublish: scheduled "${post.title}" (${post.slug}) for ${slot}`);
      try {
        await sendEmail({
          to: process.env.OWNER_EMAIL,
          subject: `New post scheduled for ${fmtWhen(slot)}: ${post.title}`,
          html: scheduledEmailHTML(post, slot),
          text: `${post.title}\n\n${post.excerpt}\n\nPublishes ${fmtWhen(slot)}. Review it in the Website tab of BoldLine OS before then.`,
        });
      } catch (err) {
        console.error("blog-autopublish: scheduling succeeded but notification email failed:", err);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("blog-autopublish failed:", err);
    return new Response("error", { status: 500 });
  }
};
