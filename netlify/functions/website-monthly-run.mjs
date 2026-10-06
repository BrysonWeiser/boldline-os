// Monthly: each live website's client gets a short look at how their site did last month (KB
// `website-builder`). The website twin of the ads clients' monthly report.
//
// Bryson, 2026-10-06: "make sure the website only clients get the automated emails just like ad clients
// do and make sure they are tailored to the website clients". Visitors, page views, enquiries from the
// site, where people came from, and new blog articles, for the calendar month just ended in Arizona.
//
// Runs on the 1st (netlify.toml). Sends once per client per month (`emailAuto.websiteMonthly`), skips a
// site that went live too recently to have a month worth reporting, and sends NOTHING when the visit
// numbers can't be read: a "0 visitors" email that is really a missing table is worse than no email.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { summarize } from "../lib/site-stats.mjs";
import { supabaseStore, loadIndex } from "../lib/site-blog.mjs";
import { termsOf, exempt, isSigned } from "../lib/website-deal.mjs";

const DAY = 864e5;
const MIN_LIVE_DAYS = 14;
// Arizona is UTC-7 all year (no daylight saving), so a Phoenix month starts at 07:00 UTC on the 1st.
const AZ = 7 * 3600e3;

// The Arizona calendar month before `now`: { key: "2026-09", label: "September", from, to } in ms.
export function lastMonth(now = Date.now()) {
  const az = new Date(now - AZ);
  const y = az.getUTCFullYear(), m = az.getUTCMonth();
  const from = Date.UTC(y, m - 1, 1) + AZ, to = Date.UTC(y, m, 1) + AZ;
  const d = new Date(from - AZ);
  return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), from, to };
}

// Plain words for where visitors came from (the same buckets the portal shows).
const SOURCE_WORDS = { Search: "Search engines", Direct: "Typing in your address", Social: "Social media", "Google Ads": "Google Ads", "Other sites": "Links on other websites" };

// Whether this client is owed a summary this month at all (before reading any visits).
export function monthlyEligible(cl, now = Date.now()) {
  const c = cl || {};
  const d = c.websiteDeal || {};
  if (c.internal || exempt(c) || !c.email) return false;
  // 🔴 Only a client who bought the website. Belt and braces: going live already needs it paid in full.
  if (!isSigned(c)) return false;
  if (!(c.website && c.website.published) || !d.launchedAt) return false;
  if (now - Date.parse(d.launchedAt) < MIN_LIVE_DAYS * DAY) return false;
  return (c.emailAuto || {}).websiteMonthly !== lastMonth(now).key;
}

// What the summary says, or null when there is nothing honest to send. Pure, so it is testable.
export function monthlyFor(cl, visits, index, now = Date.now()) {
  const c = cl || {};
  const m = lastMonth(now);
  if (!monthlyEligible(c, now) || !Array.isArray(visits)) return null;
  const days = Math.round((m.to - m.from) / DAY);
  const s = summarize(visits, { now: m.to - 1, days });
  // Nothing honest to say. A brand new site with no traffic yet gets no email rather than a zero.
  if (!s.visitors) return null;
  const inMonth = (iso) => { const t = Date.parse(iso); return t >= m.from && t < m.to; };
  const enquiries = (c.leadsLog || []).filter((l) => l && l.source === "website" && inMonth(l.receivedAt)).length;
  const blog = !!termsOf(c).blog;
  const articles = blog ? (index || []).filter((p) => p && !p.held && inMonth(p.publishAt)).length : null;
  const top = (s.sources[0] || {}).key;
  return {
    key: m.key,
    extra: { month: m.label, visitors: s.visitors, views: s.views, enquiries, topSource: top ? (SOURCE_WORDS[top] || top) : "", blog, articles },
  };
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 200 });
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rows = await loadAllClients(supabase, "website-monthly-run");
  const m = lastMonth();
  const store = supabaseStore(supabase);
  let sent = 0, skipped = 0;
  for (const r of rows) {
    const cl = { ...(r.data || {}), id: r.id };
    // Cheap checks first; the visit read only happens for a client who could get one.
    if (!monthlyEligible(cl)) { skipped++; continue; }
    const { data: visits, error } = await supabase.from("site_visits").select("at,path,source,device,visitor")
      .eq("client_id", r.id).gte("at", new Date(m.from).toISOString()).lt("at", new Date(m.to).toISOString()).limit(20000);
    if (error) { console.error("website-monthly-run: visits read failed:", error.message); skipped++; continue; }
    let index = [];
    if (termsOf(cl).blog) { try { index = await loadIndex(store, r.id); } catch { index = []; } }
    const plan = monthlyFor(cl, visits, index);
    if (!plan) { skipped++; continue; }
    try {
      const res = await autoSendClientEmail(cl, "website_monthly", plan.extra);
      if (!res.sent) { skipped++; continue; }
      sent++;
      const { data: fresh } = await supabase.from("clients").select("data").eq("id", r.id).maybeSingle();
      const base = (fresh && fresh.data) || r.data || {};
      await supabase.from("clients").update({ data: { ...base, emailAuto: { ...(base.emailAuto || {}), websiteMonthly: plan.key }, commLog: [res.logEntry, ...(base.commLog || [])] }, updated_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) { console.error("website-monthly-run:", cl.name, e.message); }
  }
  const line = `website-monthly-run: ${m.key}, ${sent} sent, ${skipped} skipped`;
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("website-monthly-run", handler);
