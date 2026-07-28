// Suspicious-login alert (Bryson, 2026-07-27): email an alert when the OS is
// signed into from a country/region it's never been signed into before.
//
// Called fire-and-forget by the OS right after a successful password sign-in.
// Uses Netlify's edge geolocation (context.geo) — no external geo-IP service.
// Compares the current sign-in's country+region to the history in login_events;
// a never-before-seen combo fires dispatchAlert (email; SMS is gated off).
// Fails soft: if the login_events table doesn't exist yet, it no-ops.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert } from "../lib/alerts-shared.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

const readGeo = (req, context) => {
  const g = context && context.geo;
  if (g && (g.city || g.country)) {
    return { city: g.city || null, region: (g.subdivision && g.subdivision.name) || null, country: (g.country && (g.country.name || g.country.code)) || null };
  }
  // Fallback: Netlify's x-nf-geo header (base64 JSON).
  try {
    const raw = req.headers.get("x-nf-geo");
    if (raw) { const d = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); return { city: d.city || null, region: (d.subdivision && d.subdivision.name) || null, country: (d.country && (d.country.name || d.country.code)) || null }; }
  } catch { /* ignore */ }
  return { city: null, region: null, country: null };
};
const readIP = (req, context) => (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "";

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, skipped: "no db" }, 200);

  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ ok: false, error: "not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "invalid session" }, 401);

  const geo = readGeo(req, context);
  const ip = readIP(req, context);
  const key = `${geo.country || "?"}|${geo.region || "?"}`;

  try {
    const { data: prior, error } = await supabase
      .from("login_events").select("country, region").order("created_at", { ascending: false }).limit(300);
    if (error) throw error;

    const seen = new Set((prior || []).map((r) => `${r.country || "?"}|${r.region || "?"}`));
    const firstEver = !prior || prior.length === 0; // baseline: don't alert on the very first recorded sign-in
    const isNew = !firstEver && !seen.has(key);

    await supabase.from("login_events").insert({ ip, city: geo.city, region: geo.region, country: geo.country, is_new_location: isNew });

    if (isNew) {
      const where = [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "an unrecognized location";
      await dispatchAlert({
        title: "New sign-in location for BoldLine OS",
        body: `A sign-in to your BoldLine OS just came from a location it hasn't been used from before:\n${where}${ip ? ` (IP ${ip})` : ""}.\nIf this was you, you can ignore this. If it wasn't, change your BoldLine OS password right away.`,
        severity: "red",
        smsText: `BoldLine: new sign-in from ${[geo.city, geo.country].filter(Boolean).join(", ") || "a new location"}. Not you? Change your password.`,
      });
    }
    return json({ ok: true, newLocation: isNew });
  } catch (e) {
    // Most likely the login_events table isn't created yet — no-op rather than break sign-in.
    console.error("login-watch (soft-fail):", e && e.message);
    return json({ ok: true, skipped: true });
  }
};
