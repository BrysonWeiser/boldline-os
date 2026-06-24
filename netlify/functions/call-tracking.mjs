import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const twilioAuth = () => "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token) return json({ ok: false, error: "Missing token" }, 400);
  if (action !== "provision" && action !== "release") return json({ ok: false, error: "Invalid action" }, 400);

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const siteUrl = process.env.URL;
  if (!sid || !authToken) return json({ ok: false, error: "Twilio is not connected yet." }, 503);

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>portalToken", token).maybeSingle();
  if (error) {
    console.error("Call tracking lookup failed:", error);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "Invalid token" }, 404);

  const client = data.data;

  if (action === "release") {
    if (!client.callTrackingNumberSid) return json({ ok: false, error: "No tracking number to release" }, 400);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${client.callTrackingNumberSid}.json`, {
      method: "DELETE",
      headers: { Authorization: twilioAuth() },
    });
    if (!res.ok && res.status !== 404) {
      const errBody = await res.text();
      console.error("Twilio release failed:", errBody);
      return json({ ok: false, error: "Failed to release number" }, 502);
    }
    const nextData = { ...client, callTrackingNumber: "", callTrackingNumberSid: "" };
    const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updateError) {
      console.error("Call tracking release save failed:", updateError);
      return json({ ok: false, error: "save failed" }, 500);
    }
    return json({ ok: true, callTrackingNumber: "" }, 200);
  }

  // action === "provision"
  if (!siteUrl) return json({ ok: false, error: "Site URL is not configured" }, 500);
  if (client.callTrackingNumber) return json({ ok: false, error: "This client already has a tracking number" }, 400);
  if (!client.leadToken) return json({ ok: false, error: "Client is missing a lead token" }, 400);

  let body = {};
  try { body = JSON.parse(await req.text() || "{}"); } catch {}
  const areaCode = String(body.areaCode || "").replace(/\D/g, "").slice(0, 3);

  const searchUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json`);
  if (areaCode) searchUrl.searchParams.set("AreaCode", areaCode);
  searchUrl.searchParams.set("PageSize", "1");

  const searchRes = await fetch(searchUrl, { headers: { Authorization: twilioAuth() } });
  if (!searchRes.ok) {
    const errBody = await searchRes.text();
    console.error("Twilio number search failed:", errBody);
    return json({ ok: false, error: "Number search failed" }, 502);
  }
  const searchData = await searchRes.json();
  const found = (searchData.available_phone_numbers || [])[0];
  if (!found) return json({ ok: false, error: areaCode ? `No numbers available in area code ${areaCode}` : "No numbers available right now" }, 404);

  const voiceUrl = `${siteUrl}/.netlify/functions/voice?token=${encodeURIComponent(client.leadToken)}`;
  const purchaseRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ PhoneNumber: found.phone_number, VoiceUrl: voiceUrl, FriendlyName: `${client.name} — call tracking` }),
  });
  if (!purchaseRes.ok) {
    const errBody = await purchaseRes.text();
    console.error("Twilio purchase failed:", errBody);
    return json({ ok: false, error: "Failed to purchase number" }, 502);
  }
  const purchased = await purchaseRes.json();

  const nextData = { ...client, callTrackingNumber: purchased.phone_number, callTrackingNumberSid: purchased.sid };
  const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (updateError) {
    console.error("Call tracking save failed:", updateError);
    return json({ ok: false, error: "save failed" }, 500);
  }

  return json({ ok: true, callTrackingNumber: purchased.phone_number }, 200);
};
