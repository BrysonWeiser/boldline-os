// Websites BoldLine builds for clients: one renderer, three looks, five pages.
//
// Bryson, 2026-10-06: sell templated, OS-built websites ($1,500 + $99/mo, anyone), and *"I want it to
// be the most up to date modern website ... micro animations 3d graphics etc basically thinking outside
// the box"*. References he gave: jeskojets.com (cinematic scroll, huge expanded type, text that lights
// up word by word, floating pill CTA) and inthebrandlab.com (dark glow, eyebrow pill, numbered cards,
// marquee). KB `website-design-bar` (the standing rule) and `website-builder`.
//
// 🔴 THE RULES THIS FILE MUST NEVER BREAK, each pinned by tests/verify-site-builder.mjs:
//  1. FAST FIRST. Everything a visitor needs is plain HTML and CSS that renders before any script
//     runs. Motion is layered on by `html.js`; the WebGL piece loads after the page is idle, and is
//     skipped for "reduce motion", Data Saver, small-memory phones and browsers without WebGL.
//  2. NO RELATIVE LINKS. Every href is absolute, built from `base`. A relative link inside the OS
//     preview (an iframe srcdoc) resolves against the OS itself; that is how a landing page CTA once
//     navigated to the OS. Phone and email links are tel: and mailto:.
//  3. A PREVIEW CHANGES NOTHING. The form refuses to send from an about: document (the srcdoc), and
//     in the preview every link is intercepted and only asks the OS to switch tabs.
//  4. NOTHING POINTS BACK AT BOLDLINE, no emojis, no em dashes, and no `//` comments in shipped
//     script (it is delivered verbatim to the client's own domain).
//  5. NO INVENTED PROOF. Reviews are only ever real ones he typed in, or a link to Google. No
//     fabricated testimonials, counts, ratings or years in business.

export const SITE_PAGES = [
  { id: "home", label: "Home", path: "" },
  { id: "services", label: "Services", path: "services" },
  { id: "about", label: "About", path: "about" },
  { id: "reviews", label: "Reviews", path: "reviews" },
  { id: "contact", label: "Contact", path: "contact" },
];
export const pageById = (id) => SITE_PAGES.find((p) => p.id === id) || null;

export const SITE_THEMES = {
  cinematic: { label: "Cinematic", blurb: "Light and airy, huge type, a glass orb that follows the cursor." },
  aurora: { label: "Aurora", blurb: "Dark and bold, glowing color, numbered cards and a moving strip." },
  editorial: { label: "Editorial", blurb: "Warm and refined, elegant serif headlines, photo-led." },
};
export const THEME_IDS = Object.keys(SITE_THEMES);
export const themeOf = (cl, override) => {
  const t = String(override || (cl && cl.website && cl.website.theme) || "");
  return SITE_THEMES[t] ? t : "aurora";
};

// ── Small helpers ─────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s, n = 400) => String(s == null ? "" : s).replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim().slice(0, n);
const hexOk = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const onColor = (h) => (lum(h) > 0.42 ? "#0B0B0C" : "#FFFFFF");
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const httpsUrl = (u) => { try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.toString() : ""; } catch { return ""; } };
const digits = (p) => String(p || "").replace(/[^0-9+]/g, "");

// The business name customers know. A legal suffix is noise on a website.
export const brandName = (cl) => {
  const w = (cl && cl.website) || {};
  const raw = String(w.brandName || (cl && cl.reviewSenderName) || (cl && cl.name) || "").trim();
  return raw.replace(/,?\s+(LLC|L\.L\.C\.|Inc\.?|PLLC|LLP|Corp\.?|Co\.)$/i, "").trim() || "Our Business";
};

// Health businesses get no free-text "message" box: a patient will describe symptoms in it.
const isHealth = (cl) => /chiro|dental|dentist|orthodon|med ?spa|medical|clinic|therap|physio|wellness|dermatolog|optom|audiolog|\baba\b|counsel|psych|doctor|physician|hospice|home health/i
  .test(`${(cl && cl.niche) || ""} ${(cl && cl.name) || ""}`);

// ── Content: what the builder wrote, with safe fallbacks so a page always renders ─────────
export function siteContent(cl) {
  const c = ((cl && cl.website && cl.website.content) || {});
  const name = brandName(cl);
  const niche = clean((cl && cl.niche) || "", 60);
  const area = clean((cl && cl.campaignSetup && (cl.campaignSetup.serviceArea || cl.campaignSetup.targetLocations)) || "", 120);
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const services = list(c.services, 8).map((s) => ({ name: clean(s && s.name, 60), blurb: clean(s && s.blurb, 180), detail: clean(s && s.detail, 600) })).filter((s) => s.name);
  return {
    name,
    niche,
    area,
    hero: {
      eyebrow: clean(c.hero && c.hero.eyebrow, 60) || (niche ? `${niche}${area ? " in " + area : ""}` : area),
      headline: clean(c.hero && c.hero.headline, 90) || (niche ? `${niche} done right.` : `Welcome to ${name}.`),
      sub: clean(c.hero && c.hero.sub, 220) || `${name} is here to help. Get in touch and we'll get back to you fast.`,
      lineA: clean(c.hero && c.hero.lineA, 28),
      lineB: clean(c.hero && c.hero.lineB, 28),
    },
    services: services.length ? services : [{ name: niche || "Our services", blurb: "Tell us what you need and we'll take care of it.", detail: "" }],
    why: list(c.why, 4).map((w) => ({ title: clean(w && w.title, 60), text: clean(w && w.text, 220) })).filter((w) => w.title),
    about: { headline: clean(c.about && c.about.headline, 90) || `About ${name}`, story: list(c.about && c.about.story, 4).map((p) => clean(p, 700)).filter(Boolean) },
    process: list(c.process, 4).map((p) => ({ title: clean(p && p.title, 50), text: clean(p && p.text, 200) })).filter((p) => p.title),
    faqs: list(c.faqs, 8).map((f) => ({ q: clean(f && f.q, 160), a: clean(f && f.a, 600) })).filter((f) => f.q && f.a),
    cta: { headline: clean(c.cta && c.cta.headline, 90) || "Ready when you are.", sub: clean(c.cta && c.cta.sub, 200) || "Tell us what you need and we'll get back to you fast.", button: clean(c.cta && c.cta.button, 28) || "Get in touch" },
    marquee: list(c.marquee, 10).map((m) => clean(m, 40)).filter(Boolean),
    seo: { title: clean(c.seo && c.seo.title, 70), description: clean(c.seo && c.seo.description, 160) },
  };
}

