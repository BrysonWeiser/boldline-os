// The website deal: its own short agreement, its own payments, and the two locks they open.
//
// Bryson, 2026-10-06: *"make sure that the option to build a website is only available after a client
// signs the agreement and pays (I also want to be able to modify the payment as I want and then allow
// the option for pay half now half when finished)"*, and the same day: the second half is due BEFORE the
// site goes live, and the monthly care plan starts at launch. KB `website-builder` (step 2).
//
// 🔴 WHY A SEPARATE AGREEMENT, NOT A SECTION IN THE ADS AGREEMENT. Websites are sold to anyone, including
// businesses that never buy ads, and a signed ads agreement can never gain a clause it was not signed
// with (KB `contract-terms-versioning`). So a website is its own short document, its own DocuSign
// envelope and its own payments, and ending one service never ends the other.
//
// 🔴 `cl.websiteDeal` IS SERVER-OWNED. The OS saves whole client records from the browser, so a screen
// opened before a payment landed could write the old "unpaid" state back over it. The OS therefore
// never writes this key (index.html `SERVER_OWNED_KEYS` re-reads it from the database on every save),
// and every change to it goes through netlify/functions/website-deal.mjs, the Stripe webhook or the
// DocuSign watcher.
//
// 🔴 THE LOCKS ARE ENFORCED ON THE SERVER, not only greyed out in the OS: site-build-background refuses
// to write a site while `buildLock` says no, and site.mjs will not show a site to the public while
// `publishLock` says no, whatever the `published` flag in the browser's copy says.
//
// Shape of `cl.websiteDeal` (every field optional):
//   price, plan ("full" | "half"), care            what Bryson set; editable until the agreement goes out
//   agreement { status, envelopeId, sentAt, sentTo, signedAt, terms{price,plan,care,version} }
//   invoices  { full | deposit | final: { id, url, amount, sentAt, status, paidAt } }
//   customerId                                      the client's Stripe customer (shared with ads billing)
//   care      { subscriptionId, status, startedAt, lastPaidAt, collection }
//   launchedAt

import { WEBSITE_OFFER } from "./pricing-shared.mjs";

export const DEAL_DEFAULTS = { price: WEBSITE_OFFER.build, plan: "full", care: WEBSITE_OFFER.care };
// WA-2 (2026-10-06): section 6 spells out that BoldLine manages the client's domain settings through access the
// client gives it, that the domain stays the client's, and what BoldLine may and may not do with that access.
// WA-3 (2026-10-07): setting up or changing how customers reach the business through the site (a quote form,
// online booking, their own booking link, or calling) is part of the work and never a round of changes
// (Bryson: "it won't count as one of the two client edits because it's just to fit how their business
// takes clients").
// WA-4 (2026-10-09): the optional Business Email Setup add-on (section 6a). Connecting the domain stays included.
export const AGREEMENT_VERSION = "WA-4";
export const PLANS = { full: "Paid in full up front", half: "Half now, half before launch" };

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : d; };
const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const dealOf = (cl) => {
  const d = (cl && cl.websiteDeal) || {};
  return {
    ...d,
    price: num(d.price, DEAL_DEFAULTS.price),
    plan: d.plan === "half" ? "half" : "full",
    care: num(d.care, DEAL_DEFAULTS.care),
    agreement: d.agreement || null,
    invoices: d.invoices || {},
  };
};

// An agreement that is out for signature or signed fixes the terms. A declined or voided one does not:
// Bryson changes the price and sends a fresh one.
const LIVE_AGREEMENT = ["sent", "delivered", "completed"];
export const agreementLive = (cl) => { const a = dealOf(cl).agreement; return !!(a && LIVE_AGREEMENT.includes(a.status)); };
export const isSigned = (cl) => { const a = dealOf(cl).agreement; return !!(a && a.status === "completed"); };

