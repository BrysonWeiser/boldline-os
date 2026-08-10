// Public review submission for boldlinemedia.com. A visitor submits a rating +
// review; we store it as status:"pending" (nothing goes public until Bryson
// approves it in the OS Website tab — spam/fake-proof). Mirrors subscribe.mjs /
// audit.mjs: AJAX JSON POST, honeypot, validation, service-role insert, fail-soft.
// Also pings the owner so a pending review never sits unnoticed.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "theboldlinemedia@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const notifyOwner = async ({ name, business, rating, body }) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) return;
  const who = [name, business].filter(Boolean).join(" · ") || "Someone";
  const stars = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "(no rating)";
  const text = `${who} left a ${rating || "?"}/5 review — pending your approval in the OS (Website tab).\n\n${stars}\n\n"${body}"`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL, to: [OWNER_EMAIL], subject: `New review to approve — ${who}`, text }),
    });
  } catch (e) { console.error("review owner ping failed:", e && e.message); }
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }

  // Honeypot: real users never fill the hidden "company" field.
  if (body.company) return json({ ok: true });

  const text = String(body.body || body.review || "").trim();
  if (text.length < 3) return json({ ok: false, error: "Please write a short review." }, 400);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0))) || 0;
  const name = String(body.name || "").trim().slice(0, 120);
  const business = String(body.business || "").trim().slice(0, 160);
  const email = String(body.email || "").trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) return json({ ok: false, error: "Enter a valid email, or leave it blank." }, 400);
  const source = String(body.source || "website").slice(0, 60);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from("reviews").insert({
        name: name || null, business: business || null, rating: rating || null,
        body: text.slice(0, 2000), email: email || null, source, status: "pending",
      });
      if (error) throw error;
    } catch (e) {
      console.error("review submit failed:", e && e.message);
      return json({ ok: false, error: "Couldn't save your review — please try again." }, 500);
    }
  }

  await notifyOwner({ name, business, rating, body: text.slice(0, 600) });

  // Best-effort phone push via the OS push system (the Web Push infra lives on the
  // OS site). Secret-gated with the shared AUDIT_TRIGGER_SECRET; never blocks or
  // fails the visitor's response. If the secret/push aren't set up, the email
  // alert above still covers it.
  if (process.env.AUDIT_TRIGGER_SECRET) {
    const osOrigin = process.env.OS_ORIGIN || "https://boldlinemedia.netlify.app";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      await fetch(`${osOrigin}/.netlify/functions/review-notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: process.env.AUDIT_TRIGGER_SECRET, name, business, rating }),
        signal: ctrl.signal,
      }).catch(() => {});
      clearTimeout(timer);
    } catch { /* fire-and-forget */ }
  }

  return json({ ok: true });
};
