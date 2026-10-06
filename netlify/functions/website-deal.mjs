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
//   sync                               re-read open invoices and the care plan from Stripe

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { DS, getAccessToken, isConfigured } from "../lib/docusign-auth.mjs";
import { sendEnvelope, ensureAnchor } from "./docusign-send.mjs";
import { stripe, ensureCustomer, resolvePaymentMethod } from "../lib/stripe-shared.mjs";
import {
  dealOf, termsOf, agreementLive, websiteAgreementHTML, AGREEMENT_VERSION, createWebsiteInvoice, startCarePlan,
  publishLock, amountsOf, exempt,
} from "../lib/website-deal.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
const api = { stripe, ensureCustomer, resolvePaymentMethod };

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
  const save = async (next, note) => {
    const { data: fresh } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
    const base = (fresh && fresh.data) || cl;
    const merged = { ...(base.websiteDeal || {}), ...next };
    const data = { ...base, websiteDeal: merged, ...(note ? { commLog: [{ date: fmt(Date.now()), note, cat: "website", ts: Date.now() }, ...(base.commLog || [])] } : {}) };
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
        const next = await save({ price: Math.round(price * 100) / 100, care: Math.round(care * 100) / 100, plan: body.plan === "half" ? "half" : "full" });
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
          `Website agreement sent to ${email} for signature (${terms.plan === "half" ? "half now, half before launch" : "paid up front"}, build $${terms.price}, care $${terms.care}/mo).`);
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
        const next = await save({ customerId: r.customerId, invoices: { ...(deal.invoices || {}), [stage]: r.invoice } },
          `Website invoice sent: $${r.invoice.amount} (${stage === "final" ? "final payment" : stage === "deposit" ? "first half" : "paid in full"}).`);
        return json({ ok: true, deal: next, url: r.invoice.url, emailed: r.invoice.emailed });
      }
      case "launch": {
        const lock = publishLock(cl);
        if (lock) return json({ ok: false, error: lock }, 409);
        if (exempt(cl)) { const next = await save({ launchedAt: deal.launchedAt || new Date().toISOString() }); return json({ ok: true, deal: next }); }
        const r = await startCarePlan(cl, api);
        const care = termsOf(cl).care;
        const next = await save({ launchedAt: deal.launchedAt || new Date().toISOString(), ...(r ? { customerId: r.customerId, careSub: r.careSub } : {}) },
          deal.launchedAt ? "" : `Website put live.${r ? ` Care plan started at $${care}/mo (${r.careSub.collection === "card" ? "card on file" : "invoiced monthly"}).` : ""}`);
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
