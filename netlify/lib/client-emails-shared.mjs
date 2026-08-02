// Branded, DARK-THEME client lifecycle emails for BoldLine Media.
//
// One shared "shell" (logo header + dark card + footer, table-based + inline
// styles so it survives email clients) wraps a set of per-stage templates
// (welcome, onboarding, invoice, receipt, past-due, renewal, thank-you…).
// Each template takes a `ctx` of client-specific values and returns
// {subject, preheader, bodyHtml}; renderClientEmail() wraps that in the shell.
//
// Rendered + sent from the OS "Emails" tab (netlify/functions/client-email.mjs).
// Sending reuses the existing Resend sender (report-shared.sendEmail), which
// already delivers client reports — so these send today, no new config.

import { GOLD, escapeHTML } from "./report-shared.mjs";

const DARK = { bg:"#070810", card:"#0C0D18", cardBorder:"rgba(255,255,255,.08)", head:"#F5F3EA", body:"#C6CAE0", muted:"#8B91B8", faint:"#5A6078", chip:"#12131F" };
const SITE = "https://boldlinemedia.com"; // last-resort fallback so a button link is never empty
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const money = (n) => "$" + Number(n || 0).toLocaleString();
const firstName = (name) => { const f = String(name || "").trim().split(/\s+/)[0]; return f || "there"; };

// ── content helpers (inline-styled fragments) ──────────────────────────────
const h1   = (t) => `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:23px;font-weight:700;line-height:1.3;color:${DARK.head}">${t}</h1>`;
const p    = (t) => `<p style="margin:0 0 15px;font-family:${SANS};font-size:15px;line-height:1.65;color:${DARK.body}">${t}</p>`;
const small= (t) => `<p style="margin:0 0 12px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${DARK.muted}">${t}</p>`;
const b    = (t) => `<strong style="color:${DARK.head};font-weight:700">${t}</strong>`;
const gold = (t) => `<span style="color:${GOLD};font-weight:700">${t}</span>`;
const rule = () => `<div style="height:1px;background:rgba(255,255,255,.07);margin:20px 0"></div>`;

const button = (label, url) => url
  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 6px"><tr><td align="center" style="border-radius:10px;background:${GOLD}"><a href="${escapeHTML(url)}" style="display:inline-block;padding:13px 32px;font-family:${SANS};font-size:14px;font-weight:700;color:#15110A;text-decoration:none;border-radius:10px">${escapeHTML(label)} &rarr;</a></td></tr></table>`
  : "";

// a bordered "receipt" / detail box (label → value rows)
const detailBox = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${DARK.chip};border:1px solid rgba(255,255,255,.07);border-radius:12px;margin:6px 0 18px">
  ${rows.map((r, i) => `<tr>
    <td style="padding:12px 16px;font-family:${SANS};font-size:13px;color:${DARK.muted};${i?"border-top:1px solid rgba(255,255,255,.05)":""}">${escapeHTML(r[0])}</td>
    <td align="right" style="padding:12px 16px;font-family:${SANS};font-size:13px;font-weight:700;color:${r[2]||DARK.head};${i?"border-top:1px solid rgba(255,255,255,.05)":""}">${escapeHTML(r[1])}</td>
  </tr>`).join("")}
</table>`;

const steps = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px">
  ${items.map((s, i) => `<tr>
    <td valign="top" width="30" style="padding:6px 0"><div style="width:22px;height:22px;border-radius:50%;background:${GOLD};color:#15110A;font-family:${SANS};font-size:12px;font-weight:800;text-align:center;line-height:22px">${i + 1}</div></td>
    <td style="padding:6px 0 6px 10px;font-family:${SANS};font-size:14px;line-height:1.55;color:${DARK.body}">${s}</td>
  </tr>`).join("")}
</table>`;

const signoff = () => `<p style="margin:22px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${DARK.body}">Talk soon,<br>${b("Bryson — BoldLine Media")}</p>`;

