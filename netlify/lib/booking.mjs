// Online booking on a business's website (Bryson, 2026-10-07, for the car detailing business he owns:
// "we will want it so our number is displayed if they want to call us but they can book by just pressing
// what package they want (which we will set up later) and then choose a date and time and put in the
// location plus their info").
//
// The customer taps a package, picks a day and an open time, types where the car will be and how to reach
// them, and it is booked. Open times come from the business's working hours, minus every job already
// booked (plus travel time between jobs) and any time blocked off, so the same slot can never be sold
// twice. All times are the business's own clock (Arizona unless set otherwise).
//
// Used by netlify/functions/book.mjs (the OS, the only writer) and site-render.mjs (the Book page).
import { bizEmailHTML, bizEmailText } from "./biz-email-shell.mjs";
import { payOf, chargeFor, payNoteFor } from "./payments.mjs";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Minutes from midnight, [open, close]; null is closed. Monday to Saturday, 8 to 5.
export const DEFAULT_HOURS = [null, [480, 1020], [480, 1020], [480, 1020], [480, 1020], [480, 1020], [480, 1020]];
export const MAX_PACKAGES = 12;

const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
// Only a full https address is ever used as a link: no scripts, no bare domains, nothing relative.
const httpsUrl = (u) => { const t = String(u || "").trim(); if (!/^https:\/\/[^\s"'<>]+$/i.test(t)) return ""; try { return new URL(t).href; } catch (e) { return ""; } };

export function bookingConfig(cl) {
  const b = (cl && cl.booking) || {};
  const hours = Array.isArray(b.hours) && b.hours.length === 7
    ? b.hours.map((h) => (Array.isArray(h) && h.length === 2 && Number(h[1]) > Number(h[0]) ? [num(h[0], 480, 0, 1440), num(h[1], 1020, 0, 1440)] : null))
    : DEFAULT_HOURS;
  const connected = !!payOf(cl).connected;
  const packages = (Array.isArray(b.packages) ? b.packages : [])
    .filter((p) => p && p.id && str(p.name, 80))
    .slice(0, MAX_PACKAGES)
    .map((p) => {
      const depositLink = httpsUrl(p.depositLink);
      // A deposit amount counts when there is somewhere to pay it: the business's own payment link, or its
      // connected Stripe or Square, which charges it at booking (KB payments-connect).
      const pk = { id: str(p.id, 40), name: str(p.name, 80), price: str(p.price, 30), minutes: num(p.minutes, 120, 15, 720), desc: str(p.desc, 300),
        deposit: depositLink || connected ? str(p.deposit, 20) : "", depositLink,
        // A subscription / membership package. Its customers never get the "time for another" email.
        plan: !!p.plan };
      return { ...pk, payNote: payNoteFor(cl, pk) };
    });
  return {
    on: !!b.on, packages, hours,
    tz: str(b.tz, 60) || "America/Phoenix",
    step: num(b.step, 30, 15, 120),            // a start time every N minutes
    leadHours: num(b.leadHours, 12, 0, 168),   // nobody can book sooner than this
    daysAhead: num(b.daysAhead, 21, 1, 60),
    buffer: num(b.buffer, 30, 0, 240),         // travel time kept free around every job
    note: str(b.note, 240),
    cta: str(b.cta, 30) || "Book now",
    // Where the job happens. A mobile business asks for the address (the detailer: where the vehicle will be);
    // a business customers come to (a salon, a shop) switches it off. The wording is the business's own.
    askAddress: b.askAddress !== false,
    addressLabel: str(b.addressLabel, 80) || "Service address",
    blocks: (Array.isArray(b.blocks) ? b.blocks : []).filter((x) => x && Date.parse(x.start) && Date.parse(x.end) > Date.parse(x.start)),
  };
}

// ── How this business takes customers ────────────────────────────────────────
// Bryson, 2026-10-07: "I essentially want to be able to modify websites (my other businesses and my clients) to
// include whatever booking system they have whether it is requesting a quote and they fill out a form or they
// do what I just described and book directly through the website and any other possible ways to get clients".
// One setting per business, `cl.intake.how`, decides where every main button on its website goes:
//   quote  the contact form (how every site worked before this)
//   book   the built-in Book page above (needs at least one package)
//   link   the booking system they already use (Square, Calendly, Housecall Pro...), an https address
//   call   their phone
// A choice that cannot work yet falls back to the quote form, so a button never leads nowhere. The phone
// number shows on the site whatever is picked. Changing it is never a round of website changes (agreement WA-3).
export const INTAKE_WAYS = ["quote", "book", "link", "call"];
export function intakeOf(cl) {
  const i = (cl && cl.intake) || {};
  const phone = String((cl && (cl.businessPhone || cl.callTrackingNumber)) || "").trim();
  const link = httpsUrl(i.link);
  // Before this setting existed, booking was switched on with booking.on.
  const want = INTAKE_WAYS.includes(i.how) ? i.how : (cl && cl.booking && cl.booking.on ? "book" : "quote");
  const how = want === "book" && bookingConfig(cl).packages.length === 0 ? "quote"
    : want === "link" && !link ? "quote"
    : want === "call" && !phone ? "quote"
    : want;
  return { how, wanted: want, link: how === "link" ? link : "", phone,
    label: how === "book" ? bookingConfig(cl).cta : how === "link" ? (str(i.linkLabel, 30) || "Book now") : how === "call" ? (str(i.callLabel, 30) || "Call now") : "" };
}

// The Book page is on only when the business takes customers that way AND has a package to pick (Bryson:
// "which we will set up later").
export const bookingOn = (cl) => intakeOf(cl).how === "book";

// ── The business's clock ────────────────────────────────────────────────────
// How far the zone is from UTC at a given moment, read from the platform's own time zone data, so a zone
// with daylight saving gets the right offset on each side of the change. Arizona simply never changes.
export function tzOffsetMin(tz, at) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(at)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(at / 60000) * 60000) / 60000);
}
// A wall-clock time on a date in the zone, as a UTC timestamp.
export function zonedToUtc(ymd, minutes, tz) {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const off = tzOffsetMin(tz, guess);
  const t = guess - off * 60000;
  const off2 = tzOffsetMin(tz, t);
  return off2 === off ? t : guess - off2 * 60000;
}
export const ymdIn = (tz, at) => new Date(at).toLocaleDateString("en-CA", { timeZone: tz });
const weekdayOf = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const addDays = (ymd, n) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const timeLabel = (at, tz) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
export const dayLabel = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }); };
export const longWhen = (at, tz) => `${new Date(at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })} at ${timeLabel(at, tz)}`;

