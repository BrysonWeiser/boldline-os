// The client portal opens on RESULTS (Bryson, 2026-10-07: "do you think we should do anything to
// it" about the portal; agreed: results first, the new look, readable reports).
// What has to stay true:
//  1. A live client opens on their real numbers: leads (from our own log), ad spend and clicks
//     (from the ad account sync), cost per lead worked out from those two, never estimated.
//  2. A client still being set up does not see an empty dashboard; a website-only client never does.
//  3. The month comparison is against the same point last month, so early in a month a good
//     start does not read as a bad month.
//  4. Ad spend is labelled as theirs, paid to the platform (BoldLine never holds ad money).
//  5. Past reports are kept and shown, not just the latest.
//  6. Nothing a client sees carries an emoji or an em dash, and their leads' names are escaped.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const { _internal } = await import("../netlify/functions/portal.mjs");
const { withHistory, REPORT_HISTORY_CAP } = await import("../netlify/lib/report-shared.mjs");
const SRC = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const DAY = 864e5, now = Date.now();
const ago = (d) => new Date(now - d * DAY).toISOString();
const pkg = _internal.findPkg("g-launch");
const lead = (d, extra = {}) => ({ name: "Lead " + d, phone: "(480) 555-0100", receivedAt: ago(d), qualified: true, ...extra });
const live = (extra = {}) => ({
  name: "Desert Gloss", contactName: "Marco Ruiz", packageId: "g-launch", stage: "optimizing", contractStatus: "active", portalToken: "tok",
  leadsLog: [lead(0.2), lead(1), lead(3, { qualified: false }), lead(10), lead(29), lead(31), lead(45)],
  adPerf: { syncedAt: ago(0.1), totals: { spend30d: 500, clicks: 210 } },
  ...extra,
});
const html = (cl) => _internal.makePortalHTML(cl, pkg);
const kpiVals = (h) => [...h.matchAll(/<div class="kpi-v[^"]*">([^<]*)<\/div>/g)].map((m) => m[1]);

// 1. Real numbers
{
  const h = html(live());
  ok("🔴 a live client opens on their results", h.includes('class="kpis"') && h.indexOf('class="kpis"') < h.indexOf("Campaign Progress"));
  const v = kpiVals(h);
  ok("leads in the last 30 days are counted from the log (5 of 7 are inside 30 days)", v[0] === "5", v.join(","));
  ok("and the qualified count is shown under it", /4 counted as qualified/.test(h));
  ok("ad spend is the synced 30-day figure", v[2] === "$500", v[2]);
  ok("🔴 cost per lead is spend divided by leads, worked out not estimated", v[3] === "$100", v[3]);
  ok("under $100 it shows cents", kpiVals(html(live({ adPerf: { totals: { spend30d: 178.5, clicks: 9 } } })))[3] === "$35.70");
  ok("clicks come from the sync", /210 clicks on your ads/.test(h));
  ok("the chart has one bar per day for 30 days", (h.match(/class="bar[ "]/g) || []).length === 30);
  ok("every bar can be read without a mouse", (h.match(/<span class="bar[^>]*tabindex="0"[^>]*aria-label="/g) || []).length === 30);
  ok("the newest leads are on the front page with a way to the full list", /Newest leads/.test(h) && /goTab\('leads'\)/.test(h));
}

// No ad account yet: say so, never show $0 as if it were real
{
  const v = kpiVals(html(live({ adPerf: undefined })));
  const h = html(live({ adPerf: undefined }));
  ok("🔴 with no ad account connected, spend says Not yet, never $0", v[2] === "Not yet" && /Shows once your ad account is connected/.test(h));
  ok("and cost per lead does too", v[3] === "Not yet");
}

