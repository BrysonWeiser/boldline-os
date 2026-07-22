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

// Full theme derived from the CLIENT's OWN branding — accent color AND light/dark mode,
// so a dark/premium brand gets a dark page, not a generic bright one. Never BoldLine's
// colors. Neutral slate accent + light mode as the safe default when unset.
export function landingTheme(cl) {
  const lp = (cl && cl.landingPage) || {};
  const raw = lp.brandColor || (cl && cl.brandColor) || "";
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(raw).trim());
  const brand = m ? `#${m[1].toLowerCase()}` : "#334155"; // neutral slate — never gold
  const n = parseInt(brand.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onBrand = lum > 0.62 ? "#15110A" : "#ffffff";
  const tint = `rgba(${r},${g},${b},.16)`;
  const deep = `#${[r, g, b].map((v) => Math.round(v * 0.24).toString(16).padStart(2, "0")).join("")}`;
  const dark = String(lp.theme || "").toLowerCase() === "dark";

  const base = dark
    ? { mode: "dark", bg: "#0E0F13", text: "#E7E9EE", headline: "#F7F8FA", muted: "#A9AEB8",
        heroGrad: "linear-gradient(180deg,#15161C,#0E0F13)", surface: "#16181E", border: "#24262E",
        line: "#23262E", chipText: "#C7CBD3", formBg: "#0B0C10", cardBg: "#16181E", cardBorder: "#282B34",
        inBg: "#0F1116", inBorder: "#2A2E37", inText: "#F4F5F7", ph: "#7A818C", topName: "#F4F5F7", foot: "#8A909B" }
    : { mode: "light", bg: "#ffffff", text: "#111827", headline: "#0F172A", muted: "#4B5563",
        heroGrad: "linear-gradient(180deg,#FAFAFA,#fff)", surface: "#FAFAFA", border: "#EEEEEE",
        line: "#F1F1F1", chipText: "#374151", formBg: "#F7F7F7", cardBg: "#ffffff", cardBorder: "#ECECEC",
        inBg: "#ffffff", inBorder: "#E5E7EB", inText: "#111827", ph: "#9CA3AF", topName: "#0F172A", foot: "#6B7280" };

  return { ...base, brand, onBrand, tint, band: deep };
}

