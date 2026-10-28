// Add-on services billed on their own: today, Google profile care at $130 a month. KB `addon-billing`.
//
// Bryson, 2026-10-27: "yes" to making it "a proper checkbox in the agreement that adds $130 to their monthly bill
// automatically". The checkbox lives on each agreement (contract-shared.cjs `addOnsOf`, website-deal.mjs `gbpCare`);
// this file is the money.
//
// 🔴 ITS OWN STRIPE SUBSCRIPTION, TAGGED `kind: "addon"`. A business can buy it beside managed ads (a subscription),
// results-only ads (no subscription, a card on file), a website (build invoices plus a care subscription) or nothing
// else at all. One mechanism that works for all four beats four special cases, and the tag keeps it out of the way:
//   - the webhook keeps it away from the ads billing status, exactly like the website's `kind: "website"`;
//   - the ads lookups (sync, renewal re-rating, next charge date) skip tagged subscriptions and read the ads one;
//   - an unpaid add-on invoice never pauses a client's ads under the ads late-payment policy. Its own clause says
//     the add-on may be paused instead.
// 🔴 IT STARTS ONLY WHEN THE SERVICE CAN. Both agreements say billing starts on the day the client gives manager
// access to the profile, so the trigger is a SIGNED agreement carrying the add-on AND the business's Google profile
// linked in the OS. Never for BoldLine's own account or an owned business (`internal`). A subscription Bryson stopped
// is never restarted by itself.
// 🔴 `cl.addOnBilling` IS SERVER-OWNED (index.html SERVER_OWNED_KEYS). It is written here, by the Stripe webhook and
// by billing-watch, never by a browser save that could put back an older state.
//   addOnBilling.gbp_care = { subscriptionId, customerId, status, startedAt, monthly, collection, source,
//                             lastPaidAt, stopAt, endedAt }

import { addOnsOf, ADD_ONS } from "./contract-shared.cjs";
import { isSigned as websiteSigned, termsOf as websiteTerms, websiteKind } from "./website-deal.mjs";

export const ADDON_LABEL = { gbp_care: "Google profile care" };
const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// What this business has AGREED to, from whichever signed agreement carries it. Both editors refuse a second copy,
// and if both agreements somehow carried it, it is still billed once (the ads one wins).
export function agreedAddOns(cl) {
  const c = cl || {};
  const out = [];
  if (c.contractSigned) for (const a of addOnsOf(c)) out.push({ ...a, source: "ads" });
  if (websiteSigned(c)) {
    const t = websiteTerms(c);
    if (t.gbpCare && t.gbpMonthly > 0 && !out.some((a) => a.id === "gbp_care")) out.push({ id: "gbp_care", monthly: t.gbpMonthly, source: "website" });
  }
  return out;
}

export const billingOf = (cl, id) => (((cl && cl.addOnBilling) || {})[id]) || null;
export const billingLive = (b) => !!(b && b.subscriptionId && b.status !== "canceled");

// Pure: where one add-on stands for this business.
//   exempt          BoldLine or an owned business: never billed
//   billing         a subscription is running (or ending at the period end, see `stopAt`)
//   none            not in any signed agreement
//   stopped         Bryson stopped it; only he restarts it
//   waiting_profile agreed, but their Google profile isn't linked in the OS yet, so the service hasn't started
//   ready           agreed and able to start: billing-watch starts it
export function addOnPlan(cl, id = "gbp_care") {
  const c = cl || {};
  const agreed = agreedAddOns(c).find((a) => a.id === id) || null;
  const billing = billingOf(c, id);
  if (c.internal) return { state: "exempt", agreed, billing };
  if (billingLive(billing)) return { state: "billing", agreed, billing };
  if (!agreed) return { state: billing ? "stopped" : "none", agreed, billing };
  if (billing && billing.status === "canceled") return { state: "stopped", agreed, billing };
  if (id === "gbp_care" && !(c.gbp && c.gbp.location)) return { state: "waiting_profile", agreed, billing };
  return { state: "ready", agreed, billing };
}

