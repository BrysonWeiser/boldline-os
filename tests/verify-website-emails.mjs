// The automatic emails a WEBSITE client gets (KB `website-builder`).
//
// Bryson, 2026-10-06: "make sure the website only clients get the automated emails just like ad clients
// do and make sure they are tailored to the website clients". Pins that each website moment sends its
// own email, that none of them talk about ads, leads or campaigns, that they read like a person wrote
// them (no dashes, no emojis), and that a website-only client never gets an ads email by accident.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderClientEmail, EMAIL_TYPES, emailAutoPatch } from "../netlify/lib/client-emails-shared.mjs";
import { buildClientCtx, isWebsiteOnly } from "../netlify/lib/client-email-auto.mjs";
import { applyWebsiteEvent, decideWebsiteEnvelope } from "../netlify/lib/website-deal.mjs";
import { lastMonth, monthlyFor, monthlyEligible } from "../netlify/functions/website-monthly-run.mjs";
import { runWatch } from "../netlify/functions/docusign-watch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const same = (l, a, b) => ok(l, a === b, `${a} vs ${b}`);
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ");

const WEB = ["website_welcome", "website_payment", "website_review", "website_live", "website_past_due", "blog_scheduled", "website_monthly"];
const T = { price: 1500, plan: "half", care: 99, blog: true, blogMonthly: 149, blogPosts: 4 };
const wclient = { id: "c1", name: "Acme Pools", contactName: "Jo Smith", email: "jo@acme.test", packageId: "w-site", portalToken: "tok", landingSlug: "acme",
  website: { content: {}, previewKey: "PK", published: true }, websiteDeal: { agreement: { status: "completed", terms: T } } };

// ── 1. Every website email, rendered the way the server really builds it ──────────────────
const ctx = buildClientCtx(wclient, { amount: 750, payUrl: "https://invoice.stripe.com/i/x", invoiceUrl: "https://invoice.stripe.com/i/x", stage: "deposit",
  postTitle: "How often to clean a pool", goesOut: "Thursday, Oct 8", month: "September", visitors: 120, views: 340, enquiries: 3, topSource: "Search engines", articles: 4 });
