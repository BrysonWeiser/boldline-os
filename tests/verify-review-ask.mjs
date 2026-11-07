// Asking clients for a review of BoldLine, a month after they bought something (KB client-review-ask).
// Run: node tests/verify-review-ask.mjs
//
// Bryson, 2026-11-06: "we should make it so we automatically send something to our clients after a month of running
// ads or selling a website or service etc to them for them to give us a review". What this stops, worst first:
//  1. Asking a client whose ads never ran, or who has barely had a lead (an unhappy client asked writes an unhappy review).
//  2. Asking twice, or twice in one morning.
//  3. A client who bought something never being asked (a website bought outright was never asked before).
//  4. The email pointing nowhere useful: it must carry BoldLine's own Google review link when the profile is connected.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewAskDue, REVIEW_AFTER_DAYS, REVIEW_MIN_LEADS, googleWriteReviewUrl, boldlineReviewUrlFrom, paidInFullAt } from "../netlify/lib/review-ask.mjs";
import { renderClientEmail, EMAIL_TYPES } from "../netlify/lib/client-emails-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const NOW = Date.parse("2026-11-06T16:00:00Z");
const ago = (d) => new Date(NOW - d * 864e5).toISOString();
const leads = (n) => Array.from({ length: n }, (_, i) => ({ id: "l" + i, date: ago(5), status: "new" }));
const adsCl = (x = {}) => ({ packageId: "g-launch", email: "o@biz.co", contractStatus: "active", contractStart: ago(31),
  adPerf: { syncedAt: ago(0), totals: { impressions: 900, spend30d: 120 } }, leadsLog: leads(4), leads: 4, ...x });
const ON = { welcome: true };

// ── 1. Ads: a month live, really delivering, a few leads in ────────────────────────────────────────────────────────
ok("one month and a few leads, as asked", REVIEW_AFTER_DAYS === 30 && REVIEW_MIN_LEADS === 3);
ok("🔴 a month of ads with leads coming in: asked", reviewAskDue(adsCl(), ON, NOW).due && reviewAskDue(adsCl(), ON, NOW).path === "ads");
ok("not before a month from go-live", !reviewAskDue(adsCl({ contractStart: ago(25) }), ON, NOW).due);
ok("🔴 not if the ads never actually ran", !reviewAskDue(adsCl({ adPerf: { syncedAt: ago(0), totals: { impressions: 0, spend30d: 0 } } }), ON, NOW).due && !reviewAskDue(adsCl({ adPerf: {} }), ON, NOW).due);
ok("🔴 not while they have had fewer than a few leads (it waits, then asks the day they get there)",
  reviewAskDue(adsCl({ leadsLog: leads(2), leads: 2 }), ON, NOW).why === "not enough leads yet" && reviewAskDue(adsCl({ leadsLog: leads(3), leads: 3 }), ON, NOW).due);
ok("not a client whose contract has ended or who was never onboarded", !reviewAskDue(adsCl({ contractStatus: "cancelled" }), ON, NOW).due && !reviewAskDue(adsCl(), {}, NOW).due);
ok("🔴 never twice", !reviewAskDue(adsCl(), { ...ON, reviewAsked: true }, NOW).due);
ok("never BoldLine's own account, Bryson's businesses or a demo", !reviewAskDue(adsCl({ internal: true }), ON, NOW).due && !reviewAskDue(adsCl({ demo: true }), ON, NOW).due);

// ── 2. Websites: on our hosting, or bought outright ─────────────────────────────────────────────────────────────────
const site = (x = {}) => ({ packageId: "w-site", email: "o@biz.co", website: { published: true }, websiteDeal: { launchedAt: ago(31), ...x } });
ok("🔴 a site we host, live a month: asked", reviewAskDue(site(), {}, NOW).due && reviewAskDue(site(), {}, NOW).path === "website");
ok("not before a month live, not if it never went live, not while the plan is behind", !reviewAskDue(site({ launchedAt: ago(10) }), {}, NOW).due
  && !reviewAskDue({ ...site(), website: { published: false } }, {}, NOW).due && !reviewAskDue(site({ careSub: { status: "past_due" } }), {}, NOW).due);
const owned = (paidDaysAgo, x = {}) => ({ packageId: "w-site", email: "o@biz.co",
  websiteDeal: { mgmt: "own", plan: "full", price: 2500, invoices: { full: { paidAt: paidDaysAgo == null ? null : ago(paidDaysAgo), status: "paid" } }, ...x } });
