// Shared logic for the weekly newsletter (email list).
//
// Model: one companion email per blog post (newsletter_emails.post_slug 1:1).
// Each email is a short "here's a quick tip" teaser that ends in a "Read the
// full post" button linking to that week's blog post — the reader can get value
// from the email alone OR click through for the full article.
//
// SENDING is gated: the actual broadcast only fires when NEWSLETTER_SENDING_ENABLED=1
// (set that once boldlinemedia.com is verified in Resend — see KB domain-dns-wix /
// email-list-newsletter). Until then everything else works: AI drafts, review,
// scheduling, subscribers, analytics. sendDueNewsletters() no-ops while disabled.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, GOLD, escapeHTML } from "./report-shared.mjs";
import { BLOG_FACTS } from "./blog-shared.mjs";

const anthropic = new Anthropic();
export const SITE_URL = "https://boldlinemedia.com";
const deDash = (s) => (typeof s === "string" ? s.replace(/\s*—\s*/g, ", ") : s);

export const getSupabase = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── AI: write the companion email for a blog post ──────────────────────────
export async function generateNewsletterEmail(post) {
  const prompt = `You are writing a short marketing-tips newsletter email for BoldLine Media that promotes this week's blog post. The reader is a busy small/mid-size business owner. Give them ONE genuinely useful, self-contained takeaway from the post in a few tight lines, then invite them to read the full post for more. Friendly, plain, no hype, no emojis, never mention AI.

${BLOG_FACTS}

THIS WEEK'S BLOG POST:
Title: ${post.title}
Category: ${post.category || ""}
Summary: ${post.excerpt || post.meta_description || ""}

Write: a subject line (curiosity + value, under 60 chars, no clickbait), a one-line inbox preview, 2-3 very short paragraphs that deliver a real tip the reader can act on today (so the email is worth opening even if they never click), and the button text. Do not include a greeting or sign-off — the template adds those.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 900,
    tools: [{
      name: "newsletter_email",
      description: "A short teaser email promoting a blog post.",
      input_schema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line, under 60 characters." },
          preview: { type: "string", description: "One-line inbox preview text." },
          paragraphs: { type: "array", items: { type: "string" }, description: "2-3 short paragraphs delivering one actionable tip.", minItems: 2, maxItems: 3 },
          cta_text: { type: "string", description: "Button text, e.g. 'Read the full post'." },
        },
        required: ["subject", "preview", "paragraphs", "cta_text"],
      },
    }],
    tool_choice: { type: "tool", name: "newsletter_email" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  const out = (toolUse && toolUse.input) || {};
  const subject = deDash(String(out.subject || post.title)).slice(0, 120);
  const preview = deDash(String(out.preview || "")).slice(0, 160);
  const paragraphs = (Array.isArray(out.paragraphs) ? out.paragraphs : []).map((p) => deDash(String(p)));
  const ctaText = deDash(String(out.cta_text || "Read the full post")).slice(0, 40);
  return { subject, preview, body_html: renderNewsletterHTML({ post, preview, paragraphs, ctaText }) };
}

// ── Branded HTML (matches the report/alert email styling) ──────────────────
export function renderNewsletterHTML({ post, preview, paragraphs, ctaText }) {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const paras = (paragraphs || []).map((p) =>
    `<p style="margin:0 0 15px;line-height:1.65;color:#1F2937;font-size:15px">${escapeHTML(p)}</p>`).join("");
  const previewSpan = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHTML(preview)}</div>` : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
${previewSpan}
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:20px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:28px 26px">
    <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:14px;line-height:1.25">${escapeHTML(post.title)}</div>
    ${paras}
    <div style="text-align:center;margin:24px 0 4px">
      <a href="${url}" style="display:inline-block;background:${GOLD};color:#15110A;font-weight:700;font-size:14px;text-decoration:none;padding:13px 30px;border-radius:10px">${escapeHTML(ctaText)} →</a>
    </div>
  </div>
  <div style="margin-top:18px;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.6">
    You're getting this because you subscribed at boldlinemedia.com.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#9CA3AF;text-decoration:underline">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}

// ── Ensure a companion draft exists for the newest reviewable post ─────────
// Mirrors the blog's "always ≥1 awaiting review" idea: if the most recent
// non-deleted post has no newsletter email yet, write one as a draft scheduled
// for the post's go-live + 2h (so the "read the full post" link is live when it
// sends). Returns the created row or null.
export async function ensureCompanionDraft(supabase) {
  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, category, excerpt, meta_description, status, published_at")
    .neq("status", "deleted")
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const post = (posts || [])[0];
  if (!post || !post.slug) return null;

  const { data: existing } = await supabase
    .from("newsletter_emails").select("id").eq("post_slug", post.slug).limit(1);
  if (existing && existing.length) return null; // already has a companion email

  const email = await generateNewsletterEmail(post);
  const sendAt = new Date(new Date(post.published_at).getTime() + 2 * 3600 * 1000);
  const scheduledFor = (sendAt.getTime() <= Date.now() ? new Date(Date.now() + 2 * 3600 * 1000) : sendAt).toISOString();

  const { data: row, error: insErr } = await supabase
    .from("newsletter_emails")
    .insert({ post_slug: post.slug, subject: email.subject, preview: email.preview, body_html: email.body_html, status: "scheduled", scheduled_for: scheduledFor, source: "ai" })
    .select()
    .single();
  if (insErr) {
    if (String(insErr.message || "").includes("duplicate")) return null; // race: another run claimed it
    throw insErr;
  }
  return row;
}

// ── Send scheduled emails that are due (DORMANT until sending is enabled) ───
export async function sendDueNewsletters(supabase) {
  const enabled = process.env.NEWSLETTER_SENDING_ENABLED === "1";
  const nowISO = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("newsletter_emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowISO);
  if (error) throw error;
  if (!due || !due.length) return { enabled, sent: 0, pending: 0 };

  if (!enabled) {
    // Dormant: leave them scheduled so they send the moment sending is turned on.
    return { enabled: false, sent: 0, pending: due.length };
  }

  let sent = 0;
  for (const em of due) {
    try {
      const res = await sendBroadcast(em);
      await supabase.from("newsletter_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipients: res.recipients || null, resend_broadcast_id: res.broadcastId || null })
        .eq("id", em.id);
      sent++;
    } catch (e) {
      console.error(`newsletter send failed for ${em.post_slug || em.id}:`, e.message);
    }
  }
  return { enabled: true, sent, pending: due.length - sent };
}

// Resend Broadcast send. Finalize the exact audience wiring when the domain is
// verified (see KB email-list-newsletter). Requires RESEND_API_KEY +
// REPORTS_FROM_EMAIL (verified sender) + RESEND_AUDIENCE_ID.
export async function sendBroadcast(em) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORTS_FROM_EMAIL;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !from || !audienceId) throw new Error("Sending not configured (need RESEND_API_KEY, REPORTS_FROM_EMAIL, RESEND_AUDIENCE_ID)");
  const create = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audience_id: audienceId, from, subject: em.subject, html: em.body_html }),
  });
  if (!create.ok) throw new Error(`Resend broadcast create ${create.status}: ${await create.text()}`);
  const { id } = await create.json();
  const send = await fetch(`https://api.resend.com/broadcasts/${id}/send`, {
    method: "POST", headers: { Authorization: `Bearer ${key}` },
  });
  if (!send.ok) throw new Error(`Resend broadcast send ${send.status}: ${await send.text()}`);
  return { broadcastId: id, recipients: null };
}