// Everything already holding time: live bookings (plus travel time on both sides) and blocked time.
const busyOf = (cl, cfg) => [
  ...((cl && cl.bookings) || []).filter((b) => b && b.status !== "cancelled" && Date.parse(b.start) && Date.parse(b.end))
    .map((b) => [Date.parse(b.start) - cfg.buffer * 60000, Date.parse(b.end) + cfg.buffer * 60000]),
  ...cfg.blocks.map((x) => [Date.parse(x.start), Date.parse(x.end)]),
];

export function daySlots(cl, ymd, pkg, now = Date.now()) {
  const cfg = bookingConfig(cl);
  const hrs = cfg.hours[weekdayOf(ymd)];
  if (!hrs || !pkg) return [];
  const busy = busyOf(cl, cfg);
  const earliest = now + cfg.leadHours * 3600e3;
  const out = [];
  for (let t = hrs[0]; t + pkg.minutes <= hrs[1]; t += cfg.step) {
    const s = zonedToUtc(ymd, t, cfg.tz), e = s + pkg.minutes * 60000;
    if (s < earliest) continue;
    if (busy.some(([a, b]) => s < b && e > a)) continue;
    out.push({ start: new Date(s).toISOString(), label: timeLabel(s, cfg.tz) });
  }
  return out;
}

export function bookingDays(cl, pkgId, now = Date.now()) {
  const cfg = bookingConfig(cl);
  const pkg = cfg.packages.find((p) => p.id === pkgId);
  if (!pkg) return [];
  const first = ymdIn(cfg.tz, now);
  return Array.from({ length: cfg.daysAhead }, (_, i) => addDays(first, i))
    .map((ymd) => ({ date: ymd, label: dayLabel(ymd), slots: daySlots(cl, ymd, pkg, now) }));
}

// What the website may know: the packages and the business's phone, nothing about other bookings.
export const publicBooking = (cl) => { const c = bookingConfig(cl); return { on: bookingOn(cl), packages: c.packages.map(({ depositLink, ...p }) => p), note: c.note, cta: c.cta, tz: c.tz }; };

