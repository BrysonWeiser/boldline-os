import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, appendLead } from "../lib/report-shared.mjs";

const xml = (body) => new Response(body, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });

const escXML = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sorry = () =>
  xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number isn't set up to take calls yet. Please try again later.</Say><Hangup/></Response>`);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return sorry();

  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const from = String(params.From || "").slice(0, 50);

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>leadToken", token).maybeSingle();
  if (error) {
    console.error("Call tracking lookup failed:", error);
    return sorry();
  }
  if (!data) return sorry();

  const client = data.data;
  const forwardTo = client.businessPhone;
  if (!forwardTo) return sorry();

  const lead = {
    name: "",
    phone: from,
    email: "",
    message: "Inbound call to tracking number",
    source: "call_tracking",
    receivedAt: new Date().toISOString(),
  };
  try {
    await appendLead(supabaseAdmin, data, lead);
  } catch (err) {
    console.error("Call lead logging failed:", err);
  }

  return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escXML(forwardTo)}</Dial></Response>`);
};
