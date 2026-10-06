// The website deal: agreement, payments, and the two locks they open.
// Run: node tests/verify-website-deal.mjs
//
// Bryson, 2026-10-06: no website is built until the client has signed and paid; the price and plan are his
// to set (in full, or half now and half when finished); the second half is due BEFORE it goes live; the
// care plan starts at launch. KB `website-builder`. Every check RUNS the code; the 🔴 ones cost a client
// money or trust if they slip.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as L from "../netlify/lib/website-deal.mjs";
import { runWatch } from "../netlify/functions/docusign-watch.mjs";
import { gateView, viewFor } from "../netlify/functions/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const t = async (l, fn) => { try { await fn(); } catch (e) { fails.push(`${l} — threw ${e.message}`); } };

const base = { id: "c1", name: "Acme Pools LLC", email: "owner@acme.test", contactName: "Sam Lee" };
const sent = (terms, status = "sent") => ({ agreement: { status, envelopeId: "env1", sentAt: "2026-10-06T00:00:00Z", terms } });
const half = { price: 1500, plan: "half", care: 99 };
const full = { price: 2000, plan: "full", care: 99 };
const paidInv = (amount) => ({ id: "in_x", amount, paidAt: "2026-10-07T00:00:00Z", status: "paid" });
const C = {
  fresh: { ...base },
  draft: { ...base, websiteDeal: { price: 1800, plan: "half", care: 0 } },
  sentHalf: { ...base, websiteDeal: { ...sent(half) } },
  opened: { ...base, websiteDeal: { ...sent(half, "delivered") } },
  signedUnpaid: { ...base, websiteDeal: { ...sent(half, "completed"), invoices: { deposit: { id: "in_1", amount: 750, status: "open" } } } },
  depositPaid: { ...base, websiteDeal: { ...sent(half, "completed"), invoices: { deposit: paidInv(750) } } },
  bothPaid: { ...base, websiteDeal: { ...sent(half, "completed"), invoices: { deposit: paidInv(750), final: paidInv(750) } } },
  fullUnpaid: { ...base, websiteDeal: { ...sent(full, "completed") } },
  fullPaid: { ...base, websiteDeal: { ...sent(full, "completed"), invoices: { full: paidInv(2000) } } },
  freeSigned: { ...base, websiteDeal: { ...sent({ price: 0, plan: "full", care: 0 }, "completed") } },
  voided: { ...base, websiteDeal: { price: 1200, plan: "full", care: 49, ...sent(half, "voided") } },
  house: { ...base, internal: true },
  // Terms changed AFTER sending must not change what binds.
  tampered: { ...base, websiteDeal: { price: 10, plan: "full", care: 0, ...sent(half, "completed"), invoices: { deposit: paidInv(750) } } },
};

// ── 1. The locks ──────────────────────────────────────────────────────────────────────────
ok("🔴 nothing is built before an agreement goes out", !!L.buildLock(C.fresh) && !!L.buildLock(C.draft));
ok("🔴 an agreement that is only sent, or only OPENED, does not unlock the build", !!L.buildLock(C.sentHalf) && !!L.buildLock(C.opened));
ok("🔴 signed but unpaid does not unlock the build", /first payment/.test(L.buildLock(C.signedUnpaid) || ""));
ok("signed and the first half paid unlocks the build", L.buildLock(C.depositPaid) === null);
ok("🔴 the second half is due BEFORE going live", /final payment/.test(L.publishLock(C.depositPaid) || "") && L.publishLock(C.bothPaid) === null);
ok("paid in full up front unlocks both", L.buildLock(C.fullPaid) === null && L.publishLock(C.fullPaid) === null && !!L.buildLock(C.fullUnpaid));
ok("a $0 build unlocks on signature alone (he can set any price)", L.buildLock(C.freeSigned) === null && L.publishLock(C.freeSigned) === null);
ok("BoldLine's own site has nothing to sign or pay", L.buildLock(C.house) === null && L.publishLock(C.house) === null);
ok("🔴 once the agreement is out, the terms it was sent with bind, not whatever is typed later",
  L.termsOf(C.tampered).price === 1500 && L.termsOf(C.tampered).plan === "half" && L.termsOf(C.tampered).care === 99 && L.publishLock(C.tampered) !== null);
