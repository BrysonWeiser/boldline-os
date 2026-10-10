// Emails a business Bryson owns sends its own customers, on its own (Bryson, 2026-10-09: "lets do all of them",
// meaning a reminder the day before a job, a review request after it, and "time for another detail" for
// one-off customers; "make sure the email comes from the business email for my other business not boldline
// media"; and for the last one "make sure ... that it only goes to the one off customers that book a one time
// detail and dont already have a subscription"). KB `business-emails`.
//
// 🔴 FROM THE BUSINESS, OR NOT AT ALL. These three go out only once the business's own address has passed a
// test send (`emailSender.verified`). Until then they wait, and the OS says so. A booking confirmation is
// different: the customer must get it, so it falls back to our sending address under the business's name.
// 🔴 NEVER A BACKLOG. Each email has a narrow window around its moment, so switching this on (or a business
// with months of history) never sends a pile of old reminders and review requests.
// 🔴 A SUBSCRIBER NEVER GETS "BOOK AGAIN". A customer is matched by email or phone across every booking; any
// booking of a package marked as a plan, or a place on the business's "customers on a plan" list, rules them
// out for good. So does a booking still to come (they already rebooked), and unsubscribing.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isOwned } from "./owned.mjs";
import { bookingConfig, longWhen, payPhrase, payLabel } from "./booking.mjs";
import { depositPaid } from "./payments.mjs";
import { bizBrand, bizEmailHTML, bizEmailText } from "./biz-email-shell.mjs";

const H = 36e5, DAY = 864e5;
export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const https = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const low = (e) => String(e || "").trim().toLowerCase();
const digits = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };

