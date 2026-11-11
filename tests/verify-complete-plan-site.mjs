// The new pricing on the public site (Bryson, Sat 2026-11-07, KB `complete-plan`).
// Run: node tests/verify-complete-plan-site.mjs
//
// What was decided, and what this pins on the marketing site:
//   1. No monthly fee for ads, for anyone: a set fee per qualified lead (stores: a share of ad spend, no minimum).
//   2. The first five clients also get their first month of LEAD FEES free (ad spend stays theirs).
//   3. Ads start with 3 months, Complete with 12, then month to month with 30 days' notice.
//   4. Complete: $500/mo plus the lead fee, website built free, early exit pays the rest of the build.
// Every figure on the page must come from the price list (pricing-shared.mjs), so the site can never quote a
// number the agreement and the invoices do not. And no trace of the old "minimum, whichever is higher" model may
// survive anywhere a prospect reads, because a prospect who sees both believes neither.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readSite, readPage, ROOT } from "./helpers/marketing-site.mjs";
import { COMPLETE_PLAN, COMPLETE_STORE, TERMS, WEBSITE_OFFER, GOOGLE_PROFILE, COMBO_MIN_BUDGET, PACKAGES } from "../netlify/lib/pricing-shared.mjs";
import { FOUNDING_CLIENT_COUNT } from "../netlify/lib/founding.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const usd = (n) => "$" + Number(n).toLocaleString("en-US");
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&rsquo;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const SITE = readSite();
const PRICING = readPage("pricing/index.html");
const P = text(PRICING);
const GS = readFileSync(join(ROOT, "marketing-site/get-started/index.html"), "utf8");
const LLMS = readFileSync(join(ROOT, "marketing-site/llms.txt"), "utf8");

// ── The decisions themselves, as the price list holds them ────────────────────────────────────────────────────
ok("Complete is $500 a month", COMPLETE_PLAN.monthly === 500);
ok("Complete includes one ad platform", COMPLETE_PLAN.platforms === 1);
ok("ads start with 3 months, Complete with 12", TERMS.adsFirstTermMonths === 3 && TERMS.completeFirstTermMonths === 12);
ok("then month to month, with 30 days' notice", TERMS.afterFirstTerm === "month_to_month" && TERMS.noticeDays === 30);
ok("leaving Complete early pays the rest of the build, per month left", COMPLETE_PLAN.earlyExitPerMonthLeft === Math.round(WEBSITE_OFFER.build / 12));

// ── The pricing page ─────────────────────────────────────────────────────────────────────────────────────────
ok("the pricing page leads with paying for leads", /<h1>Pay for leads, <em>not promises\.<\/em><\/h1>/.test(PRICING));
ok("it offers the three choices: Ads, Complete, Website", /id="choices"/.test(PRICING)
  && ["Ads", "Complete", "Website"].every((k) => PRICING.includes(`<div class="ch-k">${k}</div>`)));
ok("Ads says pay only for results", /<div class="ch-k">Ads<\/div>\s*<div class="ch-v">Pay only for results<\/div>/.test(PRICING));
ok("Complete shows its price from the price list", PRICING.includes(`<div class="ch-v">${usd(COMPLETE_PLAN.monthly)}<small>/mo</small></div>`)
  && PRICING.includes(`<span class="cp-v">${usd(COMPLETE_PLAN.monthly)}<small>/mo</small></span>`));
ok("Website shows its build price from the price list", PRICING.includes(`<div class="ch-v">${usd(WEBSITE_OFFER.build)}<small> to build</small></div>`));
ok("every choice link lands on a section of the page", ["#services", "#complete", "#website-pricing"].every((h) => PRICING.includes(`href="${h}"`) && PRICING.includes(`id="${h.slice(1)}"`)));

