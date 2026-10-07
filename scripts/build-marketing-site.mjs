// Builds BoldLine's marketing site as separate pages from the pieces in marketing-src/ (KB website-builder,
// "Multi-page site"). Every page shares one header, footer, stylesheet and script, so they can never drift.
//
//   node scripts/build-marketing-site.mjs          writes marketing-site/{index,ads,websites,...}.html + site.css/js
//   node scripts/build-marketing-site.mjs --check  exits 1 if the committed pages are not what the sources build
//
// Edit the pieces in marketing-src/ (or the page list below), never the generated pages.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { renderSite, THEME_IDS, SITE_THEMES, SITE_PAGES as SAMPLE_PAGES } from "../netlify/lib/site-render.mjs";
import { DEMO, DEMO_DETAIL, DEMO_HANDY, DEMO_EPOXY, DEMO_TINT, LANDING_DEMOS } from "./site-showcase-demo.mjs";
import { renderLandingPage } from "../netlify/functions/landing.mjs";
import { PACKAGES, WEBSITE_OFFER } from "../netlify/lib/pricing-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "marketing-src");
const OUT = join(ROOT, "marketing-site");
const part = (n) => readFileSync(join(SRC, n), "utf8");
const SITE = "https://boldlinemedia.com";
const CAL = "https://calendly.com/theboldlinemedia/30min";
// Website prospects get their own booking (Bryson, 2026-10-07): the ads booking asks about ad budget and
// packages, which means nothing to someone who only wants a website. The OS labels these "Website call".
const CAL_WEB = "https://calendly.com/theboldlinemedia/website";
const calFor = (id) => (id === "websites" ? CAL_WEB : CAL);
const book = (cls = "btn", label = "Book a Call", href = CAL) => `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// The first section's heading becomes the page's one <h1>, so a page that opens on an existing section
// still has a proper title for search engines.
const promote = (html) => {
  const i = html.indexOf("<h2"); if (i < 0) return html;
  const j = html.indexOf("</h2>", i);
  return html.slice(0, i) + "<h1" + html.slice(i + 3, j) + "</h1>" + html.slice(j + 5);
};

// ── The pages ───────────────────────────────────────────────────────────────────────────
// The links shown along the top bar on a computer: only the three pages a buyer looks for. Everything else is one click
// away in the menu button (Bryson, 2026-10-07: the full row repeated the menu).
const NAV = [["ads", "/ads/", "Ads"], ["websites", "/websites/", "Websites"], ["pricing", "/pricing/", "Pricing"]];
// The phone menu, grouped rather than one long list (Bryson, 2026-10-07: "there are to many things under the hamburger
// menu but at the same time I want all of those things easily accessible"). Every page is still one tap away: the two
// things we sell as big boxes, everything else in a two-column grid, and the two actions as buttons at the bottom.
const MENU_MAIN = [["ads", "/ads/", "Ads", "Google and Meta ads, run for you"], ["websites", "/websites/", "Websites", "Built to turn visits into calls"]];
const MENU_MORE = [["pricing", "/pricing/", "Pricing"], ["how", "/how-it-works/", "How it works"], ["industries", "/industries/", "Industries"], ["about", "/about/", "About"], ["blog", "/blog/", "Blog"], ["contact", "/contact/", "Contact"]];
const here = (k, id, cls = "") => {
  const c = [cls, k === id ? "current" : ""].filter(Boolean).join(" ");
  return `${c ? ` class="${c}"` : ""}${k === id ? ' aria-current="page"' : ""}`;
};
export const mobileMenu = (id = "") => `  <div class="nav-mobile">
    <div class="nm-main">
${MENU_MAIN.map(([k, h, l, sub]) => `      <a${here(k, id, "nm-big")} href="${h}"><b>${l}</b><span>${sub}</span></a>`).join("\n")}
    </div>
    <div class="nm-grid">
${MENU_MORE.map(([k, h, l]) => `      <a${here(k, id)} href="${h}">${l}</a>`).join("\n")}
    </div>
    <div class="nm-ctas">
      ${book("hdr-cta", "Book a Call", calFor(id))}
      <a${here("check", id, "nm-check")} href="/free-check/">Free Lead-Leak Check</a>
    </div>
  </div>
</header>`;

const icons = [...part("showcase.html").matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);

// The FAQ, with the website questions written once (faq-web.html) and shown both here and on /websites/. Every
// answer there is something the website agreement (netlify/lib/website-deal.mjs) already promises.
const faqHtml = () => part("faq.html").replace("<!--FAQ_WEB-->", part("faq-web.html").trimEnd());
const webFaq = () => `
<section class="x-sec" id="faq"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Questions</div><h2>What people ask about websites.</h2></div><a class="x-link" href="/how-it-works/#faq">All questions <span>&rarr;</span></a></div>
  <div class="faq-list reveal">
${part("faq-web.html").trimEnd()}
  </div>
</div></section>
`;

const ctaBand = (title = "Ready for a steadier phone?", sub = "A 30 minute call. We'll tell you straight whether we're a fit, and what we'd do first.", cal = CAL) => `
<section class="cta-band"><div class="wrap-x"><div class="cta-box reveal">
  <div><h2>${title}</h2><p>${sub}</p></div>
  <div class="hero-ctas">${book("btn", "Book a Call", cal)}<a class="btn btn-ghost" href="/free-check/">Free Lead-Leak Check</a></div>
