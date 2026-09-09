// Runs the REAL save() out of CropStudio in a headless browser, against a real image, and
// inspects the pixels of the blob it tries to upload. Pattern-matching cannot tell you a
// crop cut the right part of the picture, and a crop that reads the wrong region is
// invisible in review and obvious on a client's page.
//
// No React needed: save() has no JSX. Its dependencies (imgRef, box, nat, media, client,
// setBusy, setErr, onDone, fetch) are supplied as plain variables, so the code under test is
// the file's own, character for character.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let chromium = null, exe = "";
try {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
  exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
} catch { /* no browser in this environment */ }
if (!chromium) {
  console.log("verify-crop-pixels: skipped, no browser in this environment");
  process.exit(0);
}
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const S = readFileSync(join(ROOT, "index.html"), "utf8");
const comp = S.slice(S.indexOf("function CropStudio("), S.indexOf("function LaunchChecklistCard("));
const saveSrc = comp.slice(comp.indexOf("  const save = async () => {"), comp.indexOf("  return (\n    <div style={{position:\"fixed\""));
if (!saveSrc.includes("toBlob")) { console.error("could not extract save()"); process.exit(1); }

writeFileSync("/tmp/claude-0/crop.html", `<!doctype html><meta charset=utf-8><body>
<img id="pic" style="max-width:180px;display:block">
<script>
// 400x400: top-left quadrant RED, the rest BLUE.
const c=document.createElement('canvas'); c.width=400; c.height=400;
const x=c.getContext('2d'); x.fillStyle='#0000ff'; x.fillRect(0,0,400,400);
x.fillStyle='#ff0000'; x.fillRect(0,0,200,200);
document.getElementById('pic').src=c.toDataURL('image/png');

window.__run = async (bx,by,bw,bh) => {
  const el = document.getElementById('pic');
  const imgRef = { current: el };
  const nat = { w: el.naturalWidth, h: el.naturalHeight };
  const box = { x:bx, y:by, w:bw, h:bh };
  const media = { url: el.src, label: 'shot.png', path: 'p/1', category: 'photo' };
  const client = { portalToken: 'tok' };
  let sent = null, done = null, err = '';
  const setBusy = () => {}, setErr = (m) => { err = m; };
  const onDone = (lib) => { done = lib; };
  const fetch = async (url, opt) => {
    if (String(url).includes('action=sign')) return { ok:true, json: async () => ({ ok:true, signedUrl:'/put', path:'p/2' }) };
    if (String(url) === '/put') { sent = opt.body; return { ok:true }; }
    return { ok:true, json: async () => ({ ok:true, mediaLibrary:[{ path:'p/1', category:'photo' },{ path:'p/2', category:'photo' }] }) };
  };
  ${saveSrc}
  await save();
  if (!sent) return { err };
  const bmp = await createImageBitmap(sent);
  const cv2 = document.createElement('canvas'); cv2.width = bmp.width; cv2.height = bmp.height;
  cv2.getContext('2d').drawImage(bmp,0,0);
  const d = cv2.getContext('2d').getImageData(Math.floor(bmp.width/2), Math.floor(bmp.height/2), 1, 1).data;
  return { w:bmp.width, h:bmp.height, px:[d[0],d[1],d[2]], bytes:sent.size, type:sent.type, done, err,
           disp:{ w: el.clientWidth, h: el.clientHeight } };
};
</script></body>`);

const b = await chromium.launch({ executablePath: exe });
let fails = 0;
const ok = (n,c,w="") => { if(c) console.log("  ok    "+n); else { fails++; console.log("  FAIL  "+n+(w?"\n        "+w:"")); } };
try {
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  await pg.goto("file:///tmp/claude-0/crop.html");
  await pg.waitForFunction(() => window.__run && document.getElementById("pic").complete && document.getElementById("pic").naturalWidth > 0, null, { timeout: 15000 });
  const d = await pg.evaluate(() => ({ w: document.getElementById("pic").clientWidth, h: document.getElementById("pic").clientHeight }));

  const tl = await pg.evaluate(([w,h]) => window.__run(0,0,w/2,h/2), [d.w,d.h]);
  ok("🔴 cropping the top-left really returns the RED quadrant",
    tl.px && tl.px[0] > 200 && tl.px[2] < 60,
    `got ${tl.err || "rgb(" + (tl.px||[]).join(",") + ")"}`);

  const br = await pg.evaluate(([w,h]) => window.__run(w/2,h/2,w/2,h/2), [d.w,d.h]);
  ok("🔴 and the bottom-right returns the BLUE one",
    br.px && br.px[2] > 200 && br.px[0] < 60, `got rgb(${(br.px||[]).join(",")})`);

  ok("🔴 the crop is cut at the FILE's resolution, not the size on screen",
    tl.w >= 190 && tl.w <= 210,
    `a 400px source cropped in half must give ~200px, not the ~${(d.w/2)|0}px it was shown at. Got ${tl.w}x${tl.h}`);
  ok("it uploads a real JPEG with bytes in it", tl.type === "image/jpeg" && tl.bytes > 200);
  ok("🔴 and it retires the original rather than deleting it",
    Array.isArray(tl.done) && tl.done.find(m => m.path === "p/1").category === "source"
    && tl.done.find(m => m.path === "p/2").category === "photo",
    `library came back as ${JSON.stringify(tl.done)}`);
} finally { await b.close(); }
console.log(fails ? `verify-crop-pixels: ${fails} FAILED` : "verify-crop-pixels: all passed");
process.exit(fails ? 1 : 0);
