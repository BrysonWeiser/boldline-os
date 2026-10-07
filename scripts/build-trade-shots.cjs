// Pictures of sample sites for trade pages that have no photo of their own (the epoxy floor sample has none, so its
// trade page shows the sample's own first screen). Serves marketing-site/ locally, hides the "Sample site" bar,
// and saves marketing-site/img/sample/<name>-hero.jpg.  Run: NODE_PATH=<dir with playwright> node scripts/build-trade-shots.cjs
const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", "marketing-site");
// { name, url, w, h } for pictures of sample pages: the Ads page shows one card per sample landing page.
const SHOTS = ["car-detailing", "handyman", "epoxy-floors", "window-tint"].map((slug) => ({ name: `lp-${slug}`, url: `/examples/${slug}/landing/`, w: 1280, h: 800 }));
const types = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); } else { r.writeHead(404); r.end(); } });
const exe = (() => { const r = "/opt/pw-browsers"; const d = fs.existsSync(r) && fs.readdirSync(r).find((x) => /^chromium-\d+$/.test(x)); return d ? path.join(r, d, "chrome-linux/chrome") : undefined; })();
(async () => {
  await new Promise((ok) => srv.listen(0, ok));
  const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  for (const s of SHOTS) {
    const pg = await b.newPage({ viewport: { width: s.w || 1600, height: s.h || 1067 } });
    await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/fonts\./.test(r.request().url()) ? r.continue() : r.abort()));
    await pg.goto(`http://127.0.0.1:${srv.address().port}${s.url}`);
    await pg.addStyleTag({ content: ".bl-sample{display:none!important}body{padding-top:0!important}.hd{inset:0 0 auto!important}.hdr{top:0!important}" });
    await pg.waitForTimeout(3500);
    const out = path.join(ROOT, "img", "sample", `${s.name}.jpg`);
    await pg.screenshot({ path: out, type: "jpeg", quality: 82 });
    console.log("wrote", out);
    await pg.close();
  }
  // Rendered finishes for the epoxy sample (marketing-src/epoxy-renders.html): flake close up, metallic, garage.
  for (const n of [1, 2, 3]) {
    const pg = await b.newPage({ viewport: { width: 1600, height: 1067 } });
    await pg.goto("file://" + path.join(__dirname, "..", "marketing-src", "epoxy-renders.html") + "?shot=" + n);
    await pg.waitForFunction(() => document.title === "ready");
    await pg.waitForTimeout(500);
    const out = path.join(ROOT, "img", "sample", `epoxy-${n}.jpg`);
    await pg.screenshot({ path: out, type: "jpeg", quality: 84 });
    console.log("wrote", out);
    await pg.close();
  }
  await b.close(); srv.close();
})();