</div></div></section>
`;

// ── Pricing page pieces. Every number comes from the one price list (pricing-shared.mjs), so the page can
// never quote a price the OS, the contract and the invoices don't. ─────────────────────────────────────────
const usd = (n) => "$" + Number(n).toLocaleString("en-US");
const PLAN_DATA = JSON.stringify(PACKAGES.filter((p) => /^(g|c)-/.test(p.id)).map((p) => ({ id: p.id, name: p.name, combined: p.id.startsWith("c-"), price: p.price, min: p.minBudget, max: p.maxBudget, band: p.adSpend })));
const planFinder = () => `
<section class="pf-sec"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Find your plan</div><h2>Slide to your ad budget.</h2></div></div>
  <div class="pf reveal" data-plans='${PLAN_DATA.replace(/'/g, "&#39;")}'>
    <div class="pf-left">
      <label class="pf-label" for="pfBudget">Your monthly ad budget <span class="pf-hint">(paid straight to Google or Meta, never to us)</span></label>
      <div class="pf-amount" id="pfAmount">$1,500</div>
      <input id="pfBudget" class="pf-range" type="range" min="0" max="12" step="1" value="3" aria-describedby="pfResult" aria-label="Monthly ad budget">
      <div class="pf-ticks" aria-hidden="true"><span style="left:0">$500</span><span style="left:41.667%">$2,500</span><span style="left:75%">$10,000</span><span style="left:100%">$30,000+</span></div>
      <div class="pf-result" id="pfResult" aria-live="polite">
        <div class="pf-plan"><span class="pf-name">Launch System</span><span class="pf-plat">Google or Meta, same price</span></div>
        <div class="pf-min"><b>${usd(400)}/mo</b> minimum, or a fee per qualified lead, whichever is higher.</div>
        <div class="pf-also"></div>
      </div>
    </div>
    <div class="pf-right">
      <div class="pf-toggle" role="tablist" aria-label="Example month">
        <button type="button" class="on" data-month="slow" role="tab" aria-selected="true">A slow month</button>
        <button type="button" data-month="busy" role="tab" aria-selected="false">A busy month</button>
      </div>
      <div class="pf-bars" data-month="slow">
        <div class="pf-bar pf-bar-min"><div class="pf-fill"></div><span class="pf-cap">Your plan's minimum</span></div>
        <div class="pf-bar pf-bar-lead"><div class="pf-fill"></div><span class="pf-cap">Qualified leads × your lead fee</span></div>
      </div>
      <p class="pf-say" data-for="slow">Fewer leads came in, so the lead fee stays under your minimum. <b>You pay the minimum.</b></p>
      <p class="pf-say" data-for="busy" hidden>More qualified leads came in, so the lead fee is higher. <b>You pay the lead fee instead.</b> Never both.</p>
      <p class="pf-small">An example to show how it works. Your lead fee is agreed on the call and written into your agreement.</p>
    </div>
  </div>
</div></section>
`;
const webPricing = () => `
<section class="wp-sec" id="website-pricing"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Websites</div><h2>Website pricing, with or without ads.</h2></div><a class="x-link" href="/websites/">See the designs <span>&rarr;</span></a></div>
  <div class="wp-grid reveal">
    <div class="wp-card wp-main"><div class="wp-k">To build</div><div class="wp-v">${usd(WEBSITE_OFFER.build)}</div><p>${WEBSITE_OFFER.pages} pages, written for you, in the design you pick. All up front, or half now and half before it goes live.</p></div>
    <div class="wp-card"><div class="wp-k">Care plan</div><div class="wp-v">${usd(WEBSITE_OFFER.care)}<small>/mo</small></div><p>Hosting, security and up to ${WEBSITE_OFFER.carePlanEdits} small edits a month. Starts when the site goes live.</p></div>
    <div class="wp-card"><div class="wp-k">Extra pages</div><div class="wp-v">${usd(WEBSITE_OFFER.extraPage)}<small> each</small></div><p>Anything past the five: a page per service, a gallery, a page for a second location.</p></div>
    <div class="wp-card"><div class="wp-k">Blog</div><div class="wp-v">${usd(WEBSITE_OFFER.blogMonthly)}<small>/mo</small></div><p>About ${WEBSITE_OFFER.blogPostsPerMonth} articles a month on your site, and you can read, edit or hold each one first. ${usd(WEBSITE_OFFER.blogSetup)} once to set it up.</p></div>
  </div>
  <p class="wp-foot reveal">Want to see one first? <a href="/examples/cinematic/">Click through a full sample site</a>, or <a href="${CAL_WEB}" target="_blank" rel="noopener noreferrer">book a website call</a>.</p>