ok("🔴 a website bought outright, a month after it was paid in full: asked (it never was before)", reviewAskDue(owned(31), {}, NOW).due && reviewAskDue(owned(31), {}, NOW).path === "owned", JSON.stringify(reviewAskDue(owned(31), {}, NOW)));
ok("not before a month, and not while it is unpaid", !reviewAskDue(owned(12), {}, NOW).due && !reviewAskDue(owned(null), {}, NOW).due && paidInFullAt(owned(null)) === null);
ok("paid in two halves: the month counts from the second", (() => { const c = owned(null, { plan: "half", invoices: { deposit: { paidAt: ago(60) }, final: { paidAt: ago(10) } } }); return paidInFullAt(c) === ago(10) && !reviewAskDue(c, {}, NOW).due; })());

// ── 3. The daily job ────────────────────────────────────────────────────────────────────────────────────────────────
const NU = src("netlify/functions/client-nurture.mjs");
ok("🔴 the daily job uses these rules, never in the same run as a celebration email", /const ask = !crossedMilestone \? reviewAskDue\(cl, ea\) : \{ due: false \};/.test(NU));
ok("it sends once and remembers why", /autoSendClientEmail\(cl, "review_request", \{ reviewGoogleUrl, reviewWhy: ask\.path \}\)/.test(NU) && /ea\.reviewAsked = true; ea\.reviewAskedAt = new Date\(\)\.toISOString\(\); ea\.reviewAskedFor = ask\.path;/.test(NU));
ok("the old 45-day and 10-lead rules are gone", !/REVIEW_MIN_DAYS|const REVIEW_MIN_LEADS = 10/.test(NU));

// ── 4. Where it points, and what it says ────────────────────────────────────────────────────────────────────────────
const G = googleWriteReviewUrl({ placeId: "ChIJ0123456789abcdef" });
ok("BoldLine's Google 'write a review' page comes from the connected profile", G === "https://search.google.com/local/writereview?placeid=ChIJ0123456789abcdef"
  && googleWriteReviewUrl({ placeId: "x\"><script>" }) === "" && googleWriteReviewUrl(null) === "");
ok("🔴 only from BoldLine's OWN profile, never a client's", boldlineReviewUrlFrom([{ data: { name: "Client", gbp: { placeId: "ChIJclientclientcl" } } }, { data: { internal: true, owned: true, gbp: { placeId: "ChIJownedbusiness" } } }]) === ""
  && boldlineReviewUrlFrom([{ data: { internal: true, gbp: { placeId: "ChIJ0123456789abcdef" } } }]) === G);
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const withG = renderClientEmail("review_request", { contactName: "Brendon Gibb", businessName: "Springbok Wellness", reviewGoogleUrl: G });
ok("🔴 with the profile connected, the main button is Google, the website form the other choice", withG.html.includes(`href="${G}"`) && /Leave a Google Review/.test(withG.html) && /write it on our website/.test(text(withG.html)));
ok("🔴 it no longer tells them a review of us 'helps you get found'", !/helps you get found/.test(text(withG.html)) && !/helps you get found/.test(text(renderClientEmail("review_request", { businessName: "X" }).html)));
ok("only a real Google review link is ever used as the button", !renderClientEmail("review_request", { businessName: "X", reviewGoogleUrl: "https://evil.example/x" }).html.includes("evil.example"));
const own = renderClientEmail("review_request", { contactName: "Al", businessName: "Tint Ninja", resultKind: "enquiry", reviewWhy: "owned" });
ok("a website bought outright is never told it is 'live' (they host it)", /has been yours for about a month now/.test(text(own.html)) && !/has been live/.test(text(own.html)));
ok("🔴 still the honest way out: reply and tell me", /reply to this instead and tell me/.test(text(withG.html)));
ok("🔴 no em dashes and no emojis", ![withG, own].some((r) => /[—–]/.test(text(r.html)) || /[\u{1F300}-\u{1FAFF}]/u.test(r.html)));
ok("the OS's email list says when it goes out now", /a month after ads go live \(with a few leads in\), a website goes live, or a website is bought outright/.test((EMAIL_TYPES.find((t) => t.id === "review_request") || {}).auto || ""));
ok("a preview or a send by hand gets the same Google link", /if \(body\.type === "review_request" && !ctx\.reviewGoogleUrl\) ctx\.reviewGoogleUrl = await boldlineReviewUrl\(supabase\);/.test(src("netlify/functions/client-email.mjs")));

console.log(`verify-review-ask: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
