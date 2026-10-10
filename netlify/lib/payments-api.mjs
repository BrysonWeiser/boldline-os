// Talking to Stripe and Square for a business's own payments (KB `payments-connect`). Every call that moves
// money is made ON the business's own account: Stripe with BoldLine's key plus the connected account's id in the
// Stripe-Account header (a "direct charge", so the business is the seller), Square with the business's own key.
import { encodeForm } from "./stripe-shared.mjs";
import { seal, unseal, squareHost, SECRET_BUCKET, squareKeyPath, payOf, payEntry, trimLog } from "./payments.mjs";

const SQUARE_VERSION = "2025-01-23";

class PayError extends Error {}
const fail = (msg, detail) => { const e = new PayError(msg); e.detail = detail; return e; };

// ── Stripe ────────────────────────────────────────────────────────────────────────────────────
async function stripeCall(path, { method = "POST", body, account, env = process.env, fetchFn = fetch } = {}) {
  const r = await fetchFn(`https://api.stripe.com/v1/${path}`, { method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded", ...(account ? { "stripe-account": account } : {}) },
    body: body ? encodeForm(body).toString() : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail((d.error && d.error.message) || `Stripe ${r.status}`, d.error);
  return d;
}
export async function stripeConnect(code, { env = process.env, fetchFn = fetch } = {}) {
  const r = await fetchFn("https://connect.stripe.com/oauth/token", { method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: String(code || "") }).toString() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.stripe_user_id) throw fail(d.error_description || "Stripe did not finish connecting.", d);
  let name = "";
  try { const a = await stripeCall(`accounts/${encodeURIComponent(d.stripe_user_id)}`, { method: "GET", env, fetchFn });
    name = (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || a.email || ""; } catch (e) {}
  return { account: d.stripe_user_id, name: String(name).slice(0, 80), live: !!d.livemode };
}
export async function stripeDisconnect(account, { env = process.env, fetchFn = fetch } = {}) {
  const r = await fetchFn("https://connect.stripe.com/oauth/deauthorize", { method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.STRIPE_CONNECT_CLIENT_ID || "", stripe_user_id: account }).toString() });
  // Already disconnected from their side is fine: the goal is that it is not connected.
  if (!r.ok) { const d = await r.json().catch(() => ({})); if (!/not connected|no such|invalid/i.test(JSON.stringify(d))) throw fail("Stripe did not confirm the disconnect.", d); }
}
// One checkout page for one booking, on the business's own Stripe account. It expires after a day; the pay
// link makes a new one whenever it is opened, so an old email never leads to a dead page.
export async function stripeCheckout(account, { cents, name, description, email, successUrl, cancelUrl, ref }, opts = {}) {
  const s = await stripeCall("checkout/sessions", { ...opts, account, body: {
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: String(name).slice(0, 120), ...(description ? { description: String(description).slice(0, 300) } : {}) } } }],
    success_url: successUrl, cancel_url: cancelUrl,
    ...(email ? { customer_email: email } : {}),
    client_reference_id: ref, metadata: { booking: ref }, payment_intent_data: { metadata: { booking: ref }, description: String(name).slice(0, 200) },
  } });
  return { id: s.id, url: s.url };
}
export async function stripePaid(account, sessionId, opts = {}) {
  const s = await stripeCall(`checkout/sessions/${encodeURIComponent(sessionId)}`, { ...opts, method: "GET", account });
  return s.payment_status === "paid" || s.payment_status === "no_payment_required";
}