ok("a voided agreement frees the terms to change", L.termsOf(C.voided).price === 1200 && !!L.buildLock(C.voided));
ok("defaults: $1,500, paid up front, $99 a month care, no extra pages, no blog", (({ price, plan, care, extraPages, blog }) => price === 1500 && plan === "full" && care === 99 && extraPages === 0 && blog === false)(L.termsOf(C.fresh)));
const odd = L.amountsOf({ price: 1499.99, plan: "half" });
ok("🔴 half and half never loses a cent (the deposit takes the odd one)", odd.first === 750 && odd.final === 749.99 && Math.round((odd.first + odd.final) * 100) === 149999);
ok("every state has a plain next step", Object.values(C).every((c) => typeof L.nextStep(c) === "string" && L.nextStep(c).length > 10));

// ── 2. The OS mirror says exactly what the server says ─────────────────────────────────────
const block = UI.slice(UI.indexOf("// ─── Website deal (mirror"), UI.indexOf("// WD-MIRROR-END"));
let M = null;
try { M = new Function(`${block}; return { wdBuildLock, wdPublishLock, wdTerms, wdAmounts, SERVER_OWNED_KEYS };`)(); } catch (e) { fails.push("mirror did not evaluate — " + e.message); }
if (M) {
  for (const [k, c] of Object.entries(C)) {
    ok(`🔴 OS and server agree on the locks (${k})`, M.wdBuildLock(c) === L.buildLock(c) && M.wdPublishLock(c) === L.publishLock(c), `${M.wdBuildLock(c)} / ${L.buildLock(c)}`);
    ok(`OS and server agree on the terms (${k})`, JSON.stringify(M.wdTerms(c)) === JSON.stringify(L.termsOf(c)) && JSON.stringify(M.wdAmounts(M.wdTerms(c))) === JSON.stringify(L.amountsOf(L.termsOf(c))));
  }
  ok("🔴 the website deal is server-owned in the OS", M.SERVER_OWNED_KEYS.includes("websiteDeal"));
}
const upd = UI.slice(UI.indexOf("const updateClient = useCallback("), UI.indexOf("const deleteClient = useCallback("));
ok("🔴 an OS save keeps the database's copy of server-owned keys", /SERVER_OWNED_KEYS\.forEach\(k=>\{ if\(k in cur\) data\[k\]=cur\[k\]; else delete data\[k\]; \}\)/.test(upd)
  && upd.indexOf('select("data")') < upd.indexOf(".update({ data,"));
