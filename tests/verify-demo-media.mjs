// Their own photos and videos on a demo website (KB demo-sites, "their own photos").
// Run: node tests/verify-demo-media.mjs
//
// Bryson, 2026-11-05: "make sure for the social media ones that it takes pictures and videos etc from what's shown on
// the accounts". Instagram, Facebook and TikTok don't let an outside system read an account, so he saves or
// screenshots them on his phone and adds them on the demo card. What this stops, worst first:
//  1. A file landing on the wrong demo, or a path outside the demo's own folder being added or deleted.
//  2. Their photos not showing (stock still in front), or videos shown squashed.
//  3. Their photos vanishing when the demo becomes their real website.
//  4. A demo with nothing added changing at all.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-only";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const UI = read("index.html"), FN = read("netlify/functions/demo-site.mjs"), LIB = read("netlify/lib/demo-site.mjs"), MEDIA = read("netlify/functions/media.mjs");
const lib = await import("../netlify/lib/demo-site.mjs");
const fn = await import("../netlify/functions/demo-site.mjs");
const { cleanBlock } = await import("../netlify/lib/site-render.mjs");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const TOKEN = "abcdefghijklmnopqrstuvwx";
const PID = "11111111-2222-4333-8444-555555555555";
const STORE = "https://ahcrpxuwdyrxlethpdns.supabase.co/storage/v1/object/public/client-media/";
const photo = (n) => ({ kind: "photo", url: `${STORE}demo/p-${PID}/${n}.jpg`, path: `demo/p-${PID}/${n}.jpg`, at: "2026-11-05T20:00:00Z" });
const video = (n, tall) => ({ kind: "video", url: `${STORE}demo/p-${PID}/${n}.mp4`, path: `demo/p-${PID}/${n}.mp4`, tall, at: "2026-11-05T20:00:00Z" });
const prospect = (media) => ({ id: PID, name: "Tint Ninja", niche: "Window tint", area: "Gilbert, AZ", status: "new",
  data: { city: "Gilbert", phone: "(480) 555-0141", demoSite: { token: TOKEN, status: "done", theme: "showcase", builtAt: new Date().toISOString(),
    content: DEMO_DETAIL.website.content, stock: [{ url: "https://images.pexels.com/photos/1/stock.jpg", alt: "stock" }], ...(media ? { media } : {}) } } });

