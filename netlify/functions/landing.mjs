import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const notFoundPage = () => html(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#F9FAFB;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:20px;margin-bottom:8px}p{font-size:14px;color:#6B7280;line-height:1.6}</style></head><body><div><h1>Page not found</h1><p>This link may have expired or is no longer active.</p></div></body></html>`,
  404,
);

const comingSoonPage = (name) => html(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#F9FAFB;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:20px;margin-bottom:8px}p{font-size:14px;color:#6B7280;line-height:1.6}</style></head><body><div><h1>${esc(name)}</h1><p>This page is being finished up. Check back shortly.</p></div></body></html>`,
);

// Colour theme from the CLIENT's OWN branding — accent + light/dark. Never BoldLine's.
export function landingTheme(cl) {
  const lp = (cl && cl.landingPage) || {};
  const raw = lp.brandColor || (cl && cl.brandColor) || "";
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(raw).trim());
  const brand = m ? `#${m[1].toLowerCase()}` : "#4f6bed";
  const n = parseInt(brand.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onBrand = lum > 0.62 ? "#15110A" : "#ffffff";
  const tint = `rgba(${r},${g},${b},.16)`;
  const deep = `#${[r, g, b].map((v) => Math.round(v * 0.22).toString(16).padStart(2, "0")).join("")}`;
  const bright = `#${[r, g, b].map((v) => Math.min(255, Math.round(v + (255 - v) * 0.22)).toString(16).padStart(2, "0")).join("")}`;
  const dark = String(lp.theme || "").toLowerCase() === "dark";
  const base = dark
    ? { mode: "dark", bg: "#0C0D11", text: "#E7E9EE", headline: "#F8F9FB", muted: "#A6ABB5", surface: "#15171D", border: "#262A32", line: "#20242C", chipText: "#CBD0D9", formBg: "#0A0B0F", cardBg: "#15171D", cardBorder: "#282C35", inBg: "#0E1014", inBorder: "#2A2E37", inText: "#F4F5F7", ph: "#7A818C", topName: "#F5F6F8", foot: "#8A909B", headBg: "rgba(12,13,17,.82)", grid: "rgba(255,255,255,.05)" }
    : { mode: "light", bg: "#ffffff", text: "#1F2937", headline: "#0F172A", muted: "#5B6472", surface: "#F8F9FB", border: "#E9ECF1", line: "#EEF0F4", chipText: "#374151", formBg: "#F5F7FA", cardBg: "#ffffff", cardBorder: "#E9ECF1", inBg: "#ffffff", inBorder: "#E2E6EC", inText: "#111827", ph: "#9CA3AF", topName: "#0F172A", foot: "#6B7280", headBg: "rgba(255,255,255,.82)", grid: "rgba(15,23,42,.05)" };
  return { ...base, r, g, b, brand, onBrand, tint, band: deep, bright, glowA: `rgba(${r},${g},${b},.26)`, glowB: `rgba(${r},${g},${b},.12)`, bandGrad: `linear-gradient(135deg, ${bright}, ${brand} 55%, ${deep})` };
}

// Per-client DESIGN VARIANT — so no two landing pages share the same layout, type,
// motion, or structure. The AI picks tokens that fit the business (landingPage.design);
// when absent, a deterministic per-client seed still yields a distinct combination, so
// even ungenerated/old pages differ from each other. Ideas are reused; pages are not clones.
const FNV = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function designConfig(cl) {
  const d = (cl.landingPage && cl.landingPage.design) || {};
  const seed = FNV(String(cl.landingSlug || cl.name || "boldline"));
  const opt = (key, arr, shift) => (d[key] && arr.includes(d[key]) ? d[key] : arr[(seed >>> shift) % arr.length]);
  return {
    layout: opt("layout", ["split", "centered", "overlay"], 0),
    bg: opt("background", ["glowgrid", "mesh", "dots", "clean"], 3),
    motion: opt("motion", ["up", "side", "zoom"], 6),
    benefits: opt("benefits", ["cards", "list", "numbered"], 9),
    font: opt("font", ["modern", "elegant", "bold"], 12),
    shape: opt("shape", ["rounded", "soft", "sharp"], 15),
    order: opt("order", ["a", "b"], 19),
  };
}

