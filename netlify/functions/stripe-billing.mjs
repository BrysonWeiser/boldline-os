// Stripe billing for BoldLine Media — owner-authed control plane.
//
// Sets up and manages the RECURRING MANAGEMENT-FEE subscription for a client:
// an auto-charging Stripe subscription (card OR US bank / ACH) at the package's
// monthly price, plus the one-time setup fee on the first invoice.
//
// HARD BUSINESS RULE (never violate): this only ever charges BoldLine's own
// management + setup fee. It NEVER touches client ad spend — the client pays
// Google/Meta directly and owns their ad account. See knowledge/business-constraint-ad-spend.
//
// Secured by the owner's Supabase session (single-owner app — any valid
// dashboard session is the owner), same pattern as docusign-send / google-ads.
//
// POST body (JSON), by action:
//   { action:"create-checkout", clientId, email, name, packageName,
//     monthlyAmount, setupAmount, customerId?, origin }
//       -> creates/reuses a Customer + a subscription Checkout Session.
//          Returns { ok, url, customerId }. The owner sends `url` to the client
//          (or opens it on the close call); the client enters card/bank once and
//          the fee auto-charges monthly thereafter.
//   { action:"sync", customerId }
//       -> reads the customer's latest subscription + invoice straight from
//          Stripe (webhook-independent truth). Returns { ok, billingStatus,
//          subscriptionId, currentPeriodEnd, lastPaymentAt, monthly }.
//   { action:"update-subscription", customerId?, subscriptionId?, monthlyAmount, packageName? }
//       -> rewrites the active subscription's recurring line item to a new monthly
//          management fee (used when a client renews at a term-based rate). New rate
//          applies from the next invoice (proration_behavior:"none"). Returns
//          { ok, subscriptionId, monthly }.
//   { action:"charge-etf", customerId, subscriptionId?, etfFee, clawback, clientName? }
//       -> bills the Agreement's early-termination amounts (one month's fee +
//          term-discount clawback) as an auto-charged standalone invoice and
//          sets the subscription to cancel at period end. Returns
//          { ok, invoiceId, invoiceUrl, paid }.
//   { action:"charge-leads", customerId, count, amount, clientName? }
//       -> bills the part of a month's qualified-lead value that EXCEEDS the package's
//          monthly minimum (already charged by the subscription) as a single pending
//          invoice item riding the next monthly invoice. `amount` is that excess, NOT
//          count × rate — the OS works it out, because the minimum and the performance
//          fee are never both charged. Returns { ok, itemId, count, amount }.
//   { action:"preview-invoice", customerId }
//       -> returns the upcoming subscription invoice (fee + pending lead/interest
//          items) as { ok, upcoming:{ total, subtotal, chargeDate, lines } } — the
//          one bundled bill preview shown on the Billing card. upcoming:null soft-fails.
//   { action:"invoice-link", customerId }
//       -> returns a real Stripe hosted-invoice URL (pay page w/ card/bank + QR)
//          for the branded invoice email: { ok, url, status }. url:null if none yet.
//   { action:"revenue", months? }
//       -> what was ACTUALLY invoiced, by calendar month, across every client:
//          { ok, months:[{ month:"2026-08", collected, outstanding, refunded, net,
//          invoices, isCurrent, clients:[{name,collected,outstanding}] }] }. Reads
//          Stripe rather than the OS's records, because under the greater-of pricing
//          model a package price is a floor and not income. Newest month first.
//   { action:"portal", customerId, origin }
//       -> creates a Stripe Billing Portal session so the card/bank can be
//          updated and invoices viewed. Returns { ok, url }.
//
// Required Netlify env vars (OS site):
//   STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const SK = process.env.STRIPE_SECRET_KEY;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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

// Map a Stripe subscription status to the OS billingStatus vocabulary.
function billingStatusFromSub(sub) {
  if (!sub) return "none";
  switch (sub.status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "awaiting_payment";
    default:
      return sub.status || "none";
  }
}

