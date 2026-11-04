// A business's look, read from its own current website: brand colours, logo and Google fonts (KB brand-kit,
// "from their website"). Bryson, 2026-11-04: "make sure any previews are done in the brands colors using anything we
// can from their website".
//
// 🔴 IT NEVER BEATS WHAT WAS SET BY HAND. The result is stored as `siteBrand` (a client) or `demoSite.brand` (a
// prospect) and every reader puts it LAST: a Brand kit, a colour he typed, or the landing page's colour all win
// (site-render brandColorOf, brand-style brandAccents/brandFonts, site-render logoOf).
// 🔴 ONLY PUBLIC HTTPS PAGES, the same check the email branding uses (safePublicUrl, every redirect hop re-checked),
// a short timeout and a size cap. Best effort: anything that goes wrong returns null and the preview keeps the
// design's own colours.
import { brandFromHTML, safePublicUrl } from "./biz-email.mjs";

const UA = "Mozilla/5.0 (compatible; BoldLine brand-check)";
async function fetchText(url, { fetchImpl = fetch, accept = "text/html", max = 900000, ms = 7000 } = {}) {
  let u = safePublicUrl(url);
  for (let hop = 0; u && hop < 4; hop++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetchImpl(u, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, accept } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = safePublicUrl(new URL(r.headers.get("location"), u).href); continue; }
      if (!r.ok) return null;
      const text = (await r.text()).slice(0, max);
      return { text, url: u };
    } catch (e) { return null; }
    finally { clearTimeout(t); }
  }
  return null;
}

// ── Colours ────────────────────────────────────────────────────────────────────────────────────
const toHex = (c) => {
  const s = String(c || "").trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/); if (m) return "#" + m[1].split("").map((x) => x + x).join("");
  m = s.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/); if (m) return "#" + m[1];
  m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/); if (m) return "#" + [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, "0")).join("");
  return "";
};
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const chroma = (h) => { const [r, g, b] = rgb(h); return Math.max(r, g, b) - Math.min(r, g, b); };
const hue = (h) => { const [r, g, b] = rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
// 🔴 The stock colours of the toolkits most small-business sites are built on (Bootstrap 3/4/5, WordPress block
// presets, Font Awesome, common page builders). They fill a page's CSS whether the business uses them or not, so they
// would beat the real brand on sheer count (chemdry.com read as Bootstrap's link blue).
const TOOLKIT = new Set(["#337ab7", "#23527c", "#2e6da4", "#286090", "#204d74", "#a94442", "#3c763d", "#8a6d3b", "#31708f", "#5cb85c", "#5bc0de", "#f0ad4e", "#d9534f",
  "#007bff", "#0056b3", "#0d6efd", "#0a58ca", "#6c757d", "#28a745", "#198754", "#dc3545", "#ffc107", "#17a2b8", "#0dcaf0", "#fd7e14", "#6610f2", "#6f42c1", "#e83e8c", "#d63384", "#20c997",
  "#cf2e2e", "#ff6900", "#fcb900", "#7bdcb5", "#00d084", "#8ed1fc", "#0693e3", "#9b51e0", "#f78da7", "#abb8c3", "#0073aa", "#00a0d2", "#2271b1", "#135e96", "#72aee6", "#d63638",
  "#1e73be", "#61ce70", "#6ec1e4", "#54595f", "#7a7a7a", "#4054b2", "#23a455", "#e2498a", "#0274be", "#3a3a3a",
  // their hover and pressed shades
  "#449d44", "#398439", "#255625", "#31b0d5", "#269abc", "#1b6d85", "#ec971f", "#d58512", "#985f0d", "#c9302c", "#ac2925", "#761c19", "#122b40",
  "#0069d9", "#0062cc", "#5a6268", "#545b62", "#218838", "#1e7e34", "#c82333", "#bd2130", "#e0a800", "#d39e00", "#138496", "#117a8b",
  "#357ebd", "#4cae4c", "#46b8da", "#eea236", "#d43f3a", "#2b542c", "#245269", "#66512c", "#843534",
  "#0b5ed7", "#0a53be", "#5c636a", "#565e64", "#157347", "#146c43", "#bb2d3b", "#b02a37", "#ffca2c", "#31d2f2"]);
// A colour that can carry a brand: not grey, not near white, not near black, not a toolkit default.
export const brandish = (h) => !!h && chroma(h) >= 38 && lum(h) > 0.1 && lum(h) < 0.88 && !TOOLKIT.has(h.toLowerCase());
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{5,40}\)/g;

