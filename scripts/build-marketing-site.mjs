// Builds BoldLine's marketing site as separate pages from the pieces in marketing-src/ (KB website-builder,
// "Multi-page site"). Every page shares one header, footer, stylesheet and script, so they can never drift.
//
//   node scripts/build-marketing-site.mjs          writes marketing-site/{index,ads,websites,...}.html + site.css/js
//   node scripts/build-marketing-site.mjs --check  exits 1 if the committed pages are not what the sources build
//
// Edit the pieces in marketing-src/ (or the page list below), never the generated pages.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { renderSite, THEME_IDS, SITE_THEMES, SITE_PAGES as SAMPLE_PAGES } from "../netlify/lib/site-render.mjs";
import { DEMO } from "./site-showcase-demo.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "marketing-src");
const OUT = join(ROOT, "marketing-site");
const part = (n) => readFileSync(join(SRC, n), "utf8");
const SITE = "https://boldlinemedia.com";
const CAL = "https://calendly.com/theboldlinemedia/30min";
const book = (cls = "btn", label = "Book a Call") => `<a class="${cls}" href="${CAL}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// The first section's heading becomes the page's one <h1>, so a page that opens on an existing section
// still has a proper title for search engines.
const promote = (html) => {
  const i = html.indexOf("<h2"); if (i < 0) return html;
  const j = html.indexOf("</h2>", i);
  return html.slice(0, i) + "<h1" + html.slice(i + 3, j) + "</h1>" + html.slice(j + 5);
};

// ── The pages ───────────────────────────────────────────────────────────────────────────
const NAV = [["ads", "/ads/", "Ads"], ["websites", "/websites/", "Websites"], ["pricing", "/pricing/", "Pricing"], ["how", "/how-it-works/", "How it works"], ["about", "/about/", "About"], ["blog", "/blog/", "Blog"]];
const MOBILE_EXTRA = [["check", "/free-check/", "Free Lead-Leak Check"], ["contact", "/contact/", "Contact"]];

const icons = [...part("showcase.html").matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);

const ctaBand = (title = "Ready for a steadier phone?", sub = "A 30 minute call. We'll tell you straight whether we're a fit, and what we'd do first.") => `
<section class="cta-band"><div class="wrap-x"><div class="cta-box reveal">
  <div><h2>${title}</h2><p>${sub}</p></div>
  <div class="hero-ctas">${book()}<a class="btn btn-ghost" href="/free-check/">Free Lead-Leak Check</a></div>
</div></div></section>
`;

const pageHero = (eyebrow, h1, sub, ctas = "") => `
<section class="page-hero"><div class="wrap-x reveal">
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
        <img class="stage-shot" src="/img/site-hero.jpg" width="1296" height="810" alt="A sample website built by BoldLine, on a computer" decoding="async" fetchpriority="high">
      </div>
      <div class="phone" aria-hidden="true"><img src="/img/site-phone.jpg" width="585" height="1266" alt="" decoding="async"></div>
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
    <a class="b-card b-ads" style="--k:0" href="/ads/">
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
      <div class="b-thumbs" aria-hidden="true"><img src="/img/design-editorial.jpg" width="864" height="540" alt="" loading="lazy" decoding="async"><img src="/img/design-cinematic.jpg" width="864" height="540" alt="" loading="lazy" decoding="async"><img src="/img/design-aurora.jpg" width="864" height="540" alt="" loading="lazy" decoding="async"></div>
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
    <div><blockquote>"Most agencies get paid the same whether your phone rings or not. I didn't want to build that. I only make more when your ads do, and the websites I build have the same job: turning a visit into a call."</blockquote><div class="who">BRYSON, FOUNDER &middot; <a class="x-link" href="/about/" style="font-size:13px">About BoldLine <span>&rarr;</span></a></div></div>
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
      + part("system.html") + part("showcase.html") + part("included.html") + ctaBand(), ld: ["ld-org.html", "ld-service.html"] },
  { id: "websites", path: "/websites/", file: "websites/index.html",
    title: "Websites for Businesses | BoldLine Media",
    desc: "Modern websites with real motion that still load fast on a phone. Three designs to choose from, $1,500 to build and $100 a month to look after.",
    body: promote(part("websites.html")) + ctaBand("Want a site like this?", "Book a call and we'll show you the three designs on your own business."), ld: ["ld-org.html", "ld-service.html"] },
  { id: "pricing", path: "/pricing/", file: "pricing/index.html",
    title: "Pricing | BoldLine Media",
    desc: "Plans for Google Ads, Meta Ads, both, and online stores. You pay your plan's minimum or the fee for qualified leads, whichever is higher. Never both.",
    body: pageHero("Pricing", "One number, <em>never two.</em>", "Each month you pay your plan's minimum or the fee for the qualified leads we delivered, whichever is higher. Your ad budget is separate and goes straight to Google and Meta on your own card.")
      + part("services.html") + ctaBand(), extras: part("modal.html"), ld: ["ld-org.html", "ld-service.html"] },
  { id: "how", path: "/how-it-works/", file: "how-it-works/index.html",
    title: "How It Works | BoldLine Media",
    desc: "The same structure every time: discovery, build, launch and weekly optimization. Who we work with, and the questions people ask first.",
    body: promote(part("process.html")) + part("fit.html") + part("faq.html") + ctaBand(), ld: ["ld-org.html", "faq"] },
  { id: "about", path: "/about/", file: "about/index.html",
    title: "About BoldLine Media",
    desc: "BoldLine Media only makes more when your ads do. Meet the founder, read what clients say, and leave a review.",
    body: pageHero("About", "Built so we only win <em>when you do.</em>", "BoldLine is a small, focused team that runs ads and builds websites for businesses that want a steadier phone. We take on a select group of clients on purpose.")
      + part("founder.html") + part("boutique.html") + part("reviews.html") + ctaBand(), ld: ["ld-org.html"] },
  { id: "check", path: "/free-check/", file: "free-check/index.html",
    title: "Free Lead-Leak Check | BoldLine Media",
    desc: "Send us your website and we'll show you where your business is quietly losing customers, plus the quickest fixes. Free, and no call required.",
    body: promote(part("leadleak.html")), ld: ["ld-org.html"] },
  { id: "contact", path: "/contact/", file: "contact/index.html",
    title: "Contact BoldLine Media",
    desc: "Book a call or send a message. We'll get back to you shortly and tell you honestly whether we're a good fit.",
    body: promote(part("contact.html")), newsletter: true, ld: ["ld-org.html"] },
];