const dollars = (n) => Math.round(Number(n) * 100); // -> integer cents

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SK) return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: owner's Supabase session.
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try {
    body = JSON.parse((await req.text()) || "{}");
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  const action = body.action;

  try {
    // ── Create (or reuse a Customer and) a subscription Checkout Session ──────
    if (action === "create-checkout") {
      const { clientId, email, name, packageName, monthlyAmount, setupAmount } = body;
      const origin = (body.origin || "").replace(/\/$/, "");
      const monthly = Number(monthlyAmount);
      const setup = Number(setupAmount) || 0;
      if (!clientId) return json({ ok: false, error: "Missing clientId" }, 400);
      if (!email) return json({ ok: false, error: "Add the client's email on the Overview tab first." }, 400);
      if (!(monthly > 0)) return json({ ok: false, error: "Monthly fee must be greater than zero." }, 400);
      if (!origin) return json({ ok: false, error: "Missing origin" }, 400);

      // Reuse an existing customer if we already made one for this client — but
      // only if it still exists in THIS mode. A stale id (e.g. a test-mode
      // customer left on the client after switching to live keys, or a deleted
      // customer) would otherwise make Checkout fail with "No such customer".
      let customerId = body.customerId || "";
      if (customerId) {
        try {
          const existing = await stripe(`customers/${encodeURIComponent(customerId)}`, { method: "GET" });
          if (existing.deleted) customerId = "";
        } catch {
          customerId = ""; // not found in this mode -> fall through and create a fresh one
        }
      }
      if (!customerId) {
        const cust = await stripe("customers", {
          body: { email, name: name || email, metadata: { clientId } },
        });
        customerId = cust.id;
      }

      // Line items: recurring management fee + (optional) one-time setup fee.
      // NOTE: a one-time line item inside a subscription-mode Checkout Session is
      // billed on the FIRST invoice (Stripe supports mixing recurring + one-time
      // line items in mode:subscription). If a future Stripe change ever rejects
      // this, the equivalent is subscription_data[add_invoice_items].
      const line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `BoldLine Media — ${packageName || "Management"} (monthly minimum)` },
            unit_amount: dollars(monthly),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ];
      if (setup > 0) {
        line_items.push({
          price_data: {
            currency: "usd",
            product_data: { name: "One-time setup fee" },
            unit_amount: dollars(setup),
          },
          quantity: 1,
        });
      }

      const session = await stripe("checkout/sessions", {
        body: {
          mode: "subscription",
          customer: customerId,
          payment_method_types: ["card", "us_bank_account"],
          line_items,
          subscription_data: { metadata: { clientId } },
          metadata: { clientId },
          client_reference_id: clientId,
          success_url: `${origin}/?billing=success`,
          cancel_url: `${origin}/?billing=cancel`,
        },
      });

      return json({ ok: true, url: session.url, customerId });
    }

    // ── Sync billing state straight from Stripe (no webhook needed) ───────────
    if (action === "sync") {
      const customerId = body.customerId;
      if (!customerId) return json({ ok: false, error: "Missing customerId" }, 400);
      let subs;
      try {
        subs = await stripe(`subscriptions?customer=${encodeURIComponent(customerId)}&limit=1&status=all`, {
          method: "GET",
        });
      } catch (e) {
        // Customer doesn't exist in this mode (e.g. a leftover test-mode id after
        // going live, or a deleted customer). Reset the card cleanly instead of
        // surfacing a scary error; the UI clears the stale ids on customerMissing.
        const missing = (e.detail && e.detail.code === "resource_missing") || /no such customer/i.test(e.message || "");
        if (missing) return json({ ok: true, billingStatus: "none", customerMissing: true });
        throw e;
      }
      const sub = (subs.data && subs.data[0]) || null;
      if (!sub) return json({ ok: true, billingStatus: "none" });

      // Pull the latest paid invoice timestamp, best-effort.
      let lastPaymentAt = null;
      try {
        const inv = await stripe(
          `invoices?customer=${encodeURIComponent(customerId)}&status=paid&limit=1`,
          { method: "GET" }
        );
        const paid = inv.data && inv.data[0];
        if (paid && paid.status_transitions && paid.status_transitions.paid_at) {
          lastPaymentAt = new Date(paid.status_transitions.paid_at * 1000).toISOString();
        }
      } catch { /* non-fatal */ }

      const item = sub.items && sub.items.data && sub.items.data[0];
      const monthly = item && item.price && item.price.unit_amount ? item.price.unit_amount / 100 : null;
      return json({
        ok: true,
        billingStatus: billingStatusFromSub(sub),
        subscriptionId: sub.id,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        lastPaymentAt,
        monthly,
      });
    }

    // ── Update the live subscription's monthly amount (term-priced renewal) ───
    // Called when a client renews at a new term rate. Rewrites the subscription's
    // recurring line item to the new monthly management fee. proration_behavior
    // "none" = the new rate applies from the next invoice, no mid-cycle proration
    // surprise. Charges the management fee ONLY — never ad spend.
    if (action === "update-subscription") {
      const monthly = Number(body.monthlyAmount);
      const packageName = body.packageName;
      if (!(monthly > 0)) return json({ ok: false, error: "Monthly fee must be greater than zero." }, 400);

      // Resolve the subscription: prefer a passed id, else the customer's latest.
      let sub = null;
      if (body.subscriptionId) {
        try {
          sub = await stripe(`subscriptions/${encodeURIComponent(body.subscriptionId)}`, { method: "GET" });
        } catch { sub = null; }
      }
      if (!sub) {
        if (!body.customerId) return json({ ok: false, error: "No billing set up for this client yet." }, 400);
        const subs = await stripe(
          `subscriptions?customer=${encodeURIComponent(body.customerId)}&limit=1&status=all`,
          { method: "GET" }
        );
        sub = (subs.data && subs.data[0]) || null;
      }
      if (!sub) return json({ ok: false, error: "No active subscription to update." }, 400);
      if (["canceled", "incomplete_expired"].includes(sub.status))
        return json({ ok: false, error: "This subscription is canceled — set up billing again instead." }, 400);

      const item = sub.items && sub.items.data && sub.items.data[0];
      if (!item) return json({ ok: false, error: "Subscription has no line item to update." }, 400);

      // Subscription updates don't accept inline product_data (that's Checkout-only) —
      // price_data here must reference an existing product id. Reuse the product
      // already on the line item, BUT products auto-created by Checkout's inline
      // price_data can be archived (inactive) and Stripe refuses new prices on them
      // ("The product ... is marked as inactive"). So verify it: reactivate if
      // inactive, and fall back to creating a fresh product if that's not possible.
      let productId =
        item.price && (typeof item.price.product === "string" ? item.price.product : item.price.product && item.price.product.id);
      if (productId) {
        try {
          const prod = await stripe(`products/${encodeURIComponent(productId)}`, { method: "GET" });
          if (prod.deleted) {
            productId = "";
          } else if (prod.active === false) {
            try {
              await stripe(`products/${encodeURIComponent(productId)}`, { body: { active: true } });
            } catch {
              productId = ""; // can't reactivate -> create a fresh product below
            }
          }
        } catch {
          productId = ""; // not retrievable in this mode -> create fresh
        }
      }
      if (!productId) {
        const prod = await stripe("products", {
          body: { name: `BoldLine Media — ${packageName || "Management"} (monthly minimum)` },
        });
        productId = prod.id;
      }

      // Update the existing item in place (pass its id) to a new price on the same product.
      await stripe(`subscriptions/${encodeURIComponent(sub.id)}`, {
        body: {
          items: [
            {
              id: item.id,
              price_data: {
                currency: "usd",
                product: productId,
                unit_amount: dollars(monthly),
                recurring: { interval: "month" },
              },
            },
          ],
          proration_behavior: "none",
        },
      });

      return json({ ok: true, subscriptionId: sub.id, monthly });
    }

    // ── Bill the early-termination amounts and wind down the subscription ─────
    // Agreement terms: ETF = one month's monthly minimum, plus the term-discount
    // clawback. Creates invoice items, collects them on a standalone auto-charge
    // invoice against the client's saved payment method, and sets the
    // subscription to cancel at period end (the 30-day notice period).
    if (action === "charge-etf") {
      const { customerId, subscriptionId, clientName } = body;
      const etfFee = Number(body.etfFee) || 0;
      const clawback = Number(body.clawback) || 0;
      if (!customerId) return json({ ok: false, error: "No billing set up for this client." }, 400);
      if (!(etfFee + clawback > 0)) return json({ ok: false, error: "Nothing to bill." }, 400);

      if (etfFee > 0) {
        await stripe("invoiceitems", {
          body: { customer: customerId, amount: dollars(etfFee), currency: "usd",
            description: `Early termination fee — one month's minimum (Agreement, Termination section)` },
        });
      }
      if (clawback > 0) {
        await stripe("invoiceitems", {
          body: { customer: customerId, amount: dollars(clawback), currency: "usd",
            description: `Term-discount clawback — months billed at discounted rate recalculated at the Standard Rate (Agreement, Termination section)` },
        });
      }
      // Resolve a payment method for the standalone invoice. GOTCHA (2026-07-16
      // test): Checkout attaches the card to the SUBSCRIPTION, not as the
      // customer's default — a standalone invoice finds nothing and sits in
      // "Retrying". Order: subscription's card -> customer default -> first card.
      let pm = null;
      if (subscriptionId) {
        try {
          const sub = await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
          pm = sub.default_payment_method || null;
        } catch { /* fall through */ }
      }
      if (!pm) {
        try {
          const cust = await stripe(`customers/${encodeURIComponent(customerId)}`, { method: "GET" });
          pm = (cust.invoice_settings && cust.invoice_settings.default_payment_method) || null;
        } catch { /* fall through */ }
      }
      if (!pm) {
        try {
          const pms = await stripe(`payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=1`, { method: "GET" });
          pm = (pms.data && pms.data[0] && pms.data[0].id) || null;
        } catch { /* fall through */ }
      }

      // Standalone invoice that sweeps in the pending invoice items just created.
      // GOTCHA: on current Stripe API versions pending_invoice_items_behavior
      // defaults to "exclude" — without it the invoice is created EMPTY ($0),
      // auto-"pays" trivially, and the items silently ride the next monthly
      // invoice instead (caught in the 2026-07-16 test run).
      const inv = await stripe("invoices", {
        body: { customer: customerId, collection_method: "charge_automatically", auto_advance: true,
          pending_invoice_items_behavior: "include",
          ...(pm ? { default_payment_method: pm } : {}),
          description: `BoldLine Media — early termination charges${clientName ? " for " + clientName : ""}` },
      });
      if (!inv.amount_due || inv.amount_due <= 0) {
        // Defensive: never report success off an empty invoice again.
        return json({ ok: false, error: "ETF invoice came out empty — the pending items were not attached. Check the customer's pending invoice items in Stripe." }, 502);
      }
      // Try to charge it now; if the payment method declines, Stripe keeps retrying (dunning).
      let paid = false, hostedUrl = inv.hosted_invoice_url || null;
      try {
        const done = await stripe(`invoices/${encodeURIComponent(inv.id)}/pay`);
        paid = done.status === "paid";
        hostedUrl = done.hosted_invoice_url || hostedUrl;
      } catch { /* left open — auto_advance keeps collecting */ }

      // Wind down the recurring subscription at the end of the current period.
      if (subscriptionId) {
        try {
          await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
            body: { cancel_at_period_end: true },
          });
        } catch { /* subscription may already be gone — non-fatal */ }
      }
      return json({ ok: true, invoiceId: inv.id, invoiceUrl: hostedUrl, paid });
    }

    // ── Bill the per-qualified-lead fees on the NEXT monthly invoice ───────────
    // Every qualified lead we deliver is billable at the client's per-lead rate.
    // The owner reviews + one-tap approves a batch in the OS; this drops ONE
    // pending invoice item on the customer. Unlike the ETF (a standalone
    // auto-charge invoice), this rides the client's next recurring subscription
    // invoice — Stripe automatically sweeps pending invoice items onto the next
    // subscription invoice, same mechanism the late-interest watcher uses. So the
    // client sees "N qualified leads — $X" as a line on their normal monthly bill,
    // charged to the card/bank already on the subscription. Never touches ad spend.
    if (action === "charge-leads") {
      const { customerId, clientName } = body;
      const count = Math.max(0, Math.floor(Number(body.count) || 0));
      const amount = Number(body.amount) || 0;
      if (!customerId) return json({ ok: false, error: "No billing set up for this client — start the subscription first." }, 400);
      if (count <= 0) return json({ ok: false, error: "No billable leads to charge." }, 400);
      if (!(amount > 0)) return json({ ok: false, error: "Nothing to charge — the month's lead value has not passed the monthly minimum yet." }, 400);

      const item = await stripe("invoiceitems", {
        body: {
          customer: customerId,
          amount: dollars(amount),
          currency: "usd",
          // Under the 2026-08-18 model `amount` is the part of the month's lead value
          // that EXCEEDS the monthly minimum already billed, not the full lead value, so
          // the description has to say so or the client's own arithmetic will not check out.
          description: `Performance fee above monthly minimum — ${count} qualified lead${count === 1 ? "" : "s"} delivered${clientName ? " for " + clientName : ""} (rides next monthly invoice)`,
        },
      });
      return json({ ok: true, itemId: item.id, count, amount });
    }

    // ── Preview the client's NEXT monthly invoice (one bundled bill) ───────────
    // Returns the upcoming subscription invoice exactly as Stripe will render it:
    // the recurring monthly minimum + every pending invoice item (performance fees
    // above the minimum, any late interest) on ONE invoice, plus the date it
    // auto-charges. This
    // is what proves "everything lands on the same monthly invoice" in the UI.
    if (action === "preview-invoice") {
      const { customerId } = body;
      if (!customerId) return json({ ok: false, error: "No billing set up for this client yet." }, 400);
      let up = null;
      // `invoices/upcoming` is the long-standing endpoint; if this account is on a
      // newer API version that moved it, fail soft (UI just hides the preview).
      try {
        up = await stripe(`invoices/upcoming?customer=${encodeURIComponent(customerId)}`, { method: "GET" });
      } catch (e) {
        const none = (e.detail && (e.detail.code === "invoice_upcoming_none")) || /no upcoming invoices/i.test(e.message || "");
        if (none) return json({ ok: true, upcoming: null });
        return json({ ok: true, upcoming: null, note: e.message || "preview unavailable" });
      }
      if (!up) return json({ ok: true, upcoming: null });
      const lines = ((up.lines && up.lines.data) || []).map((l) => ({
        description: l.description || (l.price && (l.price.nickname)) || (l.plan && l.plan.nickname) || "Charge",
        amount: (l.amount || 0) / 100,
      }));
      const chargeTs = up.next_payment_attempt || up.period_end || null;
      return json({
        ok: true,
        upcoming: {
          total: (up.total != null ? up.total : up.amount_due || 0) / 100,
          subtotal: (up.subtotal || 0) / 100,
          chargeDate: chargeTs ? new Date(chargeTs * 1000).toISOString() : null,
          lines,
        },
      });
    }

    // ── Get a real Stripe hosted-invoice URL for the branded invoice email ────
    // Stripe's hosted invoice page is a genuine pay page (card/bank + a scan-to-pay
    // QR code). Prefer an OPEN (unpaid, payable) invoice; otherwise the most recent
    // invoice that has a hosted URL (so "view your latest bill" still works). The
    // caller falls back to the Checkout link / portal when there's no URL yet.
    if (action === "invoice-link") {
      const { customerId } = body;
      if (!customerId) return json({ ok: true, url: null });
      let invs;
      try {
        invs = await stripe(`invoices?customer=${encodeURIComponent(customerId)}&limit=5`, { method: "GET" });
      } catch (e) {
        return json({ ok: true, url: null, note: e.message || "no invoices" });
      }
      const data = (invs && invs.data) || [];
      const open = data.find((i) => i.status === "open" && i.hosted_invoice_url);
      const any = open || data.find((i) => i.hosted_invoice_url);
      return json({ ok: true, url: any ? any.hosted_invoice_url : null, status: any ? any.status : null });
    }

    // ── Actual revenue by month, from invoices ────────────────────────────────
    // Bryson, 2026-08-18: "track how much I am making per month or maybe the previous
    // month based on the invoices sent since we now dont have a monthly recurring
    // revenue." Under the greater-of model the package price is a FLOOR, not income:
    // a good month bills more than it and no month bills less. Summing package prices
    // (what the old Revenue screen did) is therefore a guess, and a low one.
    //
    // Stripe is the only place the real number exists, so it is read from there rather
    // than reconstructed from the OS's own records, which would drift the first time an
    // invoice was voided, refunded, or paid late.
    //
    // Months are keyed on the invoice's own period, not "now minus N", so a late payment
    // lands in the month it was FOR. Refunds and credit notes are subtracted, because
    // money that went back out was never earned.
    if (action === "revenue") {
      const months = Math.min(24, Math.max(1, Math.floor(Number(body.months) || 6)));
      // Reach back one extra month so a period that started before the window still has
      // its invoice picked up.
      const since = Math.floor(Date.now() / 1000) - (months + 1) * 31 * 86400;

      const invoices = [];
      let startingAfter = null;
      // Stripe pages at 100. Six months of a handful of clients is one page, but paging
      // is cheap insurance against the year this is still running with forty clients.
      for (let page = 0; page < 12; page++) {
        const q = new URLSearchParams({ limit: "100", "created[gte]": String(since) });
        if (startingAfter) q.set("starting_after", startingAfter);
        const res = await stripe(`invoices?${q.toString()}`, { method: "GET" });
        const data = (res && res.data) || [];
        invoices.push(...data);
        if (!res || !res.has_more || !data.length) break;
        startingAfter = data[data.length - 1].id;
      }

      // Draft invoices are not money and may never be finalized. Void ones were
      // cancelled. Uncollectible was written off. None of those are revenue.
      const COUNTED = new Set(["paid", "open"]);
      const byMonth = new Map();
      for (const inv of invoices) {
        if (!COUNTED.has(inv.status)) continue;
        // Prefer the period the invoice COVERS; fall back to when it was finalized.
        const ts = inv.period_end || inv.status_transitions?.finalized_at || inv.created;
        const key = new Date(ts * 1000).toISOString().slice(0, 7);
        const paidCents = Number(inv.amount_paid || 0);
        const dueCents = Number(inv.amount_due || 0);
        const refundCents = Number(inv.post_payment_credit_notes_amount || 0)
          + Number(inv.pre_payment_credit_notes_amount || 0);
        const row = byMonth.get(key) || { month: key, collected: 0, outstanding: 0, refunded: 0, invoices: 0, clients: new Map() };
        row.invoices += 1;
        row.collected += paidCents;
        row.refunded += refundCents;
        if (inv.status === "open") row.outstanding += dueCents;
        const who = inv.customer_name || inv.customer_email || inv.customer || "Unknown";
        const c = row.clients.get(who) || { name: who, customerId: inv.customer || null, collected: 0, outstanding: 0 };
        c.collected += paidCents;
        if (inv.status === "open") c.outstanding += dueCents;
        row.clients.set(who, c);
        byMonth.set(key, row);
      }

      const cents = (n) => Math.round(Number(n) || 0) / 100;
      const nowKey = new Date().toISOString().slice(0, 7);
      const wanted = [];
      for (let i = 0; i < months; i++) {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - i);
        wanted.push(d.toISOString().slice(0, 7));
      }
      const out = wanted.map((key) => {
        const r = byMonth.get(key);
        if (!r) return { month: key, collected: 0, outstanding: 0, refunded: 0, net: 0, invoices: 0, clients: [], isCurrent: key === nowKey };
        return {
          month: key,
          collected: cents(r.collected),
          outstanding: cents(r.outstanding),
          refunded: cents(r.refunded),
          net: cents(r.collected - r.refunded),
          invoices: r.invoices,
          isCurrent: key === nowKey,
          clients: [...r.clients.values()]
            .map((c) => ({ ...c, collected: cents(c.collected), outstanding: cents(c.outstanding) }))
            .sort((a, b) => (b.collected + b.outstanding) - (a.collected + a.outstanding)),
        };
      });

      return json({ ok: true, months: out, generatedAt: new Date().toISOString() });
    }

    // ── Billing Portal session (update card/bank, view invoices) ──────────────
    if (action === "portal") {
      const customerId = body.customerId;
      const origin = (body.origin || "").replace(/\/$/, "");
      if (!customerId) return json({ ok: false, error: "No billing set up for this client yet." }, 400);
      if (!origin) return json({ ok: false, error: "Missing origin" }, 400);
      const portal = await stripe("billing_portal/sessions", {
        body: { customer: customerId, return_url: `${origin}/` },
      });
      return json({ ok: true, url: portal.url });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message || "Stripe request failed" }, 502);
  }
};