// Complete: each part, with what it costs on its own, read from the price list.
const items = [...PRICING.matchAll(/<li><div><b>([^<]+)<\/b><span>[^<]*<\/span><\/div><em>([^<]+)<\/em><\/li>/g)].map((m) => [m[1], m[2]]);
const item = (re) => (items.find(([h]) => re.test(h)) || [])[1] || "";
ok("Complete lists seven parts", items.length === 7, JSON.stringify(items));
ok("ads inside Complete are still per lead", /lead fee per qualified lead/.test(item(/ads/i)));
ok("the website is built free, with its normal price shown", item(/website/i) === `Built free (${usd(WEBSITE_OFFER.build)} on its own)`, item(/website/i));
ok("care at its real price", item(/care/i) === `${usd(WEBSITE_OFFER.care)}/mo on its own`);
ok("Google profile at its real price", item(/Google profile/i) === `${usd(GOOGLE_PROFILE.monthly)}/mo on its own`);
ok("blog at its real price", item(/blog/i) === `${usd(WEBSITE_OFFER.blogMonthly)}/mo on its own`);
ok("customer emails and booking are only in Complete", item(/emails/i) === "Only in Complete" && item(/booking/i) === "Only in Complete");
const HOW_RAW = readPage("how-it-works/index.html");
// 🔴 After year one it steps down (Bryson, 2026-11-10, KB complete-plan): the website is paid off, $500 becomes $375.
ok("Complete's terms: 12 months, then $375 month to month with 30 days' notice",
  P.includes(`${TERMS.completeFirstTermMonths} months to start.`) && P.includes(`it drops to ${usd(COMPLETE_PLAN.monthlyAfterTerm)} a month, month to month, and either of us can stop with ${TERMS.noticeDays} days' notice`));
ok("the price box and the plan card both show the year-two price", P.includes(`then ${usd(COMPLETE_PLAN.monthlyAfterTerm)}/mo after your first year`) && P.includes(`Drops to ${usd(COMPLETE_PLAN.monthlyAfterTerm)}/mo after your first year.`));
ok("🔴 no page still says Complete stays at $500 after the first year", !/month to month at \$500/.test(P));
ok("the FAQ says it too", /\$375 a month after the first year/.test(HOW_RAW) && /then drops to \$375 a month and goes month to month/.test(HOW_RAW));
ok("leaving early is spelled out in dollars", P.includes(`what's left of the ${usd(WEBSITE_OFFER.build)} build, ${usd(COMPLETE_PLAN.earlyExitPerMonthLeft)} for each month left`));
ok("both platforms still need the combined ad budget", P.includes(`Google and Meta together starts at ${usd(COMBO_MIN_BUDGET)} a month in ad budget`));
// Bryson's ruling: show the itemised list, never a made-up "worth $X" total.
ok("no invented total value anywhere", !/\$[\d,]+ (worth|of value)|worth of value|value of \$|a \$[\d,]+ value/i.test(SITE));

// The ad plan cards: no monthly fee on every one, and the "how you pay" box says so.
const cards = (PRICING.match(/<div class="price">[\s\S]*?<\/div>/g) || []);
const managed = PACKAGES.filter((p) => p.pricingModel !== "one_time");
const perLead = managed.filter((p) => p.pricingModel === "per_lead").length;
ok("every per-lead plan card says pay only for results", cards.filter((c) => c === '<div class="price"><b>Pay only for results</b></div>').length === perLead, cards.length + " cards");
ok("every store card leads with its share of ad spend, never 'only for results'", cards.filter((c) => /^<div class="price"><b>1[25]% of your ad spend<\/b><\/div>$/.test(c)).length === managed.length - perLead);
ok("no card quotes a monthly price", !cards.some((c) => /\$/.test(c)));
ok("stores: billed on spend, no minimum and no monthly fee", (PRICING.match(/on what you actually spent\. No minimum and no monthly fee\./g) || []).length === 3);
// Bryson asked to see which ad budget qualifies for which plan: each card shows its band, from the price list.
for (const p of managed) ok(`${p.id}: its ad budget band is on its card`, PRICING.includes(`For ad budgets of <b>${p.adSpend}</b>`), p.adSpend);
ok("the how-you-pay box explains it and the 30 days' notice", P.includes("There's no monthly fee for ads.") && P.includes(`Either of us can stop with ${TERMS.noticeDays} days' notice.`));

