// Renders marketing-src/og-card.html to the link preview picture, marketing-site/og-boldline.jpg (1200x630).
// Run: NODE_PATH=<dir with playwright> node scripts/build-og-image.cjs [outfile]
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const exe = (() => { const r = "/opt/pw-browsers"; const d = fs.existsSync(r) && fs.readdirSync(r).find((x) => /^chromium-\d+$/.test(x)); return d ? path.join(r, d, "chrome-linux/chrome") : undefined; })();
(async () => {
  const out = process.argv[2] || path.join(__dirname, "..", "marketing-site", "og-boldline.jpg");
  const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.goto("file://" + path.join(__dirname, "..", "marketing-src", "og-card.html"));
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: out, type: "jpeg", quality: 88 });
  await b.close();
  console.log("wrote", out);
})();
