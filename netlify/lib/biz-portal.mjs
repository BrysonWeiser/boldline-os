// The business portal: one private, VIEW-ONLY page per business Bryson owns (Bryson, 2026-10-08: "when i add
// my business to it can you also give me a portal link (similar to client portals) except include everything
// for the business but dont allow edits through there but have the calendar showing all of the bookings for
// that specific business with the ability to click each person whos booked and it will open up to their
// details of what they filled out"). KB `business-portal`.
//
// What it shows: what needs attention right now, a month calendar of bookings (tap one for everything the
// customer filled in), the coming jobs, the numbers for the last 30 days, the leads, the ads, and how the
// business takes customers (packages, hours, its live pages).
//
// 🔴 VIEW ONLY, ENFORCED BY THE SERVER, NOT BY HIDING BUTTONS. The endpoint answers GET and nothing else,
// so there is no request this page (or anyone holding the link) can send that changes the record. Call,
// text, email and map links leave the page; none of them write anything.
// 🔴 The token is the whole key, like the partner page: long, random, never logged, never sent on as a
// referrer, and removed when the link is turned off. The OS opens it in a new tab and never embeds it
// (KB `preview-safety`). Only what the page needs leaves the server (no payment links, ad account ids,
// tokens or notes), and every customer's words are drawn as text, never as HTML.
import { isOwned } from "./owned.mjs";
import { brandColorOf } from "./site-render.mjs";
import { bookingConfig, intakeOf } from "./booking.mjs";
import { teamLeads } from "./team-view.mjs";
import { showcaseNumbers } from "./showcase.mjs";

export const PORTAL_MAX_BOOKINGS = 600;
export const PORTAL_MAX_LEADS = 100;

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// In a <script> block a customer's own words must never be able to close the tag.
export const jsonForScript = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const https = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : "");

// Text on a brand-coloured fill: whichever of near-black or white reads better (WCAG contrast), so a gold
// button gets dark text instead of white at about 2 to 1.
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const textOn = (hex) => { const L = lum(hex); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#FFFFFF" : "#0B0B0C"; };

export const portalOn = (cl) => !!(isOwned(cl) && cl.portal && cl.portal.on && cl.portal.token);
export const portalUrl = (base, token) => `${String(base || "").replace(/\/$/, "")}/biz?t=${encodeURIComponent(token)}`;

// "$199", "199.00", "$1,250" -> a number; anything else counts as nothing rather than guessing.
export const priceNumber = (p) => { const m = String(p || "").replace(/,/g, "").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
const durLabel = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h} hr${r ? ` ${r} min` : ""}` : `${r} min`; };
const t12 = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOW_LABEL = { quote: "Customers request a quote", book: "Customers book online", link: "Customers book through the business's own booking link", call: "Customers call first" };

// The business's live pages, only the ones that are really up.
export function portalLinks(cl, base) {
  const b = String(base || "").replace(/\/$/, "");
  const slug = cl && cl.landingSlug ? encodeURIComponent(cl.landingSlug) : "";
  const d = ((cl && cl.websiteDeal) || {}).domain || {};
  const site = d.live && d.host ? `https://${d.host}/` : (cl && cl.website && typeof cl.website === "object" && cl.website.published && slug ? `${b}/site/${slug}/` : "");
  const landing = cl && cl.landingPage && cl.landingPage.published && slug ? `${b}/lp/${slug}` : "";
  return { website: https(site), landing: https(landing), book: site && intakeOf(cl).how === "book" ? https(`${site}book/`) : "" };
}

export function portalBookings(cl) {
  return ((cl && cl.bookings) || [])
    .filter((x) => x && x.start && Date.parse(x.start))
    .slice()
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(-PORTAL_MAX_BOOKINGS)
    .map((x) => ({
      id: str(x.id, 60), pkg: str(x.packageName, 80), price: str(x.price, 30), minutes: Number(x.minutes) || 0,
      start: new Date(Date.parse(x.start)).toISOString(), end: x.end && Date.parse(x.end) ? new Date(Date.parse(x.end)).toISOString() : "",
      name: str(x.name, 120), phone: str(x.phone, 40), email: str(x.email, 160), address: str(x.address, 240), notes: str(x.notes, 800),
      status: x.status === "cancelled" ? "cancelled" : "booked",
      deposit: x.deposit ? { amount: str(x.deposit.amount, 20), paid: !!x.deposit.paid } : null,
      bookedAt: x.createdAt && Date.parse(x.createdAt) ? new Date(Date.parse(x.createdAt)).toISOString() : "",
    }));
}

