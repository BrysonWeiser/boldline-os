// Demo links never touch the OS, there is always a way back to the OS, and colours work for sites that block us.
// Run: node tests/verify-demo-host.mjs
//
// Bryson, 2026-11-05:
//  - "make sure that when I send the link that there is no way for the person with the link to be able to access the os"
//  - "make sure for the demo sites there is a way to exit out of them in the os"
//  - "when I add an existing website for the demos to use its colors make sure it works. I added springbok wellnesses
//    website and it didn't work" (springbokwellness.com answers every server with a "checking your browser" wall).
// What this stops, worst first:
//  1. A demo link on the OS's address, or a demo page that names the OS or links to it.
//  2. The OS serving a demo page itself (old links must be sent on, never rendered on the OS's origin).
//  3. Opening a demo from the OS with no way back (the home-screen app has no back button).
//  4. "Use their website's colours" dead-ending on a site that blocks servers.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-only";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const UI = read("index.html"), FN = read("netlify/functions/demo-site.mjs"), SITES_FN = read("sites/functions/demo.mjs");
const lib = await import("../netlify/lib/demo-site.mjs");
const fn = await import("../netlify/functions/demo-site.mjs");
const sitesDemo = (await import("../sites/functions/demo.mjs")).default;
const { brandFromPicked } = await import("../netlify/lib/brand-scrape.mjs");
const { sitesInputs } = await import("../sites/deps.mjs");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const TOKEN = "abcdefghijklmnopqrstuvwx";
const OS_HOSTS = /os\.boldlinemedia\.com|boldlinemedia\.netlify\.app/i;

// ── 1. Where a demo link lives ──────────────────────────────────────────────────────────────────────────────────────
ok("🔴 demo links live on the client-websites site, never the OS", lib.DEMO_HOST === "boldline-sites.netlify.app" && lib.DEMO_ORIGIN === "https://boldline-sites.netlify.app");
ok("🔴 the OS screen builds the same address (one value in two places, pinned equal here)", UI.includes(`const DEMO_ORIGIN_OS="${lib.DEMO_ORIGIN}";`) && !/\$\{location\.origin\}\/demo\//.test(UI));
ok("every link the server hands the OS is on the demo host", lib.demoSummary({ token: TOKEN, status: "done", builtAt: new Date().toISOString() }, lib.DEMO_ORIGIN).url === `${lib.DEMO_ORIGIN}/demo/${TOKEN}/`
  && (FN.match(/demoSummary\([^)]*DEMO_ORIGIN\)/g) || []).length === 2 && /listDemos\(supabase, DEMO_ORIGIN\)/.test(FN) && !/https:\/\/\$\{url\.host\}/.test(FN));

