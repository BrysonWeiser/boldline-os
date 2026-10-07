// No part of our sites may be named like an advert.
//
// Bryson, 2026-10-07: the Ads page "still loads a white screen" on his Chrome, while it loaded fine on his
// girlfriend's computer and on his phone.
//
// 🔴 THE CAUSE WAS A CLASS NAME. Ad blockers (uBlock Origin, AdBlock, AdGuard) ship tens of thousands of
// "hide anything called this" rules that apply on EVERY website. One of them is `.page-ads`, and the
// builder stamped `page-<id>` on each page's <body>, so the Ads page's whole body was `page-ads` and any
// visitor with a blocker saw an empty page. Nothing errors and nothing looks wrong without a blocker,
// which is why it survived a first "fix" and two checks. The mock Google result in the lead journey
// (`.g-ad`) was hidden the same way.
//
// So this fails on any class or id that reads like an advert, on every built page and in the styles and
// scripts that could add one. Our visitors are business owners, and a lot of them run blockers.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

// A name segment (split on - and _) that blockers' generic rules target.
const RISKY = /(^|[-_])(ad|ads|advert\w*|sponsor\w*|banner|adbox|adslot|adunit)([-_]|$)/i;

ok("the rule catches the name that blanked the Ads page", RISKY.test("page-ads"));
ok("and the mock Google result", RISKY.test("g-ad"));
ok("but not ordinary words that contain the letters", !["head", "add-on", "shadow", "loading", "badge", "header", "reads"].some((w) => RISKY.test(w)));

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

const pages = walk(join(ROOT, "marketing-site")).filter((f) => f.endsWith(".html"));
ok("the built site was found", pages.length >= 8, String(pages.length));
const bad = [];
for (const f of pages) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\s(?:class|id)="([^"]*)"/g)) {
    for (const t of m[1].split(/\s+/)) if (t && !t.includes("$") && RISKY.test(t)) bad.push(`${relative(ROOT, f)}: ${t}`);
  }
}
ok("🔴 no page carries a class or id an ad blocker would hide", bad.length === 0, [...new Set(bad)].slice(0, 12).join(", "));

// Styles and scripts: a class can be added at run time, so the selectors that style it count too.
const srcs = [...walk(join(ROOT, "marketing-src")).filter((f) => /\.(css|js|html)$/.test(f)),
  join(ROOT, "netlify/functions/landing.mjs"), join(ROOT, "netlify/lib/site-render.mjs"), join(ROOT, "marketing-site/netlify/lib/blog-render.mjs")];
const badSel = [];
for (const f of srcs) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/(?:^|[\s,{}>+~(])[.#]([A-Za-z_][\w-]*)/g)) if (RISKY.test(m[1])) badSel.push(`${relative(ROOT, f)}: ${m[1]}`);
  for (const m of s.matchAll(/class(?:Name)?="([^"$]*)"/g)) for (const t of m[1].split(/\s+/)) if (t && RISKY.test(t)) badSel.push(`${relative(ROOT, f)}: ${t}`);
}
ok("🔴 no style, script or client page template names one either", badSel.length === 0, [...new Set(badSel)].slice(0, 12).join(", "));

const builder = readFileSync(join(ROOT, "scripts/build-marketing-site.mjs"), "utf8");
ok("🔴 the page id is not stamped into the body's class (it is a data attribute)", !/<body class="[^"]*page-\$\{p\.id\}/.test(builder) && /data-page="\$\{p\.id\}"/.test(builder));

if (fails.length) { console.log(fails.map((f) => "  FAIL  " + f).join("\n")); }
console.log(`verify-adblock-safe: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