// Every term, with defaults. Agreements sent before add-ons existed carry none of the add-on fields,
// which read as "no extra pages, no blog", exactly what they were signed with.
const int = (v, d, max) => Math.max(0, Math.min(max, Math.floor(num(v, d))));
export const normTerms = (t0) => {
  const t = t0 || {};
  return {
    price: num(t.price, DEAL_DEFAULTS.price), plan: t.plan === "half" ? "half" : "full", care: num(t.care, DEAL_DEFAULTS.care),
    extraPages: int(t.extraPages, 0, 20), extraPagePrice: num(t.extraPagePrice, WEBSITE_OFFER.extraPage),
    blog: t.blog === true, blogSetup: num(t.blogSetup, WEBSITE_OFFER.blogSetup), blogMonthly: num(t.blogMonthly, WEBSITE_OFFER.blogMonthly),
    blogPosts: Math.max(1, int(t.blogPosts, WEBSITE_OFFER.blogPostsPerMonth, 8)),
    emailSetup: t.emailSetup === true, emailSetupPrice: num(t.emailSetupPrice, WEBSITE_OFFER.emailSetup),
  };
};
const r2 = (n) => Math.round(n * 100) / 100;
// One-time: the website, its extra pages and the blog setup. Monthly: care plus the blog.
export const buildTotal = (t0) => { const t = normTerms(t0); return r2(t.price + t.extraPages * t.extraPagePrice + (t.blog ? t.blogSetup : 0) + (t.emailSetup ? t.emailSetupPrice : 0)); };
export const monthlyTotal = (t0) => { const t = normTerms(t0); return r2(t.care + (t.blog ? t.blogMonthly : 0)); };

// The terms that bind: the ones frozen into the agreement once it went out, else the ones being set.
export const termsOf = (cl) => {
  const d = dealOf(cl);
  return normTerms(agreementLive(cl) && d.agreement.terms ? d.agreement.terms : d);
};

// Money, in cents so an odd price never loses a cent: the deposit takes the odd one.
export const amountsOf = (terms) => {
  const priceC = Math.round(buildTotal(terms) * 100);
  if (terms.plan === "half") {
    const firstC = Math.ceil(priceC / 2);
    return { firstStage: "deposit", first: firstC / 100, final: (priceC - firstC) / 100, stages: ["deposit", "final"] };
  }
  return { firstStage: "full", first: priceC / 100, final: 0, stages: ["full"] };
};

const paid = (d, stage) => !!(d.invoices[stage] && d.invoices[stage].paidAt);
// A stage with nothing to pay (Bryson set the price to $0) counts as paid, or a free build could never unlock.
const stagePaid = (cl, stage) => { const m = amountsOf(termsOf(cl)); const due = stage === "final" ? m.final : m.first; return !(due > 0) || paid(dealOf(cl), stage); };

// BoldLine's own site (the house account) has nobody to sign with or pay.
export const exempt = (cl) => !!(cl && cl.internal);

export const firstPaid = (cl) => stagePaid(cl, amountsOf(termsOf(cl)).firstStage);
export const fullyPaid = (cl) => amountsOf(termsOf(cl)).stages.every((s) => stagePaid(cl, s));

// Null when unlocked, else the plain-English reason shown on the button.
export function buildLock(cl) {
  if (exempt(cl)) return null;
  const a = dealOf(cl).agreement;
  if (!a || !LIVE_AGREEMENT.includes(a.status)) return "Send the website agreement first. The build unlocks once it is signed and the first payment is in.";
  if (a.status !== "completed") return "Waiting for the client to sign the website agreement.";
  if (!firstPaid(cl)) return `Signed. Waiting for the first payment (${money(amountsOf(termsOf(cl)).first)}).`;
  return null;
}
export function publishLock(cl) {
  if (exempt(cl)) return null;
  const b = buildLock(cl);
  if (b) return b;
  if (!fullyPaid(cl)) return `Waiting for the final payment (${money(amountsOf(termsOf(cl)).final)}). The site can't go live until it's paid.`;
  return null;
}