// Start the subscription. `manual` is Bryson pressing the button: it may restart one he stopped, and may start before
// the profile is linked (he knows when they gave access). Nothing else is relaxed: it must be in a signed agreement.
// `api` = { stripe, ensureCustomer, resolvePaymentMethod } from stripe-shared.mjs, passed in so tests see every request.
export async function startAddOn(cl, id, api, { now = new Date(), manual = false } = {}) {
  const c = cl || {};
  const p = addOnPlan(c, id);
  if (p.state === "billing") return { billing: p.billing, already: true };
  if (p.state === "exempt") throw new Error("BoldLine's own businesses are never billed.");
  if (!p.agreed) throw new Error("It isn't in a signed agreement, so there's nothing to bill.");
  if (!manual && p.state !== "ready") throw new Error(p.state === "waiting_profile" ? "Their Google profile isn't linked yet." : "Billing was stopped. Start it again by hand.");
  if (!c.email) throw new Error("Add the client's email on the Overview tab first.");
  const prev = p.billing || {};
  const customerId = await api.ensureCustomer(c.stripeCustomerId || (c.websiteDeal && c.websiteDeal.customerId) || prev.customerId || "", { email: c.email, name: c.name, clientId: c.id });
  const pm = await api.resolvePaymentMethod(customerId, c.stripeSubscriptionId || null);
  const meta = { clientId: c.id, kind: "addon", addOn: id };
  // One key per business, add-on and start, so a retry or two triggers racing can never open two subscriptions.
  const key = `addon-${c.id}-${id}-${prev.endedAt || prev.startedAt || "first"}`;
  const product = await api.stripe("products", { body: { name: `${ADD_ONS[id].name}, ${c.name || "client"}`, metadata: meta }, idempotencyKey: `${key}-product` });
  const sub = await api.stripe("subscriptions", {
    body: {
      customer: customerId, metadata: meta, description: `${ADD_ONS[id].name} for ${c.name || "your business"}`,
      items: [{ price_data: { currency: "usd", product: product.id, unit_amount: Math.round(p.agreed.monthly * 100), recurring: { interval: "month" } } }],
      // A card on file is charged; otherwise Stripe emails a monthly invoice, as the agreement says.
      ...(pm ? { collection_method: "charge_automatically", default_payment_method: pm } : { collection_method: "send_invoice", days_until_due: 7 }),
    },
    idempotencyKey: `${key}-sub`,
  });
  const billing = {
    subscriptionId: sub.id, customerId, status: sub.status === "active" ? "active" : (sub.status || "incomplete"),
    startedAt: now.toISOString(), monthly: p.agreed.monthly, collection: pm ? "card" : "invoice", source: p.agreed.source,
  };
  return { billing, customerId };
}

// Stop it at the end of the month already paid for (the agreements: 30 days' notice, a started month is not refunded).
export async function stopAddOn(cl, id, api) {
  const b = billingOf(cl, id);
  if (!billingLive(b)) throw new Error("Nothing is being billed for it.");
  const sub = await api.stripe(`subscriptions/${encodeURIComponent(b.subscriptionId)}`, { body: { cancel_at_period_end: true } });
  const end = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return { billing: { ...b, stopAt: end ? new Date(end * 1000).toISOString() : new Date().toISOString() } };
}

// ── Telling the subscriptions apart ──────────────────────────────────────────────────
// An add-on subscription and its invoices carry `kind: "addon"` on the subscription (newer API versions put the
// subscription's metadata under `parent` on an invoice).
export const addOnKind = (obj) => {
  const o = obj || {};
  const metas = [o.metadata, o.subscription_details && o.subscription_details.metadata, o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata];
  const m = metas.find((x) => x && x.kind === "addon");
  return m ? { id: m.addOn || "gbp_care" } : null;
};
// The client's ADS subscription: the first one carrying no `kind` tag (website care and add-ons both carry one).
export const isAdsSubscription = (sub) => !!sub && !(sub.metadata && sub.metadata.kind);
export const adsSubscriptionOf = (list) => (Array.isArray(list) ? list : []).find(isAdsSubscription) || null;
// An invoice that belongs to the ads agreement, so the ads late-payment policy may act on it.
export const isAdsInvoice = (inv) => !!inv && !websiteKind(inv) && !addOnKind(inv);

