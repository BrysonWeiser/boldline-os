// Can BoldLine actually get PAID by a client with no monthly minimum?
//
// The honest answer, until 2026-08-27, was no. Bryson's first client signed on $50 a
// qualified lead with the minimum waived for three months, and every billing path in the
// OS assumed a subscription:
//
//   · the only way a card ever got saved was by creating a subscription, and the setup
//     button was hidden entirely when the monthly was 0, so no Stripe customer existed;
//   · `charge-leads` refused outright — "No billing set up for this client";
//   · approved lead fees were dropped as PENDING INVOICE ITEMS, which Stripe sweeps onto
//     the next SUBSCRIPTION invoice. With no subscription, nothing ever swept them.
//
// 🔴 SO FIVE QUALIFIED LEADS WOULD HAVE EARNED $250 AND COLLECTED $0, with every screen
// reporting success. That is the shape this suite exists to prevent: not an error, but a
// silent nothing.
//
// The REAL handler runs here. `fetch` is stubbed at the boundary Stripe lives behind, so
// auth, routing, form encoding and every guard execute exactly as they do in production,
// and each Stripe call is captured with its decoded parameters. A test that asserted on a
// re-implementation of the request builder would prove nothing (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

process.env.STRIPE_SECRET_KEY = "sk_test_harness";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-harness";

// ── The Stripe stub ───────────────────────────────────────────────────────────
// `routes` maps "METHOD path" to a response (or a function of the decoded params).
// Anything unrouted is a 404, which is how a stale customer id behaves for real.
let calls = [];
let routes = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = (opts.method || "GET").toUpperCase();

  // Supabase auth: the handler verifies the owner's session before doing anything.
  if (u.includes("supabase.co")) {
    return new Response(JSON.stringify({ id: "owner-1", aud: "authenticated", email: "b@b.com" }),
      { status: 200, headers: { "content-type": "application/json" } });
  }

  const path = u.replace("https://api.stripe.com/v1/", "");
  const params = Object.fromEntries(new URLSearchParams(opts.body || ""));
  calls.push({ method, path, params });

  const key = `${method} ${path}`;
  let hit = routes[key];
  if (hit === undefined) {
    // Match on the path without its query string too, so listing endpoints are routable.
    hit = routes[`${method} ${path.split("?")[0]}`];
  }
  if (hit === undefined) {
    return new Response(JSON.stringify({ error: { message: "No such resource", code: "resource_missing" } }),
      { status: 404, headers: { "content-type": "application/json" } });
  }
  const body = typeof hit === "function" ? hit(params) : hit;
  const status = (body && body.__status) || 200;
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};

const { default: handler } = await import("../netlify/functions/stripe-billing.mjs");

