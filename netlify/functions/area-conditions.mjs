// What is happening in a client's service area, for the OS to SHOW BRYSON while he writes
// copy by hand.
//
// Bryson, 2026-08-20: "for the copy generation whether its the manual or the generated
// variants make sure that also looks at whats going on in the area."
//
// WHY THIS ENDPOINT EXISTS. The weather facts already reached every AI writer through
// `lib/local-conditions.mjs`, but they only ever existed inside a server-side prompt. When
// Bryson typed a headline himself, or edited one the model wrote, he was working from
// memory while the bot was working from data. That is backwards: he is the one making the
// final call on what ships.
//
// So this hands the same facts to the browser, in the same words, with no second source of
// truth to drift. It computes nothing of its own.
//
// READ-ONLY AND OWNER-GATED. It writes nothing and touches no client record. It is gated on
// an owner Supabase session anyway, because it will happily geocode any place name it is
// given and an open endpoint is an open proxy.
//
// POST { locations } or { clientId }
// Env: SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { getLocalConditions } from "../lib/local-conditions.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// The one-line read for a human. The model gets the full block; Bryson gets the point.
// Deliberately says what it means for the ADS rather than reciting the weather, because a
// list of alerts is not a decision and a suggested angle is.
const headline = ({ usable, recentUsable }) => {
  const inAreaNow = usable.filter((a) => a.namesClientArea);
  const inAreaPast = recentUsable.filter((a) => a.namesClientArea && a.days >= 3);
  if (!inAreaNow.length && !inAreaPast.length) return "Nothing notable in their area right now. Write the ad on the offer, not the weather.";
  const bits = [];
  if (inAreaNow.length) bits.push(`Right now: ${inAreaNow.map((a) => a.event).join(", ")}.`);
  if (inAreaPast.length) bits.push(`Recently: ${inAreaPast.map((a) => `${a.event} on ${a.days} of the last ${a.window} days`).join("; ")}.`);
  return bits.join(" ");
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  let locations = String(body.locations || "").trim();
  if (!locations && body.clientId) {
    const { data: row } = await supabase.from("clients").select("data").eq("id", String(body.clientId)).maybeSingle();
    const cl = (row && row.data) || {};
    const cs = cl.campaignSetup || {};
    locations = String(cs.targetLocations || cs.serviceArea || cl.location || "").trim();
  }
  if (!locations) return json({ ok: true, empty: true, reason: "No service area is set for this client yet, so there is nothing to look up." });

  try {
    const cond = await getLocalConditions({ locations });
    return json({
      ok: true,
      locations,
      counties: cond.counties,
      // Only the advertisable ones cross the wire. An excluded emergency must not be
      // rendered next to an ad form where it reads like a suggestion.
      now: cond.usable.map((a) => ({
        event: a.event, severity: a.severity, zones: a.zones,
        inArea: a.namesClientArea, unconfirmed: !!a.unconfirmed, where: a.matchedCities,
      })),
      recent: cond.recentUsable.map((a) => ({
        event: a.event, days: a.days, window: a.window, inAreaDays: a.inAreaDays,
        inArea: a.namesClientArea, unconfirmed: !!a.unconfirmed, where: a.matchedCities,
      })),
      summary: headline(cond),
    });
  } catch (e) {
    console.error("area-conditions failed:", e && e.message);
    return json({ ok: false, error: "Could not read local conditions just now." }, 502);
  }
};
