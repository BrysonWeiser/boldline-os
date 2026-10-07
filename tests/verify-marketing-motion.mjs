// Scroll motion on the marketing site, measured in a real browser (KB marketing-site-pages, "Scroll motion").
//
// Bryson, 2026-10-07: "Can you add some scroll animations". What has to stay true:
//  1. Motion is an extra. Reduced motion, data saver and low-memory phones get the plain, complete page:
//     every word fully visible, nothing waiting on a scroll to appear.
//  2. With motion on, everything still ends up readable: every word lit once you've scrolled past it,
//     every step lit, and the hero lets go of the sample site and hands the page back.
//  3. The homepage headline sits on exactly three lines at every width. It broke into five on a phone
//     once, and two overlapping styles once stretched the "New enquiry" bubble over the whole picture.
//  4. No sideways scrolling at the four standard widths, motion on or off.
import { serveSite, readPage } from "./helpers/marketing-site.mjs";

let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser in this environment */ }

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

// Static checks that need no browser.
const js = readPage("site.js");
ok("the smooth-scroll library is pinned to a version and checked by its fingerprint",
  /lenis@\d+\.\d+\.\d+\/dist\/lenis\.min\.js/.test(js) && /s\.integrity='sha384-[A-Za-z0-9+/=]+'/.test(js));
ok("smooth scrolling is only for a mouse or trackpad, never a phone", /if\(fine\) addEventListener\('load'/.test(js));
ok("motion switches off for reduced motion, data saver, 2G and low memory",
  /prefers-reduced-motion: reduce/.test(js) && /saveData/.test(js) && /2g/.test(js) && /deviceMemory<4/.test(js));

if (!chromium) {
  console.log(`verify-marketing-motion: ${pass} passed (browser checks skipped, no browser here)`);
  process.exit(fails.length ? 1 : 0);
}

const server = await serveSite();
const browser = await chromium.launch({ executablePath: exe });
const WIDTHS = [390, 768, 1280, 1600];

async function open(width, path = "/", { reduce = false, init = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(server.base + path);
  await page.waitForTimeout(600);
  return { page, close: () => ctx.close() };
}
const scrollThrough = (page) => page.evaluate(async () => {
  const H = document.documentElement.scrollHeight;
  for (let y = 0; y <= H; y += 250) { window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
});

// 1. Off switches: the page is complete without motion.
for (const [label, opts] of [
  ["reduced motion", { reduce: true }],
  ["data saver", { init: "Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'}})" }],
  ["a low-memory phone", { init: "Object.defineProperty(navigator,'deviceMemory',{value:2})" }],
]) {
  const { page, close } = await open(390, "/", opts);
  const s = await page.evaluate(() => ({
    mo: document.documentElement.classList.contains("mo"),
    split: document.querySelectorAll(".wf .w").length,
    pin: document.documentElement.classList.contains("mo-pin"),
  }));
  ok(`🔴 ${label}: no scroll motion at all`, !s.mo && !s.pin && s.split === 0, JSON.stringify(s));
  await close();
}

// 2. Motion on: everything ends up readable.
for (const width of WIDTHS) {
  const { page, close } = await open(width);
  ok(`${width}px: motion is on`, await page.evaluate(() => document.documentElement.classList.contains("mo")));
  const words = await page.evaluate(() => document.querySelectorAll(".wf .w").length);
  ok(`${width}px: the headings were split into words`, words > 20, `${words}`);
  // The headline: three lines, whatever the width.
  const lines = await page.evaluate(() => {
    const t = document.querySelector(".h-title"), lh = parseFloat(getComputedStyle(t).lineHeight);
    return [...t.children].map((s) => Math.round(s.getBoundingClientRect().height / lh));
  });
  ok(`🔴 ${width}px: the headline sits on three single lines`, lines.length === 3 && lines.every((n) => n === 1), lines.join("/"));
  // The gold line is painted through its letters (background-clip:text), which cuts off anything below the
  // line box: the tails of "p" and "g" were sliced off until the line was given room underneath.
  const room = await page.evaluate(() => { const g = document.querySelector(".h-title .g"), c = getComputedStyle(g);
    return parseFloat(c.paddingBottom) / parseFloat(c.fontSize); });
  ok(`${width}px: the gold headline line has room for the tails of its letters`, room >= 0.12, room.toFixed(3));
  const toast = await page.evaluate(() => document.querySelector(".h-visual .float-toast").getBoundingClientRect().height);
  ok(`${width}px: the "New enquiry" bubble is a bubble, not a box over the picture`, toast < 60, `${Math.round(toast)}px tall`);
  await scrollThrough(page);
  // Back up to each heading in turn: once it has been on screen, all of its words are lit.
  const unlit = await page.evaluate(async () => {
    const out = [];
    for (const el of document.querySelectorAll(".wf")) {
      el.scrollIntoView({ block: "center" });
      window.scrollBy(0, Math.round(innerHeight * .3));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const n = el.querySelectorAll(".w"), on = el.querySelectorAll(".w.on");
      if (on.length !== n.length) out.push(`${el.textContent.trim().slice(0, 40)} (${on.length}/${n.length})`);
    }
    return out;
  });
  ok(`${width}px: every heading is fully lit once you've scrolled to it`, unlit.length === 0, unlit.join(" | "));
  // The example lead feed in the ads tile waits for the tiles to come on screen. It once waited for a signal
  // the tile grid never got (it is taller than a phone screen), and sat blank on every device.
  const feed = await page.evaluate(async () => {
    document.querySelector(".bento").scrollIntoView({ block: "start" });
    await new Promise((r) => setTimeout(r, 2600));
    return [...document.querySelectorAll(".mini-feed .mf")].map((m) => Number(getComputedStyle(m).opacity));
  });
  ok(`🔴 ${width}px: the example lead feed in the ads tile shows once you reach it`, feed.length === 3 && feed.every((o) => o > 0.95), feed.join(","));
  const steps = await page.evaluate(async () => {
    const s = document.querySelector(".steps3"); s.scrollIntoView({ block: "start" }); window.scrollBy(0, 200);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return [...s.querySelectorAll(".st")].map((x) => x.classList.contains("lit"));
  });
  ok(`${width}px: all three steps light up as you pass them`, steps.length === 3 && steps.every(Boolean), steps.join(","));
  // The hero lets go: past it, the sample site is back in the page flow and the buttons are usable again.
  const hero = await page.evaluate(async () => {
    window.scrollTo(0, 0); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const atTop = getComputedStyle(document.querySelector(".h-copy")).pointerEvents;
    const pinned = document.documentElement.classList.contains("mo-pin");
    return { atTop, pinned, e: getComputedStyle(document.querySelector(".h-hero")).getPropertyValue("--e").trim() };
  });
  ok(`${width}px: at the top the hero's buttons can be pressed`, hero.atTop !== "none" && Number(hero.e) < 0.05, JSON.stringify(hero));
  ok(`${width}px: the hold only happens on wide screens`, hero.pinned === width >= 1060, JSON.stringify(hero));
  ok(`${width}px: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await close();
}

// The inner pages run the same script without a homepage hero, and must not error.
for (const path of ["/pricing/", "/about/", "/how-it-works/"]) {
  const { page, close } = await open(1280, path);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await scrollThrough(page);
  ok(`${path}: scrolls through with motion on and no script errors`, errors.length === 0, errors.join(" | "));
  await close();
}

await browser.close();
await server.close();
if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-marketing-motion: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