</div></section>
`;

// ── Trade pages (Bryson, 2026-10-07: car detailers, handymen and similar). One per trade, each pointing at a
// sample website for a made-up business in that trade. Plan numbers come from the one price list. ───────────────
const launch = PACKAGES.find((p) => p.id === "g-launch");
const TRADES = [
  { slug: "car-detailing", label: "Car detailers", sampleLabel: "detailing", sample: "car-detailing", photo: "/img/sample/detail-6873123.jpg",
    h1: "More booked details, <em>fewer slow weeks.</em>",
    sub: "We run Google and Meta ads that put you in front of people looking for a detail right now, and send them to a page built to book.",
    searches: ["mobile detailing near me", "ceramic coating price", "paint correction", "interior car cleaning"],
    meta: "Before and after photos are made for Facebook and Instagram. We turn your best jobs into ads that reach car owners near you.",
    wins: [["Searches with intent", "Google shows your ad to people typing what they want done, not people idly scrolling."], ["Photos that sell", "Your before and after shots become Meta ads that make people want the same result."], ["Reviews on autopilot", "After each job your customer gets one email asking for a Google review, so your rating keeps climbing."]],
    faqs: [["Do I need a website first?", "No. Every plan includes a landing page built for your ads. If you want a full website too, we build those as well."], ["What counts as a qualified lead for a detailer?", "A real person in your area asking about a service you offer. Not a spam call, not a salesperson, not a duplicate. We agree on it before you pay for any."], ["I'm a one person shop. Is this too much?", "Most detailers start on our smallest plan, with a $500 a month ad budget. If the calendar fills, you scale up. If not, you'll know why."]] },
  { slug: "handyman", label: "Handymen", sampleLabel: "handyman", sample: "handyman", photo: "/img/sample/handy-6474471.jpg",
    h1: "Fill the calendar with <em>jobs worth driving to.</em>",
    sub: "We run Google and Meta ads for handymen that bring in people with a real job to do, and a page that turns them into a booked visit.",
    searches: ["handyman near me", "drywall repair", "ceiling fan installation", "door repair"],
    meta: "Homeowners scroll Facebook with a to-do list in the back of their mind. A good before and after reminds them who to call.",
    wins: [["The right jobs", "We aim the ads at the work you want more of, and keep them away from the jobs you don't."], ["A page that books", "Your ads land on a page about the job they searched for, with your reviews and a short form."], ["Every call counted", "Calls and forms are tracked back to the ad that caused them, so you know what's paying for itself."]],
    faqs: [["Do I need a website first?", "No. Every plan includes a landing page built for your ads. If you want a full website too, we build those as well."], ["What counts as a qualified lead for a handyman?", "A real person in your area asking about work you do. Not a spam call, not a salesperson, not a duplicate. We agree on it before you pay for any."], ["Can you avoid the tiny jobs?", "Yes. We tune the keywords and the page around the jobs you want, and we review the leads with you every month."]] },
  { slug: "epoxy-floors", label: "Epoxy floor installers", sampleLabel: "floor coating", sample: "epoxy-floors", photo: "/img/sample/epoxy-3.jpg",
    h1: "More garage floors booked, <em>less waiting on referrals.</em>",
    sub: "We run Google and Meta ads that reach homeowners pricing out a garage floor right now, and send them to a page that books the free measure.",
    searches: ["epoxy garage floor near me", "garage floor coating cost", "polyaspartic floor coating", "metallic epoxy floor"],
    meta: "A finished garage is one of the best before and afters there is. We put yours in front of homeowners nearby, and they come asking for the same floor.",
    wins: [["Buyers, not browsers", "We bid on the searches people make when they're ready for quotes, and skip the do it yourself crowd."], ["Before and afters that sell", "Your best floors become ads that make homeowners look at their own garage differently."], ["The jobs you want", "We can aim the ads at full garages, metallic floors or commercial space, whatever you want more of."]],
    faqs: [["Do I need a website first?", "No. Every plan includes a landing page built for your ads. If you want a full website too, we build those as well."], ["What counts as a qualified lead for a floor installer?", "A homeowner or business in your area asking about a floor you'd do. Not a do it yourself question, not a salesperson, not a duplicate. We agree on it before you pay for any."], ["Does this work for commercial floors too?", "Yes. We can run shops and warehouses as their own campaign with their own page, so those leads don't get mixed in with garages."]] },
  { slug: "window-tint", label: "Tint and film shops", sampleLabel: "tint shop", sample: "window-tint", photo: "/img/sample/tint-6872160.jpg",
    h1: "Fill your bays with <em>film and tint jobs.</em>",
    sub: "We run Google and Meta ads that reach drivers shopping for tint, paint protection film and coatings, and send them to a page that turns them into a booked install.",
    searches: ["ceramic tint near me", "paint protection film cost", "clear bra near me", "ceramic coating"],
    meta: "New car owners scroll Instagram looking at other people's cars. Your film and tint work, shot well, is exactly what makes them book.",
    wins: [["High ticket first", "We can put more of the budget behind paint protection film and coatings, where one job is worth several tints."], ["New car buyers", "We reach people who just bought, while protecting the paint is on their mind."], ["Every call counted", "Calls and forms are traced back to the ad that caused them, so you know what's paying for itself."]],
    faqs: [["Do I need a website first?", "No. Every plan includes a landing page built for your ads. If you want a full website too, we build those as well."], ["What counts as a qualified lead for a tint shop?", "A real person in your area asking about a service you offer. Not a spam call, not a salesperson, not a duplicate. We agree on it before you pay for any."], ["Can you push film over tint?", "Yes. We tune the ads and the page around the work you want more of, and review the leads with you every month."]] },
];
const tradePage = (t) => `
<section class="page-hero tr-hero"><div class="wrap-x tr-grid">
  <div class="reveal"><div class="eyebrow">For ${t.label.toLowerCase()}</div><h1>${t.h1}</h1><p>${t.sub}</p>
    <div class="hero-ctas">${book()}<a class="btn btn-ghost" href="/examples/${t.sample}/">See a sample ${t.sampleLabel} site</a></div>
    <a class="tr-lp" href="/examples/${t.sample}/landing/">Or see the landing page we'd send your ads to <span>&rarr;</span></a></div>
  <a class="tr-shot reveal" href="/examples/${t.sample}/" aria-label="Open the sample site"><img src="${t.photo}" width="1600" height="1067" alt="" loading="eager" decoding="async"><span class="tr-badge">Sample site <i>&rarr;</i></span></a>
</div></section>

<section class="x-sec"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Where your customers are</div><h2>People already search for what you do.</h2></div></div>
  <div class="tr-two reveal">
    <div class="tr-card"><h3>On Google</h3><p>We put you in front of people typing searches like these:</p><ul class="tr-q">${t.searches.map((q) => `<li><span class="tr-g">G</span>${q}</li>`).join("")}</ul></div>
    <div class="tr-card"><h3>On Facebook and Instagram</h3><p>${t.meta}</p><p class="tr-small">Google and Meta cost the same on every plan, so you pick the one that fits, or both once your budget allows it.</p></div>
  </div>
</div></section>