// Real reviews only, typed in by hand.
const realReviews = (cl) => (((cl && cl.website && cl.website.reviews) || []).slice(0, 12)
  .map((r) => ({ name: clean(r && r.name, 50), text: clean(r && r.text, 600), stars: Math.max(1, Math.min(5, Math.round(Number(r && r.stars) || 5))) }))
  .filter((r) => r.name && r.text));

// Photos: the client's own first, then the background images picked for the site.
function photosFor(cl) {
  const own = ((cl && cl.mediaLibrary) || []).filter((m) => m && m.category === "photo" && httpsUrl(m.url)).map((m) => ({ url: httpsUrl(m.url), alt: clean(m.label || "", 80), own: true }));
  const stock = (((cl && cl.website && cl.website.stock) || [])).filter((s) => s && httpsUrl(s.url)).map((s) => ({ url: httpsUrl(s.url), alt: clean(s.alt || "", 80), own: false }));
  return own.concat(stock);
}
const logoOf = (cl) => { const m = ((cl && cl.mediaLibrary) || []).find((x) => x && x.category === "logo" && httpsUrl(x.url)); return m ? httpsUrl(m.url) : ""; };

// ── Palettes ──────────────────────────────────────────────────────────────────────────────
function palette(theme, cl) {
  const w = (cl && cl.website) || {};
  const brand = hexOk(w.brandColor) ? w.brandColor : hexOk(cl && cl.landingPage && cl.landingPage.brandColor) ? cl.landingPage.brandColor : null;
  if (theme === "cinematic") {
    const a = brand || "#2F6FED";
    return { bg: "#F3F1EC", bg2: "#FFFFFF", ink: "#16130F", mute: "#6C655C", line: "rgba(22,19,15,.10)", accent: a, onAccent: onColor(a), card: "rgba(255,255,255,.72)",
      gl: [mix("#F3F1EC", a, 0.18), mix("#FFFFFF", a, 0.45), mix("#D9E6F7", a, 0.25)] };
  }
  if (theme === "editorial") {
    const a = brand || "#8A5A2B";
    return { bg: "#F6F1E8", bg2: "#FFFDF9", ink: "#1E1A15", mute: "#73695D", line: "rgba(30,26,21,.12)", accent: a, onAccent: onColor(a), card: "#FFFDF9", gl: null };
  }
  const a = brand || "#3DDC97";
  return { bg: "#05080A", bg2: "#0B1114", ink: "#F2F5F4", mute: "#93A19C", line: "rgba(255,255,255,.09)", accent: a, onAccent: onColor(a), card: "rgba(255,255,255,.04)",
    gl: [mix("#05080A", a, 0.10), mix("#0B3A34", a, 0.55), mix("#05080A", a, 0.85)] };
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────────
const FONTS = {
  cinematic: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap",
  aurora: "https://fonts.googleapis.com/css2?family=Inter:wght@400..900&family=JetBrains+Mono:wght@400;500&display=swap",
  editorial: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@400..700&display=swap",
};

function css(theme, P) {
  const display = theme === "cinematic" ? "'Archivo',system-ui,sans-serif" : theme === "editorial" ? "'Fraunces',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const body = theme === "cinematic" ? "'Archivo',system-ui,sans-serif" : "'Inter',system-ui,sans-serif";
  const r = theme === "editorial" ? "4px" : theme === "cinematic" ? "28px" : "18px";
  return `
:root{--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mute:${P.mute};--line:${P.line};--ac:${P.accent};--on:${P.onAccent};--card:${P.card};--r:${r};--ease:cubic-bezier(.2,.7,.1,1)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:${body};font-size:17px;line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
.wrap{width:min(1240px,100% - 40px);margin:0 auto}
.disp{font-family:${display};${theme === "cinematic" ? "font-stretch:125%;font-weight:600;letter-spacing:-.035em;" : theme === "editorial" ? "font-weight:400;letter-spacing:-.02em;font-variation-settings:'opsz' 144;" : "font-weight:800;letter-spacing:-.04em;"}line-height:.98}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
${theme === "aurora" ? ".eyebrow{border:1px solid var(--line);border-radius:999px;padding:7px 14px;color:var(--ink);background:rgba(255,255,255,.03)}" : ""}
.eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 12px var(--ac)}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:999px;background:var(--ac);color:var(--on);font-weight:700;font-size:15px;border:0;cursor:pointer;transition:transform .35s var(--ease),box-shadow .35s var(--ease);will-change:transform}
.btn:hover{box-shadow:0 14px 40px -14px var(--ac)}
.btn .arr{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.12);transition:transform .35s var(--ease)}
.btn:hover .arr{transform:translateX(3px) rotate(-45deg)}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
${theme === "editorial" ? ".btn{border-radius:2px;letter-spacing:.04em}" : ""}
/* header */
.hd{position:fixed;inset:0 0 auto;z-index:50;transition:transform .5s var(--ease),background .4s,backdrop-filter .4s}
.hd .wrap{display:flex;align-items:center;gap:22px;height:76px}
.hd.solid{background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3);border-bottom:1px solid var(--line)}
.hd.hide{transform:translateY(-100%)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:-.01em;margin-right:auto}
.brand img{height:34px;width:auto;border-radius:6px}
.nav{display:flex;gap:26px;font-size:14.5px;font-weight:500}
.nav a{position:relative;color:var(--mute);transition:color .25s}
.nav a:hover,.nav a[aria-current]{color:var(--ink)}
.nav a::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:1.5px;background:var(--ac);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease)}
.nav a:hover::after,.nav a[aria-current]::after{transform:scaleX(1)}
.hd .btn{min-height:42px;padding:0 18px;font-size:14px}
.burger{display:none;width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.burger span{display:block;width:18px;height:1.5px;background:currentColor;margin:4px auto;transition:transform .3s}
.mnav{position:fixed;inset:0;z-index:60;background:var(--bg);padding:100px 24px 40px;display:flex;flex-direction:column;gap:6px;opacity:0;pointer-events:none;transition:opacity .35s}
.mnav.open{opacity:1;pointer-events:auto}
.mnav a{font-size:34px;padding:8px 0;border-bottom:1px solid var(--line)}
.mnav .close{position:absolute;top:18px;right:20px}
@media(max-width:880px){.nav,.hd .btn{display:none}.burger{display:block}}
/* hero */
.hero{position:relative;min-height:100svh;display:flex;align-items:flex-end;overflow:hidden;isolation:isolate}
.hero .fx{position:absolute;inset:0;z-index:-1}
.hero canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.6s var(--ease)}
.hero canvas.on{opacity:1}
.hero .copy{padding:140px 0 72px;margin-inline:auto}
.hero h1{font-size:clamp(46px,9vw,148px)}
.hero p.sub{max-width:520px;margin-top:22px;font-size:clamp(16px,1.6vw,19px);color:var(--mute)}
.hero .acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.page-hero{min-height:62svh}
.page-hero h1{font-size:clamp(40px,7vw,104px)}
/* sections */
section{position:relative}
.sec{padding:clamp(80px,11vw,150px) 0}
.sec-h{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:clamp(36px,5vw,64px)}
.sec-h h2{font-size:clamp(34px,5.4vw,76px);max-width:900px}
.sec-h p{max-width:420px;color:var(--mute)}
.grid{display:grid;gap:18px}
.g3{grid-template-columns:repeat(3,1fr)}.g2{grid-template-columns:repeat(2,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:980px){.g3,.g4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.g3,.g2,.g4{grid-template-columns:1fr}}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:30px;transition:transform .5s var(--ease),border-color .4s;transform-style:preserve-3d}
.card:hover{border-color:color-mix(in srgb,var(--ac) 45%,var(--line))}
.card h3{font-size:22px;line-height:1.2;margin-bottom:10px;letter-spacing:-.01em}
.card p{color:var(--mute);font-size:15.5px}
.num{font-family:${theme === "aurora" ? "'JetBrains Mono',ui-monospace,monospace" : display};font-size:${theme === "aurora" ? "13px" : "15px"};color:var(--ac);margin-bottom:22px;display:block}
.glow{position:absolute;inset:auto;pointer-events:none;width:420px;height:420px;border-radius:50%;filter:blur(90px);opacity:.28;background:var(--ac)}
/* marquee */
.marq{border-block:1px solid var(--line);overflow:hidden;padding:22px 0;white-space:nowrap}
.marq .tr{display:inline-flex;gap:56px;animation:mq 38s linear infinite;padding-left:56px}
.marq span{font-size:clamp(22px,3vw,40px);font-weight:600;color:var(--mute)}
.marq span b{color:var(--ac);font-weight:inherit;margin-right:56px}
@keyframes mq{to{transform:translateX(-50%)}}
/* story fill */
.fill{font-size:clamp(28px,4.2vw,58px);line-height:1.18;font-weight:${theme === "editorial" ? 400 : 600};letter-spacing:-.025em}
.fill .w{opacity:.16;transition:opacity .3s}
.fill .w.lit{opacity:1}
/* photos */
.ph{position:relative;overflow:hidden;border-radius:var(--r);background:color-mix(in srgb,var(--ink) 8%,var(--bg))}
.ph img{width:100%;height:100%;object-fit:cover;transform:scale(1.08);transition:transform 1.4s var(--ease)}
.ph.in img{transform:scale(1)}
.split{display:grid;grid-template-columns:1.05fr 1fr;gap:clamp(28px,5vw,80px);align-items:center}
@media(max-width:880px){.split{grid-template-columns:1fr}}
/* services list */
.svc{display:grid;grid-template-columns:90px 1fr 1.2fr;gap:28px;padding:34px 0;border-top:1px solid var(--line);align-items:start}
.svc:last-child{border-bottom:1px solid var(--line)}
.svc h3{font-size:clamp(24px,2.6vw,36px);line-height:1.1}
.svc p{color:var(--mute)}
@media(max-width:760px){.svc{grid-template-columns:1fr;gap:10px}}
/* steps */
.steps{counter-reset:s}
.step{padding:28px 0;border-top:1px solid var(--line);display:grid;grid-template-columns:120px 1fr;gap:20px}
.step h3{font-size:22px}
.step p{color:var(--mute)}
@media(max-width:640px){.step{grid-template-columns:1fr}}
/* faq */
details.faq{border-top:1px solid var(--line);padding:22px 0}
details.faq:last-child{border-bottom:1px solid var(--line)}
details.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;font-size:19px;font-weight:600}
details.faq summary::-webkit-details-marker{display:none}
details.faq summary i{flex-shrink:0;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-style:normal;transition:transform .35s var(--ease)}
details.faq[open] summary i{transform:rotate(45deg);background:var(--ac);color:var(--on);border-color:var(--ac)}
details.faq p{color:var(--mute);margin-top:12px;max-width:780px}
/* cta band */
.ctab{position:relative;overflow:hidden;border-radius:calc(var(--r) * 1.4);padding:clamp(48px,8vw,110px) clamp(24px,6vw,80px);background:${theme === "aurora" ? "linear-gradient(140deg,color-mix(in srgb,var(--ac) 22%,var(--bg2)),var(--bg2))" : "var(--ink)"};color:${theme === "aurora" ? "var(--ink)" : "var(--bg)"}}
.ctab h2{font-size:clamp(36px,6vw,92px);max-width:900px}
.ctab p{opacity:.72;max-width:520px;margin:18px 0 30px}
/* reviews */
.rev{break-inside:avoid;margin-bottom:18px}
.stars{color:var(--ac);letter-spacing:3px;font-size:15px;margin-bottom:14px}
.revs{columns:3;column-gap:18px}
@media(max-width:980px){.revs{columns:2}}@media(max-width:640px){.revs{columns:1}}
/* contact */
.form{display:grid;gap:14px}
.form label{display:grid;gap:7px;font-size:13px;font-weight:600;color:var(--mute)}
.form input,.form textarea{font:inherit;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:calc(var(--r) * .5);padding:15px 16px;min-height:52px;transition:border-color .25s,box-shadow .25s}
.form input:focus,.form textarea:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 4px color-mix(in srgb,var(--ac) 18%,transparent)}
.form .err{display:none;color:#E5484D;font-size:14px}
.thanks{display:none;padding:28px;border:1px solid var(--line);border-radius:var(--r);background:var(--card)}
.info dt{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--mute);margin-top:22px}
.info dd{font-size:20px;font-weight:600}
.map{aspect-ratio:16/10;border:0;width:100%;border-radius:var(--r);filter:${theme === "aurora" ? "invert(.9) hue-rotate(180deg) saturate(.6)" : "saturate(.7)"}}
/* footer */
.ft{padding:70px 0 40px;border-top:1px solid var(--line);margin-top:40px}
.ft .wrap{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}
.ft h4{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin-bottom:14px}
.ft a,.ft p{display:block;font-size:15px;margin-bottom:8px;color:var(--ink)}
.ft .big{font-size:clamp(40px,8vw,120px);line-height:.9;margin-bottom:20px}
.ft .fine{grid-column:1/-1;font-size:13px;color:var(--mute);border-top:1px solid var(--line);padding-top:22px;margin-top:20px}
@media(max-width:760px){.ft .wrap{grid-template-columns:1fr}}
/* floating pill */
.pill{position:fixed;left:50%;bottom:18px;z-index:40;transform:translate(-50%,140%);transition:transform .6s var(--ease);display:flex;gap:6px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--bg2) 80%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);box-shadow:0 20px 50px -20px rgba(0,0,0,.45)}
.pill.show{transform:translate(-50%,0)}
.pill .btn{min-height:46px;padding:0 20px;font-size:14px}
.pill .btn.ghost{background:var(--bg2)}
/* motion: only once scripts have run, so a page with no script is never invisible */
html.js .rv{opacity:0;transform:translateY(34px);filter:blur(6px);transition:opacity 1s var(--ease),transform 1.1s var(--ease),filter 1s var(--ease)}
html.js .rv.in{opacity:1;transform:none;filter:none}
html.js .rv.d1{transition-delay:.08s}html.js .rv.d2{transition-delay:.16s}html.js .rv.d3{transition-delay:.24s}
html.js .hl .ln{display:block;overflow:hidden;padding-bottom:.06em}
html.js .hl .ln > span{display:inline-block;transform:translateY(105%);filter:blur(10px);transition:transform 1.2s var(--ease),filter 1.2s var(--ease)}
html.js .hl.in .ln > span{transform:none;filter:none}
html.js .hl.in .ln:nth-child(2) > span{transition-delay:.12s}
html.js .hl.in .ln:nth-child(3) > span{transition-delay:.24s}
html.js body{opacity:0;transition:opacity .5s}
html.js body.ready{opacity:1}
html.js body.leaving{opacity:0}
@media (prefers-reduced-motion:reduce){
  html.js .rv,html.js .hl .ln > span{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}
  .marq .tr{animation:none}.fill .w{opacity:1}.ph img{transform:none}html{scroll-behavior:auto}
}
${themeCss(theme)}
`;
}

function themeCss(theme) {
  if (theme === "cinematic") return `
.hero{align-items:stretch}
.hero .copy{display:grid;grid-template-rows:1fr auto;min-height:100svh}
.hero .lA{font-size:clamp(52px,10vw,170px);align-self:start}
.hero .lB{font-size:clamp(52px,10vw,170px);text-align:right;align-self:end}
.hero .lower{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:26px;margin-top:28px}
.hero .lower p{max-width:340px;font-size:15px;color:var(--mute)}
.hero .scroll{font-size:12px;letter-spacing:.16em;text-transform:uppercase;border-top:1px solid var(--line);padding-top:14px;min-width:240px;display:flex;justify-content:space-between}
.card{background:rgba(255,255,255,.6);backdrop-filter:blur(10px);box-shadow:0 30px 60px -40px rgba(22,19,15,.35)}
.ctab{background:linear-gradient(160deg,#1B1916,#2B2621)}
`;
  if (theme === "editorial") return `
.hero{align-items:center}
.hero .ed{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(24px,5vw,70px);align-items:end;padding:150px 0 80px}
.hero .ed .ph{aspect-ratio:4/5;border-radius:2px}
.hero h1 em{font-style:italic;color:var(--ac)}
@media(max-width:880px){.hero .ed{grid-template-columns:1fr;padding-top:120px}}
.card{box-shadow:0 1px 0 var(--line)}
.sec-h h2 em,.ctab h2 em{font-style:italic;color:var(--ac)}
.ctab{border-radius:2px}
.rule{height:1px;background:var(--line);transform-origin:left}
.fill{font-family:'Fraunces',Georgia,serif;font-variation-settings:'opsz' 144;letter-spacing:-.02em}
html.js .rule{transform:scaleX(0);transition:transform 1.4s var(--ease)}
html.js .rule.in{transform:scaleX(1)}
`;
  return `
.hero{align-items:center;text-align:center}
.hero .copy{display:flex;flex-direction:column;align-items:center}
.hero h1{max-width:1000px}
.hero p.sub{margin-inline:auto}
.hero .acts{justify-content:center}
.hero::after{content:"";position:absolute;inset:auto 0 0;height:180px;background:linear-gradient(transparent,var(--bg));z-index:-1}
.card{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.015))}
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(140deg,color-mix(in srgb,var(--ac) 50%,transparent),transparent 40%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .4s}
.card:hover::before{opacity:1}
`;
}

// ── The WebGL accent. Plain WebGL1, no library, ~2KB. Two looks from one shader:
// mode 0 is a slow liquid aurora; mode 1 adds a glass sphere that tilts toward the pointer.
const SHADER = `precision mediump float;uniform vec2 R;uniform float T;uniform vec2 M;uniform vec3 A;uniform vec3 B;uniform vec3 C;uniform float MODE;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return v;}
vec3 field(vec2 uv,float t){vec2 p=uv*2.2;float q=fb(p+vec2(t*.05,-t*.03));float r=fb(p+q*1.8+vec2(-t*.04,t*.06));vec3 c=mix(A,B,smoothstep(.15,.85,r));return mix(c,C,smoothstep(.55,.95,fb(p*1.4+r-t*.02))*.75);}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 a=vec2(R.x/R.y,1.);vec2 p=(uv-.5)*a;vec3 col=field(uv+M*.03,T);
if(MODE>.5){vec2 c=vec2(0.,.02)+M*.04;float rad=.31*min(1.,a.x*.62+.18);vec2 d=p-c;float l=length(d);
float edge=smoothstep(rad,rad-.004,l);if(l<rad){float z=sqrt(max(rad*rad-l*l,0.));vec3 nr=normalize(vec3(d,z));vec3 L=normalize(vec3(-.5+M.x*.6,.6+M.y*.4,.8));
float df=max(dot(nr,L),0.);float fr=pow(1.-nr.z,2.4);vec3 inside=field(uv+nr.xy*.22+vec2(.07,0.),T*1.3);
float sp=pow(max(dot(reflect(-L,nr),vec3(0,0,1)),0.),40.);vec3 sph=mix(inside*1.08,vec3(1.),fr*.55)+df*.06+sp*.9;col=mix(col,sph,edge);}
else{col*=1.-.18*smoothstep(rad+.12,rad,l);}}
float g=h(gl_FragCoord.xy+T)*.035;gl_FragColor=vec4(col+g-.017,1.);}`;

function glScript(P, theme) {
  if (!P.gl) return "";
  const v = (h) => hexRgb(h).map((x) => (x / 255).toFixed(3)).join(",");
  const mode = theme === "cinematic" ? 1 : 0;
  return `(function(){var c=document.querySelector('.hero canvas');if(!c)return;
var mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;var nv=navigator||{};
if(mq||(nv.connection&&nv.connection.saveData)||(nv.deviceMemory&&nv.deviceMemory<4))return;
function go(){var g=c.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'});if(!g)return;
function sh(t,s){var o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);return o;}
var pr=g.createProgram();g.attachShader(pr,sh(g.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
g.attachShader(pr,sh(g.FRAGMENT_SHADER,${JSON.stringify(SHADER)}));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))return;g.useProgram(pr);
var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);
var lp=g.getAttribLocation(pr,'p');g.enableVertexAttribArray(lp);g.vertexAttribPointer(lp,2,g.FLOAT,false,0,0);
var U=function(n){return g.getUniformLocation(pr,n);};g.uniform3f(U('A'),${v(P.gl[0])});g.uniform3f(U('B'),${v(P.gl[1])});g.uniform3f(U('C'),${v(P.gl[2])});g.uniform1f(U('MODE'),${mode});
var dpr=Math.min(window.devicePixelRatio||1,1.5),mx=0,my=0,tx=0,ty=0,vis=true,t0=performance.now();
function sz(){var w=c.clientWidth,h=c.clientHeight;c.width=Math.max(1,w*dpr*.75|0);c.height=Math.max(1,h*dpr*.75|0);g.viewport(0,0,c.width,c.height);g.uniform2f(U('R'),c.width,c.height);}
sz();addEventListener('resize',sz);addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5;ty=.5-e.clientY/innerHeight;},{passive:true});
if('IntersectionObserver' in window){new IntersectionObserver(function(es){vis=es[0].isIntersecting;}).observe(c);}
function fr(now){if(vis&&!document.hidden){mx+=(tx-mx)*.04;my+=(ty-my)*.04;g.uniform1f(U('T'),(now-t0)/1000);g.uniform2f(U('M'),mx,my);g.drawArrays(g.TRIANGLE_STRIP,0,4);}requestAnimationFrame(fr);}
requestAnimationFrame(function(n){fr(n);c.classList.add('on');});}
(window.requestIdleCallback||function(f){setTimeout(f,400);})(go);})();`;
}

// Everything that moves. Shipped verbatim to the client's domain, so: no comments.
function motionScript(cl) {
  return `(function(){var d=document,h=d.documentElement;h.classList.add('js');
var PREVIEW=String(location.href).indexOf('about:')===0;
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function ready(){d.body.classList.add('ready');}
if(d.readyState!=='loading')ready();else d.addEventListener('DOMContentLoaded',ready);
setTimeout(ready,1200);
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.12}):null;
d.querySelectorAll('.rv,.hl,.ph,.rule').forEach(function(el){if(io)io.observe(el);else el.classList.add('in');});
var fl=[].slice.call(d.querySelectorAll('.fill'));fl.forEach(function(p){p.innerHTML=p.textContent.trim().split(/\\s+/).map(function(w){return '<span class="w">'+w.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span> ';}).join('');});
function fill(){fl.forEach(function(p){var r=p.getBoundingClientRect(),ws=p.querySelectorAll('.w');var k=Math.min(1,Math.max(0,(innerHeight*.85-r.top)/(r.height+innerHeight*.35)));var n=Math.round(k*ws.length);for(var i=0;i<ws.length;i++)ws[i].classList.toggle('lit',rm||i<n);});}
fill();
var hd=d.querySelector('.hd'),pill=d.querySelector('.pill'),last=0;
function sc(){var y=scrollY;if(hd){hd.classList.toggle('solid',y>30);hd.classList.toggle('hide',y>last&&y>420);}last=y;if(pill)pill.classList.toggle('show',y>innerHeight*.6);fill();}
addEventListener('scroll',sc,{passive:true});sc();
var fine=window.matchMedia&&matchMedia('(pointer: fine)').matches;
if(fine&&!rm){d.querySelectorAll('.btn').forEach(function(b){b.addEventListener('pointermove',function(e){var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.18)+'px,'+((e.clientY-r.top-r.height/2)*.28)+'px)';});b.addEventListener('pointerleave',function(){b.style.transform='';});});
d.querySelectorAll('.card').forEach(function(c){c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform='perspective(900px) rotateX('+(-y*6)+'deg) rotateY('+(x*8)+'deg) translateZ(0)';});c.addEventListener('pointerleave',function(){c.style.transform='';});});
d.querySelectorAll('[data-par]').forEach(function(el){var k=parseFloat(el.getAttribute('data-par'))||.1;function u(){var r=el.getBoundingClientRect();el.style.transform='translateY('+((r.top+r.height/2-innerHeight/2)*-k)+'px)';}addEventListener('scroll',u,{passive:true});u();});}
var mb=d.querySelector('.burger'),mn=d.querySelector('.mnav');if(mb&&mn){mb.addEventListener('click',function(){mn.classList.add('open');});mn.querySelectorAll('.close,a').forEach(function(a){a.addEventListener('click',function(){mn.classList.remove('open');});});}
d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var pg=a.getAttribute('data-page');
if(PREVIEW){e.preventDefault();if(pg&&window.parent){try{window.parent.postMessage({blSitePage:pg},'*');}catch(x){}}return;}
if(pg&&!rm&&!e.metaKey&&!e.ctrlKey&&a.target!=='_blank'){e.preventDefault();d.body.classList.add('leaving');setTimeout(function(){location.href=a.href;},320);}});
addEventListener('pageshow',function(){d.body.classList.remove('leaving');});
${formScript(cl)}})();`;
}

function formScript(cl) {
  const token = encodeURIComponent((cl && cl.leadToken) || "");
  return `var f=d.getElementById('sf');if(f){f.addEventListener('submit',function(e){e.preventDefault();
var b=f.querySelector('button'),er=f.querySelector('.err'),ph=f.ph.value.trim(),em=f.em.value.trim();
if(!ph&&!em){er.textContent='Please add a phone number or an email so we can reach you.';er.style.display='block';return;}
er.style.display='none';b.disabled=true;b.textContent='Sending...';
var p={name:f.nm.value,phone:ph,email:em,source:'website',message:f.msg?f.msg.value:'',smsConsentTransactional:false,smsConsentMarketing:false};
try{p.page=location.href.split('#')[0];var q=new URLSearchParams(location.search);['gclid','wbraid','gbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){var v=q.get(k);if(v)p[k]=v;});}catch(x){}
function done(){f.style.display='none';d.getElementById('sthx').style.display='block';}
if(PREVIEW){done();return;}
fetch('/lead?token=${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(function(r){if(!r.ok)throw 0;done();})
.catch(function(){er.textContent='Something went wrong, please try again or call us.';er.style.display='block';b.disabled=false;b.textContent='Send';});});}`;
}

// ── Page pieces ───────────────────────────────────────────────────────────────────────────
const ARR = `<span class="arr" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>`;
const href = (base, id) => { const p = pageById(id); return `${base}/${p && p.path ? p.path + "/" : ""}`; };
const linkTo = (base, id, inner, cls = "", extra = "") => `<a href="${esc(href(base, id))}" data-page="${id}"${cls ? ` class="${cls}"` : ""}${extra}>${inner}</a>`;

function lines(text, theme) {
  // Splits a headline into up to three lines for the staggered reveal.
  const words = String(text).split(/\s+/).filter(Boolean);
  const per = Math.ceil(words.length / Math.min(3, Math.max(1, Math.ceil(words.length / 3))));
  const out = [];
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(" "));
  const inner = out.map((l) => `<span class="ln"><span>${esc(l)}</span></span>`).join("");
  return theme === "editorial" ? inner.replace(/<span>([^<]*)<\/span><\/span>$/, (m, last) => `<span><em>${last}</em></span></span>`) : inner;
}

