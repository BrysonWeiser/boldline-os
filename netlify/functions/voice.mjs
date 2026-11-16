import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, appendLead, notifyOwnerOfLead } from "../lib/report-shared.mjs";
import { healthModeOf } from "../lib/health-mode.mjs";

const xml = (body) => new Response(body, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });

const escXML = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sorry = () =>
  xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number isn't set up to take calls yet. Please try again later.</Say><Hangup/></Response>`);

// ── THE WHISPER (Bryson, 2026-11-16, KB springbok-wellness-deal): "make it so she hears 'new patient call from your
// Google ad'". When the business picks up a call to the tracking number, THEY hear one short line before the caller is
// connected; the caller never hears it. So the front desk knows on the spot that this person came from the ads, and
// marks it, instead of matching numbers at the end of the month. On by default; `callWhisper: false` switches it off.
// The words come from a fixed list (never from the request), so nobody can make the number say anything else.
const WHERE = { g: "Google ad", m: "Facebook or Instagram ad", a: "online ad" };
export const whisperKey = (client) => {
  const id = String((client && client.packageId) || "");
  return id.startsWith("g-") ? "g" : id.startsWith("m-") ? "m" : "a";
};
export const whisperText = (key, patient) => `New ${patient ? "patient " : ""}call from your ${WHERE[key] || WHERE.a}.`;
// 🔴 THE CALLER MUST NEVER HEAR THE WHISPER (Bryson, 2026-11-16: "100% guarantee"). Twilio runs a <Number url> "on the
// called party's end, after they answer, but before the parties are connected", to "privately <Say> information to the
// called party". answerOnBridge="true" is what Twilio documents as keeping the CALLER on ringing while that runs, so the
// caller hears only ringing, then the business saying hello. The whisper branch below does no database work, so it
// answers instantly and has nothing that can fail mid-call.
export const dialTwiml = (forwardTo, whisperUrl) => whisperUrl
  ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true"><Number url="${escXML(whisperUrl)}">${escXML(forwardTo)}</Number></Dial></Response>`
  : `<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true">${escXML(forwardTo)}</Dial></Response>`;

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  // Twilio fetches this when the business answers, and plays it to them only.
  if (url.searchParams.get("whisper") === "1") {
    const k = url.searchParams.get("k");
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escXML(whisperText(WHERE[k] ? k : "a", url.searchParams.get("p") === "1"))}</Say></Response>`);
  }

  const token = url.searchParams.get("token");
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
  // Log the call as a lead AND ping the owner with the same branded "New Lead"
  // email a form lead gets. Run both in parallel so the caller isn't kept waiting
  // any longer than one round-trip before the call forwards. (leads+1 so the
  // email's "Lead #N" matches the count appendLead is about to write.)
  const forOwner = { ...client, leads: (client.leads || 0) + 1 };
  await Promise.all([
    appendLead(supabaseAdmin, data, lead).catch((err) => console.error("Call lead logging failed:", err)),
    notifyOwnerOfLead(forOwner, lead).catch((err) => console.error("Call lead owner notify failed:", err)),
  ]);

  const whisperUrl = client.callWhisper === false ? ""
    : `${url.origin}${url.pathname}?whisper=1&k=${whisperKey(client)}&p=${healthModeOf(client).on ? 1 : 0}`;
  return xml(dialTwiml(forwardTo, whisperUrl));
};
