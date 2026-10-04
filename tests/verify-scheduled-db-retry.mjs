// Does every scheduled job survive a one-off database blip before it gives up (or pages)?
// Run: node tests/verify-scheduled-db-retry.mjs
//
// 🔴 2026-10-04, 1:15pm Phoenix, a Sunday: "crm-retry failed to run ... client read failed: Internal
// server error". Supabase hiccuped once (an open API Gateway incident on their status page) and the
// very next 15-minute sweep worked. The retry that absorbs exactly this had existed since 2026-08-27
// (`retryQuery` / `loadAllClients` in report-shared.mjs), written after the SAME blip paged him from
// two other jobs. It was never applied to crm-retry, and six other scheduled jobs read the client list
// raw too: they did not page, they silently skipped the run, which for the daily billing watcher means
// a missed day of late fees and pauses that nobody hears about.
//
// So this suite looks at EVERY job netlify.toml schedules, not a hand-kept list: a new job that reads
// the whole client table raw fails here.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { retryQuery, loadAllClients } from "../netlify/lib/report-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));

// ── 1. Every scheduled job, discovered from netlify.toml ────────────────────────────────────
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
const scheduled = [...toml.matchAll(/\[functions\."?([\w-]+)"?\]\s*\n\s*schedule\s*=/g)].map((m) => m[1]);
ok("netlify.toml schedules jobs (the parser still finds them)", scheduled.length >= 15, `found ${scheduled.length}`);
ok("crm-retry is one of them", scheduled.includes("crm-retry"));

// A whole-table read is `.from("clients").select(...)` with no row filter after it.
const RAW = /\.from\("clients"\)\s*\.select\([^)]*\)\s*;/g;
for (const name of scheduled) {
  const file = join(ROOT, "netlify/functions", name + ".mjs");
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(RAW)) {
    const before = src.slice(Math.max(0, m.index - 80), m.index);
    ok(`🔴 ${name}: reading the client list retries a blip first`, /retryQuery\(\(\) =>\s*\w+\s*$/.test(before),
      `raw read: ${src.slice(m.index - 40, m.index + m[0].length).trim()}`);
  }
}
const crm = readFileSync(join(ROOT, "netlify/functions/crm-retry.mjs"), "utf8");
ok("🔴 crm-retry loads clients through the retrying loader", /const rows = await loadAllClients\(supabase, "crm-retry"\);/.test(crm));
ok("and the old raw read that paged is gone", !/client read failed/.test(crm));

// ── 2. The retry itself, RUN ────────────────────────────────────────────────────────────────
const flaky = (failures, data = [{ id: 1 }]) => {
  let n = 0;
  return { calls: () => n, run: async () => (n++ < failures ? { data: null, error: { message: "Internal server error" } } : { data, error: null }) };
};
{
  const f = flaky(1);
  const r = await retryQuery(f.run, { gapMs: 1 });
  ok("🔴 one blip, then success: the job gets its data and nothing is reported", r.error === null && r.data.length === 1 && f.calls() === 2);
}
{
  const f = flaky(5);
  const r = await retryQuery(f.run, { gapMs: 1 });
  ok("a real outage still comes back as an error after 3 tries", r.error && /Internal server error/.test(r.error.message) && f.calls() === 3);
}
{
  const f = flaky(5);
  const sb = { from: () => ({ select: () => f.run() }) };
  let msg = "";
  try { await loadAllClients(sb, "crm-retry"); } catch (e) { msg = e.message; }
  ok("🔴 and the loader still throws on a real outage, so the job still alerts", /after 3 attempts: Internal server error/.test(msg), msg);
}

if (fails.length) { console.error(fails.map((f) => "  FAIL  " + f).join("\n")); }
console.log(`verify-scheduled-db-retry: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
