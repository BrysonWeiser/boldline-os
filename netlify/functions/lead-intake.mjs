import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, sendSMS, appendLead, leadEmailHTML, notifyOwnerOfLead } from "../lib/report-shared.mjs";
import { forwardLead, forwardResult } from "../lib/crm-forward.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS_HEADERS } });

const parseBody = async (req) => {
  const contentType = req.headers.get("content-type") || "";
  const raw = await req.text();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

// Speed-to-lead matters most in the first few minutes, so reply immediately
// rather than waiting for the nurture cron — branded as the client's
// business, since this goes straight to their customer.
const notifyLead = async (client, lead) => {
  const firstName = lead.name ? lead.name.trim().split(/\s+/)[0] : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const phoneLine = client.businessPhone ? ` Need something faster? Call us anytime at ${client.businessPhone}.` : "";
  const body = `${greeting} thanks for reaching out to ${client.name}! We got your message and will be in touch shortly.${phoneLine}`;

  if (lead.phone) {
    try {
      await sendSMS({ to: lead.phone, body: body.slice(0, 320) });
    } catch (err) {
      console.error("Lead auto-reply SMS failed:", err);
    }
  }
  if (lead.email) {
    try {
      await sendEmail({ to: lead.email, subject: `Thanks for reaching out to ${client.name}`, html: leadEmailHTML(client, body), text: body });
    } catch (err) {
      console.error("Lead auto-reply email failed:", err);
    }
  }
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return json({ ok: false, error: "Missing token" }, 400);

  const body = await parseBody(req);
  const lead = {
    name: String(body.name || "").slice(0, 200),
    phone: String(body.phone || "").slice(0, 50),
    email: String(body.email || "").slice(0, 200),
    message: String(body.message || "").slice(0, 2000),
    source: String(body.source || "unknown").slice(0, 100),
    receivedAt: new Date().toISOString(),
  };

  // 🔴 THE CLICK ID, CAPTURED AT THE ONLY MOMENT IT EXISTS. Google can only credit a sale
  // back to the ad that caused it if the lead carries the identifier from that click. It
  // lives in the landing page's URL and is gone the moment the visitor navigates away,
  // yet nobody will know whether this lead was any good for another week or two. So it is
  // stored now and used later by the offline upload. `wbraid` and `gbraid` are what
  // Google sends instead when the browser blocks the usual one, mostly on iPhones.
  // Anything not in this list is ignored: this endpoint is public, so it accepts only the
  // fields it knows.
  for (const k of ["gclid", "wbraid", "gbraid"]) {
    const v = String(body[k] || "").trim().slice(0, 200);
    if (v) lead[k] = v;
  }
  // When the click happened, which decides whether it is still inside Google's 90 day
  // matching window at upload time. Never trusted forward of now: a bad clock on a
  // visitor's phone must not make a lead look newer than it is.
  const clickAt = Date.parse(String(body.clickAt || ""));
  if (clickAt && clickAt <= Date.now()) lead.clickAt = new Date(clickAt).toISOString();

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>leadToken", token).maybeSingle();

  if (error) {
    console.error("Lead intake lookup failed:", error);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "Invalid token" }, 404);

  let nextData;
  try {
    nextData = await appendLead(supabaseAdmin, data, lead);
  } catch (err) {
    console.error("Lead intake save failed:", err);
    return json({ ok: false, error: "save failed" }, 500);
  }

  // 🔴 THE LEAD IS SAVED BEFORE ANY OF THIS RUNS, AND THAT ORDER IS THE POINT. Everything
  // below is delivery: our alert, the customer's auto-reply, and the client's own CRM. Any
  // of the three can fail without costing anybody a lead, because the lead is already on
  // the record with its click id attached.
  //
  // The CRM forward exists because a client's follow-up automation is worth more than
  // anything we would bolt on (Shaun Smith, 2026-08-25: an ad lead answered within a
  // minute or two converts far better). It could NOT simply replace this endpoint: the
  // click id is captured here, and without it an order weeks later can never be credited
  // back to the search that produced it. So the lead lands here first and goes onward
  // second. See ../lib/crm-forward.mjs.
  const [, , crm] = await Promise.all([
    notifyOwnerOfLead(nextData, lead),
    notifyLead(nextData, lead),
    forwardLead(nextData, lead).catch((e) => {
      console.error("CRM forward threw:", e && e.message);
      return forwardResult({ ok: false, error: String((e && e.message) || e) });
    }),
  ]);

  // Record the outcome ON THE LEAD, so a CRM that quietly stopped accepting leads shows up
  // on the row in the OS instead of living in a log nobody reads. Best-effort: the lead is
  // already safe, and failing the request now would tell the visitor their enquiry did not
  // send when it did.
  if (crm) {
    try {
      const log = (nextData.leadsLog || []).slice();
      // `appendLead` puts the new lead at the front, so index 0 is it. Matched on the
      // timestamp rather than trusted blindly, because a wrong index would stamp the
      // result onto somebody else's lead.
      const i = (log[0] && log[0].receivedAt === lead.receivedAt)
        ? 0
        : log.findIndex((l) => l && l.receivedAt === lead.receivedAt);
      if (i >= 0) {
        log[i] = { ...log[i], crm };
        await supabaseAdmin.from("clients")
          .update({ data: { ...nextData, leadsLog: log }, updated_at: new Date().toISOString() })
          .eq("id", data.id);
      }
      if (!crm.ok) console.error(`CRM forward failed for ${nextData.name}:`, crm.error);
    } catch (e) { console.error("Could not record the CRM result:", e && e.message); }
  }

  return json({ ok: true }, 200);
};
