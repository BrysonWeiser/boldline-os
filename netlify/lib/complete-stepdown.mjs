// ── The Complete step-down at month 13 (Bryson, 2026-11-10, KB complete-plan) ──────────────────────────────────────
// Complete is $500 a month for the 12-month initial term (that pays back the free website build), then $375. The
// agreement says so (planFeeAfterTermOf, frozen at send). This moves the Stripe subscription to the lower fee in time
// for the first invoice after the initial term. Run daily by billing-watch.
//
// 🔴 With proration "none" the month already paid is untouched; only the NEXT invoice changes. So the price is changed
// as soon as the next invoice is the first one after the initial term, never earlier (a month at $375 inside year one
// would undercharge what the client agreed) and never later (a month at $500 after it would overcharge).
// It only ever LOWERS a price, and only to what the agreement says. It never raises one.
import { planOf, planFeeOf, planFeeAfterTermOf, firstTermMonths, isStorePkgId } from "./contract-shared.cjs";

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