<section class="x-sec" style="padding-top:10px"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">What you get</div><h2>Built for how ${t.label.toLowerCase()} get booked.</h2></div><a class="x-link" href="/ads/">How the ads work <span>&rarr;</span></a></div>
  <div class="steps3 reveal">${t.wins.map(([h, p], i) => `<div class="st"><div class="n">0${i + 1}</div><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
</div></section>

<section class="x-sec" style="padding-top:10px"><div class="wrap-x">
  <div class="tr-price reveal">
    <div><div class="eyebrow">What it costs</div><h2>Most ${t.label.toLowerCase()} start at ${usd(launch.price)} a month.</h2>
      <p>That's the minimum on our Launch plan, or a fee per qualified lead, whichever is higher. Never both. Your ad budget, from $500 a month, goes straight to Google or Meta on your own card.</p></div>
    <div class="hero-ctas"><a class="btn" href="/pricing/">See all pricing</a><a class="btn btn-ghost" href="/websites/">Need a website too?</a></div>
  </div>
</div></section>

<section class="x-sec" style="padding-top:10px"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Questions</div><h2>What ${t.label.toLowerCase()} ask us.</h2></div></div>
  <div class="tr-faq reveal">${t.faqs.map(([q, a]) => `<details class="tr-q1"><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
</div></section>
${ctaBand("Want more of the jobs you like?", "A 30 minute call. We'll look at your area and tell you straight what we'd do first.")}
`;
const industriesPage = () => `
<section class="page-hero"><div class="wrap-x reveal">
  <div class="eyebrow">Who we work with</div>
  <h1>Service businesses that <em>want a steadier phone.</em></h1>
  <p>We work with businesses that do the work themselves and need more of the right customers calling. These are the trades we know best.</p>
</div></section>
<section class="x-sec" style="padding-top:10px"><div class="wrap-x">
  <div class="ind-grid reveal">
    ${TRADES.map((t) => `<a class="ind-card" href="/industries/${t.slug}/"><img src="${t.photo}" width="1600" height="1067" alt="" loading="lazy" decoding="async"><div class="ind-txt"><h3>${t.label}</h3><p>${t.sub.split(".")[0]}.</p><span class="b-go">See how it works <i>&rarr;</i></span></div></a>`).join("\n    ")}
    <div class="ind-card ind-more"><div class="ind-txt"><h3>Another service business?</h3><p>Cleaners, landscapers, pressure washers, painters and more. If people search for what you do, the same system works.</p><a class="b-go" href="/contact/">Tell us about yours <i>&rarr;</i></a></div></div>
  </div>
</div></section>
${ctaBand()}
`;

// ── BoldLine vs a typical agency. Every BoldLine line is something the contract and pricing already promise; the
// other column describes the common retainer setup in hedged words and names no one. ──────────────────────────────
const CMP = [
  ["How they get paid", "A flat monthly retainer, paid whether your phone rings or not.", "Your plan's minimum or a fee per qualified lead, whichever is higher. We only earn more when you get more."],
  ["How long you're locked in", "Often 6 to 12 months, agreed up front.", "90 days, then month to month."],
  ["Who owns the ad account", "Sometimes the agency's own account, so your history stays with them if you leave.", "Always yours, in your name and on your card. We only have manager access."],
  ["Your ad budget", "Some pay Google for you and bill you back with a markup.", "Goes straight to Google or Meta on your own card. We never hold it or mark it up."],
  ["Where the clicks go", "Usually your homepage.", "A landing page built for the ad, included on every plan."],
  ["What the report says", "Impressions, clicks and charts that take a meeting to explain.", "What you spent, what came in, and what we're changing next. Every call and form traced to the ad."],
  ["Your website", "Another company, another login, another bill.", "The same team builds and looks after it, if you want one."],
  ["If you're not ready yet", "Most start the day you sign.", "We tell you before you spend a dollar if we don't think it will pay off yet."],
];
const comparePage = () => `
<section class="page-hero"><div class="wrap-x reveal">
  <div class="eyebrow">How we compare</div>
  <h1>BoldLine vs <em>a typical agency.</em></h1>
  <p>Plenty of agencies do good work. This is how the usual retainer setup tends to work, and where ours is different.</p>
</div></section>
<section class="x-sec" style="padding-top:10px"><div class="wrap-x">
  <div class="cmp reveal" role="table" aria-label="BoldLine compared with a typical agency">
    <div class="cmp-row cmp-head" role="row"><div role="columnheader"></div><div role="columnheader">A typical agency</div><div role="columnheader"><img src="/logo.png" alt="" width="18" height="21"> BoldLine</div></div>
    ${CMP.map(([k, them, us]) => `<div class="cmp-row" role="row"><div class="cmp-k" role="rowheader">${k}</div><div class="cmp-them" role="cell"><span class="cmp-l">A typical agency</span>${them}</div><div class="cmp-us" role="cell"><span class="cmp-l">BoldLine</span>${us}</div></div>`).join("\n    ")}
  </div>
  <p class="cmp-foot reveal">Agencies vary, so ask yours. Everything on the BoldLine side is how we work with every client.</p>
</div></section>
${ctaBand("See if we're a fit.", "A 30 minute call. If we don't think we can make your ads pay, we'll tell you.")}
`;

// The way into /compare/ from the pages where people start comparing (Bryson, 2026-10-07: it was only reachable from
// the footer). The topics are read from CMP, so the box can never name a row the page doesn't have.
const compareNudge = () => `
<section class="x-sec cmpn-sec"><div class="wrap-x">
  <a class="cmpn reveal" href="/compare/">
    <div class="cmpn-txt"><div class="eyebrow">Talking to other agencies?</div><h3>See how we're different before you sign anything.</h3>
      <div class="cmpn-tags">${[0, 2, 5].map((i) => `<span>${CMP[i][0]}</span>`).join("")}</div></div>
    <span class="btn btn-ghost cmpn-go">See the comparison <i>&rarr;</i></span>
  </a>
</div></section>
`;

// Ads page: what the ads land on. One card per sample landing page (pictures by scripts/build-trade-shots.cjs).
const lpGallery = () => `
<section class="x-sec lpg-sec"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">What your ads land on</div><h2>A page built for the click, not your homepage.</h2></div></div>
  <p class="lpg-sub reveal">Every plan includes a landing page like these. Tap one to try it. They're samples for made-up businesses, so the forms don't send.</p>
  <div class="lpg reveal">${LANDING_DEMOS.map((l) => { const t = TRADES.find((x) => x.slug === l.slug); return `<a class="lpg-card" href="/examples/${l.slug}/landing/"><img src="/img/sample/lp-${l.slug}.jpg" width="1280" height="800" alt="" loading="lazy" decoding="async"><div class="lpg-txt"><b>${t ? t.label : l.demo.name}</b><span>${l.demo.name}</span></div></a>`; }).join("")}</div>
</div></section>
`;

const pageHero = (eyebrow, h1, sub, ctas = "", centred = false) => `
<section class="page-hero${centred ? " ph-centre" : ""}"><div class="wrap-x reveal">
  <div class="eyebrow">${eyebrow}</div>
  <h1>${h1}</h1>
  <p>${sub}</p>
  ${ctas ? `<div class="hero-ctas">${ctas}</div>` : ""}
</div></section>
`;

const HOME = `
<section class="h-hero"><div class="h-pin"><div class="wrap-x">
  <div class="h-grid">
    <div class="h-copy">
      <div class="eyebrow">Google Ads, Meta Ads and websites</div>
      <h1 class="h-title pains"><span style="--i:0">We only earn</span> <span style="--i:1">more when your</span> <span class="g" style="--i:2">phone rings more.</span></h1>
      <p class="h-sub"><strong>BoldLine builds and runs your Google and Meta ads</strong>, and the website they send people to. Every call and form is traced back to the ad that caused it, so you always know what's working.</p>
      <div class="hero-ctas">${book()}<a class="btn btn-ghost" href="/free-check/">Free Lead-Leak Check</a></div>
${part("founding-home.html")}${part("trust.html")}    </div>
    <div class="h-visual">
      <div class="browser">
        <div class="browser-bar"><span class="bdot"></span><span class="bdot"></span><span class="bdot"></span><span class="burl">yourbusiness.com</span></div>
        <img class="stage-shot" src="/img/site-hero.jpg" srcset="/img/site-hero.jpg 1440w, /img/site-hero-2x.jpg 2880w" sizes="(max-width:900px) 100vw, 1400px" width="1440" height="900" alt="A sample website built by BoldLine, on a computer" decoding="async" fetchpriority="high">
      </div>
      <div class="phone" aria-hidden="true"><img src="/img/site-phone.jpg" srcset="/img/site-phone.jpg 780w, /img/site-phone-2x.jpg 1170w" sizes="(max-width:900px) 45vw, 420px" width="780" height="1688" alt="" decoding="async"></div>
      <div class="float-toast" aria-hidden="true"><span class="ft-ic">&#10003;</span> New enquiry from the website</div>
      <p class="h-cap">A sample business, built with the same system we use for clients. <a href="/examples/cinematic/">Click through it &rarr;</a></p>
    </div>
  </div>
</div></div><div class="wrap-x">
  <div class="h-strip" aria-label="What we run"><span>Google Ads</span><span>Meta Ads</span><span>Landing pages</span><span>Websites</span><span>Call tracking</span><span>Lead follow-up</span></div>
</div></section>

<section class="x-sec"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">What we do</div><h2>One team for the ads and the website they send people to.</h2></div></div>
  <div class="bento reveal">
    <a class="b-card b-paid" style="--k:0" href="/ads/">
      <div class="b-txt"><h3>Google and Meta ads</h3><p>Campaigns built to find buyers, every call and form tied back to the ad that caused it, and a plain-English report of what came in.</p><span class="b-go">How it works <i>&rarr;</i></span></div>
      <div class="mini-feed" aria-hidden="true">
        <div class="mf"><span class="dot">${icons[0] || ""}</span><span><b>New lead</b><small>Landing page form</small></span><time>2m ago</time></div>
        <div class="mf"><span class="dot">${icons[1] || ""}</span><span><b>Call tracked</b><small>3m 41s, logged automatically</small></span><time>26m ago</time></div>
        <div class="mf"><span class="dot">${icons[2] || ""}</span><span><b>New lead</b><small>Google Ads</small></span><time>1h ago</time></div>
        <div class="mf-cap">An example of your lead feed</div>
      </div>
    </a>
    <a class="b-card b-web" style="--k:1" href="/websites/">
      <h3>Websites</h3><p>Three modern designs with real motion, still fast on a phone. From $1,500 to build.</p>
      <div class="b-thumbs" aria-hidden="true"><img src="/img/design-editorial.jpg" width="1440" height="900" alt="" loading="lazy" decoding="async"><img src="/img/design-cinematic.jpg" width="1440" height="900" alt="" loading="lazy" decoding="async"><img src="/img/design-aurora.jpg" width="1440" height="900" alt="" loading="lazy" decoding="async"></div>
      <span class="b-go">See the designs <i>&rarr;</i></span>
    </a>
    <a class="b-card b-price" style="--k:2" href="/pricing/">
      <div class="b-big">You pay one number, never two.</div>
      <p>Each month it's your plan's minimum or the fee for the qualified leads we delivered, whichever is higher. Your ad budget goes straight to Google and Meta.</p>
      <span class="b-go">See pricing <i>&rarr;</i></span>
    </a>
    <a class="b-card b-check" style="--k:3" href="/free-check/">
      <h3>Free Lead-Leak Check</h3><p>Send us your website and we'll show you where customers are slipping away, plus the two or three quickest fixes. No call needed.</p>
      <span class="b-go">Get yours <i>&rarr;</i></span>
    </a>
  </div>
</div></section>

<section class="x-sec ind-strip-sec"><div class="wrap-x">
  <div class="ind-strip reveal"><span class="ind-lead">Built for service businesses like</span>${TRADES.map((t) => `<a href="/industries/${t.slug}/">${t.label}</a>`).join("")}<a class="ind-all" href="/industries/">and more <i>&rarr;</i></a></div>
</div></section>

<section class="x-sec" style="padding-top:20px"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">How it works</div><h2>Built carefully, then run every week.</h2></div><a class="x-link" href="/how-it-works/">The full process <span>&rarr;</span></a></div>
  <div class="steps3 reveal">
    <div class="st-line" aria-hidden="true"><i></i></div>
    <div class="st"><div class="n">01</div><h3>We learn the business</h3><p>Your market, your customer and what a job is worth to you, before a single dollar moves.</p></div>
    <div class="st"><div class="n">02</div><h3>We build it</h3><p>Campaigns, tracking and the page people land on, all checked before anything goes live.</p></div>
    <div class="st"><div class="n">03</div><h3>We run it</h3><p>Tuned on a set schedule, with a plain report of what you spent and what it brought back.</p></div>
  </div>
</div></section>

<section class="x-sec" style="padding-top:20px"><div class="wrap-x">
  <div class="f-strip reveal">
    <img src="/founder.jpg" width="240" height="240" alt="Bryson, founder of BoldLine Media" loading="lazy" decoding="async">
    <div><blockquote>"Most agencies get paid the same whether your phone rings or not. I didn't want to build that. I only make more when your ads do, and the websites I build have the same job: turning a visit into a call."</blockquote><div class="who">BRYSON, FOUNDER &middot; <a class="x-link" href="/about/" style="font-size:13px">About BoldLine <span>&rarr;</span></a></div><a class="f-cmp" href="/compare/">BoldLine vs a typical agency <span>&rarr;</span></a></div>
  </div>
</div></section>
${ctaBand()}
`;

const PAGES = [
  { id: "home", path: "/", file: "index.html",
    title: "BoldLine Media | Google and Meta Ads and Websites, Managed For You",
    desc: "BoldLine plans, builds and runs your Google and Meta ads, the landing pages behind them and your website. You always own your ad account.",
    body: HOME, newsletter: true, ld: ["ld-org.html"], homeRedirects: true },
  { id: "ads", path: "/ads/", file: "ads/index.html",
    title: "Google and Meta Ads Management | BoldLine Media",
    desc: "Campaigns built to find buyers, every lead tied to the ad that caused it, and reporting in plain English. You own your ad account.",
    body: pageHero("Google and Meta ads", "Ads that <em>pay for themselves.</em>", "We plan, build and run your Google and Meta ads and the landing pages behind them. Every call and form is tracked back to the ad that caused it, so you always know what's working.", `${book()}<a class="btn btn-ghost" href="/pricing/">See pricing</a>`)
      + part("journey.html") + lpGallery() + part("system.html") + part("showcase.html") + part("included.html") + ctaBand(), ld: ["ld-org.html", "ld-service.html"] },
  { id: "websites", path: "/websites/", file: "websites/index.html",
    title: "Websites for Businesses | BoldLine Media",
    desc: "Modern websites with real motion that still load fast on a phone. Three designs to choose from, $1,500 to build and $100 a month to look after.",
    body: promote(part("websites.html")) + webFaq() + ctaBand("Want a site like this?", "Book a call and we'll show you the three designs on your own business.", CAL_WEB), ld: ["ld-org.html", "ld-service.html"] },
  { id: "pricing", path: "/pricing/", file: "pricing/index.html",
    title: "Pricing | BoldLine Media",
    desc: "Ad plans for Google and Meta, and website pricing. For ads you pay your plan's minimum or the fee for qualified leads, whichever is higher. Never both.",
    body: pageHero("Pricing", "One number, <em>never two.</em>", "Each month you pay your plan's minimum or the fee for the qualified leads we delivered, whichever is higher. Your ad budget is separate and goes straight to Google and Meta on your own card.")
      + planFinder() + part("services.html") + compareNudge() + webPricing() + ctaBand(), extras: part("modal.html"), ld: ["ld-org.html", "ld-service.html"] },
  { id: "how", path: "/how-it-works/", file: "how-it-works/index.html",
    title: "How It Works | BoldLine Media",
    desc: "The same structure every time: discovery, build, launch and weekly optimization. Who we work with, and the questions people ask first.",
    body: promote(part("process.html")) + part("fit.html") + faqHtml() + ctaBand(), ld: ["ld-org.html", "faq"] },
  { id: "about", path: "/about/", file: "about/index.html",
    title: "About BoldLine Media",
    desc: "BoldLine Media only makes more when your ads do. Meet the founder, read what clients say, and leave a review.",
    body: pageHero("About", "Built so we only win <em>when you do.</em>", "BoldLine is a small, focused team that runs ads and builds websites for businesses that want a steadier phone. We take on a select group of clients on purpose.", "", true)
      + part("founder.html") + compareNudge() + part("reviews.html") + ctaBand(), ld: ["ld-org.html"] },
  { id: "check", path: "/free-check/", file: "free-check/index.html",
    title: "Free Lead-Leak Check | BoldLine Media",
    desc: "Send us your website and we'll show you where your business is quietly losing customers, plus the quickest fixes. Free, and no call required.",
    body: promote(part("leadleak.html")), ld: ["ld-org.html"] },
  { id: "contact", path: "/contact/", file: "contact/index.html",
    title: "Contact BoldLine Media",
    desc: "Book a call or send a message. We'll get back to you shortly and tell you honestly whether we're a good fit.",
    body: promote(part("contact.html")), newsletter: true, ld: ["ld-org.html"] },
  { id: "industries", path: "/industries/", file: "industries/index.html",
    title: "Who We Work With | BoldLine Media",
    desc: "Google and Meta ads and websites for service businesses: car detailers, handymen and other trades that want a steadier phone.",
    body: industriesPage(), ld: ["ld-org.html"] },
  ...TRADES.map((t) => ({ id: "trade-" + t.slug, nav: "industries", path: `/industries/${t.slug}/`, file: `industries/${t.slug}/index.html`,
    title: `Ads and Websites for ${t.label} | BoldLine Media`,
    desc: t.sub,
    body: tradePage(t), ld: ["ld-org.html"] })),
  { id: "compare", path: "/compare/", file: "compare/index.html",
    title: "BoldLine vs a Typical Agency | BoldLine Media",
    desc: "How BoldLine compares with a typical ad agency retainer: how we get paid, contract length, who owns the ad account, and what the report tells you.",
    body: comparePage(), ld: ["ld-org.html"] },
];

// The FAQ's structured data is built from the visible questions, so the two can never disagree.
function faqLd() {
  const qa = [...faqHtml().matchAll(/<summary>([\s\S]*?)<\/summary><div class="faq-a">([\s\S]*?)<\/div><\/details>/g)]
    .map((m) => ({ "@type": "Question", name: m[1].replace(/<[^>]+>/g, "").trim(), acceptedAnswer: { "@type": "Answer", text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() } }));
  return `<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa })}\n</script>\n`;
}

// Old links to sections of the single-page site (emails, bookmarks, the blog) land on the right page.
const HOME_REDIRECTS = `<script>
/* Old one-page links (boldlinemedia.com/#pricing and friends) go to the page that now holds that section. */
(function(){var m={services:'/pricing/',websites:'/websites/',included:'/pricing/',system:'/ads/',showcase:'/ads/',process:'/how-it-works/',fit:'/how-it-works/#fit',faq:'/how-it-works/#faq',founder:'/about/',reviews:'/about/#reviews','lead-leak':'/free-check/',contact:'/contact/'};
var h=(location.hash||'').slice(1);if(m[h])location.replace(m[h]);})();
</script>
`;

const header = (id) => `<header>
  <div class="nav-inner">
    <a class="nav-brand" href="/">
    <img src="/logo.png" alt="BoldLine Media" width="26" height="30">
    <span class="word">BoldLine Media</span>
    </a>
    <nav class="nav-links">
