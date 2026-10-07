// Photographs the sample website (scripts/site-showcase-demo.mjs) in all three designs for the homepage.
// Run: node scripts/build-site-showcase.cjs   (needs Playwright + Chromium). Writes marketing-site/img/*.jpg
const path = require("path"), fs = require("fs"), os = require("os");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "marketing-site/img");
const chrome = () => { const r = "/opt/pw-browsers"; const d = fs.existsSync(r) && fs.readdirSync(r).find((x) => /^chromium-\d+$/.test(x)); return d ? path.join(r, d, "chrome-linux/chrome") : undefined; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-"));
  const { writeDemoPages } = await import(path.join(ROOT, "scripts/site-showcase-demo.mjs"));
  writeDemoPages(tmp);
  const b = await chromium.launch({ executablePath: chrome(), args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  // The designs load their typefaces from Google Fonts. Where the browser can't reach them directly (a sandbox or proxy),
  // every shot silently falls back to a system font and stops looking like the real sample site, so fonts are fetched
  // with curl and handed to the page. Anything that can't be fetched just carries on as before.
  const { execFileSync } = require("child_process");
  const fontCache = new Map();
  const serveFont = async (route) => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) fontCache.set(url, execFileSync("curl", ["-sfL", "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", url], { maxBuffer: 1 << 24 }));
      const body = fontCache.get(url);
      await route.fulfill({ status: 200, body, headers: { "content-type": /googleapis/.test(url) ? "text/css" : "font/woff2", "access-control-allow-origin": "*" } });
    } catch { await route.continue().catch(() => {}); }
  };
  // [design, file, width, height, scale, mobile, quality]
  // Shot at full and double sharpness: the homepage serves the sharp pair to big and high-density screens (srcset), so
  // the small text inside the screenshots stays crisp when the hero grows on scroll. Phones get the lighter one.
  const shots = [
    ["aurora", "site-hero.jpg", 1440, 900, 1, false, 78],
    ["aurora", "site-hero-2x.jpg", 1440, 900, 2, false, 74],
    ["cinematic", "site-phone.jpg", 390, 844, 2, true, 76],
    ["cinematic", "site-phone-2x.jpg", 390, 844, 3, true, 72],
    ["cinematic", "design-cinematic.jpg", 1440, 900, 1, false, 74],
    ["aurora", "design-aurora.jpg", 1440, 900, 1, false, 74],
    ["editorial", "design-editorial.jpg", 1440, 900, 1, false, 74],
  ];
  for (const [th, file, w, h, dpr, mobile, q] of shots) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true });
    await pg.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, serveFont);
    await pg.goto("file://" + path.join(tmp, `demo-${th}.html`), { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await pg.waitForTimeout(4500);
    await pg.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: q });
    await pg.close();
    console.log(file, fs.statSync(path.join(OUT, file)).size);
  }
  await b.close();
})();
