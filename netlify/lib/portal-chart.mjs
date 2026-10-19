// The results chart on the client portal: answer "how is it going?" in one glance (KB `portal-chart`).
//
// Bryson, 2026-10-19: "can we make sure the the bar graph and any graphs we use can clearly display data that way a
// client can see how things are going based on a quick glance from the graph".
//
// The 7 Oct chart had 30 daily bars. For a clinic getting a lead or two a day that is a comb of 0s, 1s and 2s with
// no axis: you could not tell from it whether things were getting better. So:
//  1. WEEKS, NOT DAYS. Eight rolling 7-day weeks ending today. Small daily counts become a shape you can read.
//  2. THE ANSWER IS WRITTEN ABOVE IT. "Up / Down / Level" with an arrow and the two numbers, so nobody has to work
//     out the trend from bar heights. Arrow + word + colour, never colour alone.
//  3. EMPHASIS, NOT DECORATION. The latest week is gold, earlier weeks are grey, so "this week against before" is the
//     first thing the eye lands on. A dashed line marks their weekly average: above it is a good week.
//  4. A REAL SCALE. Gridlines with numbers at 0, the middle and the top (a round number), so heights mean something.
//  5. SELECTIVE LABELS. The latest week and the best week carry their number; every bar has a tap/hover tip and is
//     focusable, and "See the numbers" opens the full table.
//  6. NO EMPTY HISTORY. Weeks before their first enquiry are left off (minimum four), so a client in their third
//     week does not see five flat bars that read as failure.
// Colours checked with the dataviz validator on the portal's dark panel (#0E1018): gold #E8C96A against grey
// #5F6474, delta E 36.9 normal vision, 35.0 worst colour-blind, both above 3:1 contrast.

const DAY = 864e5;
const WEEKS = 8, MIN_WEEKS = 4;

export const phxDay = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
const short = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" });

