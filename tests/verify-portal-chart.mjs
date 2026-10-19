// The portal's results chart: "how is it going" must be readable in one glance. KB `portal-chart`.
// Run: node tests/verify-portal-chart.mjs
// Bryson, 2026-10-19: "can we make sure the the bar graph and any graphs we use can clearly display data that way a
// client can see how things are going based on a quick glance from the graph".
import { weeklySeries, weeklyVerdict, weeklyChartHTML, niceMax, WEEKLY_CHART_CSS } from "../netlify/lib/portal-chart.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const DAY = 864e5, NOW = Date.UTC(2026, 9, 19, 18, 0);
const at = (d) => ({ receivedAt: new Date(NOW - d * DAY).toISOString() });
const leads = (...days) => days.map(at);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const html = (list, extra = {}) => weeklyChartHTML({ dated: list, nowMs: NOW, esc, ...extra });
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// ── 1. Weeks, newest last ────────────────────────────────────────────────────
{
  const w = weeklySeries(leads(0.5, 1, 6.9, 7.1, 13, 50), NOW);
  ok("eight weeks when there is that much history", w.length === 8, String(w.length));
  ok("the newest week is the last 7 days", w[w.length - 1].n === 3 && w[w.length - 2].n === 2);
  ok("🔴 a client three weeks in sees no empty history before they started (minimum four weeks)", weeklySeries(leads(1, 9, 16), NOW).length === 4);
  ok("a client with nothing yet still gets a four week frame", weeklySeries([], NOW).length === 4);
  ok("a lead dated in the future is never counted", weeklySeries([{ receivedAt: new Date(NOW + DAY).toISOString() }], NOW).every((x) => x.n === 0));
}

// ── 2. The written answer ────────────────────────────────────────────────────
{
  const up = html(leads(1, 2, 3, 9));
  ok("🔴 up says Up, with the arrow and both numbers", /wk-up/.test(up) && /&#9650;/.test(up) && /3 leads in the last 7 days, up from 1 the week before\./.test(text(up)));
  const down = html(leads(1, 8, 9, 10));
  ok("🔴 down says Down, never dressed up", /wk-down/.test(down) && /1 lead in the last 7 days, down from 3 the week before\./.test(text(down)));
  ok("level says so", /wk-level/.test(html(leads(1, 8))) && /the same as the week before/.test(text(html(leads(1, 8)))));
  ok("nothing yet says so, with no arrow", /No leads yet/.test(text(html([]))) && !/wk-dir/.test(html([])));
  ok("the client's own word is used (sales for a shop)", /2 sales in the last 7 days/.test(text(html(leads(1, 2), { noun: "sale", nouns: "sales", Nouns: "Sales" }))));
  ok("🔴 status is never colour alone: arrow + word", weeklyVerdict(weeklySeries(leads(1), NOW)).dir === "up" && /<span class="wk-ic" aria-hidden="true">&#9650;<\/span>Up/.test(html(leads(1))));
}

// ── 3. The picture ───────────────────────────────────────────────────────────
{
  const h = html(leads(1, 2, 3, 8, 15, 15, 15, 15, 15, 22));
  ok("the latest week is the highlighted one", (h.match(/class="bar[^"]*now/g) || []).length === 1 && /class="bar now"[^>]*>(<b[^>]*>3<\/b>)?<i class="wk-x">This week/.test(h));
  ok("🔴 selective labels: only the latest week and the best week carry a number", (h.match(/class="wk-v"/g) || []).length === 2 && />5<\/b>/.test(h) && />3<\/b>/.test(h));
  ok("a real scale: gridlines at 0, the middle and a round top", /<em>0<\/em>/.test(h) && /<em>3<\/em>/.test(h) && /<em>6<\/em>/.test(h));
  ok("their weekly average is drawn and named in the key", /class="wk-avg"/.test(h) && /Your weekly average: 2\.5/.test(text(h)));
  ok("every bar can be read without a mouse", (h.match(/<span class="bar[^>]*tabindex="0"[^>]*aria-label="[^"]+: \d+ leads?"/g) || []).length === 4);
  ok("and the full numbers are one tap away as a table", /<details class="wk-tbl"><summary>See the numbers<\/summary><table>/.test(h) && (h.match(/<tr><td>/g) || []).length === 4);
  ok("the chart describes itself to a screen reader", /role="img" aria-label="Leads per week, last 4 weeks\. 3 leads in the last 7 days, up from 1 the week before\. Weekly average 2\.5\."/.test(h));
  ok("round tops", [niceMax(0), niceMax(3), niceMax(5), niceMax(7), niceMax(11), niceMax(37), niceMax(130)].join(",") === "4,4,6,8,12,40,150");
  ok("🔴 nothing a client reads has an emoji or a dash", !/\p{Extended_Pictographic}/u.test(text(h) + WEEKLY_CHART_CSS) && !/[—–]/.test(h));
  ok("the colours are the validated pair (gold this week, grey before)", /\.wk \.bar::before\{background:#5F6474/.test(WEEKLY_CHART_CSS) && /\.wk \.bar\.now::before\{background:linear-gradient\(180deg,#F0D27A,#E8C96A\)/.test(WEEKLY_CHART_CSS));
}

console.log(`verify-portal-chart: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
