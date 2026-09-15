// Every answer row on the marketing site lays out UNIFORMLY, measured in a real browser
// at every breakpoint.
//
// Bryson, 2026-09-14, photographing his monitor: *"for the thing at the bottom of the
// website can you make sure they are all uniform and formatted right now its 3 on top
// then one on the left"*.
//
// 🔴 WHY THIS HAS TO BE MEASURED AND NOT READ. The rows were `display:flex;flex-wrap:wrap`,
// which sizes each chip to its own text. Four platform chips came to within a few pixels
// of the 440px wizard column, so whether they sat 4-up or ragged 3-then-1 depended on how
// the machine rendered Inter. It rendered 4-up in headless Chrome here and 3-then-1 on his
// monitor — the CSS was identical, the layout was not. No amount of reading the stylesheet
// would have shown that, and a screenshot from one machine would have said it was fine.
//
// So this asserts the property that makes the layout machine-independent: within a row,
// every chip is the SAME WIDTH, and the only chip allowed to span the full row is an odd
// last one (the 5th of five, which would otherwise strand itself in the left column).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser in this environment */ }
if (!chromium) { console.log("verify-answer-rows: skipped, no browser in this environment"); process.exit(0); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "file://" + join(ROOT, "marketing-site", "index.html");
const WIDTHS = [390, 768, 1280, 1600];   // phone / tablet / laptop / desktop, the standing set

const fails = [];
let pass = 0;
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: exe });

// Reads every answer row on the page, grouped into visual rows by y-position, so the
// assertion is about what the browser actually drew rather than about the markup order.
const readRows = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll(".opts").forEach((grp, gi) => {
    const btns = [...grp.querySelectorAll("button")];
    if (!btns.length || !btns[0].getClientRects().length) return;       // a hidden step
    const rows = new Map();
    btns.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const key = Math.round(r.y);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ i, last: i === btns.length - 1, n: btns.length,
        w: Math.round(r.width), text: b.textContent.trim(),
        clipped: b.scrollWidth > b.clientWidth + 1 });
    });
    out.push({ id: grp.getAttribute("data-key") || `q${gi}`, total: btns.length,
      rows: [...rows.values()] });
  });
  return out;
});

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(URL);
  await page.evaluate(() => {
    document.querySelectorAll(".reveal,.sr").forEach((e) => {
      e.classList.add("sr-in"); e.style.animation = "none"; e.style.opacity = 1; e.style.transform = "none";
    });
    document.getElementById("recModal").hidden = false;   // the recommender's three rows
  });
  await page.waitForTimeout(250);

  const groups = await readRows(page);
  ok(`${width}px: the answer rows are on the page at all`, groups.length >= 4, `found ${groups.length}`);

  for (const g of groups) {
    for (const row of g.rows) {
      const widths = [...new Set(row.map((b) => b.w))];
      // A row of one is only legitimate for an odd LAST option spanning the full width.
      if (row.length === 1) {
        const only = row[0];
        ok(`${width}px: ${g.id} — a chip alone on its row is the odd last one`,
          only.last && only.n % 2 === 1, `"${only.text}" is #${only.i + 1} of ${only.n}`);
      } else {
        ok(`${width}px: ${g.id} — every chip in a row is the same width`,
          widths.length === 1, `${row.map((b) => `${b.text}:${b.w}`).join(", ")}`);
        ok(`${width}px: ${g.id} — a full row holds exactly two chips`,
          row.length === 2, `${row.length} on one row: ${row.map((b) => b.text).join(" | ")}`);
      }
      const clipped = row.filter((b) => b.clipped);
      ok(`${width}px: ${g.id} — no chip's label is cut off`, clipped.length === 0,
        clipped.map((b) => b.text).join(", "));
    }
  }

  ok(`${width}px: the page does not scroll sideways`,
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.close();
}

// The wizard advances a step on click, so the later rows are only reachable by using it.
// Checking step 0 alone would leave the five-option budget row — the one that needs the
// odd-last-child span — completely unmeasured.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(URL);
  await page.locator("#leadWiz").scrollIntoViewIfNeeded();
  await page.click('.opts[data-key="platform"] button');
  await page.waitForTimeout(350);
  const groups = (await readRows(page)).filter((g) => g.id === "budget");
  ok("the wizard's budget row is reachable and was measured", groups.length === 1);
  if (groups[0]) {
    ok("the wizard's five budget options lay out 2 + 2 + 1",
      groups[0].rows.map((r) => r.length).join("+") === "2+2+1",
      groups[0].rows.map((r) => r.length).join("+"));
    const lastRow = groups[0].rows[groups[0].rows.length - 1];
    ok("the odd fifth option spans the full width instead of stranding left",
      lastRow.length === 1 && lastRow[0].w > groups[0].rows[0][0].w * 1.8,
      `spans ${lastRow[0] && lastRow[0].w}px against a ${groups[0].rows[0][0].w}px cell`);
  }
  await page.close();
}

await browser.close();
console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.slice(0, 12).join("\n  ")
  : `✓ verify-answer-rows: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
