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
            product_data: { name: `BoldLine Media — ${packageName || "Management"} (monthly management fee)` },
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
