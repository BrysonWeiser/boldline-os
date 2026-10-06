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
  // [design, file, width, height, scale, mobile, quality]
  const shots = [
    ["aurora", "site-hero.jpg", 1440, 900, 0.9, false, 72],
    ["cinematic", "site-phone.jpg", 390, 844, 1.5, true, 74],
    ["cinematic", "design-cinematic.jpg", 1440, 900, 0.6, false, 70],
    ["aurora", "design-aurora.jpg", 1440, 900, 0.6, false, 70],
    ["editorial", "design-editorial.jpg", 1440, 900, 0.6, false, 70],
  ];
  for (const [th, file, w, h, dpr, mobile, q] of shots) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true });
    await pg.goto("file://" + path.join(tmp, `demo-${th}.html`), { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await pg.waitForTimeout(4500);
    await pg.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: q });
    await pg.close();
    console.log(file, fs.statSync(path.join(OUT, file)).size);
  }
  await b.close();
})();
