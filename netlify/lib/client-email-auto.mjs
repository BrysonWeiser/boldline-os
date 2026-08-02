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

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const labelFor = (type) => (EMAIL_TYPES.find((t) => t.id === type) || {}).label || type;
const pkgName = (id) => { const p = PACKAGES.find((x) => x.id === id); return p ? p.name : ""; };

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