// Pure renderer — shared by the live route and the OS preview intent. Assumes the
// client has a published landingPage with a headline.
export function renderLandingPage(cl) {
  const lp = cl.landingPage || {};
  const cs = cl.campaignSetup || {};
  const bv = cl.brandVoice || {};
  const media = cl.mediaLibrary || [];
  const P = landingTheme(cl);

  const hero = (lp.heroPath && media.find((m) => m.path === lp.heroPath)) || media.find((m) => m.category === "photo") || media.find((m) => m.category === "logo");
  const bullets = Array.isArray(lp.bullets) ? lp.bullets : [];
  const phone = cl.callTrackingNumber || "";
  const area = cs.serviceArea || cs.targetLocations || "";
  const offer = cs.mainOffer || "";
  const differentiator = bv.differentiator || "";
  const cta = lp.ctaText || "Get My Free Quote";
  const photos = media.filter((m) => m.category === "photo" && m.url && (!hero || m.path !== hero.path)).slice(0, 6);

  const css = `*{box-sizing:border-box;margin:0;padding:0}img{max-width:100%;display:block}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:${P.bg};color:${P.text};line-height:1.55}.wrap{max-width:1140px;margin:0 auto;padding:0 20px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0}.tb-name{font-weight:800;font-size:15px;color:${P.topName}}.tb-call{font-size:14px;font-weight:700;color:${P.text};text-decoration:none;white-space:nowrap}.hero{padding:26px 0 32px;background:${P.heroGrad}}.hero-g{display:grid;gap:28px;align-items:center}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${P.brand};margin-bottom:10px}.headline{font-size:clamp(28px,5vw,44px);font-weight:800;color:${P.headline};line-height:1.15;margin-bottom:12px}.subhead{font-size:clamp(15px,2vw,18px);color:${P.muted};margin-bottom:20px;max-width:56ch}.cta{display:inline-block;padding:15px 26px;font-size:16px;font-weight:800;border-radius:12px;border:none;background:${P.brand};color:${P.onBrand};cursor:pointer;text-align:center;text-decoration:none}.ctarow{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.callrow{font-size:14px;color:${P.muted}}.callrow a{color:${P.text};font-weight:800;text-decoration:none}.heroimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.28)}.chips{display:flex;flex-wrap:wrap;gap:10px;padding:18px 0;border-top:1px solid ${P.line};border-bottom:1px solid ${P.line}}.chip{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:${P.chipText};background:${P.surface};border:1px solid ${P.border};border-radius:999px;padding:8px 14px}.sec{padding:38px 0}.sec.tight{padding-top:0}.sec-t{font-size:clamp(20px,3vw,28px);font-weight:800;color:${P.headline};margin-bottom:18px}.bene{display:grid;gap:12px;grid-template-columns:1fr}.bcard{display:flex;gap:12px;align-items:flex-start;background:${P.surface};border:1px solid ${P.border};border-radius:14px;padding:16px}.bcard span{font-size:15px;color:${P.text};font-weight:600}.check{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:${P.tint};color:${P.brand};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}.gal{display:grid;gap:10px;grid-template-columns:1fr 1fr}.gal img{aspect-ratio:4/3;object-fit:cover;border-radius:12px;width:100%}.offer{background:${P.band};border:1px solid ${P.tint};border-radius:20px;padding:30px 24px;text-align:center;color:#fff}.offer .eyebrow{color:${P.onBrand === "#ffffff" ? "#fff" : P.brand};opacity:.92;margin-bottom:8px}.offer-t{font-size:clamp(19px,2.6vw,26px);font-weight:800;margin-bottom:18px;color:#fff}.formsec{background:${P.formBg};padding:44px 0 54px}.fcard{max-width:560px;margin:0 auto;background:${P.cardBg};border:1px solid ${P.cardBorder};border-radius:18px;padding:26px 22px;box-shadow:0 14px 34px rgba(0,0,0,.10)}.formtitle{font-size:20px;font-weight:800;margin-bottom:4px;color:${P.headline};text-align:center}.formsub{font-size:13.5px;color:${P.muted};text-align:center;margin-bottom:18px}.inp{width:100%;padding:14px;border:1px solid ${P.inBorder};border-radius:11px;font-size:15px;margin-bottom:10px;font-family:inherit;background:${P.inBg};color:${P.inText}}.inp::placeholder{color:${P.ph}}.err{display:none;font-size:12.5px;color:#F87171;margin-bottom:10px;text-align:center}.thanks{display:none;text-align:center;padding:18px 6px}.thanks h2{font-size:19px;margin-bottom:6px;color:${P.headline}}.thanks p{font-size:13.5px;color:${P.muted}}.foot{padding:22px 0 30px;text-align:center;font-size:13px;color:${P.foot}}.foot a{color:${P.text};font-weight:700;text-decoration:none}@media(min-width:640px){.bene{grid-template-columns:1fr 1fr}.gal{grid-template-columns:1fr 1fr 1fr}}@media(min-width:940px){.hero{padding:44px 0 50px}.hero-g.has-img{grid-template-columns:1.05fr .95fr}.bene{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}`;

  const telHref = phone ? `tel:${esc(phone.replace(/[^0-9+]/g, ""))}` : "";
  const topCall = phone ? `<a class="tb-call" href="${telHref}">📞 ${esc(phone)}</a>` : "";
  const callRow = phone ? `<div class="callrow">or call <a href="${telHref}">${esc(phone)}</a></div>` : "";
  const heroImg = hero ? `<img class="heroimg" src="${esc(hero.url)}" alt="${esc(cl.name)}">` : "";
  const chips = [
    area ? `<div class="chip">📍 Serving ${esc(area)}</div>` : "",
    differentiator ? `<div class="chip">⭐ ${esc(differentiator.slice(0, 80))}</div>` : "",
    `<div class="chip">✅ Free quote — no obligation</div>`,
  ].filter(Boolean).join("");
  const bulletsHTML = bullets.map((b) => `<div class="bcard"><span class="check">✓</span><span>${esc(b)}</span></div>`).join("");
  const galleryHTML = photos.length >= 2
    ? `<section class="wrap sec tight"><h2 class="sec-t">Recent work</h2><div class="gal">${photos.map((p) => `<img src="${esc(p.url)}" alt="${esc(p.label || cl.name)}" loading="lazy">`).join("")}</div></section>`
    : "";
  const offerHTML = offer
    ? `<section class="wrap sec tight"><div class="offer"><div class="eyebrow">Current offer</div><div class="offer-t">${esc(offer)}</div><a class="cta" href="#lead-form">${esc(cta)}</a></div></section>`
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(lp.headline)} — ${esc(cl.name)}</title><meta name="description" content="${esc(lp.subheadline || "")}"><meta property="og:title" content="${esc(lp.headline)} — ${esc(cl.name)}"><meta property="og:description" content="${esc(lp.subheadline || "")}">${hero ? `<meta property="og:image" content="${esc(hero.url)}">` : ""}<style>${css}</style></head><body>
<header class="wrap topbar"><div class="tb-name">${esc(cl.name)}</div>${topCall}</header>
<section class="hero"><div class="wrap hero-g${hero ? " has-img" : ""}">
  <div>
    <div class="eyebrow">${esc(cl.niche || "Trusted local service")}</div>
    <h1 class="headline">${esc(lp.headline)}</h1>
    <div class="subhead">${esc(lp.subheadline || "")}</div>
    <div class="ctarow"><a class="cta" href="#lead-form">${esc(cta)}</a>${callRow}</div>
  </div>
  ${heroImg}
