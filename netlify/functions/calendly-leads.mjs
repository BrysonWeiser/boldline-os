// A booked call becomes a LEAD, not just a calendar entry.
//
// Bryson, 2026-08-20: "i dont get a lead in the os from a calendly sign up".
//
// 🔴 WHY THIS MATTERED MORE THAN IT LOOKED. "Book a Call" is the PRIMARY button on
// /get-started. The contact form underneath it is the fallback, and Bryson pointed out it is
// "not the noticable button compared to book a call". So the better a prospect is — the ones
// ready to take a meeting rather than leave their details — the LESS likely they were to
// exist anywhere in the OS. Only the weaker half of the funnel was being recorded.
//
// It was never a bug, just an unconnected seam: `calendly.mjs` fed the OS CALENDAR screen,
// and `submission-created` fed the LEADS screen, and nothing joined them.
//
// WHY POLLING RATHER THAN A WEBHOOK. Calendly webhooks need a paid plan and a subscription
// registered against the account. Polling needs only the Personal Access Token already used
// by the calendar, works on any plan, and survives a missed delivery — a webhook that fails
// once loses that lead forever, whereas the next poll picks it up.
//
// 🔴 DEDUPE IS ON THE EVENT URI, WHICH IS THE WHOLE CORRECTNESS ARGUMENT. This runs on a
// schedule over an overlapping window, so it sees the same booking many times. Every insert
// is checked against the Calendly event's own unique id, stored on the lead. Miss that and
// a single booking becomes a lead every fifteen minutes, forever.
//
// Env: CALENDLY_API_TOKEN (same token the calendar uses), SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const CAL = "https://api.calendly.com";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// How far back to look. Generous on purpose: the cost of re-reading a booking is one
// database lookup, and the cost of missing one is a prospect who never appears.
const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 120;

const clean = (v) => (v == null ? null : (String(v).trim() || null));

// Calendly returns the booking questions as a list of {question, answer} pairs. Keep them
// in the order they were asked, drop the empties, and fold them into one readable block —
// the Leads screen shows `message`, so this is what Bryson actually reads.
const answersToText = (qa) => (Array.isArray(qa) ? qa : [])
  .map((x) => ({ q: clean(x && x.question), a: clean(x && x.answer) }))
  .filter((x) => x.q && x.a)
  .map((x) => `${x.q}\n${x.a}`)
  .join("\n\n");

// Their business name is not a field Calendly gives us, so take it from whichever question
// looks like it asked. Best effort: a missing business name is fine, a wrong one is not.
const businessFrom = (qa) => {
  const hit = (Array.isArray(qa) ? qa : []).find((x) =>
    /business|company|firm|shop/i.test(String((x && x.question) || "")));
  return clean(hit && hit.answer);
};

export default async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const token = process.env.CALENDLY_API_TOKEN;
  // Not configured is not an error. It just means bookings are not being imported yet.
  if (!token) return json({ ok: true, configured: false, added: 0 });

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const meRes = await fetch(`${CAL}/users/me`, { headers: H });
    if (!meRes.ok) return json({ ok: true, configured: true, added: 0, error: `Calendly /users/me ${meRes.status}` });
    const userUri = ((await meRes.json()).resource || {}).uri;
    if (!userUri) return json({ ok: true, configured: true, added: 0, error: "no user uri" });

    const now = Date.now();
    const q = new URLSearchParams({
      user: userUri,
      min_start_time: new Date(now - LOOKBACK_DAYS * 864e5).toISOString(),
      max_start_time: new Date(now + LOOKAHEAD_DAYS * 864e5).toISOString(),
      sort: "start_time:asc", count: "100",
      // Cancellations included on purpose: someone who booked and then cancelled is still a
      // lead worth knowing about, and arguably one worth calling.
    });
    const evRes = await fetch(`${CAL}/scheduled_events?${q.toString()}`, { headers: H });
    if (!evRes.ok) return json({ ok: true, configured: true, added: 0, error: `Calendly events ${evRes.status}` });
    const events = ((await evRes.json()).collection) || [];

    let added = 0, skipped = 0, failed = 0;
    for (const ev of events) {
      const uri = String((ev && ev.uri) || "");
      if (!uri) continue;

      // 🔴 The dedupe. One lookup per event, on the Calendly id we stored last time.
      const { data: seen, error: seenErr } = await supabase
        .from("website_leads").select("id").eq("payload->>calendlyEventUri", uri).limit(1);
      if (seenErr) { failed++; console.error("calendly-leads: dedupe read failed:", seenErr.message); continue; }
      if (seen && seen.length) { skipped++; continue; }

      // The invitee carries the name, the email and the answers. The event alone does not.
      let invitee = {};
      try {
        const invRes = await fetch(`${uri}/invitees?count=10`, { headers: H });
        if (invRes.ok) invitee = (((await invRes.json()).collection) || [])[0] || {};
      } catch (e) {
        console.warn("calendly-leads: invitee read failed for", uri, e && e.message);
      }
      // No email means nothing to follow up with, and Calendly always has one for a real
      // booking. Skipping rather than inserting a blank keeps the Leads screen honest.
      const email = clean(invitee.email);
      if (!email) { skipped++; continue; }

      const qa = invitee.questions_and_answers || [];
      const when = ev.start_time ? new Date(ev.start_time).toLocaleString("en-US",
        { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
      const cancelled = String(ev.status || "").toLowerCase() === "canceled";

      const header = cancelled
        ? `CANCELLED a call that was booked for ${when}.`
        : `Booked a call for ${when} (Arizona time).`;
      const answers = answersToText(qa);

      const { error: insErr } = await supabase.from("website_leads").insert({
        form: "calendly",
        name: clean(invitee.name),
        business: businessFrom(qa),
        email,
        message: [header, answers].filter(Boolean).join("\n\n"),
        // A booked call is further along than a form fill, so it starts at "meeting" rather
        // than "new". Recording it as new would misrepresent the pipeline on day one.
        status: cancelled ? "new" : "meeting",
        payload: {
          calendlyEventUri: uri,
          eventName: clean(ev.name),
          startTime: ev.start_time || null,
          status: ev.status || null,
          inviteeUri: clean(invitee.uri),
          rescheduleUrl: clean(invitee.reschedule_url),
          cancelUrl: clean(invitee.cancel_url),
          questions: qa,
          source: "calendly-poll",
        },
      });
      if (insErr) { failed++; console.error("calendly-leads: insert failed:", insErr.message); continue; }
      added++;
    }

    return json({ ok: true, configured: true, scanned: events.length, added, skipped, failed });
  } catch (e) {
    console.error("calendly-leads failed:", e && e.message);
    return json({ ok: true, configured: true, added: 0, error: String((e && e.message) || e) });
  }
};