${NAV.map(([k, h, l]) => `      <a href="${h}"${k === id ? ' class="current" aria-current="page"' : ""}>${l}</a>`).join("\n")}
    </nav>
    <div class="nav-right">
      ${book("hdr-cta", "Book a Call", calFor(id))}
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
${mobileMenu(id)}
`;

const footer = () => `<footer class="x-foot"><div class="wrap-x">
  <div class="f-top">
    <div><a class="f-brand" href="/"><img src="/logo.png" alt="" width="24" height="28">BoldLine Media</a><p class="f-blurb">Google and Meta ads, landing pages and websites for businesses that want a steadier phone. You always own your ad account.</p></div>
    <div><h4>Services</h4><ul><li><a href="/ads/">Google and Meta ads</a></li><li><a href="/websites/">Websites</a></li><li><a href="/pricing/">Pricing</a></li><li><a href="/free-check/">Free Lead-Leak Check</a></li></ul></div>
    <div><h4>Who we work with</h4><ul><li><a href="/industries/car-detailing/">Car detailers</a></li><li><a href="/industries/handyman/">Handymen</a></li><li><a href="/industries/epoxy-floors/">Epoxy floor installers</a></li><li><a href="/industries/window-tint/">Tint and film shops</a></li><li><a href="/industries/">All trades</a></li><li><a href="/compare/">BoldLine vs a typical agency</a></li></ul></div>
    <div><h4>Company</h4><ul><li><a href="/how-it-works/">How it works</a></li><li><a href="/about/">About</a></li><li><a href="/blog/">Blog</a></li><li><a href="/contact/">Contact</a></li></ul></div>
    <div><h4>Legal</h4><ul><li><a href="/privacy.html">Privacy</a></li><li><a href="/terms.html">Terms</a></li></ul></div>
  </div>
  <div class="f-bottom"><div>&copy; 2026 BoldLine Media. All rights reserved.</div>${part("social.html").trim()}</div>
