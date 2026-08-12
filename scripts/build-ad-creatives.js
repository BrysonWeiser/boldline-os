/* Renders BoldLine Meta/Google ad creatives to PNG at real placement sizes.
 *
 *   node scripts/build-ad-creatives.js [outputDir]
 *
 * The PNGs are deliberately NOT committed (~7.6MB, and this repo is what Netlify
 * deploys) — regenerate them whenever the copy or the palette changes.
 * Requires playwright + a Chromium; see findChrome() for the local browser path.
 * Brand tokens are read from index.html's C palette so the ads can never drift
 * from the product. No emojis (client-facing), no stock photography, no invented
 * statistics or testimonials — BoldLine has no clients yet, so every line here is
 * a claim about what the service IS, never about results it has produced. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright"); // npm i -D playwright (not a runtime dep)

const REPO = path.resolve(__dirname, "..");
const OUT = process.argv[2] || path.join(REPO, "build", "ad-creatives");
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  const root = "/opt/pw-browsers";
  const dir = fs.readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const p = dir && path.join(root, dir, "chrome-linux/chrome");
  return p && fs.existsSync(p) ? p : undefined;
}

// ── brand tokens, pulled from the live palette ──────────────────────────────
const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const seg = html.slice(html.indexOf("const C = {"), html.indexOf("const C = {") + 1400);
const C = new Function(seg.slice(0, seg.indexOf("};") + 2) + ";return C;")();
const GOLD = C.gold || "#C8A84B";
const INK = "#070810";
const TEXT = "#F4F5FB";
const DIM = "#9AA0BE";

// Logo as a data URI so the render is self-contained.
const logoPath = [ "assets/logo.png", "logo.png", "assets/boldline-logo.png" ]
  .map((p) => path.join(REPO, p)).find((p) => fs.existsSync(p));
const LOGO = logoPath ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}` : null;

// ── the creatives ───────────────────────────────────────────────────────────
// Each is a claim about the offer, not a claim about results.
const CREATIVES = [
  { id: "top-of-google", kicker: "Google Ads Management",
    head: ["Your competitors are", "buying the top of Google."],
    headAccent: 1,
    sub: "We run the ads that put you there instead — and build the page they land on.",
    cta: "Book a 30-minute call" },

  { id: "phone-ringing", kicker: "For Local Service Businesses",
    head: ["Ads that make", "the phone ring."],
    headAccent: 1,
    sub: "Managed Google Ads plus a landing page built to turn clicks into booked jobs.",
    cta: "Book a 30-minute call" },

  { id: "not-a-website", kicker: "Landing Pages That Convert",
    head: ["A website tells them", "you exist.", "A landing page", "makes them call."],
    headAccent: 3,
    sub: "Every campaign we run gets a custom page built for one job: getting the lead.",
    cta: "See what we build" },

  { id: "you-run-the-jobs", kicker: "Done-For-You Advertising",
    head: ["You run the jobs.", "We run the ads."],
    headAccent: 1,
    sub: "Campaign build, landing page, tracking and weekly optimization. One flat monthly fee.",
    cta: "Book a 30-minute call" },

  { id: "own-your-account", kicker: "How We Work",
    head: ["You own your", "ad account.", "Always."],
    headAccent: 1,
    sub: "Your account, your billing, your data. We manage it — we never hold it hostage.",
    cta: "Book a 30-minute call" },

  { id: "niche-roofing", kicker: "For Roofing Companies", niche: true,
    head: ["Roofers:", "stop buying", "shared leads."],
    headAccent: 0,
    sub: "Your own Google Ads campaign and landing page. Every lead is yours alone.",
    cta: "Book a 30-minute call" },

  { id: "niche-hvac", kicker: "For HVAC Companies", niche: true,
    head: ["HVAC:", "own the searches", "that matter."],
    headAccent: 0,
    sub: "The homeowner searching \"AC repair near me\" right now should be finding you.",
    cta: "Book a 30-minute call" },
];

// ── placements ──────────────────────────────────────────────────────────────
const SIZES = [
  { id: "square", w: 1080, h: 1080, label: "Feed (square)" },
  { id: "portrait", w: 1080, h: 1350, label: "Feed (portrait)" },
  { id: "story", w: 1080, h: 1920, label: "Stories / Reels" },
  { id: "landscape", w: 1200, h: 628, label: "Link / landscape" },
];

// Type scale per placement — a story needs bigger type than a 1200x628 banner.
const SCALE = { square: 1, portrait: 1.04, story: 1.12, landscape: 0.8 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(cr, size) {
  const k = SCALE[size.id];
  const story = size.id === "story";
  const wide = size.id === "landscape";
  // Stories reserve dead space top and bottom for the platform's own UI.
  const padY = story ? 300 : wide ? 58 : 96;
  const padX = wide ? 76 : 96;
  const headSize = (wide ? 82 : 92) * k;

  const headHTML = cr.head.map((line, i) =>
    `<div class="hl${i === cr.headAccent ? " accent" : ""}">${esc(line)}</div>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @import url('');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${size.w}px;height:${size.h}px}
  body{background:${INK};color:${TEXT};overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;
    justify-content:${wide ? "center" : "space-between"};padding:${padY}px ${padX}px;overflow:hidden}
  /* Depth: a warm gold bloom off one corner + a fine grid, no stock imagery. */
  .bloom{position:absolute;width:${size.w * 1.25}px;height:${size.w * 1.25}px;border-radius:50%;
    top:${-size.w * 0.62}px;right:${-size.w * 0.5}px;pointer-events:none;
    background:radial-gradient(circle, rgba(200,168,75,.20) 0%, rgba(200,168,75,.07) 42%, rgba(200,168,75,0) 68%)}
  .bloom2{position:absolute;width:${size.w}px;height:${size.w}px;border-radius:50%;
    bottom:${-size.w * 0.6}px;left:${-size.w * 0.42}px;pointer-events:none;
    background:radial-gradient(circle, rgba(139,92,246,.13) 0%, rgba(139,92,246,0) 65%)}
  .grid{position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);
    background-size:${72 * k}px ${72 * k}px;
    -webkit-mask-image:radial-gradient(ellipse at 50% 40%, #000 30%, transparent 78%)}
  .rule{position:absolute;left:0;top:0;width:100%;height:${Math.round(9 * k)}px;
    background:linear-gradient(90deg,${GOLD},#8B6914 55%,rgba(200,168,75,0))}
  .top{position:relative;display:flex;align-items:center;gap:${Math.round(20 * k)}px}
  .logo{width:${Math.round(78 * k)}px;height:${Math.round(78 * k)}px;object-fit:contain;flex-shrink:0}
  .mark{width:${Math.round(78 * k)}px;height:${Math.round(78 * k)}px;border-radius:${Math.round(20 * k)}px;flex-shrink:0;
    background:linear-gradient(135deg,${GOLD},#8B6914);display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(38 * k)}px;font-weight:900;color:#120E02;letter-spacing:-.03em}
  .brand{font-size:${Math.round(31 * k)}px;font-weight:900;letter-spacing:-.02em;line-height:1.1}
  .brand span{color:${GOLD}}
  .kicker{font-size:${Math.round(19 * k)}px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
    color:${GOLD};opacity:.92;margin-top:${Math.round(5 * k)}px}
  .mid{position:relative;${wide ? "margin-top:" + Math.round(30 * k) + "px" : ""}}
  .hl{font-size:${Math.round(headSize)}px;font-weight:900;letter-spacing:-.035em;line-height:1.06}
  .hl.accent{color:${GOLD}}
  .sub{font-size:${Math.round(31 * k)}px;line-height:1.5;color:${DIM};font-weight:500;
    margin-top:${Math.round(30 * k)}px;max-width:${wide ? "88%" : "94%"}}
  .bot{position:relative;display:flex;align-items:center;gap:${Math.round(24 * k)}px;flex-wrap:wrap;
    ${wide ? "margin-top:" + Math.round(34 * k) + "px" : ""}}
  .cta{display:inline-block;background:linear-gradient(135deg,${GOLD},#A8862F);color:#120E02;
    font-size:${Math.round(27 * k)}px;font-weight:900;letter-spacing:-.01em;
    padding:${Math.round(21 * k)}px ${Math.round(40 * k)}px;border-radius:${Math.round(15 * k)}px;
    box-shadow:0 ${Math.round(10 * k)}px ${Math.round(34 * k)}px rgba(200,168,75,.24)}
  .url{font-size:${Math.round(23 * k)}px;font-weight:700;color:${DIM};letter-spacing:.01em}
  </style></head><body>
  <div class="wrap">
    <div class="rule"></div><div class="bloom"></div><div class="bloom2"></div><div class="grid"></div>

    <div class="top">
      ${LOGO ? `<img class="logo" src="${LOGO}" alt="">` : `<div class="mark">B</div>`}
      <div>
        <div class="brand">BoldLine <span>Media</span></div>
        <div class="kicker">${esc(cr.kicker)}</div>
      </div>
    </div>

    <div class="mid">
      ${headHTML}
      <div class="sub">${esc(cr.sub)}</div>
    </div>

    <div class="bot">
      <span class="cta">${esc(cr.cta)}</span>
      <span class="url">boldlinemedia.com</span>
    </div>
  </div>
  </body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ["--no-sandbox"] });
  const made = [];
  for (const cr of CREATIVES) {
    for (const size of SIZES) {
      // Stories only for the strongest few — 28 files is plenty without padding it out.
      if (size.id === "story" && !["top-of-google", "phone-ringing", "you-run-the-jobs"].includes(cr.id)) continue;
      const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.setContent(page(cr, size), { waitUntil: "load" });
      await p.waitForTimeout(120);
      const file = path.join(OUT, `${cr.id}--${size.w}x${size.h}.png`);
      await p.screenshot({ path: file });
      // Overflow guard: a headline that spills off the canvas would ship broken.
      const spill = await p.evaluate(() => ({
        x: Math.max(0, document.body.scrollWidth - window.innerWidth),
        y: Math.max(0, document.body.scrollHeight - window.innerHeight),
      }));
      made.push({ file: path.basename(file), size: `${size.w}x${size.h}`, spill: spill.x + spill.y });
      await ctx.close();
    }
  }
  await browser.close();
  const bad = made.filter((m) => m.spill > 0);
  made.forEach((m) => console.log(`  ${m.spill ? "SPILL " + m.spill : "ok   "}  ${m.file}`));
  console.log(`\n${made.length} creatives -> ${OUT}${bad.length ? `  (${bad.length} OVERFLOWING)` : "  — none overflow"}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