// ── Square ────────────────────────────────────────────────────────────────────────────────────
async function squareCall(path, { method = "GET", body, token, env = process.env, fetchFn = fetch } = {}) {
  const r = await fetchFn(`${squareHost(env)}${path}`, { method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "square-version": SQUARE_VERSION },
    body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(((d.errors || [])[0] || {}).detail || `Square ${r.status}`, d);
  return d;
}
async function squareToken(body, { env = process.env, fetchFn = fetch } = {}) {
  const r = await fetchFn(`${squareHost(env)}/oauth2/token`, { method: "POST", headers: { "content-type": "application/json", "square-version": SQUARE_VERSION },
    body: JSON.stringify({ client_id: env.SQUARE_APP_ID, client_secret: env.SQUARE_APP_SECRET, ...body }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw fail(d.message || ((d.errors || [])[0] || {}).detail || "Square did not finish connecting.", d);
  return { access: d.access_token, refresh: d.refresh_token || body.refresh_token || "", expires: d.expires_at || "", merchant: d.merchant_id || "" };
}
export async function squareConnect(code, redirectUri, opts = {}) {
  const t = await squareToken({ grant_type: "authorization_code", code: String(code || ""), redirect_uri: redirectUri }, opts);
  let name = "", location = "";
  try { const m = await squareCall("/v2/merchants/me", { ...opts, token: t.access }); name = (m.merchant && m.merchant.business_name) || ""; } catch (e) {}
  try { location = await squareLocation(t.access, opts); } catch (e) {}
  return { tokens: { ...t, location }, account: t.merchant, name: String(name).slice(0, 80), live: !/sandbox/.test(squareHost(opts.env)) };
}
// The location that takes card payments (the main one first).
export async function squareLocation(token, opts = {}) {
  const d = await squareCall("/v2/locations", { ...opts, token });
  const ok = (d.locations || []).filter((l) => l.status === "ACTIVE" && (l.capabilities || []).includes("CREDIT_CARD_PROCESSING"));
  return ((ok.find((l) => l.type === "PHYSICAL") || ok[0]) || {}).id || "";
}
export async function squareDisconnect(tokens, { env = process.env, fetchFn = fetch } = {}) {
  if (!tokens || !tokens.access) return;
  await fetchFn(`${squareHost(env)}/oauth2/revoke`, { method: "POST", headers: { authorization: `Client ${env.SQUARE_APP_SECRET}`, "content-type": "application/json", "square-version": SQUARE_VERSION },
    body: JSON.stringify({ client_id: env.SQUARE_APP_ID, access_token: tokens.access }) }).catch(() => {});
}
// A payment link on the business's own Square. Square links do not expire, so one is made per booking and reused.
export async function squareLink(tokens, { cents, name, email, redirectUrl, ref }, opts = {}) {
  const location = tokens.location || (await squareLocation(tokens.access, opts));
  if (!location) throw fail("This Square account has no location that takes card payments.");
  const d = await squareCall("/v2/online-checkout/payment-links", { ...opts, method: "POST", token: tokens.access, body: {
    idempotency_key: `bk-${ref}`.slice(0, 45),
    quick_pay: { name: String(name).slice(0, 255), price_money: { amount: cents, currency: "USD" }, location_id: location },
    checkout_options: { redirect_url: redirectUrl },
    ...(email ? { pre_populated_data: { buyer_email: email } } : {}),
    payment_note: String(name).slice(0, 500),
  } });
  return { url: d.payment_link.url, orderId: d.payment_link.order_id };
}
export async function squarePaid(tokens, orderId, opts = {}) {
  const d = await squareCall(`/v2/orders/${encodeURIComponent(orderId)}`, { ...opts, token: tokens.access });
  const o = d.order || {};
  const due = o.net_amount_due_money ? Number(o.net_amount_due_money.amount) : null;
  return o.state === "COMPLETED" || ((o.tenders || []).length > 0 && due === 0);
}

// Square's keys in private storage, encrypted; refreshed when they have less than a week left.
export async function loadSquare(db, clientId, env = process.env) {
  const { data, error } = await db.storage.from(SECRET_BUCKET).download(squareKeyPath(clientId));
  if (error || !data) return null;
  return unseal(await data.text(), env);
}
export async function saveSquare(db, clientId, tokens, env = process.env) {
  const { error } = await db.storage.from(SECRET_BUCKET).upload(squareKeyPath(clientId), new Blob([seal(tokens, env)], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
  if (error) throw fail("Could not store the Square connection.", error);
}
export const dropSquare = (db, clientId) => db.storage.from(SECRET_BUCKET).remove([squareKeyPath(clientId)]).catch(() => {});
export async function freshSquare(db, clientId, opts = {}) {
  const env = opts.env || process.env;
  const t = await loadSquare(db, clientId, env); if (!t) return null;
  const left = Date.parse(t.expires || "") - Date.now();
  if (t.refresh && (!(left > 0) || left < 7 * 864e5)) {
    const n = await squareToken({ grant_type: "refresh_token", refresh_token: t.refresh }, opts);
    const next = { ...t, ...n, location: t.location };
    await saveSquare(db, clientId, next, env); return next;
  }
  return t;
}
// ── The payment log ───────────────────────────────────────────────────────────────────────────
// Write only this booking's entry in the payment log, against the record as it is right now.
export async function logPayEntry(db, id, bookingId, entry) {
  const { data: row } = await db.from("clients").select("data").eq("id", id).maybeSingle();
  if (!row || !row.data) return;
  const log = { ...(row.data.payLog || {}) };
  log[bookingId] = { ...(log[bookingId] || {}), ...entry };
  await db.from("clients").update({ data: { ...row.data, payLog: trimLog(log) }, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function checkPaid(db, cl, id, bookingId) {
  const e = payEntry(cl, bookingId); if (!e || !e.ref || e.status === "paid") return !!(e && e.status === "paid");
  const P = payOf(cl);
  let paid = false;
  if (e.provider === "stripe" && P.conn && P.conn.provider === "stripe") paid = await stripePaid(P.conn.account, e.ref);
  else if (e.provider === "square" && P.conn && P.conn.provider === "square") { const t = await freshSquare(db, id); paid = !!t && await squarePaid(t, e.ref); }
  if (paid) await logPayEntry(db, id, bookingId, { status: "paid", paidAt: new Date().toISOString() });
  return paid;
}

export { PayError };

