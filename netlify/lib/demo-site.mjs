// Demo websites: a full site built for a business BEFORE the sales meeting (KB `demo-sites`).
//
// Bryson, 2026-10-20: "when cold calling to sell websites the easiest thing is to have a website already built that
// way I can just show them and if they like it they buy it", then: "i want to build it for the full website for the
// company im cold calling when i hop on a meeting with them that way if they like it we just need to link their
// payment method".
//
// One tap on a company in Lead Scout or Outreach writes their five-page site with the real site builder (same copy
// writer, same designs, same motion) from what the research found, and gives Bryson a private link to show on the
// meeting. If they say yes, the demo becomes their website (see `demoToClient` in index.html), so nothing is
// written twice.
//
// 🔴 A DEMO IS A PREVIEW, SO IT MAY NEVER CHANGE ANYTHING REAL (CLAUDE.md "A preview must never change anything
// real"). The business has not agreed to anything, so the page:
//  - sends nothing: the same guard as the sample sites stops every form, fetch and beacon before it leaves;
//  - says what it is on every page and at every width ("Preview made for <name>. Not live yet.");
//  - is never indexed, never counted as a visit, and lives at a long random address nobody can guess;
//  - expires 30 days after it was built (rebuild to renew), so a "website" with their name on it does not sit on
//    the internet for ever after a no;
//  - uses stock photos only. Their Instagram photos are theirs, and copying them before they have agreed would be
//    using their work without permission; their own photos come in through the portal once they buy.
// The copy writer's "don't invent anything" rule still holds: only what the research actually found is passed in.

import { randomBytes } from "node:crypto";

export const DEMO_DAYS = 30;
export const DEMO_THEME_DEFAULT = "showcase";   // Aurora retired 2026-11-03 (KB website-builder)

export const newDemoToken = () => randomBytes(18).toString("base64url");
export const validToken = (t) => /^[A-Za-z0-9_-]{20,40}$/.test(String(t || ""));

const s = (v, n = 400) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

// What the research found, as a client-shaped record the real builder and renderer understand. Only public,
// checkable facts go in; nothing from Bryson's private notes (a verdict like "cannot afford ads" would read
// terribly if the writer echoed it).
export function demoClientOf(prospect, demo = {}) {
  const p = prospect || {};
  const d = p.data || {};
  const area = [s(d.city, 60), s(d.state, 30)].filter(Boolean).join(", ") || s(p.area, 120);
  const services = (Array.isArray(d.services) ? d.services : []).map((x) => s(x, 60)).filter(Boolean).slice(0, 8);
  const facts = [
    d.rating && d.reviewCount ? `Rated ${Number(d.rating).toFixed(1)} stars from ${d.reviewCount} ${s(d.reviewSource, 20) || "online"} reviews.` : "",
    s(d.yearsInBusiness, 60) ? `In business ${s(d.yearsInBusiness, 60).replace(/^since/i, "since")}.` : "",
    s(d.ownerName, 60) ? `Owner: ${s(d.ownerName, 60).split(" ")[0]}.` : "",
  ].filter(Boolean).join(" ");
  return {
    id: `demo-${s(p.id, 60)}`,
    demo: true,
    name: s(d.dba, 80) || s(p.name, 80),
    niche: s(p.niche, 60),
    services: services.join(", "),
    businessPhone: s(d.phone, 30),
    businessAddress: s(d.address, 160),
    campaignSetup: { serviceArea: area },
    researchFacts: facts,
    leadToken: "demo",
    landingSlug: "demo",
    // Their look, read off their current website when the demo was built (brand-scrape.mjs).
    ...(demo.brand ? { siteBrand: demo.brand } : {}),
    website: { content: demo.content || null, stock: demo.stock || [], theme: demo.theme || DEMO_THEME_DEFAULT, published: false,
      // Light or dark, when Bryson picked one for this demo (otherwise the design's own).
      ...(demo.mode === "light" || demo.mode === "dark" ? { mode: demo.mode } : {}),
      // The star rating the research found, shown at the top of the Showcase design. Only a real one with a count.
      ...(Number(d.rating) > 0 && Number(d.reviewCount) > 0 ? { rating: { stars: Number(d.rating), count: Number(d.reviewCount), source: s(d.reviewSource, 20) } } : {}) },
  };
}

