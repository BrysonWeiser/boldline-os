// The blog's SLOW work: anything that asks the AI to write a whole article.
//
// 🔴 WHY THIS IS NOT IN blog-autopublish ANY MORE (2026-10-07). Netlify stops a scheduled
// function after 30 seconds. Writing a full article on the current model with careful effort
// takes longer than that, so the repair of six broken posts limped along: a run finished only
// when the model happened to be quick, and every run that was cut off also skipped the steps
// after it, which is why the two wording fixes queued behind it never landed. The weekly
// writer sat in the same function with the same exposure.
//
// So the 15-minute publisher only DECIDES (fast reads and writes) and hands each piece of
// writing to blog-write-background, which Netlify allows fifteen minutes. These are the jobs
// that function runs. Each one emails Bryson the same message the publisher used to send.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail } from "./report-shared.mjs";
import { createScheduledPost, htmlProblems, regeneratePost, repairOneBrokenPost } from "./blog-shared.mjs";
import { pingPostPublished } from "./indexnow-shared.mjs";
import { SITE_URL, fmtWhen, noticeEmailHTML, scheduledEmailHTML } from "./blog-notify.mjs";

// The publisher proves it is the publisher with a key derived from a secret both functions
// already hold, so no new environment variable is needed and nothing outside can start a job.
export const blogJobKey = () => crypto.createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}:blog-jobs`).digest("hex");

export const BLOG_JOBS = ["job-repair", "job-fix-draft", "job-weekly"];

const db = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tell = async (subject, headline, msg) => {
  try { await sendEmail({ to: process.env.OWNER_EMAIL, subject, html: noticeEmailHTML(headline, msg), text: msg }); }
  catch (e) { console.error("blog-jobs: email failed:", e && e.message); }
};

// Rewrite one broken PUBLISHED post on the same topic, keeping its date and address.
export async function runRepair() {
  const fixed = await repairOneBrokenPost(db());
  if (!fixed) return { ok: true, repaired: null };
  console.log(`blog-jobs: repaired broken post "${fixed.title}" (${fixed.slug}): ${fixed.was.join(", ")}`);
  await pingPostPublished(fixed.slug);
  await tell(`Blog post repaired: ${fixed.title}`, "A broken blog post was repaired",
    `A published post was broken on the site (${fixed.was.join(", ")}). It has been rewritten on the same topic and kept its date and address:\n\n${fixed.title}\n${SITE_URL}/blog/${fixed.slug}/\n\nRead it, and edit or rewrite it again in the Website tab of BoldLine OS if you want changes.`);
  return { ok: true, repaired: fixed.slug };
}

// A scheduled draft that came due broken: rewrite it in place (it keeps its publish time, so the
// next pass of the publisher puts it live). If the rewrite fails, hold it a week and say so once.
export async function runFixDraft(postId) {
  const supabase = db();
  const { data: post } = await supabase.from("blog_posts").select("id, title, status, published_at, body_html").eq("id", postId).maybeSingle();
  if (!post || post.status !== "draft") return { ok: true, skipped: "not a draft any more" };
  const bad = htmlProblems(post.body_html);
  if (!bad.length) return { ok: true, skipped: "already fine" };
  try {
    const fresh = await regeneratePost(post.id);
    const still = htmlProblems(fresh.body_html);
    if (still.length) throw new Error(still.join(", "));
    console.log(`blog-jobs: rewrote due draft "${fresh.title}"; the publisher puts it live on its next pass`);
    return { ok: true, fixed: post.id };
  } catch (e) {
    const later = new Date(new Date(post.published_at).getTime() + 7 * 864e5).toISOString();
    await supabase.from("blog_posts").update({ published_at: later }).eq("id", post.id);
    const msg = `"${post.title}" was due to go live but came out incomplete (${bad.join(", ")}), and rewriting it failed (${e.message}). It was NOT published. It is now scheduled for ${fmtWhen(later)}. Rewrite or delete it in the Website tab of BoldLine OS.`;
    console.error("blog-jobs:", msg);
    await tell(`Blog post held back: ${post.title}`, "A blog post was held back", msg);
    return { ok: false, held: post.id };
  }
}

// The weekly post, written and scheduled for review. createScheduledPost returns null when the
// week is already covered, so a second start for the same week does nothing.
export async function runWeekly(slot) {
  if (!slot || Number.isNaN(new Date(slot).getTime())) return { ok: false, error: "no week given" };
  const post = await createScheduledPost(slot);
  if (!post) return { ok: true, post: null };
  console.log(`blog-jobs: scheduled "${post.title}" (${post.slug}) for ${slot}`);
  try {
    await sendEmail({
      to: process.env.OWNER_EMAIL,
      subject: `New post scheduled for ${fmtWhen(slot)}: ${post.title}`,
      html: scheduledEmailHTML(post, slot),
      text: `${post.title}\n\n${post.excerpt}\n\nPublishes ${fmtWhen(slot)}. Review it in the Website tab of BoldLine OS before then.`,
    });
  } catch (e) { console.error("blog-jobs: scheduled but email failed:", e && e.message); }
  return { ok: true, post: post.slug };
}

// Called by the publisher. Returns at once (a background function answers 202 immediately).
export async function startBlogJob(action, body = {}, { base = process.env.URL, fetchImpl = fetch } = {}) {
  const url = `${String(base || "").replace(/\/$/, "")}/.netlify/functions/blog-write-background`;
  const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", "x-blog-job-key": blogJobKey() }, body: JSON.stringify({ ...body, action }) });
  return r.status === 202 || r.ok;
}
