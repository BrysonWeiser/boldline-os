/*
 * Does anything on a landing page sit out of place? — a headless audit of every LAYOUT.
 *
 * Bryson, 2026-09-01: *"make sure everything is always uniform and not out of place"*, with a
 * screenshot of the centred layout where the headline, the button, the trust line and every
 * section heading were centred and then two pills sat hard against the left edge.
 *
 * 🔴 WHY THIS NEEDS A BROWSER AND CANNOT BE A STRING MATCH. The container WAS centred. The
 * items inside it were not, because a flex row packs to the start unless told otherwise and
 * `text-align` does nothing to flex children. Nothing in the HTML says "this is out of place";
 * only the resolved geometry does. Every alignment claim here is measured.
 *
 * 🔴 AND ANIMATIONS MUST BE KILLED FIRST. The hero entrance staggers each block by a different
 * `animation-delay`, so measuring mid-flight reports four different left edges for four blocks
 * that in fact line up perfectly. A first pass did exactly that and produced a page of
 * "misalignments" that did not exist. Measure the resting layout, never a frame of it.
 *
 * Usage:
 *   npm install --prefix "$D" playwright
 *   node tools/audit-landing-uniformity.js
 */
const path = require("path");
const { chromium } = require("playwright");

const LAYOUTS = ["split", "centered", "capture", "overlay"];
const WIDTHS = [390, 768, 1280, 1600];
const KILL_MOTION = "*{animation:none!important;transition:none!important;transform:none!important}";

(async () => {
  const { renderLandingPage } = await import(
    "file://" + path.join(__dirname, "..", "netlify", "functions", "landing.mjs")
  );

  const client = {
    name: "Stencil & Thread", landingSlug: "s", leadToken: "T", brandColor: "#4f6bed",
    callTrackingNumber: "+15415550100", mediaLibrary: [],
    campaignSetup: { serviceArea: "Eugene and Lane County, Oregon", mainOffer: "Free quote this week" },
  };
  const page = {
    headline: "Apparel, Made Easy",
    subheadline: "Fast, hassle free custom apparel for businesses, churches, clubs and organizations.",
    bullets: ["Fast turnaround", "Real proofs first", "One point of contact"],
    ctaText: "Get My Free Quote", published: true,
    steps: ["Send artwork", "We quote same day", "Shirts in hand"],
    faqs: [{ q: "How fast?", a: "About a week." }],
  };

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let problems = 0;

  for (const layout of LAYOUTS) {
    const html = renderLandingPage({ ...client, landingPage: { ...page, design: { layout, order: "a" } } });
    for (const width of WIDTHS) {
      const p = await browser.newPage({ viewport: { width, height: 1000 } });
      await p.setContent(html, { waitUntil: "load" });
      await p.addStyleTag({ content: KILL_MOTION });
      await p.waitForTimeout(150);

      const found = await p.evaluate(() => {
        const bad = [];
        const box = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
        const mid = (b) => Math.round((b.left + b.right) / 2);
        const vis = (s) => { const e = document.querySelector(s); return e && e.offsetParent !== null; };

        // 🔴 THE PAGE'S INTENT COMES FROM text-align, NOT FROM GEOMETRY. A first version
        // compared the headline's centre to the page's centre, but a LEFT-aligned headline
        // that spans the full content column has its centre there too, so three left-aligned
        // layouts were reported as centred and every one of them "failed". The block's own
        // resolved alignment is the only thing that says what the designer meant.
        const hEl = document.querySelector(".headline");
        if (!hEl) return ["no headline rendered"];
        const h = hEl.getBoundingClientRect();
        const pageMid = Math.round(document.documentElement.clientWidth / 2);
        const centred = getComputedStyle(hEl).textAlign === "center";

        // 🔴 THE CHIPS ARE THE ROW THAT WAS WRONG, AND THE GROUP IS WHAT MATTERS, NOT ONE
        // CHIP. A first version measured the FIRST chip's centre, which for a centred group of
        // three sits well left of the page centre by construction, so a correctly centred row
        // reported as broken. Measure the span from the first chip's left edge to the last
        // chip's right edge, on the top row only, since a wrapped second row has its own.
        const chips = [...document.querySelectorAll(".chip")].map((e) => e.getBoundingClientRect());
        if (chips.length) {
          const topRow = chips.filter((b) => Math.abs(b.top - chips[0].top) < 4);
          const groupLeft = Math.min(...topRow.map((b) => b.left));
          const groupRight = Math.max(...topRow.map((b) => b.right));
          const groupMid = Math.round((groupLeft + groupRight) / 2);
          const row = document.querySelector(".chips").getBoundingClientRect();
          const rowMid = Math.round((row.left + row.right) / 2);
          // Centred means the group sits in the middle of its own row, not of the viewport:
          // the row itself may be inset by the page gutter.
          const groupCentred = Math.abs(groupMid - rowMid) < 24;
          const groupAtLeft = Math.abs(groupLeft - row.left) < 24;
          if (centred && !groupCentred) bad.push(`hero is centred but the chips sit off to one side (group centre ${groupMid} vs row centre ${rowMid})`);
          if (!centred && !groupAtLeft) bad.push(`hero is left aligned but the chips do not start at the same edge (${Math.round(groupLeft)} vs ${Math.round(row.left)})`);
        }

        // Every hero block shares one left edge on a left-aligned page.
        if (!centred) {
          const edges = [".headline", ".subhead", ".ctarow", ".trust"]
            .map(box).filter(Boolean).map((b) => Math.round(b.left));
          if (new Set(edges).size > 1) bad.push(`hero blocks do not share a left edge: ${[...new Set(edges)].join(", ")}`);
        }

        // Nothing may hang off either side of the page.
        const de = document.documentElement;
        if (de.scrollWidth - de.clientWidth > 0) bad.push(`page scrolls sideways by ${de.scrollWidth - de.clientWidth}px`);
        for (const e of document.querySelectorAll("section, .wrap, .fcard, .chips, .trust, .ctarow")) {
          const b = e.getBoundingClientRect();
          if (b.width > 0 && (b.left < -1 || b.right > de.clientWidth + 1)) {
            bad.push(`${e.className || e.tagName} hangs off the page (${Math.round(b.left)} to ${Math.round(b.right)} of ${de.clientWidth})`);
          }
        }

        // The one control that must always be reachable.
        if (!vis(".cta") && !vis("#lf-btn")) bad.push("no call to action is visible");
        return bad;
      });

      if (found.length) {
        problems += found.length;
        console.log(`  ${layout} @ ${width}px`);
        found.forEach((f) => console.log(`     - ${f}`));
      }
      await p.close();
    }
  }

  await browser.close();
  console.log(problems ? `\naudit-landing-uniformity: ${problems} problem(s)` : "audit-landing-uniformity: all four layouts uniform at all four widths");
  process.exit(problems ? 1 : 0);
})();