const call = async (body, routeTable = {}) => {
  calls = [];
  routes = routeTable;
  const res = await handler(new Request("https://os.test/.netlify/functions/stripe-billing", {
    method: "POST",
    headers: { authorization: "Bearer owner-jwt", "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  const data = await res.json();
  return { status: res.status, data, calls: [...calls] };
};
const sent = (r, method, pathStarts) => r.calls.find((c) => c.method === method && c.path.startsWith(pathStarts));

// Common Stripe shapes.
const CUSTOMER = { id: "cus_1", email: "s@s.com", invoice_settings: {} };
const SESSION = { id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" };

// ── 1. 🔴 A CARD CAN BE SAVED WITH NO SUBSCRIPTION ────────────────────────────
{
  const r = await call(
    { action: "save-card", clientId: "c1", email: "s@s.com", name: "Sebastian", origin: "https://os.test/" },
    { "POST customers": CUSTOMER, "POST checkout/sessions": SESSION },
  );
  ok("save-card succeeds", r.data.ok === true, JSON.stringify(r.data));
  ok("it returns a link to send the client", r.data.url === SESSION.url);
  ok("and the Stripe customer it created, so the OS can bill them later", r.data.customerId === "cus_1");

  const s = sent(r, "POST", "checkout/sessions");
  // 🔴 The whole point: setup mode collects a payment method and charges NOTHING.
  ok("🔴 the session is mode=setup, which charges nothing", s.params.mode === "setup", s.params.mode);
  ok("🔴 and it creates no subscription", !Object.keys(s.params).some((k) => k.startsWith("subscription_data")),
    "a subscription here would auto-charge a client whose agreement says there is no minimum");
  ok("🔴 and no line items, so there is nothing to pay", !Object.keys(s.params).some((k) => k.startsWith("line_items")));
  ok("it is attached to the customer, not an anonymous checkout", s.params.customer === "cus_1");
  ok("bank accounts are accepted too, not only cards",
    Object.values(s.params).includes("us_bank_account"));
  ok("the client id rides along so Stripe records tie back to the OS",
    s.params["metadata[clientId]"] === "c1" && s.params.client_reference_id === "c1");
  ok("the trailing slash on the origin does not produce a double slash",
    !/os\.test\/\//.test(s.params.success_url), s.params.success_url);
}
{
  // Guards. Each is a way to create a broken Stripe record.
  const noEmail = await call({ action: "save-card", clientId: "c1", origin: "https://os.test" });
  ok("a client with no email is refused, with the fix named", noEmail.status === 400 && /Overview tab/.test(noEmail.data.error));
  ok("and no Stripe record is created for them", noEmail.calls.length === 0);
  const noId = await call({ action: "save-card", email: "s@s.com", origin: "https://os.test" });
  ok("a missing client id is refused", noId.status === 400 && noId.calls.length === 0);
  const noOrigin = await call({ action: "save-card", clientId: "c1", email: "s@s.com" });
  ok("a missing origin is refused before anything is created", noOrigin.status === 400 && noOrigin.calls.length === 0);
}
{
  // 🔴 A STORED CUSTOMER ID CAN BE A LIE — a test-mode id left behind after going live,
  // or one deleted in the dashboard. Both look perfectly fine in our database.
  const r = await call(
    { action: "save-card", clientId: "c1", email: "s@s.com", customerId: "cus_stale", origin: "https://os.test" },
    { "POST customers": { id: "cus_new" }, "POST checkout/sessions": SESSION },   // GET customers/cus_stale -> 404
  );
  ok("🔴 a customer id that no longer exists is replaced, not trusted", r.data.customerId === "cus_new");
  ok("and the new one is what Checkout is pointed at", sent(r, "POST", "checkout/sessions").params.customer === "cus_new");

  const reuse = await call(
    { action: "save-card", clientId: "c1", email: "s@s.com", customerId: "cus_1", origin: "https://os.test" },
    { "GET customers/cus_1": CUSTOMER, "POST checkout/sessions": SESSION },
  );
  ok("a customer that DOES exist is reused rather than duplicated",
    reuse.data.customerId === "cus_1" && !sent(reuse, "POST", "customers"),
    "duplicate customers split a client's payment history in two");

  const deleted = await call(
    { action: "save-card", clientId: "c1", email: "s@s.com", customerId: "cus_del", origin: "https://os.test" },
    { "GET customers/cus_del": { id: "cus_del", deleted: true }, "POST customers": { id: "cus_fresh" }, "POST checkout/sessions": SESSION },
  );
  ok("a DELETED customer is replaced too, not just a missing one", deleted.data.customerId === "cus_fresh");
}

// ── 2. 🔴 SYNC RECOGNISES A CLIENT WHO HAS A CARD BUT NO SUBSCRIPTION ─────────
// Before this, "no subscription" was read as "no billing", so a client with a perfectly
// good card on file showed as Not Set Up forever and the lead-billing UI stayed hidden.
{
  const r = await call({ action: "sync", customerId: "cus_1" }, {
    "GET subscriptions": { data: [] },
    "GET invoices": { data: [] },
    "GET customers/cus_1": CUSTOMER,
    "GET payment_methods": { data: [{ id: "pm_1" }] },
    "POST customers/cus_1": { id: "cus_1" },
  });
  ok("🔴 a customer with a card but no subscription reads as card_on_file",
    r.data.billingStatus === "card_on_file", r.data.billingStatus);
  ok("the payment method is reported back", r.data.paymentMethodId === "pm_1");
  // 🔴 Setup-mode Checkout attaches the card to the customer WITHOUT making it the
  // invoice default, so a standalone invoice finds nothing and sits in "Retrying".
  const upd = sent(r, "POST", "customers/cus_1");
  ok("🔴 the card is made the invoice default there and then",
    upd && upd.params["invoice_settings[default_payment_method]"] === "pm_1",
    "without this, the lead invoice is raised against nothing and quietly never collects");
}
{
  const r = await call({ action: "sync", customerId: "cus_1" }, {
    "GET subscriptions": { data: [] },
    "GET invoices": { data: [] },
    "GET customers/cus_1": CUSTOMER,
    "GET payment_methods": { data: [] },
  });
  ok("no subscription AND no card really is 'not set up'", r.data.billingStatus === "none");
  ok("and nothing is written to Stripe in that case", !sent(r, "POST", "customers"));
}
{
  // The existing subscription path must be untouched by all of this.
  const r = await call({ action: "sync", customerId: "cus_1" }, {
    "GET subscriptions": { data: [{ id: "sub_1", status: "active", current_period_end: 1800000000,
      items: { data: [{ price: { unit_amount: 70000 } }] } }] },
    "GET invoices": { data: [{ status: "paid", status_transitions: { paid_at: 1790000000 } }] },
  });
  ok("a real subscription still reads as active", r.data.billingStatus === "active");
  ok("its id and monthly amount still come back", r.data.subscriptionId === "sub_1" && r.data.monthly === 700);
  ok("and the last payment date still comes back", !!r.data.lastPaymentAt);
  ok("🔴 a subscribed client is NOT downgraded to card_on_file", r.data.billingStatus !== "card_on_file");
}

// ── 3. 🔴 APPROVING PARKS THE MONEY. IT DOES NOT CHARGE IT. ───────────────────
//
// Clause 4.3 of a results-only agreement, which the first client signed:
//   "Nothing is billed in advance. After each month closes, Agency calculates the
//    Performance Fee for that month and it is charged on the next invoice. Client is
//    billed in arrears, for results already delivered."
//
// The first version of this billing charged the card the moment Bryson approved a batch.
// That contradicted the document the client was signing at the time, and would have meant
// several charges scattered through a month instead of one bill after it.
{
  const r = await call({ action: "charge-leads", customerId: "cus_1", count: 5, amount: 250, clientName: "Stencil & Thread", arrears: true },
    { "POST invoiceitems": { id: "ii_1" } });
  ok("approving records the money against the client", r.data.ok === true && r.data.itemId === "ii_1");
  // 🔴 The guard. An invoice raised here is a mid-month charge the agreement forbids.
  ok("🔴 but raises NO invoice, because the agreement bills after the month closes",
    !sent(r, "POST", "invoices"),
    "charging on approval would bill the client several times a month, which is not what they signed");
  ok("and charges nothing", !r.calls.some((c) => c.path.endsWith("/pay")));

  const item = sent(r, "POST", "invoiceitems");
  ok("the parked amount is right", item.params.amount === "25000" && item.params.currency === "usd");
  // 🔴 The client reads this line. Saying "above monthly minimum" to someone whose
  // agreement says there is no minimum contradicts the document they signed.
  ok("🔴 the description never mentions a minimum they do not have",
    !/minimum/i.test(item.params.description), item.params.description);
  ok("it says what they are paying for", /5 qualified leads/.test(item.params.description), item.params.description);
  ok("and names the client", /Stencil & Thread/.test(item.params.description));
}
{
  const r = await call({ action: "charge-leads", customerId: "cus_1", count: 1, amount: 50, arrears: true },
    { "POST invoiceitems": { id: "ii_1" } });
  ok("a single lead reads as singular", /1 qualified lead\b/.test(sent(r, "POST", "invoiceitems").params.description),
    sent(r, "POST", "invoiceitems").params.description);
}
{
  // The subscription path is unchanged, and must stay that way: Stripe already sweeps
  // pending items onto their recurring invoice.
  const r = await call({ action: "charge-leads", customerId: "cus_1", count: 3, amount: 150, clientName: "Apex" },
    { "POST invoiceitems": { id: "ii_1" } });
  ok("a client WITH a subscription still gets a pending item", r.data.ok === true && r.data.itemId === "ii_1");
  ok("🔴 and no invoice is raised for them either", !sent(r, "POST", "invoices"),
    "invoicing now AND on their monthly bill would charge the same leads twice");
  ok("their description still explains the greater-of arithmetic",
    /above monthly minimum/.test(sent(r, "POST", "invoiceitems").params.description));
}
{
  const noCard = await call({ action: "charge-leads", count: 5, amount: 250, arrears: true });
  ok("no card on file is refused with advice that fits a results-only client",
    noCard.status === 400 && /save one first/i.test(noCard.data.error), noCard.data.error);
  ok("🔴 and it does NOT tell them to start a subscription they cannot have",
    !/subscription/i.test(noCard.data.error), noCard.data.error);
  const sub = await call({ action: "charge-leads", count: 5, amount: 250 });
  ok("whereas a managed client is still told to start the subscription",
    /subscription/i.test(sub.data.error), sub.data.error);

  const zero = await call({ action: "charge-leads", customerId: "cus_1", count: 5, amount: 0, arrears: true });
  ok("nothing owed is refused rather than sent to Stripe as a $0 charge",
    zero.status === 400 && zero.calls.length === 0);
  ok("and the reason does not invoke a minimum that does not exist",
    !/minimum/i.test(zero.data.error), zero.data.error);
  const none = await call({ action: "charge-leads", customerId: "cus_1", count: 0, amount: 250, arrears: true });
  ok("zero leads is refused", none.status === 400 && none.calls.length === 0);
}

// ── 3b. 🔴 AND THEN ONE INVOICE RAISES THE LOT ────────────────────────────────
const invoiceRoutes = (invoice, pending = [{ amount: 25000 }]) => ({
  "GET invoiceitems": { data: pending },
  "GET customers/cus_1": { id: "cus_1", invoice_settings: { default_payment_method: "pm_1" } },
  "POST invoices": invoice,
  "POST invoices/in_1/pay": { id: "in_1", status: "paid", hosted_invoice_url: "https://pay/in_1" },
});
{
  const r = await call({ action: "invoice-leads", customerId: "cus_1", clientName: "Stencil & Thread" },
    invoiceRoutes({ id: "in_1", amount_due: 25000, hosted_invoice_url: "https://pay/in_1" }));
  ok("🔴 the month's approved leads become one invoice", r.data.ok === true && r.data.amount === 250, JSON.stringify(r.data));
  ok("🔴 and it is CHARGED to the card on file", r.data.paid === true && !!sent(r, "POST", "invoices/in_1/pay"));
  ok("the client gets a link to it", r.data.invoiceUrl === "https://pay/in_1");

  const inv = sent(r, "POST", "invoices");
  // 🔴 Current API versions default this to "exclude", which produces an EMPTY $0 invoice
  // that trivially "pays" while the real charge silently waits forever.
  ok("🔴 the invoice sweeps in everything parked", inv.params.pending_invoice_items_behavior === "include",
    "without this the invoice comes out at $0 and reports success");
  ok("it charges the card automatically rather than emailing a request",
    inv.params.collection_method === "charge_automatically" && inv.params.auto_advance === "true");
  ok("it is aimed at the card we resolved", inv.params.default_payment_method === "pm_1");
  ok("it is described as leads, so the client's own records make sense",
    /qualified leads/i.test(inv.params.description) && /Stencil & Thread/.test(inv.params.description));
}
{
  // 🔴 A QUIET MONTH MUST NOT LEAVE A $0 INVOICE ON THE CLIENT'S RECORD.
  const r = await call({ action: "invoice-leads", customerId: "cus_1" }, { "GET invoiceitems": { data: [] } });
  ok("🔴 nothing approved means no invoice is raised at all", r.data.nothingDue === true && !sent(r, "POST", "invoices"),
    "raising one to discover it is empty leaves a $0 invoice on their Stripe record every month");
  ok("and it is not treated as a failure", r.data.ok === true);
}
{
  // 🔴 THE EMPTY-INVOICE TRAP, which once reported success while collecting nothing.
  const r = await call({ action: "invoice-leads", customerId: "cus_1" },
    invoiceRoutes({ id: "in_1", amount_due: 0 }));
  ok("🔴 an invoice that came out empty despite parked charges is a FAILURE", r.data.ok === false, JSON.stringify(r.data));
  ok("and it is never 'paid'", !r.data.paid);
  ok("the message says where to look", /pending invoice items/i.test(r.data.error), r.data.error);
}
{
  // A declined card must not lose the invoice — Stripe keeps retrying (dunning).
  const routesNoPay = invoiceRoutes({ id: "in_1", amount_due: 25000, hosted_invoice_url: "https://pay/in_1" });
  delete routesNoPay["POST invoices/in_1/pay"];   // the pay call now 404s, i.e. throws
  const r = await call({ action: "invoice-leads", customerId: "cus_1" }, routesNoPay);
  ok("🔴 a card that fails right now still leaves the invoice standing", r.data.ok === true && r.data.invoiceId === "in_1",
    "the debt is real whether or not the card worked on the first attempt");
  ok("but it is honestly reported as unpaid", r.data.paid === false);
  ok("and the client still has a link to pay it", r.data.invoiceUrl === "https://pay/in_1");
}
{
  const r = await call({ action: "invoice-leads" });
  ok("invoicing with no customer is refused", r.status === 400 && r.calls.length === 0);
}

// ── 3c. 🔴 A DRAFT INVOICE CANNOT BE CHARGED ──────────────────────────────────
// A newly created invoice is a DRAFT. `auto_advance` finalizes it eventually, but
// "eventually" is an account setting — Settings → Billing → Invoices → "Invoice
// finalization grace period", which on this account is ONE HOUR. Charging immediately
// without finalizing races a dashboard toggle nobody remembers setting.
{
  const draft = { id: "in_1", status: "draft", amount_due: 25000, hosted_invoice_url: "https://pay/in_1" };
  const r = await call({ action: "invoice-leads", customerId: "cus_1" }, {
    ...invoiceRoutes(draft),
    "POST invoices/in_1/finalize": { id: "in_1", status: "open", hosted_invoice_url: "https://pay/in_1" },
  });
  ok("🔴 a draft invoice is finalized before anything tries to charge it",
    !!sent(r, "POST", "invoices/in_1/finalize"),
    "a draft cannot be paid, so without this the charge silently fails and waits on an account setting");
  ok("and then it is charged", r.data.paid === true && !!sent(r, "POST", "invoices/in_1/pay"));
  // Read defensively: a missing call must report as a FAILED assertion, not crash the
  // suite and take every check after it down with it.
  const fin = sent(r, "POST", "invoices/in_1/finalize");
  ok("auto_advance stays on, so Stripe is still the backstop",
    !!fin && fin.params.auto_advance === "true", fin ? JSON.stringify(fin.params) : "finalize was never called");
}
{
  // Finalizing collects it outright when a card is already on file. Paying again would be
  // a second charge attempt on an invoice that is already settled.
  const draft = { id: "in_1", status: "draft", amount_due: 25000 };
  const r = await call({ action: "invoice-leads", customerId: "cus_1" }, {
    ...invoiceRoutes(draft),
    "POST invoices/in_1/finalize": { id: "in_1", status: "paid", hosted_invoice_url: "https://pay/in_1" },
  });
  ok("🔴 an invoice already paid by finalizing is not charged a second time",
    !sent(r, "POST", "invoices/in_1/pay"), "that would be a duplicate charge attempt");
  ok("and it is reported as paid", r.data.paid === true && r.data.invoiceUrl === "https://pay/in_1");
}
{
  // Every step is fail-soft: auto_advance means Stripe gets there without us.
  const routes = invoiceRoutes({ id: "in_1", status: "draft", amount_due: 25000, hosted_invoice_url: "https://pay/in_1" });
  // no finalize route -> the call 404s, i.e. throws
  const r = await call({ action: "invoice-leads", customerId: "cus_1" }, routes);
  ok("a finalize that fails does not abort the run", r.data.ok === true && r.data.invoiceId === "in_1");
  ok("it still tries to charge", !!sent(r, "POST", "invoices/in_1/pay"));
}
{
  // An invoice Stripe already finalized needs no finalize call.
  const r = await call({ action: "invoice-leads", customerId: "cus_1" },
    invoiceRoutes({ id: "in_1", status: "open", amount_due: 25000 }));
  ok("an invoice that is already open is not finalized again", !sent(r, "POST", "invoices/in_1/finalize"));
  ok("and is charged straight away", r.data.paid === true);
}
{
  // 🔴 The ETF shares the exact same helper, so it cannot behave differently.
  const r = await call({ action: "charge-etf", customerId: "cus_1", subscriptionId: "sub_1", etfFee: 700, clawback: 0 }, {
    "POST invoiceitems": { id: "ii_1" },
    "GET subscriptions/sub_1": { id: "sub_1", default_payment_method: "pm_sub" },
    "POST invoices": { id: "in_1", status: "draft", amount_due: 70000 },
    "POST invoices/in_1/finalize": { id: "in_1", status: "open" },
    "POST invoices/in_1/pay": { id: "in_1", status: "paid" },
    "POST subscriptions/sub_1": { id: "sub_1" },
  });
  ok("🔴 the ETF invoice is finalized too", !!sent(r, "POST", "invoices/in_1/finalize"),
    "it had the identical flaw, and sharing one helper is what stops them drifting apart");
  ok("and still collects", r.data.paid === true);
}

// ── 4. The ETF still works, since it now shares the payment-method resolver ───
{
  const r = await call({ action: "charge-etf", customerId: "cus_1", subscriptionId: "sub_1", etfFee: 700, clawback: 300, clientName: "Apex" }, {
    "POST invoiceitems": { id: "ii_1" },
    "GET subscriptions/sub_1": { id: "sub_1", default_payment_method: "pm_sub" },
    "POST invoices": { id: "in_1", amount_due: 100000, hosted_invoice_url: "https://pay/in_1" },
    "POST invoices/in_1/pay": { id: "in_1", status: "paid" },
    "POST subscriptions/sub_1": { id: "sub_1" },
  });
  ok("the ETF still bills and collects", r.data.ok === true && r.data.paid === true);
  ok("🔴 it still prefers the SUBSCRIPTION's card over the customer default",
    sent(r, "POST", "invoices").params.default_payment_method === "pm_sub",
    "the shared resolver must not have changed the order the ETF depended on");
  ok("and it still winds the subscription down at period end",
    sent(r, "POST", "subscriptions/sub_1").params.cancel_at_period_end === "true");
}

// ── 4b. 🔴 THE MONTH-END RUN, THE THING THAT ACTUALLY COLLECTS ────────────────
// Approving parks money and nothing else, so if this job does not run, or picks the wrong
// clients, a results-only client is never billed at all. The real loop runs here with its
// four outside edges handed in, so the bad-day paths execute rather than being reasoned about.
{
  const { runLeadInvoices, dueForInvoice, summaryLine } = await import("../netlify/functions/lead-invoice-run.mjs");

  const cl = (o = {}) => ({ name: "Stencil & Thread", stripeCustomerId: "cus_1", billingStatus: "card_on_file", ...o });
  ok("a results-only client with a card is billed", dueForInvoice(cl()));
  ok("one who is behind on payment is still billed for new work", dueForInvoice(cl({ billingStatus: "past_due" })));
  // 🔴 Stripe already sweeps their pending items onto the recurring invoice, so billing
  // them here as well charges the same leads twice.
  //
  // The status is deliberately `card_on_file`, NOT `active`. An "active" client is already
  // excluded by the status check below, so asserting on one would pass whether or not the
  // subscription guard existed at all — it would be a test of the data, not of the code.
  // This shape (a saved card AND a subscription) is real: a client who started
  // results-only and later moved onto a minimum, before the next sync rewrites the status.
  ok("🔴 a client WITH a subscription is skipped, or their leads bill twice",
    !dueForInvoice(cl({ stripeSubscriptionId: "sub_1", billingStatus: "card_on_file" })));
  ok("and one on an active subscription likewise",
    !dueForInvoice(cl({ stripeSubscriptionId: "sub_1", billingStatus: "active" })));
  ok("someone who never saved a card is skipped", !dueForInvoice(cl({ stripeCustomerId: "" })));
  ok("a client still awaiting their card is skipped", !dueForInvoice(cl({ billingStatus: "awaiting_card" })));
  ok("the house account is skipped", !dueForInvoice(cl({ internal: true })));
  ok("a missing client does not throw", dueForInvoice(null) === false);

  const harness = (rows, results, opts = {}) => {
    const saved = [], alerts = [], asked = [];
    return runLeadInvoices({
      loadClients: async () => rows,
      invoiceFor: async (c) => {
        asked.push(c.name);
        const r = results[c.name];
        if (r instanceof Error) throw r;
        return r;
      },
      saveClient: async (id, data) => { if (opts.saveThrows) throw new Error("supabase write failed"); saved.push({ id, data }); },
      alert: async (a) => { alerts.push(a); },
    }).then((summary) => ({ summary, saved, alerts, asked }));
  };
  const PAID = { invoiceId: "in_1", invoiceUrl: "https://pay/in_1", paid: true, amount: 250, count: 5 };

  {
    const rows = [
      { id: "a", data: cl() },
      { id: "b", data: cl({ name: "Quiet Co" }) },
      { id: "c", data: cl({ name: "Managed Co", stripeSubscriptionId: "sub_1", billingStatus: "active" }) },
    ];
    const r = await harness(rows, { "Stencil & Thread": PAID, "Quiet Co": { nothingDue: true, count: 0, amount: 0 } });
    ok("only the results-only clients are invoiced", r.summary.due === 2 && r.asked.length === 2);
    ok("🔴 the subscribed client is never even asked", !r.asked.includes("Managed Co"));
    ok("the one with leads is billed", r.summary.invoiced === 1 && r.summary.total === 250);
    ok("the record is the whole client plus the invoice, not a replacement",
      r.saved[0].data.stripeCustomerId === "cus_1" && r.saved[0].data.lastLeadInvoiceUrl === "https://pay/in_1");
    ok("a line goes in their history", /Invoiced \$250/.test(r.saved[0].data.commLog[0].note));
    // 🔴 A month with no approved leads is a NORMAL month.
    ok("🔴 a client with nothing owed gets no invoice and no alert",
      r.summary.nothingDue === 1 && r.saved.length === 1);
    ok("Bryson gets one summary, not one alert per client", r.alerts.length === 1);
    ok("and it tells him the total", /\$250/.test(r.alerts[0].title), r.alerts[0].title);
    ok("a fully collected run is good news, not a warning", r.alerts[0].severity === "green");
  }
  {
    const rows = [{ id: "a", data: cl() }];
    const r = await harness(rows, { "Stencil & Thread": { ...PAID, paid: false } });
    ok("an invoice the card did not cover is still recorded", r.summary.invoiced === 1 && r.saved.length === 1);
    ok("and Bryson is told payment is pending rather than told it is collected",
      r.alerts[0].severity === "yellow" && /pending/i.test(r.alerts[0].body), r.alerts[0].body);
  }
  {
    // 🔴 ONE CLIENT FAILING MUST NOT COST EVERYONE ELSE A MONTH'S BILLING.
    const rows = [{ id: "a", data: cl({ name: "Broken Co" }) }, { id: "b", data: cl() }];
    const r = await harness(rows, { "Broken Co": new Error("card_declined"), "Stencil & Thread": PAID });
    ok("🔴 a client that throws does not stop the next one being billed",
      r.summary.invoiced === 1 && r.saved.length === 1 && r.saved[0].data.name === "Stencil & Thread");
    ok("the failure is counted", r.summary.errors === 1);
    const red = r.alerts.find((a) => a.severity === "red");
    ok("and Bryson is told which client, and what to do", !!red && /Broken Co/.test(red.title) && /Invoice Now/.test(red.body));
    ok("🔴 he is told the money is not lost", /still owed/i.test(red.body), red.body);
  }
  {
    // The money is real even when our own bookkeeping fails, and saying otherwise would
    // have him re-invoice a client who has already been charged.
    const rows = [{ id: "a", data: cl() }];
    const r = await harness(rows, { "Stencil & Thread": PAID }, { saveThrows: true });
    ok("a failed save is reported", r.summary.errors === 1 && r.summary.invoiced === 0);
    const a = r.alerts[0];
    ok("🔴 but it does NOT claim the client went unbilled", /has been invoiced/.test(a.body), a.body);
    ok("🔴 and it says explicitly not to re-invoice",
      /Nothing needs re-invoicing/i.test(a.body), a.body);
  }
  {
    const r = await harness([], {});
    ok("no results-only clients is a silent no-op", r.summary.due === 0 && r.alerts.length === 0);
    ok("the summary line reads as English", /0 due, 0 invoiced/.test(summaryLine(r.summary)), summaryLine(r.summary));
  }

  // 🔴 A scheduled function with no cron entry is a file that never executes, and the
  // symptom would be a client who is simply never billed.
  const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
  const m = toml.match(/\[functions\."lead-invoice-run"\]\s*\n\s*schedule\s*=\s*"([^"]+)"/);
  ok("🔴 the month-end run is actually scheduled", !!m, "without this nobody is ever invoiced");
  ok("and it runs monthly, on the 1st, not daily",
    !!m && /^\S+ \S+ 1 \S+ \S+$/.test(m[1]), m && m[1]);
}

// ── 5. Unpaid lead invoices have to be CHASED, not just raised ────────────────
// An invoice nobody watches is barely better than no invoice at all.
{
  const watch = readFileSync(join(ROOT, "netlify/functions/billing-watch.mjs"), "utf8");
  ok("🔴 the overdue watcher covers clients who pay without a subscription",
    /"active",\s*"card_on_file"/.test(watch),
    "a results-only client's unpaid lead invoice would otherwise never be noticed or chased");
  // 🔴 Recovering must restore what they ARE. Flipping everyone to "active" would tell the
  // OS a results-only client has a subscription, and every screen reading that status
  // would then offer to re-rate or cancel one that does not exist.
  ok("🔴 recovering from past due restores the right status, not always 'active'",
    /past_due"\)\s*cl\.billingStatus\s*=\s*cl\.stripeSubscriptionId \? "active" : "card_on_file"/.test(watch));
}

// ── 6. The OS itself offers the right button for each kind of client ──────────
{
  const app = readFileSync(join(ROOT, "index.html"), "utf8");
  ok("🔴 a results-only client is offered a way to save a card",
    /Save a Card on File/.test(app),
    "the card used to read 'there is no subscription to create' and offer no button at all");
  ok("the OS asks the backend for it by name", /callBilling\("save-card"/.test(app));
  ok("the approval is marked as arrears so the line item is worded right", /arrears:resultsOnly/.test(app));
  // 🔴 Approving parks money; it does not charge it. Without this panel the obvious
  // reading of "Approved" is "charged", and Bryson would be waiting on money nobody
  // had asked for yet.
  ok("🔴 the OS shows what is waiting to be invoiced", /This Month&rsquo;s Invoice/.test(app));
  ok("and says plainly when it goes out", /Goes out automatically on the/.test(app));
  ok("and the approval message does not imply the card was charged",
    /added to this month's invoice\. Nothing is charged until the 1st/.test(app));
  ok("there is a way to bill early for a client who is leaving", /callBilling\("invoice-leads"/.test(app));
  // A hand-off has price 0 because there is no monthly, not because it is free. Picking
  // the button on `monthly>0` alone dropped it into the results-only branch with no
  // checkout button at all, leaving the one-time path unreachable from this screen.
  ok("🔴 a one-time build gets its own collect-the-fee button", /Build Fee/.test(app));
  ok("results-only is decided on the monthly, and excludes a one-time build",
    /const resultsOnly=!oneTime&&!\(monthly>0\)/.test(app));
  ok("the lead-billing section is shown for a saved card as well as a subscription",
    /const managed=!oneTime&&\(status==="active"\|\|status==="card_on_file"\)/.test(app));
}

globalThis.fetch = realFetch;
console.log(`verify-results-only-billing: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
