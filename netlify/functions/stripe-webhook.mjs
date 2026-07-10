// Stripe webhook — keeps each client's billingStatus in sync with reality.
//
// Stripe calls this endpoint on payment events (paid, failed, canceled, etc.).
// It is PUBLIC (no owner session) but every request is verified against the
// endpoint's signing secret, so only genuine Stripe calls are honored. It then
// writes the new billing state onto the matching client's `data` blob via the
// Supabase service role.
//
// The client is located by `clientId`, which we stamp into metadata on the
// Customer, the Checkout Session, and the Subscription in stripe-billing.mjs.
//
// Configure in Stripe (one time): Developers -> Webhooks -> Add endpoint ->
//   URL:  https://<os-site>/.netlify/functions/stripe-webhook
//   Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//           customer.subscription.updated, customer.subscription.deleted
// Then copy the endpoint's "Signing secret" (whsec_...) into the Netlify env
// var STRIPE_WEBHOOK_SECRET.
//
// Required Netlify env vars: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Verify Stripe's `Stripe-Signature: t=...,v1=...` header against the raw body.
// Mirrors Stripe's documented scheme (HMAC-SHA256 over `${t}.${rawBody}`) so we
// don't need the SDK. Rejects on mismatch or a timestamp older than 5 minutes.
function verifySignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    String(sigHeader || "").split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw new Error("malformed signature header");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("signature mismatch");
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) throw new Error("timestamp outside tolerance");
}

// Pull the clientId we stamped into metadata, from whichever object carries it.
function clientIdFrom(obj) {
  if (!obj) return null;
  if (obj.metadata && obj.metadata.clientId) return obj.metadata.clientId;
  if (obj.subscription_details && obj.subscription_details.metadata && obj.subscription_details.metadata.clientId)
    return obj.subscription_details.metadata.clientId;
  if (obj.client_reference_id) return obj.client_reference_id;
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!WHSEC) return json({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const raw = await req.text(); // raw body is required for signature verification
  try {
    verifySignature(raw, req.headers.get("stripe-signature"), WHSEC);
  } catch (e) {
    return json({ ok: false, error: `Signature check failed: ${e.message}` }, 400);
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const obj = event.data && event.data.object;
  const clientId = clientIdFrom(obj);

  // Build the patch for this event.
  let patch = null;
  switch (event.type) {
    case "checkout.session.completed":
      // The client just authorized payment; the subscription now exists.
      patch = {
        billingStatus: "active",
        stripeCustomerId: obj.customer || undefined,
        stripeSubscriptionId: obj.subscription || undefined,
        billingCheckoutUrl: null, // link is spent
      };
      break;
    case "invoice.paid":
      patch = {
        billingStatus: "active",
        lastPaymentAt: new Date().toISOString(),
        lastInvoiceAmount: typeof obj.amount_paid === "number" ? obj.amount_paid / 100 : undefined,
        stripeCustomerId: obj.customer || undefined,
        stripeSubscriptionId: obj.subscription || undefined,
      };
      break;
    case "invoice.payment_failed":
      patch = { billingStatus: "past_due" };
      break;
    case "customer.subscription.updated": {
      const map = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "canceled", incomplete_expired: "canceled" };
      patch = { billingStatus: map[obj.status] || undefined, stripeSubscriptionId: obj.id };
      break;
    }
    case "customer.subscription.deleted":
      patch = { billingStatus: "canceled" };
      break;
    default:
      // Event we don't act on — acknowledge so Stripe stops retrying.
      return json({ ok: true, ignored: event.type });
  }

  if (!clientId) {
    // Nothing to attach it to (e.g. a payment not created by our flow). Ack anyway.
    return json({ ok: true, note: "no clientId in metadata" });
  }
  // Drop undefined keys so we never overwrite good data with blanks.
  patch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: row, error: readErr } = await supabase.from("clients").select("data").eq("id", clientId).single();
    if (readErr || !row) return json({ ok: true, note: "client not found", clientId });
    const next = { ...row.data, ...patch };
    await supabase.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", clientId);
    return json({ ok: true, applied: event.type, clientId });
  } catch (e) {
    // Return 500 so Stripe retries later (transient DB error).
    return json({ ok: false, error: e.message }, 500);
  }
};