// ── A pitch preview for a business that is ALREADY a client (Bryson, 2026-11-03, on Springbok: "I don't want to make
// the website and him have access to download it or use it until he pays but I want to be able to show him and pitch
// it"). Same builder, same private /demo/<token>/ link, same guard, strip and 30-day expiry as a demo. It lives on the
// client record at `pitchSite` (server-owned), never at `website`, so the portal never shows it, nothing can download
// or publish it, and it becomes their website only once the website agreement is signed and paid (index.html).
// What the WRITER sees: the client's record minus Bryson's private notes and billing terms, so nothing internal can
// end up in the copy.
export function pitchWriterOf(clientData) {
  const c = clientData || {};
  // The name customers see (brandName in site-render: the website's brand, then the review sender name, then the record).
  return { name: c.name, reviewSenderName: c.reviewSenderName || c.dba, website: { brandName: (c.website || {}).brandName }, niche: c.niche, services: c.services, brandVoice: c.brandVoice || {},
    campaignSetup: { serviceArea: (c.campaignSetup || {}).serviceArea, targetLocations: (c.campaignSetup || {}).targetLocations,
      mainOffer: (c.campaignSetup || {}).mainOffer, services: (c.campaignSetup || {}).services },
    websiteIntake: c.websiteIntake || {}, researchFacts: s(c.researchFacts, 600) };
}
// What the RENDERER sees: a client-shaped record with nothing that could reach a real lead path.
export function pitchClientOf(row, pitch = {}) {
  const c = (row && row.data) || {};
  const cs = c.campaignSetup || {};
  return {
    id: `demo-${s(row && row.id, 60)}`, demo: true,
    name: s((c.website || {}).brandName, 80) || s(c.reviewSenderName, 80) || s(c.dba, 80) || s(c.name, 80), niche: s(c.niche, 60), services: s(c.services, 400),
    businessPhone: s(c.businessPhone || c.phone, 30), businessAddress: s(c.businessAddress, 160),
    campaignSetup: { serviceArea: s(cs.serviceArea || cs.targetLocations, 160) },
    leadToken: "demo", landingSlug: "demo", ...(c.gbpStats ? { gbpStats: c.gbpStats } : {}),
    // 🔴 THEIR BRAND, which the first version dropped: the Brand kit, any colour set by hand, their logo, and what
    // was read off their current website. A pitch in BoldLine's colours sells the wrong thing.
    ...(c.brandKit ? { brandKit: c.brandKit } : {}), ...(c.brandColor ? { brandColor: c.brandColor } : {}),
    ...(c.landingPage && c.landingPage.brandColor ? { landingPage: { brandColor: c.landingPage.brandColor } } : {}),
    mediaLibrary: (c.mediaLibrary || []).filter((m) => m && m.category === "logo"),
    ...(pitch.brand || c.siteBrand ? { siteBrand: pitch.brand || c.siteBrand } : {}),
    website: { content: pitch.content || null, stock: pitch.stock || [], theme: pitch.theme || DEMO_THEME_DEFAULT, published: false, ...((c.website || {}).rating ? { rating: c.website.rating } : {}),
      ...(pitch.mode === "light" || pitch.mode === "dark" ? { mode: pitch.mode } : {}),
      ...(c.website && typeof c.website === "object" && c.website.brandColor ? { brandColor: c.website.brandColor } : {}) },
  };
}

export const demoExpiresAt = (demo) => {
  const t = Date.parse((demo && demo.builtAt) || "");
  return Number.isFinite(t) ? new Date(t + DEMO_DAYS * 864e5).toISOString() : null;
};
export const demoExpired = (demo, now = Date.now()) => {
  const e = demoExpiresAt(demo);
  return !e || Date.parse(e) <= now;
};

