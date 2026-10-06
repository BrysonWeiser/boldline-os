// Every hour: is every client website that is live on its own address actually up? (KB `website-builder`.)
// A site counts as up when its address answers over https with THIS client's site (the `x-site` header),
// so a domain that lapsed, or DNS someone changed, or a certificate that broke, all show as down.
// Alerts red after two misses in a row (one blip is not worth waking anyone), and says when it is back.
// Also checks the client-websites site itself answers.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { liveDomain, sitesTarget, NETLIFY_TARGET } from "../lib/site-domain.mjs";

export const DOWN_AFTER = 2;

// One site's verdict and what to record. Pure, so the alerting rule is testable.
export function nextUptime(prev, up, now = new Date()) {
  const p = prev || {};
  if (up) {
    const recovered = !!p.alerted;
    return { state: { fails: 0, lastUpAt: now.toISOString() }, alert: recovered ? "up" : null, changed: !!(p.fails || p.alerted) };
  }
  const fails = (p.fails || 0) + 1;
  const shout = fails >= DOWN_AFTER && !p.alerted;
  return { state: { ...p, fails, downSince: p.downSince || now.toISOString(), alerted: p.alerted || shout }, alert: shout ? "down" : null, changed: true };
}

export async function siteIsUp(host, slug, fetchFn = fetch) {
  try {
    const r = await fetchFn(`https://${host}/`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12000) });
    return r.status < 500 && String(r.headers.get("x-site") || "") === String(slug || "");
  } catch { return false; }
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 200 });
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rows = await loadAllClients(supabase, "site-uptime");
  let checked = 0, down = 0;
  for (const r of rows) {
    const cl = { ...(r.data || {}), id: r.id };
    const host = liveDomain(cl);
    if (!host || cl.internal) continue;
    checked++;
    const up = await siteIsUp(host, cl.landingSlug);
    if (!up) down++;
    const d = cl.websiteDeal.domain;
    const v = nextUptime(d.uptime, up);
    if (!v.changed) continue;
    // Written onto a fresh read so nothing saved meanwhile is lost; only websiteDeal.domain.uptime changes.
    const { data: fresh } = await supabase.from("clients").select("data").eq("id", r.id).maybeSingle();
    const base = (fresh && fresh.data) || r.data;
    const fd = (base.websiteDeal || {}).domain;
    if (!fd || fd.host !== host) continue;
    await supabase.from("clients").update({ data: { ...base, websiteDeal: { ...base.websiteDeal, domain: { ...fd, uptime: v.state } } }, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (v.alert === "down") await dispatchAlert({ severity: "red", title: `${cl.name || "A client"}'s website is down`, body: `${host} has not answered with their site for the last two checks (an hour apart). Common causes: their domain renewal lapsed, someone changed its settings, or the hosting is having trouble. Open their Website tab and press Check it now for the details.`, smsText: `${cl.name || "A client"}'s website ${host} is down.` }).catch(() => {});
    if (v.alert === "up") await dispatchAlert({ severity: "green", title: `${cl.name || "A client"}'s website is back`, body: `${host} is answering again.`, smsText: `${host} is back up.` }).catch(() => {});
  }
  // The client-websites site itself, when it exists.
  const target = sitesTarget();
  if (target !== NETLIFY_TARGET) {
    let ok = false;
    try { const h = await fetch(`https://${target}/__health`, { signal: AbortSignal.timeout(12000) }); ok = h.ok; } catch { ok = false; }
    if (!ok) console.error("site-uptime: the client-websites site did not answer its health check");
  }
  const line = `site-uptime: ${checked} live client site(s) checked, ${down} not answering`;
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("site-uptime", handler);