// The FAQ's structured data is built from the visible questions, so the two can never disagree.
function faqLd() {
  const qa = [...part("faq.html").matchAll(/<summary>([\s\S]*?)<\/summary><div class="faq-a">([\s\S]*?)<\/div><\/details>/g)]
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
      ${book("hdr-cta")}
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="nav-mobile">
${[...NAV, ...MOBILE_EXTRA].map(([k, h, l]) => `    <a href="${h}"${k === id ? ' class="current" aria-current="page"' : ""}>${l}</a>`).join("\n")}
    ${book("hdr-cta")}
  </div>
</header>
`;

const footer = () => `<footer class="x-foot"><div class="wrap-x">
  <div class="f-top">
    <div><a class="f-brand" href="/"><img src="/logo.png" alt="" width="24" height="28">BoldLine Media</a><p class="f-blurb">Google and Meta ads, landing pages and websites for businesses that want a steadier phone. You always own your ad account.</p></div>
    <div><h4>Services</h4><ul><li><a href="/ads/">Google and Meta ads</a></li><li><a href="/websites/">Websites</a></li><li><a href="/pricing/">Pricing</a></li><li><a href="/free-check/">Free Lead-Leak Check</a></li></ul></div>
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
<body class="${p.id === "home" ? "home" : "page"} page-${p.id}">
${p.homeRedirects ? HOME_REDIRECTS : ""}
<div class="ambient" aria-hidden="true">
  <div class="ow ow-a"><div class="orb"></div></div>
  <div class="ow ow-b"><div class="orb"></div></div>
  <div class="ow ow-c"><div class="orb"></div></div>
  <div class="grain"></div>
</div>
<div id="progress" aria-hidden="true"></div>

${header(p.id)}
<main id="main">
${p.body}
${p.newsletter ? part("newsletter.html") : ""}</main>

${footer()}
${part("sticky.html")}
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
const samplePath = (theme, page) => `examples/${theme}/${page.path ? page.path + "/" : ""}index.html`;
function samplePage(theme, page) {
  const root = `/examples/${theme}`;
  let html = renderSite(DEMO, page.id, { base: SAMPLE_ORIGIN + root, theme, noindex: true });
  // Its own pages link within the sample, wherever the site is being served from (the test copy included).
  html = html.split(SAMPLE_ORIGIN + root).join(root);
  // The builder describes the business to search engines; this one is made up, so that goes.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  // The sample's photos are served from our own site (img/sample/), not hot-linked from the photo library.
  html = html.replace(/https:\/\/images\.pexels\.com\/photos\/(\d+)\/pexels-photo-\d+\.jpeg[^"'\s)]*/g, (m, id) => {
    if (!existsSync(join(OUT, "img", "sample", `pool-${id}.jpg`))) throw new Error(`sample photo ${id} is not in marketing-site/img/sample/`);
    return `/img/sample/pool-${id}.jpg`;
  });
  const designs = THEME_IDS.map((t) => `<a href="/examples/${t}/${page.path ? page.path + "/" : ""}"${t === theme ? ' aria-current="page"' : ""}>${SITE_THEMES[t].label}</a>`).join("");
  html = html.replace(/<meta charset="utf-8">/i, (m) => `${m}<script>\n${part("sample-guard.js")}</script>`);
  html = html.replace(/<body([^>]*)>/i, (m) => `${m}\n${part("sample-bar.html").replace("{{DESIGNS}}", designs)}`);
  return html;
}
export const SAMPLE_FILES = THEME_IDS.flatMap((t) => SAMPLE_PAGES.map((p) => samplePath(t, p)));

// test-copy.js is the same guard for the hand-written pages (privacy, terms, 404, the blog), loaded as the
// first script in their <head> so it runs before anything that could send.
const outputs = { "site.css": part("base.css") + part("new.css"), "site.js": part("site.js"), "test-copy.js": part("test-copy-guard.js") };
for (const t of THEME_IDS) for (const p of SAMPLE_PAGES) outputs[samplePath(t, p)] = samplePage(t, p);
for (const p of PAGES) outputs[p.file] = render(p);

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
