// The marketing site is several pages built from marketing-src/ by scripts/build-marketing-site.mjs
// (KB website-builder, "Multi-page site"). Bryson, 2026-10-06: "I want people to be able to quickly get
// to spots and have dedicated pages instead of quickly scrolling to them."
//
// What has to stay true for that to work:
//  1. The committed pages are exactly what the pieces build. Someone editing a generated page by hand
//     would see the edit silently undone by the next build.
//  2. Every link on every page goes somewhere that exists. Splitting one page into eight turned every
//     "#services" style link into a possible dead end, and an old bookmark or ad pointing at /#services
//     must still land on the right page.
//  3. Search engines see each page as its own page: one title, one h1, its own canonical, in the sitemap.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, MK, SITE_PAGES, readPage } from "./helpers/marketing-site.mjs";

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const { PAGES, NAV, outputs } = await import("../scripts/build-marketing-site.mjs");

// ── 1. Built, not hand-edited ───────────────────────────────────────────────────────────────
ok("the helper lists exactly the pages the generator builds",
  JSON.stringify(PAGES.map((p) => p.file)) === JSON.stringify(SITE_PAGES), PAGES.map((p) => p.file).join(", "));
const stale = Object.entries(outputs).filter(([f, c]) => !existsSync(join(MK, f)) || readFileSync(join(MK, f), "utf8") !== c).map(([f]) => f);
ok("🔴 every generated file matches its sources (run node scripts/build-marketing-site.mjs)", stale.length === 0, stale.join(", "));