// Pure: a Stripe event for an add-on in, the new billing state and anything worth telling Bryson out.
export function applyAddOnEvent(cl, event, now = new Date()) {
  const obj = (event && event.data && event.data.object) || {};
  const k = addOnKind(obj);
  if (!k) return null;
  const b = billingOf(cl, k.id) || {};
  const name = (cl && cl.name) || "A client";
  const label = ADDON_LABEL[k.id] || "add-on";
  const iso = now.toISOString();
  if (event.type === "invoice.paid") return { id: k.id, billing: { ...b, status: "active", lastPaidAt: iso }, alert: null };
  if (event.type === "invoice.payment_failed") {
    const due = ((obj.amount_remaining != null ? obj.amount_remaining : obj.amount_due) || 0) / 100;
    return { id: k.id, billing: { ...b, status: "past_due" },
      alert: { severity: "yellow", title: `${name}'s ${label} payment failed`, body: `The ${money(due)} monthly ${label} payment from ${name} did not go through. Stripe will try again. Their ads are not affected. Under the agreement you may pause the ${label} once it is 15 days overdue.`, smsText: `${name}'s ${label} payment failed.` } };
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const map = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "canceled", incomplete: "incomplete", incomplete_expired: "canceled" };
    const gone = event.type === "customer.subscription.deleted";
    const status = gone ? "canceled" : (map[obj.status] || b.status || "");
    const end = obj.cancel_at_period_end && obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null;
    const next = { ...b, subscriptionId: obj.id || b.subscriptionId, status, ...(gone ? { endedAt: iso } : {}) };
    if (end) next.stopAt = end; else if (!gone && obj.cancel_at_period_end === false) delete next.stopAt;
    return { id: k.id, billing: next, alert: null };
  }
  return { id: k.id, billing: b, alert: null };
}

// ── Daily: start every add-on that is agreed and ready (billing-watch) ─────────────────────────
// `rows` = [{ id, data }]. Writes `addOnBilling` back onto a FRESH read of the record, and tells Bryson what started.
export async function runAddOnStarts(db, rows, api, { now = new Date(), alert = async () => {} } = {}) {
  const started = [];
  for (const r of rows || []) {
    const cl = (r && r.data) || {};
    for (const id of Object.keys(ADD_ONS)) {
      if (addOnPlan(cl, id).state !== "ready") continue;
      try {
        const res = await startAddOn(cl, id, api, { now });
        if (res.already) continue;
        const { data: fresh } = await db.from("clients").select("data").eq("id", r.id).maybeSingle();
        const d = (fresh && fresh.data) || cl;
        const { error } = await db.from("clients").update({ data: { ...d, addOnBilling: { ...(d.addOnBilling || {}), [id]: res.billing } }, updated_at: now.toISOString() }).eq("id", r.id);
        if (error) throw new Error(error.message);
        started.push(`${cl.name || r.id}: ${ADDON_LABEL[id]} at ${money(res.billing.monthly)} a month, ${res.billing.collection === "card" ? "charged to the card on file" : "invoiced by email (no card on file)"}`);
      } catch (e) {
        console.error(`addon-billing: could not start ${id} for ${cl.name || r.id}:`, e.message);
      }
    }
  }
  if (started.length) {
    try { await alert({ severity: "green", title: started.length === 1 ? "Add-on billing started" : `${started.length} add-ons started billing`, body: `${started.join("\n")}\n\nIt runs every month until it is stopped from the Google listing card.`, smsText: started[0] }); } catch (e) {}
  }
  return { started };
}
