// Newsletter / email-list signup endpoint for boldlinemedia.com.
// Called via fetch() from the signup forms (homepage footer + blog pages).
//
// Two things happen, both best-effort and independent so one failing never
// blocks the other:
//   1. The email is added to Resend's account-level Contacts (POST /contacts) —
//      the dashboard shows them all under "Audience". Newer Resend accounts no
//      longer scope contacts to an audience_id, so only RESEND_API_KEY (already
//      set on the marketing site) is needed — no extra config. Adding contacts
//      works WITHOUT a verified domain; only SENDING broadcasts later needs the
//      domain verified.
//   2. A durable backup row is written to the existing website_leads table
//      (form:"newsletter") via the service-role key, so a subscriber is never
//      lost even if the Resend add fails. The OS filters these out of the
//      sales-Leads list.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const addToResendContacts = async (email) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "not-configured";
  const res = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    // A repeat email returns an error — treat "already exists" as success.
    if (/already exists|duplicate/i.test(body)) return "already";
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  return "added";
};

const backupToDB = async (email, source) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "no-db";
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // Idempotent-ish: skip if this email is already a newsletter row.
  const { data: existing } = await supabase
    .from("website_leads").select("id").eq("form", "newsletter").eq("email", email).limit(1);
  if (existing && existing.length) return "already";
  const { error } = await supabase.from("website_leads").insert({
    form: "newsletter", email, payload: { source: source || "website" },
  });
  if (error) throw error;
  return "saved";
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }

  // Honeypot: real users never fill the hidden "company" field.
  if (body.company) return json({ ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "Please enter a valid email address." }, 400);
  const source = String(body.source || "website").slice(0, 60);

  const results = await Promise.allSettled([addToResendContacts(email), backupToDB(email, source)]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`subscribe ${i === 0 ? "Resend" : "DB"} failed:`, r.reason && r.reason.message);
    else console.log(`subscribe ${i === 0 ? "Resend" : "DB"}:`, r.value);
  });

  // As long as the address is valid we tell the visitor they're in — the backup
  // row (or the Resend add) captures them; a rare double-failure is logged.
  return json({ ok: true });
};
