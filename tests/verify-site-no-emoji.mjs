// No emojis on the public website. Run: node tests/verify-site-no-emoji.mjs
//
// Standing rule (Bryson, 2026-08-03): emojis read unprofessional on anything a client sees.
// 🔴 2026-10-05: the ad landing page (/get-started) still carried four emoji icons on its
// "what you get" cards, found by eye while adding the review-requests card. They are now gold
// line icons matching the homepage, and this check reads every page of the site so the next
// one is caught by the suite instead of by luck. Typography marks (✓ ★ → ▶) are not emoji.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "marketing-site");
const pages = [];
const walk = (d) => { for (const f of readdirSync(d)) {
  const p = join(d, f);
  if (statSync(p).isDirectory()) { if (!/^(netlify|node_modules|fonts)$/.test(f)) walk(p); }
  else if (f.endsWith(".html")) pages.push(p);
} };
walk(SITE);

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const ALLOWED = new Set(["✓", "★", "☆", "→", "▶", "✕", "©", "®", "™"]);

ok("found the site's pages", pages.length >= 5, `${pages.length}`);
for (const p of pages) {
  const shown = readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ");
  const hits = [...shown.matchAll(/\p{Extended_Pictographic}️?/gu)].map((m) => m[0].replace(/️/, "")).filter((e) => !ALLOWED.has(e));
  ok(`🔴 no emojis on ${relative(SITE, p)}`, hits.length === 0, [...new Set(hits)].join(" "));
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-no-emoji: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