// 2. Who sees it
{
  const setup = html({ name: "New Co", contactName: "Ann", packageId: "g-launch", stage: "building", portalToken: "t" });
  ok("a client still being set up does not get an empty dashboard", !setup.includes('class="kpis"'));
  ok("and their screen still leads with their progress", /Here is where your campaign stands today/.test(setup));
  const web = _internal.makePortalHTML({ name: "Site Co", packageId: "w-site", stage: "active", portalToken: "t", leadsLog: [lead(1)] }, null);
  ok("a website-only client never gets the ads dashboard", !web.includes('class="kpis"'));
  ok("once a lead arrives, even a client mid-setup sees their numbers", html({ name: "N", packageId: "g-launch", stage: "building", portalToken: "t", leadsLog: [lead(1)] }).includes('class="kpis"'));
}

// 3. The month comparison
{
  ok("🔴 the month is compared with the same point last month, not all of it", /than this point in /.test(SRC) && !/than all of /.test(SRC));
  ok("the comparison counts only days up to today's date last month", /Number\(k\.slice\(8, 10\)\) <= dom/.test(SRC));
}

// 4. Whose money
{
  ok("🔴 spend is labelled as paid by the client straight to the platform", /Paid by you straight to Google/.test(html(live())));
}

// 5. Report history
{
  const r = (t, at) => ({ period: "weekly", text: "**Summary**\nWeek " + t, sentAt: at });
  ok("a new report goes on top of the history", withHistory({ reportHistory: [r(1, "a")] }, r(2, "b")).map((x) => x.sentAt).join() === "b,a");
  ok("a client from before history existed keeps their latest one", withHistory({ latestReport: r(1, "a") }, r(2, "b")).length === 2);
  ok("the same report is never stored twice", withHistory({ reportHistory: [r(1, "a")] }, r(1, "a")).length === 1);
  ok("history is capped so the record stays small", withHistory({ reportHistory: Array.from({ length: 40 }, (_, i) => r(i, "s" + i)) }, r(99, "new")).length === REPORT_HISTORY_CAP);
  const h = html(live({ reportHistory: [r(3, ago(1)), r(2, ago(8)), r(1, ago(15))] }));
  ok("🔴 the Reports tab shows earlier reports, not only the latest", /Earlier reports/.test(h) && (h.match(/class="rep-old"/g) || []).length === 2);
  ok("the front page previews the latest report in words, not a heading", /class="rep-txt">Week 3</.test(h));
  const shared = readFileSync(join(ROOT, "netlify/lib/report-shared.mjs"), "utf8");
  ok("both the weekly and the monthly report are saved into history", (shared.match(/withHistory\(client,/g) || []).length === 2);
}

// 6. Clean copy, safe output
{
  const h = html(live({ leadsLog: [lead(1, { name: "<img src=x onerror=alert(1)>" })] }));
  ok("🔴 a lead's name cannot inject into the page", !h.includes("<img src=x onerror") && h.includes("&lt;img src=x"));
  const results = h.slice(h.indexOf('class="kpis"'), h.indexOf("Campaign Progress"));
  ok("🔴 no em or en dash in the results a client reads", !/[—–]|&mdash;|&ndash;/.test(results) && !/&ndash;/.test(html(live({ adPerf: undefined })).slice(html(live({ adPerf: undefined })).indexOf("class=\"kpis\""), html(live({ adPerf: undefined })).indexOf("Campaign Progress"))));
  const allowed = new Set(["✓", "✕", "▶", "▾", "▴"]);
  const emoji = [...h].filter((c) => /\p{Extended_Pictographic}/u.test(c) && !allowed.has(c));
  ok("🔴 no emoji anywhere in the portal", emoji.length === 0, emoji.join(" "));
  ok("a call lead says it was a phone call", /Phone call from your ad/.test(html(live({ leadsLog: [lead(1, { source: "call_tracking" })] }))));
  ok("a lead's time is shown in the client's own time zone", /<time data-ts="/.test(h) && /toLocaleString\(\[\],\{month:'short'/.test(SRC));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-portal-results: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