// A round top for the scale so the gridline numbers are whole and easy to read.
export function niceMax(peak) {
  const p = Math.max(1, Math.ceil(Number(peak) || 0));
  if (p <= 4) return 4;
  for (const st of [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) {
    const m = Math.ceil(p / st) * st;
    if (m / st <= 6 && m % 2 === 0) return m;
  }
  return Math.ceil(p / 10000) * 10000;
}

// Weeks newest last. Week i covers [end - 7 days, end), end stepping back from now.
export function weeklySeries(dated, nowMs = Date.now()) {
  const times = (dated || []).map((l) => new Date(l && l.receivedAt).getTime()).filter((t) => Number.isFinite(t) && t <= nowMs);
  const weeks = [];
  for (let k = WEEKS - 1; k >= 0; k--) {
    const end = nowMs - k * 7 * DAY, start = end - 7 * DAY;
    weeks.push({ start, end, n: times.filter((t) => t >= start && t < end).length });
  }
  const first = times.length ? Math.min(...times) : null;
  const firstIdx = first == null ? WEEKS : weeks.findIndex((w) => w.end > first);
  return weeks.slice(Math.min(Math.max(0, firstIdx), WEEKS - MIN_WEEKS));
}

export function weeklyVerdict(weeks) {
  const a = weeks.length ? weeks[weeks.length - 1].n : 0, b = weeks.length > 1 ? weeks[weeks.length - 2].n : 0;
  const dir = a > b ? "up" : a < b ? "down" : "level";
  return { a, b, dir };
}

export function weeklyChartHTML({ dated, nowMs = Date.now(), noun = "lead", nouns = "leads", Nouns = "Leads", esc = (s) => String(s) }) {
  const weeks = weeklySeries(dated, nowMs);
  const total = weeks.reduce((s, w) => s + w.n, 0);
  const { a, b, dir } = weeklyVerdict(weeks);
  const n = (x) => `${x} ${x === 1 ? noun : nouns}`;
  const top = niceMax(Math.max(...weeks.map((w) => w.n)));
  const avg = weeks.length ? total / weeks.length : 0;
  const avgTxt = avg >= 10 ? String(Math.round(avg)) : String(Math.round(avg * 10) / 10);
  const peakN = Math.max(...weeks.map((w) => w.n));
  const peakIdx = peakN > 0 ? weeks.map((w) => w.n).lastIndexOf(peakN) : -1;
  const last = weeks.length - 1;
  const range = (w) => `${short(w.start)} to ${short(w.end - 1)}`;

  const icon = { up: "&#9650;", down: "&#9660;", level: "&#9679;" }[dir];
  const word = { up: "Up", down: "Down", level: "Level" }[dir];
  const line = total === 0
    ? `No ${nouns} yet. Your first ones will show here.`
    : dir === "up" ? `${n(a)} in the last 7 days, up from ${b} the week before.`
    : dir === "down" ? `${n(a)} in the last 7 days, down from ${b} the week before.`
    : `${n(a)} in the last 7 days, the same as the week before.`;
  const verdict = total === 0 ? "" : `<span class="wk-dir wk-${dir}"><span class="wk-ic" aria-hidden="true">${icon}</span>${word}</span>`;

  const bars = weeks.map((w, i) => {
    const h = w.n ? Math.max(3, Math.round((w.n / top) * 100)) : 0;
    const label = i === last ? "This week" : short(w.start);
    const tip = `${range(w)}: ${n(w.n)}`;
    const showV = w.n > 0 && (i === last || i === peakIdx);
    return `<span class="bar${w.n ? "" : " z"}${i === last ? " now" : ""}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}" style="--h:${h}%">`
      + (showV ? `<b class="wk-v" style="bottom:calc(${h}% + 6px)">${w.n}</b>` : "")
      + `<i class="wk-x">${esc(label)}</i></span>`;
  }).join("");

  const grid = [0, top / 2, top].map((v) => `<span class="wk-g" style="bottom:${(v / top) * 100}%"><em>${Number.isInteger(v) ? v : v.toFixed(1)}</em></span>`).join("")
    + (total > 0 ? `<span class="wk-avg" style="bottom:${(avg / top) * 100}%"></span>` : "");

  const table = `<details class="wk-tbl"><summary>See the numbers</summary><table><thead><tr><th scope="col">Week</th><th scope="col">${esc(Nouns)}</th></tr></thead><tbody>`
    + weeks.slice().reverse().map((w, i) => `<tr><td>${i === 0 ? "Last 7 days" : esc(range(w))}</td><td>${w.n}</td></tr>`).join("")
    + "</tbody></table></details>";

  return `<div class="card cwide wk-card"><div class="ch-head"><div><div class="lbl">${esc(Nouns)} per week</div>`
    + `<div class="wk-line">${verdict}<span>${esc(line)}</span></div></div></div>`
    + `<div class="wk-wrap"><div class="wk-grid" aria-hidden="true">${grid}</div>`
    + `<div class="ch wk" role="img" aria-label="${esc(Nouns)} per week, last ${weeks.length} weeks. ${esc(line)} Weekly average ${esc(avgTxt)}.">${bars}</div></div>`
    + `<div class="wk-key"><span><i class="sw now"></i>This week</span><span><i class="sw"></i>Earlier weeks</span>${total > 0 ? `<span><i class="sw avg"></i>Your weekly average: ${esc(avgTxt)}</span>` : ""}</div>`
    + table + "</div>";
}

export const WEEKLY_CHART_CSS = [
  ".wk-line{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;font-size:15px;color:#E5E7EB;line-height:1.45;margin-top:2px}",
  ".wk-dir{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.02em;color:#F5F3ED;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}",
  ".wk-ic{font-size:11px;line-height:1}.wk-up .wk-ic{color:#3FCB6A}.wk-up{border-color:rgba(63,203,106,.35);background:rgba(63,203,106,.08)}.wk-down .wk-ic{color:#EC835A}.wk-down{border-color:rgba(236,131,90,.35);background:rgba(236,131,90,.08)}.wk-level .wk-ic{color:#8A90A2}",
  ".wk-wrap{position:relative;padding-left:30px;margin-top:4px}",
  ".wk-grid{position:absolute;left:30px;right:0;top:28px;bottom:26px;pointer-events:none}",
  ".wk-g{position:absolute;left:0;right:0;height:0;border-top:1px solid rgba(255,255,255,.07)}.wk-g em{position:absolute;right:calc(100% + 8px);top:-8px;font-style:normal;font-size:12px;color:#8A90A2;font-variant-numeric:tabular-nums}",
  ".wk-avg{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed rgba(232,201,106,.6)}",
  ".ch.wk{gap:clamp(6px,1.6vw,16px);height:216px;padding-top:28px;padding-bottom:26px;border-bottom:0;position:relative;z-index:1;justify-content:space-around}.wk .bar{max-width:112px}",
  ".ch.wk::after{content:\"\";position:absolute;left:0;right:0;bottom:26px;border-top:1px solid rgba(255,255,255,.18)}",
  ".wk .bar::before{background:#5F6474;border-radius:4px 4px 0 0}.wk .bar.now::before{background:linear-gradient(180deg,#F0D27A,#E8C96A)}.wk .bar.z::before{background:rgba(255,255,255,.12)}",
  ".wk-v{position:absolute;left:0;right:0;text-align:center;font-size:14px;font-weight:700;color:#F5F3ED;font-variant-numeric:tabular-nums;pointer-events:none}",
  ".wk-x{position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);font-style:normal;font-size:12px;color:#8A90A2;white-space:nowrap}.wk .bar.now .wk-x{color:#E8C96A;font-weight:700}",
  ".wk .bar::after{bottom:calc(var(--h) + 30px)}",
  ".wk-key{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:18px;font-size:12.5px;color:#9CA3AF}.wk-key span{display:inline-flex;align-items:center;gap:7px}.sw{display:inline-block;width:12px;height:12px;border-radius:3px;background:#5F6474}.sw.now{background:#E8C96A}.sw.avg{height:0;width:16px;border-radius:0;background:none;border-top:2px dashed rgba(232,201,106,.7)}",
  ".wk-tbl{margin-top:12px;border-top:1px solid rgba(255,255,255,.07)}.wk-tbl summary{cursor:pointer;list-style:none;padding:12px 2px 2px;font-size:13.5px;font-weight:600;color:#C9CCD6}.wk-tbl summary::-webkit-details-marker{display:none}.wk-tbl summary::after{content:\" \\25BE\";font-size:11px;color:#8A90A2}.wk-tbl[open] summary::after{content:\" \\25B4\"}",
  ".wk-tbl table{width:100%;max-width:420px;border-collapse:collapse;margin-top:8px;font-size:14px}.wk-tbl th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A90A2;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}.wk-tbl th:last-child,.wk-tbl td:last-child{text-align:right}.wk-tbl td{padding:8px 0;color:#D9DBE1;border-bottom:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums}",
  "@media(max-width:460px){.ch.wk{height:196px}.wk-x{font-size:11px}.wk .bar:not(.now):nth-last-child(even) .wk-x{visibility:hidden}.wk-line{font-size:14px}}",
].join("");
