// Owner actions for a client's website deal: set the price, send the agreement, send invoices, launch.
//
// The rules (what unlocks what) live in ../lib/website-deal.mjs; this file only talks to the database,
// DocuSign and Stripe. Every action re-reads the client from the database and writes back only
// `websiteDeal` (plus a log line), because the OS must never be the one writing it. KB `website-builder`.
//
// POST { action, clientId, ... } with the owner's session:
//   set-terms { price, plan, care }   only while no agreement is out
//   preview                            the agreement as it would be sent, for the OS to show
//   send      { email?, name? }        DocuSign the agreement (terms freeze from here)
//   void                               cancel an unsigned agreement in DocuSign so the terms can change
//   invoice   { stage }                send a build invoice (full | deposit | final)
//   launch                             start the care plan; refused until everything is paid
//   send-review                        email the client the private preview link to look over
//   domain-set    { domain }           their own web address (acmepools.com); added to Netlify if a token is set
//   domain-check                       does the address reach their site over https yet? (sets it live)
//   domain-remove                      stop using their own address (Netlify is left alone)
//   netlify-status                     read-only: is the Netlify key set and working?
//   sync                               re-read open invoices and the care plan from Stripe

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { DS, getAccessToken, isConfigured } from "../lib/docusign-auth.mjs";
import { sendEnvelope, ensureAnchor } from "./docusign-send.mjs";
import { stripe, ensureCustomer, resolvePaymentMethod } from "../lib/stripe-shared.mjs";
import { WEBSITE_OFFER } from "../lib/pricing-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { promises as dnsp } from "node:dns";
import { cleanDomain, altHost, isApex, dnsRecords, checkDomain, addNetlifyAlias, addressTaken, netlifyStatus, sitesTarget } from "../lib/site-domain.mjs";
import {
  dealOf, termsOf, agreementLive, websiteAgreementHTML, AGREEMENT_VERSION, createWebsiteInvoice, startCarePlan,
  publishLock, amountsOf, exempt, buildTotal, monthlyTotal, isSigned,
} from "../lib/website-deal.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
const api = { stripe, ensureCustomer, resolvePaymentMethod };
// For the address check: DNS from Node, and the real https fetch.
const resolveDns = (h, type) => (type === "CNAME" ? dnsp.resolveCname(h) : dnsp.resolve4(h));
// Client addresses go on the client-websites site when it exists (SITES_NETLIFY_SITE), else this one.
const netlify = () => ({ fetchFn: fetch, token: process.env.NETLIFY_API_TOKEN || "", siteId: sitesTarget() !== "boldlinemedia.netlify.app" ? sitesTarget() : (process.env.SITE_ID || "") });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: ae } = await supabase.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
  const { data: row, error: re } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (re) return json({ ok: false, error: re.message }, 500);
  if (!row || !row.data) return json({ ok: false, error: "Client not found" }, 404);
  const cl = { ...row.data, id: clientId };
  const deal = (cl.websiteDeal) || {};

  // Re-read just before writing, so a webhook that landed while DocuSign or Stripe was answering is kept.
  // `sent` is an email that went out with this action: its log line is kept and its flag recorded.
  // `top(base)` returns other top-level fields to set from the fresh copy (launch publishes the site).
  const save = async (next, note, sent = null, flag = null, top = null) => {
    const { data: fresh } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
    const base = (fresh && fresh.data) || cl;
    const merged = { ...(base.websiteDeal || {}), ...next };
    const logs = [...(sent && sent.sent ? [sent.logEntry] : []), ...(note ? [{ date: fmt(Date.now()), note, cat: "website", ts: Date.now() }] : [])];
    const data = { ...base, websiteDeal: merged, ...(logs.length ? { commLog: [...logs, ...(base.commLog || [])] } : {}),
      ...(sent && sent.sent && flag ? { emailAuto: { ...(base.emailAuto || {}), ...flag } } : {}), ...(top ? top(base) : {}) };
    const { error } = await supabase.from("clients").update({ data, updated_at: new Date().toISOString() }).eq("id", clientId);
    if (error) throw new Error(error.message);
    return merged;
  };

  try {
    switch (body.action) {
      case "set-terms": {
        if (agreementLive(cl)) return json({ ok: false, error: "The agreement is already out. Cancel it first to change the terms." }, 409);
        const price = Number(body.price), care = Number(body.care);
        if (!Number.isFinite(price) || price < 0 || price > 100000) return json({ ok: false, error: "Enter a build price between $0 and $100,000." }, 400);
        if (!Number.isFinite(care) || care < 0 || care > 5000) return json({ ok: false, error: "Enter a care plan price between $0 and $5,000 a month." }, 400);
        const extraPages = Math.floor(Number(body.extraPages || 0)), extraPagePrice = Number(body.extraPagePrice ?? WEBSITE_OFFER.extraPage);
        const blogSetup = Number(body.blogSetup ?? WEBSITE_OFFER.blogSetup), blogMonthly = Number(body.blogMonthly ?? WEBSITE_OFFER.blogMonthly), blogPosts = Math.floor(Number(body.blogPosts ?? WEBSITE_OFFER.blogPostsPerMonth));
        if (!(extraPages >= 0 && extraPages <= 20)) return json({ ok: false, error: "Extra pages must be between 0 and 20." }, 400);
        const emailSetupPrice = Number(body.emailSetupPrice ?? WEBSITE_OFFER.emailSetup);
        if (![extraPagePrice, blogSetup, blogMonthly, emailSetupPrice].every((n) => Number.isFinite(n) && n >= 0 && n <= 20000)) return json({ ok: false, error: "Add-on prices must be between $0 and $20,000." }, 400);
        if (!(blogPosts >= 1 && blogPosts <= 8)) return json({ ok: false, error: "Blog articles must be between 1 and 8 a month." }, 400);
        const r = (n) => Math.round(n * 100) / 100;
        const next = await save({ price: r(price), care: r(care), plan: body.plan === "half" ? "half" : "full",
          extraPages, extraPagePrice: r(extraPagePrice), blog: body.blog === true, blogSetup: r(blogSetup), blogMonthly: r(blogMonthly), blogPosts,
          emailSetup: body.emailSetup === true, emailSetupPrice: r(emailSetupPrice) });
        return json({ ok: true, deal: next });
      }
      case "preview":
        return json({ ok: true, html: websiteAgreementHTML(cl) });
      case "send": {
        if (exempt(cl)) return json({ ok: false, error: "BoldLine's own site has nobody to sign with." }, 400);
        if (agreementLive(cl)) return json({ ok: false, error: "An agreement is already out for this website." }, 409);
        if (!isConfigured()) return json({ ok: false, error: "DocuSign isn't set up." }, 500);
        const email = String(body.email || cl.email || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "Add the client's email on the Overview tab first." }, 400);
        const name = String(body.name || cl.contactName || cl.name || "Authorized Signatory").trim().slice(0, 100);
        const terms = { ...termsOf(cl), version: AGREEMENT_VERSION };
        const html = ensureAnchor(websiteAgreementHTML(cl, terms), name);
        const r = await sendEnvelope(await getAccessToken(), { subject: `Please sign: your website agreement with BoldLine Media`, documentHtml: html, recipientEmail: email, recipientName: name, documentName: "BoldLine Media Website Agreement" });
        const next = await save({ agreement: { status: "sent", envelopeId: r.envelopeId, sentAt: new Date().toISOString(), sentTo: email, terms } },
          `Website agreement sent to ${email} for signature (${terms.plan === "half" ? "half now, half before launch" : "paid up front"}, build $${buildTotal(terms)}${terms.extraPages ? ` incl. ${terms.extraPages} extra page(s)` : ""}${terms.blog ? " incl. blog" : ""}, monthly $${monthlyTotal(terms)}).`);
        return json({ ok: true, deal: next });
      }
      case "void": {
        const a = deal.agreement || {};
        if (!a.envelopeId || !["sent", "delivered"].includes(a.status)) return json({ ok: false, error: "There's no unsigned agreement to cancel." }, 409);
        const token = await getAccessToken();
        const resp = await fetch(`${DS.basePath}/restapi/v2.1/accounts/${DS.accountId}/envelopes/${encodeURIComponent(a.envelopeId)}`, {
          method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ status: "voided", voidedReason: "Replaced with updated terms" }),
        });
        // 🔴 If DocuSign refused, the client can still sign the old envelope, so the record must not
        // pretend it is cancelled.
        if (!resp.ok) { const d = await resp.json().catch(() => ({})); return json({ ok: false, error: `DocuSign wouldn't cancel it: ${d.message || resp.status}` }, 502); }
        const next = await save({ agreement: { ...a, status: "voided", voidedAt: new Date().toISOString() } }, "Website agreement cancelled so the terms can change.");
        return json({ ok: true, deal: next });
      }
      case "invoice": {
        const stage = String(body.stage || "");
        const existing = (deal.invoices || {})[stage];
        if (existing && existing.paidAt) return json({ ok: false, error: "That payment is already in." }, 409);
        // A second invoice for the same payment would let the client pay twice, so the old one is voided first.
        if (existing && existing.id && existing.status === "open") {
          try { await stripe(`invoices/${encodeURIComponent(existing.id)}/void`, {}); } catch (e) { console.error("website-deal: could not void old invoice:", e.message); }
        }
        const r = await createWebsiteInvoice(cl, stage, api);
        // The second half is asked for once the site is built, so it goes with the preview link: they
        // see what they are paying for in the same email.
        const built = !!(cl.website && cl.website.content && cl.website.previewKey && cl.landingSlug);
        const sent = stage === "final" && built ? await autoSendClientEmail(cl, "website_review", { payUrl: r.invoice.url, amount: r.invoice.amount }) : null;
        const next = await save({ customerId: r.customerId, invoices: { ...(deal.invoices || {}), [stage]: r.invoice } },
          `Website invoice sent: $${r.invoice.amount} (${stage === "final" ? "final payment" : stage === "deposit" ? "first half" : "paid in full"}).`, sent);
        return json({ ok: true, deal: next, url: r.invoice.url, emailed: r.invoice.emailed, reviewEmailed: !!(sent && sent.sent) });
      }
      case "send-review": {
        if (exempt(cl)) return json({ ok: false, error: "BoldLine's own site has nobody to send it to." }, 400);
        if (!isSigned(cl)) return json({ ok: false, error: "They haven't signed the website agreement, so there's nothing to send them yet." }, 409);
        if (!(cl.website && cl.website.content && cl.website.previewKey && cl.landingSlug)) return json({ ok: false, error: "Build the site first, so there is something to look at." }, 409);
        if (deal.launchedAt) return json({ ok: false, error: "The site is already live." }, 409);
        const fin = (deal.invoices || {}).final;
        const open = fin && fin.status === "open" && !fin.paidAt && fin.url ? { payUrl: fin.url, amount: fin.amount } : {};
        const sent = await autoSendClientEmail(cl, "website_review", open);
        if (!sent.sent) return json({ ok: false, error: `The email didn't send: ${sent.reason}` }, 502);
        const next = await save({ reviewSentAt: new Date().toISOString() }, "", sent);
        return json({ ok: true, deal: next });
      }
      case "domain-set": {
        const host = cleanDomain(body.domain);
        if (!host) return json({ ok: false, error: "That doesn't look like a web address we can use. Type it like acmepools.com or www.acmepools.com." }, 400);
        // 🔴 Only for a client buying a website (or BoldLine's own), the same rule as everything else here.
        if (!exempt(cl) && !isSigned(cl)) return json({ ok: false, error: "They haven't signed the website agreement yet." }, 409);
        // 🔴 One address, one owner. Another client's website OR landing page on the same address would make
        // the lookup ambiguous, and a landing page always wins it, so their website would silently vanish.
        const { data: all, error: ae2 } = await supabase.from("clients").select("id, data");
        if (ae2) return json({ ok: false, error: ae2.message }, 500);
        const taken = addressTaken(all, clientId, host);
        if (taken) return json({ ok: false, error: `${(taken.data && taken.data.name) || "Another client"} already uses that address.` }, 409);
        const mine = String(((cl.campaignSetup || {}).landingDomain) || "").toLowerCase();
        if (mine && [host, altHost(host)].includes(mine)) return json({ ok: false, error: "Their ad landing page already uses that address. Use a different one for the website." }, 409);
        // Both forms (with and without www) go to Netlify, so either one a customer types works.
        let alias;
        try { alias = await addNetlifyAlias([host, ...(isApex(host) || (host.startsWith("www.") && isApex(host.slice(4))) ? [altHost(host)] : [])], netlify()); }
        catch (e) { alias = { ok: false, note: `Netlify didn't answer (${e.message}).` }; }
        const next = await save({ domain: { host, setAt: new Date().toISOString(), live: false, alias: { ok: !!alias.ok, manual: !!alias.manual, note: alias.note || "" } } },
          `Website address set to ${host}.`);
        return json({ ok: true, deal: next, records: dnsRecords(host, sitesTarget()), alias });
      }
      case "domain-check": {
        const d = deal.domain;
        if (!d || !d.host) return json({ ok: false, error: "Set their web address first." }, 409);
        const r = await checkDomain(d.host, cl.landingSlug, { fetchFn: fetch, resolve: resolveDns, target: sitesTarget() });
        // 🔴 Live only when the address really served THEIR site AND the site is out (published, paid).
        const out = !!(cl.website && cl.website.published) && !publishLock(cl);
        const live = r.live && out;
        const note = r.live && !out ? "The address is set up and reaches the site. It goes live on this address when you put the site live." : r.note;
        const first = live && !d.live;
        const next = await save({ domain: { ...d, live, ...(first ? { liveAt: new Date().toISOString() } : {}), check: { dns: r.dns, https: r.https, note, at: r.checkedAt } } },
          first ? `Website now live on ${d.host}.` : "");
        return json({ ok: true, deal: next, live, note, records: dnsRecords(d.host, sitesTarget()) });
      }
      case "netlify-status":
        return json({ ok: true, ...(await netlifyStatus(netlify())), target: sitesTarget(), separate: sitesTarget() !== "boldlinemedia.netlify.app" });
      case "domain-remove": {
        if (!deal.domain) return json({ ok: true, deal });
        const was = deal.domain.host;
        const next = await save({ domain: null }, `Stopped using ${was} for the website.`);
        return json({ ok: true, deal: next });
      }
      case "launch": {
        const lock = publishLock(cl);
        if (lock) return json({ ok: false, error: lock }, 409);
        if (exempt(cl)) { const next = await save({ launchedAt: deal.launchedAt || new Date().toISOString() }); return json({ ok: true, deal: next }); }
        const r = await startCarePlan(cl, api);
        const care = monthlyTotal(termsOf(cl));
        const first = !deal.launchedAt && !(cl.emailAuto || {}).websiteLive;
        let next = await save({ launchedAt: deal.launchedAt || new Date().toISOString(), ...(r ? { customerId: r.customerId, careSub: r.careSub } : {}) },
          deal.launchedAt ? "" : `Website put live.${r ? ` Monthly plan started at $${care}/mo (${r.careSub.collection === "card" ? "card on file" : "invoiced monthly"}).` : ""}`, null, null,
          // 🔴 Published here, server-side, not left to the OS's follow-up save, and BEFORE the "you're
          // live" email below: the link in it must work the moment they tap it.
          (b) => ({ website: { ...(b.website || {}), published: true } }));
        // "You're live", the first time only (pressing Go live again re-publishes, it is not news).
        // Their own address, if one is set, is checked now that the site is out, so the "you're live" email
        // can already carry it. Best effort: a slow DNS never holds up the launch.
        const dm = next.domain;
        if (dm && dm.host && !dm.live) {
          try {
            const r = await checkDomain(dm.host, cl.landingSlug, { fetchFn: fetch, resolve: resolveDns, target: sitesTarget() });
            if (r.live) next = await save({ domain: { ...dm, live: true, liveAt: new Date().toISOString(), check: { dns: r.dns, https: r.https, note: r.note, at: r.checkedAt } } }, `Website now live on ${dm.host}.`);
          } catch (e) { console.error("website-deal: domain check at launch failed:", e.message); }
        }
        // Sent from the record as it is now, so a just-proven address of theirs is the link in it.
        const now = { ...cl, websiteDeal: next };
        if (first) { const sent = await autoSendClientEmail(now, "website_live", { care }); if (sent.sent) next = await save({}, "", sent, { websiteLive: true }); }
        return json({ ok: true, deal: next });
      }
      case "sync": {
        let changed = false;
        const invoices = { ...(deal.invoices || {}) };
        for (const [stage, inv] of Object.entries(invoices)) {
          if (!inv || !inv.id || inv.paidAt) continue;
          const s = await stripe(`invoices/${encodeURIComponent(inv.id)}`, { method: "GET" });
          if (s.status === "paid") { invoices[stage] = { ...inv, status: "paid", paidAt: new Date().toISOString(), amount: (s.amount_paid || 0) / 100 || inv.amount }; changed = true; }
          else if (s.status === "void" || s.status === "uncollectible") { invoices[stage] = { ...inv, status: s.status }; changed = true; }
        }
        let careSub = deal.careSub;
        if (careSub && careSub.subscriptionId) {
          const s = await stripe(`subscriptions/${encodeURIComponent(careSub.subscriptionId)}`, { method: "GET" });
          if (s.status && s.status !== careSub.status) { careSub = { ...careSub, status: s.status === "unpaid" ? "past_due" : s.status }; changed = true; }
        }
        const next = changed ? await save({ invoices, ...(careSub ? { careSub } : {}) }) : deal;
        return json({ ok: true, deal: next, changed, amounts: amountsOf(termsOf(cl)) });
      }
      default:
        return json({ ok: false, error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error("website-deal failed:", body.action, e.message);
    return json({ ok: false, error: String(e.message || e).slice(0, 300) }, 502);
  }
};
