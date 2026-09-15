// Several landing pages on one account, and the address they answer at.
//
// Bryson, 2026-09-15: *"i want to run an ad targeting car detailers i want to have a landing page
// that fits that ad ... and then I also want the ability to run a seperate ad lets say for roofers
// and have a landing page that fits that ad"*.
import { readFileSync } from "node:fs";
import assert from "node:assert";
import { renderLandingPage } from "../netlify/functions/landing.mjs";
import { pageSlug, freeSlug, findPage, listPages, clientForPage, newPage, publicUrlFor, slugsTaken }
  from "../netlify/lib/landing-pages-shared.mjs";

let pass = 0; const fails = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fails.push(`${name} — ${e.message}`); } };
const osToml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const siteToml = readFileSync(new URL("../marketing-site/netlify.toml", import.meta.url), "utf8");
const landing = readFileSync(new URL("../netlify/functions/landing.mjs", import.meta.url), "utf8");

const ACCOUNT = {
  id: "house", internal: true, name: "BoldLine Media", landingSlug: "boldline", leadToken: "TOK",
  businessPhone: "(602) 555-0100", campaignSetup: { serviceArea: "Phoenix, AZ" },
  landingPage: { headline: "Ads that pay for themselves", subheadline: "S", ctaText: "Book a call", published: true },
  landingPages: [
    newPage({ label: "Car Detailers", slug: "car-detailers",
      page: { headline: "More detailing jobs, booked", subheadline: "For detailers", ctaText: "Get my plan",
        bullets: ["Calls, not clicks"], published: true } }),
    newPage({ label: "Roofers", slug: "roofers",
      page: { headline: "Roofing leads that answer", subheadline: "For roofers", ctaText: "Get my plan",
        bullets: ["Storm season ready"], published: true } }),
  ],
};

// ── 1. Addresses cannot collide ─────────────────────────────────────────────
t("a name becomes a usable address", () => {
  assert.equal(pageSlug("Car Detailers & Valeting!"), "car-detailers-and-valeting");
  assert.equal(pageSlug("   Roofers   "), "roofers");
});

t("🔴 a second page cannot take an address that is already answering", () => {
  // Two pages on one address is a coin flip over which one a paid click lands on, and the
  // loser is invisible: live, listed in the OS, and never visited.
  assert.equal(freeSlug(ACCOUNT, "Roofers"), "roofers-2");
  assert.equal(freeSlug(ACCOUNT, "Car Detailers"), "car-detailers-2");
});

t("🔴 and it cannot take the account's own address either", () => {
  assert.equal(freeSlug(ACCOUNT, "BoldLine"), "boldline-2",
    "the main page would be shadowed by an audience page and nobody would know which won");
  assert.ok(slugsTaken(ACCOUNT).has("boldline"));
});

t("renaming a page keeps its own address available to itself", () => {
  const id = ACCOUNT.landingPages[1].id;
  assert.equal(freeSlug(ACCOUNT, "Roofers", id), "roofers", "editing a page renamed it to roofers-2");
});

// ── 2. The right page renders ───────────────────────────────────────────────
t("each audience page renders its own words, through the real renderer", () => {
  for (const p of listPages(ACCOUNT)) {
    const html = renderLandingPage(clientForPage(ACCOUNT, p));
    assert.match(html, new RegExp(p.page.headline.slice(0, 18)), `${p.slug} rendered the wrong headline`);
    assert.ok(!html.includes("Ads that pay for themselves"),
      `${p.slug} rendered the ACCOUNT's main page instead of its own`);
  }
});

t("the account's own page is untouched by any of this", () => {
  assert.match(renderLandingPage(ACCOUNT), /Ads that pay for themselves/);
});

t("looking a page up is case-insensitive and misses cleanly", () => {
  assert.equal(findPage(ACCOUNT, "ROOFERS").slug, "roofers");
  assert.equal(findPage(ACCOUNT, "plumbers"), null);
  assert.equal(findPage(ACCOUNT, ""), null);
});

// ── 3. 🔴 THE PROXY, AND THE THING THAT SILENTLY BREAKS IT ──────────────────
t("the public address is on the marketing domain, not a netlify.app one", () => {
  assert.equal(publicUrlFor({ slug: "roofers" }), "https://boldlinemedia.com/for/roofers");
});

t("the marketing site proxies /for/ to the OS", () => {
  assert.match(siteToml, /from = "\/for\/:slug"/);
  assert.match(siteToml, /to = "https:\/\/boldlinemedia\.netlify\.app\/lp\/:slug"/);
  assert.match(siteToml, /from = "\/for\/:slug\/"/, "a trailing slash would 404");
});

t("🔴 and it proxies the lead endpoint, which is the one that gets forgotten", () => {
  // The form posts to a RELATIVE path. Served on boldlinemedia.com it posts THERE, where no
  // such thing exists, so every enquiry 404s while the ads keep spending and the visitor just
  // sees "something went wrong".
  assert.match(siteToml, /from = "\/lead"/);
  assert.match(siteToml, /to = "https:\/\/boldlinemedia\.netlify\.app\/lead"/);
});

t("the OS actually answers at /lead, or the proxy points at nothing", () => {
  assert.match(osToml, /from = "\/lead"\s*\n\s*to = "\/\.netlify\/functions\/lead-intake"\s*\n\s*status = 200/);
});

t("the form does not post to a Netlify-reserved path", () => {
  assert.ok(!/fetch\('\/\.netlify\/functions\/lead-intake/.test(landing),
    "/.netlify/* is reserved by Netlify and cannot be proxied from another site");
  assert.match(landing, /fetch\('\/lead\?token=/);
});

// 🔴 THE GENERAL GUARD, AND THE REASON THIS FILE EXISTS RATHER THAN A ONE-OFF CHECK.
// Any relative address on this page resolves against whatever domain is showing it. Today
// exactly one exists and it is proxied. A second one added later would work perfectly in
// testing on our own domain and fail only on the proxied address, where the money is.
t("🔴 a landing page uses exactly ONE relative address, and it is the proxied one", () => {
  const html = renderLandingPage(clientForPage(ACCOUNT, ACCOUNT.landingPages[0]));
  const rel = new Set();
  for (const m of html.matchAll(/(?:src|href|action)=["'](\/[^"']*)["']/g)) rel.add(m[1]);
  for (const m of html.matchAll(/fetch\(\s*['"`](\/[^'"`]*)['"`]/g)) rel.add(m[1]);
  const paths = [...rel].map((u) => u.split("?")[0]);
  assert.deepEqual([...new Set(paths)], ["/lead"],
    `every one of these must be proxied on the marketing domain or it 404s there: ${paths.join(", ")}`);
});

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-landing-pages: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
