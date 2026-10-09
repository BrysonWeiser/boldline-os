// What a business's Brand kit changes on its website and landing page (Bryson, 2026-10-09: "do all 3 of those":
// its own fonts on the website, before-and-after photos with a slider, and its second and accent colours).
// KB `brand-kit`. No imports, so site-render.mjs and landing.mjs can both use it without an import loop.
//
// 🔴 NOTHING CHANGES FOR A BUSINESS WITHOUT A KIT. Fonts fall back to each design's own, the second and accent
// colours fall back to the main one, and the before-and-after section is not drawn until a pair exists, so
// every page built before this renders exactly as it did. Photos follow the same rule he asked for: "leave
// space for photos ... and then when they are uploaded they get added". Until a pair is uploaded the section
// simply is not there (an empty frame on a live site reads as unfinished); the moment one is, it appears.

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const hex6 = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const https = (u) => (/^https:\/\/[^\s"'<>()]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");

// ── Fonts ─────────────────────────────────────────────────────────────────────────────────
// A font name from the kit, only if it could be a real typeface name (letters, digits, spaces).
const fontName = (n) => { const t = String(n || "").replace(/\s+/g, " ").trim(); return /^[A-Za-z][A-Za-z0-9 ]{1,39}$/.test(t) ? t : ""; };
const gfHref = (name, weights) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}${weights ? `:wght@${weights}` : ""}&display=swap`;
// Two stylesheets per font: the plain one always loads for any Google font, the one with bold weights may not
// exist for a single-weight display face, and a missing one only costs that one request.
export function brandFonts(cl) {
  const k = (cl && cl.brandKit) || {};
  const heading = fontName(k.headingFont), body = fontName(k.bodyFont);
  const hrefs = [...new Set([heading, body].filter(Boolean))].flatMap((n) => [gfHref(n, ""), gfHref(n, "400;600;700")]);
  return { heading, body, hrefs };
}
// The kit's font first, the design's own font behind it in case the kit's cannot load.
export const withFont = (name, stack) => (name ? `'${name}',${stack}` : stack);
export const fontLinks = (hrefs) => hrefs.map((h) => `<link rel="stylesheet" href="${esc(h)}" media="print" onload="this.media='all'">`).join("");

// ── Colours ───────────────────────────────────────────────────────────────────────────────
// The second and accent colours, each falling back to the main colour.
export function brandAccents(cl, main) {
  const k = (cl && cl.brandKit) || {};
  return { second: hex6(k.secondary) ? k.secondary : main, accent: hex6(k.accent) ? k.accent : main };
}

// ── Before and after ──────────────────────────────────────────────────────────────────────
// Pairs he uploaded on the Brand kit card. A pair whose photo was since deleted from the library is dropped,
// so a removed photo can never leave a broken frame on the live page.
export function beforeAfterPairs(cl) {
  const lib = new Set(((cl && cl.mediaLibrary) || []).map((m) => m && m.url).filter(Boolean));
  return ((cl && cl.beforeAfter) || [])
    .map((p) => ({ before: https(p && p.before), after: https(p && p.after), caption: String((p && p.caption) || "").replace(/\s+/g, " ").trim().slice(0, 120) }))
    .filter((p) => p.before && p.after && lib.has(p.before) && lib.has(p.after))
    .slice(0, 6);
}

export function beforeAfterHTML(pairs, { headClass = "", head = "Before and after", sub = "Drag the line to see the difference.", wrap = "wrap" } = {}) {
  if (!pairs.length) return "";
  return `<section class="sec ba-sec" id="before-after"><div class="${wrap}"><div class="ba-top"><h2 class="${headClass}">${esc(head)}</h2><p>${esc(sub)}</p></div>
<div class="ba-grid${pairs.length === 1 ? " one" : ""}">${pairs.map((p, i) => `<figure class="ba-item"><div class="ba" style="--p:50%"><img src="${esc(p.after)}" alt="After${p.caption ? `: ${esc(p.caption)}` : ""}" loading="lazy" decoding="async"><div class="ba-b"><img src="${esc(p.before)}" alt="Before${p.caption ? `: ${esc(p.caption)}` : ""}" loading="lazy" decoding="async"></div><span class="ba-tag ba-l">Before</span><span class="ba-tag ba-r">After</span><i class="ba-h" aria-hidden="true"></i><input type="range" min="0" max="100" value="50" aria-label="Compare before and after${pairs.length > 1 ? `, photo ${i + 1}` : ""}"></div>${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`).join("")}</div></div></section>`;
}

// Colours come in through --ba-r (corners) and --ba-mute (caption); everything else is white on the photo.
export const BEFORE_AFTER_CSS = `.ba-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 24px;margin-bottom:22px}.ba-top p{color:var(--ba-mute,#6B7280);margin:0}
.ba-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}
@media (min-width:760px){.ba-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ba-grid.one{grid-template-columns:minmax(0,1fr);max-width:900px}}
.ba-item{margin:0;min-width:0}.ba-item figcaption{margin-top:10px;font-size:15px;color:var(--ba-mute,#6B7280)}
.ba{position:relative;aspect-ratio:4/3;overflow:hidden;border-radius:var(--ba-r,16px);background:#111;user-select:none;-webkit-user-select:none}
.ba img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;max-width:none}
.ba-b{position:absolute;inset:0;clip-path:inset(0 calc(100% - var(--p)) 0 0)}
.ba-h{position:absolute;top:0;bottom:0;left:var(--p);width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 12px rgba(0,0,0,.35);pointer-events:none}
.ba-h::after{content:"";position:absolute;top:50%;left:50%;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.3);
background-image:linear-gradient(90deg,transparent 13px,#111 13px,#111 15px,transparent 15px,transparent 27px,#111 27px,#111 29px,transparent 29px)}
.ba-tag{position:absolute;top:12px;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;pointer-events:none}
.ba-l{left:12px}.ba-r{right:12px}
.ba input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;-webkit-appearance:none;appearance:none;touch-action:pan-y}
.ba:focus-within .ba-h{box-shadow:0 0 0 2px rgba(255,255,255,.6),0 0 12px rgba(0,0,0,.35)}`;

export const BEFORE_AFTER_JS = `(function(){[].forEach.call(document.querySelectorAll('.ba input'),function(r){var f=function(){r.parentNode.style.setProperty('--p',r.value+'%');};r.addEventListener('input',f);f();});})();`;
