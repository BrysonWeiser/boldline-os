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
import { humanize } from "./humanize.mjs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, GOLD, escapeHTML } from "./report-shared.mjs";
import { BLOG_FACTS } from "./blog-shared.mjs";

const anthropic = new Anthropic();
export const SITE_URL = "https://boldlinemedia.com";
// Shared humanizer: this matched only the em dash, so en dashes and spaced hyphens
// both shipped to subscribers untouched.
const deDash = (s) => humanize(s, { join: ", " });

export const getSupabase = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── AI: write the companion email for a blog post ──────────────────────────
export async function generateNewsletterEmail(post) {
  const prompt = `You are writing this week's BoldLine Media newsletter email. It pairs with the blog post that publishes the same week. The reader is a busy small/mid-size business owner.
NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, and a plain hyphen with spaces around it. All three read as machine-written, and the spaced hyphen is the most common tell of all. Write two sentences, or use a comma. Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour.

Make the email genuinely worth reading on its own: deliver 2 to 3 concrete, useful takeaways from the post — enough that the reader actually learns something they can act on today — in tight, plain paragraphs.

But do NOT give away the whole post. Hold back the full step-by-step, the detailed examples, the deeper nuance, and the complete framework — those are the reason to click through and read it. Give the useful gist plus a clear reason the full post is worth their time. Aim for "helpful preview," not "the whole article condensed."

Friendly, plain, no hype, no emojis, never mention AI.

${BLOG_FACTS}

THIS WEEK'S BLOG POST:
Title: ${post.title}
Category: ${post.category || ""}
Summary: ${post.excerpt || post.meta_description || ""}

Write: a subject line (curiosity + value, under 60 chars, no clickbait), a one-line inbox preview, 3 to 4 short paragraphs that deliver 2-3 real takeaways (worth their time, but not the full depth of the post) and end by pointing them to the post for the rest, and the button text. Do not include a greeting or sign-off — the template adds those.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1300,
    tools: [{
      name: "newsletter_email",
      description: "A useful teaser email promoting a blog post — worth reading on its own, but holding back the post's full depth.",
      input_schema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line, under 60 characters." },
          preview: { type: "string", description: "One-line inbox preview text." },
          paragraphs: { type: "array", items: { type: "string" }, description: "3-4 short paragraphs delivering 2-3 genuinely useful takeaways, ending by pointing to the full post for the rest.", minItems: 3, maxItems: 5 },
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

// ── Branded DARK-theme HTML (matches the client-email dark shell) ──────────
// Explicit dark backgrounds on every wrapper + `color-scheme: dark only` so
// Gmail/Apple Mail render it dark (and don't auto-invert). Table-based layout
// for the button so it survives Outlook. Keeps the newsletter unsubscribe
// footer (broadcasts need the {{{RESEND_UNSUBSCRIBE_URL}}} tag in the body).
export function renderNewsletterHTML({ post, preview, paragraphs, ctaText }) {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const D = { bg:"#070810", card:"#0C0D18", cardBorder:"rgba(255,255,255,.08)", head:"#F5F3EA", body:"#C6CAE0", faint:"#5A6078" };
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const SERIF = "Georgia,'Times New Roman',serif";
  const paras = (paragraphs || []).map((para) =>
    `<p style="margin:0 0 15px;font-family:${SANS};font-size:15px;line-height:1.65;color:${D.body}">${escapeHTML(para)}</p>`).join("");
  const previewSpan = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${D.bg}">${escapeHTML(preview)}</div>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:${D.bg};-webkit-text-size-adjust:100%">
${previewSpan}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${D.bg};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
      <tr><td align="center" style="padding:4px 0 22px">
        <div style="font-family:${SERIF};font-size:22px;font-weight:700;letter-spacing:.04em;color:${GOLD}">BoldLine Media</div>
        <div style="margin:9px auto 0;height:2px;width:40px;background:${GOLD};opacity:.85"></div>
      </td></tr>
      <tr><td style="background:${D.card};border:1px solid ${D.cardBorder};border-top:3px solid ${GOLD};border-radius:16px;padding:30px 28px">
        <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:23px;font-weight:700;line-height:1.3;color:${D.head}">${escapeHTML(post.title)}</h1>
        ${paras}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px"><tr><td align="center" style="border-radius:10px;background:${GOLD}"><a href="${url}" style="display:inline-block;padding:13px 32px;font-family:${SANS};font-size:14px;font-weight:700;color:#15110A;text-decoration:none;border-radius:10px">${escapeHTML(ctaText)} &rarr;</a></td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:18px 10px 0">
        <div style="font-family:${SANS};font-size:11px;line-height:1.65;color:${D.faint}">You're getting this because you subscribed at boldlinemedia.com.<br><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${D.faint};text-decoration:underline">Unsubscribe</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Ensure a companion newsletter exists for this week's blog post ─────────
// Pairs 1:1 with the blog. The newest non-deleted post is normally the upcoming
// SCHEDULED draft (status "draft", published_at = the coming Monday 08:00 AZ),
// which the blog automation creates the preceding TUESDAY. So this writes the
// matching newsletter that same Tuesday as a scheduled draft, set to SEND on
// that Monday (post go-live + 2h, so the "read the full post" link is live).
// Net effect: one newsletter per week, auto-generated Tuesday, sent Monday, tied
// to that week's post — reviewable in the OS in between. Returns the row or null.
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

  // Enforce ONE newsletter per week (each tied to that week's blog post): if a
  // newsletter is already scheduled/sent in the same calendar week as this
  // post's send slot, don't create a second one. (Blog is already one-per-week,
  // so this is belt-and-suspenders against any double-up.)
  const sendAt = new Date(new Date(post.published_at).getTime() + 2 * 3600 * 1000);
  const slot = sendAt.getTime() <= Date.now() ? new Date(Date.now() + 2 * 3600 * 1000) : sendAt;
  const wkStart = new Date(slot); wkStart.setHours(0, 0, 0, 0);
  wkStart.setDate(wkStart.getDate() - ((wkStart.getDay() + 6) % 7)); // back to Monday
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 7);
  const { data: sameWeek } = await supabase
    .from("newsletter_emails").select("id").neq("status", "deleted")
    .gte("scheduled_for", wkStart.toISOString()).lt("scheduled_for", wkEnd.toISOString()).limit(1);
  if (sameWeek && sameWeek.length) return null; // already a newsletter this week

  const email = await generateNewsletterEmail(post);
  const scheduledFor = slot.toISOString();

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

// Resend Broadcast send. Resend replaced "Audiences" with "Segments" (2026):
// contacts are account-level, and a broadcast now targets a SEGMENT_ID (a named
// group of contacts). Requires RESEND_API_KEY + REPORTS_FROM_EMAIL (verified
// sender) + RESEND_SEGMENT_ID (an "all subscribers" segment made in Resend →
// Audience → Segments). See KB email-list-newsletter / domain-dns-wix.
export async function sendBroadcast(em) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORTS_FROM_EMAIL;
  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!key || !from || !segmentId) throw new Error("Sending not configured (need RESEND_API_KEY, REPORTS_FROM_EMAIL, RESEND_SEGMENT_ID)");
  const create = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, from, subject: em.subject, html: em.body_html }),
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