// ── A new booking ───────────────────────────────────────────────────────────
// Checks everything again on the server, against the record as it is right now. Returns the booking and
// the matching lead, or a reason a person can read.
export function makeBooking(cl, body, now = Date.now(), id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(now)) {
  const cfg = bookingConfig(cl);
  if (!bookingOn(cl)) return { error: "Online booking is not open right now. Please call us." };
  const pkg = cfg.packages.find((p) => p.id === String((body && body.packageId) || ""));
  if (!pkg) return { error: "Please pick a package." };
  const start = Date.parse(String((body && body.start) || ""));
  if (!start) return { error: "Please pick a time." };
  const ymd = ymdIn(cfg.tz, start);
  const ok = daySlots(cl, ymd, pkg, now).some((s) => Date.parse(s.start) === start);
  if (!ok) return { error: "Sorry, that time was just taken or is no longer open. Please pick another.", taken: true };
  const name = str(body.name, 120), phone = str(body.phone, 40), email = str(body.email, 160), address = str(body.address, 240), notes = str(body.notes, 800);
  if (!name) return { error: "Please add your name." };
  if (!phone && !email) return { error: "Please add a phone number or an email so we can confirm." };
  if (cfg.askAddress && !address) return { error: "Please add the address." };
  const end = start + pkg.minutes * 60000;
  const when = longWhen(start, cfg.tz);
  // 🔴 A DEPOSIT IS PAID TO THE BUSINESS, NEVER THROUGH BOLDLINE. Either the business's own Stripe or Square
  // charges it (book.mjs adds the pay link, which opens a checkout ON the business's account), or the link is the
  // business's own payment page and he marks it paid. BoldLine never holds the money.
  const ch = chargeFor(cl, pkg);
  const deposit = ch ? { amount: ch.label, kind: ch.kind, via: payOf(cl).connected, link: "", paid: false }
    : pkg.depositLink ? { amount: pkg.deposit, link: pkg.depositLink, paid: false } : null;
  const booking = { id, packageId: pkg.id, packageName: pkg.name, price: pkg.price, minutes: pkg.minutes, plan: pkg.plan,
    start: new Date(start).toISOString(), end: new Date(end).toISOString(), address, name, phone, email, notes, deposit,
    status: "booked", createdAt: new Date(now).toISOString() };
  const lead = { name, phone, email, source: "booking", page: str(body.page, 500), receivedAt: new Date(now).toISOString(), leadId: id, bookingId: id,
    message: [`Booked: ${pkg.name}${pkg.price ? ` (${pkg.price})` : ""} on ${when}.`, address ? `Address: ${address}.` : "", deposit ? (deposit.kind === "full" ? `Payment of ${deposit.amount} due online when they booked, not paid yet.` : `Deposit${deposit.amount ? ` of ${deposit.amount}` : ""} not paid yet.`) : "", notes ? `Notes: ${notes}` : ""].filter(Boolean).join("\n") };
  return { booking, lead, when };
}

export const depositPhrase = (amount) => (String(amount || "").trim() ? `the ${String(amount).trim()} deposit` : "the deposit");
// A connected Stripe or Square can take the whole price at booking instead of a deposit; the words follow.
export const payPhrase = (dep) => (dep && dep.kind === "full" ? `the ${String(dep.amount || "").trim() || "payment"}`.replace(/^the payment$/, "for your booking") : depositPhrase(dep && dep.amount));
export const payLabel = (dep) => (dep && dep.kind === "full" ? "Pay now" : "Pay the deposit");

// The customer's confirmation, sent as the business and in its own branding (biz-email-shell.mjs). No
// emojis, no dashes, nothing pointing at BoldLine.
export function bookingConfirmEmail(cl, booking) {
  const cfg = bookingConfig(cl);
  const phone = String((cl && (cl.businessPhone || cl.callTrackingNumber)) || "").trim();
  const when = longWhen(Date.parse(booking.start), cfg.tz);
  const first = String(booking.name || "").split(" ")[0];
  const dep = booking.deposit && booking.deposit.link ? booking.deposit : null;
  const parts = {
    preheader: `${booking.packageName}, ${when}`,
    heading: `You're booked${first ? `, ${first}` : ""}.`,
    paras: ["Here are the details. We'll see you then."],
    rows: [["What", `${booking.packageName}${booking.price ? ` (${booking.price})` : ""}`], ["When", when], ["Where", booking.address || ""]],
    button: dep ? { href: dep.link, label: payLabel(dep) } : null,
    after: [dep ? `Your time is held. Pay ${payPhrase(dep)} to lock it in.` : "",
      phone ? `Need to change anything? Call or text us at ${phone}, or just reply to this email.` : "Need to change anything? Just reply to this email."],
  };
  // The deposit line reads before its button.
  if (dep) { parts.paras.push(parts.after[0]); parts.after = parts.after.slice(1); }
  return { subject: `You're booked: ${booking.packageName}, ${when}`, html: bizEmailHTML(cl, parts), text: bizEmailText(cl, parts) };
}
