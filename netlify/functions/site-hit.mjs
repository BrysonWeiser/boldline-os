// Records one page view on a client website (KB `website-builder`). Public, and deliberately quiet:
// it always answers 204, so a missing table or a bad request never shows a visitor an error.
// The page sends { s: siteSlug, p: path, r: referrer, a: 1 if it came from an ad click } as text.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { BOT_UA, sourceOf, deviceOf, visitorHash } from "../lib/site-stats.mjs";

const done = () => new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST" || !process.env.SUPABASE_SERVICE_ROLE_KEY) return done();
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return done();
  let b; try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch { return done(); }
  const slug = String((b && b.s) || "");
  if (!/^[a-z0-9-]{1,80}$/i.test(slug)) return done();
  const path = String(b.p || "/").replace(/[^\w\-/.]/g, "").slice(0, 160) || "/";
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase.from("clients").select("id").eq("data->>landingSlug", slug).maybeSingle();
    if (!data) return done();
    const ip = (req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const host = new URL(req.url).host;
    const { error } = await supabase.from("site_visits").insert({ client_id: data.id, path, source: sourceOf(b.r, host, !!b.a), device: deviceOf(ua), visitor: visitorHash(ip, ua, slug) });
    if (error) console.error("site-hit insert failed:", error.message);
  } catch (e) { console.error("site-hit failed:", e.message); }
  return done();
};