ok("🔴 if that read fails, nothing is written (writing without the key would erase it)", /if\(readErr\) return \{ error:readErr \};/.test(upd));
const card = UI.slice(UI.indexOf("function WebsiteDealCard("), UI.indexOf("const SITE_THEME_LIST="));
ok("the deal card only ever stores what the server sent back", (card.match(/onUpdate\(/g) || []).length === 1 && /onUpdate\(\{\.\.\.client,websiteDeal:out\.deal\}\)/.test(card));
ok("🔴 sending asks first and shows the price, the plan and the care plan", /window\.confirm\(`Send the website agreement to/.test(card) && /Care plan:/.test(card));
ok("unsaved price changes can't be sent by accident", /Save the price first/.test(card));
ok("payments that landed while the screen was closed are picked up", /call\("sync"\)/.test(card));
const tab = UI.slice(UI.indexOf("function WebsiteTab("), UI.indexOf("// ─── Review requests:"));
ok("🔴 the Build button is locked with the reason shown", /disabled=\{busy\|\|!!buildLock\}/.test(tab) && /if\(buildLock\)\{ setMsg\(buildLock\); return; \}/.test(tab));
ok("🔴 'Put it live' starting the care plan asks first", /This also starts their/.test(tab));

// ── 3. The agreement ───────────────────────────────────────────────────────────────────────
const hostile = { ...base, name: "<b>Evil</b> & Co", websiteDeal: { price: 1500, plan: "half", care: 99 } };
const aH = L.websiteAgreementHTML(hostile), aF = L.websiteAgreementHTML({ ...base, websiteDeal: { price: 2400, plan: "full", care: 0 } });
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
ok("🔴 no em or en dashes and no emojis in the agreement", ![aH, aF].some((h) => /[—–]/.test(text(h)) || /\p{Extended_Pictographic}/u.test(text(h).replace(/[✓]/g, ""))));
ok("🔴 exactly one signature anchor", (aH.match(/\/BL_SIGN_HERE\//g) || []).length === 1);
ok("half plan: both amounts, and it says it won't be published until the second half is paid", /\$750/.test(aH) && /will not be published until the second payment/.test(aH));
ok("full plan: the whole price up front, and a waived care plan says so", /\$2,400/.test(aF) && /paid in full when this Agreement is signed/.test(aF) && /Care Plan fee is waived/.test(aF));
ok("the care plan starts on launch day", /starts on the day the Website goes live/.test(aH));
ok("🔴 WA-2: BoldLine manages the domain through access the client gives, and may not transfer it, cancel it or touch their email settings", /Client will give BoldLine access to the account where the domain is registered/.test(aH) && /will not transfer the domain, change who owns it, cancel it, or change the settings Client&rsquo;s email depends on/.test(aH));
ok("🔴 WA-2: the domain stays theirs, they can remove our access any time, and the hand-back never depends on money owed", /The domain and the account stay Client&rsquo;s at all times, and Client may remove BoldLine&rsquo;s access whenever it chooses/.test(aH) && /This does not depend on any amount being owed/.test(aH));
ok("WA-2: renewing the domain stays the client's job", /Keeping the domain renewed and paid for remains Client&rsquo;s responsibility/.test(aH));
ok("the agreement is version WA-2", L.AGREEMENT_VERSION === "WA-2");
ok("🔴 the client keeps its domain and gets a copy of the site if it leaves", /Client owns its domain name/.test(aH) && /standard web files/.test(aH));
ok("no promises about rankings or results", /does not guarantee any particular search ranking/.test(aH));
ok("names are escaped, never run", !/<b>Evil<\/b>/.test(aH) && /&lt;b&gt;Evil/.test(aH));
ok("carries its version", aH.includes(`Version ${L.AGREEMENT_VERSION}`));
ok("🔴 never says 'local businesses'", !/local business/i.test(text(aH)));

// ── 4. Signatures ──────────────────────────────────────────────────────────────────────────
ok("🔴 'delivered' (opened) is not signed", L.decideWebsiteEnvelope(C.sentHalf, { status: "delivered" }).signed === false
  && L.decideWebsiteEnvelope(C.sentHalf, { status: "delivered" }).deal.agreement.status === "delivered");
const signed = L.decideWebsiteEnvelope(C.sentHalf, { status: "completed", completedDateTime: "2026-10-07T15:00:00Z" });
ok("completed records the signature and alerts green", signed.signed && signed.deal.agreement.status === "completed" && signed.deal.agreement.signedAt === "2026-10-07T15:00:00Z" && signed.alert.severity === "green");
ok("🔴 declined and voided are loud", ["declined", "voided"].every((s) => L.decideWebsiteEnvelope(C.sentHalf, { status: s }).alert.severity === "red"));
ok("🔴 an unknown or missing status changes nothing", L.decideWebsiteEnvelope(C.sentHalf, { status: "weird" }).deal === null && L.decideWebsiteEnvelope(C.sentHalf, {}).deal === null);
ok("a signed or never-sent agreement is not checked again", !L.needsWebsiteCheck(C.depositPaid) && !L.needsWebsiteCheck(C.fresh) && L.needsWebsiteCheck(C.opened));

// ── 5. Stripe events ───────────────────────────────────────────────────────────────────────
const ev = (type, object) => ({ type, data: { object } });
const depEv = ev("invoice.paid", { id: "in_1", amount_paid: 75000, metadata: { clientId: "c1", kind: "website", stage: "deposit" } });
const r1 = L.applyWebsiteEvent(C.signedUnpaid, depEv);
ok("🔴 a paid deposit invoice records the payment and unlocks the build", !!r1.deal.invoices.deposit.paidAt && L.buildLock({ ...C.signedUnpaid, websiteDeal: r1.deal }) === null && r1.alert.severity === "green");
ok("the same event twice is harmless", L.applyWebsiteEvent({ ...C.signedUnpaid, websiteDeal: r1.deal }, depEv).alert === null);
ok("🔴 non-website money is not touched by the website branch", L.applyWebsiteEvent(C.signedUnpaid, ev("invoice.paid", { id: "in_ads", metadata: { clientId: "c1" } })) === null);
const careEv = (type, extra = {}) => ev(type, { id: "in_c", subscription_details: { metadata: { clientId: "c1", kind: "website" } }, ...extra });
ok("a care plan payment is recognised (old and new Stripe shapes)", L.websiteKind({ subscription_details: { metadata: { kind: "website" } } }).care
  && L.websiteKind({ parent: { subscription_details: { metadata: { kind: "website" } } } }).care);
ok("care payments keep the care plan current", L.applyWebsiteEvent(C.bothPaid, careEv("invoice.paid")).deal.careSub.status === "active");
ok("a failed care payment alerts", L.applyWebsiteEvent(C.bothPaid, careEv("invoice.payment_failed")).alert.severity === "yellow");
ok("a cancelled care plan is recorded", L.applyWebsiteEvent(C.bothPaid, ev("customer.subscription.deleted", { id: "sub_1", object: "subscription", metadata: { kind: "website", clientId: "c1", stage: "care" } })).deal.careSub.status === "canceled");
const WH = src("netlify/functions/stripe-webhook.mjs");
ok("🔴 the webhook handles website money BEFORE any ads billing patch is built", WH.indexOf("if (websiteKind(obj))") > 0 && WH.indexOf("if (websiteKind(obj))") < WH.indexOf("let patch = null;")
  && /return json\(\{ ok: true, applied: event\.type, website: true/.test(WH));

// ── 6. Invoices and the care plan, with Stripe faked ───────────────────────────────────────
const fakeApi = (pm = null) => { const calls = []; return { calls,
  ensureCustomer: async () => "cus_1", resolvePaymentMethod: async () => pm,
  stripe: async (path, opts) => { calls.push({ path, body: (opts || {}).body }); if (path === "invoices") return { id: "in_new" }; if (/finalize$/.test(path)) return { hosted_invoice_url: "https://invoice.stripe.com/i/x" }; if (path === "products") return { id: "prod_1" }; if (path === "subscriptions") return { id: "sub_1", status: "active" }; return {}; } }; };
await t("invoice", async () => {
  const api = fakeApi();
  const r = await L.createWebsiteInvoice(C.signedUnpaid, "deposit", api);
  const paths = api.calls.map((c) => c.path);
  ok("an invoice is created, filled, finalised and emailed, in that order", JSON.stringify(paths) === JSON.stringify(["invoices", "invoiceitems", "invoices/in_new/finalize", "invoices/in_new/send"]));
  ok("🔴 it is tagged as website money with its stage", api.calls[0].body.metadata.kind === "website" && api.calls[0].body.metadata.stage === "deposit" && api.calls[1].body.metadata.kind === "website");
  ok("the right amount, in cents", api.calls[1].body.amount === 75000 && r.invoice.amount === 750);
  ok("a hosted page that doesn't expire, card or bank, due in 7 days", api.calls[0].body.collection_method === "send_invoice" && api.calls[0].body.days_until_due === 7
    && JSON.stringify(api.calls[0].body.payment_settings.payment_method_types) === '["card","us_bank_account"]' && r.invoice.url.startsWith("https://invoice.stripe.com/"));
  ok("🔴 it never sweeps in other pending charges (like parked lead fees)", api.calls[0].body.pending_invoice_items_behavior === "exclude");
  let e1 = ""; try { await L.createWebsiteInvoice(C.sentHalf, "deposit", fakeApi()); } catch (e) { e1 = e.message; }
  ok("🔴 no invoice before the agreement is signed", /isn't signed/.test(e1));
  let e2 = ""; try { await L.createWebsiteInvoice(C.signedUnpaid, "final", fakeApi()); } catch (e) { e2 = e.message; }
  ok("no final invoice before the first half is paid", /first half/.test(e2));
  let e3 = ""; try { await L.createWebsiteInvoice(C.fullUnpaid, "deposit", fakeApi()); } catch (e) { e3 = e.message; }
  ok("a paid-up-front deal has no deposit", /no deposit/.test(e3));
});
await t("care", async () => {
  const withCard = fakeApi("pm_1"); const r = await L.startCarePlan(C.bothPaid, withCard);
  const sub = withCard.calls.find((c) => c.path === "subscriptions").body;
  ok("care plan with a card on file charges automatically, monthly, tagged as website", sub.collection_method === "charge_automatically" && sub.default_payment_method === "pm_1"
    && sub.items[0].price_data.recurring.interval === "month" && sub.items[0].price_data.unit_amount === 9900 && sub.metadata.kind === "website" && r.careSub.collection === "card");
  const noCard = fakeApi(null); await L.startCarePlan(C.bothPaid, noCard);
  ok("without a card, Stripe emails a monthly invoice instead", noCard.calls.find((c) => c.path === "subscriptions").body.collection_method === "send_invoice");
  ok("a waived care plan starts nothing", (await L.startCarePlan({ ...base, websiteDeal: { ...sent({ price: 1500, plan: "full", care: 0 }, "completed") } }, fakeApi())) === null);
  const again = fakeApi(); await L.startCarePlan({ ...C.bothPaid, websiteDeal: { ...C.bothPaid.websiteDeal, careSub: { subscriptionId: "sub_0", status: "active" } } }, again);
  ok("🔴 putting it live twice never starts a second care plan", again.calls.length === 0);
});

// ── 7. The watcher sends the first invoice the moment they sign ─────────────────────────────
await t("watch", async () => {
  const saved = [], alerts = [];
  const rows = [{ id: "c1", data: { ...C.sentHalf } }];
  await runWatch({ loadClients: async () => rows, fetchEnvelope: async () => ({ status: "completed", completedDateTime: "2026-10-07T15:00:00Z" }),
    saveClient: async (id, d) => saved.push(d), alert: async (a) => alerts.push(a), sendEmail: async () => {},
    createFirstInvoice: async () => ({ customerId: "cus_1", invoice: { id: "in_9", url: "https://invoice.stripe.com/i/9", amount: 750, status: "open" } }) });
  const d = saved[0] && saved[0].websiteDeal;
  ok("🔴 signing records the signature and the first invoice in one save", saved.length === 1 && d.agreement.status === "completed" && d.invoices.deposit.id === "in_9" && alerts[0].severity === "green");
  const s2 = [], a2 = [];
  await runWatch({ loadClients: async () => [{ id: "c1", data: { ...C.sentHalf } }], fetchEnvelope: async () => ({ status: "completed" }),
    saveClient: async (id, x) => s2.push(x), alert: async (x) => a2.push(x), sendEmail: async () => {}, createFirstInvoice: async () => { throw new Error("card declined setup"); } });
  ok("🔴 if Stripe refuses, the signature is still saved and the alert says to send it by hand", s2.length === 1 && s2[0].websiteDeal.agreement.status === "completed" && a2[0].severity === "yellow" && /Send it from their Website tab/.test(a2[0].body));
  const s3 = [];
  await runWatch({ loadClients: async () => [{ id: "c1", data: { ...C.sentHalf } }], fetchEnvelope: async () => { throw new Error("rate limited"); },
    saveClient: async (id, x) => s3.push(x), alert: async () => {}, sendEmail: async () => {} });
  ok("🔴 a failed lookup changes nothing", s3.length === 0);
  // A client with BOTH an ads envelope and a website envelope signing in the same run.
  const s4 = [];
  const both = { ...C.sentHalf, docusignEnvelopeId: "ads1", contractSigned: false };
  await runWatch({ loadClients: async () => [{ id: "c1", data: both }], fetchEnvelope: async () => ({ status: "completed" }),
    saveClient: async (id, x) => s4.push(x), alert: async () => {}, sendEmail: async () => {}, createFirstInvoice: async () => ({ customerId: "cus", invoice: { id: "in_b" } }) });
  ok("🔴 the website save builds on the ads save from the same run, never overwrites it", s4.length === 2 && s4[1].contractSigned === true && s4[1].websiteDeal.agreement.status === "completed");
});

// ── 8. The server enforces the locks, not just the buttons ─────────────────────────────────
const pub = (cl) => ({ ...cl, website: { published: true, previewKey: "K" } });
const q = (s) => new URLSearchParams(s);
ok("🔴 a site marked published but not fully paid is not shown to the public", gateView(viewFor(pub(C.depositPaid).website, q("")), pub(C.depositPaid)).show === false);
ok("paid in full, it shows", gateView(viewFor(pub(C.bothPaid).website, q("")), pub(C.bothPaid)).show === true);
ok("the preview link still works before the balance is paid (so they can approve it)", gateView(viewFor(pub(C.depositPaid).website, q("preview=K")), pub(C.depositPaid)).show === true);
ok("BoldLine's own site is never gated", gateView(viewFor(pub(C.house).website, q("")), pub(C.house)).show === true);
const SB = src("netlify/functions/site-build-background.mjs");
ok("🔴 the builder refuses to write a site while it is locked, before it records a job", /const lock = buildLock\([^)]*\);\s*if \(lock\) return json\(\{ ok: false, error: lock \}, 409\);/.test(SB)
  && SB.indexOf("if (lock) return json") < SB.indexOf("await writeJob("));
const FN = src("netlify/functions/website-deal.mjs");
ok("🔴 the terms can't change once the agreement is out", FN.indexOf('case "set-terms"') < FN.indexOf("if (agreementLive(cl)) return json({ ok: false, error: \"The agreement is already out."));
ok("🔴 cancelling only records 'voided' after DocuSign confirms it", FN.indexOf("if (!resp.ok)") > 0 && FN.indexOf("if (!resp.ok)") < FN.indexOf('status: "voided", voidedAt'));
ok("🔴 'launch' refuses until it is paid in full", /case "launch": \{\s*const lock = publishLock\(cl\);\s*if \(lock\) return json/.test(FN));
ok("🔴 a fresh invoice cancels the old one so nobody pays twice", FN.indexOf("/void`") > 0 && FN.indexOf("/void`") < FN.indexOf("await createWebsiteInvoice("));
ok("every write re-reads the client first (a webhook may have landed meanwhile)", /const save = async \(next, note, sent = null, flag = null, top = null\) => \{\s*const \{ data: fresh \}/.test(FN));
ok("the agreement goes out through the same proven DocuSign code, with its own name", /sendEnvelope\(await getAccessToken\(\), \{[^}]*documentName: "BoldLine Media Website Agreement"/.test(FN) && /ensureAnchor\(websiteAgreementHTML/.test(FN));

// ── 9. Selling it (step 2b): one price list everywhere ─────────────────────────────────────
const { WEBSITE_OFFER, websitePromptBlock } = await import("../netlify/lib/pricing-shared.mjs");
const { parseWebsiteLine } = await import("../netlify/functions/deal-research-background.mjs");
ok("🔴 the agreement defaults come from the one website price list", L.DEAL_DEFAULTS.price === WEBSITE_OFFER.build && L.DEAL_DEFAULTS.care === WEBSITE_OFFER.care);
const uiOffer = (UI.match(/const WEBSITE_OFFER=(\{[^}]+\});/) || [])[1];
ok("🔴 the OS quotes the same website prices as the server", !!uiOffer && JSON.stringify(new Function(`return ${uiOffer}`)()) === JSON.stringify(WEBSITE_OFFER), uiOffer);
const SITE = src("marketing-site/index.html");
const wsec = SITE.slice(SITE.indexOf('<section id="websites">'), SITE.indexOf("</section>", SITE.indexOf('<section id="websites">')));
const usd = (n) => `$${n.toLocaleString("en-US")}`;
ok("🔴 the marketing site quotes the same build price and care plan", wsec.includes(`<b>${usd(WEBSITE_OFFER.build)}</b>`) && wsec.includes(`<b>${usd(WEBSITE_OFFER.care)}/mo</b>`));
ok("the website offer books a call like every other service", /href="https:\/\/calendly\.com\/theboldlinemedia\/30min"/.test(wsec));
ok("it is not dressed as an ads package (those cards are matched to the ads catalog)", !/class="pkg"/.test(wsec));
ok("🔴 no dashes, no emojis, never 'local businesses' on the site section", !/[—–]/.test(wsec.replace(/<!--[\s\S]*?-->/g, "")) && !/\p{Extended_Pictographic}/u.test(wsec) && !/local business/i.test(wsec));
ok("it says half now and half before launch, and that the care plan starts at launch", /half now and half before it goes live/.test(wsec) && /From launch/.test(wsec));
const WP = websitePromptBlock();
ok("🔴 Deal Prep is told the real website prices and the payment rules", WP.includes(usd(WEBSITE_OFFER.build)) && WP.includes(`$${WEBSITE_OFFER.care}/mo`) && /half now and half before it goes live/.test(WP) && /does not go live until it is paid in full/.test(WP));
ok("🔴 Deal Prep is told NOT to pitch a website to someone whose site is good", /Do NOT pitch it when their site is genuinely good/.test(WP));
ok("the website instructions have no dashes (a model mirrors the style it is given)", !/[—–]/.test(WP));
const DR = src("netlify/functions/deal-research-background.mjs");
ok("Deal Prep asks for the website verdict and a Website section", DR.includes("${websitePromptBlock()}") && /Second line, alone: WEBSITE: <yes \| only \| no>/.test(DR) && /\*\*Website\*\*/.test(DR));
ok("the verdict is read and removed from the brief", JSON.stringify(parseWebsiteLine("WEBSITE: only\n\n**Company Snapshot**")) === JSON.stringify({ brief: "**Company Snapshot**", recommendWebsite: "only" })
  && parseWebsiteLine("**Company Snapshot**").recommendWebsite === null && parseWebsiteLine("WEBSITE: maybe\n**X**").recommendWebsite === null);
ok("the verdict is stored with the brief", /recommendWebsite: parsed\.recommendWebsite/.test(DR));
const DPW = UI.slice(UI.indexOf("function DealPrepWebsite("), UI.indexOf("function DealPrepScreen("));
ok("Deal Prep shows the website offer under every brief, priced from the shared list", /<DealPrepWebsite verdict=\{result\.recommendWebsite\}\/>/.test(UI) && /WEBSITE_OFFER\.build/.test(DPW) && /WEBSITE_OFFER\.care/.test(DPW));
const upsellSrc = UI.slice(UI.indexOf("const showWebsiteUpsell="), UI.indexOf("function WebsiteUpsell("));
const showUp = new Function(`${upsellSrc}; return showWebsiteUpsell;`)();
const signedAds = { name: "X", packageId: "g-launch", contractSigned: true };
ok("🔴 a signed ads client with no website gets the website offer on their Overview", showUp(signedAds) === true && /<WebsiteUpsell client=\{client\}/.test(UI));
ok("🔴 not before they've signed (a meeting is not a client), not for the house account", showUp({ ...signedAds, contractSigned: false }) === false && showUp({ ...signedAds, internal: true }) === false);
ok("not once a website deal or a site exists", showUp({ ...signedAds, websiteDeal: { agreement: { status: "sent" } } }) === false && showUp({ ...signedAds, website: { content: {} } }) === false);
ok("'Not now' hides it for 60 days, then it comes back", showUp({ ...signedAds, websiteUpsellHiddenAt: new Date(Date.now() - 5 * 864e5).toISOString() }) === false
  && showUp({ ...signedAds, websiteUpsellHiddenAt: new Date(Date.now() - 61 * 864e5).toISOString() }) === true);

// ── 10. Website-only clients ───────────────────────────────────────────────────────────────
const dbBlock = UI.slice(UI.indexOf("const PACKAGES_DB = {"), UI.indexOf("const ALL_PKGS ="));
ok("🔴 the website-only package is NOT in the ads catalog (never on the site, never an upgrade)", !/w-site/.test(dbBlock) && /const WEB_PKG_ID = "w-site";/.test(UI));
ok("every screen can find it", /id === WEB_PKG_ID \? WEB_PKG :/.test(UI) && /PKG_FEATURES\[WEB_PKG_ID\] = \[\];/.test(UI));
ok("no ads bots for a website-only client", /if \(!pkg \|\| pkg\.pricingModel === "website"\) return \[\];/.test(UI));
const woA = new Function(`${UI.slice(UI.indexOf("const webRequestAlerts ="), UI.indexOf("const getAlerts ="))}; return websiteOnlyAlerts;`)();
ok("🔴 a website-only client never gets ads alerts (intake, contract renewal, billing)", /if \(isWebsiteOnly\(cl\)\) return websiteOnlyAlerts\(cl\);/.test(UI)
  && UI.indexOf("if (isWebsiteOnly(cl)) return websiteOnlyAlerts(cl);") < UI.indexOf('a.push({type:"intake"'));
ok("it is reminded to send the website agreement, and told when care payments fail", woA({}).some((x) => x.type === "web_agreement") && woA({ websiteDeal: { agreement: { status: "completed" }, careSub: { status: "past_due" } } }).map((x) => x.type).join() === "web_care_late");
ok("🔴 the ads tabs are hidden for a website-only client, and it opens on its Website tab",
  /isWebsiteOnly\(client\)&&\["campaign","pipeline","reviews","package","research","contract","emails","reports"\]\.includes\(k\)/.test(UI) && /useState\(client\._initialTab\|\|\(isWebsiteOnly\(client\)\?"website":"overview"\)\)/.test(UI));
ok("its Overview is the website, not the ads launch checklist", /tab==="overview"&&isWebsiteOnly\(client\)&&<WebsiteOnlyOverview/.test(UI) && /tab==="overview"&&!isWebsiteOnly\(client\)&&\(/.test(UI));
ok("🔴 a website-only client is created with no ads contract dates (both ways in)", /\.\.\.\(web\?\{contractStart:"",contractEnd:"",contractTermMonths:0,platforms:\[\]\}:\{\}\)\}\);/.test(UI)
  && /if \(pkg && pkg\.pricingModel === "website"\) Object\.assign\(cl, \{ contractStart: "", contractEnd: "", contractTermMonths: 0 \}\);/.test(UI));
ok("Add Client and Deal Prep both offer 'Website only'", /\["website","Website only"\]/.test(UI) && /<option value=\{WEB_PKG_ID\}>Website only/.test(UI));
const WOO = UI.slice(UI.indexOf("function WebsiteOnlyOverview("), UI.indexOf("function DealPrepWebsite("));
ok("🔴 adding ads asks first and only changes the package (nothing is sent or charged)", /window\.confirm\(`Make \$\{client\.name\} an ads client/.test(WOO) && !/fetch\(/.test(WOO) && !/websiteDeal/.test(WOO.slice(WOO.indexOf("onUpdate&&onUpdate("))));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-website-deal: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
