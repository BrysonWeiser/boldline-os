// Online booking for a business's website (see ../lib/booking.mjs). The OS is the only writer.
// GET  /book?token=<leadToken>&pkg=<packageId>   the packages, the phone, and open times for that package
// POST /book?token=<leadToken>                     {packageId, start, name, phone, email, address, notes, page}
// The website on a client's own domain reaches this through its own /book (sites/functions/book.mjs).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, notifyOwnerOfLead } from "../lib/report-shared.mjs";
import { bookingOn, bookingDays, publicBooking, makeBooking, bookingConfirmEmail } from "../lib/booking.mjs";
import { notifyTeamOfLead } from "../lib/team-view.mjs";

const HEAD = { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEAD });
const phoneOf = (cl) => String((cl && (cl.businessPhone || cl.callTrackingNumber)) || "").trim();

const load = async (db, token) => {
  const { data, error } = await db.from("clients").select("id, data").eq("data->>leadToken", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...HEAD, "access-control-allow-methods": "GET, POST" } });
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") || "");
  if (!token || token.length > 80) return json({ ok: false, error: "Booking is not available here." }, 404);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let row;
  try { row = await load(db, token); } catch (e) { return json({ ok: false, error: "Online booking is down for a moment. Please call us." }, 500); }
  if (!row || !bookingOn(row.data)) return json({ ok: false, error: "Online booking is not open right now. Please call us.", phone: row ? phoneOf(row.data) : "" }, 404);

  if (req.method === "GET") {
    const pkg = String(url.searchParams.get("pkg") || "");
    return json({ ok: true, booking: publicBooking(row.data), phone: phoneOf(row.data), days: pkg ? bookingDays(row.data, pkg) : [] });
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  // 🔴 READ AGAIN AND CHECK THE TIME AGAINST THE RECORD AS IT IS NOW. Two customers can pick the same
  // slot a second apart; whoever is written second must be told it is gone, never double-booked.
  let fresh;
  try { fresh = await load(db, token); } catch (e) { return json({ ok: false, error: "Could not book just now. Please try again or call us." }, 500); }
  const made = makeBooking(fresh.data, body);
  if (made.error) return json({ ok: false, error: made.error, taken: !!made.taken, phone: phoneOf(fresh.data) }, made.taken ? 409 : 400);

  const cur = fresh.data;
  const next = {
    ...cur,
    bookings: [made.booking, ...(cur.bookings || [])].slice(0, 500),
    leads: (cur.leads || 0) + 1,
    leadsLog: [{ status: "new", followUps: [], ...made.lead }, ...(cur.leadsLog || [])],
    commLog: [{ date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), note: `New booking: ${made.booking.name}, ${made.booking.packageName}, ${made.when}`, cat: "update", ts: Date.now() }, ...(cur.commLog || [])],
  };
  const { error } = await db.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", fresh.id);
  if (error) return json({ ok: false, error: "Could not book just now. Please try again or call us." }, 500);

  // Saved first, then delivery. A failed email never costs the booking.
  const mail = bookingConfirmEmail(next, made.booking);
  await Promise.all([
    notifyOwnerOfLead(next, made.lead),
    notifyTeamOfLead(next, made.lead, { send: sendEmail, base: process.env.URL }),
    made.booking.email
      ? sendEmail({ to: made.booking.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: next.name, replyTo: next.email || undefined }).catch((e) => console.error("booking confirmation failed:", e && e.message))
      : Promise.resolve(),
  ]);
  return json({ ok: true, when: made.when, packageName: made.booking.packageName, phone: phoneOf(next),
    deposit: made.booking.deposit ? { amount: made.booking.deposit.amount, link: made.booking.deposit.link } : null });
};