function header(cl, base, pageId, C) {
  const logo = logoOf(cl);
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  return `<header class="hd"><div class="wrap">
${linkTo(base, "home", `${logo ? `<img src="${esc(logo)}" alt="" width="34" height="34">` : ""}<span>${esc(C.name)}</span>`, "brand")}
<nav class="nav" aria-label="Main">${SITE_PAGES.map((p) => linkTo(base, p.id, esc(p.label), "", p.id === pageId ? ' aria-current="page"' : "")).join("")}</nav>
${linkTo(base, "contact", `${esc(C.cta.button)}${ARR}`, "btn")}
<button class="burger" aria-label="Open menu"><span></span><span></span></button>
</div></header>
<div class="mnav" role="dialog" aria-label="Menu"><button class="burger close" aria-label="Close menu"><span style="transform:translateY(3px) rotate(45deg)"></span><span style="transform:translateY(-3px) rotate(-45deg)"></span></button>
${SITE_PAGES.map((p) => linkTo(base, p.id, esc(p.label))).join("")}
${phone ? `<a href="tel:${esc(digits(phone))}">${esc(phone)}</a>` : ""}</div>`;
}

function footer(cl, base, C) {
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const email = String((cl && cl.website && cl.website.publicEmail) || "").trim();
  const addr = String((cl && cl.businessAddress) || "").trim();
  return `<footer class="ft"><div class="wrap">
<div><div class="big disp">${esc(C.name)}</div>${C.area ? `<p style="color:var(--mute)">Serving ${esc(C.area)}</p>` : ""}</div>
<div><h4>Pages</h4>${SITE_PAGES.map((p) => linkTo(base, p.id, esc(p.label))).join("")}</div>
<div><h4>Contact</h4>${phone ? `<a href="tel:${esc(digits(phone))}">${esc(phone)}</a>` : ""}${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ""}${addr ? `<p>${esc(addr)}</p>` : ""}</div>
<div class="fine">&copy; ${new Date().getFullYear()} ${esc(C.name)}. All rights reserved.</div>
</div></footer>
<div class="pill">${linkTo(base, "contact", `${esc(C.cta.button)}${ARR}`, "btn")}${phone ? `<a class="btn ghost" href="tel:${esc(digits(phone))}" aria-label="Call">Call</a>` : ""}</div>`;
}

