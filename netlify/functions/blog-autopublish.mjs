// Scheduled blog auto-publish (Mon/Wed/Fri -- see [functions."blog-autopublish"]
// in netlify.toml). Counts new posts created in the trailing 7 days against
// blog_settings.posts_per_week and writes+publishes one more AI post if under
// quota; otherwise no-ops. Quota is counted by created_at (not published_at)
// so a regenerate -- which bumps published_at but keeps the original
// created_at -- never double-counts toward the week's new-post quota.
//
// ?test=1 reports what the check would do (quota used vs. limit) and emails
// the owner a status notice, without publishing anything or sending the real
// publish email -- mirrors lead-followup.mjs's dry-run convention.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, GOLD, escapeHTML } from "../lib/report-shared.mjs";
import { createAndPublishPost } from "../lib/blog-shared.mjs";

const SITE_URL = "https://boldlinemedia.com";
const DAY = 864e5;

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
    <div style="font-size:11px;color:#6B7280;margin-top:10px">New blog post published</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:24px 22px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${GOLD};margin-bottom:8px">${escapeHTML(post.category)}</div>
    <div style="font-size:19px;font-weight:700;color:#1F2937;line-height:1.3;margin-bottom:10px">${escapeHTML(post.title)}</div>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4B5563">${escapeHTML(post.excerpt)}</p>
    <a href="${SITE_URL}/blog/${post.slug}/" style="display:inline-block;padding:11px 20px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:6px;background:${GOLD};color:#15110A;text-decoration:none">Read it live</a>
  </div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Written and published automatically. Not happy with it? Delete or regenerate it from the Blog panel in BoldLine OS.</div>
</div>
</body></html>`;

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("blog-autopublish: missing SUPABASE_SERVICE_ROLE_KEY");
    return new Response("error", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const testMode = new URL(req.url).searchParams.get("test") === "1";

  try {
    const { data: settings, error: settingsErr } = await supabase
      .from("blog_settings")
      .select("posts_per_week")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;
    const quota = settings.posts_per_week;

    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const { count, error: countErr } = await supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .neq("status", "deleted")
      .gte("created_at", since);
    if (countErr) throw countErr;
    const used = count || 0;

    if (testMode) {
      const msg = `Trailing 7 days: ${used} of ${quota} new posts published. ${used >= quota ? "Quota is met -- the next real run will skip." : "Under quota -- the next real run will write and publish one more post."}\n\nThis is a status check only. No post was written and no real publish notification was sent.`;
      console.log("blog-autopublish (test):", msg);
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: "[TEST] BoldLine blog auto-publish check",
        html: noticeEmailHTML("Auto-publish status check", msg),
        text: msg,
      });
      return new Response(JSON.stringify({ ok: true, used, quota, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (used >= quota) {
      console.log(`blog-autopublish: quota met (${used}/${quota} since ${since.slice(0, 10)}) -- skipping.`);
      return new Response("ok - quota met", { status: 200 });
    }

    const post = await createAndPublishPost();
    console.log(`blog-autopublish: published "${post.title}" (${post.slug})`);

    try {
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: `New blog post live: ${post.title}`,
        html: publishEmailHTML(post),
        text: `${post.title}\n\n${post.excerpt}\n\n${SITE_URL}/blog/${post.slug}/`,
      });
    } catch (err) {
      console.error("blog-autopublish: publish succeeded but notification email failed:", err);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("blog-autopublish failed:", err);
    return new Response("error", { status: 500 });
  }
};