// ── 1. On the page ──────────────────────────────────────────────────────────────────────────────────────────────────
{
  const html = fn.renderDemo(prospect([photo("a"), photo("b"), video("v1", true), video("v2", false)]), "", { host: lib.DEMO_HOST }).html;
  const iA = html.indexOf(photo("a").url), iStock = html.indexOf("images.pexels.com/photos/1/stock.jpg");
  ok("🔴 their own photos are on the demo, in front of the stock photos", iA > 0 && (iStock < 0 || iA < iStock), `${iA} vs ${iStock}`);
  ok("🔴 their videos get a section of their own, named for them", /Tint Ninja at work/.test(html) && html.includes(`<video src="${video("v1").url}"`) && html.includes(`<video src="${video("v2").url}"`));
  ok("🔴 a phone video (reel, TikTok) is shown tall, a wide one wide, side by side", /aspect-ratio:9\/16"><video src="[^"]*v1\.mp4"/.test(html) && /aspect-ratio:16\/9"><video src="[^"]*v2\.mp4"/.test(html) && /class="grid g2"/.test(html));
  ok("videos load only their first frame until played, and play inline on a phone", /<video src="[^"]*v1\.mp4" controls playsinline preload="metadata"/.test(html));
  const plain = fn.renderDemo(prospect(), "", { host: lib.DEMO_HOST }).html;
  ok("🔴 a demo with nothing added is unchanged: no section, stock photos as before", !/ at work</.test(plain) && plain.includes("images.pexels.com/photos/1/stock.jpg") && !plain.includes("/demo/p-"));
  for (const t of ["cinematic", "editorial"]) {
    const p = prospect([photo("a"), video("v1", true)]); p.data.demoSite.theme = t;
    const h = fn.renderDemo(p, "", { host: lib.DEMO_HOST }).html;
    ok(`the ${t} design shows them too`, h.includes(photo("a").url) && h.includes(video("v1").url));
  }
  const pc = lib.pitchClientOf({ id: "c1", data: { name: "Springbok Wellness", mediaLibrary: [{ category: "logo", url: "https://x.com/logo.png" }, { category: "photo", url: "https://x.com/ad.jpg" }] } },
    { media: [photo("p1"), video("v9", true)] });
  ok("a client's pitch preview takes them too, keeping their logo (and still not their ad photos)", pc.mediaLibrary.some((m) => m.category === "logo") && pc.mediaLibrary.some((m) => m.url === photo("p1").url) && !pc.mediaLibrary.some((m) => m.url === "https://x.com/ad.jpg")
    && pc.website.blocks[0].clips[0].tall === true);
  ok("only https files ever reach a page", lib.demoMediaOf({ media: [{ kind: "photo", url: "http://x.com/a.jpg" }, { kind: "photo", url: "javascript:alert(1)" }, { kind: "exe", url: "https://x.com/a" }, photo("ok")] }).length === 1);
  ok("at most 12 photos and 3 videos are used", lib.demoMediaLibrary({ media: Array.from({ length: 20 }, (_, i) => photo("p" + i)) }).length === 12 && lib.demoVideoBlocks({ media: Array.from({ length: 6 }, (_, i) => video("v" + i)) })[0].clips.length === 3);
  const single = cleanBlock({ id: "v", type: "video", heading: "Hi", url: "https://youtu.be/abcdefghij" });
  ok("an ordinary video section (the website editor's) is exactly as it was", !("clips" in single) && !("tall" in single) && single.url === "https://youtu.be/abcdefghij");
}

// ── 2. The server: the right demo, the right folder ─────────────────────────────────────────────────────────────────
{
  const mk = (row, table = "scout_prospects") => {
    const log = { signed: [], removed: [], saved: null };
    const db = {
      from: (t) => {
        const q = { _t: t, select: () => q, eq: () => q, maybeSingle: async () => ({ data: t === table ? row : null, error: null }),
          update: (v) => { log.saved = v; return { eq: async () => ({ error: null }) }; } };
        return q;
      },
      storage: {
        createBucket: async () => ({}),
        from: () => ({
          createSignedUploadUrl: async (p) => { log.signed.push(p); return { data: { signedUrl: "https://upload.example/" + p }, error: null }; },
          getPublicUrl: (p) => ({ data: { publicUrl: STORE + p } }),
          remove: async (ps) => { log.removed.push(...ps); return { error: null }; },
        }),
      },
    };
    return { db, log };
  };
  const row = { id: PID, data: { demoSite: { token: TOKEN, status: "done", media: [photo("a")] } } };
  let { db, log } = mk(row);
  const s1 = await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "photo", type: "image/jpeg", size: 400000 }, { now: new Date("2026-11-06T01:00:00Z") });
  ok("🔴 an upload address is only ever for this demo's own folder", s1.status === 200 && /^demo\/p-11111111-2222-4333-8444-555555555555\/\d+-[0-9a-f]{12}\.jpg$/.test(s1.body.path) && log.signed[0] === s1.body.path, JSON.stringify(s1.body));
  ok("only photos and videos, of the kinds a website can show", (await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "photo", type: "image/heic", size: 1 })).status === 400
    && (await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "photo", type: "video/mp4", size: 1 })).status === 400
    && (await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "pdf", type: "application/pdf", size: 1 })).status === 400
    && (await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "video", type: "video/quicktime", size: 1000 })).status === 200);
  ok("a video over 50 MB is refused in plain words", /under 50 MB/.test((await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "video", type: "video/mp4", size: 60 * 1024 * 1024 })).body.error));
  const foreign = await fn.demoMedia(db, { action: "mediaAdd", id: PID, kind: "photo", path: "demo/p-99999999-2222-4333-8444-555555555555/x.jpg" });
  const sneaky = await fn.demoMedia(db, { action: "mediaRemove", id: PID, path: `demo/p-${PID}/../c-1/x.jpg` });
  ok("🔴 a file from another demo, or a path that climbs out, can never be added or deleted", foreign.status === 400 && sneaky.status === 400 && log.removed.length === 0);
  ({ db, log } = mk(JSON.parse(JSON.stringify(row))));
  const added = await fn.demoMedia(db, { action: "mediaAdd", id: PID, kind: "video", path: `demo/p-${PID}/1-abc.mp4`, tall: true });
  const saved = log.saved && log.saved.data && log.saved.data.demoSite;
  ok("🔴 adding one keeps the others and is saved on THIS demo, nothing else touched", added.status === 200 && saved && saved.media.length === 2 && saved.media[1].tall === true && saved.media[1].url === `${STORE}demo/p-${PID}/1-abc.mp4` && saved.token === TOKEN);
  const again = await fn.demoMedia(db, { action: "mediaAdd", id: PID, kind: "photo", path: photo("a").path });
  ok("adding the same file twice does nothing", again.status === 200 && again.body.media.length === 1);
  ({ db, log } = mk(JSON.parse(JSON.stringify(row))));
  const rm = await fn.demoMedia(db, { action: "mediaRemove", id: PID, path: photo("a").path });
  ok("🔴 removing takes it off the demo AND out of storage", rm.status === 200 && rm.body.media.length === 0 && log.removed[0] === photo("a").path);
  const fullRow = { id: PID, data: { demoSite: { status: "done", media: Array.from({ length: 12 }, (_, i) => photo("f" + i)) } } };
  ({ db } = mk(fullRow));
  ok("a demo holds at most 12 photos, and says so", /most photos a demo can hold \(12\)/.test((await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "photo", type: "image/jpeg", size: 1 })).body.error));
  ({ db } = mk({ id: PID, data: {} }));
  ok("no demo yet: build it first", (await fn.demoMedia(db, { action: "mediaSign", id: PID, kind: "photo", type: "image/jpeg", size: 1 })).status === 409);
  ({ db, log } = mk({ id: "c1", data: { pitchSite: { status: "done", token: TOKEN } } }, "clients"));
  const cs = await fn.demoMedia(db, { action: "mediaSign", clientId: "c1", kind: "photo", type: "image/png", size: 1 });
  ok("a client's pitch preview has its own folder", cs.status === 200 && cs.body.path.startsWith("demo/c-c1/"));
  ok("the OS calls them only as the signed-in owner (inside the owner-only part)", FN.indexOf("if (/^media(Sign|Add|Remove)$/") > FN.indexOf("if (!(await owner(req, supabase)))"));
  ok("🔴 nothing is fetched from Instagram, Facebook or TikTok", !/fetch\([^)]*(instagram|facebook|tiktok)/i.test(FN + LIB));
}

