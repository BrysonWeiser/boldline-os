// The Stripe plumbing that more than one function needs.
//
// Extracted 2026-08-27 when the month-end lead invoicer became a scheduled job of its
// own. Copying the request helper and the payment-method fallback into a second file
// would have created exactly the drift that bit the contract and the portal on the same
// day: two implementations of one thing, and a fix landing in only one of them.
//
// Nothing here is new. It is the code that was already billing real clients.

const SK = process.env.STRIPE_SECRET_KEY;


// ── Stripe REST helper (hand-rolled, no SDK — matches google-ads.mjs style) ───
// Stripe expects application/x-www-form-urlencoded with PHP-style nested keys:
//   a[b][c]=v   and arrays   a[0][b]=v
function encodeForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") encodeForm(item, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === "object") {
      encodeForm(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

async function stripe(path, { method = "POST", body } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${SK}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body ? encodeForm(body).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data.error && data.error.message) || `Stripe ${res.status}`);
    e.detail = data.error || data;
    throw e;
  }
  return data;
}

// Reuse the Stripe customer we already made for this client, or make one.
//
// 🔴 A STORED ID CAN BE A LIE. A test-mode customer left on a client after switching to
// live keys, or a customer deleted in the dashboard, both look fine in our database and
// then fail with "No such customer" at the worst moment. So the id is VERIFIED against
// this mode before it is trusted, and quietly replaced when it is not real.
async function ensureCustomer(existingId, { email, name, clientId }) {
  let customerId = existingId || "";
  if (customerId) {
    try {
      const existing = await stripe(`customers/${encodeURIComponent(customerId)}`, { method: "GET" });
      if (existing.deleted) customerId = "";
    } catch {
      customerId = "";
    }
  }
  if (customerId) return customerId;
  const cust = await stripe("customers", { body: { email, name: name || email, metadata: { clientId } } });
  return cust.id;
}

// Find a payment method to charge a standalone invoice against.
//
// 🔴 THE GOTCHA THIS EXISTS FOR (found 2026-07-16, and setup-mode Checkout does the same
// thing): Checkout attaches the card to the SUBSCRIPTION, and in setup mode it attaches it
// to the customer WITHOUT making it the invoice default. A standalone invoice then finds
// nothing to charge and sits in "Retrying" forever while everything reports success.
// Order: the subscription's card, then the customer's invoice default, then their first.
async function resolvePaymentMethod(customerId, subscriptionId) {
  if (subscriptionId) {
    try {
      const sub = await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
      if (sub.default_payment_method) return sub.default_payment_method;
    } catch { /* fall through */ }
  }
  try {
    const cust = await stripe(`customers/${encodeURIComponent(customerId)}`, { method: "GET" });
    const def = cust.invoice_settings && cust.invoice_settings.default_payment_method;
    if (def) return def;
  } catch { /* fall through */ }
  for (const type of ["card", "us_bank_account"]) {
    try {
      const pms = await stripe(`payment_methods?customer=${encodeURIComponent(customerId)}&type=${type}&limit=1`, { method: "GET" });
      if (pms.data && pms.data[0]) return pms.data[0].id;
    } catch { /* fall through */ }
  }
  return null;
}


// ── ONE INVOICE FOR EVERYTHING PARKED SINCE THE LAST ONE ─────────────────────
//
// 🔴 THIS IS WHAT ACTUALLY BILLS A RESULTS-ONLY CLIENT, AND THE AGREEMENT DICTATES ITS
// SHAPE. Clause 4.3 of a results-only contract reads: "Nothing is billed in advance.
// After each month closes, Agency calculates the Performance Fee for that month and it
// is charged on the next invoice. Client is billed in arrears, for results already
// delivered." So approving a batch of leads PARKS money as a pending invoice item, and
// this is the only thing that turns parked items into a charge.
//
// "Everything parked since the last invoice" rather than "everything dated in month X":
// it is exactly what the agreement promises, it cannot double-bill, and it has no
// month-boundary case where a lead approved at 00:05 on the 1st lands in the wrong bill.
export async function invoiceParkedLeads(customerId, clientName) {
  // Nothing parked = nothing to bill. Checked FIRST, because raising an invoice to find
  // out would leave a $0 invoice on the client's Stripe record every single month.
  const items = await stripe(`invoiceitems?customer=${encodeURIComponent(customerId)}&pending=true&limit=100`, { method: "GET" });
  const pending = items.data || [];
  if (!pending.length) return { nothingDue: true, count: 0, amount: 0 };
  const expected = pending.reduce((s, it) => s + (Number(it.amount) || 0), 0) / 100;

  const pm = await resolvePaymentMethod(customerId, null);
  // 🔴 `pending_invoice_items_behavior: "include"` is NOT optional. Current API versions
  // default to "exclude", which produces an EMPTY $0 invoice that trivially "pays" while
  // the real charge silently waits forever (caught in the 2026-07-16 test run).
  const inv = await stripe("invoices", {
    body: {
      customer: customerId, collection_method: "charge_automatically", auto_advance: true,
      pending_invoice_items_behavior: "include",
      ...(pm ? { default_payment_method: pm } : {}),
      description: `BoldLine Media — qualified leads delivered${clientName ? " for " + clientName : ""}`,
    },
  });
  if (!inv.amount_due || inv.amount_due <= 0) {
    const e = new Error("The invoice came out empty even though there were charges waiting. Check this customer's pending invoice items in Stripe before running it again.");
    e.stage = "empty-invoice";
    throw e;
  }
  const { paid, hostedUrl } = await finalizeAndPay(inv);
  return { invoiceId: inv.id, invoiceUrl: hostedUrl, paid, amount: inv.amount_due / 100, expected, count: pending.length };
}

// Get a freshly created invoice from draft to charged, and report honestly which.
//
// 🔴 FINALIZE BEFORE PAYING, EXPLICITLY. A new invoice is a DRAFT, and a draft cannot be
// charged. `auto_advance: true` gets there on its own eventually, but "eventually" is an
// ACCOUNT SETTING — Settings → Billing → Invoices → "Invoice finalization grace period",
// which on this account is ONE HOUR. Relying on it means the charge attempt races a
// dashboard toggle nobody remembers setting: the money still arrives later, but the OS
// reports "collecting" on an invoice that was about to be paid, and the identical code
// behaves differently on a different account. One extra call removes the whole question.
//
// Every step is fail-soft on purpose. auto_advance stays true throughout, so even if both
// calls fail Stripe finalizes and collects by itself. The worst case is a pessimistic
// `paid: false`, which is the safe direction to be wrong in: it never claims money arrived.
export async function finalizeAndPay(inv) {
  let ready = inv;
  try {
    if (inv.status === "draft") {
      ready = await stripe(`invoices/${encodeURIComponent(inv.id)}/finalize`, { body: { auto_advance: true } });
    }
  } catch { /* fall through and try to pay anyway */ }

  let hostedUrl = ready.hosted_invoice_url || inv.hosted_invoice_url || null;
  // Finalizing can collect it outright when a card is already on file, in which case
  // paying again would be a second charge attempt on a settled invoice.
  let paid = ready.status === "paid";
  if (!paid) {
    try {
      const done = await stripe(`invoices/${encodeURIComponent(inv.id)}/pay`);
      paid = done.status === "paid";
      hostedUrl = done.hosted_invoice_url || hostedUrl;
    } catch { /* left open — auto_advance keeps Stripe collecting and dunning */ }
  }
  return { paid, hostedUrl };
}

export { encodeForm, stripe, ensureCustomer, resolvePaymentMethod };