// Everything the page shows, built once on the server. Pure, so verify-business-portal can run it.
export function portalData(cl, { base = "", now = Date.now() } = {}) {
  const cfg = bookingConfig(cl);
  const tz = cfg.tz;
  const ymd = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: tz });
  const bookings = portalBookings(cl);
  const live = bookings.filter((b) => b.status === "booked");
  const upcoming = live.filter((b) => Date.parse(b.end || b.start) > now);
  const today = ymd(now);
  const cut = now - 30 * 864e5;
  const n = showcaseNumbers(cl, now);
  const leads = teamLeads(cl).slice(0, PORTAL_MAX_LEADS);
  // Leads per day for the last 30 days, oldest first, on the business's own clock.
  const days = Array.from({ length: 30 }, (_, i) => ymd(now - (29 - i) * 864e5));
  const perDay = days.map((d) => leads.filter((l) => l.at && ymd(Date.parse(l.at)) === d).length);
  const ap = (cl && cl.adPerf) || {};
  const tot = ap.totals || {}, bud = ap.budget || {};
  const I = intakeOf(cl);
  return {
    name: str(cl && cl.name, 120) || "Your business",
    niche: str(cl && cl.niche, 60), area: str(cl && (cl.businessAddress || (cl.campaignSetup || {}).serviceArea), 120),
    phone: str(cl && (cl.businessPhone || cl.callTrackingNumber), 40), email: str(cl && cl.email, 160),
    tz, now: new Date(now).toISOString(), today,
    links: portalLinks(cl, base),
    numbers: {
      leads: n.leads, won: n.won, spend: n.spend, costPerLead: n.costPerLead,
      bookings: live.filter((b) => Date.parse(b.bookedAt || b.start) >= cut && Date.parse(b.bookedAt || b.start) <= now).length,
      upcoming: upcoming.length,
      upcomingValue: Math.round(upcoming.reduce((s, b) => s + priceNumber(b.price), 0)),
      todayJobs: live.filter((b) => ymd(Date.parse(b.start)) === today).length,
      unpaid: upcoming.filter((b) => b.deposit && !b.deposit.paid).length,
      waiting: leads.filter((l) => l.status === "new").length,
      perDay,
    },
    ads: ap.syncedAt ? {
      syncedAt: ap.syncedAt, live: Number(tot.liveCampaigns) || 0, spend30d: Math.round(Number(tot.spend30d) || 0),
      clicks: Number(tot.clicks) || 0, impressions: Number(tot.impressions) || 0,
      monthly: Math.round(Number(bud.monthly) || 0), pacing: Math.round(Number(bud.pacing) || 0), pct: bud.pct == null ? null : Number(bud.pct),
    } : null,
    setup: {
      how: HOW_LABEL[I.how] || HOW_LABEL.quote,
      packages: cfg.packages.map((p) => ({ name: p.name, price: p.price, length: durLabel(p.minutes), deposit: p.depositLink ? (p.deposit || "Yes") : "", desc: p.desc })),
      hours: cfg.hours.map((h, i) => `${DAY[i]}: ${h ? `${t12(h[0])} to ${t12(h[1])}` : "Closed"}`),
      buffer: cfg.buffer, leadHours: cfg.leadHours, daysAhead: cfg.daysAhead,
    },
    bookings, leads,
  };
}

