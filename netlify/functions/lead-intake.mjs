import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, escapeHTML, GOLD } from "../lib/report-shared.mjs";

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

const notifyOwner = async (client, lead) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) return;
  const rows = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Source", lead.source],
    ["Message", lead.message],
  ].filter(([, v]) => v);
  const rowsHTML = rows
    .map(([k, v]) => `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;letter-spacing:.05em;color:#9CA3AF;text-transform:uppercase">${escapeHTML(k)}</div><div style="font-size:14px;color:#1F2937;margin-top:2px">${escapeHTML(String(v))}</div></div>`)
    .join("") || `<div style="font-size:13px;color:#6B7280">No details were sent with this lead.</div>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">New Lead — ${escapeHTML(client.name)}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:22px 22px">${rowsHTML}</div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Lead #${client.leads} for ${escapeHTML(client.name)}. Logged automatically by BoldLine OS.</div>
</div>
</body></html>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") || "No details were sent with this lead.";
  try {
    await sendEmail({ to: process.env.OWNER_EMAIL, subject: `New Lead — ${client.name}`, html, text });
  } catch (err) {
    console.error("Lead notification email failed:", err);
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

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>leadToken", token).maybeSingle();

  if (error) {
    console.error("Lead intake lookup failed:", error);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "Invalid token" }, 404);

  const client = data.data;
  const entry = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    note: `New lead: ${lead.name || "Unknown"}${lead.source !== "unknown" ? ` (${lead.source})` : ""}`,
    cat: "update",
    ts: Date.now(),
  };
  const nextData = {
    ...client,
    leads: (client.leads || 0) + 1,
    leadsLog: [lead, ...(client.leadsLog || [])],
    commLog: [entry, ...(client.commLog || [])],
  };

  const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (updateError) {
    console.error("Lead intake save failed:", updateError);
    return json({ ok: false, error: "save failed" }, 500);
  }

  await notifyOwner(nextData, lead);

  return json({ ok: true }, 200);
};