// What happens next, for the OS card. One line, plain English.
export function nextStep(cl) {
  if (exempt(cl)) return "This is BoldLine's own site, so there is nothing to sign or pay.";
  const d = dealOf(cl), t = termsOf(cl), m = amountsOf(t), a = d.agreement;
  if (!a || !LIVE_AGREEMENT.includes(a.status)) return "Set the price and payment plan, then send the agreement.";
  if (a.status !== "completed") return "Agreement sent. As soon as they sign, the first invoice goes to them by itself.";
  if (!firstPaid(cl)) return d.invoices[m.firstStage] ? `Invoice for ${money(m.first)} sent. The build unlocks the moment it's paid.` : "Signed. Send the first invoice.";
  if (!fullyPaid(cl)) return d.invoices.final ? `Final invoice for ${money(m.final)} sent. Going live unlocks the moment it's paid.` : "Build the site. When it's finished, send the final invoice.";
  if (!d.launchedAt) return monthlyTotal(t) > 0 ? `Paid in full. Putting it live starts the ${money(monthlyTotal(t))} a month plan.` : "Paid in full. Put it live whenever it's ready.";
  return "Live.";
}

// ── The agreement ────────────────────────────────────────────────────────────────────────
// Written plainly and without dashes, like everything else a client reads. DRAFT FOR ATTORNEY REVIEW,
// same as the advertising agreement. `/BL_SIGN_HERE/` is where DocuSign puts the signature box.
export function websiteAgreementHTML(cl, terms = termsOf(cl), { now = new Date() } = {}) {
  const c = cl || {};
  const t = normTerms(terms);
  const m = amountsOf(t);
  const total = buildTotal(t), monthly = monthlyTotal(t);
  const parts = [`${money(t.price)} website`].concat(t.extraPages ? [`${t.extraPages} extra page${t.extraPages > 1 ? "s" : ""} at ${money(t.extraPagePrice)} each`] : [], t.blog ? [`${money(t.blogSetup)} blog setup`] : [], t.emailSetup ? [`${money(t.emailSetupPrice)} business email setup`] : []);
  const biz = esc(c.name || "Client");
  const signer = esc(c.contactName || c.name || "Authorized Signatory");
  const email = esc(c.email || "");
  const addr = esc(c.businessAddress || "");
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
  const no = `BLW-${String(c.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "000000"}`;
  const pay = t.plan === "half"
    ? `<p>The Build Fee is paid in two parts: <strong>${money(m.first)}</strong> when this Agreement is signed, and <strong>${money(m.final)}</strong> when the Website is finished and before it goes live. Work starts when the first payment is received. <strong>The Website will not be published until the second payment is received.</strong></p>`
    : `<p>The Build Fee of <strong>${money(total)}</strong> is paid in full when this Agreement is signed. Work starts when it is received.</p>`;
  const care = t.care > 0
    ? `<p>The Care Plan costs <strong>${money(t.care)} per month</strong>. It starts on the day the Website goes live and is billed monthly in advance.</p>`
    : `<p>The Care Plan fee is waived. BoldLine will host and look after the Website at no monthly charge.</p>`;
  const blog = t.blog ? `<h2>7a. The blog</h2>
<p>BoldLine will add a blog to the Website and publish about <strong>${t.blogPosts} new article${t.blogPosts > 1 ? "s" : ""} a month</strong> on it, written for Client&rsquo;s customers from what Client tells BoldLine about the business. The Blog Plan costs <strong>${money(t.blogMonthly)} per month</strong>, starts on the day the Website goes live, and is billed with the Care Plan.</p>
<p>Each article is available for Client to read before or after it is published, and BoldLine will change or remove any article Client asks it to. Articles will not state facts about Client&rsquo;s business that Client has not given BoldLine, and will not promise results. Client may cancel the Blog Plan at any time with thirty (30) days&rsquo; written notice; articles already published stay on the Website. The blog needs the Care Plan, so ending the Care Plan ends the Blog Plan too.</p>` : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Website Agreement</title><style>
body{font-family:Georgia,serif;color:#1a1a1a;max-width:760px;margin:0 auto;padding:36px 28px;font-size:13px;line-height:1.7}
h1{font-size:22px;text-align:center;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:22px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;border:1px solid #ddd;padding:14px;border-radius:6px;font-size:12px}
.pl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0}td{border:1px solid #ddd;padding:7px 9px;vertical-align:top}td:first-child{width:38%;color:#555}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:30px}.sig-line{border-bottom:1px solid #111;height:34px;margin:6px 0 4px}
.ft{margin-top:26px;font-size:10px;color:#888;text-align:center}</style></head><body>
<h1>Website Design and Care Agreement</h1><div class="sub">Agreement No. ${no} &middot; Version ${AGREEMENT_VERSION} &middot; ${esc(date)}</div>
<div class="parties"><div><div class="pl">BoldLine</div><strong>BoldLine Media LLC</strong><br>an Arizona limited liability company<br>Bryson Weiser, Owner<br>bryson@boldlinemedia.com<br>(&ldquo;BoldLine&rdquo;)</div>
<div><div class="pl">Client</div><strong>${biz}</strong><br>${signer}${email ? `<br>${email}` : ""}${addr ? `<br>${addr}` : ""}<br>(&ldquo;Client&rdquo;)</div></div>

<h2>Key terms</h2><table>
<tr><td>Build Fee</td><td>${money(total)}${parts.length > 1 ? ` (${parts.join(", ")})` : ""}</td></tr>
<tr><td>Payment</td><td>${t.plan === "half" ? `${money(m.first)} on signing, ${money(m.final)} before the Website goes live` : `${money(total)} on signing`}</td></tr>
<tr><td>Care Plan</td><td>${t.care > 0 ? `${money(t.care)} per month, starting the day the Website goes live` : "Waived"}</td></tr>
${t.blog ? `<tr><td>Blog Plan</td><td>${money(t.blogMonthly)} per month for about ${t.blogPosts} article${t.blogPosts > 1 ? "s" : ""} a month, starting the day the Website goes live</td></tr>
` : ""}<tr><td>Included</td><td>A website of five pages (Home, Services, About, Reviews, Contact)${t.extraPages ? ` plus ${t.extraPages} extra page${t.extraPages > 1 ? "s" : ""} agreed with Client` : ""}${t.blog ? ", a blog" : ""}${t.emailSetup ? ", business email set up on Client&rsquo;s domain" : ""}, a contact form that sends enquiries to Client, mobile friendly design, two rounds of changes before launch</td></tr>
</table>

<h2>1. What BoldLine builds</h2>
<p>BoldLine will design, write and build a website for Client with five pages: Home, Services, About, Reviews and Contact${t.extraPages ? `, plus ${t.extraPages} extra page${t.extraPages > 1 ? "s" : ""} on subjects Client and BoldLine agree in writing (email is fine)` : ""}${t.blog ? ", and a blog (section 7a)" : ""} (the &ldquo;Website&rdquo;). Client chooses one of the designs BoldLine offers. The Website works on phones, tablets and computers, and its contact form sends enquiries to Client.</p>
<p>BoldLine writes the words from what Client tells it about the business. Client reviews them before launch and is responsible for confirming they are accurate. BoldLine will not state facts about Client&rsquo;s business that Client has not given it.</p>

<h2>2. What Client provides</h2>
<p>Client will provide the information BoldLine reasonably asks for, its logo if it has one, and photos of its own work and team where it can. Until Client&rsquo;s own photos are provided, BoldLine may use licensed stock photos, which will never be presented as Client&rsquo;s own work. Client confirms it has the right to use everything it provides, and that the Website may display it.</p>

<h2>3. Price and payment</h2>
${pay}
<p>Payments are made by card or bank transfer through a secure invoice from BoldLine&rsquo;s payment processor, and are due within seven (7) days of the invoice. Once BoldLine has started work, payments already made are not refunded, except as set out in section 5.</p>

<h2>4. Changes before launch</h2>
<p>Two rounds of changes before launch are included. A round is one list of changes sent together. New pages, a different design after work has started, or changes beyond two rounds are quoted separately and only done if Client agrees to the quote in writing.</p>
<p>Setting up, and later changing, how customers reach Client through the website (a quote form, online booking, a link to a booking system Client already uses, or calling) is part of the build and the care plan. It never counts as a round of changes and is never charged separately.</p>

<h2>5. Timing</h2>
<p>BoldLine aims to have a first version ready for Client to review within fourteen (14) days of receiving the first payment and the information it needs. If BoldLine has not delivered a first version within sixty (60) days of receiving both, Client may end this Agreement by written notice and receive a refund of the Build Fee paid.</p>
<p>If Client does not respond to BoldLine for sixty (60) days in a row while the Website is being built, BoldLine may close the project by written notice. Payments already made are not refunded, and nothing further is owed for the build.</p>

<h2>6. Going live and the domain</h2>
<p>When the Website is finished, paid for in full and approved by Client, BoldLine will publish it on Client&rsquo;s domain name. Client owns its domain name and keeps it registered in its own name, at its own cost. If Client does not have one, BoldLine will help Client register one in Client&rsquo;s name.</p>
<p>BoldLine manages the domain&rsquo;s settings for Client, so Client does not need anyone else to look after the Website. To do this, Client will give BoldLine access to the account where the domain is registered, limited to managing its settings where the provider allows it, for as long as BoldLine hosts the Website. BoldLine will use that access only to connect the domain to the Website and keep it working. Without Client&rsquo;s written approval (email is fine), BoldLine will not transfer the domain, change who owns it, cancel it, or change the settings Client&rsquo;s email depends on. Keeping the domain renewed and paid for remains Client&rsquo;s responsibility.</p>
<p>The domain and the account stay Client&rsquo;s at all times, and Client may remove BoldLine&rsquo;s access whenever it chooses. While BoldLine hosts the Website, removing that access or changing those settings may stop the Website working on the domain, which will not be a breach by BoldLine. When BoldLine stops hosting the Website, it will stop using the access, and on request will tell Client exactly which settings it made so they can be pointed wherever Client chooses. This does not depend on any amount being owed.</p>

${t.emailSetup ? `<h2>6a. Business email setup</h2>
<p>BoldLine will set up email on Client&rsquo;s domain (for example hello@ followed by Client&rsquo;s domain) with an email provider Client chooses, such as Google Workspace or Microsoft 365. The email account is in Client&rsquo;s name and Client pays the provider directly for it; that monthly fee is not part of this Agreement. Setup includes creating the mailbox or mailboxes Client asks for (up to three), adding the domain settings email needs, checking that mail sends and arrives, and connecting the address so emails the Website sends to Client&rsquo;s customers come from it. It is a one-time service, included in the Build Fee shown above.</p>
` : ""}
<h2>7. The Care Plan</h2>
${care}
<p>The Care Plan covers hosting, security updates, keeping the Website online, and up to two small content changes per month (for example text, photos, hours or prices). Larger changes are quoted separately. Client may cancel the Care Plan at any time with thirty (30) days&rsquo; written notice. If a Care Plan invoice is unpaid fifteen (15) days after its due date, BoldLine may take the Website offline until it is paid.</p>

${blog}

<h2>8. Who owns what</h2>
<p>Once the Build Fee is paid in full, Client owns the words written for the Website, and always owns its own name, logo, photos, content and domain. BoldLine keeps ownership of its design templates, code and tools, and grants Client a license to use them as part of the Website. If the Care Plan ends, and once everything owed has been paid, BoldLine will on request provide a copy of the Website&rsquo;s pages and images as standard web files, which Client may host anywhere and keep using.</p>

<h2>9. No guarantees about results</h2>
<p>BoldLine will build the Website with care and skill. BoldLine does not guarantee any particular search ranking, number of visitors, enquiries or sales, and is not responsible for services it does not control, such as domain registrars, search engines, email providers or Client&rsquo;s own systems.</p>

<h2>10. Limit of liability</h2>
<p>Neither party is liable for indirect or consequential losses, including lost profits. BoldLine&rsquo;s total liability under this Agreement is limited to the amounts Client paid BoldLine under it in the twelve (12) months before the claim.</p>

<h2>11. Other services</h2>
<p>This Agreement covers the Website only. Any advertising or other service BoldLine provides is covered by its own agreement, and ending one does not end the other.</p>

<h2>12. Law and disputes</h2>
<p>This Agreement is governed by the laws of the State of Arizona. The parties will first try in good faith to settle any dispute by talking for thirty (30) days after written notice. Any dispute not settled that way will be decided by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, by one arbitrator, seated in Arizona, with remote hearings available. Either party may bring an individual claim in small claims court instead.</p>

<h2>13. General</h2>
<p>This is the entire agreement about the Website. Changes must be in writing and agreed by both parties, which may be by email. If any part is unenforceable, the rest still applies. Notices may be sent by email to the addresses above. The parties agree this Agreement may be signed electronically, including through DocuSign, and that electronic signatures are valid and binding under the U.S. E-SIGN Act and the Arizona Electronic Transactions Act.</p>

<div class="sigs"><div><div class="pl">BoldLine Media LLC</div><div style="margin:6px 0 4px">Issued by BoldLine Media LLC</div><div style="font-size:11px">Bryson Weiser, Owner</div></div>
<div><div class="pl">Client: ${biz}</div><div class="sig-line"><span style="color:#fff;font-size:9px">/BL_SIGN_HERE/</span></div><div style="font-size:11px">${signer}</div><div style="font-size:11px;color:#666">Date: _______________</div></div></div>
<div class="ft">BoldLine Media LLC &middot; Arizona, USA &middot; Website Agreement No. ${no}</div>
</body></html>`;
}

// ── The DocuSign side ───────────────────────────────────────────────────────────────────
// Which clients have a website envelope worth asking DocuSign about.
export const needsWebsiteCheck = (cl) => {
  const a = dealOf(cl).agreement;
  return !!(a && a.envelopeId && ["sent", "delivered"].includes(a.status) && !exempt(cl));
};

// Pure: an envelope in, what to change out. Same discipline as docusign-status.mjs: an unknown or
// missing status changes nothing, and "delivered" (opened) is NOT signed.
export function decideWebsiteEnvelope(cl, envelope, now = new Date()) {
  const none = { deal: null, alert: null, signed: false };
  if (!needsWebsiteCheck(cl)) return none;
  const status = String((envelope || {}).status || "").toLowerCase();
  const d = (cl && cl.websiteDeal) || {};
  const a = d.agreement || {};
  const name = (cl && cl.name) || "A client";
  const at = (envelope || {}).completedDateTime || (envelope || {}).statusChangedDateTime || now.toISOString();
  const withA = (patch) => ({ ...d, agreement: { ...a, ...patch } });
  if (status === "completed") return {
    deal: withA({ status: "completed", signedAt: at }), signed: true,
    // The client's own welcome, sent by the watcher once this is saved (KB `website-builder`).
    email: "website_welcome",
    alert: { severity: "green", title: `${name} signed the website agreement`, body: `${name} signed the website agreement. The first invoice is being sent to them now, and the build unlocks the moment it's paid.`, smsText: `${name} signed the website agreement.` },
  };
  if (status === "declined" || status === "voided") return {
    deal: withA({ status }), signed: false,
    alert: { severity: "red", title: `${name}'s website agreement was ${status}`, body: `The website agreement for ${name} was ${status}. Call them today. You can change the price and send a fresh one from their Website tab.`, smsText: `${name}'s website agreement was ${status}.` },
  };
  if (status === "sent" || status === "delivered") return a.status === status ? none : { deal: withA({ status }), alert: null, signed: false };
  return none;
}

// ── The Stripe side ─────────────────────────────────────────────────────────────────────
// Website money is tagged `kind: "website"` on the invoice (build payments) or on the subscription
// (the care plan), so the webhook can keep it away from the ads billing status entirely.
export const websiteKind = (obj) => {
  const o = obj || {};
  if (o.metadata && o.metadata.kind === "website") return { stage: o.metadata.stage || "", care: o.metadata.stage === "care" || o.object === "subscription" };
  const sd = o.subscription_details && o.subscription_details.metadata;
  if (sd && sd.kind === "website") return { stage: "care", care: true };
  const pd = o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata;
  if (pd && pd.kind === "website") return { stage: "care", care: true };
  return null;
};

// Pure: a Stripe event in, the new deal and anything worth telling Bryson out.
// What a receipt lists, and what a failed payment still owes, read off the Stripe invoice.
const invLines = (obj) => (((obj || {}).lines || {}).data || []).map((l) => ({ description: String(l.description || "Charge"), amount: (l.amount || 0) / 100 }));
const dueOf = (obj) => (((obj || {}).amount_remaining != null ? obj.amount_remaining : (obj || {}).amount_due) || 0) / 100;
export function applyWebsiteEvent(cl, event, now = new Date()) {
  const obj = (event && event.data && event.data.object) || {};
  const k = websiteKind(obj);
  if (!k) return null;
  const d = (cl && cl.websiteDeal) || {};
  const name = (cl && cl.name) || "A client";
  const iso = now.toISOString();
  if (!k.care && ["full", "deposit", "final"].includes(k.stage)) {
    const inv = (d.invoices || {})[k.stage] || {};
    if (event.type === "invoice.paid") {
      if (inv.paidAt) return { deal: d, alert: null };
      const amount = typeof obj.amount_paid === "number" ? obj.amount_paid / 100 : inv.amount;
      const deal = { ...d, invoices: { ...(d.invoices || {}), [k.stage]: { ...inv, id: inv.id || obj.id, status: "paid", paidAt: iso, amount } } };
      const what = k.stage === "final" ? "the final website payment. The site can go live" : "the website payment. You can build the site now";
      // 🔴 The client's receipt, worded for where the build is. `emailKey` is the Stripe invoice, so a
      // retried webhook never sends it twice.
      return { deal, email: "website_payment", emailKey: obj.id || `${k.stage}-paid`, emailExtra: { stage: k.stage, amount, invoiceUrl: obj.hosted_invoice_url || "", lines: invLines(obj) }, alert: { severity: "green", title: `${name} paid ${money(amount)} for their website`, body: `${name} paid ${what}.`, smsText: `${name} paid ${money(amount)} for their website.` } };
    }
    if (event.type === "invoice.payment_failed") {
      return { deal: { ...d, invoices: { ...(d.invoices || {}), [k.stage]: { ...inv, status: "failed" } } },
        email: "website_past_due", emailKey: `failed-${obj.id || k.stage}`, emailExtra: { stage: k.stage, amount: dueOf(obj), payUrl: obj.hosted_invoice_url || inv.url || "" },
        alert: { severity: "yellow", title: `${name}'s website payment failed`, body: `A website payment from ${name} did not go through. Stripe will ask them to try again; a call usually sorts it faster.`, smsText: `${name}'s website payment failed.` } };
    }
    return { deal: d, alert: null };
  }
  const care = d.careSub || {};
  if (event.type === "invoice.paid") return { deal: { ...d, careSub: { ...care, status: "active", lastPaidAt: iso } }, alert: null,
    ...((obj.amount_paid || 0) > 0 ? { email: "website_payment", emailKey: obj.id || `care-${iso.slice(0, 7)}`, emailExtra: { stage: "care", amount: obj.amount_paid / 100, invoiceUrl: obj.hosted_invoice_url || "", lines: invLines(obj) } } : {}) };
  if (event.type === "invoice.payment_failed") return { deal: { ...d, careSub: { ...care, status: "past_due" } },
    email: "website_past_due", emailKey: `failed-${obj.id || iso.slice(0, 10)}`, emailExtra: { stage: "care", amount: dueOf(obj), payUrl: obj.hosted_invoice_url || "" },
    alert: { severity: "yellow", title: `${name}'s website care payment failed`, body: `The monthly website care payment from ${name} did not go through. Stripe will retry. Under the agreement the site may be taken offline once it is 15 days overdue.`, smsText: `${name}'s care plan payment failed.` } };
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const map = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "canceled", incomplete_expired: "canceled" };
    const status = event.type === "customer.subscription.deleted" ? "canceled" : (map[obj.status] || care.status || "");
    return { deal: { ...d, careSub: { ...care, subscriptionId: obj.id || care.subscriptionId, status } }, alert: null };
  }
  return { deal: d, alert: null };
}

