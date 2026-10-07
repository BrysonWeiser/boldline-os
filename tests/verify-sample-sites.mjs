// The clickable sample websites at boldlinemedia.com/examples/<design>/ (KB marketing-site-pages,
// "Sample websites"). Bryson, 2026-10-07: "if someone click on it it not only shows that one specific home
// page but a full mini website with animations and everything".
//
// They show a MADE-UP business (Saguaro Pool Co.) built by the real site builder, so the same rules as every
// other preview apply (CLAUDE.md, "A preview must never change anything real"), plus two of their own:
//  1. Nothing on them can reach anything real. The builder's contact form posts to /lead, which on
//     boldlinemedia.com forwards to the OS lead intake, so a guard runs first and stops every send.
//  2. They are labelled as a sample on every page and at every width, never indexed by search engines,
//     never described to them as a real business, and never point at a domain someone else could own.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MK, serveSite } from "./helpers/marketing-site.mjs";

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const { SAMPLE_FILES, outputs } = await import("../scripts/build-marketing-site.mjs");
const { THEME_IDS, SITE_PAGES } = await import("../netlify/lib/site-render.mjs");
const { DEMO } = await import("../scripts/site-showcase-demo.mjs");

const TRADE_SAMPLES = { "car-detailing": "/industries/car-detailing/", handyman: "/industries/handyman/", "epoxy-floors": "/industries/epoxy-floors/", "window-tint": "/industries/window-tint/" };
ok("every design gets all five pages, and so does each trade sample", SAMPLE_FILES.length === (THEME_IDS.length + Object.keys(TRADE_SAMPLES).length) * SITE_PAGES.length && THEME_IDS.length === 3, `${SAMPLE_FILES.length}`);
const { DEMO_DETAIL, DEMO_HANDY, DEMO_EPOXY, DEMO_TINT } = await import("../scripts/site-showcase-demo.mjs");
for (const d of [DEMO_DETAIL, DEMO_HANDY, DEMO_EPOXY, DEMO_TINT]) {
  ok(`🔴 ${d.name}: its email can't belong to anyone`, /@[a-z0-9.-]+\.example$/.test(d.website.publicEmail), d.website.publicEmail);
  ok(`${d.name}: its phone is a 555 number`, /555-01\d\d/.test(d.businessPhone), d.businessPhone);
}
ok("🔴 the sample business's email can't belong to anyone (a reserved .example address)", /@[a-z0-9.-]+\.example$/.test(DEMO.website.publicEmail), DEMO.website.publicEmail);
ok("and its phone is a 555 number, which is never assigned", /555-01\d\d/.test(DEMO.businessPhone), DEMO.businessPhone);

for (const f of SAMPLE_FILES) {
  const theme = f.split("/")[1];
  const html = readFileSync(join(MK, f), "utf8");
  ok(`${f}: matches what the builder makes today`, html === outputs[f]);
  // 1. The guard runs before anything else.
  const g = html.indexOf("/* Sample site guard.");
  ok(`🔴 ${f}: the send guard is the first script on the page`, g > 0 && html.indexOf("<script") === html.lastIndexOf("<script>", g) && html.indexOf("charset") < g);
  // 2. Labelled, hidden from search, not described as a real business.
  ok(`${f}: the design switcher only appears on the three-design pool sample`, /class="bl-designs"/.test(html) === !TRADE_SAMPLES[theme]);
  ok(`🔴 ${f}: says it's a sample, and on a phone too`, /class="bl-sample"/.test(html) && /<span class="bl-w">Sample site<\/span><span class="bl-n">Sample<\/span>/.test(html) && /made-up business/.test(html));
  ok(`🔴 ${f}: hidden from search engines`, /<meta name="robots" content="noindex">/.test(html));
  ok(`${f}: tells search engines nothing about the made-up business`, !/application\/ld\+json/.test(html));
  const imgs = [...html.matchAll(/(?:src|content)="([^"]+\.(?:jpe?g|png|webp))"/g)].map((m) => m[1]);
  ok(`${f}: photos come from our own site`, !/images\.pexels\.com/.test(html) && imgs.every((u) => /^\/img\/sample\/[a-z]+-\d+\.jpg$/.test(u)), imgs.filter((u) => !/^\/img\/sample\//.test(u)).join(", "));
  // Every link stays inside this sample, or is one of the bar's own (designs, back, book a call).
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]);
  const stray = hrefs.filter((h) => !(
    h.startsWith(`/examples/${theme}/`) || /^\/examples\/(cinematic|aurora|editorial)\/[a-z/]*$/.test(h)
    || h === (TRADE_SAMPLES[theme] || "/websites/") || h === "https://calendly.com/theboldlinemedia/30min"
    || /^tel:\d{3}5550\d{3}$/.test(h) || /^mailto:[^@]+@[a-z0-9.-]+\.example$/.test(h)
    || /^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(h)));
  ok(`🔴 ${f}: no link leaves the sample except the bar's own`, stray.length === 0, [...new Set(stray)].join(", "));
  ok(`🔴 ${f}: nothing points at the OS or at a real-looking business domain`, !/boldlinemedia\.netlify\.app|saguaropools\.com/.test(html));
  for (const p of SITE_PAGES) ok(`${f}: the sample's own ${p.id} page exists`, existsSync(join(MK, `examples/${theme}/${p.path ? p.path + "/" : ""}index.html`)));
}