function heroHome(theme, C, base, photos) {
  const acts = `<div class="acts rv d2">${linkTo(base, "contact", `${esc(C.cta.button)}${ARR}`, "btn")}${linkTo(base, "services", "Our services", "btn ghost")}</div>`;
  if (theme === "cinematic") {
    const a = C.hero.lineA || C.hero.headline.split(/\s+/).slice(0, Math.ceil(C.hero.headline.split(/\s+/).length / 2)).join(" ");
    const b = C.hero.lineB || C.hero.headline.split(/\s+/).slice(Math.ceil(C.hero.headline.split(/\s+/).length / 2)).join(" ");
    return `<section class="hero"><div class="fx" style="background:radial-gradient(60% 60% at 50% 40%,color-mix(in srgb,var(--ac) 20%,#fff),var(--bg))"><canvas aria-hidden="true"></canvas></div>
<div class="wrap copy"><h1 class="disp lA hl"><span class="ln"><span>${esc(a)}</span></span></h1>
<div><h2 class="disp lB hl" aria-hidden="true"><span class="ln"><span>${esc(b)}</span></span></h2>
<div class="lower"><div class="rv d1"><span class="eyebrow"><i></i>${esc(C.hero.eyebrow)}</span><p style="margin-top:12px">${esc(C.hero.sub)}</p>${acts}</div>
<div class="scroll rv d3"><span>Scroll</span><span>to explore</span></div></div></div></div></section>`;
  }
  if (theme === "editorial") {
    const ph = photos[0];
    return `<section class="hero"><div class="wrap ed"><div><span class="eyebrow rv"><i></i>${esc(C.hero.eyebrow)}</span>
<h1 class="disp hl" style="margin-top:22px">${lines(C.hero.headline, theme)}</h1><p class="sub rv d1">${esc(C.hero.sub)}</p>${acts}</div>
<div class="ph rv d2" data-par=".06">${ph ? `<img src="${esc(ph.url)}" alt="${esc(ph.alt)}" fetchpriority="high">` : `<div style="width:100%;height:100%;background:linear-gradient(160deg,color-mix(in srgb,var(--ac) 30%,var(--bg)),var(--bg2))"></div>`}</div></div></section>`;
  }
  return `<section class="hero"><div class="fx" style="background:radial-gradient(50% 55% at 70% 65%,color-mix(in srgb,var(--ac) 30%,transparent),transparent),radial-gradient(40% 45% at 20% 30%,color-mix(in srgb,var(--ac) 14%,transparent),transparent),var(--bg)"><canvas aria-hidden="true"></canvas></div>
<div class="wrap copy"><span class="eyebrow rv"><i></i>${esc(C.hero.eyebrow)}</span><h1 class="disp hl" style="margin-top:26px">${lines(C.hero.headline, theme)}</h1>
<p class="sub rv d1">${esc(C.hero.sub)}</p>${acts}</div></section>`;
}