// Stripe calls, with Stripe passed in so the shape of every request is testable without the network.
// `api` = { stripe, ensureCustomer, resolvePaymentMethod } from stripe-shared.mjs.
const dollarsToCents = (n) => Math.round(Number(n) * 100);

// One build payment as a Stripe invoice: a hosted page that never expires (a Checkout link dies after
// 24 hours, which is useless in an email), card or bank transfer, due in seven days, and Stripe emails
// it to the client itself.
export async function createWebsiteInvoice(cl, stage, api) {
  const t = termsOf(cl), m = amountsOf(t);
  if (!isSigned(cl) && !exempt(cl)) throw new Error("The website agreement isn't signed yet.");
  if (!m.stages.includes(stage)) throw new Error(`This deal has no ${stage} payment.`);
  if (stage === "final" && !stagePaid(cl, "deposit")) throw new Error("The first half hasn't been paid yet.");
  const amount = stage === "final" ? m.final : m.first;
  if (!(amount > 0)) throw new Error("There is nothing to charge.");
  if (!cl.email) throw new Error("Add the client's email on the Overview tab first.");
  const customerId = await api.ensureCustomer(dealOf(cl).customerId || cl.stripeCustomerId, { email: cl.email, name: cl.name, clientId: cl.id });
  const label = stage === "deposit" ? "Website build, first half" : stage === "final" ? "Website build, second half" : "Website build";
  const meta = { clientId: cl.id, kind: "website", stage };
  const inv = await api.stripe("invoices", { body: { customer: customerId, collection_method: "send_invoice", days_until_due: 7, auto_advance: "false",
    pending_invoice_items_behavior: "exclude", description: `${label} for ${cl.name || "your business"}`, metadata: meta, payment_settings: { payment_method_types: ["card", "us_bank_account"] } } });
  await api.stripe("invoiceitems", { body: { customer: customerId, invoice: inv.id, amount: dollarsToCents(amount), currency: "usd", description: label, metadata: meta } });
  const fin = await api.stripe(`invoices/${encodeURIComponent(inv.id)}/finalize`, { body: { auto_advance: "false" } });
  let sent = true;
  try { await api.stripe(`invoices/${encodeURIComponent(inv.id)}/send`, {}); } catch { sent = false; }
  return { customerId, invoice: { id: inv.id, url: fin.hosted_invoice_url || "", amount, sentAt: new Date().toISOString(), status: "open", emailed: sent } };
}

