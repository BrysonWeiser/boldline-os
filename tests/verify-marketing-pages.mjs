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

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-marketing-pages: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