// ── Subscribers + analytics (from the durable website_leads backup we own) ──
export async function getSubscriberStats(supabase) {
  const { data, error } = await supabase
    .from("website_leads")
    .select("email, created_at")
    .eq("form", "newsletter")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];

  const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const byMonth = {};
  for (const r of rows) { const k = monthKey(r.created_at); byMonth[k] = (byMonth[k] || 0) + 1; }
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: k, label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }), added: byMonth[k] || 0 });
  }

  // Best-effort live unsubscribe data from Resend (account-level contacts).
  // unsubscribed = count; unsubU'd = the actual emails so the owner can see WHO
  // left (Resend only exposes the contact's created_at, not the unsub date, so
  // we cross-reference our own website_leads to show when they'd subscribed).
  // Both are null when Resend is unreachable so the UI can show "—" vs "0".
  let unsubscribed = null;
  let unsubscribedList = null;
  const subbedAt = {};
  for (const r of rows) { const k = String(r.email || "").toLowerCase(); if (k && !subbedAt[k]) subbedAt[k] = r.created_at; }
  const unsubSet = new Set();
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/contacts", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
      if (r.ok) {
        const j = await r.json();
        const list = j.data || j.contacts || [];
        if (Array.isArray(list)) {
          const gone = list.filter((c) => c.unsubscribed);
          unsubscribed = gone.length;
          unsubscribedList = gone
            .map((c) => { const em = String(c.email || ""); return { email: em, subscribed_at: subbedAt[em.toLowerCase()] || c.created_at || null }; })
            .sort((a, b) => new Date(b.subscribed_at || 0) - new Date(a.subscribed_at || 0));
          for (const c of gone) unsubSet.add(String(c.email || "").toLowerCase());
        }
      }
    }
  } catch (e) { console.warn("newsletter: Resend contact data unavailable:", e.message); }

  return {
    total: rows.length,
    thisMonthAdded: byMonth[thisMonth] || 0,
    unsubscribed,
    unsubscribedList,
    months,
    recent: rows.slice(0, 50).map((r) => ({ email: r.email, created_at: r.created_at, unsubscribed: unsubSet.has(String(r.email || "").toLowerCase()) })),
  };
}