// What the OS is told about a demo: never the copy itself (it can be 15KB and the list holds hundreds).
export const demoSummary = (demo, origin = "") => {
  if (!demo || typeof demo !== "object") return null;
  return {
    status: demo.status || "", token: demo.token || "", theme: demo.theme || DEMO_THEME_DEFAULT, mode: demo.mode === "light" || demo.mode === "dark" ? demo.mode : "",
    // Whether THEY opened it (demoOpenJS below): how many times, and when first and last.
    opens: Math.max(0, Number(demo.opens) || 0), firstOpenedAt: demo.firstOpenedAt || null, lastOpenedAt: demo.lastOpenedAt || null,
    builtAt: demo.builtAt || null, startedAt: demo.startedAt || null, error: demo.error || null,
    expiresAt: demoExpiresAt(demo), expired: demo.status === "done" ? demoExpired(demo) : false,
    url: demo.token && origin ? `${origin.replace(/\/+$/, "")}/demo/${demo.token}/` : "",
  };
};

// The guard: runs before anything else on the page and stops every send. Same as the sample sites' guard.
export const DEMO_GUARD_JS = `(function(){
window.__DEMO_SITE=true;
var real=window.fetch;
window.fetch=function(u,o){var m=String((o&&o.method)||'GET').toUpperCase();if(m!=='GET'&&m!=='HEAD'){return Promise.resolve(new Response('{"ok":true,"preview":true}',{status:200,headers:{'content-type':'application/json'}}));}return real.apply(this,arguments);};
if(navigator.sendBeacon){navigator.sendBeacon=function(){return true;};}
document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation();var f=e.target;if(!f||f.querySelector('.bl-note'))return;var n=document.createElement('p');n.className='bl-note';n.setAttribute('role','status');n.textContent="This is a preview, so this form doesn't send anything yet. Once your site is live, every enquiry comes straight to you.";f.appendChild(n);},true);
})();`;

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Light or dark, flipped right there on the preview (Bryson, 2026-11-04). The page carries both sets of colours
// (site-render `css`), so this only turns html[data-mode] over; it is remembered for this preview while the tab is
// open, so clicking to another page or design keeps it. Nothing is saved anywhere: the OS sets what the link opens in.
export const MODE_TOGGLE_CSS = `.bl-mode{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;height:30px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#E9E6DF;font:inherit;cursor:pointer}
.bl-mode svg{width:15px;height:15px}.bl-mode:hover{border-color:#C8A84B}
@media (max-width:560px){.bl-mode{padding:0 8px}.bl-mode .bl-w{display:none}}`;
export const MODE_TOGGLE_HTML = `<button class="bl-mode" type="button" aria-label="Switch between light and dark"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg><span class="bl-w">Light / dark</span></button>`;
export const modeToggleJS = (key) => `(function(){var h=document.documentElement,k=${JSON.stringify(key)},s=null;if(!h.getAttribute('data-mode'))return;
try{s=sessionStorage.getItem(k);}catch(e){}if(s==='light'||s==='dark')h.setAttribute('data-mode',s);
var b=document.querySelector('.bl-mode');if(b)b.addEventListener('click',function(){var m=h.getAttribute('data-mode')==='dark'?'light':'dark';h.setAttribute('data-mode',m);try{sessionStorage.setItem(k,m);}catch(e){}});})();`;

// The strip across the top. `designs` = [{ id, label, href, current }].
export function demoBarHTML(name, designs = [], modeKey = "bl-mode") {
  const nav = designs.length > 1
    ? `<nav class="bl-designs" aria-label="Designs">${designs.map((d) => `<a href="${esc(d.href)}"${d.current ? ' aria-current="page"' : ""}>${esc(d.label)}</a>`).join("")}</nav>`
    : '<span class="bl-spacer"></span>';
  return `<style>
.bl-demo{position:fixed;top:0;left:0;right:0;height:44px;z-index:70;display:flex;align-items:center;gap:14px;padding:0 16px;background:#0B0D12;color:#E9E6DF;font:500 12.5px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;border-bottom:1px solid rgba(200,168,75,.4);box-shadow:0 6px 20px -10px rgba(0,0,0,.6)}
.bl-demo a{color:inherit;text-decoration:none}.bl-demo .bl-tag{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.bl-demo .bl-tag i{width:7px;height:7px;border-radius:50%;background:#C8A84B;box-shadow:0 0 0 3px rgba(200,168,75,.2);flex-shrink:0}.bl-demo .bl-long{color:#A9A59C}
.bl-demo .bl-spacer{margin-left:auto}.bl-demo .bl-designs{display:flex;gap:4px;margin-left:auto;padding:3px;border-radius:999px;background:rgba(255,255,255,.06);flex-shrink:0}
.bl-demo .bl-designs a{padding:6px 11px;border-radius:999px;color:#C9C5BB}.bl-demo .bl-designs a[aria-current]{background:#C8A84B;color:#15110A;font-weight:650}
.hd{inset:44px 0 auto!important}.hdr{top:44px!important}body{padding-top:44px}
.bl-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(200,168,75,.14);border:1px solid rgba(200,168,75,.45);font-size:13.5px;line-height:1.5}
.bl-demo .bl-n{display:none}
@media (max-width:900px){.bl-demo .bl-long{display:none}}
@media (max-width:560px){.bl-demo .bl-w{display:none}.bl-demo .bl-n{display:inline}.bl-demo{gap:8px;padding:0 10px;font-size:11.5px}.bl-demo .bl-designs a{padding:6px 8px}}
@media (max-width:380px){.bl-demo{gap:6px;padding:0 8px;font-size:11px}.bl-demo .bl-designs a{padding:6px 6px}}
${MODE_TOGGLE_CSS}
</style>
<div class="bl-demo" role="note" aria-label="Website preview"><span class="bl-tag"><i></i><b><span class="bl-w">Preview for ${esc(name)}</span><span class="bl-n">Preview</span></b><span class="bl-long">Made by BoldLine Media. Not live yet.</span></span>${nav}${MODE_TOGGLE_HTML}</div><script>${modeToggleJS(modeKey)}</script>`;
}

