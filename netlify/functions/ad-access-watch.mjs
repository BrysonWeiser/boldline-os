// Has the client accepted our access yet? (KB ad-account-link)
//
// Bryson, 2026-10-21: "make sure that it's very clear that the client has to accept the request after they put their
// number in". The portal tells the client; this job is the other half. Every 15 minutes it looks at each client who
// is waiting on a Google manager request or a Meta partner share, plus a once-a-day look at everyone already
// connected (a client can remove our access without telling us), saves what changed and tells Bryson:
//   green  "accepted Google access" / "shared their Meta ad account"   (he can launch)
//   amber  "removed ... access" / "request was declined"               (their portal already asks them to fix it)
// The portal's own page load only LOOKS (the OS preview loads it), so this is the one place the answer is written.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { isHouse } from "../lib/owned.mjs";
import { observeAccess, liveAccessApi, googleNeedsCheck, metaNeedsCheck } from "../lib/ad-link.mjs";

const phxDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });

export async function runAccessWatch(supabase, rows, api, { now = Date.now(), alert = dispatchAlert } = {}) {
  let looked = 0, saved = 0, told = 0;
  for (const r of rows) {
    const cl = { ...(r.data || {}) };
    if (isHouse(cl) || (!googleNeedsCheck(cl, now) && !metaNeedsCheck(cl, now))) continue;
    looked++;
    const o = await observeAccess(cl, api, { timeoutMs: 12000, now });
    if (!o.dirty && !o.alerts.length) continue;
    // Re-read before writing, and only touch the two access records: the client may have saved their portal (or
    // Bryson the OS) in the seconds this took.
    const { data: fresh } = await supabase.from("clients").select("data").eq("id", r.id).maybeSingle();
    const base = (fresh && fresh.data) || r.data;
    const next = { ...base };
    if (o.google && String(base.googleAdsCustomerId || "").replace(/\D/g, "") === o.google.id) next.googleLinkRequest = o.google;
    if (o.meta && String(base.metaAdAccountId || "").replace(/\D/g, "") === o.meta.adAccountId) next.metaAccess = o.meta;
    const at = new Date(now).toISOString();
    if (o.alerts.length) next.commLog = [...o.alerts.map((a) => ({ date: phxDate(at), note: a.body, cat: "update", ts: now })), ...(base.commLog || [])].slice(0, 200);
    await supabase.from("clients").update({ data: next, updated_at: at }).eq("id", r.id);
    saved++;
    for (const a of o.alerts) { try { await alert({ ...a, smsText: a.title }); told++; } catch (e) { console.error("ad-access-watch: alert failed:", e.message); } }
  }
  return { looked, saved, told };
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 200 });
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rows = await loadAllClients(supabase, "ad-access-watch");
  const res = await runAccessWatch(supabase, rows, liveAccessApi());
  const line = `ad-access-watch: looked at ${res.looked} client(s), saved ${res.saved}, sent ${res.told} alert(s)`;
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("ad-access-watch", handler);
