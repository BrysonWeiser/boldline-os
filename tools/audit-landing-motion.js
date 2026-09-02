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
  const vh = window.innerHeight || 0;
  document.querySelectorAll(sel).forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    // Only judge what the visitor can actually see right now, and stay clear of the strip
    // at the very bottom of the screen. The reveal observer deliberately holds its trigger
    // line 6% short of the fold so content does not animate while half of it is off screen;
    // an element peeking into that strip is CORRECTLY still waiting, not a hole in the page.
    if (r.bottom < 4 || r.top > vh * 0.88) return;
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

  // The full sweep is 144 page loads and takes minutes. AUDIT_ONLY=behaviour skips it and
  // runs just the drive-the-page checks at the end, which is what you want when bisecting one.
  const ONLY = process.env.AUDIT_ONLY || "";

  for (const layout of LAYOUTS) {
    for (const benefits of BENEFITS) {
      const file = join(dir, `${layout}-${benefits}.html`);
      writeFileSync(file, renderLandingPage({ ...CLIENT, landingPage: { ...CLIENT.landingPage, design: { layout, benefits, background: "glowgrid", shape: "rounded", font: "modern", motion: "up", order: "a" } } }));
      const url = "file://" + file;
      if (ONLY === "behaviour") continue;

      for (const width of WIDTHS) {
        // 1. The ordinary visitor, READING DOWN THE PAGE. Walked a screen at a time rather
        //    than measured once from the top, because reveals now re-arm when they go off
        //    screen: an element well below the viewport is SUPPOSED to be hidden, and a
        //    single measurement from the top would report the whole page as a hole.
        //    What has to be true is narrower and more honest: whatever is on screen, at any
        //    scroll position, is fully visible.
        {
          const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
          const page = await ctx.newPage();
          await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
          await page.goto(url);
          const total = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < total; y += 700) {
            await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
            await page.waitForTimeout(1400);
            const r = await page.evaluate(AUDIT);
            if (r.hidden.length) fail(`${layout}/${benefits} @${width} reading at y=${y}`, r.hidden.join("; "));
            if (r.overflow > 0) fail(`${layout}/${benefits} @${width} reading at y=${y}`, `${r.overflow}px of sideways scroll`);
            if (r.moving < 1) fail(`${layout}/${benefits} @${width} reading at y=${y}`, "nothing on the page is animating");
          }
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

  // ── 🔴 THE TWO THINGS ONLY A BROWSER CAN SEE ───────────────────────────────────
  // Both of these shipped broken and both read as correct in the source. Neither the
  // stylesheet nor the script says anything is wrong; you have to drive the page.
  {
    const file = join(dir, "split-cards.html");
    const url = "file://" + file;

    // (1) REPLAY. Scroll to a section, scroll away, scroll back. It must animate again.
    //     The old script un-observed on first sight, so it never could.
    for (const path of ["scrolls early", "scrolls late"]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
      await page.goto(url);
      // "early" scrolls before the 1.5s safety net, "late" after it. They take different
      // paths through the script and both were broken in different ways at some point.
      await page.waitForTimeout(path === "scrolls early" ? 300 : 2200);

      const at = async (y) => { await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); await page.waitForTimeout(700); };
      const state = () => page.evaluate(() => {
        const el = document.querySelector(".faq");
        return !el ? "missing" : (el.classList.contains("in") ? "revealed" : "armed");
      });
      const faqY = await page.evaluate(() => document.querySelector(".faq").offsetTop - 300);

      await at(120);
      // 🔴 SIT HERE UNTIL THE 1.5s SAFETY NET HAS DEFINITELY HAD ITS CHANCE, THEN LOOK.
      // A first version of this check scrolled straight on to the section and reached it
      // before the net fired, so it passed for the wrong reason and a mutation that removed
      // the net's stand-down went completely undetected. The whole question on this path is
      // whether the net revealed the rest of the page behind the visitor's back, and the
      // only way to ask it is to wait the net out first.
      await page.waitForTimeout(1800);
      if (await state() !== "armed") fail(`replay (${path})`, "a section far below the fold was revealed behind the visitor's back, so it can never animate");
      await at(faqY);
      if (await state() !== "revealed") fail(`replay (${path})`, "a section did not reveal when scrolled to");
      await at(0);
      if (await state() !== "armed") fail(`replay (${path})`, "a section stayed revealed after scrolling away, so it can never play again");
      await at(faqY);
      if (await state() !== "revealed") fail(`replay (${path})`, "a section did not play a second time");
      await ctx.close();
    }

    // (2) HOVER ACTUALLY MOVES SOMETHING. 🔴 Every hover lift on this page was dead on
    //     arrival: `.js .reveal.in` outranks `.bcard:hover` on specificity, so it pinned
    //     transform to none and the cards never moved. Every rule read correctly. Checking
    //     that the CSS contains a hover rule would have passed happily.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : route.abort()));
    await page.goto(url);
    await page.waitForTimeout(1800);
    for (const sel of [".bcard", ".step", ".rev", ".chip"]) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.mouse.move(4, 4);
      await page.waitForTimeout(250);
      const before = await el.evaluate((e) => getComputedStyle(e).transform);
      await el.hover();
      await page.waitForTimeout(350);
      const after = await el.evaluate((e) => getComputedStyle(e).transform);
      if (after === before) fail(`hover on ${sel}`, `nothing moved (${before}). a reveal rule is probably outranking the hover state`);
    }
    // And the press, which is what a visitor gets on a phone where there is no hover at all.
    const cta = page.locator(".cta").first();
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await cta.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(160);
    const pressed = await cta.evaluate((e) => getComputedStyle(e).transform);
    await page.mouse.up();
    if (pressed === "none") fail("press on the main button", "the button does not acknowledge a press, which is all a phone visitor gets");
    await ctx.close();
  }

  await browser.close();
  console.log(bad ? `\n✗ audit-landing-motion: ${bad} problem(s)` : "audit-landing-motion: every layout complete with script, without script, and with reduced motion");
  process.exit(bad ? 1 : 0);
})();