// Complete for online stores, inside the store tab, from the price list (Bryson, 2026-11-07).
{
  const ecom = PRICING.slice(PRICING.indexOf('data-panel="ecom"'));
  const box = (ecom.match(/<div class="sc-box">[\s\S]*?<\/p>\s*<\/div>/) || [""])[0];
  ok("the store tab carries Complete for stores", !!box);
  ok("at the price list's price, with the share of spend", box.includes(`${usd(COMPLETE_STORE.monthly)}<small>/mo</small>`) && /plus 15% of your ad spend \(12% at \$10,000\+\)/.test(box));
  ok("🔴 and it promises no website", !/built free|website built/i.test(box) && /no website build in this one/.test(box));
  ok("3 months, then month to month", box.includes(`${TERMS.adsFirstTermMonths} months to start, then month to month`));
}

// ── Nothing of the old model survives anywhere a prospect reads ──────────────────────────────────────────────
const OLD = [/whichever is higher/i, /whichever of those is higher/i, /never both/i, /monthly minimum/i, /\$\d[\d,]*\/mo<\/b> minimum/i,
  /From <b>\$[\d,]+\/mo/i, /starts? at \$400/i, /One number, <em>never two/i, /one number, never two/i];
for (const [name, src] of [["the site", SITE], ["get-started", GS], ["llms.txt", LLMS]]) {
  const hits = OLD.filter((re) => re.test(text(src)) || re.test(src));
  ok(`🔴 ${name} carries nothing of the old minimum pricing`, hits.length === 0, hits.map(String).join(", "));
}
ok("llms.txt describes the new pricing", /no monthly fee/i.test(LLMS) && LLMS.includes(`Complete plan is ${usd(COMPLETE_PLAN.monthly)}/month`));

// ── The founding banners advertise the FREE SETUP ONLY (Bryson, 2026-11-09): the free first month of lead fees is a closer for calls ────────
const WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][FOUNDING_CLIENT_COUNT];
for (const [name, src] of [["home", readPage("index.html")], ["get-started", GS]]) {
  const banner = (src.match(/<div hidden data-founding[\s\S]*?<\/div>/) || [""])[0];
  ok(`${name}: the founding banner offers the free setup`, new RegExp(`first ${WORD} clients it is free\\.`).test(banner), banner.slice(0, 160));
  ok(`🔴 ${name}: and does NOT advertise the free first month (a call-only closer)`, !/first month/i.test(text(banner)));
  ok(`${name}: and still never calls the whole service free`, !/completely free|free for a month|first month free/i.test(text(banner)));
}

// ── Compare page and the FAQ agree with the terms ─────────────────────────────────────────────────────────────
const CMP = text(readPage("compare/index.html"));
ok("compare: how we get paid", CMP.includes("No monthly fee for ads. A set fee per qualified lead"));
ok("compare: locked in for 3 months, then month to month with 30 days' notice", CMP.includes(`${TERMS.adsFirstTermMonths} months for ads, then month to month. Either of us can stop with ${TERMS.noticeDays} days' notice.`));
const HOW = text(readPage("how-it-works/index.html"));
ok("FAQ: cost answer has no old minimum and names Complete", /There's no monthly fee for ads/.test(HOW) && /Complete plan is \$500 a month/.test(HOW));
ok("FAQ: explains a qualified lead and Complete", /What counts as a qualified lead\?/.test(HOW) && /What's in the Complete plan\?/.test(HOW));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-complete-plan-site: ${pass} checks passed`);