ok("the server knows a website-only client", isWebsiteOnly(wclient) && !isWebsiteOnly({ packageId: "g-launch" }));
ok("🔴 a website-only client's context speaks in enquiries, not leads", ctx.resultKind === "enquiry" && ctx.websiteOnly === true);
ok("the context carries their live address and private preview", ctx.siteUrl.endsWith("/site/acme/") && /\/site\/acme\/\?preview=PK$/.test(ctx.previewUrl));
ok("the context carries the deal's terms", ctx.plan === "half" && ctx.care === 99 && ctx.blog === true);
for (const id of WEB) {
  const t = EMAIL_TYPES.find((x) => x.id === id);
  ok(`${id} is listed in the Emails tab`, !!t);
  ok(`${id} is labelled automatic, with when`, !!(t && typeof t.auto === "string" && t.auto.length > 6));
  const r = renderClientEmail(id, ctx);
  const words = text(r.html) + " " + r.subject;
  ok(`${id} renders a usable subject`, r.subject.length > 8 && r.subject.length <= 78 && !/undefined|null|\$\{/.test(r.subject), r.subject);
  ok(`🔴 ${id} never mentions ads, leads or campaigns`, !/\b(leads?|campaigns?|ad spend|Meta)\b/i.test(words), words.match(/\b(leads?|campaigns?|ad spend|Meta)\b/i)?.[0]);
  ok(`🔴 ${id} has no dashes and no emojis`, !/[—–]/.test(words) && !/\p{Extended_Pictographic}/u.test(words));
  ok(`${id} never says "local businesses"`, !/local business/i.test(words));
  ok(`🔴 ${id} carries the website footer, not "ads, managed for you"`, /Websites built and looked after for you/.test(r.html) && !/ads, managed for you/.test(r.html));
  ok(`${id} leaves no placeholder`, !/undefined|\[object|\$\{|NaN/.test(text(r.html)));
}
const ads = renderClientEmail("receipt", buildClientCtx({ ...wclient, packageId: "g-launch" }, { amount: 100 }));
ok("an ads client's ads emails keep the ads footer", /ads, managed for you/.test(ads.html));

// The words that matter, per email.
const W = (id, extra = {}) => text(renderClientEmail(id, { ...ctx, ...extra }).html);
ok("the welcome links the first invoice and says the second half comes before launch", /Pay the Invoice/.test(W("website_welcome")) && /second half/.test(W("website_welcome")));
ok("a paid-up-front welcome never mentions a second half", !/second half/.test(W("website_welcome", { plan: "full" })));
ok("the first payment says building starts now", /building starts now/.test(W("website_payment", { stage: "deposit" })));
ok("the final payment says it goes live next", /goes live next/.test(renderClientEmail("website_payment", { ...ctx, stage: "final" }).subject));
ok("the care receipt says what the care plan covers", /hosting, security updates/.test(W("website_payment", { stage: "care" })));
ok("🔴 the review email links the PRIVATE preview", renderClientEmail("website_review", ctx).html.includes("?preview=PK"));
ok("the review email asks for the second half only when there is one to pay", /Pay the Second Half/.test(W("website_review")) && !/Pay the Second Half/.test(W("website_review", { payUrl: "" })));
ok("🔴 the live email links the live site, never the preview", renderClientEmail("website_live", ctx).html.includes('/site/acme/"') && !renderClientEmail("website_live", ctx).html.includes("preview="));
ok("🔴 the care past-due email states the 15 days in their agreement", /15 days/.test(W("website_past_due", { stage: "care" })) && !/15 days/.test(W("website_past_due", { stage: "deposit" })));
ok("the blog email names the article and the day it goes out, and says they can change it", /How often to clean a pool/.test(W("blog_scheduled")) && /Thursday, Oct 8/.test(W("blog_scheduled")) && /change anything/.test(W("blog_scheduled")));
ok("the monthly summary shows visitors, enquiries and where people came from", /120/.test(W("website_monthly")) && /Enquiries from the site/.test(W("website_monthly")) && /Search engines/.test(W("website_monthly")));
ok("a quiet month is explained rather than shown as a failure", /normal early on/.test(W("website_monthly", { enquiries: 0 })));
ok("the monthly upsell to ads is only for website-only clients", /Google Ads/.test(W("website_monthly")) && !/ask about Google Ads/.test(W("website_monthly", { websiteOnly: false })));

// ── 2. 🔴 The shared emails, for a website-only client ────────────────────────────────────
const ms = renderClientEmail("lead_milestone", { ...ctx, milestone: 10 });
ok("🔴 a website-only milestone counts enquiries from their website, not leads BoldLine delivered", /10 enquiries from your website/.test(text(ms.html)) && !/\bleads?\b|campaign/i.test(text(ms.html) + ms.subject), ms.subject);
const rv = renderClientEmail("review_request", ctx);
ok("🔴 a website-only review ask talks about their website, not campaigns", /new website has been live/.test(text(rv.html)) && !/\bleads?\b|campaign/i.test(text(rv.html)));
ok("the lead-gen review ask still reads exactly as it did", /has been running with us for a little while now and the leads are coming through/.test(text(renderClientEmail("review_request", { businessName: "X" }).html)));

// ── 3. The moments that send them ──────────────────────────────────────────────────────
const signed = decideWebsiteEnvelope({ ...wclient, websiteDeal: { agreement: { status: "sent", envelopeId: "e", terms: T } } }, { status: "completed" });
ok("🔴 signing the website agreement sends the welcome", signed.email === "website_welcome");
const ev = (type, meta, extra = {}) => ({ type, data: { object: { id: "in_1", metadata: meta, amount_paid: 75000, hosted_invoice_url: "https://invoice.stripe.com/i/1", lines: { data: [{ description: "Website build, first half", amount: 75000 }] }, ...extra } } });
const paid = applyWebsiteEvent(wclient, ev("invoice.paid", { kind: "website", stage: "deposit" }));
ok("🔴 a build payment sends the website receipt, worded for its stage, keyed to the invoice", paid.email === "website_payment" && paid.emailExtra.stage === "deposit" && paid.emailExtra.amount === 750 && paid.emailKey === "in_1" && paid.emailExtra.lines.length === 1);
const again = applyWebsiteEvent({ ...wclient, websiteDeal: paid.deal }, ev("invoice.paid", { kind: "website", stage: "deposit" }));
ok("🔴 a payment Stripe reports twice is receipted once", !again.email);
const care = applyWebsiteEvent(wclient, ev("invoice.paid", null, { parent: { subscription_details: { metadata: { kind: "website" } } } }));
ok("the monthly care payment sends a care receipt", care.email === "website_payment" && care.emailExtra.stage === "care");
const careZero = applyWebsiteEvent(wclient, ev("invoice.paid", null, { amount_paid: 0, parent: { subscription_details: { metadata: { kind: "website" } } } }));
ok("a $0 care invoice sends nothing", !careZero.email);
const failed = applyWebsiteEvent(wclient, ev("invoice.payment_failed", { kind: "website", stage: "final" }, { amount_due: 75000 }));
ok("🔴 a failed website payment sends the website past-due, with the pay link and what is owed", failed.email === "website_past_due" && failed.emailExtra.payUrl.includes("stripe") && failed.emailExtra.amount === 750);

const WH = src("netlify/functions/stripe-webhook.mjs");
const wb = WH.slice(WH.indexOf("if (websiteKind(obj))"), WH.indexOf("let patch = null"));
ok("🔴 the webhook sends after the deal is saved, never before", wb.indexOf(".update({ data: { ...(row.data || {}), websiteDeal: r.deal }") > 0 && wb.indexOf(".update({ data: { ...(row.data || {}), websiteDeal: r.deal }") < wb.indexOf("autoSendClientEmail(cur, r.email"));
ok("🔴 and dedupes on the Stripe invoice, so a retry never repeats it", /if \(!\(ea\.websiteSent \|\| \[\]\)\.includes\(key\)\)/.test(wb) && /ea\.websiteSent = \[key, \.\.\.\(ea\.websiteSent \|\| \[\]\)\]\.slice\(0, 40\)/.test(wb));
ok("🔴 an email failure never turns a recorded payment into an error Stripe retries", /catch \(e\) \{ console\.error\("stripe-webhook: website email failed:"/.test(wb));

// The watcher: the welcome goes out after the signature is saved, with the pay link, once.
{
  const saved = [], sent = [];
  const sentHalf = { ...wclient, websiteDeal: { agreement: { status: "sent", envelopeId: "e", terms: T } } };
  await runWatch({ loadClients: async () => [{ id: "c1", data: sentHalf }], fetchEnvelope: async () => ({ status: "completed" }),
    saveClient: async (id, d) => saved.push(d), alert: async () => {},
    sendEmail: async (cl, type, extra) => { sent.push({ type, extra, savedFirst: saved.length > 0 }); return { sent: true, logEntry: { note: "Sent welcome" } }; },
    createFirstInvoice: async () => ({ customerId: "cus", invoice: { id: "in_9", url: "https://invoice.stripe.com/i/9", amount: 750 } }) });
  ok("🔴 the watcher sends the website welcome after the signature is saved, with the first invoice's link", sent.length === 1 && sent[0].type === "website_welcome" && sent[0].savedFirst && sent[0].extra.payUrl.endsWith("/i/9") && sent[0].extra.amount === 750);
  ok("the send is logged and flagged on the record", saved.length === 2 && saved[1].emailAuto.websiteWelcome === true && saved[1].commLog[0].note === "Sent welcome");
  const s2 = [];
  await runWatch({ loadClients: async () => [{ id: "c1", data: { ...sentHalf, emailAuto: { websiteWelcome: true } } }], fetchEnvelope: async () => ({ status: "completed" }),
    saveClient: async () => {}, alert: async () => {}, sendEmail: async (cl, type) => { s2.push(type); return { sent: true, logEntry: {} }; }, createFirstInvoice: async () => ({ customerId: "c", invoice: { id: "i" } }) });
  ok("🔴 a welcome already sent by hand is not sent again", s2.length === 0);
}
ok("sending the welcome or the live email by hand records it, so the automatic one stands down", emailAutoPatch("website_welcome", {}).websiteWelcome === true && emailAutoPatch("website_live", {}).websiteLive === true);

const FN = src("netlify/functions/website-deal.mjs");
const launch = FN.slice(FN.indexOf('case "launch":'), FN.indexOf('case "sync":'));
ok("🔴 going live publishes the site in the same write, BEFORE the you're-live email goes", launch.indexOf("published: true") > 0 && launch.indexOf("published: true") < launch.indexOf('"website_live"'));
ok("🔴 you're-live is sent the first time only", /const first = !deal\.launchedAt && !\(cl\.emailAuto \|\| \{\}\)\.websiteLive;/.test(launch) && /if \(first\)/.test(launch));
const invc = FN.slice(FN.indexOf('case "invoice":'), FN.indexOf('case "send-review":'));
ok("🔴 the second-half invoice goes with the preview email, and only once the site is built", /stage === "final" && built \? await autoSendClientEmail\(cl, "website_review"/.test(invc) && /const built = !!\(cl\.website && cl\.website\.content && cl\.website\.previewKey && cl\.landingSlug\)/.test(invc));
const rev = FN.slice(FN.indexOf('case "send-review":'), FN.indexOf('case "launch":'));
ok("Bryson can email the preview himself, but not before there is a site or after it is live", /Build the site first/.test(rev) && /already live/.test(rev) && /autoSendClientEmail\(cl, "website_review", open\)/.test(rev));
ok("the preview email only carries a pay link for an open, unpaid second half", /fin && fin\.status === "open" && !fin\.paidAt && fin\.url/.test(rev));
const BW = src("netlify/functions/site-blog-write-background.mjs");
ok("🔴 a written article emails the client the title and the day it goes out", /autoSendClientEmail\(cl, "blog_scheduled", \{ postTitle: post\.title, goesOut: when\(publishAt\) \}\)/.test(BW) && BW.indexOf("await savePost(") < BW.indexOf('"blog_scheduled"'));
const UI = src("index.html");
ok("the OS has the button to email the preview, and asks first", /call\("send-review"/.test(UI) && /window\.confirm\(`Email \$\{client\.email\} the private preview link/.test(UI));

// ── 4. The monthly summary ─────────────────────────────────────────────────────────────
const NOW = Date.parse("2026-11-01T16:10:00Z");
const m = lastMonth(NOW);
ok("🔴 the month reported is the Arizona calendar month just ended", m.key === "2026-10" && m.label === "October" && new Date(m.from).toISOString() === "2026-10-01T07:00:00.000Z" && new Date(m.to).toISOString() === "2026-11-01T07:00:00.000Z");
ok("🔴 on New Year's Eve evening in Arizona (already Jan 1 in UTC) it still reports November", lastMonth(Date.parse("2027-01-01T03:00:00Z")).key === "2026-11");
const liveCl = { ...wclient, websiteDeal: { ...wclient.websiteDeal, launchedAt: "2026-09-01T00:00:00Z" },
  leadsLog: [{ source: "website", receivedAt: "2026-10-05T00:00:00Z" }, { source: "website", receivedAt: "2026-09-05T00:00:00Z" }, { source: "landing", receivedAt: "2026-10-06T00:00:00Z" }] };
const visits = [{ at: "2026-10-02T15:00:00Z", source: "Search", visitor: "a", path: "/" }, { at: "2026-10-02T15:01:00Z", source: "Internal", visitor: "a", path: "/about/" }, { at: "2026-10-20T15:00:00Z", source: "Direct", visitor: "b", path: "/" }];
const plan = monthlyFor(liveCl, visits, [{ slug: "x", publishAt: "2026-10-10T00:00:00Z" }, { slug: "y", publishAt: "2026-10-12T00:00:00Z", held: true }, { slug: "z", publishAt: "2026-09-10T00:00:00Z" }], NOW);
ok("the summary counts the month's visitors and page views", plan && plan.extra.visitors === 2 && plan.extra.views === 3, JSON.stringify(plan && plan.extra));
ok("🔴 enquiries are website ones from that month only", plan && plan.extra.enquiries === 1);
ok("articles are the ones that went out that month (held ones did not)", plan && plan.extra.articles === 1);
ok("where people came from is in plain words", plan && plan.extra.topSource === "Search engines");
ok("🔴 sent once a month (the record says which month went)", !monthlyEligible({ ...liveCl, emailAuto: { websiteMonthly: "2026-10" } }, NOW) && monthlyEligible(liveCl, NOW));
ok("🔴 never for a site that is not live, or went live under two weeks ago", !monthlyEligible({ ...liveCl, website: { ...liveCl.website, published: false } }, NOW) && !monthlyEligible({ ...liveCl, websiteDeal: { ...liveCl.websiteDeal, launchedAt: "2026-10-25T00:00:00Z" } }, NOW));
ok("never for BoldLine's own site or a client with no email", !monthlyEligible({ ...liveCl, internal: true }, NOW) && !monthlyEligible({ ...liveCl, email: "" }, NOW));
ok("🔴 no email at all when nobody visited (a zero would look like a broken site)", monthlyFor(liveCl, [], [], NOW) === null);
ok("🔴 no email when the visit numbers could not be read", monthlyFor(liveCl, null, [], NOW) === null);
const MR = src("netlify/functions/website-monthly-run.mjs");
ok("a failed visits read skips that client rather than sending zeros", /if \(error\) \{ console\.error\("website-monthly-run: visits read failed:"[^}]*skipped\+\+; continue; \}/.test(MR));
ok("the month is recorded after it sends", MR.indexOf('autoSendClientEmail(cl, "website_monthly"') < MR.indexOf("websiteMonthly: plan.key"));
const TOML = src("netlify.toml");
ok("🔴 it runs on the 1st at 9:10am Arizona time (16:10 UTC)", /\[functions\."website-monthly-run"\]\s*\n\s*schedule = "10 16 1 \* \*"/.test(TOML));

// ── 5. 🔴 A website-only client never gets an ads email ─────────────────────────────────
const NU = src("netlify/functions/client-nurture.mjs");
ok("🔴 the ads welcome (and everything that waits on it) needs an ads contract, which a website deal never sets", /if \(!ea\.welcome && \(cl\.contractSigned \|\| cl\.contractStatus === "active"\)\)/.test(NU));
const wrev = NU.slice(NU.indexOf("4b. THE SAME ASK"), NU.indexOf("} catch (e) { console.error(`client-nurture"));
ok("🔴 a website-only client is asked for a review once, six weeks after going live, not while a payment is failing",
  /!ea\.reviewAsked && !crossedMilestone && isWebsiteOnly\(cl\)/.test(wrev) && /liveDays >= REVIEW_MIN_DAYS/.test(wrev) && /careSub\.status === "past_due"/.test(wrev) && /ea\.reviewAsked = true/.test(wrev));

// ── 6. The OS Emails tab offers the right set ─────────────────────────────────────────
{
  const blk = UI.slice(UI.indexOf("const WEB_EMAIL_IDS="), UI.indexOf("\n};", UI.indexOf("const emailTypeFits=")) + 3);
  const live = (cl) => !!(cl && cl.websiteDeal && cl.websiteDeal.agreement && ["sent", "delivered", "completed"].includes(cl.websiteDeal.agreement.status));
  const fits = new Function("WEB_PKG_ID", "isWebsiteOnly", "wdAgreementLive", `${blk}; return emailTypeFits;`)("w-site", (cl) => !!cl && cl.packageId === "w-site", live);
  const ids = EMAIL_TYPES.map((t) => t.id);
  const shown = (cl) => ids.filter((id) => fits(id, cl));
  same("the OS list of website emails matches the server's", JSON.parse(UI.match(/const WEB_EMAIL_IDS=(\[[^\]]*\])/)[1]).sort().join(), WEB.slice().sort().join());
  ok("🔴 a website-only client is never offered the ads onboarding or an ads invoice", !["welcome", "onboarding_access", "onboarding_nudge", "invoice", "start_confirmed", "renewal", "receipt", "past_due"].some((id) => shown({ packageId: "w-site" }).includes(id)));
  ok("a website-only client is offered every website email", WEB.every((id) => shown({ packageId: "w-site" }).includes(id)));
  ok("an ads client with no website is not offered website emails", !shown({ packageId: "g-launch" }).some((id) => WEB.includes(id)) && shown({ packageId: "g-launch" }).includes("invoice"));
  ok("an ads client with a website deal gets both", shown({ packageId: "g-launch", websiteDeal: { agreement: { status: "sent" } } }).includes("website_live") && shown({ packageId: "g-launch", websiteDeal: { agreement: { status: "completed" } } }).includes("invoice"));
  ok("🔴 an ads client whose website deal fell through, or who only has a draft site, is not offered website emails",
    !shown({ packageId: "g-launch", websiteDeal: { agreement: { status: "declined" } } }).some((id) => WEB.includes(id))
    && !shown({ packageId: "g-launch", website: { content: { hero: {} } } }).some((id) => WEB.includes(id)));
  same("the OS knows which agreement states count as live, same as the server", (UI.match(/const WD_LIVE=(\[[^\]]*\])/) || [])[1], '["sent","delivered","completed"]');
}

// ── 7. 🔴 Regular ad clients get nothing about websites unless they are paying for one ─────────
// Bryson, 2026-10-06: "make sure that regular ad clients wont get anything regarding website stuff unless
// of course they are paying for it".
{
  const { hasWebsite } = await import("../netlify/lib/portal-website.mjs");
  const { _internal } = await import("../netlify/functions/portal.mjs");
  const adsCl = { id: "a1", name: "Ads Co", packageId: "g-launch", portalToken: "tok", email: "x@y.z" };
  ok("🔴 a regular ad client has no Website tab", !hasWebsite(adsCl) && !/show\('website'/.test(_internal.makePortalHTML(adsCl, _internal.findPkg("g-launch"), null)));
  ok("🔴 not even when a site draft sits on their record", !hasWebsite({ ...adsCl, website: { content: { hero: {} }, previewKey: "K" } }));
  ok("🔴 nor when a website deal fell through", !hasWebsite({ ...adsCl, websiteDeal: { agreement: { status: "declined" } } }) && !hasWebsite({ ...adsCl, websiteDeal: { agreement: { status: "voided" } } }));
  ok("an ad client who is buying a website gets the tab", hasWebsite({ ...adsCl, websiteDeal: { agreement: { status: "sent" } } }) && hasWebsite({ ...adsCl, websiteDeal: { agreement: { status: "completed" } } }));
  const PS = src("netlify/functions/portal.mjs");
  const req = PS.slice(PS.indexOf("if (body.websiteRequest"), PS.indexOf("// Approval decision from the portal"));
  ok("🔴 the portal refuses a website change request from a client with no website", /if \(!hasWebsite\(cur\)\) return \{ statusCode: 403/.test(req) && req.indexOf("!hasWebsite(cur)") < req.indexOf(".update("));
  ok("🔴 the blog actions need the blog in their deal", /if \(!termsOf\(cur\)\.blog\) return \{ statusCode: 403/.test(PS));
  ok("🔴 the preview email needs a SIGNED website agreement", rev.indexOf("if (!isSigned(cl)) return json") > 0 && rev.indexOf("if (!isSigned(cl)) return json") < rev.indexOf("autoSendClientEmail("));
  ok("🔴 the monthly summary needs a signed website deal", !monthlyEligible({ ...liveCl, websiteDeal: { ...liveCl.websiteDeal, agreement: { status: "declined", terms: T } } }, NOW));
  ok("🔴 an ad client with no website deal is never sent the monthly summary", !monthlyEligible({ ...adsCl, website: { published: true }, websiteDeal: { launchedAt: "2026-09-01T00:00:00Z" } }, NOW));
  // Every website event is tagged by the website code itself, so ordinary ads money never sends a website email.
  ok("🔴 an ordinary ads payment never sends a website email", applyWebsiteEvent(adsCl, ev("invoice.paid", { clientId: "a1" })) === null && applyWebsiteEvent(adsCl, ev("invoice.payment_failed", {})) === null);
  // None of the ads emails talk about websites.
  for (const id of EMAIL_TYPES.map((t) => t.id).filter((id) => !WEB.includes(id))) {
    const r = renderClientEmail(id, buildClientCtx(adsCl, { amount: 100, monthly: 400, leadCount: 3, leadRate: 50, leadTotal: 150, milestone: 10 }));
    ok(`🔴 the ads email ${id} says nothing about us building them a website`, !/new website|your website is|website build|care plan|blog article/i.test(text(r.html) + r.subject));
  }
  const NW = src("netlify/functions/client-nurture.mjs");
  ok("🔴 the website review ask is for website-only clients", /!ea\.reviewAsked && !crossedMilestone && isWebsiteOnly\(cl\)/.test(NW));
  const { blogActive } = await import("../netlify/lib/site-blog.mjs");
  ok("🔴 blog articles are only written for a client paying for the blog", !blogActive(adsCl) && !blogActive({ ...adsCl, website: { published: true, blogOn: true } })
    && !blogActive({ ...adsCl, websiteDeal: { agreement: { status: "completed", terms: { ...T, blog: false } }, launchedAt: "2026-09-01T00:00:00Z" } }));
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-website-emails: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
