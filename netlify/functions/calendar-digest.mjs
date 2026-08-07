// Morning agenda digest (Bryson, 2026-08-07). The OS Calendar screen is a VIEW —
// it shows what's coming up but never pings you. This scheduled job fixes that:
// each morning it gathers everything on TODAY's calendar and sends it as a push
// (to the installed PWA / phone) + a branded email, so upcoming things — meetings
// especially — actually reach you.
//
// It mirrors index.html's buildCalendarEvents sources, computed server-side from
// Supabase: manual events (calendar_events), client invoice/review/contract/
// renewal dates, scheduled newsletter + blog, and Calendly meetings (only if a
// CALENDLY_API_TOKEN is set — free Calendly has no API, so those come from
// Calendly's own reminders instead). Everything is fail-soft: a missing table or
// an unconfigured channel never stops the rest. Only sends when there's >=1 item
// today (no daily "nothing scheduled" spam) — except in ?test=1 mode.
//
// Schedule: netlify.toml runs it at 14:00 UTC = 7:00 AM America/Phoenix (AZ has
// no DST, so this is stable year-round).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, escapeHTML } from "../lib/report-shared.mjs";
import { sendPushToAll } from "../lib/push-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";

const TZ = "America/Phoenix";
const CAL = "https://api.calendly.com";

const GOLD = "#C8A84B";
const KIND_COLOR = { meeting:"#F87171", invoice:GOLD, review:GOLD, contract:"#FBBF24", renewal:"#FBBF24", newsletter:"#4F8EF7", blog:"#4F8EF7", task:"#8B5CF6", reminder:"#22D3A0", other:"#8B91B8" };

// Date-only strings ("2026-08-10") are used as-is (no UTC->local shift); anything
// with a time is resolved in Phoenix.
const ymdInTZ = (v) => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s); if (isNaN(d)) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
};
const shiftYMD = (v, n) => {
  const s = String(v);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00Z") : new Date(v);
  if (isNaN(base)) return null;
  base.setUTCDate(base.getUTCDate() + n);
  return base.toLocaleDateString("en-CA", { timeZone: TZ });
};
// "HH:MM" (24h) -> {min, label 12h}. Blank -> all-day.
const parseHM = (hhmm) => {
  if (!/^\d{1,2}:\d{2}$/.test(String(hhmm || ""))) return { min: 9999, label: "" };
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM"; const h12 = ((h + 11) % 12) + 1;
  return { min: h * 60 + m, label: `${h12}:${String(m).padStart(2, "0")} ${ap}` };
};
const timeFromISO = (iso) => {
  const d = new Date(iso); if (isNaN(d)) return { min: 9999, label: "" };
  const hm = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = hm.split(":").map(Number);
  return { min: h * 60 + m, label: d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) };
};

const fetchCalendlyToday = async (todayYMD) => {
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) return [];
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    const meRes = await fetch(`${CAL}/users/me`, { headers: H });
    if (!meRes.ok) return [];
    const me = await meRes.json();
    const userUri = me && me.resource && me.resource.uri;
    if (!userUri) return [];
    const now = Date.now();
    const q = new URLSearchParams({ user: userUri, min_start_time: new Date(now - 2 * 864e5).toISOString(), max_start_time: new Date(now + 2 * 864e5).toISOString(), status: "active", sort: "start_time:asc", count: "50" });
    const evRes = await fetch(`${CAL}/scheduled_events?${q.toString()}`, { headers: H });
    if (!evRes.ok) return [];
    const ev = await evRes.json();
    const out = [];
    for (const e of (ev && ev.collection) || []) {
      if (ymdInTZ(e.start_time) !== todayYMD) continue;
      let inviteeName = null;
      try { const iv = await fetch(`${e.uri}/invitees`, { headers: H }); if (iv.ok) { const j = await iv.json(); const f = (j.collection || [])[0]; inviteeName = f ? (f.name || f.email || null) : null; } } catch {}
      const t = timeFromISO(e.start_time);
      out.push({ kind: "meeting", title: inviteeName ? `Meeting: ${inviteeName}` : (e.name || "Meeting"), sub: e.name || "", timeLabel: t.label, sortMin: t.min });
    }
    return out;
  } catch { return []; }
};