// ── 2. The OS never shows a demo itself ──────────────────────────────────────────────────────────────────────────────
{
  const get = (path) => fn.default(new Request(`https://os.boldlinemedia.com${path}`));
  const r1 = await get(`/.netlify/functions/demo-site?token=${TOKEN}&page=services&theme=editorial&me=1`);
  ok("🔴 an old link on the OS's address is sent to the demo host, same page, same design, nothing rendered",
    r1.status === 302 && r1.headers.get("location") === `${lib.DEMO_ORIGIN}/demo/${TOKEN}/services/?theme=editorial&me=1` && !(await r1.text()), `${r1.status} ${r1.headers.get("location")}`);
  const r2 = await get(`/.netlify/functions/demo-site?token=${TOKEN}`);
  ok("the home page too, and the redirect is temporary and never cached", r2.status === 302 && r2.headers.get("location") === `${lib.DEMO_ORIGIN}/demo/${TOKEN}/` && r2.headers.get("cache-control") === "no-store");
  const r3 = await get(`/.netlify/functions/demo-site?token=nope&page=`);
  ok("a made-up link is a plain 404 on the OS, not a redirect", r3.status === 404 && !r3.headers.get("location"));
  ok("the OS still takes 'they opened it' (the demo host passes it on)", /if \(seg === "__seen"\) \{\s*\n\s*try \{ await recordOpen\(/.test(FN) && FN.indexOf('seg === "__seen"') < FN.indexOf("return demoRedirect(url, token, seg);"));
}

// ── 3. The demo host: read-only, and the page names nothing of the OS ────────────────────────────────────────────────
{
  const row = { id: "p1", name: "Desert Shine", niche: "Car Detailing", area: "Mesa, AZ", status: "new",
    data: { city: "Mesa", phone: "(480) 555-0141", demoSite: { token: TOKEN, status: "done", theme: "showcase", builtAt: new Date().toISOString(), content: DEMO_DETAIL.website.content, stock: [] } } };
  const fake = { from: () => { const q = { select: () => q, eq: () => q, limit: async () => ({ data: [row], error: null }) }; return q; } };
  for (const pg of ["", "services", "contact"]) {
    const res = await fn.serveDemoPage(fake, new URL(`https://${lib.DEMO_HOST}/demo/${TOKEN}/${pg ? pg + "/" : ""}`), lib.DEMO_HOST);
    const html = await res.text();
    ok(`🔴 the ${pg || "home"} page names no OS address anywhere, and its links stay on the demo host`, res.status === 200 && !OS_HOSTS.test(html)
      && html.includes(`https://${lib.DEMO_HOST}/demo/${TOKEN}/`) && !/href="\/(?!\/)/.test(html), res.status);
  }
  const post = await sitesDemo(new Request(`https://${lib.DEMO_HOST}/demo/${TOKEN}/`, { method: "POST", body: "{}" }));
  ok("🔴 the demo host only reads: anything but GET is refused", post.status === 405);
  let called = null;
  const seen = await sitesDemo(new Request(`https://${lib.DEMO_HOST}/demo/${TOKEN}/__seen`, { headers: { "user-agent": "Mozilla/5.0 (iPhone)" } }),
    { fetchFn: async (u, o) => { called = { u, ua: o && o.headers && o.headers["user-agent"] }; return new Response(null, { status: 204 }); } });
  ok("'they opened it' is passed on to the OS server to server, with the visitor's browser, so robots stay filtered",
    seen.status === 204 && called && called.u === `https://os.boldlinemedia.com/.netlify/functions/demo-site?token=${TOKEN}&page=__seen` && called.ua === "Mozilla/5.0 (iPhone)", JSON.stringify(called));
  called = null;
  await sitesDemo(new Request(`https://${lib.DEMO_HOST}/demo/bad/__seen`), { fetchFn: async (u) => { called = u; return new Response(null); } });
  ok("a made-up link is never passed on", called === null);
  ok("it answers /demo/ only, and the website function stays out of its way", /export const config = \{ path: "\/demo\/\*" \};/.test(SITES_FN)
    && /excludedPath: \[[^\]]*"\/demo\/\*"/.test(read("sites/functions/website.mjs")));
  ok("🔴 the client-websites site redeploys when demo code changes (its deploy filter follows these files)",
    sitesInputs().includes("sites/functions/demo.mjs") && sitesInputs().includes("netlify/lib/demo-page.mjs") && sitesInputs().includes("netlify/lib/demo-site.mjs"));
  ok("🔴 and it is built from the page code only, never the OS's demo writer, reports or notifications", !sitesInputs().some((f) => /demo-site-background|functions\/demo-site\.mjs|report-shared|push-shared/.test(f))
    && /from "\.\.\/\.\.\/netlify\/lib\/demo-page\.mjs"/.test(SITES_FN));
  ok("the OS's address is only ever server-side there, never in the page", /OS_BASE/.test(SITES_FN) && !/OS_BASE/.test(read("netlify/lib/demo-site.mjs")));
}

// ── 4. A way back to the OS ────────────────────────────────────────────────────────────────────────────────────────
{
  ok("🔴 every Open button opens the demo over the OS, never navigates away", (UI.match(/onClick=\{\(\)=>openDemoView\(\{url:/g) || []).length === 3
    && !/href=\{demoOwnUrl\((d|demo)\.url\)\}/.test(UI));
  const V = UI.slice(UI.indexOf("function DemoViewer("), UI.indexOf("// \"Use their website's colours\" (KB brand-kit)."));
  ok("🔴 'Back to the OS' is always on top, first thing focused, and Escape works too", /✕<\/span> Back to the OS<\/button>/.test(V) && /autoFocus/.test(V) && /e\.key==="Escape"\) openDemoView\(null\)/.test(V)
    && /position:"fixed",inset:0,zIndex:600/.test(V) && /paddingTop:"calc\(8px \+ env\(safe-area-inset-top\)\)"/.test(V));
  ok("there is still a way to see it in the browser, as him (?me=1)", /href=\{own\} target="_blank"[^>]*>Open in browser ↗<\/a>/.test(V));
  ok("the viewer is mounted once, on every screen", (UI.match(/<DemoViewer\/>/g) || []).length === 1 && (UI.match(/<BrandFixSheet\/>/g) || []).length === 1);
  const js = lib.demoOpenJS("https://x/__seen", "k");
  ok("🔴 his looks inside the viewer never count as theirs (the page skips the ping inside a frame)", /var framed=true;try\{framed=window\.top!==window\.self;\}catch\(e\)\{\}/.test(js) && /if\(me\|\|framed\|\|navigator\.webdriver\)return;/.test(js));
}

// ── 5. Colours from a site that blocks servers (Springbok) ─────────────────────────────────────────────────────────
{
  const b = brandFromPicked(["#1E4D6B", "#F4F4F2", "#C8A24A", "#2E7D5B"], "#1E4D6B");
  ok("🔴 the colour he taps is their main colour; the next clearly different ones become second and accent", b.primary === "#1E4D6B" && b.second === "#C8A24A" && b.accent === "#2E7D5B" && b.picked === true);
  ok("a dark or plain main colour he chose is kept (it is his choice, not a guess)", brandFromPicked([], "#0B1F33").primary === "#0B1F33");
  ok("nothing valid sent, nothing saved", brandFromPicked([], "") === null && brandFromPicked(["nope"], "red") === null);
  ok("🔴 a site that won't be read says so and asks for a screenshot, instead of a dead end", /if \(!brand\) return json\(\{ ok: false, blocked: true, error: BLOCKED \}\);/.test(FN)
    && (FN.match(/blocked: true, error: BLOCKED/g) || []).length === 2 && /Add a screenshot of it instead/.test(FN));
  ok("🔴 picked colours are saved for a demo and for a client's preview, keeping any logo found before", /if \(picked\) brand = withPicked\(crow\.data\.siteBrand/.test(FN) && /if \(picked\) brand = withPicked\(pr\.data && pr\.data\.demoSite/.test(FN) && /from: "screenshot"/.test(FN));
  ok("🔴 we never try to get round a site's robot check: one honest read, then the screenshot", !/BROWSER_UA|Safari\/604/.test(read("netlify/lib/brand-scrape.mjs")));
  const S = UI.slice(UI.indexOf("function BrandFixSheet("), UI.indexOf("// ─── Pitch preview") > 0 ? UI.indexOf("const PITCH_STORE={}") : UI.length);
  ok("the OS asks for the address in its own box (no browser pop-up), and offers the screenshot from there too", /step==="url"&&/.test(S) && /Use a screenshot instead/.test(S) && !/window\.prompt\("What's their current website address/.test(UI));
  ok("🔴 the screenshot is read on the phone (nothing uploaded) and he taps the main colour", /const cs=\(await bkPalette\(f,\{gap:30,max:8\}\)\)\.slice\(0,8\);/.test(S) && /Tap their main colour/.test(S) && /accept="image\/\*"/.test(S)
    && /brandCall\(\{\.\.\.v\.body,primary:m,colors:/.test(S));
  ok("he can also just pick the colour", /<input type="color"/.test(S) && /Or pick their colour yourself/.test(S));
  ok("the steps are plain: open their site, screenshot the top, add it here", /Open their website on your phone\./.test(S) && /Take a screenshot of the top of their homepage\./.test(S));
  const row = { id: "c1", data: { name: "Springbok Wellness", niche: "Chiropractic", landingPage: { brandColor: "#22AA55" }, website: { brandColor: "#334455" } } };
  const withBrand = lib.pitchClientOf(row, { brand: { primary: "#1E4D6B", picked: true } });
  const without = lib.pitchClientOf(row, {});
  ok("🔴 colours taken for a client's preview beat the colour picked for their ad landing page", !withBrand.landingPage && !withBrand.brandColor && !withBrand.website.brandColor && withBrand.siteBrand.primary === "#1E4D6B"
    && without.landingPage.brandColor === "#22AA55");
  ok("their Brand kit (set by hand) still wins over everything", lib.pitchClientOf({ id: "c", data: { brandKit: { primary: "#AA0000" } } }, { brand: { primary: "#1E4D6B" } }).brandKit.primary === "#AA0000");
}

// ── 6. Nobody can let themselves into the OS (found open 2026-11-05 while checking the above) ───────────────────────────
{
  const dc = await import("../netlify/functions/daily-check.mjs");
  const DC = read("netlify/functions/daily-check.mjs");
  ok("🔴 the daily check fails while anyone can create their own login, and says exactly where to switch it off",
    dc.signupCheck({ disable_signup: false }).ok === false && /Authentication, Sign In \/ Providers, turn off \\"Allow new users to sign up\\"/.test(DC)
    && dc.signupCheck({ disable_signup: true }).ok === true && dc.signupCheck({}).ok === null);
  const now = Date.parse("2026-11-06T12:00:00Z");
  ok("🔴 and names any login created in the last day", JSON.stringify(dc.newLogins([{ created_at: "2026-11-06T02:00:00Z", email: "someone@x.com" }, { created_at: "2026-07-01T00:00:00Z", email: "bryson@old" }], now)) === '["someone@x.com"]');
  ok("both run every day, against the live database", /add\("🔴 Nobody can create their own login to the OS", sc\.ok, sc\.detail\)/.test(DC) && /supabase\.auth\.admin\.listUsers\(/.test(DC) && /\/auth\/v1\/settings/.test(DC));
}

console.log(`verify-demo-host: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