</div></footer>
`;

function render(p) {
  const url = SITE + p.path;
  const ld = (p.ld || []).map((n) => (n === "faq" ? faqLd() : part(n))).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${part("head-top.html").replace("<!--TEST-COPY-GUARD-->", `<script>\n${part("test-copy-guard.js")}</script>`)}<title>${p.title}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BoldLine Media">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-boldline.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.desc)}">
<meta name="twitter:image" content="${SITE}/og-boldline.jpg">
${ld}${part("head-assets.html")}<link rel="stylesheet" href="/site.css">
</head>
<body class="${p.id === "home" ? "home" : "page"}" data-page="${p.id}">
${p.homeRedirects ? HOME_REDIRECTS : ""}
<div class="ambient" aria-hidden="true">
  <div class="ow ow-a"><div class="orb"></div></div>
  <div class="ow ow-b"><div class="orb"></div></div>
  <div class="ow ow-c"><div class="orb"></div></div>
  <div class="grain"></div>
</div>
<div id="progress" aria-hidden="true"></div>

${header(p.nav || p.id)}
<main id="main">
${p.body}
${p.newsletter ? part("newsletter.html") : ""}</main>

${footer()}
${p.id === "websites" ? part("sticky.html").split(CAL).join(CAL_WEB) : part("sticky.html")}
${p.extras || ""}
<script src="/attribution.js" defer></script>
<script src="/glossary.js" defer></script>
<script src="/site.js" defer></script>
</body>
</html>
`;
}

