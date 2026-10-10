// A customer paying a business for a booking, through that business's own Stripe or Square (KB `payments-connect`).
//   GET  /pay?c=<client>&b=<booking>&s=<signature>          what they are paying for, and every way to pay it
//   POST /pay?c&b&s                                          opens the checkout on the business's own account
//   GET  /pay?c&b&s&done=1                                   back from the checkout: checks it went through
// 🔴 GET never creates anything: mail apps open links to scan them, and a scan must not leave a stray checkout
// or order in the business's Square. The page speaks for the business, never for BoldLine. No emojis, no dashes.
// On a business's own domain the websites site passes /pay through to here (sites/functions/pay.mjs).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { OS_BASE } from "../lib/lead-relay.mjs";
import { bizBrand } from "../lib/biz-email-shell.mjs";
import { bookingConfig, longWhen } from "../lib/booking.mjs";
import { payOf, payCheck, payKey, payBase, payEntry, depositPaid, cents, money } from "../lib/payments.mjs";
import { stripeCheckout, squareLink, freshSquare, logPayEntry, checkPaid } from "../lib/payments-api.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// `ways`: the buttons, in order. { action, label } posts back here (a card payment); { href, label } is one of the
// business's own payment links, opened in a new tab. `note`: one small line under them.
function page(cl, title, msg, { rows = [], ways = [], note = "" } = {}) {
  const B = bizBrand(cl || {});
  const logo = B.logo ? `<img src="${esc(B.logo)}" alt="${esc(B.name)}" style="height:40px;width:auto;max-width:200px;display:block;margin:0 auto 18px">` : `<div style="font-weight:800;font-size:18px;color:${B.ink};margin-bottom:18px">${esc(B.name)}</div>`;
  const box = rows.filter(([, v]) => v).length ? `<div class="box">${rows.filter(([, v]) => v).map(([k, v]) => `<div class="r"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>` : "";
  const btns = ways.map((w, i) => w.action
    ? `<form method="POST" action="${esc(w.action)}"><button type="submit"${i ? ' class="alt"' : ""}>${esc(w.label)}</button></form>`
    : `<a class="btn${i ? " alt" : ""}" href="${esc(w.href)}" target="_blank" rel="noopener noreferrer">${esc(w.label)}</a>`).join("");
  const foot = [B.phone, B.website.replace(/^https:\/\//, "").replace(/\/$/, "")].filter(Boolean).map(esc).join(" &middot; ");
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#F4F5F7;color:#111827;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px 16px}
.c{width:100%;max-width:440px;background:#fff;border:1px solid #E5E7EB;border-top:4px solid ${B.color};border-radius:14px;padding:26px 22px;text-align:center}h1{font-size:21px;margin:0 0 8px}p{margin:0 0 18px;color:#6B7280}
.box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:6px 14px;margin:0 0 18px;text-align:left}.r{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #EEF0F3}.r:last-child{border-bottom:0}.r span{color:#6B7280}.r b{text-align:right}
form{margin:0}button,.btn{display:block;width:100%;font:inherit;font-weight:700;padding:14px 22px;border-radius:10px;border:0;background:${B.color};background-image:linear-gradient(${B.color},${B.color});color:${B.on};cursor:pointer;text-decoration:none;margin:0 0 10px}
.alt{background:#fff;background-image:none;color:#111827;border:1px solid #D1D5DB}.n{font-size:14px;color:#6B7280;margin:4px 0 0}
.f{font-size:13px;color:#9CA3AF;margin-top:18px}</style></head>
<body><div class="c">${logo}<h1>${esc(title)}</h1><p>${esc(msg)}</p>${box}${btns}${note ? `<p class="n">${esc(note)}</p>` : ""}${foot ? `<div class="f">${foot}</div>` : ""}</div></body></html>`,
  { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

export default async (req) => {
  const u = new URL(req.url);
  const c = String(u.searchParams.get("c") || ""), b = String(u.searchParams.get("b") || ""), s = String(u.searchParams.get("s") || "");
  const key = payKey();
  if (!c || !b || !payCheck(key, c, b, s)) return page(null, "This link doesn't work", "It may have been copied incompletely. Use the button in your booking email, or get in touch with us.");
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: row } = await db.from("clients").select("id, data").eq("id", c).maybeSingle();
  if (!row || !row.data) return page(null, "This link doesn't work", "Get in touch with us and we'll sort it out.");
  const cl = { ...row.data, id: row.id };
  const bk = (cl.bookings || []).find((x) => x && x.id === b);
  if (!bk || !bk.deposit) return page(cl, "Nothing to pay here", "We couldn't find a payment for this booking. Get in touch with us and we'll sort it out.");
  const cfg = bookingConfig(cl), when = longWhen(Date.parse(bk.start), cfg.tz);
  const full = bk.deposit.kind === "full", amt = cents(bk.deposit.amount);
  const what = full ? "Payment" : "Deposit";
  const rows = [["Booking", bk.packageName], ["When", when], [what, money(amt)]];
  const self = `/pay?c=${encodeURIComponent(c)}&b=${encodeURIComponent(b)}&s=${encodeURIComponent(s)}`;
  if (bk.status === "cancelled") return page(cl, "This booking was cancelled", "There's nothing to pay. Get in touch with us if that's not right.", { rows: rows.slice(0, 2) });
  if (depositPaid(cl, bk)) return page(cl, "Paid, thank you", `Your ${what.toLowerCase()} is in and your time is locked in. See you then.`, { rows });

  // Every way the business takes payment, as it stands right now, and the customer picks (Bryson, 2026-10-09: "the
  // option to choose multiple ways"). A card first when its own Stripe or Square is connected, then its payment
  // links, then a line saying paying at the job is fine when it is.
  const P = payOf(cl), provider = P.connected;
  const card = provider && amt >= 50 ? [{ action: self, label: P.links.length ? `Pay ${money(amt)} by card` : `Pay ${money(amt)}` }] : [];
  const links = P.links.map((l) => ({ href: l.url, label: `Pay with ${l.label}` }));
  const ways = [...card, ...links];
  const linkNote = links.length ? "Paid another way? It shows as paid once we see it come in." : "";
  const atJob = P.inperson ? "You can also pay at the job." : "";
  if (!ways.length) return page(cl, P.inperson ? "Pay at the job" : "Online payment is off right now", P.inperson ? "There's nothing to pay online. You can pay when we see you." : "Get in touch with us and we'll tell you how to pay.", { rows });

  if (u.searchParams.get("done")) {
    let paid = false;
    try { paid = await checkPaid(db, cl, row.id, b); } catch (e) { console.error("pay check failed:", e && e.message); }
    if (paid) return page(cl, "Paid, thank you", `Your ${what.toLowerCase()} is in and your time is locked in. See you then.`, { rows });
    return page(cl, "We haven't seen the payment yet", "If you just paid, it can take a moment to show. If you didn't finish, you can pay now.", { rows, ways, note: [linkNote, atJob].filter(Boolean).join(" ") });
  }

  if (req.method !== "POST") return page(cl, full ? "Pay for your booking" : "Pay your deposit", ways.length > 1 ? "Your time is held. Pick how you'd like to pay." : "Your time is held. Paying now locks it in.", { rows, ways, note: [linkNote, atJob].filter(Boolean).join(" ") });
  // Only a card payment posts here. The business has since switched its card off: show what is left.
  if (!card.length) return page(cl, full ? "Pay for your booking" : "Pay your deposit", "Card payment is off right now. Here's how you can pay.", { rows, ways, note: [linkNote, atJob].filter(Boolean).join(" ") });

  // Back to this business's own domain afterwards (or the OS while it has none), never a BoldLine page.
  const back = `${payBase(cl, process.env.OS_BASE_URL || OS_BASE)}${self}`;
  const name = `${bk.packageName}, ${what.toLowerCase()}`;
  try {
    if (provider === "stripe") {
      const co = await stripeCheckout(P.conn.account, { cents: amt, name, description: when, email: bk.email, successUrl: `${back}&done=1`, cancelUrl: back, ref: b });
      await logPayEntry(db, row.id, b, { provider: "stripe", ref: co.id, cents: amt, status: "open", createdAt: new Date().toISOString() });
      return Response.redirect(co.url, 303);
    }
    // Square links never expire, so the one made for this booking is reused.
    const e = payEntry(cl, b);
    if (e && e.provider === "square" && e.url && e.cents === amt) return Response.redirect(e.url, 303);
    const t = await freshSquare(db, row.id);
    if (!t) throw new Error("no square key");
    const link = await squareLink(t, { cents: amt, name, email: bk.email, redirectUrl: `${back}&done=1`, ref: b });
    await logPayEntry(db, row.id, b, { provider: "square", ref: link.orderId, url: link.url, cents: amt, status: "open", createdAt: new Date().toISOString() });
    return Response.redirect(link.url, 303);
  } catch (e) {
    console.error("pay start failed:", e && e.message);
    return page(cl, "The payment page didn't open", "Please try again in a minute, or get in touch with us.", { rows, ways: [{ action: self, label: "Try again" }, ...links] });
  }
};