// ── Did they open it? ─────────────────────────────────────────────────────────────────
// Bryson, 2026-11-05: "build it with the signal that they opened it". One read request back to our own server
// (`<demo>/__seen`), the only thing a demo page ever sends, and GET on purpose: the send-nothing guard above lets GETs
// through untouched, so the guard itself is not weakened to allow it. It is only sent by a person actually looking:
//  - after they interact (scroll, tap, key) or after 6 seconds with the page on screen, so a link preview fetched by a
//    texting app (which neither scrolls nor waits) never reads as "opened";
//  - never from an automated browser, and never in a tab Bryson opened from the OS (the OS adds ?me=1; remembered for
//    the tab so clicking around the design switcher stays his);
//  - once per tab. The server also ignores repeats within 10 minutes and known preview robots.
export const demoOpenJS = (seenUrl, key) => `(function(){try{var K=${JSON.stringify(key)},U=${JSON.stringify(seenUrl)},ss=null;try{ss=window.sessionStorage;}catch(e){}
if(/[?&]me=1(&|$)/.test(location.search)){try{ss&&ss.setItem('bl-me','1');}catch(e){}}
var me=false;try{me=!!ss&&(ss.getItem('bl-me')==='1'||ss.getItem(K)==='1');}catch(e){}
if(me||navigator.webdriver)return;
var sent=false,t=null;var go=function(){if(sent||document.visibilityState!=='visible')return;sent=true;try{ss&&ss.setItem(K,'1');}catch(e){}try{fetch(U,{method:'GET',cache:'no-store',credentials:'omit',keepalive:true});}catch(e){}};
var arm=function(){clearTimeout(t);if(document.visibilityState==='visible')t=setTimeout(go,6000);};
['scroll','pointerdown','touchstart','keydown'].forEach(function(ev){addEventListener(ev,go,{passive:true,once:true});});
document.addEventListener('visibilitychange',arm);arm();}catch(e){}})();`;
// Known robots that fetch a link to draw a preview of it. Checked on the server too, in case one ever runs scripts.
export const PREVIEW_BOT = /bot\b|crawl|spider|preview|facebookexternalhit|whatsapp|slack|discord|telegram|twitterbot|linkedin|googlebot|bingbot|headless|python|curl|wget|okhttp|go-http/i;

// Turns a rendered page into the demo: guard first, the strip at the top of the body.
export function decorateDemo(html, { name, designs, modeKey, seenUrl, seenKey }) {
  return String(html)
    .replace(/<meta charset="utf-8">/i, (m) => `${m}<script>${DEMO_GUARD_JS}</script>`)
    .replace(/<body([^>]*)>/i, (m) => `${m}\n${demoBarHTML(name, designs, modeKey)}${seenUrl ? `<script>${demoOpenJS(seenUrl, seenKey || "bl-seen")}</script>` : ""}`);
}