export function renderBizPortal(cl, { token, base = "", now = Date.now() } = {}) {
  const accent = brandColorOf(cl) || "#1F2937";
  // A light brand colour (a gold, a yellow) fills buttons fine but is unreadable as text on white, so text
  // that would be in the brand colour falls back to grey ink, and anything filled with it gets dark text.
  const on = textOn(accent);
  const ink = on === "#FFFFFF" ? accent : "#4B5563";
  const D = portalData(cl, { base, now });
  const name = esc(D.name);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#ffffff">
<title>${name}</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:116px}
body{margin:0;background:#F4F5F7;color:#111827;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%}
button{font-family:inherit}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border-bottom:1px solid #E5E7EB;padding:12px 16px 0;padding-top:max(12px,env(safe-area-inset-top))}
.in{max-width:1120px;margin:0 auto}
.row{display:flex;align-items:center;gap:10px}
.biz{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${ink}}
h1{margin:1px 0 0;font-size:22px;line-height:1.15;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grow{flex:1;min-width:0}
.vo{font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;background:#F3F4F6;color:#4B5563;white-space:nowrap}
.ref{border:1px solid #D1D5DB;background:#fff;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;color:#374151;cursor:pointer}
.nav{display:flex;gap:6px;overflow-x:auto;padding:10px 0 10px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}
.nav a{flex:0 0 auto;padding:7px 13px;border-radius:999px;border:1px solid #E5E7EB;background:#fff;color:#374151;font-size:13px;font-weight:600;text-decoration:none}
.wrap{max-width:1120px;margin:0 auto;padding:16px 16px 48px}
.sec{margin-top:26px}.sec>h2{font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#6B7280;margin:0 0 10px}
.card{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:16px}
.now{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.now .card{padding:14px}.now b{display:block;font-size:24px;line-height:1.1}.now span{font-size:12.5px;color:#6B7280}
.now .hot{border-color:${accent};box-shadow:inset 3px 0 0 ${accent}}
.next{margin-top:10px;display:flex;align-items:center;gap:12px;cursor:pointer;width:100%;text-align:left;font-size:15px}
.next .k{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${ink}}
.cal{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.ch{display:flex;align-items:center;gap:8px;margin-bottom:10px}.ch h3{flex:1;margin:0;font-size:18px}
.ch button{width:38px;height:38px;border-radius:10px;border:1px solid #D1D5DB;background:#fff;font-size:18px;cursor:pointer;color:#374151}
.ch .td{width:auto;padding:0 12px;font-size:13px;font-weight:600}
.dow,.grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.dow div{font-size:11px;font-weight:700;color:#9CA3AF;text-align:center;padding-bottom:4px}
.d{min-height:58px;border:1px solid #F0F1F3;border-radius:10px;background:#FAFAFB;padding:5px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0;color:#111827}
.d.out{visibility:hidden}.d .n{font-size:12.5px;font-weight:700}
.d.today .n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${accent};color:${on}}
.d.sel{border-color:${accent};background:#fff;box-shadow:0 0 0 2px ${accent}33}
.dots{display:flex;gap:3px;flex-wrap:wrap}.dots i{width:6px;height:6px;border-radius:50%;background:${accent}}.dots i.x{background:#D1D5DB}
.chip{display:none;font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px;background:${accent}14;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid ${accent}}
.chip.x{text-decoration:line-through;color:#9CA3AF;border-left-color:#D1D5DB;background:#F3F4F6}
.more{display:none;font-size:11px;color:#6B7280}
.dayh{font-size:15px;font-weight:800;margin:0 0 8px}
.bk{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;color:#111827}
.bk:hover{border-color:${accent}}
.bk .tm{flex:0 0 auto;min-width:68px;font-weight:800;font-size:14px}
.bk .who{font-weight:700}.bk .sub{font-size:13px;color:#6B7280;overflow-wrap:anywhere}
.bk.x{opacity:.55}.bk.x .who{text-decoration:line-through}
.tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-top:4px}
.tag.unpaid{background:#FEF3C7;color:#92400E}.tag.paid{background:#DCFCE7;color:#166534}.tag.cx{background:#F3F4F6;color:#6B7280}
.empty{color:#6B7280;padding:18px 4px;text-align:center}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile b{display:block;font-size:22px;line-height:1.15}.tile span{font-size:12.5px;color:#6B7280}
.bars{display:flex;align-items:flex-end;gap:3px;height:70px;margin-top:12px}.bars i{flex:1;background:${accent};border-radius:3px 3px 0 0;min-height:2px;opacity:.85}
.cap{font-size:12px;color:#6B7280;margin-top:6px}
.lead{background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:13px;margin-bottom:8px}
.lh{display:flex;gap:10px;align-items:flex-start}.ln{font-weight:700;font-size:16px}.lt{font-size:12.5px;color:#6B7280}
.pill{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:#F3F4F6;color:#374151;white-space:nowrap}
.pill.new{background:${accent};color:${on}}.pill.won{background:#DCFCE7;color:#166534}.pill.lost{color:#9CA3AF}
.msg{margin:8px 0 0;color:#374151;white-space:pre-wrap;overflow-wrap:anywhere}
.acts{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:11px;font-weight:700;font-size:14.5px;text-decoration:none;border:1px solid #D1D5DB;color:#111827;background:#fff}
.btn.p{background:${accent};border-color:${accent};color:${on}}
.meter{height:8px;border-radius:99px;background:#F3F4F6;overflow:hidden;margin-top:8px}.meter i{display:block;height:100%;background:${accent}}
.kv{display:grid;grid-template-columns:minmax(0,1fr);gap:2px 16px}.kv div{padding:8px 0;border-bottom:1px solid #F3F4F6;overflow-wrap:anywhere}.kv div:last-child{border-bottom:0}
.kv small{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#9CA3AF}
.pk{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.pk .card b{display:block;font-size:16px}.pk .card span{font-size:13.5px;color:${ink};font-weight:700}.pk .card p{margin:4px 0 0;font-size:13.5px;color:#6B7280}
.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.addcal{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:-2px 0 12px}.addcal span{flex:1 1 260px;min-width:0;font-size:12.5px;color:#6B7280;overflow-wrap:anywhere}.addcal b{font-weight:600;color:#374151}
.foot{text-align:center;font-size:12px;color:#9CA3AF;margin-top:30px}
.sheet{position:fixed;inset:0;z-index:20;display:none;align-items:flex-end;justify-content:center;background:rgba(17,24,39,.45)}
.sheet.on{display:flex}
.panel{background:#fff;width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:20px 20px 0 0;padding:20px 18px;padding-bottom:max(20px,env(safe-area-inset-bottom));animation:up .22s ease-out}
.panel h3{margin:0;font-size:21px;line-height:1.2}.panel .when{color:${ink};font-weight:700;margin-top:3px}
.cls{float:right;width:36px;height:36px;border-radius:50%;border:1px solid #E5E7EB;background:#fff;font-size:18px;cursor:pointer;color:#374151}
.mlink{color:${ink};font-weight:600}
@keyframes up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
@media (min-width:700px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.kv{grid-template-columns:repeat(2,minmax(0,1fr))}.d{min-height:92px}.chip,.more{display:block}.dots{display:none}
  .sheet{align-items:center}.panel{border-radius:20px;max-height:84vh}}
@media (max-width:640px){.now{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:980px){.cal{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.panel{animation:none}}
</style></head><body>
<div class="top"><div class="in">
  <div class="row"><div class="grow"><div class="biz">${name}</div><h1>Business overview</h1></div><span class="vo">View only</span><button class="ref" id="ref" type="button">Refresh</button></div>
  <nav class="nav"><a href="#now">Right now</a><a href="#calendar">Calendar</a><a href="#coming">Coming up</a><a href="#numbers">Numbers</a><a href="#leads">Leads</a><a href="#ads">Ads</a><a href="#setup">Setup</a></nav>
</div></div>
<div class="wrap">
  <section class="sec" id="now" style="margin-top:4px"><h2>Right now</h2><div class="now" id="nowTiles"></div><div id="nextBox"></div></section>
  <section class="sec" id="calendar"><h2>Calendar</h2>
    ${token && base ? `<div class="addcal"><a class="btn" href="${esc(calWebcalUrl(base, token))}">Add to my phone's calendar</a><span>On an iPhone, tap it and choose Subscribe. Every booking then shows up in your phone's calendar on its own. For Google Calendar, copy <b>${esc(calFeedUrl(base, token))}</b> into "Add calendar, From URL".</span></div>` : ""}
    <div class="cal"><div class="card"><div class="ch"><button type="button" id="prev" aria-label="Previous month">&#8249;</button><h3 id="mon"></h3><button type="button" class="td" id="tdy">Today</button><button type="button" id="next" aria-label="Next month">&#8250;</button></div>
      <div class="dow"><div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div></div><div class="grid" id="grid"></div></div>
      <div><div class="dayh" id="dayh"></div><div id="dayList"></div></div></div>
  </section>
  <section class="sec" id="coming"><h2>Coming up</h2><div id="upList"></div></section>
  <div class="two">
    <section class="sec" id="numbers"><h2>Last 30 days</h2><div class="card"><div class="tiles" id="tiles"></div><div class="bars" id="bars" aria-hidden="true"></div><div class="cap">Leads per day, last 30 days</div></div></section>
    <section class="sec" id="ads"><h2>Ads</h2><div class="card" id="adsBox"></div></section>
  </div>
  <section class="sec" id="leads"><h2>Leads</h2><div id="leadList"></div></section>
  <section class="sec" id="setup"><h2>How customers reach the business</h2><div class="card" id="setupBox"></div><div class="pk" id="pkgs" style="margin-top:10px"></div></section>
  <div class="foot" id="foot"></div>
</div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="shName"><div class="panel" id="panel"></div></div>
<script>
(function(){
  var D=${jsonForScript(D)},T=${jsonForScript(String(token || ""))},M=null,SEL=null,LALL=false;
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
  function $(i){return document.getElementById(i);}
  function ymd(t){return new Date(t).toLocaleDateString("en-CA",{timeZone:D.tz});}
  function tm(t){return new Date(t).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:D.tz});}
  function dlong(t){return new Date(t).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:D.tz});}
  function dshort(t){return new Date(t).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:D.tz});}
  function ylong(s){var p=s.split("-").map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2],12)).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:"UTC"});}
  function money(n){return "$"+Number(n||0).toLocaleString("en-US");}
  function digits(p){return String(p||"").replace(/[^0-9+]/g,"");}
  function dur(m){var h=Math.floor(m/60),r=m%60;return h?h+" hr"+(r?" "+r+" min":""):r+" min";}
  function ago(iso){var t=Date.parse(iso);if(!t)return "";var m=Math.round((Date.now()-t)/60000);if(m<1)return "just now";if(m<60)return m+" min ago";var h=Math.round(m/60);if(h<24)return h+" hr ago";return dshort(t)+" at "+tm(t);}
  function link(cls,txt,href,blank){var a=el("a",cls,txt);a.href=href;if(blank){a.target="_blank";a.rel="noopener noreferrer";}return a;}
  function byDay(){var o={};D.bookings.forEach(function(b){var k=ymd(b.start);(o[k]=o[k]||[]).push(b);});return o;}
  function bkRow(b){var r=el("button","bk"+(b.status==="cancelled"?" x":""));r.type="button";r.appendChild(el("div","tm",tm(b.start)));
    var g=el("div");g.style.minWidth="0";g.appendChild(el("div","who",(b.name||"No name")+" \\u00b7 "+(b.pkg||"Booking")));
    var s=[];if(b.address)s.push(b.address);if(b.phone)s.push(b.phone);if(s.length)g.appendChild(el("div","sub",s.join(" \\u00b7 ")));
    if(b.status==="cancelled")g.appendChild(el("span","tag cx","Cancelled"));else if(b.deposit)g.appendChild(el("span","tag "+(b.deposit.paid?"paid":"unpaid"),b.deposit.paid?"Deposit paid":"Deposit not paid yet"));
    r.appendChild(g);r.onclick=function(){openB(b);};return r;}
  function nowTiles(){var N=D.numbers,box=$("nowTiles");box.innerHTML="";
    [[N.todayJobs,"job"+(N.todayJobs===1?"":"s")+" today",N.todayJobs>0],[N.upcoming,"booked ahead",false],[N.waiting,"lead"+(N.waiting===1?"":"s")+" waiting for a call",N.waiting>0],[N.unpaid,"deposit"+(N.unpaid===1?"":"s")+" not paid yet",N.unpaid>0]]
      .forEach(function(x){var c=el("div","card"+(x[2]?" hot":""));c.appendChild(el("b",null,String(x[0])));c.appendChild(el("span",null,x[1]));box.appendChild(c);});
    var nb=$("nextBox");nb.innerHTML="";var nx=D.bookings.filter(function(b){return b.status==="booked"&&Date.parse(b.end||b.start)>Date.now();})[0];
    if(nx){var c=el("button","card next");c.type="button";var g=el("div");g.style.minWidth="0";g.appendChild(el("div","k","Next job"));
      g.appendChild(el("div",null,dshort(nx.start)+" at "+tm(nx.start)+": "+(nx.pkg||"Booking")+" for "+(nx.name||"a customer")+(nx.address?", "+nx.address:"")));c.appendChild(g);c.onclick=function(){openB(nx);};nb.appendChild(c);}}
  function cal(){var bd=byDay(),p=M.split("-").map(Number),y=p[0],m=p[1],first=new Date(Date.UTC(y,m-1,1,12)).getUTCDay(),n=new Date(Date.UTC(y,m,0,12)).getUTCDate(),g=$("grid");
    $("mon").textContent=new Date(Date.UTC(y,m-1,1,12)).toLocaleDateString("en-US",{month:"long",year:"numeric",timeZone:"UTC"});g.innerHTML="";
    for(var i=0;i<first;i++)g.appendChild(el("div","d out"));
    for(var d=1;d<=n;d++){(function(d){var k=y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0"),list=bd[k]||[];
      var c=el("button","d"+(k===D.today?" today":"")+(k===SEL?" sel":""));c.type="button";c.appendChild(el("span","n",String(d)));
      var live=list.filter(function(b){return b.status==="booked";});c.setAttribute("aria-label",ylong(k)+(live.length?", "+live.length+" booking"+(live.length===1?"":"s"):""));
      var dots=el("div","dots");list.slice(0,6).forEach(function(b){dots.appendChild(el("i",b.status==="cancelled"?"x":""));});c.appendChild(dots);
      list.slice(0,2).forEach(function(b){c.appendChild(el("span","chip"+(b.status==="cancelled"?" x":""),tm(b.start).replace(":00","")+" "+(b.name||b.pkg||"")));});
      if(list.length>2)c.appendChild(el("span","more","+"+(list.length-2)+" more"));
      c.onclick=function(){SEL=k;cal();day();};g.appendChild(c);})(d);}}
  function day(){var list=(byDay()[SEL]||[]);$("dayh").textContent=(SEL===D.today?"Today, ":"")+ylong(SEL);var box=$("dayList");box.innerHTML="";
    if(!list.length)box.appendChild(el("div","card empty","Nothing booked this day."));list.forEach(function(b){box.appendChild(bkRow(b));});}
  function shift(k){var p=M.split("-").map(Number),t=new Date(Date.UTC(p[0],p[1]-1+k,1));M=t.getUTCFullYear()+"-"+String(t.getUTCMonth()+1).padStart(2,"0");cal();}
  function coming(){var box=$("upList");box.innerHTML="";var up=D.bookings.filter(function(b){return b.status==="booked"&&Date.parse(b.end||b.start)>Date.now();}).slice(0,12);
    if(!up.length){box.appendChild(el("div","card empty","Nothing booked yet. New bookings show up here and on the calendar the moment they come in."));return;}
    var last="";up.forEach(function(b){var k=ymd(b.start);if(k!==last){var h=el("div","dayh",(k===D.today?"Today, ":"")+ylong(k));h.style.margin="12px 0 6px";box.appendChild(h);last=k;}box.appendChild(bkRow(b));});}
  function numbers(){var N=D.numbers,t=$("tiles");t.innerHTML="";
    [[N.leads,"leads"],[N.bookings,"bookings made"],[N.won,"jobs won"],[money(N.spend),"ad spend"],[N.costPerLead!=null?money(N.costPerLead):"Not yet","cost per lead"],[money(N.upcomingValue),"booked ahead"]]
      .forEach(function(x){var c=el("div","tile");c.appendChild(el("b",null,String(x[0])));c.appendChild(el("span",null,x[1]));t.appendChild(c);});
    var b=$("bars"),mx=Math.max.apply(null,N.perDay.concat([1]));b.innerHTML="";N.perDay.forEach(function(v){var i=el("i");i.style.height=(v?Math.max(6,v/mx*100):3)+"%";if(!v)i.style.opacity=".2";b.appendChild(i);});}
  function ads(){var box=$("adsBox"),A=D.ads;box.innerHTML="";if(!A){box.appendChild(el("div","empty","No ads running yet. Spend, clicks and the monthly budget show up here once they start."));return;}
    var t=el("div","tiles");[[A.live,"campaigns live"],[money(A.spend30d),"spent, last 30 days"],[A.clicks.toLocaleString("en-US"),"clicks"]].forEach(function(x){var c=el("div","tile");c.appendChild(el("b",null,String(x[0])));c.appendChild(el("span",null,x[1]));t.appendChild(c);});box.appendChild(t);
    if(A.monthly>0){var p=el("div","cap",money(A.pacing)+" of the "+money(A.monthly)+" monthly budget"+(A.pct!=null?" ("+A.pct+"%)":""));p.style.marginTop="14px";box.appendChild(p);var m=el("div","meter"),i=el("i");i.style.width=Math.min(100,A.pct||0)+"%";m.appendChild(i);box.appendChild(m);}
    box.appendChild(el("div","cap","Figures updated "+ago(A.syncedAt)+"."));}
  function leads(){var box=$("leadList");box.innerHTML="";if(!D.leads.length){box.appendChild(el("div","card empty","No leads yet. They show up here the moment someone gets in touch."));return;}
    var L={new:"New",contacted:"Contacted",won:"Won",lost:"Lost"};
    D.leads.slice(0,LALL?100:8).forEach(function(l){var c=el("div","lead"),h=el("div","lh"),g=el("div");g.style.flex="1";g.style.minWidth="0";g.appendChild(el("div","ln",l.name||"No name given"));
      g.appendChild(el("div","lt",ago(l.at)+(l.source?" \\u00b7 "+l.source.replace(/_/g," "):"")));h.appendChild(g);h.appendChild(el("span","pill "+l.status,L[l.status]||l.status));c.appendChild(h);
      if(l.message)c.appendChild(el("p","msg",l.message));var a=el("div","acts"),d=digits(l.phone);if(d){a.appendChild(link("btn p","Call","tel:"+d));a.appendChild(link("btn","Text","sms:"+d));}
      if(l.email&&/^[^\\s@<>"]+@[^\\s@<>"]+$/.test(l.email))a.appendChild(link("btn","Email","mailto:"+l.email));if(a.childNodes.length)c.appendChild(a);box.appendChild(c);});
    if(!LALL&&D.leads.length>8){var mb=el("button","btn","Show all "+D.leads.length+" leads");mb.type="button";mb.style.width="100%";mb.onclick=function(){LALL=true;leads();};box.appendChild(mb);}}
  function setup(){var S=D.setup,box=$("setupBox");box.innerHTML="";var kv=el("div","kv");
    [["How customers book",S.how],["Phone",D.phone||"Not set"],["Email",D.email||"Not set"],["Area",D.area||"Not set"],["Opening hours",S.hours.join("\\n")],["Booking rules",S.buffer+" min travel time between jobs, bookings at least "+S.leadHours+" hours ahead, up to "+S.daysAhead+" days out"]]
      .forEach(function(x){var d=el("div");d.appendChild(el("small",null,x[0]));var v=el("span",null,x[1]);v.style.whiteSpace="pre-line";d.appendChild(v);kv.appendChild(d);});box.appendChild(kv);
    var ln=el("div","links");if(D.links.website)ln.appendChild(link("btn p","Open the website",D.links.website,true));if(D.links.book)ln.appendChild(link("btn","Open the booking page",D.links.book,true));if(D.links.landing)ln.appendChild(link("btn","Open the ad landing page",D.links.landing,true));
    if(ln.childNodes.length)box.appendChild(ln);else box.appendChild(el("div","cap","The website and landing page links show here once they are live."));
    var pk=$("pkgs");pk.innerHTML="";S.packages.forEach(function(p){var c=el("div","card");c.appendChild(el("b",null,p.name));c.appendChild(el("span",null,[p.price,p.length,p.deposit?(p.deposit==="Yes"?"Deposit":p.deposit+" deposit"):""].filter(Boolean).join(" \\u00b7 ")));if(p.desc)c.appendChild(el("p",null,p.desc));pk.appendChild(c);});}
  function row(k,v,node){var d=el("div");d.appendChild(el("small",null,k));if(node)d.appendChild(node);else d.appendChild(el("span",null,v));return d;}
  function openB(b){var p=$("panel");p.innerHTML="";var x=el("button","cls","\\u00d7");x.type="button";x.setAttribute("aria-label","Close");x.onclick=close;p.appendChild(x);
    var h=el("h3",null,b.name||"No name given");h.id="shName";p.appendChild(h);p.appendChild(el("div","when",dlong(b.start)+" at "+tm(b.start)+(b.end?" to "+tm(b.end):"")));
    if(b.status==="cancelled")p.appendChild(el("span","tag cx","Cancelled"));
    var kv=el("div","kv");kv.style.marginTop="12px";
    kv.appendChild(row("Package",[b.pkg,b.price,b.minutes?dur(b.minutes):""].filter(Boolean).join(" \\u00b7 ")));
    if(b.address){var a=link("mlink",b.address,"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(b.address),true);kv.appendChild(row("Address",null,a));}
    kv.appendChild(row("Phone",b.phone||"Not given"));kv.appendChild(row("Email",b.email||"Not given"));
    if(b.deposit)kv.appendChild(row("Deposit",(b.deposit.amount?b.deposit.amount+", ":"")+(b.deposit.paid?"paid":"not paid yet")));
    if(b.bookedAt)kv.appendChild(row("Booked",dshort(b.bookedAt)+" at "+tm(b.bookedAt)));
    var nt=row("What they told us",b.notes||"Nothing added");nt.style.gridColumn="1/-1";kv.appendChild(nt);p.appendChild(kv);
    var ac=el("div","acts"),d=digits(b.phone);if(d){ac.appendChild(link("btn p","Call","tel:"+d));ac.appendChild(link("btn","Text","sms:"+d));}
    if(b.email&&/^[^\\s@<>"]+@[^\\s@<>"]+$/.test(b.email))ac.appendChild(link("btn","Email","mailto:"+b.email));if(ac.childNodes.length)p.appendChild(ac);
    $("sheet").className="sheet on";x.focus();}
  function close(){$("sheet").className="sheet";}
  $("sheet").onclick=function(e){if(e.target===this)close();};
  document.addEventListener("keydown",function(e){if(e.key==="Escape")close();});
  $("prev").onclick=function(){shift(-1);};$("next").onclick=function(){shift(1);};
  $("tdy").onclick=function(){M=D.today.slice(0,7);SEL=D.today;cal();day();};
  function all(){if(!M)M=D.today.slice(0,7);if(!SEL)SEL=D.today;nowTiles();cal();day();coming();numbers();ads();leads();setup();
    $("foot").textContent="View only. Updated "+tm(D.now)+". Refreshes on its own every few minutes.";}
  function refresh(){fetch(location.pathname+"?t="+encodeURIComponent(T)+"&data=1",{cache:"no-store"}).then(function(r){return r.json();}).then(function(j){if(j&&j.ok&&j.data){D=j.data;all();}}).catch(function(){});}
  $("ref").onclick=refresh;setInterval(function(){if(!document.hidden)refresh();},180000);
  all();
})();
</script>
</body></html>`;
}

export const portalOffPage = () => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Link turned off</title>
<style>body{margin:0;background:#F4F5F7;color:#111827;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}div{max-width:420px;text-align:center}h1{font-size:21px;margin:0 0 8px}p{margin:0;color:#6B7280}</style></head>
<body><div><h1>This link is turned off</h1><p>Ask for a new link to see this business again.</p></div></body></html>`;

// ── The same bookings as a calendar a phone subscribes to ─────────────────────────────────────────────
// Bryson, 2026-10-09 ("lets do all of them", the second being jobs on his and his partner's phone calendar).
// /biz-cal?t=<portal token>. A phone re-reads it on its own; a cancelled booking is sent as cancelled so it
// disappears from the phone too. Same token, same people, same view-only rule as the portal.
const icsText = (s) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Lines longer than 75 characters are folded, as the calendar format requires.
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
export function bookingsIcs(cl, now = Date.now()) {
  const name = str(cl && cl.name, 120) || "Bookings";
  const host = "bookings";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Business portal//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`${name} bookings`)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  portalBookings(cl).filter((b) => Date.parse(b.end || b.start) > now - 60 * 864e5).forEach((b) => {
    const end = b.end || new Date(Date.parse(b.start) + (b.minutes || 60) * 60000).toISOString();
    const desc = [b.pkg && `${b.pkg}${b.price ? ` (${b.price})` : ""}`, b.phone && `Phone: ${b.phone}`, b.email && `Email: ${b.email}`,
      b.deposit && `Deposit: ${b.deposit.amount ? b.deposit.amount + ", " : ""}${b.deposit.paid ? "paid" : "not paid yet"}`, b.notes && `They said: ${b.notes}`].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${icsText(b.id || b.start)}@${host}`, `DTSTAMP:${icsTime(now)}`, `DTSTART:${icsTime(b.start)}`, `DTEND:${icsTime(end)}`,
      `SUMMARY:${icsText(`${b.pkg || "Booking"}: ${b.name || "Customer"}`)}`, b.address ? `LOCATION:${icsText(b.address)}` : "", `DESCRIPTION:${icsText(desc)}`,
      `STATUS:${b.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).map(fold).join("\r\n") + "\r\n";
}
// webcal:// opens the phone's "subscribe to calendar" screen; Google Calendar takes the https form.
export const calFeedUrl = (base, token) => `${String(base || "").replace(/\/$/, "")}/biz-cal?t=${encodeURIComponent(token)}`;
export const calWebcalUrl = (base, token) => calFeedUrl(base, token).replace(/^https?:\/\//, "webcal://");