// The care plan, started when the site goes live. Charged automatically if a card is already on file
// (from ads billing or the portal), otherwise Stripe emails a monthly invoice.
export async function startCarePlan(cl, api) {
  const t = termsOf(cl);
  if (!(monthlyTotal(t) > 0)) return null;
  const d = dealOf(cl);
  if (d.careSub && d.careSub.subscriptionId && d.careSub.status !== "canceled") return { careSub: d.careSub, customerId: d.customerId };
  const customerId = await api.ensureCustomer(d.customerId || cl.stripeCustomerId, { email: cl.email, name: cl.name, clientId: cl.id });
  const pm = await api.resolvePaymentMethod(customerId, null);
  const meta = { clientId: cl.id, kind: "website", stage: "care" };
  const items = [];
  if (t.care > 0) {
    const product = await api.stripe("products", { body: { name: `Website care plan, ${cl.name || "client"}`, metadata: meta } });
    items.push({ price_data: { currency: "usd", product: product.id, unit_amount: dollarsToCents(t.care), recurring: { interval: "month" } } });
  }
  if (t.blog && t.blogMonthly > 0) {
    const product = await api.stripe("products", { body: { name: `Website blog plan, ${cl.name || "client"}`, metadata: meta } });
    items.push({ price_data: { currency: "usd", product: product.id, unit_amount: dollarsToCents(t.blogMonthly), recurring: { interval: "month" } } });
  }
  const sub = await api.stripe("subscriptions", { body: {
    customer: customerId, metadata: meta,
    items,
    ...(pm ? { collection_method: "charge_automatically", default_payment_method: pm } : { collection_method: "send_invoice", days_until_due: 7 }),
  } });
  return { customerId, careSub: { subscriptionId: sub.id, status: sub.status === "active" ? "active" : (sub.status || "incomplete"), startedAt: new Date().toISOString(), collection: pm ? "card" : "invoice" } };
}
