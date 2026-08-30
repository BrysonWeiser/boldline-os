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
      h1("You're all set") +
      p(`Thanks ${escapeHTML(firstName(c.contactName))} — your BoldLine Media agreement is ${b("signed and on file.")} A copy is always available in your portal.`) +
      p("Next up, we'll get your billing and ad account connected, then start building. You'll approve everything before anything goes live.") +
      button("View in Your Portal", c.portalUrl || SITE) +
      signoff(),
  }),

  invoice: (c) => {
    const setup = Number(c.setup || 0);
    const monthly = Number(c.monthly || 0);
    const leadCount = Math.max(0, Math.floor(Number(c.leadCount || 0)));
    const leadRate = Number(c.leadRate || 0);
    const leadTotal = c.leadTotal != null ? Number(c.leadTotal) : leadCount * leadRate;
    // 🔴 THE INVOICE MUST OBEY THE AGREEMENT IT BILLS UNDER. Section 4.1 of every managed
    // contract reads "THE TWO ARE NEVER CHARGED TOGETHER": the fee for a month is the
    // GREATER of the monthly minimum or the performance fee, never their sum. This template
    // was adding them, so a client on a $700 minimum who produced $900 of qualified leads
    // was invoiced $1,600 of fees instead of $900 — an overcharge of exactly the minimum,
    // on a document contradicting the contract they signed. Found 2026-08-26.
    const leads = leadCount > 0 ? leadTotal : 0;
    const usingLeads = leads >= monthly;          // ties go to the lead line, which itemises
    const feeThisMonth = Math.max(monthly, leads);
    const rows = [];
    if (setup > 0) rows.push(["One-time setup", money(setup)]);
    if (usingLeads && leads > 0) {
      rows.push([`Qualified leads — ${leadCount} × ${money(leadRate)}`, money(leads)]);
      // Said out loud, because a client who knows they have a minimum will look for it and
      // wonder where it went.
      if (monthly > 0) rows.push([`Your ${money(monthly)} monthly minimum is included in the above, not added`, ""]);
    } else if (monthly > 0) {
      rows.push([`Monthly minimum${c.packageName ? " — " + c.packageName : ""}`, money(monthly)]);
      if (leads > 0) rows.push([`${leadCount} qualified lead${leadCount === 1 ? "" : "s"} at ${money(leadRate)} counted toward the minimum, not added`, ""]);
    }
    const total = setup + feeThisMonth;
    rows.push(["Amount due", money(total), GOLD]);
    // A results-only client in a month with no qualified leads owes nothing, and their
    // agreement says so in those words. An "invoice for $0" is a confusing thing to receive
    // and invites a reply asking what it is.
    if (total <= 0) {
      return {
        subject: `Nothing due this month — ${c.businessName || "your account"}`,
        preheader: `No qualified leads this period, so there is nothing to pay.`,
        bodyHtml:
          h1("Nothing to pay this month") +
          p(`Hi ${escapeHTML(firstName(c.contactName))}, no invoice this time. The campaigns did not produce any qualified leads this period, and you only pay for results, so there is nothing owed.`) +
          button("See What's Running", c.portalUrl || SITE) +
          small("Your ad spend is billed separately by Google and Meta directly to you, and is unaffected by this.") +
          signoff(),
      };
    }
    return {
      subject: `Invoice from BoldLine Media — ${money(total)} due`,
      preheader: `Your invoice for ${c.businessName || "your account"} — pay securely online.`,
      bodyHtml:
        h1("Your invoice") +
        p(`Hi ${escapeHTML(firstName(c.contactName))}, here's your invoice for ${b(escapeHTML(c.businessName || "your account"))}. You can pay securely online in a few taps:`) +
        detailBox(rows) +
        button("Pay Securely Online", c.payUrl || c.portalUrl || SITE) +
        small("On the secure Stripe page you can pay by card or bank — or scan the QR code to pay from your phone. A receipt is emailed automatically once payment clears. This invoice covers BoldLine fees only — your ad spend is billed separately by Google/Meta directly to you.") +
        signoff(),
    };
  },

  receipt: (c) => {
    const amount = c.amount != null ? Number(c.amount) : Number(c.monthly || 0);
    // Itemize from the paid Stripe invoice's line items when we have them
    // (management fee + qualified leads + any interest); else just the total.
    const lines = Array.isArray(c.lines) ? c.lines.filter((l) => l && l.description) : [];
    const rows = [];
    if (lines.length) {
      lines.forEach((l) => rows.push([l.description, money(Number(l.amount) || 0)]));
      rows.push(["Total paid", money(amount), "#22D3A0"]);
    } else {
      rows.push(["Amount paid", money(amount), "#22D3A0"]);
      if (c.packageName) rows.push(["Plan", c.packageName]);
    }
    if (c.date) rows.push(["Date", c.date]);
    return {
      subject: `Payment received — thank you`,
      preheader: `We received your payment of ${money(amount)}. Thank you!`,
      bodyHtml:
        h1("Payment received — thank you") +
        p(`Thanks ${escapeHTML(firstName(c.contactName))}! We've received your payment of ${b(money(amount))} for ${b(escapeHTML(c.businessName || "your account"))}. Here's your itemized receipt:`) +
        detailBox(rows) +
        (c.invoiceUrl
          ? button("View / Download Invoice", c.invoiceUrl) +
            small("Your full invoice, with a downloadable PDF, is on the secure Stripe page. It covers BoldLine fees only — your ad spend is billed separately by Google/Meta directly to you.")
          : button("Open Your Portal", c.portalUrl || SITE)) +
        p("Nothing else needed on your end — we're hard at work on your campaigns. You can see everything anytime in your portal.") +
        signoff(),
    };
  },

  past_due: (c) => ({
    subject: `Action needed: a payment didn't go through`,
    preheader: "Your latest payment didn't process — a quick update fixes it.",
    bodyHtml:
      h1("A quick heads-up on your payment") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — your most recent payment${Number(c.amount) > 0 ? ` of ${b(money(c.amount))}` : ""} didn't go through. It's usually just an expired card or a bank hold, and it takes a minute to fix.`) +
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

  // Auto-nudge for a signed client who hasn't finished their intake yet.
  onboarding_nudge: (c) => ({
    subject: `Quick step to launch ${c.businessName || "your campaigns"}`,
    preheader: "One short form stands between you and live campaigns — about 5 minutes.",
    bodyHtml:
      h1("Let's get your campaigns live") +
      p(`Hi ${escapeHTML(firstName(c.contactName))} — we're ready to start building for ${b(escapeHTML(c.businessName || "your business"))}, and there's just one quick step on your side: finishing your onboarding details in the portal.`) +
      p("It takes about five minutes and tells us exactly who to target and what makes you the obvious choice:") +
      button("Finish Your Onboarding", c.portalUrl || SITE) +
      small("The sooner this is done, the sooner your ads go live and the leads start coming in. Stuck on anything? Just reply — we're happy to walk you through it.") +
      signoff(),
  }),

  // Auto-celebration when a client crosses a lead milestone (10/25/50/100…).
  lead_milestone: (c) => {
    const n = Number(c.milestone || c.leadCount || 0);
    return {
      subject: `${n} leads and counting for ${c.businessName || "your business"}`,
      preheader: `You've reached ${n} leads with BoldLine — here's to the next milestone.`,
      bodyHtml:
        h1(`${n} leads delivered`) +
        p(`Hi ${escapeHTML(firstName(c.contactName))} — quick moment to celebrate: BoldLine has now delivered ${b(n + " leads")} to ${b(escapeHTML(c.businessName || "your business"))}. Every one is a real potential customer who raised their hand for you.`) +
        p("We're just getting warmed up — your campaigns keep running and optimizing. You can see every lead anytime in your portal:") +
        button("See Your Leads", c.portalUrl || SITE) +
        small("Thanks for trusting us with your growth. Here's to the next milestone."),
    };
  },
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
  { id: "onboarding_nudge", label: "Onboarding Nudge", icon: "⏳", desc: "Auto-nudges a new client to finish their intake so campaigns can launch (day 2 + 5)." },
  { id: "lead_milestone", label: "Lead Milestone", icon: "🎉", desc: "Auto-celebrates a client hitting a lead milestone (10 / 25 / 50 / 100…)." },
];

// ── 🔴 WHAT A HAND-SENT EMAIL HAS TO RECORD ──────────────────────────────────
//
// Several of these emails also send themselves: stripe-webhook fires `welcome` on
// checkout and `receipt` / `past_due` on invoice events, billing-watch fires `renewal`,
// client-nurture fires `onboarding_access` and the intake nudges. Every one of those
// writes a flag onto `client.emailAuto` so it can never fire twice.
//
// Sending the SAME email by hand from the Emails tab used to write nothing but a comm-log
// line, which broke two things at once:
//   1. **The client gets it twice.** Bryson sent the welcome by hand the morning his first
//      client signed. The Stripe webhook would have sent a second one the moment that
//      client paid, because nothing recorded the first.
//   2. **The onboarding sequence never starts.** client-nurture gates the ad-account
//      request and the day 2 / day 5 intake nudges on `welcome`, and measures the delay
//      from `welcomeAt`. A manual welcome left both unset, so the sequence stayed silent.
//
// So: a hand-sent email counts as sent. The flag means "this has gone out", not "a robot
// sent it".
//
// 🔴 THE THREE THAT ARE DELIBERATELY ABSENT. `receipt` and `past_due` dedupe on a specific
// Stripe invoice id, and `onboarding_nudge` on which step of the sequence it was. A manual
// send genuinely does not know any of those, so guessing a value would be worse than
// recording nothing: it would suppress a real future send for a different invoice. They
// are left out on purpose, not by oversight.
export const EMAIL_AUTO_FLAGS = {
  welcome: (client, iso) => ({ welcome: true, welcomeAt: iso }),
  onboarding_access: () => ({ access: true }),
  // Keyed to the term it belongs to, exactly as billing-watch does it, so next term's
  // reminder still goes out.
  renewal: (client) => (client && client.contractEnd ? { renewalForEnd: client.contractEnd } : null),
};

// The patch to merge into `client.emailAuto` after sending `type` by hand, or null when
// this type records nothing.
export function emailAutoPatch(type, client, iso = new Date().toISOString()) {
  const fn = EMAIL_AUTO_FLAGS[type];
  if (!fn) return null;
  const patch = fn(client || {}, iso);
  return patch && Object.keys(patch).length ? patch : null;
}

export function renderClientEmail(type, ctx = {}) {
  const tpl = T[type];
  if (!tpl) throw new Error(`Unknown email type: ${type}`);
  const { subject, preheader, bodyHtml } = tpl(ctx);
  return { subject, html: emailShell({ preheader, bodyHtml }) };
}
