// Browser audit for the landing-page micro-motion layer.
//
// The node suite (tests/verify-landing-motion.mjs) checks the rules the CSS lives by.
// This checks the thing those rules exist to protect: that a REAL browser, in the three
// states a real visitor can be in, ends up looking at a complete page.
//
//   1. JavaScript ON  — the ordinary case. Everything reveals, nothing overflows.
//   2. JavaScript OFF — a surprising share of real traffic, and the state in which the
//      scroll-reveal system has already blanked this page once.
//   3. REDUCED MOTION — the visitor asked their operating system for less movement. The
//      page must be complete AND still. If the reveal un-hide line is ever dropped, this
//      is the state that shows blank sections, and only this state.
//
// Run: NODE_PATH=<scratch>/node_modules CHROMIUM_PATH=<chromium> node tools/audit-landing-motion.js
//
// It renders every layout crossed with every benefit style, at the four widths every
// BoldLine surface has to hold up at, and fails loudly rather than printing a report
// nobody reads.

const { chromium } = require(require("path").join(process.env.NODE_PATH || "node_modules", "playwright"));
const { writeFileSync, mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const WIDTHS = [390, 768, 1280, 1600];
const LAYOUTS = ["split", "centered", "overlay", "capture"];
const BENEFITS = ["cards", "list", "numbered"];

// Images are inlined. A file:// page that reaches out to the network turns this audit into
// a test of the sandbox's egress, which is exactly how it first hung for ten minutes.
const PIX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const CLIENT = {
  name: "Stencil and Thread",
  brandColor: "#C8A84B",
  callTrackingNumber: "602 555 0134",
  campaignSetup: { serviceArea: "Gilbert, Arizona", mainOffer: "Free quote this week" },
  brandVoice: { differentiator: "Same crew start to finish" },
  reviews: "They turned it around in two days — Dana R.\nStraightforward pricing — Marcus L.",
  mediaLibrary: [
    { category: "photo", url: PIX, path: "h" },
    { category: "photo", url: PIX, path: "a" },
    { category: "photo", url: PIX, path: "b" },
    { category: "photo", url: PIX, path: "c" },
  ],
  landingPage: {
    headline: "Custom work, done right the first time",
    subheadline: "Tell us what you need and we come back with a real number today.",
    bullets: [
      "Same day quotes: you hear back before the end of the day",
      "Licensed and insured: every job is covered",
      "Fixed pricing: the number we quote is the number you pay",
      "Real crews: the same team from start to finish",
    ],
    steps: ["Tell us what you need", "We send a real number", "We book the date"],
    faqs: [{ q: "How fast can you start?", a: "Most jobs begin within a week." }, { q: "Do you charge for quotes?", a: "No, quotes are free." }],
    ctaText: "Get my quote",
  },
};

let bad = 0;
const fail = (what, detail) => { bad++; console.error(`  FAIL  ${what}\n        ${detail}`); };

// Everything a visitor is meant to be able to read. If any of these is invisible or has
// no height, the page has a hole in it.
const AUDIT = `(() => {
  const out = { hidden: [], overflow: 0, moving: 0 };
  const sel = '.headline,.subhead,.sec-t,.bcard,.brow,.bnum,.step,.rev,.faq,.chip,.fcard,.cta,.foot';
  document.querySelectorAll(sel).forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (parseFloat(cs.opacity) < 0.99 || r.height < 1) {
      out.hidden.push((el.className || el.tagName) + ' opacity=' + cs.opacity + ' h=' + Math.round(r.height));
    }
  });
  out.overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  out.moving = document.getAnimations().filter((a) => a.playState === 'running').length;
  return out;
})()`;

(async () => {
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const dir = mkdtempSync(join(tmpdir(), "lpmotion-"));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  for (const layout of LAYOUTS) {
    for (const benefits of BENEFITS) {
      const file = join(dir, `${layout}-${benefits}.html`);
      writeFileSync(file, renderLandingPage({ ...CLIENT, landingPage: { ...CLIENT.landingPage, design: { layout, benefits, background: "glowgrid", shape: "rounded", font: "modern", motion: "up", order: "a" } } }));
      const url = "file://" + file;

      for (const width of WIDTHS) {
        // 1. The ordinary visitor. Waits past the 1.5s reveal safety net on purpose:
        //    measuring before it fires would report a hole that is not there.
        {
          const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
          const page = await ctx.newPage();
          await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
          await page.goto(url);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(1900);
          await page.evaluate(() => window.scrollTo(0, 0));
          const r = await page.evaluate(AUDIT);
          if (r.hidden.length) fail(`${layout}/${benefits} @${width} with script`, r.hidden.join("; "));
          if (r.overflow > 0) fail(`${layout}/${benefits} @${width} with script`, `${r.overflow}px of sideways scroll`);
          // The whole point of the change: the page should not be sitting perfectly still.
          if (r.moving < 1) fail(`${layout}/${benefits} @${width} with script`, "nothing on the page is animating");
          await ctx.close();
        }

        // 2. 🔴 Script off. The reveal system hides before it shows, so this is the state
        //    that exposes anything that quietly depends on JavaScript to become visible.
        {
          const ctx = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
          const page = await ctx.newPage();
          await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
          await page.goto(url);
          await page.waitForTimeout(200);
          // Measured through the browser's own box model rather than by running script in
          // the page, because there is no script in the page: that is the state under test.
          const handles = await page.$$(".headline,.bcard,.brow,.bnum,.step,.rev,.faq,.chip,.fcard,.foot");
          if (!handles.length) fail(`${layout}/${benefits} @${width} without script`, "nothing rendered at all");
          let flat = 0;
          for (const h of handles) {
            const box = await h.boundingBox();
            if (!box || box.height < 1) flat++;
          }
          if (flat) fail(`${layout}/${benefits} @${width} without script`, `${flat} of ${handles.length} elements have no height`);
          await ctx.close();
        }

        // 3. 🔴 Reduced motion. Complete AND still.
        {
          const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
          const page = await ctx.newPage();
          await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
          await page.goto(url);
          await page.waitForTimeout(400);
          const r = await page.evaluate(AUDIT);
          if (r.hidden.length) fail(`${layout}/${benefits} @${width} reduced motion`, r.hidden.join("; "));
          if (r.overflow > 0) fail(`${layout}/${benefits} @${width} reduced motion`, `${r.overflow}px of sideways scroll`);
          if (r.moving > 0) fail(`${layout}/${benefits} @${width} reduced motion`, `${r.moving} animations still running`);
          await ctx.close();
        }
      }
    }
  }

  await browser.close();
  console.log(bad ? `\n✗ audit-landing-motion: ${bad} problem(s)` : "audit-landing-motion: every layout complete with script, without script, and with reduced motion");
  process.exit(bad ? 1 : 0);
})();
