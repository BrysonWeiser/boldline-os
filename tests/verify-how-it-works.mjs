// The How it works page (rebuilt 2026-11-09, Bryson: "the only page where it doesnt look nor feel like its at the same
// level as the rest of the website"). Run: node tests/verify-how-it-works.mjs (after node scripts/build-marketing-site.mjs)
//
// What has to stay true:
//  1. Its prices come from the one price list, so it can never quote a different number from /pricing/.
//  2. The standing copy rules: no dashes, no emojis, never "local businesses", no old "$1,000/month" floor.
//  3. Every picture with made-up numbers says "Example".
//  4. Without scroll motion (reduce motion, slow phones) every step shows finished: the gold line is full and nothing
//     is dimmed. The dimming and the line filling only exist under html.mo.
//  5. One <h1>, and the anchors other pages link to (#process, #fit, #faq) still exist.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const PS = await import("../netlify/lib/pricing-shared.mjs");
const money = (n) => "$" + Number(n).toLocaleString("en-US");

const page = read("marketing-site/how-it-works/index.html");
const main = page.slice(page.indexOf('class="page-hero hw-hero"'), page.indexOf('class="cta-band"'));
const text = main.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// 1. Prices
ok("Complete price from the price list", text.includes(`${money(PS.COMPLETE_PLAN.monthly)} a month plus the lead fee`));
ok("website prices from the price list", text.includes(`${money(PS.WEBSITE_OFFER.build)} to build, ${money(PS.WEBSITE_OFFER.care)} a month to look after`));
ok("smallest ad budget from the price list", text.includes(`Ad budgets start at ${money(PS.MIN_AD_BUDGET)} a month`));
ok("ads: no monthly fee, a fee per qualified lead", /No monthly fee\. A set fee for each qualified lead\./.test(text));
ok("no placeholder left unfilled", !/\{\{\w+\}\}/.test(page));

// 2. Copy rules
ok("no dashes in the page's own words", !/[—–]/.test(text));
ok("no emojis", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text));
ok("never 'local businesses'", !/local business/i.test(page));
ok("the old $1,000 floor is gone from the page's own sections", !/\$1,000\/month/.test(main));
ok("the ad spend stays on their card", /You always own and pay for your own ad account\. We just run it/.test(text) && /never hold or touch your ad spend/.test(text));

// 3. Examples are labelled
const vis = [...main.matchAll(/<div class="hw-vis ([\w-]+)"[\s\S]*?(?=<\/li>)/g)];
ok("six step pictures", vis.length === 6, String(vis.length));
// The call card's "30 min" is a fact about the real call, not an example; the build checklist has no numbers.
for (const [block, kind] of vis) if (kind !== "hw-v-call" && /\$\d|\b\d+ (?:searches|min|sec)\b|>\d{2}</.test(block)) ok(`${kind}: made-up numbers say Example`, /class="hw-ex">Example</.test(block));
ok("the pictures are hidden from screen readers", vis.every(([b]) => /^<div class="hw-vis [\w-]+" aria-hidden="true">/.test(b)));

// 4. No motion = finished page
const css = read("marketing-src/new.css");
ok("without motion the gold line is full", /\.hw-rail i\{[^}]*transform:scaleY\(var\(--hp,1\)\)/.test(css));
ok("only motion starts it empty", /html\.mo \.hw-rail i\{transform:scaleY\(var\(--hp,0\)\)\}/.test(css));
const dims = css.split("\n").filter((l) => /\.hw-step:not\(\.lit\)/.test(l));
ok("every dimming rule is motion-only", dims.length >= 2 && dims.every((l) => l.startsWith("html.mo ")), dims.join(" | "));
ok("every picture animation is motion-only", css.split("\n").filter((l) => /\.hw-step\.lit .*animation/.test(l)).every((l) => l.startsWith("html.mo ")));
ok("nodes show lit without motion", /html:not\(\.mo\) \.hw-node/.test(css));
const js = read("marketing-src/site.js");
const moStart = js.indexOf("H.classList.add('mo');"), hook = js.indexOf("document.querySelector('.hw-steps')");
ok("the scroll hook lives inside the motion block", moStart > 0 && hook > moStart);

// 5. Structure
ok("one h1", (page.match(/<h1[\s>]/g) || []).length === 1);
for (const id of ["process", "plans", "fit", "faq"]) ok(`#${id} exists`, page.includes(`id="${id}"`));
ok("six steps", (main.match(/<li class="hw-step">/g) || []).length === 6);
ok("the old parts are gone", !/class="tstep"|class="niche-row"|fit-budget/.test(page));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-how-it-works: ${pass} checks passed`);
