// The blog's emails to Bryson, shared by the 15-minute publisher (blog-autopublish) and the
// background writer that does the slow work for it (blog-write-background, via blog-jobs).
import { GOLD, escapeHTML } from "./report-shared.mjs";

export const SITE_URL = "https://boldlinemedia.com";

export const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" }) + " Arizona time";

export const noticeEmailHTML = (headline, message) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">${escapeHTML(headline)}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:22px 22px;font-size:14px;line-height:1.6;color:#1F2937">${escapeHTML(message).replace(/\n/g, "<br>")}</div>
</div>
</body></html>`;

export const publishEmailHTML = (post) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
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

export const scheduledEmailHTML = (post, whenISO) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
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