// ── the shell ──────────────────────────────────────────────────────────────
export function emailShell({ preheader, bodyHtml, footerNote }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:${DARK.bg};-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${DARK.bg}">${escapeHTML(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${DARK.bg};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
      <tr><td align="center" style="padding:4px 0 22px">
        <div style="font-family:${SERIF};font-size:22px;font-weight:700;letter-spacing:.04em;color:${GOLD}">BoldLine Media</div>
        <div style="margin:9px auto 0;height:2px;width:40px;background:${GOLD};opacity:.85"></div>
      </td></tr>
      <tr><td style="background:${DARK.card};border:1px solid ${DARK.cardBorder};border-top:3px solid ${GOLD};border-radius:16px;padding:30px 28px">${bodyHtml}</td></tr>
      <tr><td align="center" style="padding:18px 10px 0">
        <div style="font-family:${SANS};font-size:11px;line-height:1.65;color:${DARK.faint}">${footerNote || "BoldLine Media &mdash; Google &amp; Meta ads, managed for you."}<br>Questions? Just reply to this email.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── templates ───────────────────────────────────────────────────────────────
// Each returns {subject, preheader, bodyHtml}. ctx is all optional w/ fallbacks.
const T = {
  welcome: (c) => ({
    subject: `Welcome to BoldLine Media, ${c.businessName || "welcome aboard"}`,
    preheader: "Your account is set up — here's your client portal and what happens next.",
    bodyHtml:
      h1(`Welcome aboard, ${escapeHTML(firstName(c.contactName))}.`) +
      p(`We're thrilled to have ${b(escapeHTML(c.businessName || "your business"))} on board. BoldLine plans, builds, and runs your ${escapeHTML(c.packageName ? c.packageName + " " : "")}ad campaigns and the landing pages behind them — so you can focus on running your business while we bring you the leads.`) +
      p(`Everything lives in your ${gold("client portal")} — track leads, see performance, upload photos, and message us anytime:`) +
      button("Open Your Client Portal", c.portalUrl || SITE) +
      rule() +
      p(b("What happens next:")) +
      steps([
        "Open your portal and add a few details about your business.",
        "Grant us access to your ad account (we'll send simple steps).",
        "We build your campaign + landing page and send it for your approval.",
        "Your ads go live and the leads start coming in.",
      ]) +
      signoff(),
  }),

  onboarding_access: (c) => ({
    subject: `Quick next step for ${c.businessName || "your campaign"}: ad account access`,
    preheader: "One quick step so we can start building — grant BoldLine manager access.",
    bodyHtml:
      h1("One quick step to get started") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — to start building your campaigns, we need ${b("manager access")} to your ad account.`) +
      p(`Important: ${gold("your ad account always stays yours.")} You own it and you pay the ad spend directly to Google/Meta — we never touch your billing. We only need manager-level access to build, optimize, and report.`) +
      p(b("Here's how to grant access:")) +
      steps([
        "Open your client portal and go to the <b>Connect Your Ad Accounts</b> section.",
        "Follow the short walkthrough for Google and/or Meta.",
        "That's it — we'll take it from there and confirm once we're in.",
      ]) +
      button("Connect Your Ad Accounts", c.portalUrl || SITE) +
      small("Not sure about a step? Just reply — happy to hop on a quick call and do it together.") +
      signoff(),
  }),

  contract_signed: (c) => ({
    subject: `You're all set — your BoldLine agreement is signed`,
    preheader: "Your agreement is signed and on file. Here's what's next.",
    bodyHtml:
      h1("You're all set ✓") +
      p(`Thanks ${escapeHTML(firstName(c.contactName))} — your BoldLine Media agreement is ${b("signed and on file.")} A copy is always available in your portal.`) +
      p("Next up, we'll get your billing and ad account connected, then start building. You'll approve everything before anything goes live.") +
      button("View in Your Portal", c.portalUrl || SITE) +
      signoff(),
  }),

  invoice: (c) => {
    const setup = Number(c.setup || 0);
    const monthly = Number(c.monthly || 0);
    const rows = [];
    if (setup > 0) rows.push(["One-time setup", money(setup)]);
    rows.push([`Monthly management${c.packageName ? " — " + c.packageName : ""}`, money(monthly)]);
    const total = setup + monthly;
    rows.push(["Amount due", money(total), GOLD]);
    return {
      subject: `Invoice from BoldLine Media — ${money(total)} due`,
      preheader: `Your invoice for ${c.businessName || "your account"} — pay securely online.`,
      bodyHtml:
        h1("Your invoice") +
        p(`Hi ${escapeHTML(firstName(c.contactName))}, here's your invoice for ${b(escapeHTML(c.businessName || "your account"))}. You can pay securely online in a few taps:`) +
        detailBox(rows) +
        button("Pay Securely Online", c.payUrl || c.portalUrl || SITE) +
        small("On the secure Stripe page you can pay by card or bank — or scan the QR code to pay from your phone. A receipt is emailed automatically once payment clears. This invoice covers BoldLine management fees only — your ad spend is billed separately by Google/Meta directly to you.") +
        signoff(),
    };
  },

  receipt: (c) => {
    const amount = c.amount != null ? Number(c.amount) : Number(c.monthly || 0);
    const rows = [["Amount paid", money(amount), "#22D3A0"]];
    if (c.date) rows.push(["Date", c.date]);
    if (c.packageName) rows.push(["Plan", c.packageName]);
    return {
      subject: `Payment received — thank you`,
      preheader: `We received your payment of ${money(amount)}. Thank you!`,
      bodyHtml:
        h1("Payment received — thank you") +
        p(`Thanks ${escapeHTML(firstName(c.contactName))}! We've received your payment and your account is all squared away.`) +
        detailBox(rows) +
        p("Nothing else needed on your end — we're hard at work on your campaigns. You can see everything anytime in your portal.") +
        button("Open Your Portal", c.portalUrl || SITE) +
        signoff(),
    };
  },

  past_due: (c) => ({
    subject: `Action needed: a payment didn't go through`,
    preheader: "Your latest payment didn't process — a quick update fixes it.",
    bodyHtml:
      h1("A quick heads-up on your payment") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — your most recent payment of ${b(money(c.monthly))} didn't go through. It's usually just an expired card or a bank hold, and it takes a minute to fix.`) +
      button("Update Payment Method", c.payUrl || c.portalUrl || SITE) +
      small("Your campaigns keep running for now — we just wanted to catch this early so nothing gets interrupted. If you think this is a mistake, reply and we'll sort it out.") +
      signoff(),
  }),

  renewal: (c) => ({
    subject: `Your BoldLine plan renews soon — let's keep the momentum`,
    preheader: "Your term is coming up for renewal. Here's how to keep going.",
    bodyHtml:
      h1("Let's keep the momentum going") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — your current term with BoldLine is ${b("coming up for renewal" + (c.termEnd ? " on " + escapeHTML(c.termEnd) : "") + ".")}`) +
      p("We've loved working with " + b(escapeHTML(c.businessName || "you")) + ", and we'd love to keep the leads coming. Renewing is effortless — nothing changes on your end, your campaigns just keep running without a gap.") +
      button("Review Your Plan", c.portalUrl || SITE) +
      p("Want to talk results, adjust your plan, or scale up? Just reply and we'll set up a quick call.") +
      signoff(),
  }),

  approval_request: (c) => ({
    subject: `Your review is needed${c.approvalTitle ? ": " + c.approvalTitle : ""}`,
    preheader: "Something's ready for your review and approval in your portal.",
    bodyHtml:
      h1("Something's ready for your review") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — ${b(escapeHTML(c.approvalTitle || "an item"))} is ready and needs your approval before we move forward.`) +
      p("Open your portal to take a look and either approve it or request changes — it only takes a minute:") +
      button("Review & Approve", c.portalUrl || SITE) +
      small("You'll find it under the “Needs Your Review” section of your portal. Nothing moves forward until you approve, so take your time.") +
      signoff(),
  }),

  thank_you: (c) => ({
    subject: `Thank you from BoldLine Media`,
    preheader: "It's been a pleasure — here's your final wrap-up and a standing invitation.",
    bodyHtml:
      h1("Thank you — it's been a pleasure") +
      p(`Hi ${escapeHTML(firstName(c.contactName))}, we wanted to say a genuine thank you for trusting BoldLine Media with ${b(escapeHTML(c.businessName || "your business"))}. It's been a pleasure running your campaigns.`) +
      p(`A couple of things as we wrap up: ${gold("your ad account stays entirely yours")} — everything we built lives in your account, and your final performance report is in your portal. Nothing goes away.`) +
      button("View Your Final Report", c.portalUrl || SITE) +
      p("If you ever want to pick things back up or need a hand down the road, our door is always open — just reply to this email. Wishing you huge success ahead.") +
      signoff(),
  }),
};

