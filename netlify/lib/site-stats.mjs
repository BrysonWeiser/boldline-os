// Visitor numbers for client websites: what to record, and how to sum it up (KB `website-builder`).
//
// 🔴 Nothing personal is kept: no cookie, no IP, no fingerprint. `visitorHash` changes every day.

import crypto from "node:crypto";

export const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|monitor|curl|wget|python|java\/|httpclient/i;

export function sourceOf(referrer, siteHost, adClick) {
  if (adClick) return "Google Ads";
  let host = "";
  try { host = new URL(String(referrer || "")).hostname.replace(/^www\./, ""); } catch { host = ""; }
  if (!host) return "Direct";
  if (siteHost && host === String(siteHost).replace(/^www\./, "")) return "Internal";
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./.test(host)) return "Search";
  if (/(^|\.)(facebook|fb|instagram|t|x|twitter|linkedin|tiktok|pinterest|nextdoor|youtube|reddit)\.(com|co|me)$/.test(host) || host === "l.facebook.com" || host === "lm.facebook.com") return "Social";
  return "Other sites";
}

export const deviceOf = (ua) => (/ipad|tablet/i.test(ua || "") ? "tablet" : /mobi|iphone|android/i.test(ua || "") ? "mobile" : "desktop");

export const visitorHash = (ip, ua, slug, now = new Date(), salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "") =>
  crypto.createHash("sha256").update(`${ip}|${ua}|${now.toISOString().slice(0, 10)}|${slug}|${salt}`).digest("hex").slice(0, 16);

const dayKey = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

// Rows in, the portal's numbers out. `days` days ending today (Phoenix), every day present (zeros too).
export function summarize(rows, { now = Date.now(), days = 30 } = {}) {
  const from = now - days * 864e5;
  const list = (rows || []).filter((r) => r && Date.parse(r.at) >= from && Date.parse(r.at) <= now);
  const byDay = [];
  for (let i = days - 1; i >= 0; i--) byDay.push({ day: dayKey(now - i * 864e5), views: 0, visitors: new Set() });
  const idx = Object.fromEntries(byDay.map((d, i) => [d.day, i]));
  const pages = {}, sources = {}, devices = { mobile: 0, tablet: 0, desktop: 0 };
  const people = new Set();
  for (const r of list) {
    const d = idx[dayKey(Date.parse(r.at))];
    if (d != null) { byDay[d].views++; if (r.visitor) byDay[d].visitors.add(r.visitor); }
    if (r.visitor) people.add(`${dayKey(Date.parse(r.at))}:${r.visitor}`);
    pages[r.path || "/"] = (pages[r.path || "/"] || 0) + 1;
    // A click from one page of their site to another is a page view, not a new arrival.
    if (r.source !== "Internal") sources[r.source || "Direct"] = (sources[r.source || "Direct"] || 0) + 1;
    if (devices[r.device] != null) devices[r.device]++;
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, n: v }));
  return {
    views: list.length,
    visitors: people.size,
    byDay: byDay.map((d) => ({ day: d.day, views: d.views, visitors: d.visitors.size })),
    pages: top(pages, 6), sources: top(sources, 6), devices,
  };
}