const buildToday = async (supabase, todayYMD) => {
  const events = [];
  const add = (ymd, e) => { if (ymd && ymd === todayYMD) events.push({ sortMin: 9999, timeLabel: "", sub: "", ...e }); };

  // Manual events the owner added (calendar_events) — meetings / tasks / reminders
  try {
    const { data } = await supabase.from("calendar_events").select("*").eq("event_date", todayYMD);
    (data || []).forEach((m) => { const t = parseHM(m.event_time); add(m.event_date, { kind: m.kind || "other", title: m.title || "Event", sub: m.note || "", timeLabel: t.label, sortMin: t.min }); });
  } catch (e) { console.error("digest: calendar_events read failed:", e && e.message); }

  // Client billing + contract dates (skip the internal house account)
  try {
    const { data } = await supabase.from("clients").select("id, data");
    (data || []).forEach((row) => {
      const c = row.data || {}; if (c.internal) return;
      if (c.billingStatus === "active" && c.billingNextCharge) {
        add(ymdInTZ(c.billingNextCharge), { kind: "invoice", title: `Invoice — ${c.name}`, sub: "Auto-charges the card on file" });
        add(shiftYMD(c.billingNextCharge, -7), { kind: "review", title: `Review leads — ${c.name}`, sub: "Approve or exclude before the invoice" });
      }
      if (c.contractEnd) {
        add(ymdInTZ(c.contractEnd), { kind: "contract", title: `Contract ends — ${c.name}`, sub: "Renew or offboard" });
        add(shiftYMD(c.contractEnd, -30), { kind: "renewal", title: `Renewal window — ${c.name}`, sub: "~30 days to contract end" });
      }
    });
  } catch (e) { console.error("digest: clients read failed:", e && e.message); }

  // Scheduled content publishing today
  try {
    const { data } = await supabase.from("newsletter_emails").select("subject,status,scheduled_for,sent_at");
    (data || []).forEach((n) => { const when = n.status === "sent" ? n.sent_at : n.scheduled_for; add(ymdInTZ(when), { kind: "newsletter", title: `Newsletter: ${n.subject || "Companion email"}`, sub: n.status === "sent" ? "Sent" : "Scheduled to send" }); });
  } catch (e) { console.error("digest: newsletter read failed:", e && e.message); }
  try {
    const { data } = await supabase.from("blog_posts").select("title,status,published_at");
    (data || []).forEach((p) => add(ymdInTZ(p.published_at), { kind: "blog", title: `Blog: ${p.title || "Post"}`, sub: p.status === "draft" ? "Publishes" : "Published" }));
  } catch (e) { console.error("digest: blog read failed:", e && e.message); }

  // Calendly meetings today (only if a token is configured)
  (await fetchCalendlyToday(todayYMD)).forEach((m) => add(todayYMD, m));

  events.sort((a, b) => (a.sortMin || 9999) - (b.sortMin || 9999));
  return events;
};

const buildEmailHTML = (events, dateLabel) => {
  const rows = events.map((e) => {
    const color = KIND_COLOR[e.kind] || "#8B91B8";
    const time = e.timeLabel ? `<span style="color:${GOLD};font-weight:700">${escapeHTML(e.timeLabel)}</span>&nbsp;&nbsp;` : "";
    const sub = e.sub ? `<div style="font-size:12px;color:#8B91B8;margin-top:2px;line-height:1.45">${escapeHTML(e.sub)}</div>` : "";
    return `<tr><td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06)"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td width="14" valign="top" style="padding-top:6px"><div style="width:8px;height:8px;border-radius:50%;background:${color}"></div></td><td style="padding-left:8px"><div style="font-size:14px;color:#F5F3EA;font-weight:600;line-height:1.4">${time}${escapeHTML(e.title)}</div>${sub}</td></tr></table></td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070810;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto;padding:28px 18px">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:15px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="font-size:12px;color:#8B91B8;margin-top:6px">Your day — ${escapeHTML(dateLabel)}</div>
  </div>
  <div style="background:#0C0D18;border:1px solid rgba(255,255,255,.08);border-top:3px solid ${GOLD};border-radius:14px;padding:6px 18px">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows || `<tr><td style="padding:14px 0;color:#8B91B8;font-size:13px">Nothing scheduled today.</td></tr>`}</table>
  </div>
  <div style="margin-top:16px;font-size:11px;color:#5A6078;text-align:center">Your morning agenda from BoldLine OS. Open the OS Calendar for the full month.</div>
</div></body></html>`;
};

const run = async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 500 });
  const test = new URL(req.url).searchParams.get("test") === "1";
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const todayYMD = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const dateLabel = new Date(todayYMD + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

  const events = await buildToday(supabase, todayYMD);
  const n = events.length;

  if (!n && !test) {
    console.log(`calendar-digest: nothing on ${todayYMD}, no send.`);
    return new Response(JSON.stringify({ ok: true, sent: false, reason: "nothing today", date: todayYMD }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const result = { date: todayYMD, count: n };

  // Email (branded dark agenda)
  if (process.env.RESEND_API_KEY && process.env.REPORTS_FROM_EMAIL && process.env.OWNER_EMAIL) {
    try {
      const textBody = n ? events.map((e) => `${e.timeLabel ? e.timeLabel + " — " : ""}${e.title}${e.sub ? ` (${e.sub})` : ""}`).join("\n") : "Nothing scheduled today.";
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: `${test ? "[TEST] " : ""}Your day — ${n} ${n === 1 ? "thing" : "things"} on the calendar`,
        html: buildEmailHTML(events, dateLabel),
        text: `Your day — ${dateLabel}\n\n${textBody}`,
      });
      result.email = "sent";
    } catch (e) { result.email = "failed"; console.error("calendar-digest email failed:", e && e.message); }
  } else { result.email = "skipped (email not configured)"; }

  // Push (concise) to the phone / installed app
  try {
    const preview = events.slice(0, 3).map((e) => `${e.timeLabel ? e.timeLabel + " " : ""}${e.title}`).join(" · ");
    result.push = await sendPushToAll({
      title: n ? `Today: ${n} on your calendar` : "Nothing on your calendar today",
      body: n ? (preview + (n > 3 ? ` · +${n - 3} more` : "")) : "Enjoy the open day.",
      severity: "yellow",
      url: "/",
    });
  } catch (e) { result.push = "failed"; console.error("calendar-digest push failed:", e && e.message); }

  console.log("calendar-digest:", JSON.stringify(result));
  return new Response(JSON.stringify({ ok: true, sent: true, ...result }), { status: 200, headers: { "content-type": "application/json" } });
};

export default withFailureAlert("calendar-digest", run);