export const REBOOK_DAY_CHOICES = [30, 45, 60, 90, 120];
export function customerEmailsOf(cl) {
  const c = (cl && cl.customerEmails) || {};
  return {
    reminder: c.reminder !== false,
    review: c.review !== false,
    rebook: c.rebook !== false,
    reviewUrl: https(c.reviewUrl),
    rebookDays: REBOOK_DAY_CHOICES.includes(Number(c.rebookDays)) ? Number(c.rebookDays) : 60,
    // Emails or phone numbers of customers on a plan bought outside the booking page.
    planCustomers: (Array.isArray(c.planCustomers) ? c.planCustomers : String(c.planCustomers || "").split(/[\n,]+/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 500),
  };
}

// The business's own From address, only once proven. The address is his choice (`emailSender.address`, set in
// the OS); whether it works is the server's finding (`emailSenderStatus`, written only by a test send or a
// failed send, and kept out of OS saves by SERVER_OWNED_KEYS). A changed address needs a new test.
export const senderOf = (cl) => {
  const want = low(((cl && cl.emailSender) || {}).address), st = (cl && cl.emailSenderStatus) || {};
  return st.verified && want && low(st.address) === want && EMAIL_RE.test(want) ? String(st.address).trim() : "";
};
// What has gone out already: `customerEmailLog["<bookingId>:<kind>"] = sentAt`. Server-owned, like the above,
// so an OS screen that was open before a send can never save over it and cause a second one.
export const wasSent = (cl, b, kind) => !!(((cl && cl.customerEmailLog) || {})[`${b && b.id}:${kind}`]);

// One customer, however they typed their details: email first, phone otherwise.
export const customerKeys = (b) => [low(b && b.email), digits(b && b.phone)].filter((k) => k && k.length >= 7);
const sameCustomer = (a, b) => { const ka = customerKeys(a); return customerKeys(b).some((k) => ka.includes(k)); };

export function onPlan(cl, b) {
  const cfg = bookingConfig(cl);
  const planPkgs = new Set(cfg.packages.filter((p) => p.plan).map((p) => p.id));
  const list = customerEmailsOf(cl).planCustomers.map((x) => (x.includes("@") ? low(x) : digits(x)));
  if (customerKeys(b).some((k) => list.includes(k))) return true;
  return ((cl && cl.bookings) || []).some((x) => x && x.status !== "cancelled" && sameCustomer(x, b) && (x.plan || planPkgs.has(x.packageId)));
}

export const isOptedOut = (cl, email) => ((cl && cl.emailOptOut) || []).map(low).includes(low(email));

// Unsubscribe links are signed, so nobody can take someone else off a list by guessing the address.
export const optOutSig = (key, businessId, email) => createHmac("sha256", String(key || "")).update(`${businessId}|${low(email)}`).digest("hex").slice(0, 32);
export const optOutCheck = (key, businessId, email, sig) => { const a = Buffer.from(optOutSig(key, businessId, email)), b = Buffer.from(String(sig || "")); return a.length === b.length && timingSafeEqual(a, b); };
export function optOutUrl(base, cl, email, key) {
  const d = ((cl && cl.websiteDeal) || {}).domain || {};
  // On the business's own domain when it has one (the websites site passes /optout through), so the link
  // a customer sees is the business's, not ours.
  const host = d.live && d.host ? `https://${d.host}` : String(base || "").replace(/\/$/, "");
  return `${host}/optout?b=${encodeURIComponent(cl.id)}&e=${encodeURIComponent(low(email))}&s=${optOutSig(key, cl.id, email)}`;
}

// ── The three emails ───────────────────────────────────────────────────────────────────────────────
// Dates are written out ("Friday, October 10 at 9:00 AM"), never "tomorrow": a scheduled job's idea of
// tomorrow is the server's, and the customer's is their own (CLAUDE.md, Arizona time rule).
export function reminderEmail(cl, b) {
  const cfg = bookingConfig(cl), B = bizBrand(cl);
  const when = longWhen(Date.parse(b.start), cfg.tz);
  const first = String(b.name || "").split(" ")[0];
  const dep = b.deposit && b.deposit.link && !depositPaid(cl, b) ? b.deposit : null;
  const parts = {
    preheader: `${b.packageName}, ${when}`,
    heading: `See you soon${first ? `, ${first}` : ""}.`,
    paras: [`Just a reminder that your ${b.packageName} is coming up.`, dep ? `Your ${dep.kind === "full" ? "payment" : "deposit"} isn't showing as paid yet. Pay ${payPhrase(dep)} to keep your time.` : ""],
    rows: [["When", when], ["Where", b.address || ""], ["What", `${b.packageName}${b.price ? ` (${b.price})` : ""}`]],
    button: dep ? { href: dep.link, label: payLabel(dep) } : (B.phone ? { href: `tel:${B.phone.replace(/[^0-9+]/g, "")}`, label: "Call us" } : null),
    after: [B.phone ? `Need to move it? Call or text ${B.phone}, or just reply to this email.` : "Need to move it? Just reply to this email."],
  };
  return { subject: `Reminder: ${b.packageName}, ${when}`, html: bizEmailHTML(cl, parts), text: bizEmailText(cl, parts) };
}

export function reviewEmail(cl, b, unsubscribe) {
  const C = customerEmailsOf(cl), B = bizBrand(cl);
  const first = String(b.name || "").split(" ")[0];
  const parts = {
    preheader: "It takes about a minute.",
    heading: `Thanks${first ? `, ${first}` : ""}.`,
    paras: [`Thanks for choosing ${B.name}. We hope you love how it turned out.`,
      "Would you leave us a quick review? It takes about a minute, and it's the biggest help to a small business like ours."],
    button: { href: C.reviewUrl, label: "Leave a review" },
    after: ["If anything wasn't right, just reply to this email and we'll make it right."],
    unsubscribe,
  };
  return { subject: `How did we do, ${first || "there"}?`, html: bizEmailHTML(cl, parts), text: bizEmailText(cl, parts) };
}

export function rebookEmail(cl, b, { bookUrl = "", unsubscribe = "" } = {}) {
  const B = bizBrand(cl);
  const first = String(b.name || "").split(" ")[0];
  const what = String(b.packageName || "visit");
  const parts = {
    preheader: "Book your next one in about a minute.",
    heading: `Time for another ${what.toLowerCase()}?`,
    paras: [`Hi${first ? ` ${first}` : ""}, it's been a little while since your last ${what}.`,
      "If you're ready for the next one, you can pick a time that suits you in about a minute."],
    button: https(bookUrl) ? { href: bookUrl, label: "Book your next one" } : (B.phone ? { href: `tel:${B.phone.replace(/[^0-9+]/g, "")}`, label: "Call to book" } : null),
    after: [B.phone ? `Rather talk to a person? Call or text ${B.phone}.` : ""],
    unsubscribe,
  };
  return { subject: `Time for another ${what.toLowerCase()}?`, html: bizEmailHTML(cl, parts), text: bizEmailText(cl, parts) };
}

// ── Who is due what, right now ─────────────────────────────────────────────────────────────────────
// Pure, so verify-business-emails can walk the clock. Returns [{kind, booking}], at most one of each kind
// per booking, never for a cancelled booking, never twice (`customerEmailLog` records a send).
export function dueCustomerEmails(cl, now = Date.now()) {
  if (!isOwned(cl) || (cl && cl.demo) || !senderOf(cl)) return [];
  const C = customerEmailsOf(cl);
  const all = ((cl && cl.bookings) || []).filter((b) => b && b.start && Date.parse(b.start));
  const live = all.filter((b) => b.status !== "cancelled");
  const sent = (b, k) => wasSent(cl, b, k);
  const end = (b) => Date.parse(b.end) || Date.parse(b.start);
  const out = [];
  for (const b of live) {
    if (!EMAIL_RE.test(b.email || "")) continue;
    const start = Date.parse(b.start), made = Date.parse(b.createdAt) || 0;
    // The day before: from 26 hours out to 2 hours out. Skipped when they booked inside the last day and a
    // half, because their confirmation is still fresh.
    if (C.reminder && !sent(b, "reminder") && start - now <= 26 * H && start - now > 2 * H && (!made || start - made > 30 * H)) out.push({ kind: "reminder", booking: b });
    // The day after: between 18 hours and 3 days after the job ends.
    if (C.review && C.reviewUrl && !sent(b, "review") && !isOptedOut(cl, b.email) && now - end(b) >= 18 * H && now - end(b) <= 72 * H) out.push({ kind: "review", booking: b });
  }
  if (C.rebook) {
    // Per customer: only their LATEST booking can trigger it, only once it is `rebookDays` old (with two weeks
    // of grace so an hour of downtime never loses one), and only for a one-off customer.
    const seen = new Set();
    for (const b of live.slice().sort((x, y) => Date.parse(y.start) - Date.parse(x.start))) {
      const keys = customerKeys(b);
      if (!keys.length || keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      const latest = live.filter((x) => sameCustomer(x, b)).sort((x, y) => Date.parse(y.start) - Date.parse(x.start))[0] || b;
      if (latest !== b) continue;
      const age = now - end(b);
      if (!EMAIL_RE.test(b.email || "") || sent(b, "rebook") || isOptedOut(cl, b.email)) continue;
      if (age < C.rebookDays * DAY || age > (C.rebookDays + 14) * DAY) continue;
      if (onPlan(cl, b)) continue;
      out.push({ kind: "rebook", booking: b });
    }
  }
  return out;
}

export function buildCustomerEmail(cl, kind, b, { base = "", key = "" } = {}) {
  const unsub = optOutUrl(base, cl, b.email, key);
  if (kind === "reminder") return reminderEmail(cl, b);
  if (kind === "review") return reviewEmail(cl, b, unsub);
  const d = ((cl && cl.websiteDeal) || {}).domain || {};
  const site = d.live && d.host ? `https://${d.host}/` : (cl.website && cl.website.published && cl.landingSlug ? `${String(base).replace(/\/$/, "")}/site/${encodeURIComponent(cl.landingSlug)}/` : "");
  return rebookEmail(cl, b, { bookUrl: site ? `${site}book/` : "", unsubscribe: unsub });
}

// Send as the business. `strict` (the automatic emails) sends only from its own proven address; otherwise
// (a booking confirmation) it falls back to our sending address under the business's name, replies to it.
export async function sendAsBusiness(cl, { to, subject, html, text }, { send, strict = false } = {}) {
  const from = senderOf(cl);
  const replyTo = EMAIL_RE.test((cl && cl.email) || "") ? cl.email : (from || undefined);
  if (from) {
    try { await send({ to, subject, html, text, fromName: cl.name, fromAddress: from, replyTo }); return { sent: true, via: "business" }; }
    catch (e) { if (strict) return { sent: false, error: String((e && e.message) || e).slice(0, 300), senderFailed: true }; }
  }
  if (strict) return { sent: false, error: "The business's own email address is not set up yet." };
  await send({ to, subject, html, text, fromName: cl.name, replyTo });
  return { sent: true, via: "fallback" };
}

// ── Branding pulled from the business's own website ────────────────────────────────────────────────
// Pure: finds the logo and brand colour in a page's HTML. The fetch (and its safety checks) is in
// netlify/functions/biz-email.mjs.
export function brandFromHTML(html, pageUrl) {
  const h = String(html || "").slice(0, 600000);
  const abs = (u) => { try { const x = new URL(String(u || "").trim().replace(/&amp;/g, "&"), pageUrl); return x.protocol === "https:" ? x.href : ""; } catch (e) { return ""; } };
  const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? (m[1] ?? m[2] ?? m[3] ?? "") : ""; };
  const tags = (re) => h.match(re) || [];
  const imgs = tags(/<img\b[^>]*>/gi).filter((t) => /logo/i.test(attr(t, "src") + " " + attr(t, "alt") + " " + attr(t, "class") + " " + attr(t, "id")));
  const links = tags(/<link\b[^>]*>/gi);
  const touch = links.find((t) => /apple-touch-icon/i.test(attr(t, "rel")));
  const icon = links.find((t) => /(^|\s)icon(\s|$)/i.test(attr(t, "rel")) && (/\.svg/i.test(attr(t, "href")) || Number(String(attr(t, "sizes")).split("x")[0]) >= 96));
  const logoUrl = (imgs.length && abs(attr(imgs[0], "src"))) || (touch && abs(attr(touch, "href"))) || (icon && abs(attr(icon, "href"))) || "";
  const metas = tags(/<meta\b[^>]*>/gi);
  const metaOf = (n) => { const t = metas.find((x) => new RegExp(`^${n}$`, "i").test(attr(x, "name") || attr(x, "property"))); return t ? attr(t, "content") : ""; };
  let color = (metaOf("theme-color") || metaOf("msapplication-TileColor")).trim();
  if (/^#[0-9a-f]{3}$/i.test(color)) color = "#" + color.slice(1).split("").map((c) => c + c).join("");
  if (!/^#[0-9a-f]{6}$/i.test(color)) color = "";
  const name = (metaOf("og:site_name") || (h.match(/<title[^>]*>([^<]{1,120})<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return { logoUrl, color: color.toUpperCase(), name };
}

// A page fetch only ever goes to a public https site: no internal addresses, no bare IPs, no odd ports.
export function safePublicUrl(u) {
  let x; try { x = new URL(String(u || "").trim()); } catch (e) { return ""; }
  if (x.protocol !== "https:" || x.port && x.port !== "443" || x.username || x.password) return "";
  const host = x.hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || /(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)) return "";
  return x.href;
}