{
  const headers = readFileSync(join(MK, "_headers"), "utf8");
  ok("🔴 the whole /examples/ folder is marked noindex at the server too", /\/examples\/\*\s*\n\s*X-Robots-Tag: noindex/.test(headers));
  const { SITE_PAGES: MAPPED } = await import("../marketing-site/netlify/functions/sitemap.mjs");
  ok("and the sitemap never lists a sample page", !MAPPED.some(([p]) => /examples/.test(p)));
  const web = readFileSync(join(MK, "websites/index.html"), "utf8");
  for (const t of THEME_IDS) ok(`the Websites page opens the ${t} sample`, web.includes(`href="/examples/${t}/"`));
  ok("and the homepage hero links into a sample", readFileSync(join(MK, "index.html"), "utf8").includes('href="/examples/cinematic/"'));
  for (const [slug, page] of Object.entries(TRADE_SAMPLES)) ok(`the ${slug} trade page opens its own sample`, readFileSync(join(MK, page.slice(1), "index.html"), "utf8").includes(`href="/examples/${slug}/"`));
}

// In a real browser: fill in and send each sample's contact form, and watch the network.
let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser here */ }
if (chromium) {
  const server = await serveSite();
  const browser = await chromium.launch({ executablePath: exe });
  for (const t of [...THEME_IDS, ...Object.keys(TRADE_SAMPLES)]) for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 860 } });
    const sent = [];
    page.on("request", (r) => { if (r.method() !== "GET" && r.method() !== "HEAD") sent.push(`${r.method()} ${r.url()}`); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(`${server.base}/examples/${t}/contact/`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const f = document.getElementById("sf");
      f.querySelectorAll("input,textarea").forEach((i) => { if (i.type === "checkbox") i.checked = true; else if (i.type === "email") i.value = "a@b.co"; else if (i.type === "tel") i.value = "6025550100"; else i.value = "Test"; });
      f.querySelector("button[type=submit]").click();
    });
    await page.waitForTimeout(600);
    const note = await page.evaluate(() => (document.querySelector(".bl-note") || {}).textContent || "");
    ok(`🔴 ${t} ${width}px: sending the contact form sends nothing at all`, sent.length === 0, sent.join(", "));
    ok(`${t} ${width}px: and says why, in plain words`, /sample website/.test(note), note);
    const s = await page.evaluate(() => ({
      bar: document.querySelector(".bl-sample").getBoundingClientRect().bottom,
      hd: document.querySelector(".hd").getBoundingClientRect().top,
      // What is actually drawn: a span inside a hidden parent still reports display:inline.
      label: [...document.querySelectorAll(".bl-sample .bl-tag b span")].filter((x) => x.getClientRects().length > 0 && x.getBoundingClientRect().width > 0).map((x) => x.textContent).join(""),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    ok(`${t} ${width}px: the sample label is visible`, /Sample/.test(s.label), s.label);
    ok(`${t} ${width}px: the site's own header sits below the sample bar, not under it`, Math.round(s.hd) >= Math.round(s.bar) - 1, JSON.stringify(s));
    ok(`${t} ${width}px: no sideways scrolling`, s.over <= 0, `${s.over}`);
    await page.close();
  }
  await browser.close();
  await server.close();
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-sample-sites: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