export function renderLandingPage(cl) {
  const lp = cl.landingPage || {};
  const cs = cl.campaignSetup || {};
  const bv = cl.brandVoice || {};
  const media = cl.mediaLibrary || [];
  const P = landingTheme(cl);
  const D = designConfig(cl);

  const hero = (lp.heroPath && media.find((m) => m.path === lp.heroPath)) || media.find((m) => m.category === "photo") || media.find((m) => m.category === "logo");
  const bullets = Array.isArray(lp.bullets) ? lp.bullets : [];
  const phone = cl.callTrackingNumber || "";
  const area = cs.serviceArea || cs.targetLocations || "";
  const offer = cs.mainOffer || "";
  const differentiator = bv.differentiator || "";
  const cta = lp.ctaText || "Get My Free Quote";
  const photos = media.filter((m) => m.category === "photo" && m.url && (!hero || m.path !== hero.path)).slice(0, 6);
  const steps = (Array.isArray(lp.steps) && lp.steps.length ? lp.steps : ["Tell us what you need", "Get a fast, free quote", "We handle the rest"]).slice(0, 3);
  const booking = String(cl.bookingUrl || "").trim();
  const ctaHref = booking ? esc(booking) : "#lead-form";
  const ctaAttr = booking ? ' target="_blank" rel="noopener"' : "";
  const telHref = phone ? `tel:${esc(phone.replace(/[^0-9+]/g, ""))}` : "";
  const useOverlay = D.layout === "overlay" && !!hero;
  const useCentered = D.layout === "centered";

  const css = `
*{box-sizing:border-box;margin:0;padding:0}img{max-width:100%;display:block}
:root{--r:18px}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:${P.bg};color:${P.text};line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;--rv:translateY(20px)}
.sh-soft{--r:12px}.sh-sharp{--r:6px}
.mo-side{--rv:translateX(-24px)}.mo-zoom{--rv:scale(.94)}
a{color:inherit}
.wrap{max-width:1140px;margin:0 auto;padding:0 20px}
/* header */
.hdr{position:sticky;top:0;z-index:40;background:${P.headBg};backdrop-filter:saturate(1.2) blur(10px);-webkit-backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid ${P.line}}
.hdr .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px}
.brandmark{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15.5px;color:${P.topName}}
.dot{width:10px;height:10px;border-radius:3px;background:${P.brand};box-shadow:0 0 0 4px ${P.tint}}
.hdr-cta{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:700;color:${P.brand};text-decoration:none;border:1px solid ${P.tint};border-radius:999px;padding:7px 14px;background:${P.tint}}
.ann{background:${P.band};color:#fff;text-align:center;font-size:13px;font-weight:600;padding:9px 16px}
.ann b{font-weight:800}
/* hero base */
.hero{position:relative;overflow:hidden;padding:44px 0 40px}
.hero .wrap{position:relative;z-index:2}
.hero-g{display:grid;gap:30px;align-items:center}
.hero-c{max-width:760px;margin:0 auto;text-align:center}
.hero-c .ctarow,.hero-c .trust{justify-content:center}
.hero-c .subhead{margin-left:auto;margin-right:auto}
.heroband{margin-top:30px;border-radius:var(--r);overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.28)}
.heroband img{width:100%;max-height:460px;object-fit:cover}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${P.brand};background:${P.tint};border:1px solid ${P.tint};padding:6px 12px;border-radius:999px;margin-bottom:16px}
.headline{font-size:clamp(30px,5.4vw,50px);font-weight:850;color:${P.headline};line-height:1.08;letter-spacing:-.02em;margin-bottom:14px}
.subhead{font-size:clamp(15.5px,2vw,19px);color:${P.muted};margin-bottom:24px;max-width:54ch}
.ctarow{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.cta{position:relative;display:inline-flex;align-items:center;gap:9px;padding:15px 28px;font-size:16px;font-weight:800;border-radius:var(--r);border:none;background:${P.brand};color:${P.onBrand};cursor:pointer;text-decoration:none;box-shadow:0 10px 26px ${P.glowB};transition:transform .18s ease,box-shadow .18s ease}
.cta:hover{transform:translateY(-2px);box-shadow:0 16px 34px ${P.glowA}}
.cta.ghost{background:transparent;color:${P.text};border:1px solid ${P.border};box-shadow:none}
.cta.ghost:hover{border-color:${P.brand};color:${P.brand}}
.trust{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:20px;font-size:13px;color:${P.muted}}
.trust b{color:${P.text}}
.hero-media{position:relative}
.heroimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--r);box-shadow:0 30px 60px rgba(0,0,0,.30)}
.hero-media .badge{position:absolute;left:16px;bottom:16px;background:${P.cardBg};color:${P.text};border:1px solid ${P.cardBorder};border-radius:14px;padding:11px 14px;box-shadow:0 12px 30px rgba(0,0,0,.22);font-size:13px;font-weight:700;display:flex;align-items:center;gap:9px}
.badge .bdot{width:26px;height:26px;border-radius:8px;background:${P.tint};color:${P.brand};display:flex;align-items:center;justify-content:center;font-size:15px}
/* hero background treatments */
.hero::before,.hero::after{content:"";position:absolute;pointer-events:none}
.bg-glowgrid .hero::before{inset:-30% -10% auto -10%;height:120%;background:radial-gradient(60% 60% at 20% 20%,${P.glowA},transparent 60%),radial-gradient(50% 50% at 92% 8%,${P.glowB},transparent 55%)}
.bg-glowgrid .hero::after{inset:0;background-image:linear-gradient(${P.grid} 1px,transparent 1px),linear-gradient(90deg,${P.grid} 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(80% 70% at 50% 30%,#000,transparent 75%);mask-image:radial-gradient(80% 70% at 50% 30%,#000,transparent 75%)}
.bg-mesh .hero::before{inset:-40% -20%;height:150%;background:radial-gradient(40% 40% at 15% 25%,${P.glowA},transparent 60%),radial-gradient(35% 35% at 85% 15%,${P.glowB},transparent 60%),radial-gradient(45% 45% at 70% 90%,${P.glowB},transparent 60%)}
.bg-dots .hero::before{inset:0;background:radial-gradient(60% 60% at 80% 10%,${P.glowB},transparent 60%)}
.bg-dots .hero::after{inset:0;background-image:radial-gradient(${P.grid} 1.4px,transparent 1.4px);background-size:22px 22px;-webkit-mask-image:radial-gradient(90% 80% at 50% 25%,#000,transparent 78%);mask-image:radial-gradient(90% 80% at 50% 25%,#000,transparent 78%)}
.bg-clean .hero::before{inset:0;background:linear-gradient(180deg,${P.tint},transparent 55%)}
/* overlay hero */
.hero-ov{padding:0;min-height:520px;display:flex;align-items:flex-end;background-image:var(--heroimg);background-size:cover;background-position:center}
.hero-ov::before,.hero-ov::after{display:none}
.hero-ov .hero-ovc{position:relative;z-index:2;color:#fff;padding:0 0 8px;max-width:640px}
.hero-ov .headline{color:#fff}.hero-ov .subhead{color:rgba(255,255,255,.9)}
.hero-ov .cta.ghost{color:#fff;border-color:rgba(255,255,255,.5)}
.hero-ov .trust{color:rgba(255,255,255,.9)}.hero-ov .trust b{color:#fff}
.hero-ov-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.78));z-index:1}
.hero-ov .wrap{padding-top:70px;padding-bottom:44px}
/* chips */
.chips{display:flex;flex-wrap:wrap;gap:10px;padding:20px 0}
.chip{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:${P.chipText};background:${P.surface};border:1px solid ${P.border};border-radius:999px;padding:9px 15px}
/* sections */
.sec{padding:52px 0}
.sec.alt{background:${P.surface}}
.sec-head{max-width:640px;margin:0 auto 30px;text-align:center}
.sec-k{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${P.brand};margin-bottom:8px}
.sec-t{font-size:clamp(23px,3.2vw,32px);font-weight:850;letter-spacing:-.01em;color:${P.headline}}
/* benefits: cards */
.bene{display:grid;gap:14px;grid-template-columns:1fr}
.bcard{background:${P.cardBg};border:1px solid ${P.border};border-radius:var(--r);padding:22px 20px;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.bcard:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(0,0,0,.14);border-color:${P.tint}}
.bico{width:44px;height:44px;border-radius:12px;background:${P.tint};color:${P.brand};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;margin-bottom:14px}
.bcard h3,.brow h3,.bnum h3{font-size:16px;font-weight:750;color:${P.headline};margin-bottom:5px}
.bcard p,.brow p,.bnum p{font-size:13.5px;color:${P.muted}}
/* benefits: list */
.belist{max-width:760px;margin:0 auto;display:grid;gap:2px}
.brow{display:flex;gap:16px;align-items:flex-start;padding:18px 6px;border-bottom:1px solid ${P.line}}
.brow .bico{margin-bottom:0;flex-shrink:0}
/* benefits: numbered */
.benum{display:grid;gap:22px;grid-template-columns:1fr}
.bnum{display:flex;gap:16px;align-items:flex-start}
.bnum .bn{font-size:34px;font-weight:900;line-height:1;color:${P.brand};opacity:.5;flex-shrink:0;width:46px}
/* steps */
.steps{display:grid;gap:16px;grid-template-columns:1fr}
.step{position:relative;background:${P.cardBg};border:1px solid ${P.border};border-radius:var(--r);padding:22px 20px 20px}
.step .num{width:34px;height:34px;border-radius:10px;background:${P.brand};color:${P.onBrand};font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.step h3{font-size:15.5px;font-weight:750;color:${P.headline}}
/* gallery */
.gal{display:grid;gap:12px;grid-template-columns:1fr 1fr}
.gitem{overflow:hidden;border-radius:var(--r)}
.gitem img{aspect-ratio:4/3;object-fit:cover;width:100%;transition:transform .5s ease}
.gitem:hover img{transform:scale(1.06)}
/* offer */
.offer{position:relative;overflow:hidden;background:${P.bandGrad};border-radius:calc(var(--r) + 4px);padding:40px 26px;text-align:center;color:#fff}
.offer::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:30px 30px;-webkit-mask-image:radial-gradient(70% 100% at 50% 0,#000,transparent);mask-image:radial-gradient(70% 100% at 50% 0,#000,transparent);opacity:.6}
.offer>*{position:relative;z-index:1}
.offer .ok{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-bottom:10px}
.offer h2{font-size:clamp(22px,3vw,30px);font-weight:850;margin-bottom:20px}
.offer .cta{background:#fff;color:#111;box-shadow:0 12px 30px rgba(0,0,0,.25)}
/* form */
.formsec{background:${P.formBg};padding:56px 0 64px}
.form-g{display:grid;gap:28px;grid-template-columns:1fr;align-items:start}
.form-copy h2{font-size:clamp(22px,3vw,30px);font-weight:850;color:${P.headline};margin-bottom:12px;letter-spacing:-.01em}
.form-copy p{font-size:15px;color:${P.muted};margin-bottom:18px}
.rlist{list-style:none;display:grid;gap:12px}
.rlist li{display:flex;gap:11px;align-items:flex-start;font-size:14.5px;color:${P.text}}
.rlist .rk{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:${P.tint};color:${P.brand};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
.fcard{background:${P.cardBg};border:1px solid ${P.cardBorder};border-radius:var(--r);padding:28px 24px;box-shadow:0 20px 50px rgba(0,0,0,.12)}
.formtitle{font-size:21px;font-weight:850;margin-bottom:4px;color:${P.headline}}
.formsub{font-size:13.5px;color:${P.muted};margin-bottom:18px}
.inp{width:100%;padding:14px 15px;border:1px solid ${P.inBorder};border-radius:calc(var(--r) - 4px);font-size:15px;margin-bottom:11px;font-family:inherit;background:${P.inBg};color:${P.inText};transition:border-color .15s ease,box-shadow .15s ease}
.inp:focus{outline:none;border-color:${P.brand};box-shadow:0 0 0 3px ${P.tint}}
.inp::placeholder{color:${P.ph}}
.fine{font-size:12px;color:${P.muted};text-align:center;margin-top:10px}
.err{display:none;font-size:12.5px;color:#F87171;margin-bottom:10px;text-align:center}
.thanks{display:none;text-align:center;padding:22px 6px}
.thanks h2{font-size:20px;margin-bottom:6px;color:${P.headline}}.thanks p{font-size:14px;color:${P.muted}}
/* sticky mobile cta */
.mcta{position:fixed;left:0;right:0;bottom:0;z-index:50;display:none;gap:10px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:${P.headBg};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid ${P.line}}
.mcta a{flex:1;text-align:center;padding:13px;border-radius:12px;font-weight:800;font-size:14.5px;text-decoration:none}
.mcta .call{border:1px solid ${P.border};color:${P.text}}
.mcta .quote{background:${P.brand};color:${P.onBrand}}
.foot{padding:30px 0 34px;text-align:center;font-size:13px;color:${P.foot};border-top:1px solid ${P.line}}
.foot a{color:${P.text};font-weight:700;text-decoration:none}
/* typography moods */
.font-elegant .headline,.font-elegant .sec-t,.font-elegant .formtitle,.font-elegant .offer h2,.font-elegant .form-copy h2,.font-elegant .bcard h3,.font-elegant .bnum h3,.font-elegant .brow h3{font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:-.005em}
.font-bold .headline,.font-bold .sec-t,.font-bold .offer h2,.font-bold .form-copy h2{font-weight:900;letter-spacing:-.03em}
/* reveal / motion */
.js .reveal{opacity:0;transform:var(--rv)}
.js .reveal.in{opacity:1;transform:none;transition:opacity .6s ease,transform .6s ease}
.js .an{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
.mo-zoom .an{animation-name:zin}.mo-side .an{animation-name:slin}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes zin{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes slin{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.js .reveal{opacity:1!important;transform:none!important}}
@media(min-width:720px){.bene{grid-template-columns:repeat(3,1fr)}.benum{grid-template-columns:repeat(3,1fr)}.steps{grid-template-columns:repeat(3,1fr)}.gal{grid-template-columns:repeat(3,1fr)}}
@media(min-width:940px){.hero{padding:64px 0 56px}.hero-g.has-img{grid-template-columns:1.05fr .95fr}.form-g{grid-template-columns:.9fr 1.1fr;gap:44px}}
@media(max-width:719px){.mcta{display:flex}body{padding-bottom:76px}.hdr-cta{display:none}.hero-ov{min-height:440px}}
`;

  // ── hero (3 layouts) ──
  const eyebrowH = `<div class="eyebrow an">${esc(cl.niche || "Trusted local service")}</div>`;
  const headlineH = `<h1 class="headline an" style="animation-delay:.06s">${esc(lp.headline)}</h1>`;
  const subH = `<p class="subhead an" style="animation-delay:.12s">${esc(lp.subheadline || "")}</p>`;
  const trustBits = [area ? `<span>📍 <b>${esc(area)}</b></span>` : "", `<span>✅ <b>Free quotes</b></span>`, phone ? `<span>⚡ <b>Fast response</b></span>` : ""].filter(Boolean).join("");
  const trustH = trustBits ? `<div class="trust an" style="animation-delay:.24s">${trustBits}</div>` : "";
  const ctasH = `<div class="ctarow an" style="animation-delay:.18s"><a class="cta" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a>${phone ? `<a class="cta ghost" href="${telHref}">📞 Call now</a>` : ""}</div>`;
  const badgeH = (offer || differentiator) ? `<div class="badge"><span class="bdot">✓</span><span>${esc((differentiator || offer).slice(0, 40))}</span></div>` : "";

  let heroSection;
  if (useOverlay) {
    heroSection = `<section class="hero hero-ov" style="--heroimg:url('${esc(hero.url)}')"><div class="hero-ov-scrim"></div><div class="wrap hero-ovc">${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div></section>`;
  } else if (useCentered) {
    const band = hero ? `<div class="wrap"><div class="heroband reveal"><img src="${esc(hero.url)}" alt="${esc(cl.name)}"></div></div>` : "";
    heroSection = `<section class="hero"><div class="wrap hero-c">${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div>${band}</section>`;
  } else {
    const media_ = hero ? `<div class="hero-media reveal"><img class="heroimg" src="${esc(hero.url)}" alt="${esc(cl.name)}">${badgeH}</div>` : "";
    heroSection = `<section class="hero"><div class="wrap hero-g${hero ? " has-img" : ""}"><div>${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div>${media_}</div></section>`;
  }

  // ── benefits (3 styles) ──
  const parsed = bullets.map((b) => { const p = String(b).split(/[—–:]/); return { h: p[0].trim(), p: p.slice(1).join("—").trim() }; });
  let benefitsInner, benefitsAlt = true;
  if (D.benefits === "list") {
    benefitsInner = `<div class="belist">${parsed.map((x, i) => `<div class="brow reveal" style="transition-delay:${i * 50}ms"><div class="bico">✓</div><div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div></div>`).join("")}</div>`;
    benefitsAlt = false;
  } else if (D.benefits === "numbered") {
    benefitsInner = `<div class="benum">${parsed.map((x, i) => `<div class="bnum reveal" style="transition-delay:${i * 60}ms"><div class="bn">${String(i + 1).padStart(2, "0")}</div><div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div></div>`).join("")}</div>`;
  } else {
    benefitsInner = `<div class="bene">${parsed.map((x, i) => `<div class="bcard reveal" style="transition-delay:${i * 60}ms"><div class="bico">✓</div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div>`).join("")}</div>`;
  }
  const benefitsSection = `<section class="sec${benefitsAlt ? " alt" : ""}"><div class="wrap"><div class="sec-head"><div class="sec-k">Why us</div><h2 class="sec-t">Why choose ${esc(cl.name)}</h2></div>${benefitsInner}</div></section>`;

  const stepsSection = `<section class="sec"><div class="wrap"><div class="sec-head"><div class="sec-k">How it works</div><h2 class="sec-t">Getting started is easy</h2></div><div class="steps">${steps.map((s, i) => `<div class="step reveal" style="transition-delay:${i * 70}ms"><div class="num">${i + 1}</div><h3>${esc(s)}</h3></div>`).join("")}</div></div></section>`;

  const gallerySection = photos.length >= 2 ? `<section class="sec"><div class="wrap"><div class="sec-head"><div class="sec-k">Our work</div><h2 class="sec-t">See the results</h2></div><div class="gal">${photos.map((p) => `<div class="gitem reveal"><img src="${esc(p.url)}" alt="${esc(p.label || cl.name)}" loading="lazy"></div>`).join("")}</div></div></section>` : "";

  const offerSection = offer ? `<section class="sec"><div class="wrap"><div class="offer reveal"><div class="ok">Limited-time offer</div><h2>${esc(offer)}</h2><a class="cta" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a></div></div></section>` : "";

  const order = D.order === "b" ? [benefitsSection, gallerySection, offerSection, stepsSection] : [benefitsSection, stepsSection, gallerySection, offerSection];
  const middle = order.join("\n");

  const annHTML = offer ? `<div class="ann"><b>${esc(offer.slice(0, 90))}</b></div>` : "";
  const chips = [area ? `<div class="chip">📍 Serving ${esc(area)}</div>` : "", differentiator ? `<div class="chip">⭐ ${esc(differentiator.slice(0, 60))}</div>` : "", `<div class="chip">✅ Free quote — no obligation</div>`, phone ? `<div class="chip">⚡ Fast response</div>` : ""].filter(Boolean).join("");
  const bodyClass = `js lay-${D.layout} bg-${D.bg} mo-${D.motion} be-${D.benefits} font-${D.font} sh-${D.shape}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>document.documentElement.className+=' js'</script><title>${esc(lp.headline)} — ${esc(cl.name)}</title><meta name="description" content="${esc(lp.subheadline || "")}"><meta property="og:title" content="${esc(lp.headline)} — ${esc(cl.name)}"><meta property="og:description" content="${esc(lp.subheadline || "")}">${hero ? `<meta property="og:image" content="${esc(hero.url)}">` : ""}<style>${css}</style></head><body class="${bodyClass}">
${annHTML}
<header class="hdr"><div class="wrap"><div class="brandmark"><span class="dot"></span>${esc(cl.name)}</div>${phone ? `<a class="hdr-cta" href="${telHref}">📞 ${esc(phone)}</a>` : ""}</div></header>
${heroSection}
${chips ? `<div class="wrap"><div class="chips">${chips}</div></div>` : ""}
${middle}
<section class="formsec" id="lead-form"><div class="wrap"><div class="form-g">
  <div class="form-copy reveal">
    <h2>Ready to get started?</h2>
    <p>Fill out the form and we'll get right back to you — no pressure, no obligation.</p>
    <ul class="rlist"><li><span class="rk">1</span><span>Tell us a bit about what you need.</span></li><li><span class="rk">2</span><span>We'll reach out fast with your free quote.</span></li><li><span class="rk">3</span><span>Book your slot and we handle the rest.</span></li></ul>
  </div>
  <div class="fcard reveal">
    <div class="formtitle">${esc(cta)}</div>
    <div class="formsub">Takes 20 seconds. We'll be in touch shortly.</div>
    <form id="lf">
      <input class="inp" id="lf-name" placeholder="Your name" required>
      <input class="inp" id="lf-phone" placeholder="Phone number" required>
      <input class="inp" id="lf-email" type="email" placeholder="Email (optional)">
      <div class="err" id="lf-err">Something went wrong — please try again.</div>
      <button class="cta" type="submit" id="lf-btn" style="width:100%;justify-content:center">${esc(cta)}</button>
      <div class="fine">🔒 Your info stays private. No spam, ever.</div>
    </form>
    <div class="thanks" id="lf-thanks"><h2>Got it — thank you!</h2><p>We'll be in touch shortly.</p></div>
  </div>
</div></div></section>
<footer class="foot"><div class="wrap">${esc(cl.name)}${area ? ` · Serving ${esc(area)}` : ""}${phone ? ` · <a href="${telHref}">${esc(phone)}</a>` : ""}</div></footer>
<nav class="mcta">${phone ? `<a class="call" href="${telHref}">📞 Call</a>` : ""}<a class="quote" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a></nav>
<script>
(function(){
  var els=[].slice.call(document.querySelectorAll('.reveal'));
  function showAll(){els.forEach(function(el){el.classList.add('in');});}
  try{
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -6% 0px',threshold:.06});
    els.forEach(function(el){io.observe(el);});
    setTimeout(showAll,1500);
  }catch(e){showAll();}
  var lf=document.getElementById('lf');
  if(lf){lf.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('lf-btn'),err=document.getElementById('lf-err');
    err.style.display='none';btn.disabled=true;btn.textContent='Sending…';
    fetch('/.netlify/functions/lead-intake?token=${encodeURIComponent(cl.leadToken || "")}',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:document.getElementById('lf-name').value,phone:document.getElementById('lf-phone').value,email:document.getElementById('lf-email').value,source:'landing_page'})
    }).then(function(r){if(!r.ok)throw 0;document.getElementById('lf').style.display='none';document.getElementById('lf-thanks').style.display='block';})
    .catch(function(){err.style.display='block';btn.disabled=false;btn.textContent=${JSON.stringify(cta)};});
  });}
})();
<\/script>
</body></html>`;
}