// Pure: score every colour on a page and its stylesheets, and pick main, second and accent.
export function paletteFrom(html, cssTexts = [], logoSvg = "") {
  const h = String(html || ""), css = [h.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [], cssTexts].flat().join("\n").slice(0, 2000000);
  const score = {};
  const add = (c, w) => { const x = toHex(c); if (brandish(x)) score[x] = (score[x] || 0) + w; };
  const theme = (h.match(/<meta[^>]+name=["'](?:theme-color|msapplication-TileColor)["'][^>]*content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']theme-color["']/i) || [])[1];
  if (theme) add(theme, 40);
  // A vector logo's own colours are the strongest clue there is.
  for (const c of (String(logoSvg || "").slice(0, 300000).match(/(?:fill|stop-color|stroke)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,6}|rgba?\([^)]{5,40}\))/g) || [])) add(c.replace(/^[^#r]*/, ""), 30);
  // Named brand variables: --primary, --brand-color, --accent, --theme...
  for (const m of css.matchAll(/--[\w-]*(primary|brand|accent|main|theme|secondary|cta|button|highlight)[\w-]*\s*:\s*([^;}{]+)/gi)) for (const c of (m[2].match(COLOR) || [])) add(c, /secondary/i.test(m[1]) ? 10 : 14);
  // What buttons are painted with.
  for (const m of css.matchAll(/([^{}]{1,200})\{([^{}]{1,800})\}/g)) if (/btn|button|cta|book|\.primary|nav a:hover/i.test(m[1])) for (const d of m[2].matchAll(/(?:background(?:-color)?|border-color|color)\s*:\s*([^;]+)/gi)) for (const c of (d[1].match(COLOR) || [])) add(c, 6);
  // Everything else counts a little.
  for (const c of (css.match(COLOR) || [])) add(c, 1);
  for (const m of h.matchAll(/style=["']([^"']{1,400})["']/gi)) for (const c of (m[1].match(COLOR) || [])) add(c, 2);
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  if (!ranked.length) return null;
  const primary = ranked[0];
  const second = ranked.find((c) => c !== primary && hueGap(c, primary) >= 25) || "";
  const accent = ranked.find((c) => c !== primary && c !== second && (!second || hueGap(c, second) >= 25) && hueGap(c, primary) >= 25) || "";
  return { primary: primary.toUpperCase(), second: second.toUpperCase(), accent: accent.toUpperCase() };
}

// Pure: the Google fonts a page loads, heading first.
export function fontsFrom(html) {
  const names = [];
  for (const m of String(html || "").matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const f of m[1].replace(/&amp;/g, "&").split("&").filter((x) => /^family=/.test(x))) {
      for (const part of decodeURIComponent(f.slice(7)).split("|")) { const n = part.split(":")[0].replace(/\+/g, " ").trim(); if (/^[A-Za-z][A-Za-z0-9 ]{1,39}$/.test(n) && !names.includes(n)) names.push(n); }
    }
  }
  return { headingFont: names[0] || "", bodyFont: names[1] || names[0] || "" };
}

// The business's current website, read for its look. Returns null when there is nothing usable.
export async function brandFromSite(url, { fetchImpl = fetch, now = new Date() } = {}) {
  const page = await fetchText(url, { fetchImpl });
  if (!page || !page.text) return null;
  const sheets = [];
  for (const tag of (page.text.match(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi) || []).slice(0, 8)) {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    // Skip toolkit and plugin stylesheets: their colours are someone else's, not the business's.
    if (!href || /fonts\.googleapis|bootstrap|font-?awesome|wp-includes|block-library|jquery|animate(\.min)?\.css|swiper|slick|owl\.carousel|elementor\/assets\/lib|fancybox|magnific/i.test(href)) continue;
    let abs = ""; try { abs = new URL(href.replace(/&amp;/g, "&"), page.url).href; } catch (e) { continue; }
    if (sheets.length >= 3) break;
    const css = await fetchText(abs, { fetchImpl, accept: "text/css", max: 500000, ms: 5000 });
    if (css && css.text) sheets.push(css.text);
  }
  const b = brandFromHTML(page.text, page.url);
  const svg = /\.svg(\?|$)/i.test(b.logoUrl || "") ? await fetchText(b.logoUrl, { fetchImpl, accept: "image/svg+xml", max: 300000, ms: 5000 }) : null;
  const pal = paletteFrom(page.text, sheets, svg && svg.text);
  const fonts = fontsFrom(page.text);
  // A logo has to be an image file (some sites put the logo in a link, and the "src" read back is the home page).
  const logo = /^https:\/\/[^\s]+\.(png|jpe?g|svg|webp|gif)(\?[^\s]*)?$/i.test(b.logoUrl || "") ? b.logoUrl : "";
  if (!pal && !logo && !fonts.headingFont) return null;
  return { ...(pal || {}), logo, ...fonts, from: page.url, at: now.toISOString() };
}

// Where a business's CURRENT website lives, if we know: a prospect's found site, a client's typed site, the address
// they gave in the portal, or their own domain before we put the new site on it.
export function currentSiteOf(subject) {
  const s = subject || {}, d = s.data || {};
  const live = s.websiteDeal && s.websiteDeal.domain && s.websiteDeal.domain.live;
  const list = [s.domain, d.website, d.url, typeof s.website === "string" ? s.website : "", s.websiteUrl, s.currentWebsite,
    s.websiteIntake && s.websiteIntake.domain, !live && s.websiteDeal && s.websiteDeal.domain && s.websiteDeal.domain.host];
  for (const v of list) {
    const t = String(v || "").trim();
    if (!t || /^(none|unknown|n\/a)$/i.test(t) || /boldline/i.test(t)) continue;
    const u = safePublicUrl(/^https?:\/\//i.test(t) ? t.replace(/^http:/i, "https:") : `https://${t.replace(/^\/+/, "")}`);
    if (u && !/(facebook|instagram|yelp|google|linkedin|tiktok|nextdoor|angi|thumbtack|houzz)\./i.test(u)) return u;
  }
  return "";
}