// ── 3. The card, and when they buy ──────────────────────────────────────────────────────────────────────────────────
{
  const R = UI.slice(UI.indexOf("function DemoMediaRow("), UI.indexOf("// ── Looking at a demo without leaving the OS"));
  ok("every finished demo card has the row", /<DemoMediaRow x=\{x\} onMedia=\{media=>setRows\(/.test(UI));
  ok("🔴 it takes several photos and videos at once from the phone", /<input type="file" accept="image\/\*,video\/\*" multiple/.test(R) && /\+ Add photos or videos/.test(R));
  ok("🔴 the steps go upload address, file, then add, in that order, one file at a time", /action:"mediaSign"[\s\S]*method:"PUT"[\s\S]*action:"mediaAdd"/.test(R) && /for\(const f of list\)/.test(R));
  ok("photos are shrunk on the phone first so the demo stays fast", /2000\/Math\.max\(bm\.width,bm\.height\)/.test(UI) && /cv\.toBlob\(r,"image\/jpeg",0\.86\)/.test(UI));
  ok("a phone video is detected as tall", /v\.videoHeight>v\.videoWidth/.test(UI) && /tall\}\);/.test(R));
  ok("he can remove any one, and the card says what it does in plain words", /action:"mediaRemove"/.test(R) && /They replace the stock photos on this demo\./.test(R) && /Save or screenshot them from their Instagram, Facebook or TikTok/.test(R));
  ok("🔴 when they buy, their photos and videos come with the demo", /mediaLibrary:\[\.\.\.\(cl\.mediaLibrary\|\|\[\]\),\.\.\.demoPhotosToLibrary\(demo\.media\)\]/.test(UI) && /demoVideoBlockOS\(demo\.media,/.test(UI)
    && /media: demoMediaOf\(d\) \}\);/.test(FN) && /media: demoMediaOf\(pd\) \}\);/.test(FN));
  ok("and when a client takes their preview as their website", /demoPhotosToLibrary\(full\.media\)\.filter\(m=>!had\.has\(m\.url\)\)/.test(UI) && /demoVideoBlockOS\(full\.media,/.test(UI));
  ok("🔴 afterwards they can delete one from their portal, but only one in their own library", /const fromTheirDemo = path\.startsWith\("demo\/"\) && !path\.includes\("\.\."\) && \(\(data\.data && data\.data\.mediaLibrary\) \|\| \[\]\)\.some\(\(m\) => m && m\.path === path\);/.test(MEDIA));
  ok("the old stock-only rule is replaced, and says why nothing is pulled automatically", !/uses stock photos only/.test(LIB) && /nothing is pulled from Instagram or the like automatically/.test(LIB));
  ok("no emojis in what the card says", !/[\u{1F300}-\u{1FAFF}]/u.test(R));
}

console.log(`verify-demo-media: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