// ── Sample websites ─────────────────────────────────────────────────────────────────────
// Bryson, 2026-10-07: "if someone click on it it not only shows that one specific home page but a full mini
// website with animations and everything". The made-up Saguaro Pool Co., rendered by the SAME builder clients
// get, in each design, all five pages, at /examples/<design>/. Labelled as a sample, hidden from search, and
// unable to send anything (KB marketing-site-pages, "Sample websites").
const SAMPLE_ORIGIN = "https://boldlinemedia.com";
// Every sample: the pool company in each of the three designs (with a design switcher), and one business per
// trade page, each in the design that suits it (no switcher; "back" returns to its trade page).
const SAMPLES = [
  ...THEME_IDS.map((t) => ({ slug: t, demo: DEMO, theme: t, switcher: true, back: "/websites/" })),
  { slug: "car-detailing", demo: DEMO_DETAIL, theme: "aurora", switcher: false, back: "/industries/car-detailing/" },
  { slug: "handyman", demo: DEMO_HANDY, theme: "editorial", switcher: false, back: "/industries/handyman/" },
  { slug: "epoxy-floors", demo: DEMO_EPOXY, theme: "cinematic", switcher: false, back: "/industries/epoxy-floors/" },
  { slug: "window-tint", demo: DEMO_TINT, theme: "aurora", switcher: false, back: "/industries/window-tint/" },
];
const samplePath = (slug, page) => `examples/${slug}/${page.path ? page.path + "/" : ""}index.html`;
const SAMPLE_PHOTOS = existsSync(join(OUT, "img", "sample")) ? readdirSync(join(OUT, "img", "sample")) : [];
function samplePage(sm, page) {
  const root = `/examples/${sm.slug}`;
  let html = renderSite(sm.demo, page.id, { base: SAMPLE_ORIGIN + root, theme: sm.theme, noindex: true });
  // Its own pages link within the sample, wherever the site is being served from (the test copy included).
  html = html.split(SAMPLE_ORIGIN + root).join(root).split(SAMPLE_ORIGIN + "/img/").join("/img/");
  // The builder describes the business to search engines; this one is made up, so that goes.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  // The sample's photos are served from our own site (img/sample/<trade>-<id>.jpg), not hot-linked.
  html = html.replace(/https:\/\/images\.pexels\.com\/photos\/(\d+)\/pexels-photo-\d+\.jpeg[^"'\s)]*/g, (m, id) => {
    const f = SAMPLE_PHOTOS.find((n) => n.endsWith(`-${id}.jpg`));
    if (!f) throw new Error(`sample photo ${id} is not in marketing-site/img/sample/`);
    return `/img/sample/${f}`;
  });
  const hasLanding = LANDING_DEMOS.some((l) => l.slug === sm.slug);
  const designs = sm.switcher ? THEME_IDS.map((t) => `<a href="/examples/${t}/${page.path ? page.path + "/" : ""}"${t === sm.theme ? ' aria-current="page"' : ""}>${SITE_THEMES[t].label}</a>`).join("")
    : hasLanding ? `<a aria-current="page" href="/examples/${sm.slug}/">Website</a><a href="/examples/${sm.slug}/landing/">Landing page</a>` : "";
  const bar = part("sample-bar.html").replace("{{DESIGNS}}", designs).replace("{{NAME}}", sm.demo.name).replace('href="/websites/"', `href="${sm.back}"`).replace(`href="${CAL}"`, `href="${CAL_WEB}"`)
    .replace('<nav class="bl-designs" aria-label="Designs"></nav>', '<span class="bl-spacer"></span>');
  html = html.replace(/<meta charset="utf-8">/i, (m) => `${m}<script>\n${part("sample-guard.js")}</script>`);
  html = html.replace(/<body([^>]*)>/i, (m) => `${m}\n${bar}`);
  return html;
}
export const SAMPLE_FILES = SAMPLES.flatMap((sm) => SAMPLE_PAGES.map((p) => samplePath(sm.slug, p)));
// Sample LANDING pages: what a click on each trade's ad lands on, built by the real landing page renderer. Same
// guard and bar as the sample websites; the bar links across to that business's full sample website.
const localPhotos = (html) => html.split(SAMPLE_ORIGIN + "/img/").join("/img/")
  .replace(/https:\/\/images\.pexels\.com\/photos\/(\d+)\/pexels-photo-\d+\.jpeg[^"'\s)]*/g, (m, id) => {
    const f = SAMPLE_PHOTOS.find((n) => n.endsWith(`-${id}.jpg`));
    if (!f) throw new Error(`sample photo ${id} is not in marketing-site/img/sample/`);
    return `/img/sample/${f}`;
  });