// ── 2. Every link lands ─────────────────────────────────────────────────────────────────────
// Paths served by something other than a file: the blog and the site's functions.
const DYNAMIC = [/^\/blog\//, /^\/\.netlify\/functions\//, /^\/sitemap\.xml$/];
const resolves = (path) => {
  const p = path.split(/[?#]/)[0] || "/";
  if (DYNAMIC.some((re) => re.test(p))) return true;
  if (p.endsWith("/")) return existsSync(join(MK, p, "index.html"));
  // Netlify serves /privacy from privacy.html on its own.
  return existsSync(join(MK, p)) || existsSync(join(MK, p + ".html"));
};
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const file of SITE_PAGES) {
  const html = readPage(file);
  const here = ids(html);
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]);
  const dead = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//") && !resolves(h));
  ok(`${file}: every link to another page of ours exists`, dead.length === 0, [...new Set(dead)].join(", "));
  // A "#x" link only works if x is on THIS page now. These are the ones the split could have broken.
  const lost = hrefs.filter((h) => /^#[a-z]/i.test(h) && !here.has(h.slice(1)));
  ok(`${file}: every in-page jump has somewhere to land`, lost.length === 0, [...new Set(lost)].join(", "));
  // "/#founder" style links point at a homepage section that may no longer exist.
  const homeJumps = hrefs.filter((h) => /^\/#/.test(h));
  ok(`${file}: nothing links to an old homepage section`, homeJumps.length === 0, homeJumps.join(", "));
  // A client site must never point back at us, but our own site must never point at the OS.
  ok(`${file}: no link into the OS`, !/os\.boldlinemedia|boldlinemedia\.netlify\.app/.test(html));
  // 3. One page, one identity.
  ok(`${file}: exactly one h1`, (html.match(/<h1[\s>]/g) || []).length === 1, `${(html.match(/<h1[\s>]/g) || []).length}`);
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";
  const want = "https://boldlinemedia.com/" + file.replace(/index\.html$/, "");
  ok(`${file}: canonical is its own address`, canon === want, canon);
  ok(`${file}: has a description`, /<meta name="description" content="[^"]{60,}"/.test(html));
  ok(`${file}: loads the shared stylesheet and script`, html.includes('href="/site.css"') && html.includes('src="/site.js"'));
}
const titles = SITE_PAGES.map((f) => (readPage(f).match(/<title>([^<]+)<\/title>/) || [])[1]);
ok("every page has its own title", new Set(titles).size === titles.length && titles.every(Boolean), titles.join(" | "));

// Every page in the menu exists, and every page (but home) is reachable from the menu or footer.
for (const [, href] of NAV) ok(`menu link ${href} exists`, resolves(href));
{
  const home = readPage("index.html");
  for (const p of PAGES.filter((x) => x.file !== "index.html")) {
    const path = "/" + p.file.replace(/index\.html$/, "");
    ok(`${path} is linked from the homepage`, home.includes(`href="${path}"`));
  }
}

// Old addresses: /#services, /#contact etc. still reach the right page.
{
  const home = readPage("index.html");
  const map = (home.match(/var m=\{([^}]+)\}/) || [])[1] || "";
  const pairs = [...map.matchAll(/'?([a-z-]+)'?:'([^']+)'/g)].map((m) => [m[1], m[2]]);
  ok("the homepage forwards the old section links", pairs.length >= 8, map);
  for (const old of ["services", "websites", "process", "faq", "founder", "lead-leak", "contact", "reviews"]) {
    const hit = pairs.find(([k]) => k === old);
    ok(`🔴 an old /#${old} link still lands on a page`, !!hit && resolves(hit[1]), hit ? hit[1] : "no forward");
  }
}

// The sitemap lists every page, so search engines find them.
{
  const { SITE_PAGES: MAPPED } = await import("../marketing-site/netlify/functions/sitemap.mjs");
  const mapped = new Set(MAPPED.map(([p]) => p));
  for (const p of PAGES.filter((x) => x.file !== "index.html")) {
    const path = "/" + p.file.replace(/index\.html$/, "");
    ok(`the sitemap lists ${path}`, mapped.has(path));
  }
  ok("and everything it lists exists", [...mapped].every(resolves), [...mapped].filter((p) => !resolves(p)).join(", "));
}

// The hand-written pages share the same menu, so no visitor hits an old one-page menu.
for (const f of ["privacy.html", "terms.html", "404.html", "netlify/lib/blog-render.mjs"]) {
  const src = readFileSync(join(MK, f), "utf8");
  ok(`${f}: menu points at the new pages`, ["/ads/", "/websites/", "/pricing/", "/how-it-works/", "/about/"].every((h) => src.includes(`href="${h}"`)) && !/href="\/#/.test(src));
}

// What search engines (and Google's AI answers) read about us has to match the real price list. The old
// summary said ads and landing pages only, and an old $350 price lived on in Google's answers for weeks.
{
  const { WEBSITE_OFFER } = await import("../netlify/lib/pricing-shared.mjs");
  const ld = (f) => [...readPage(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [].concat(JSON.parse(m[1])));
  const org = ld("index.html").find((x) => x["@type"] === "Organization") || {};
  ok("🔴 the business summary search engines read mentions websites", /websites/i.test(org.description || "") && (org.knowsAbout || []).some((k) => /website/i.test(k)), org.description);
  for (const f of ["pricing/index.html", "websites/index.html"]) {
    const web = ld(f).find((x) => x["@type"] === "Service" && /website/i.test(x.serviceType || ""));
    const usd = (n) => `$${n.toLocaleString("en-US")}`;
    ok(`🔴 ${f}: the website service search engines read carries today's prices`,
      !!web && String(web.offers.price) === String(WEBSITE_OFFER.build) && web.offers.description.includes(usd(WEBSITE_OFFER.build)) && web.offers.description.includes(`${usd(WEBSITE_OFFER.care)} a month`),
      web ? web.offers.description : "missing");
  }
  const ads = ld("pricing/index.html").find((x) => x["@type"] === "Service" && /advertising/i.test(x.serviceType || ""));
  ok("and the ads service quotes the real $400 minimum, never the old $350", !!ads && ads.offers.price === "400" && !/350/.test(JSON.stringify(ads)));
}

// The link preview picture (what iMessage, LinkedIn and Facebook show when the site is shared). It once kept
// the old "Slow weeks" headline for a day after the site changed, because it is a separate saved picture.
{
  const card = readFileSync(join(ROOT, "marketing-src", "og-card.html"), "utf8");
  const words = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const homeH1 = words((readPage("index.html").match(/<h1 class="h-title[^"]*">([\s\S]*?)<\/h1>/) || [])[1] || "");
  const cardH1 = words((card.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || "");
  ok("🔴 the link preview picture says what the homepage headline says (re-render it with scripts/build-og-image.cjs)", !!homeH1 && homeH1 === cardH1, `home "${homeH1}" vs preview "${cardH1}"`);
  for (const f of SITE_PAGES) ok(`${f}: shares the current preview picture`, readPage(f).includes('content="https://boldlinemedia.com/og-boldline.jpg"'));
  ok("and the blog pages share it too", /og-boldline\.jpg/.test(readFileSync(join(MK, "netlify/lib/blog-render.mjs"), "utf8")));
  ok("and the picture exists", existsSync(join(MK, "og-boldline.jpg")));
}

// The pricing page's plan finder and website prices are written from the one price list when the site is built.
{
  const { PACKAGES, WEBSITE_OFFER } = await import("../netlify/lib/pricing-shared.mjs");
  const pr = readPage("pricing/index.html");
  const data = JSON.parse(((pr.match(/data-plans='([^']+)'/) || [])[1] || "[]").replace(/&#39;/g, "'"));
  const want = PACKAGES.filter((p) => /^(g|c)-/.test(p.id));
  ok("🔴 the plan finder knows every Google and combined plan at today's prices", data.length === want.length && want.every((p) => data.some((d) => d.id === p.id && d.price === p.price && d.min === p.minBudget && d.max === p.maxBudget)), JSON.stringify(data.map((d) => d.id + ":" + d.price)));
  const usd = (n) => "$" + n.toLocaleString("en-US");
  const wp = pr.slice(pr.indexOf('id="website-pricing"'), pr.indexOf("</section>", pr.indexOf('id="website-pricing"')));
  ok("🔴 the pricing page quotes today's website prices", [WEBSITE_OFFER.build, WEBSITE_OFFER.care, WEBSITE_OFFER.extraPage, WEBSITE_OFFER.blogMonthly, WEBSITE_OFFER.blogSetup].every((n) => wp.includes(usd(n))), wp.slice(0, 120));
  ok("the online store plans are still on the page, one tap away", /class="tab tab-more" data-tab="ecom"/.test(pr) && /data-open-tab="ecom"/.test(pr) && /data-panel="ecom"/.test(pr));
}

// The comparison page is reachable from where people start comparing, not only the footer (Bryson, 2026-10-07: "it's
// only accessible if someone scrolls all the way to the bottom").
{
  const body = (f) => readPage(f).split("<footer")[0];
  // The visible box or button, not just any link: pricing already had a small line of text and nobody saw it.
  for (const [f, mark] of [["pricing/index.html", 'class="cmpn reveal" href="/compare/"'], ["about/index.html", 'class="cmpn reveal" href="/compare/"'], ["index.html", 'class="f-cmp" href="/compare/"']])
    ok(`🔴 ${f}: shows the way to /compare/ above the footer`, body(f).includes(mark));
  const { PAGES: P2 } = await import("../scripts/build-marketing-site.mjs");
  ok("and every topic the box names is a row on the comparison page", (() => {
    const tags = [...readPage("pricing/index.html").matchAll(/<div class="cmpn-tags">([\s\S]*?)<\/div>/g)].flatMap((m) => [...m[1].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => x[1]));
    const cmp = readPage("compare/index.html");
    return tags.length === 3 && tags.every((t) => cmp.includes(`>${t}</div>`)) && P2.some((p) => p.id === "compare");
  })());
}

// The phone menu is grouped (Bryson, 2026-10-07: too many things under the menu, but all of them easy to reach). Every
// page's menu, the hand-written ones included, must still reach every destination, in the same grouped shape.
{
  const WANT = ["/ads/", "/websites/", "/pricing/", "/how-it-works/", "/industries/", "/about/", "/blog/", "/contact/", "/free-check/", "calendly.com/"];
  const files = [...SITE_PAGES, "privacy.html", "terms.html", "404.html", "netlify/lib/blog-render.mjs"];
  for (const f of files) {
    const src = readFileSync(join(MK, f), "utf8");
    const menu = (src.match(/<div class="nav-mobile">([\s\S]*?)\n  <\/div>\n<\/header>/) || [])[1] || "";
    const missing = WANT.filter((w) => !menu.includes(w));
    ok(`🔴 ${f}: the phone menu still reaches every page`, missing.length === 0, missing.join(", ") || "no menu found");
    ok(`${f}: the phone menu is the grouped one`, (menu.match(/class="nm-big[" ]/g) || []).length === 2 && menu.includes('class="nm-grid"') && menu.includes('class="nm-ctas"'));
  }
  const blogCss = readFileSync(join(MK, "blog.css"), "utf8");
  ok("the blog, privacy, terms and 404 pages carry the same menu styles", blogCss.includes(".nm-main{") && !/\.nav-mobile a:not\(\.hdr-cta\)/.test(blogCss));
}

// Website questions in the FAQ (Bryson, 2026-10-07). Written once, shown on /how-it-works/ and /websites/, and every
// answer leans on a promise in the website agreement. If the agreement changes, these fail so the answers get checked.
{
  const web = readFileSync(join(ROOT, "marketing-src", "faq-web.html"), "utf8");
  const qs = [...web.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  ok("the website questions exist", qs.length === 5, qs.join(" | "));
  for (const f of ["how-it-works/index.html", "websites/index.html"])
    ok(`${f}: shows every website question`, qs.every((q) => readPage(f).includes(`<summary>${q}</summary>`)));
  const ldText = readPage("how-it-works/index.html");
  ok("search engines read the website questions too (FAQ structured data)", qs.every((q) => ldText.includes(`"name":"${q.replace(/'/g, "'")}"`)));
  ok("the website answers carry no dashes", !/[\u2014\u2013]/.test(web));
  // Read from the agreement a standard client is actually sent (the wording now varies by tier: KB site-editor).
  const WD = await import("../netlify/lib/website-deal.mjs");
  const deal = WD.websiteAgreementHTML({ id: "faq", name: "Client" }, {}).toLowerCase();
  for (const [claim, term] of [
    ["the domain stays theirs", "Client owns its domain name and keeps it registered in its own name"],
    ["a first version in about two weeks", "within fourteen (14) days"],
    ["two rounds of changes before launch", "two rounds of changes before launch"],
    ["up to two small changes a month", "up to two small content changes per month"],
    ["30 days' notice to stop the care plan", "cancel the Care Plan at any time with thirty (30) days"],
    ["a copy of the site when they leave", "provide a copy of the Website&rsquo;s pages and images"],
    ["stock photos never passed off as theirs", "never be presented as Client&rsquo;s own work"],
  ]) ok(`🔴 the FAQ's "${claim}" is still what the website agreement says`, deal.includes(term.toLowerCase()));
}

// The menu button shows on a computer too (Bryson, 2026-10-07), on the generated pages and the hand-written ones.
{
  const menuCss = readFileSync(join(ROOT, "marketing-src", "menu.css"), "utf8");
  ok("the menu button is shown at every width", /\.nav-toggle\{display:flex\}/.test(menuCss) && !/@media[^{]*\{[^}]*\.nav-toggle\{display:none/.test(menuCss));
  ok("and the blog/legal stylesheet carries it", readFileSync(join(MK, "blog.css"), "utf8").includes(".nav-toggle{display:flex}"));
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-marketing-pages: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