function pageHero(theme, title, sub, eyebrow) {
  const fx = theme === "editorial" ? "" : `<div class="fx" style="background:radial-gradient(50% 60% at 75% 80%,color-mix(in srgb,var(--ac) ${theme === "aurora" ? 26 : 16}%,transparent),transparent),var(--bg)"><canvas aria-hidden="true"></canvas></div>`;
  return `<section class="hero page-hero">${fx}<div class="wrap copy"><span class="eyebrow rv"><i></i>${esc(eyebrow)}</span>
<h1 class="disp hl" style="margin-top:22px">${lines(title, theme)}</h1>${sub ? `<p class="sub rv d1">${esc(sub)}</p>` : ""}</div></section>`;
}

const marquee = (C) => {
  const items = (C.marquee.length ? C.marquee : C.services.map((s) => s.name)).slice(0, 8);
  if (!items.length) return "";
  const row = items.map((t) => `<span><b>&#10022;</b>${esc(t)}</span>`).join("");
  return `<div class="marq" aria-hidden="true"><div class="tr">${row}${row}</div></div>`;
};

const svcCards = (C, base, n) => `<div class="grid ${n === 4 ? "g4" : "g3"}">${C.services.slice(0, n).map((s, i) =>
  `<a class="card rv d${i % 3}" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services"><span class="num">[${String(i + 1).padStart(2, "0")}]</span><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p></a>`).join("")}</div>`;