const landingPath = (slug) => `examples/${slug}/landing/index.html`;
function landingSample(l) {
  let html = localPhotos(renderLandingPage(l.demo));
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  if (!/<meta name="robots"/i.test(html)) html = html.replace(/<\/head>/i, '<meta name="robots" content="noindex"></head>');
  const bar = part("sample-bar.html").replace("{{NAME}}", l.demo.name)
    .replace("<b><span class=\"bl-w\">Sample site</span><span class=\"bl-n\">Sample</span></b>", "<b><span class=\"bl-w\">Sample landing page</span><span class=\"bl-n\">Sample</span></b>")
    .replace('<nav class="bl-designs" aria-label="Designs">{{DESIGNS}}</nav>', `<nav class="bl-designs" aria-label="More from this sample"><a href="/examples/${l.slug}/">Website</a><a aria-current="page" href="/examples/${l.slug}/landing/">Landing page</a></nav>`)
    .replace('href="/websites/"', `href="/industries/${l.slug}/"`);
  html = html.replace(/<meta charset="utf-8">/i, (m) => `${m}<script>\n${part("sample-guard.js")}</script>`);
  html = html.replace(/<body([^>]*)>/i, (m) => `${m}\n${bar}`);
  return html;
}
export const LANDING_FILES = LANDING_DEMOS.map((l) => landingPath(l.slug));


// test-copy.js is the same guard for the hand-written pages (privacy, terms, 404, the blog), loaded as the
// first script in their <head> so it runs before anything that could send.
const outputs = { "site.css": part("base.css") + part("menu.css") + part("new.css"), "site.js": part("site.js"), "test-copy.js": part("test-copy-guard.js") };
for (const sm of SAMPLES) for (const p of SAMPLE_PAGES) outputs[samplePath(sm.slug, p)] = samplePage(sm, p);
for (const l of LANDING_DEMOS) outputs[landingPath(l.slug)] = landingSample(l);
for (const p of PAGES) outputs[p.file] = render(p);
// The hand-written pages (privacy, terms, 404, the blog) carry their own copy of the header. Their phone menu is
// rewritten from the same source, so they can't drift back to the old long list.
const MENU_BLOCK = /  <div class="nav-mobile">[\s\S]*?\n  <\/div>\n<\/header>/;
const NAV_BLOCK = /<nav class="nav-links">[\s\S]*?<\/nav>/;
const navLinks = (id, indent) => `<nav class="nav-links">\n${NAV.map(([k, h, l]) => `${indent}  <a href="${h}"${k === id ? ' class="current" aria-current="page"' : ""}>${l}</a>`).join("\n")}\n${indent}</nav>`;
{
  const MENU_CSS = /\/\* phone-menu:start[^*]*\*\/\n[\s\S]*?\/\* phone-menu:end \*\/\n/;
  const css = readFileSync(join(OUT, "blog.css"), "utf8");
  if (!MENU_CSS.test(css)) throw new Error("blog.css: no phone-menu markers to update");
  outputs["blog.css"] = css.replace(MENU_CSS, (m) => m.slice(0, m.indexOf("*/\n") + 3) + part("menu.css") + "/* phone-menu:end */\n");
}
for (const [file, id] of [["privacy.html", ""], ["terms.html", ""], ["404.html", ""], ["netlify/lib/blog-render.mjs", "blog"]]) {
  const src = readFileSync(join(OUT, file), "utf8");
  if (!MENU_BLOCK.test(src)) throw new Error(`${file}: no phone menu block to update`);
  if (!NAV_BLOCK.test(src)) throw new Error(`${file}: no top-bar links to update`);
  const indent = (src.match(/\n([ \t]*)<nav class="nav-links">/) || ["", "    "])[1];
  outputs[file] = src.replace(MENU_BLOCK, () => mobileMenu(id)).replace(NAV_BLOCK, () => navLinks(id, indent));
}

// Run directly it writes (or with --check, compares); imported (by the tests) it only hands back what it
// would write, so a test can prove the committed pages are what the pieces produce.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [file, content] of Object.entries(outputs)) {
    const f = join(OUT, file);
    if (check) { if (!existsSync(f) || readFileSync(f, "utf8") !== content) stale.push(file); continue; }
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, content);
  }
  if (check) { if (stale.length) { console.error("marketing site is out of date:", stale.join(", ")); process.exit(1); } console.log("marketing site up to date"); }
  else console.log("built", Object.keys(outputs).join(", "));
}
export { PAGES, NAV, outputs };