export default async (req) => {
  // Owner-only LIVE PREVIEW — POST a client object, get the SAME rendered page back.
  if (req.method === "POST") {
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!jwt) return new Response("Not authenticated", { status: 401 });
    const supa = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: u, error: e } = await supa.auth.getUser(jwt);
    if (e || !u || !u.user) return new Response("Invalid session", { status: 401 });
    let body;
    try { body = JSON.parse((await req.text()) || "{}"); } catch { return new Response("Invalid JSON", { status: 400 }); }
    const cl = body.client || {};
    if (!(cl.landingPage && cl.landingPage.headline)) return comingSoonPage(cl.name || "Preview");
    return html(renderLandingPage(cl));
  }

  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const pathMatch = url.pathname.match(/^\/lp\/([^/]+)\/?$/);
  const slug = (pathMatch && decodeURIComponent(pathMatch[1])) || url.searchParams.get("slug");
  if (!slug) return notFoundPage();

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>landingSlug", slug).maybeSingle();
  if (error) {
    console.error("Landing page lookup failed:", error);
    return notFoundPage();
  }
  if (!data) return notFoundPage();

  const cl = data.data;
  const lp = cl.landingPage || {};
  if (!lp.published || !lp.headline) return comingSoonPage(cl.name);

  return html(renderLandingPage(cl));
};