// public catalog for the OS UI
export const EMAIL_TYPES = [
  { id: "welcome", label: "Welcome + Portal", icon: "👋", desc: "Sent right after they sign — warm welcome + portal login + what's next." },
  { id: "onboarding_access", label: "Ad Account Access", icon: "🔑", desc: "Asks the client to grant BoldLine manager access to their ad account." },
  { id: "contract_signed", label: "Contract Signed", icon: "✅", desc: "Confirmation that their agreement is signed and on file." },
  { id: "invoice", label: "Invoice", icon: "🧾", desc: "Branded invoice with a secure Pay-online button (setup + monthly)." },
  { id: "receipt", label: "Payment Receipt", icon: "💳", desc: "Thank-you + confirmation after a successful payment." },
  { id: "past_due", label: "Payment Past-Due", icon: "⏰", desc: "Polite heads-up that a payment didn't process, with an update link." },
  { id: "renewal", label: "Renewal Reminder", icon: "🔄", desc: "Nudge before the term ends — keep the campaigns running." },
  { id: "thank_you", label: "Thank-You / Offboarding", icon: "🙏", desc: "Gracious wrap-up when a contract ends and isn't renewed." },
];

export function renderClientEmail(type, ctx = {}) {
  const tpl = T[type];
  if (!tpl) throw new Error(`Unknown email type: ${type}`);
  const { subject, preheader, bodyHtml } = tpl(ctx);
  return { subject, html: emailShell({ preheader, bodyHtml }) };
}