const ctaBand = (C, base) => `<section class="sec"><div class="wrap"><div class="ctab rv"><span class="glow" style="right:-120px;top:-160px"></span>
<h2 class="disp">${esc(C.cta.headline)}</h2><p>${esc(C.cta.sub)}</p>${linkTo(base, "contact", `${esc(C.cta.button)}${ARR}`, "btn")}</div></div></section>`;

function photoBlock(ph, ratio = "4/3") {
  if (!ph) return `<div class="ph rv" style="aspect-ratio:${ratio};background:radial-gradient(70% 70% at 30% 30%,color-mix(in srgb,var(--ac) 35%,transparent),transparent),var(--bg2)"></div>`;
  return `<div class="ph rv" style="aspect-ratio:${ratio}"><img src="${esc(ph.url)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async"></div>`;
}

function homeBody(theme, cl, C, base, photos) {
  const story = (C.about.story[0] || C.hero.sub);
  const why = C.why.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="disp rv">Why people choose ${esc(C.name)}</h2></div>
<div class="grid ${C.why.length === 4 ? "g4" : C.why.length === 2 ? "g2" : "g3"}">${C.why.map((w, i) => `<div class="card rv d${i % 3}"><span class="num">${String(i + 1).padStart(2, "0")}</span><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div></div></section>` : "";
  const steps = C.process.length ? `<section class="sec"><div class="wrap split"><div><span class="eyebrow rv"><i></i>How it works</span><h2 class="disp rv" style="font-size:clamp(34px,5vw,68px);margin-top:18px">Simple from the first call.</h2></div>
<div class="steps">${C.process.map((s, i) => `<div class="step rv"><span class="num">Step ${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></div>`).join("")}</div></div></section>` : "";
  const faq = C.faqs.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="disp rv">Questions, answered</h2></div>
${C.faqs.slice(0, 5).map((f) => `<details class="faq rv"><summary>${esc(f.q)}<i aria-hidden="true">+</i></summary><p>${esc(f.a)}</p></details>`).join("")}</div></section>` : "";
  return `${heroHome(theme, C, base, photos)}
${marquee(C)}
<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="disp rv">What we do</h2><p class="rv d1">${esc(C.services.length > 1 ? `${C.services.length} ways we can help.` : "Here's how we can help.")}</p></div>${svcCards(C, base, Math.min(C.services.length, C.services.length >= 4 ? 4 : 3))}</div></section>
<section class="sec"><div class="wrap split"><p class="fill">${esc(story)}</p>${photoBlock(photos[theme === "editorial" ? 1 : 0], "4/5")}</div></section>
${why}${steps}${faq}${reviewsTeaser(cl, C, base)}${ctaBand(C, base)}`;
}

function reviewsTeaser(cl, C, base) {
  const revs = realReviews(cl);
  if (!revs.length) return "";
  const r = revs[0];
  return `<section class="sec"><div class="wrap" style="max-width:980px;text-align:center"><div class="stars rv">${"&#9733;".repeat(r.stars)}</div>
<p class="disp rv" style="font-size:clamp(26px,3.6vw,46px);line-height:1.2">"${esc(r.text)}"</p><p class="rv d1" style="margin-top:20px;color:var(--mute)">${esc(r.name)}</p>
<div class="rv d2" style="margin-top:26px">${linkTo(base, "reviews", `More reviews${ARR}`, "btn ghost")}</div></div></section>`;
}

function servicesBody(theme, C, base, photos) {
  return `${pageHero(theme, "Our services", C.hero.sub, C.niche || "Services")}
<section class="sec"><div class="wrap">${C.services.map((s, i) => `<div class="svc rv" id="s${i + 1}"><span class="num">[${String(i + 1).padStart(2, "0")}]</span><h3 class="disp">${esc(s.name)}</h3><div><p>${esc(s.detail || s.blurb)}</p></div></div>`).join("")}</div></section>
${photos.length > 1 ? `<section class="sec" style="padding-top:0"><div class="wrap grid g3">${photos.slice(0, 3).map((p) => photoBlock(p, "3/4")).join("")}</div></section>` : ""}
${ctaBand(C, base)}`;
}

function aboutBody(theme, C, base, photos) {
  const [first, ...rest] = C.about.story.length ? C.about.story : [C.hero.sub];
  return `${pageHero(theme, C.about.headline, "", "About us")}
<section class="sec"><div class="wrap"><p class="fill">${esc(first)}</p></div></section>
${rest.length || photos.length ? `<section class="sec" style="padding-top:0"><div class="wrap split">${photoBlock(photos[0], "5/4")}<div>${rest.map((p) => `<p class="rv" style="font-size:19px;margin-bottom:18px">${esc(p)}</p>`).join("")}${C.area ? `<p class="rv" style="color:var(--mute)">Proudly serving ${esc(C.area)}.</p>` : ""}</div></div></section>` : ""}
${C.why.length ? `<section class="sec"><div class="wrap grid ${C.why.length === 4 ? "g4" : "g3"}">${C.why.map((w, i) => `<div class="card rv d${i % 3}"><span class="num">${String(i + 1).padStart(2, "0")}</span><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div></section>` : ""}
${ctaBand(C, base)}`;
}

function reviewsBody(theme, cl, C, base) {
  const revs = realReviews(cl);
  const listing = httpsUrl(cl && cl.website && cl.website.googleListingUrl);
  const write = httpsUrl(cl && cl.googleReviewUrl);
  const buttons = `${listing ? `<a class="btn" href="${esc(listing)}" target="_blank" rel="noopener">Read our Google reviews${ARR}</a>` : ""}${write ? `<a class="btn ghost" href="${esc(write)}" target="_blank" rel="noopener">Leave a review</a>` : ""}`;
  return `${pageHero(theme, "What our customers say", revs.length ? "" : "We'd love to hear about your experience.", "Reviews")}
<section class="sec"><div class="wrap">${revs.length ? `<div class="revs">${revs.map((r, i) => `<figure class="card rev rv d${i % 3}"><div class="stars">${"&#9733;".repeat(r.stars)}</div><blockquote style="font-size:17px">${esc(r.text)}</blockquote><figcaption style="margin-top:16px;color:var(--mute);font-size:14px">${esc(r.name)}</figcaption></figure>`).join("")}</div>` : ""}
${buttons ? `<div class="rv" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:${revs.length ? 40 : 0}px">${buttons}</div>` : ""}</div></section>
${ctaBand(C, base)}`;
}

function contactBody(theme, cl, C, base) {
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const email = String((cl && cl.website && cl.website.publicEmail) || "").trim();
  const addr = String((cl && cl.businessAddress) || "").trim();
  const hours = clean(cl && cl.website && cl.website.hours, 160);
  const map = addr ? `<iframe class="map rv" loading="lazy" title="Map" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(addr)}&amp;output=embed"></iframe>` : "";
  return `${pageHero(theme, C.cta.headline, C.cta.sub, "Contact")}
<section class="sec" style="padding-top:20px"><div class="wrap split" style="align-items:start">
<div class="rv"><form id="sf" class="form" novalidate>
<label>Your name<input name="nm" autocomplete="name" required></label>
<label>Phone<input name="ph" type="tel" autocomplete="tel" inputmode="tel"></label>
<label>Email<input name="em" type="email" autocomplete="email"></label>
${isHealth(cl) ? "" : `<label>How can we help?<textarea name="msg" rows="4"></textarea></label>`}
<p class="err" role="alert"></p><button class="btn" type="submit">Send</button></form>
<div class="thanks" id="sthx"><h3 class="disp" style="font-size:30px">Thanks, we got it.</h3><p style="color:var(--mute);margin-top:8px">We'll be in touch shortly.</p></div></div>
<div><dl class="info rv d1">${phone ? `<dt>Call</dt><dd><a href="tel:${esc(digits(phone))}">${esc(phone)}</a></dd>` : ""}${email ? `<dt>Email</dt><dd><a href="mailto:${esc(email)}">${esc(email)}</a></dd>` : ""}${addr ? `<dt>Visit</dt><dd>${esc(addr)}</dd>` : ""}${hours ? `<dt>Hours</dt><dd>${esc(hours)}</dd>` : ""}${C.area ? `<dt>Service area</dt><dd>${esc(C.area)}</dd>` : ""}</dl>
${map ? `<div style="margin-top:30px">${map}</div>` : ""}</div></div></section>`;
}

// Structured data so Google understands who the business is.
function jsonLd(cl, C, base) {
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const o = { "@context": "https://schema.org", "@type": "LocalBusiness", name: C.name, url: `${base}/` };
  if (phone) o.telephone = phone;
  if (cl && cl.businessAddress) o.address = String(cl.businessAddress);
  if (C.area) o.areaServed = C.area;
  return JSON.stringify(o).replace(/</g, "\\u003c");
}

// ── The page ──────────────────────────────────────────────────────────────────────────────
// opts.base: absolute origin + path of the site root, no trailing slash. Required.
export function renderSite(cl, pageId = "home", opts = {}) {
  const theme = themeOf(cl, opts.theme);
  const page = pageById(pageId) ? pageId : "home";
  const base = String(opts.base || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) throw new Error("renderSite needs an absolute https base");
  const P = palette(theme, cl);
  const C = siteContent(cl);
  const photos = photosFor(cl);
  const body = page === "services" ? servicesBody(theme, C, base, photos)
    : page === "about" ? aboutBody(theme, C, base, photos)
    : page === "reviews" ? reviewsBody(theme, cl, C, base)
    : page === "contact" ? contactBody(theme, cl, C, base)
    : homeBody(theme, cl, C, base, photos);
  const label = pageById(page).label;
  const title = page === "home" ? (C.seo.title || `${C.name}${C.niche ? " | " + C.niche : ""}`) : `${label} | ${C.name}`;
  const desc = C.seo.description || C.hero.sub;
  const canonical = href(base, page);
  const ogImg = photos[0] ? `<meta property="og:image" content="${esc(photos[0].url)}">` : "";
  const hasGl = !!P.gl && /<canvas/.test(body);
  const out = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}">${ogImg}
<meta name="theme-color" content="${P.bg}">${opts.noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS[theme]}">
<style>${css(theme, P)}</style><script type="application/ld+json">${jsonLd(cl, C, base)}</script></head>
<body data-theme="${theme}" data-page="${page}">
${header(cl, base, page, C)}
<main>${body}</main>
${footer(cl, base, C)}
<script>${motionScript(cl)}</script>${hasGl ? `<script>${glScript(P, theme)}</script>` : ""}
</body></html>`;
  // A preview link has to stay a preview link as you click around, or Services lands on "coming soon".
  const q = String(opts.query || "");
  if (!q) return out;
  const reBase = new RegExp(`href="${esc(base).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^"#]*)`, "g");
  return out.replace(reBase, (m) => m + esc(q));
}

// What the OS needs to tell whether a site is ready to show the client.
export const siteReady = (cl) => !!(cl && cl.website && cl.website.content && cl.website.content.hero && cl.website.content.hero.headline);