</div></section>
<div class="wrap chips">${chips}</div>
<section class="wrap sec"><h2 class="sec-t">Why choose ${esc(cl.name)}</h2><div class="bene">${bulletsHTML}</div></section>
${galleryHTML}
${offerHTML}
<section class="formsec" id="lead-form"><div class="wrap"><div class="fcard">
  <div class="formtitle">${esc(cta)}</div>
  <div class="formsub">Fill this out and we'll be in touch shortly.</div>
  <form id="lf">
    <input class="inp" id="lf-name" placeholder="Your name" required>
    <input class="inp" id="lf-phone" placeholder="Phone number" required>
    <input class="inp" id="lf-email" type="email" placeholder="Email (optional)">
    <div class="err" id="lf-err">Something went wrong — please try again.</div>
    <button class="cta" type="submit" id="lf-btn" style="border:none;width:100%">${esc(cta)}</button>
  </form>
  <div class="thanks" id="lf-thanks"><h2>Got it — thank you!</h2><p>We'll be in touch shortly.</p></div>
</div></div></section>
<footer class="foot">${esc(cl.name)}${area ? ` · Serving ${esc(area)}` : ""}${phone ? ` · <a href="${telHref}">${esc(phone)}</a>` : ""}</footer>
<script>
document.getElementById('lf').addEventListener('submit',function(e){
  e.preventDefault();
  var btn=document.getElementById('lf-btn'),err=document.getElementById('lf-err');
  err.style.display='none';btn.disabled=true;btn.textContent='Sending…';
  fetch('/.netlify/functions/lead-intake?token=${encodeURIComponent(cl.leadToken || "")}',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:document.getElementById('lf-name').value,phone:document.getElementById('lf-phone').value,email:document.getElementById('lf-email').value,source:'landing_page'})
  }).then(function(r){if(!r.ok)throw 0;document.getElementById('lf').style.display='none';document.getElementById('lf-thanks').style.display='block';})
  .catch(function(){err.style.display='block';btn.disabled=false;btn.textContent=${JSON.stringify(cta)};});
});
<\/script>
</body></html>`;
}

export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  // New-format functions receive the ORIGINAL request URL — the rewrite target's
  // ?slug= never arrives (see KB netlify-new-format-function-req-url). Parse the
  // slug from the /lp/<slug> path; keep ?slug= as fallback for direct calls.
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
