// ── The Complete step-down at month 13 (Bryson, 2026-11-10, KB complete-plan) ──────────────────────────────────────
// Complete is $500 a month for the 12-month initial term (that pays back the free website build), then $375. The
// agreement says so (planFeeAfterTermOf, frozen at send). This moves the Stripe subscription to the lower fee in time
// for the first invoice after the initial term. Run daily by billing-watch.
//
// 🔴 With proration "none" the month already paid is untouched; only the NEXT invoice changes. So the price is changed
// as soon as the next invoice is the first one after the initial term, never earlier (a month at $375 inside year one
// would undercharge what the client agreed) and never later (a month at $500 after it would overcharge).
// It only ever LOWERS a price, and only to what the agreement says. It never raises one.
import { planOf, planFeeOf, planFeeAfterTermOf, firstTermMonths, isStorePkgId, planPrepayOf } from "./contract-shared.cjs";

const addMonths = (iso, n) => { const d = new Date(iso); if (isNaN(d.getTime())) return null; const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d; };

// Pure: is the step-down due on this subscription? Returns { from, to, termEnd } or null.
export function completeStepDownDue(cl, sub) {
  cl = cl || {};
  if (planOf(cl) !== "complete" || isStorePkgId(cl) || !cl.contractStart || !sub) return null;
  if (!["active", "trialing", "past_due"].includes(sub.status)) return null;
  const fee = planFeeOf(cl), after = planFeeAfterTermOf(cl);
  if (!(after < fee)) return null;
  const item = sub.items && sub.items.data && sub.items.data[0];
  const amount = item && item.price && item.price.unit_amount != null ? item.price.unit_amount / 100 : null;
  if (amount == null || !(amount > after)) return null;           // already there, or lower: never raise
  const termEnd = addMonths(cl.contractStart, firstTermMonths(cl));
  if (!termEnd || !sub.current_period_end) return null;
  // The next invoice is dated the current period's end. Due once that date is on or after the end of the initial term
  // (a day of slack for time zones: Stripe periods are in UTC, the Start Date is a calendar date).
  if (sub.current_period_end * 1000 < termEnd.getTime() - 864e5) return null;
  return { from: amount, to: after, termEnd: termEnd.toISOString().slice(0, 10) };
}

// Change the subscription's price in place, on the same product, from the next invoice. `stripe` is the shared helper.
export async function applyStepDown(stripe, sub, to, name) {
  const item = sub.items.data[0];
  let productId = item.price && (typeof item.price.product === "string" ? item.price.product : item.price.product && item.price.product.id);
  if (productId) {
    try {
      const prod = await stripe(`products/${encodeURIComponent(productId)}`, { method: "GET" });
      if (prod.deleted) productId = "";
      else if (prod.active === false) { try { await stripe(`products/${encodeURIComponent(productId)}`, { body: { active: true } }); } catch { productId = ""; } }
    } catch { productId = ""; }
  }
  if (!productId) productId = (await stripe("products", { body: { name: `BoldLine Media — Complete plan (${name || "client"})` } })).id;
  await stripe(`subscriptions/${encodeURIComponent(sub.id)}`, {
    body: { items: [{ id: item.id, price_data: { currency: "usd", product: productId, unit_amount: Math.round(to * 100), recurring: { interval: "month" } } }], proration_behavior: "none" },
    idempotencyKey: `complete-stepdown-${sub.id}-${Math.round(to * 100)}`,
  });
}

// ── 🔴 THE YEAR PAID UP FRONT, THEN MONTH 13 (Bryson, 2026-11-17, KB complete-plan) ─────────────────────────────────────
// A Complete client who paid the first 12 months in one go has NO subscription during year one (their lead fees are
// invoiced monthly to the saved card, like a results-only client). The agreement says the fee then drops to $375 a
// month, billed monthly in advance, so on the day the initial term ends this starts that subscription on the saved
// card. A week before, Bryson gets a heads-up, so a client who told him they are leaving can be recorded first.
// It never starts for: a client not on the up-front option, one whose payment never landed, one who is ending
// (Early termination recorded, or the contract marked expired), BoldLine's own businesses, or anyone who already has a
// subscription. One key per client and start date, so a retry or two runs racing can never open two.

export function prepayFollowOnDue(cl, sub, now = new Date()) {
  cl = cl || {};
  if (planOf(cl) !== "complete" || isStorePkgId(cl) || !planPrepayOf(cl)) return null;
  if (cl.internal || !cl.contractSigned || cl.contractStatus !== "active" || cl.etf) return null;
  const pp = cl.completePrepay;
  if (!pp || !pp.sessionId || pp.followOn) return null;
  if (sub || cl.stripeSubscriptionId || !cl.stripeCustomerId || !cl.contractStart) return null;
  const termEnd = addMonths(cl.contractStart, firstTermMonths(cl));
  const monthly = planFeeAfterTermOf(cl);
  if (!termEnd || !(monthly > 0)) return null;
  const left = termEnd.getTime() - new Date(now).getTime();
  if (left > 7 * 864e5) return null;
  const termEndIso = termEnd.toISOString().slice(0, 10);
  if (left > 0) return pp.noticeFor === termEndIso ? null : { kind: "notice", monthly, termEnd: termEndIso };
  return { kind: "start", monthly, termEnd: termEndIso };
}

// `api` = { stripe, resolvePaymentMethod } from stripe-shared.mjs. Returns the followOn record to save.
export async function startPrepayFollowOn(api, cl, monthly, now = new Date()) {
  const pp = cl.completePrepay || {};
  if (!pp.paidAt) {
    const s = await api.stripe(`checkout/sessions/${encodeURIComponent(pp.sessionId)}`, { method: "GET" });
    if (!s || s.payment_status !== "paid") throw new Error("the year paid up front never cleared in Stripe, so nothing was started");
  }
  const pm = await api.resolvePaymentMethod(cl.stripeCustomerId, null);
  const key = `complete-prepay-followon-${cl.id}-${String(cl.contractStart).replace(/[^0-9A-Za-z]/g, "")}`;
  const product = await api.stripe("products", { body: { name: `BoldLine Media, Complete plan (${cl.name || "client"})`, metadata: { clientId: cl.id } }, idempotencyKey: `${key}-product` });
  const sub = await api.stripe("subscriptions", {
    body: {
      customer: cl.stripeCustomerId, metadata: { clientId: cl.id }, description: `Complete plan for ${cl.name || "your business"}, after the first year`,
      items: [{ price_data: { currency: "usd", product: product.id, unit_amount: Math.round(monthly * 100), recurring: { interval: "month" } } }],
      ...(pm ? { collection_method: "charge_automatically", default_payment_method: pm } : { collection_method: "send_invoice", days_until_due: 7 }),
    },
    idempotencyKey: `${key}-sub`,
  });
  return { subscriptionId: sub.id, status: sub.status || "", startedAt: new Date(now).toISOString(), monthly, collection: pm ? "card" : "invoice" };
}
