// "They opened it": the Website demos screen and the signal behind it (KB demo-sites, "Website demos screen").
// Run: node tests/verify-demo-opened.mjs
//
// Bryson, 2026-11-05: "build a way to just create a website for a company in its own section in the os ... if a client
// isn't in outreach I can still build a website to pitch them", then "build it with the signal that they opened it".
// What this stops, worst first:
//  1. "Opened" lighting up when they never looked: a texting app drawing the link preview, a robot, or Bryson himself.
//  2. The demo page being able to send anything else (the open ping must not weaken the send-nothing guard).
//  3. A company built from the new screen that is lost to follow-up (it must land in Outreach).
import { readFileSync } from "node:fs";
import { chromiumPath } from "../scripts/chromium-path.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { recordOpen, renderDemo } from "../netlify/functions/demo-site.mjs";
import { demoOpenJS, PREVIEW_BOT, DEMO_GUARD_JS, demoSummary } from "../netlify/lib/demo-site.mjs";
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const TOKEN = "abcdefghijklmnopqrstuvwx";
const NOW = Date.parse("2026-11-05T20:00:00Z");

// ── 1. The server records an open ─────────────────────────────────────────────
function fakeDb(rowP, rowC) {
  const writes = [];
  const q = (table) => { const st = { table, filters: [] }; const api = {
    select() { return api; }, eq(k, v) { st.filters.push([k, v]); return api; }, limit() { return api; },
    maybeSingle: async () => ({ data: table === "clients" ? rowC : rowP }),
    update(patch) { return { eq: async (k, v) => { writes.push({ table, patch, id: v }); if (table === "clients" && rowC) rowC.data = patch.data; return { error: null }; } }; },
    then(res) { const r = table === "scout_prospects" ? rowP : rowC; const tok = (st.filters.find(([k]) => /token/.test(k)) || [])[1]; return res({ data: r && tok === TOKEN ? [r] : [] }); },
  }; return api; };
  return { from: q, writes };
}
const built = new Date(NOW - 2 * 864e5).toISOString();
{
  const p = { id: "p1", name: "Blackline Tint", blocked_at: null, data: { name: "Blackline Tint", demoSite: { status: "done", token: TOKEN, builtAt: built, content: { x: 1 } } } };
  const db = fakeDb(p, null); const pushes = [];
  const r = await recordOpen(db, TOKEN, { ua: "Mozilla/5.0 (iPhone)", now: NOW, notify: async (x) => pushes.push(x) });
  const w = db.writes[0];
  ok("🔴 a real visit is counted: one open, first and last time, the rest of their record untouched", r.recorded && w && w.patch.data.demoSite.opens === 1 && w.patch.data.demoSite.firstOpenedAt === new Date(NOW).toISOString() && w.patch.data.demoSite.content.x === 1 && w.patch.data.name === "Blackline Tint");
  ok("🔴 an open never reorders his call list (updated_at is not touched)", w && !("updated_at" in w.patch));
  ok("the FIRST open sends him a push", pushes.length === 1 && pushes[0].name === "Blackline Tint");
  p.data = w.patch.data;
  const r2 = await recordOpen(db, TOKEN, { ua: "Mozilla/5.0", now: NOW + 5 * 60000, notify: async (x) => pushes.push(x) });
  ok("a reload or page change within 10 minutes is the same visit", !r2.recorded && db.writes.length === 1);
  const r3 = await recordOpen(db, TOKEN, { ua: "Mozilla/5.0", now: NOW + 3 * 3600e3, notify: async (x) => pushes.push(x) });
  ok("a later visit counts again, but only the first ever pushes", r3.recorded && r3.opens === 2 && pushes.length === 1 && db.writes[1].patch.data.demoSite.firstOpenedAt === new Date(NOW).toISOString());
}
{
  const p = { id: "p1", name: "X", data: { demoSite: { status: "done", token: TOKEN, builtAt: built } } };
  for (const ua of ["facebookexternalhit/1.1", "WhatsApp/2.23", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 HeadlessChrome/120", "TelegramBot (like TwitterBot)", "Discordbot/2.0", "curl/8.0"]) {
    const db = fakeDb(p, null);
    ok(`🔴 a link-preview robot never counts (${ua.split(/[ /]/)[0]})`, !(await recordOpen(db, TOKEN, { ua, now: NOW })).recorded && !db.writes.length);
  }
  const blocked = { ...p, blocked_at: "2026-10-01" }; const db2 = fakeDb(blocked, null);
  ok("a company that asked not to be contacted records nothing", !(await recordOpen(db2, TOKEN, { ua: "Mozilla", now: NOW })).recorded && !db2.writes.length);
  const old = { id: "p1", name: "X", data: { demoSite: { status: "done", token: TOKEN, builtAt: new Date(NOW - 40 * 864e5).toISOString() } } }; const db3 = fakeDb(old, null);
  ok("an expired demo records nothing", !(await recordOpen(db3, TOKEN, { ua: "Mozilla", now: NOW })).recorded && !db3.writes.length);
  ok("a malformed token is refused before any lookup", !(await recordOpen(fakeDb(p, null), "../etc", { ua: "Mozilla", now: NOW })).recorded);
}
ok("the OS sees the count and both times", (() => { const s = demoSummary({ status: "done", token: TOKEN, builtAt: built, opens: 3, firstOpenedAt: "a", lastOpenedAt: "b" }, "https://os.x"); return s.opens === 3 && s.firstOpenedAt === "a" && s.lastOpenedAt === "b"; })());

// ── 2. The page sends it, and only from a person ─────────────────────────────────
const row = { id: "p1", name: "Blackline Tint", niche: "Window tint", data: { name: "Blackline Tint", demoSite: { status: "done", token: TOKEN, builtAt: built, theme: "showcase", content: DEMO_DETAIL.website.content, stock: [] } } };
const out = renderDemo(row, "", { host: "os.boldlinemedia.com" });
ok("the demo page carries the open ping, after the send-nothing guard", out.html.indexOf(DEMO_GUARD_JS.slice(0, 40)) < out.html.indexOf("bl-seen:" + TOKEN) && out.html.includes(`https://os.boldlinemedia.com/demo/${TOKEN}/__seen`));
ok("🔴 the guard is untouched: POSTs and beacons are still swallowed", /if\(m!=='GET'&&m!=='HEAD'\)\{return Promise\.resolve/.test(DEMO_GUARD_JS) && /navigator\.sendBeacon=function\(\)\{return true;\};/.test(DEMO_GUARD_JS));
ok("the ping is a plain GET to our own server, nothing else", (demoOpenJS("U", "K").match(/fetch\(/g) || []).length === 1 && /fetch\(U,\{method:'GET'/.test(demoOpenJS("U", "K")) && !/sendBeacon|XMLHttpRequest|method:'POST'/.test(demoOpenJS("U", "K")));
ok("the preview-robot list knows the usual texting and social apps", ["facebookexternalhit", "WhatsApp", "Twitterbot", "LinkedInBot", "Slackbot", "TelegramBot", "Discordbot", "Googlebot"].every((u) => PREVIEW_BOT.test(u)) && !PREVIEW_BOT.test("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1"));

// A real browser: a person scrolls, a preview does not, and Bryson's own tab never counts.
{
  let chromium; try { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); } catch { chromium = null; }
  if (!chromium) { console.log("  (skipped the browser checks: no Playwright here)"); }
  else {
    const fs = require("fs"), path = require("path");
    const dir = fs.readdirSync("/opt/pw-browsers").find((x) => /^chromium-\d+$/.test(x));
    const b = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
    const visit = async (q, act, human = true) => {
      const pg = await b.newPage({ viewport: { width: 390, height: 800 } });
      if (human) await pg.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
      let seen = 0;
      await pg.route(/^https?:\/\//, (r) => { const u = r.request().url(); if (/__seen$/.test(u)) { seen++; return r.fulfill({ status: 204, body: "" }); }
        if (/^https:\/\/os\.boldlinemedia\.com\/demo\//.test(u)) return r.fulfill({ status: 200, contentType: "text/html", body: out.html }); return r.abort(); });
      await pg.goto(`https://os.boldlinemedia.com/demo/${TOKEN}/${q}`); await act(pg); await pg.close(); return seen;
    };
    ok("🔴 a person who scrolls is counted, once", await visit("", async (pg) => { await pg.waitForTimeout(400); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(400); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(400); }) === 1);
    ok("🔴 a link preview that loads the page and leaves (no scroll, under 6s) is not", await visit("", async (pg) => { await pg.waitForTimeout(2500); }) === 0);
    ok("someone who just reads for a while is counted", await visit("", async (pg) => { await pg.waitForTimeout(6700); }) === 1);
    ok("🔴 Bryson's own tab from the OS (?me=1) never counts, even after he scrolls", await visit("?me=1", async (pg) => { await pg.waitForTimeout(300); await pg.mouse.wheel(0, 900); await pg.waitForTimeout(500); }) === 0);
    ok("🔴 an automated browser never counts", await visit("", async (pg) => { await pg.waitForTimeout(300); await pg.mouse.wheel(0, 900); await pg.waitForTimeout(500); }, false) === 0);
    await b.close();
  }
}

// ── 3. The OS ────────────────────────────────────────────────────────────────────
const SCR = UI.slice(UI.indexOf("function WebsiteDemosScreen"), UI.indexOf("// ─── Pitch preview: the demo builder"));
ok("a Website demos screen, in the menu on a computer, on a phone and in search", /function WebsiteDemosScreen\(/.test(UI) && /onClick=\{onDemos\}[^\n]*Website demos<\/button>/.test(UI) && /"Website demos","Build a site to pitch, see who opened it",onDemos/.test(UI) && /id:"g-demos"[^\n]*setScreen\("demos"\)/.test(UI) && /screen==="demos"&&<WebsiteDemosScreen /.test(UI));
ok("🔴 building from it adds the company to Outreach labelled Website (never lost to follow-up), reusing one already there", /outreach\("action=add",\{method:"POST",body:JSON\.stringify\(\{\.\.\.form,pitch:"website",demoOnly:true\}\)\}\)/.test(SCR) && /if\(d\.duplicate\)\{/.test(SCR) && /pitch:"both"/.test(SCR));
ok("it never silently rebuilds a demo that is already live", /already has a demo\. It's in the list below\./.test(SCR) && /window\.confirm\(`Rebuild \$\{x\.name\}'s demo\?/.test(SCR));
// Since 2026-11-05 every Open goes through the in-OS viewer (verify-demo-host), which adds ?me=1 to the frame and its
// "Open in browser" link alike.
ok("🔴 Bryson's own taps carry ?me=1 everywhere he opens a demo", /openDemoView\(\{url:d\.url,/.test(SCR) && /openDemoView\(\{url:demo\.url,[^\n]*Open the preview/.test(UI) && /openDemoView\(\{url:demo\.url,[^\n]*Open their site/.test(UI)
  && /const own=demoOwnUrl\(v\.url\);/.test(UI) && /src=\{own\}/.test(UI) && /href=\{own\} target="_blank"/.test(UI) && !/href=\{demo\.url\}/.test(UI));
ok("the list says who opened it and when, and the top line names who to call", /Opened \{demoAgo\(d\.lastOpenedAt\)\}/.test(SCR) && /opened their demo":recent\.length\+" companies opened their demos"\} this week\. Call while it's fresh\./.test(SCR));
ok("the existing demo and pitch cards show it too", (UI.match(/<DemoOpened demo=\{demo\}\/>/g) || []).length === 2);
ok("'They want it' still turns the demo into a client", /onCreateClient&&onCreateClient\(clientFromDemo\(/.test(SCR) && /DEMO_PLANS\.map/.test(SCR));
ok("the list asks the server for the demos only (never their 15KB of words each)", /demoCall\(\{action:"list"\}\)/.test(SCR));

// ── 4. A business with no website (Bryson, 2026-11-05: first a mobile tint guy who "posts on instagram but he doesn't
//       have a website", then "for businesses without a website in general whether they are on instagram or another
//       social media platform or they don't even have social media and they are just starting out") ─────────────────
{
  const { buildManualProspect, isQueueable, dueQueue, waitingForContact, mergeContact } = await import("../netlify/lib/outreach.mjs");
  const { demoClientOf } = await import("../netlify/lib/demo-site.mjs");
  const { normSocial } = await import("../netlify/lib/social.mjs");
  const OUT = readFileSync(join(ROOT, "netlify/functions/outreach.mjs"), "utf8");
  const DEMO_FN = readFileSync(join(ROOT, "netlify/functions/demo-site.mjs"), "utf8");

  // Any platform, as a link or a handle.
  const sv = (v, h) => JSON.stringify(normSocial(v, h));
  ok("🔴 a social link on any platform is read and named", normSocial("https://www.facebook.com/tintninja").platform === "Facebook" && normSocial("https://www.tiktok.com/@tintninja").platform === "TikTok" && normSocial("https://www.yelp.com/biz/tint-ninja").platform === "Yelp" && normSocial("https://nextdoor.com/pages/tint-ninja").platform === "Nextdoor" && normSocial("facebook.com/tintninja").url === "https://facebook.com/tintninja", sv("facebook.com/tintninja"));
  ok("a bare @handle goes on the platform he picks", normSocial("@tintninja", "TikTok").url === "https://www.tiktok.com/@tintninja" && normSocial("tintninja", "Facebook").url === "https://www.facebook.com/tintninja" && normSocial("tintninja").platform === "Instagram");
  ok("🔴 an Instagram handle with dots is a handle, not a website", normSocial("tint.ninja.az").url === "https://www.instagram.com/tint.ninja.az/", sv("tint.ninja.az"));
  ok("nonsense and a link to one post are refused; every saved link is https", normSocial("bad handle!") === null && normSocial("https://www.instagram.com/p/abc123/") === null && normSocial("http://facebook.com/x").url.startsWith("https://") && normSocial("javascript:alert(1)") === null);

  // Instagram only, as before.
  const r = buildManualProspect({ name: "Tint Ninja", niche: "Mobile window tint", city: "Gilbert, AZ", instagram: "https://www.instagram.com/tint.ninja.az/", services: "Ceramic tint, windshield strip, tint removal", about: "Mobile. Comes to your home or work.", pitch: "website" });
  ok("🔴 a business with only an Instagram can be added (no phone, email or website)", !!r.row && r.row.data.instagram === "tint.ninja.az" && !r.row.domain && isQueueable(r.row));
  // Another platform only.
  const fb = buildManualProspect({ name: "Shade Bros", social: "https://www.facebook.com/shadebros", pitch: "website" });
  ok("🔴 a business with only a Facebook page (or any other platform) can be added and called on", !!fb.row && fb.row.data.socials[0].platform === "Facebook" && !fb.row.data.instagram && isQueueable(fb.row) && !waitingForContact(fb.row));
  const inSite = buildManualProspect({ name: "Shade Bros 2", website: "https://www.facebook.com/shadebros2" });
  ok("🔴 a Facebook page typed in the website box is kept as their social, never as a website that would match every business on Facebook", !!inSite.row && !inSite.row.domain && !inSite.row.data.website && inSite.row.data.socials[0].url === "https://www.facebook.com/shadebros2");
  ok("a bad social link is refused in plain words", /social link doesn't look right/.test(buildManualProspect({ name: "X", social: "https://www.instagram.com/p/abc123/" }).error || ""));

  // Nothing at all: only for a demo, and kept off the call list.
  ok("🔴 Outreach's own add-by-hand still needs a way to reach them", /no way to reach them/.test(buildManualProspect({ name: "Fresh Start Detail", niche: "Detailing" }).error || ""));
  const none = buildManualProspect({ name: "Fresh Start Detail", niche: "Mobile detailing", demoOnly: true, newBusiness: true });
  ok("🔴 a business just starting out, with no phone, website or social, can still get a demo", !!none.row && none.row.data.noContactYet === true && none.row.data.newBusiness === true);
  ok("🔴 and it stays OFF the call list until there is a way to reach them", waitingForContact(none.row) && !isQueueable(none.row) && dueQueue([{ ...none.row, id: "n1", step: 0 }]).length === 0);
  const later = mergeContact(none.row, { phone: "480-555-0142" });
  ok("🔴 adding a phone later puts them on the call list, without losing anything", !later.error && later.data.phones[0].number === "(480) 555-0142" && later.data.newBusiness === true && !later.data.noContactYet && isQueueable({ ...none.row, data: later.data }) && dueQueue([{ ...none.row, id: "n1", step: 0, data: later.data }]).length === 1);
  const later2 = mergeContact({ data: later.data }, { social: "freshstartdetail", socialPlatform: "TikTok" });
  ok("adding a social later keeps the number and never adds the same link twice", later2.data.phones.length === 1 && later2.data.socials[0].url === "https://www.tiktok.com/@freshstartdetail" && mergeContact({ data: later2.data }, { social: "https://www.tiktok.com/@freshstartdetail" }).data.socials.length === 1);
  ok("adding nothing, or junk, is refused in plain words", /Add a phone number, an email or their social media/.test(mergeContact(none.row, {}).error || "") && /phone number doesn't look right/.test(mergeContact(none.row, { phone: "12" }).error || ""));
  ok("🔴 the server saves it from the demo card (POST only, on the company named, nothing else touched)", /if \(action === "contact"\) \{\s*\n\s*if \(req\.method !== "POST"\)/.test(OUT) && /const merged = mergeContact\(row, body\);/.test(OUT) && /\.update\(\{ data: merged\.data, updated_at: new Date\(\)\.toISOString\(\) \}\)\.eq\("id", id\)/.test(OUT));

  // What reaches the demo writer.
  const cl = demoClientOf({ id: "p", name: r.row.name, niche: r.row.niche, area: r.row.area, data: r.row.data });
  ok("what he typed reaches the demo writer: their services and the true facts", cl.services === "Ceramic tint, windshield strip, tint removal" && /Mobile\. Comes to your home or work\./.test(cl.researchFacts));
  const nb = demoClientOf({ id: "p", name: none.row.name, niche: none.row.niche, data: none.row.data });
  ok("🔴 'just starting out' tells the writer to claim no years, past customers, reviews or awards", /brand-new business that is just getting started: no years in business, past customers, reviews, ratings or awards to mention/.test(nb.researchFacts || ""), nb.researchFacts);
  ok("and a business not ticked is not told that", !/brand-new business/.test(cl.researchFacts || ""));
  const withPhone = buildManualProspect({ name: "Y", phone: "480-555-0100" });
  ok("🔴 a phone typed by hand shows on their demo site (it used to be lost)", demoClientOf({ id: "p", name: "Y", data: withPhone.row.data }).businessPhone === "(480) 555-0100");
  ok("🔴 private notes still never reach the writer", !/secret/.test(JSON.stringify(demoClientOf({ id: "p", name: "Z", notes: "secret", data: buildManualProspect({ name: "Z", phone: "480-555-0101", notes: "secret" }).row.data }))));

  // The screen.
  ok("only name and what they do are required, and the screen says no website, social or contact is fine", /canBuild=!busy&&form\.name\.trim\(\)&&form\.niche\.trim\(\);/.test(SCR) && /F\("niche","What they do \*"/.test(SCR) && /no website, no social media and no contact details are all fine/.test(SCR) && /leave blank if they don't have one/.test(SCR));
  ok("🔴 it builds as a demo (demoOnly), so a business with nothing yet is not refused", /outreach\("action=add",\{method:"POST",body:JSON\.stringify\(\{\.\.\.form,pitch:"website",demoOnly:true\}\)\}\)/.test(SCR));
  ok("one social box for any platform, with a platform picker only for a bare handle", /Social media or online listing/.test(SCR) && /\{\/\^@\?\[A-Za-z0-9\._-\]\+\$\/\.test\(form\.social\.trim\(\)\)&&<select value=\{form\.socialPlatform\}/.test(SCR) && /\["Instagram","Facebook","TikTok","X"\]/.test(SCR));
  ok("the 'just starting out' box says plainly what it does", /They're just starting out\.<\/b> The site won't mention years in business, past customers, reviews or awards they don't have yet\./.test(SCR) && /newBusiness:e\.target\.checked/.test(SCR));
  ok("what they offer and what's true about them are still asked for", /F\("services","What they offer"/.test(SCR) && /Anything true about them \(goes on the site\)/.test(SCR));
  ok("🔴 a card with no way to reach them says so and has a box to add one", /No way to reach them yet, so they're off your call list\. Add one when you have it\./.test(SCR) && /outreach\("action=contact&id="/.test(SCR) && /\{x\.noContact&&/.test(SCR));
  ok("🔴 the server tells the list which companies are waiting, and where they are online (https links only on screen)", /noContact: waiting/.test(DEMO_FN) && /noContact:data->>noContactYet/.test(DEMO_FN) && /x\.social&&\/\^https:\\\/\\\/\/\.test\(x\.social\.url\|\|""\)&&/.test(SCR));
  ok("the Outreach call card shows their social link too, whatever the platform (https only)", /\(Array\.isArray\(d\.socials\)\?d\.socials:\[\]\)\.filter\(x=>x&&\/\^https:\\\/\\\/\/\.test\(x\.url\|\|""\)\)/.test(UI) && /↗ \{x\.platform\|\|"social"\}/.test(UI));
  ok("Outreach's add-by-hand asks for social media, not just Instagram", /\["social","Social media",/.test(UI));
}

console.log(`verify-demo-opened: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
