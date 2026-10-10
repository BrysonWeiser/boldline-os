// How a business gets paid by ITS OWN customers through the website we built (Bryson, 2026-10-09: "is there a
// way we can just put in the client portal (or my own businesses portal) to be able to connect whatever method
// the client (or my businesses use) to collect payment"). KB `payments-connect`.
//
// One choice per business, `cl.payments` (the business or Bryson edits it):
//   method   stripe | square | link | inperson
//   link     an https payment page from the business's own account (PayPal, Venmo, Jobber, Square, anything)
//   charge   deposit | full   what a connected Stripe or Square charges when a customer books
// and one connection the server alone writes, `cl.payConnect` (SERVER_OWNED in the OS):
//   { provider, account, name, connectedAt, live }
// plus `cl.payLog` (server-owned too): one entry per booking that was sent to a checkout, keyed by booking id:
//   { provider, ref, cents, status: open | paid, url, createdAt, paidAt }
// Paid status lives there, never inside `bookings`, because the OS saves `bookings` whole and a screen opened
// before the customer paid would otherwise write "not paid" back over it.
//
// 🔴 BOLDLINE NEVER HOLDS THE MONEY (CLAUDE.md hard constraint). Stripe: the business's own Stripe account is
// connected (Standard, through Stripe's own approval screen) and every charge is made ON that account, so Stripe
// pays the business directly and the business carries its own refunds, chargebacks and fees. Square: the same,
// through Square's approval screen. BoldLine takes no cut and is never the seller.
import { createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

export const PAY_METHODS = ["stripe", "square", "link", "inperson"];
export const PAY_NAMES = { stripe: "Stripe", square: "Square", link: "Payment link", inperson: "In person" };
export const CONNECTABLE = ["stripe", "square"];

const httpsUrl = (u) => { const t = String(u || "").trim(); if (!/^https:\/\/[^\s"'<>]+$/i.test(t)) return ""; try { return new URL(t).href; } catch (e) { return ""; } };
const low = (s) => String(s || "").trim().toLowerCase();

// The business's choice, cleaned. A connection counts when it matches the method picked, or when no method has
// been picked yet (connecting IS picking).
export function payOf(cl) {
  const p = (cl && cl.payments) || {};
  const method = PAY_METHODS.includes(p.method) ? p.method : "";
  const c = (cl && cl.payConnect) || null;
  const conn = c && CONNECTABLE.includes(c.provider) && c.account ? c : null;
  const connected = conn && (method === conn.provider || !method) ? conn.provider : "";
  return { method: method || connected, link: httpsUrl(p.link), charge: p.charge === "full" ? "full" : "deposit", connected, conn };
}

// "$50", "50", "$49.99", "$1,200" are amounts. "From $150", "$150+", "$100 to $200" are not: a price a customer
// cannot be charged exactly is never charged.
export function cents(v) {
  const t = String(v == null ? "" : v).replace(/[,\s]/g, "");
  const m = t.match(/^\$?(\d{1,6})(?:\.(\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0")) : 0;
}
export const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

// What a customer pays online the moment they book this package, or null when nothing is charged online.
// Stripe will not take less than 50 cents.
export function chargeFor(cl, pkg) {
  const P = payOf(cl); if (!P.connected || !pkg) return null;
  const full = cents(pkg.price), dep = cents(pkg.deposit);
  if (P.charge === "full" && full >= 50) return { cents: full, kind: "full", label: money(full) };
  if (dep >= 50) return { cents: dep, kind: "deposit", label: money(dep) };
  return null;
}

// How the package card on the booking page describes paying.
export function payNoteFor(cl, pkg) {
  const ch = chargeFor(cl, pkg);
  if (ch) return ch.kind === "full" ? "Paid when you book" : `${ch.label} deposit`;
  return pkg && pkg.depositLink && pkg.deposit ? `${pkg.deposit} deposit` : "";
}

// ── Paid or not ───────────────────────────────────────────────────────────────────────────────
export const payEntry = (cl, bookingId) => (((cl && cl.payLog) || {})[bookingId]) || null;
export const depositPaid = (cl, b) => !!(b && b.deposit && (b.deposit.paid || (payEntry(cl, b.id) || {}).status === "paid"));
// The record with every booking's deposit marked paid when the payment came in online, for the screens and
// emails that read `deposit.paid`.
export function withPayStatus(cl) {
  if (!cl || !cl.payLog || !Array.isArray(cl.bookings)) return cl;
  return { ...cl, bookings: cl.bookings.map((b) => {
    const e = b && b.deposit && !b.deposit.paid ? payEntry(cl, b.id) : null;
    return e && e.status === "paid" ? { ...b, deposit: { ...b.deposit, paid: true, paidAt: e.paidAt || "", online: e.provider } } : b;
  }) };
}
// Keep the log small: the newest 300 entries.
export function trimLog(log) {
  const e = Object.entries(log || {}).sort((a, b) => String(b[1].createdAt || "").localeCompare(String(a[1].createdAt || "")));
  return Object.fromEntries(e.slice(0, 300));
}

// ── Signed links ──────────────────────────────────────────────────────────────────────────────
export const payKey = (env = process.env) => env.PAY_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
const sig = (key, s) => createHmac("sha256", String(key || "")).update(s).digest("hex").slice(0, 32);
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && timingSafeEqual(x, y); };
export const paySig = (key, clientId, bookingId) => sig(key, `pay|${clientId}|${bookingId}`);
export const payCheck = (key, clientId, bookingId, s) => !!key && same(paySig(key, clientId, bookingId), s);

// Where the customer's pay link lives: on the business's own domain once its website is live there (the
// websites site passes /pay through, like /book), so the link a customer sees is the business's, not ours.
export function payBase(cl, osBase) {
  const d = ((cl && cl.websiteDeal) || {}).domain || {};
  return d.live && d.host ? `https://${d.host}` : String(osBase || "").replace(/\/$/, "");
}
export const payUrl = (cl, bookingId, osBase, key) =>
  `${payBase(cl, osBase)}/pay?c=${encodeURIComponent(cl.id)}&b=${encodeURIComponent(bookingId)}&s=${paySig(key, cl.id, bookingId)}`;

// The OAuth "state": which business, which provider, where to send him back, and when it stops working.
export function makeState(key, { clientId, provider, from }, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ c: clientId, p: provider, f: from === "portal" ? "portal" : "os", t: now + 30 * 60000, n: randomBytes(6).toString("hex") })).toString("base64url");
  return `${body}.${sig(key, `state|${body}`)}`;
}
export function readState(key, state, now = Date.now()) {
  const [body, s] = String(state || "").split(".");
  if (!body || !key || !same(sig(key, `state|${body}`), s)) return null;
  try { const o = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return o && o.t > now && CONNECTABLE.includes(o.p) && o.c ? { clientId: String(o.c), provider: o.p, from: o.f } : null; } catch (e) { return null; }
}

// ── Square's keys, locked ─────────────────────────────────────────────────────────────────────
// Stripe needs nothing stored: BoldLine's own Stripe key acts on the connected account by its id. Square hands
// over a key per business, which is kept out of the client record (the OS screen reads that record) in private
// storage, encrypted.
const kdf = (env = process.env) => createHash("sha256").update(`square-tokens|${env.SQUARE_APP_SECRET || ""}|${env.SUPABASE_SERVICE_ROLE_KEY || ""}`).digest();
export function seal(obj, env = process.env) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", kdf(env), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
export function unseal(text, env = process.env) {
  try { const raw = Buffer.from(String(text || ""), "base64"); const d = createDecipheriv("aes-256-gcm", kdf(env), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")); } catch (e) { return null; }
}
export const SECRET_BUCKET = "client-contracts";      // private; the same bucket the signed contracts live in
export const squareKeyPath = (clientId) => `payments/${clientId}/square.json`;

// ── Who is set up ─────────────────────────────────────────────────────────────────────────────
export const squareHost = (env = process.env) => (low(env.SQUARE_ENV) === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");
export const providersReady = (env = process.env) => ({
  stripe: !!(env.STRIPE_CONNECT_CLIENT_ID && env.STRIPE_SECRET_KEY),
  square: !!(env.SQUARE_APP_ID && env.SQUARE_APP_SECRET),
});
export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "PAYMENTS_READ", "PAYMENTS_WRITE", "ORDERS_READ", "ORDERS_WRITE"];
export function authorizeUrl(provider, { state, redirectUri, env = process.env }) {
  if (provider === "stripe") return `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(env.STRIPE_CONNECT_CLIENT_ID || "")}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  if (provider === "square") return `${squareHost(env)}/oauth2/authorize?client_id=${encodeURIComponent(env.SQUARE_APP_ID || "")}&scope=${SQUARE_SCOPES.join("+")}&session=false&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  return "";
}
