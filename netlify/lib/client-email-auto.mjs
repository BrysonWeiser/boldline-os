// Server-side auto-sender for the branded client lifecycle emails.
//
// Same templates the owner sends one-tap from the OS Emails tab
// (client-emails-shared.mjs), but fired automatically by real triggers:
//   • Welcome + Portal   -> Stripe checkout.session.completed  (stripe-webhook)
//   • Payment Receipt     -> Stripe invoice.paid                (stripe-webhook)
//   • Payment Past-Due    -> Stripe invoice.payment_failed      (stripe-webhook)
//   • Renewal Reminder    -> 30 days before contractEnd         (billing-watch)
//
// It renders + sends via the existing Resend sender and returns a commLog entry
// in the SAME `Sent "<label>" email …` shape the OS uses, so getAlerts' matching
// blue reminder auto-clears. Idempotency (don't re-send) is the caller's job via
// the client's `emailAuto` flags. Fully fail-soft: never throws, returns
// { sent:false, reason } so a send hiccup never breaks the webhook/watcher.

import { renderClientEmail, EMAIL_TYPES } from "./client-emails-shared.mjs";
import { sendEmail } from "./report-shared.mjs";
import { PACKAGES } from "./pricing-shared.mjs";
import { termsOf } from "./website-deal.mjs";
import { liveDomain } from "./site-domain.mjs";

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
const labelFor = (type) => (EMAIL_TYPES.find((t) => t.id === type) || {}).label || type;
const pkgName = (id) => { const p = PACKAGES.find((x) => x.id === id); return p ? p.name : ""; };
// A website-only client (the "w-site" package). Same test the portal and the OS use.
export const isWebsiteOnly = (cl) => !!cl && cl.packageId === "w-site";

// Build the template context from a client's stored data (the server-side twin of
// EmailCenterTab.buildCtx). Portal link uses Netlify's injected site URL.
export const buildClientCtx = (cl, extra = {}) => {
  const base = String(process.env.URL || "https://boldlinemedia.com").replace(/\/$/, "");
  return {
    businessName: cl.name || "",
    contactName: cl.contactName || "",
    packageName: pkgName(cl.packageId),
    monthly: cl.billingMonthly != null ? cl.billingMonthly : 0,
    setup: cl.billingSetup != null ? cl.billingSetup : 0,
    portalUrl: cl.portalToken ? `${base}/portal?token=${cl.portalToken}` : "",
    // 🔴 WHAT THIS CLIENT IS BILLED FOR, so the invoice names the same thing their agreement
    // does. Without it a client billed per Qualified Sale receives an invoice line for
    // "Qualified leads", which is a charge for something their contract never mentions.
    // 🔴 A WEBSITE-ONLY CLIENT HAS NO ADS, so nothing may call their enquiries leads or mention
    // campaigns. "enquiry" switches every shared email (the milestone, the review ask) to the
    // website wording and the website footer. KB `website-builder`.
    resultKind: isWebsiteOnly(cl) ? "enquiry" : (cl.billingResultKind || ""),
    websiteOnly: isWebsiteOnly(cl),
    // The website emails: their live address, the private preview, and the deal's terms.
    // Their own address once it is proven to work (KB website-builder, step 3), ours until then.
    siteUrl: liveDomain(cl) ? `https://${liveDomain(cl)}/` : cl.landingSlug ? `${base}/site/${encodeURIComponent(cl.landingSlug)}/` : "",
    previewUrl: cl.landingSlug && cl.website && cl.website.previewKey ? `${base}/site/${encodeURIComponent(cl.landingSlug)}/?preview=${encodeURIComponent(cl.website.previewKey)}` : "",
    plan: termsOf(cl).plan,
    care: termsOf(cl).care,
    blog: !!termsOf(cl).blog,
    date: fmt(new Date()),
    ...extra,
  };
};

// Render + send one branded client email. Returns { sent, label, logEntry } on
// success (caller persists logEntry to commLog), or { sent:false, reason }.
export const autoSendClientEmail = async (cl, type, extra = {}) => {
  if (!cl || cl.internal) return { sent: false, reason: "internal or missing client" };
  if (!cl.email) return { sent: false, reason: "no client email" };
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL)
    return { sent: false, reason: "email not configured" };
  try {
    const { subject, html } = renderClientEmail(type, buildClientCtx(cl, extra));
    await sendEmail({ to: cl.email, subject, html });
    const label = labelFor(type);
    return {
      sent: true,
      label,
      logEntry: { date: fmt(new Date()), note: `Sent "${label}" email to ${cl.email} (automatic)`, cat: "email", ts: Date.now() },
    };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || "send failed" };
  }
};
