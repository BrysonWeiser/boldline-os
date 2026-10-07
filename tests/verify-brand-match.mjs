// One business, one look (Bryson, 2026-10-07): "make sure that the colors for a website and the landing page for the
// same example company/website have the same colors and branding". Northline's website was dark with its own typeface
// while its landing page was white with a system font. Once a client has picked a website design, the landing page
// borrows that website's background, text colours, brand colour, typefaces and corner shape (siteBrandKit). An
// ads-only client, with no design picked, keeps the landing page exactly as before.
import { renderLandingPage, landingTheme } from "../netlify/functions/landing.mjs";
import { renderSite, siteBrandKit, brandColorOf } from "../netlify/lib/site-render.mjs";
import { LANDING_DEMOS } from "../scripts/site-showcase-demo.mjs";

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const rootVar = (html, name) => ((html.match(new RegExp(`--${name}:([^;]+);`)) || [])[1] || "").trim().toLowerCase();
const base = (extra = {}) => ({ id: "c", name: "Test Co", landingSlug: "test-co", leadToken: "T", callTrackingNumber: "(480) 555-0100",
  campaignSetup: { serviceArea: "Mesa, AZ" }, landingPage: { headline: "H", ctaText: "Go", published: true, design: { layout: "split" } }, ...extra });

// 1. Every sample landing page matches its own sample website.
for (const { slug, demo } of LANDING_DEMOS) {
  const theme = demo.website && demo.website.theme;
  ok(`${slug}: the sample landing page knows its website's design`, !!theme, String(theme));
  const site = renderSite(demo, "home", { base: "https://boldlinemedia.com/examples/" + slug, theme });
  const lp = renderLandingPage(demo);
  const P = landingTheme(demo);
  ok(`🔴 ${slug}: the landing page background is the website's`, P.bg.toLowerCase() === rootVar(site, "bg"), `${P.bg} vs ${rootVar(site, "bg")}`);
  ok(`🔴 ${slug}: the landing page brand colour is the website's`, P.brand.toLowerCase() === rootVar(site, "ac"), `${P.brand} vs ${rootVar(site, "ac")}`);
  const siteFont = (site.match(/fonts\.googleapis\.com\/css2\?[^"]+/) || [])[0];
  ok(`🔴 ${slug}: the landing page loads the website's typefaces`, !!siteFont && lp.replace(/&amp;/g, "&").includes(siteFont.replace(/&amp;/g, "&")));
  ok(`${slug}: and is marked as borrowing the website's look`, /<body class="[^"]*\bkit\b/.test(lp));
}

// 2. A real client with a picked design gets the same, and the brand colour has one rule for both pages.
for (const theme of ["aurora", "cinematic", "editorial"]) {
  const cl = base({ brandColor: "#C7362F", website: { theme } });
  const site = renderSite(cl, "home", { base: "https://example.com", theme });
  const P = landingTheme(cl);
  ok(`${theme}: a client's landing page and website share a background`, P.bg.toLowerCase() === rootVar(site, "bg"));
  ok(`${theme}: and a brand colour`, P.brand.toLowerCase() === rootVar(site, "ac") && P.brand.toLowerCase() === "#c7362f");
}
{
  const cl = base({ brandColor: "#111111", website: { theme: "aurora", brandColor: "#22AA55" }, landingPage: { headline: "H", ctaText: "Go", published: true, brandColor: "#333333" } });
  ok("the website editor's colour wins over the others, on both pages", brandColorOf(cl) === "#22AA55" && landingTheme(cl).brand.toLowerCase() === "#22aa55");
  const cl2 = base({ brandColor: "#111111", website: { theme: "aurora" }, landingPage: { headline: "H", ctaText: "Go", published: true, brandColor: "#333333" } });
  ok("then the colour set by hand on the client", brandColorOf(cl2) === "#111111");
}

// 3. An ads-only client is untouched.
{
  const cl = base({ brandColor: "#C7362F" });
  ok("an ads-only client has no website look to borrow", siteBrandKit(cl) === null);
  const html = renderLandingPage(cl);
  ok("🔴 so its landing page renders exactly as before: no borrowed fonts, its own background", !/fonts\.googleapis/.test(html) && !/<body class="[^"]*\bkit\b/.test(html) && landingTheme(cl).bg === "#ffffff");
  ok("and a website object without a picked design changes nothing either", siteBrandKit(base({ website: { brandName: "X" } })) === null);
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-brand-match: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
