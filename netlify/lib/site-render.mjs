// Websites BoldLine builds for clients: one renderer, three looks, five pages, and a motion mix
// that is different for every client.
//
// Bryson, 2026-10-06: sell templated, OS-built websites ($1,500 + $99/mo, anyone), and *"I want it to
// be the most up to date modern website ... micro animations 3d graphics etc basically thinking outside
// the box"*. Then: the references mattered for *"the animations. It made it feels unique, luxury, and
// immersive"*, *"make sure we aren't only ever using the same animation like how it went through the
// window"*, and *"don't use to much motion but also don't use to little basically using it at the right
// times"*. KB `website-design-bar` (the standing rule) and `website-builder`.
//
// HOW THE MOTION IS CHOSEN. `motionRecipe(cl, theme)` picks, from a seed that is the client's own:
//   entrance   how the hero headline arrives          rise | chars | focus | wipe
//   scene      the ONE big scroll moment on the home  portal (the jet-window move) | rail | stack
//   reveal     how sections come in                   rise | clip | soft
//   transition between pages                         veil | curtain
//   marquee    the moving strip                       drift | velocity
// plus whether the story lights up word by word and whether a cursor ring follows the pointer. The
// three designs one client is shown never share a scene or an entrance, and two clients on the same
// design usually get a different mix. The 3D backdrop is matched to the trade (`glSceneFor`): water
// caustics, liquid chrome, silk, contour lines, or a slow liquid light.
// "The right amount": each page gets an entrance, at most two scroll moments, quiet reveals and hover
// details. Nothing loops for attention except the strip and the 3D backdrop, and both stop off screen.
//
// 🔴 THE RULES THIS FILE MUST NEVER BREAK, each pinned by tests/verify-site-builder.mjs:
//  1. FAST FIRST. Everything a visitor needs is plain HTML and CSS that renders before any script
//     runs, and every scroll scene has a plain layout it falls back to. Hidden-until-revealed states
//     only exist under `html.mo` (or `html.js`), which the script adds, and which it takes away again
//     if anything throws. The WebGL piece and smooth scrolling load after the page is usable, and are
//     skipped for "reduce motion", Data Saver, small-memory phones and browsers without WebGL; the 3D
//     also stops itself on a device too slow to keep up.
//  2. NO RELATIVE LINKS. Every href is absolute, built from `base`. A relative link inside the OS
//     preview (an iframe srcdoc) resolves against the OS itself; that is how a landing page CTA once
//     navigated to the OS. Phone and email links are tel: and mailto:.
//  3. A PREVIEW CHANGES NOTHING. The form refuses to send from an about: document (the srcdoc), and
//     in the preview every link is intercepted and only asks the OS to switch tabs.
//  4. NOTHING POINTS BACK AT BOLDLINE, no emojis, no em dashes, and no `//` comments in shipped
//     script (it is delivered verbatim to the client's own domain).
//  5. NO INVENTED PROOF. Reviews are only ever real ones he typed in, or a link to Google. No
//     fabricated testimonials, counts, ratings or years in business.

import { termsOf } from "./website-deal.mjs";
import { bookingOn, bookingConfig, intakeOf } from "./booking.mjs";
import { bookingWidgetHTML, bookingWidgetJS, BOOKING_WIDGET_CSS } from "./booking-widget.mjs";
import { brandFonts, withFont, fontLinks, brandAccents, beforeAfterPairs, beforeAfterHTML, BEFORE_AFTER_CSS, BEFORE_AFTER_JS } from "./brand-style.mjs";

// 🔴 NO ZOOM ON AN IPHONE (Bryson, 2026-10-08, screenshot of the contact page cut off after sending).
// Safari on iPhone zooms the page in when someone taps a form box whose text is under 16px, and it
// stays zoomed after they submit, so the page reads as cut off. Every form box on a phone is 16px.
// The same rule sits in the marketing site, the landing pages, the client websites and the portal
// (verify-no-ios-zoom keeps them identical and checks the rendered pages).
export const IOS_NO_ZOOM = "@media (max-width:1024px),(pointer:coarse){input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=button]):not([type=hidden]),select,textarea{font-size:16px!important}}";

export const SITE_PAGES = [
  { id: "home", label: "Home", path: "" },
  { id: "services", label: "Services", path: "services" },
  { id: "about", label: "About", path: "about" },
  { id: "reviews", label: "Reviews", path: "reviews" },
  { id: "contact", label: "Contact", path: "contact" },
];
export const pageById = (id) => SITE_PAGES.find((p) => p.id === id) || null;

// Pages beyond the five: extra pages the client paid for (each written by the builder) and the blog.
// Ids carry their own path ("x-service-areas", "blog") so a link never needs the page list to resolve.
// Bryson, 2026-10-06: *"what if a client wants to add extra pages such as a blog page?"* KB `website-builder`.
export const RESERVED_SLUGS = ["", "home", "services", "about", "reviews", "contact", "blog", "site", "book"];
export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
export const blogOn = (cl) => !!(cl && (termsOf(cl).blog || (cl.internal && cl.website && cl.website.blogOn)));
export const extraPagesOf = (cl) => (((cl && cl.website && cl.website.extraPages) || []))
  .filter((p) => p && p.slug && !RESERVED_SLUGS.includes(p.slug) && p.title && p.content && p.content.headline)
  .map((p) => ({ id: `x-${p.slug}`, label: clean(p.title, 40), path: p.slug, extra: p }));
// The Book page joins once online booking is on with at least one package (./booking.mjs). It stays out of
// the top bar, because the main button there already goes to it.
export const pagesFor = (cl) => SITE_PAGES.concat(extraPagesOf(cl), blogOn(cl) ? [{ id: "blog", label: "Blog", path: "blog" }] : [],
  bookingOn(cl) ? [{ id: "book", label: "Book", path: "book", nav: false }] : []);
export const pageInSite = (cl, id) => pagesFor(cl).find((p) => p.id === id) || null;
export const pageByPath = (cl, seg) => pagesFor(cl).find((p) => p.path === String(seg || "")) || null;

export const SITE_THEMES = {
  cinematic: { label: "Cinematic", blurb: "Split screen told like a film: their photos stay pinned and change scene by scene as visitors scroll the story." },
  aurora: { label: "Aurora", blurb: "Dark and bold, with a moving 3D backdrop matched to the trade." },
  editorial: { label: "Editorial", blurb: "A magazine: a cover headline, services as a table of contents, their story as a feature spread." },
  // Bryson, 2026-11-03, on Aurora: "might be out of date or just there might be a better style". Photo-first, the way
  // the best service-business sites look now: their work fills the screen, the real star rating sits at the top, and
  // services are photo tiles. Appended last on purpose: motionRecipe indexes by position, so existing sites keep their
  // motion. KB website-builder.
  showcase: { label: "Showcase", blurb: "Photo-first: their work fills the screen, the star rating up top, services as photo tiles." },
};
// Aurora is RETIRED: never offered again, but a site already on it renders exactly as before.
SITE_THEMES.aurora.retired = true;
export const THEME_IDS = Object.keys(SITE_THEMES);
// The designs offered in every picker and switcher, best first.
export const PICK_THEMES = ["showcase", "cinematic", "editorial"];
// A switcher shows the offered designs, plus a retired one only for a site already using it.
export const pickThemesFor = (current) => (PICK_THEMES.includes(current) || !SITE_THEMES[current] ? PICK_THEMES : PICK_THEMES.concat(current));
// What a NEW site or demo starts on.
export const THEME_DEFAULT = "showcase";
export const themeOf = (cl, override) => {
  const t = String(override || (cl && cl.website && cl.website.theme) || "");
  return SITE_THEMES[t] ? t : "aurora";
};
// Light or dark is its own choice, separate from the design (Bryson, 2026-11-04: "some businesses would want a style
// but have it either light or dark and that should be an option for all templates"). `website.mode`; when it is unset
// each design shows in its natural one. Aurora (retired) only ever existed dark.
export const MODES = ["light", "dark"];
export const NATURAL_MODE = { showcase: "light", cinematic: "dark", editorial: "light", aurora: "dark" };
export const modeOf = (cl, theme, override) => {
  if (theme === "aurora") return "dark";
  const m = String(override || (cl && cl.website && cl.website.mode) || "");
  return MODES.includes(m) ? m : NATURAL_MODE[theme] || "light";
};

// Smooth scrolling. Pinned to one exact file: the integrity hash makes the browser refuse anything
// else the CDN might ever serve under that address.
export const LENIS = { src: "https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js", sri: "sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw" };

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

// ── Motion: a different mix for every client ──────────────────────────────────────────────
export const MOTION = {
  entrance: ["rise", "chars", "focus", "wipe"],
  scene: ["portal", "rail", "stack"],
  reveal: ["rise", "clip", "soft"],
  transition: ["veil", "curtain"],
  marquee: ["drift", "velocity"],
};
const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const prng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The 3D backdrop, matched to what the business does. Order matters: "pool and spa" is water,
// "day spa" and "med spa" are silk.
const GL_SCENES = [
  ["water", /pool|swim|hot tub|plumb|water|irrigat|fountain|aquarium|boat|marine|dock|pressure wash|power wash|clean/i],
  ["silk", /chiro|wellness|spa\b|medical|massage|salon|beauty|skin|lash|brow|nail|dental|dentist|ortho|yoga|pilates|therap|physio|aesthetic|bridal|wedding|florist|fashion|boutique|barber/i],
  ["chrome", /auto|\bcars?\b|detail|wrap|tint|vehicle|motor|mechanic|tire|collision|body shop|garage|weld|metal|fabricat|towing|limo|jet|aviation|machin/i],
  ["topo", /roof|landscap|lawn|tree|construct|contract|remodel|renovat|real estate|realtor|concrete|paving|fence|deck|excavat|builder|survey|solar|hvac|electric|handyman|paint|pest/i],
];
export const glSceneFor = (cl) => {
  const s = `${(cl && cl.niche) || ""} ${(cl && cl.name) || ""}`;
  const hit = GL_SCENES.find(([, re]) => re.test(s));
  return hit ? hit[0] : "liquid";
};

export function motionRecipe(cl, theme) {
  const w = (cl && cl.website) || {};
  const seed = hashStr(String(w.motionSeed || (cl && (cl.id || cl.landingSlug || cl.name)) || "site"));
  // Showcase takes the retired Aurora's slot, so the three designs a client is offered still never share a scene
  // or an entrance (motion for every existing site is unchanged).
  const ti = Math.max(0, THEME_IDS.indexOf(theme === "showcase" ? "aurora" : theme));
  // One shuffle per client, indexed by design: the three designs never share a scene or an entrance.
  const base = prng(seed);
  const scenes = shuffle(MOTION.scene, base);
  const entrances = shuffle(MOTION.entrance, base);
  const r = prng((seed ^ Math.imul(ti + 1, 0x9E3779B1)) >>> 0);
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    entrance: entrances[ti % entrances.length],
    scene: scenes[ti % scenes.length],
    reveal: pick(MOTION.reveal),
    transition: pick(MOTION.transition),
    marquee: pick(MOTION.marquee),
    fill: r() < 0.6,
    // 🔴 NOTHING EVER FOLLOWS THE CURSOR (Bryson, 2026-11-05: "on showcase there is a circle that follows around the
    // cursor but i dont want anything to ever follow someones cursor"). The ring is gone for every design.
    cursor: false,
    // Cinematic used to show the backdrop through a glass orb. Bryson, 2026-11-04: "I feel like that should change where we
    // don't have a random bubble". It now shows their own photo in a frame instead, so only Aurora still draws 3D.
    gl: theme === "aurora" ? glSceneFor(cl) : null,
  };
}

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
    cta: { headline: clean(c.cta && c.cta.headline, 90) || "Ready when you are.", sub: clean(c.cta && c.cta.sub, 200) || "Tell us what you need and we'll get back to you fast.", button: clean(c.cta && c.cta.button, 28) || "Get in touch",
      // Buttons say something about THIS business rather than the same "Our services" / "Send" on every site
      // (Bryson, 2026-10-07). Sites written before these existed get a fallback built from their own services.
      explore: clean(c.cta && c.cta.explore, 28) || (services.length > 1 ? `See all ${services.length} services` : "See what we do"),
      send: clean(c.cta && c.cta.send, 28) || "Send my request" },
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
// Their uploaded logo, else the one on their current website (siteBrand).
const logoOf = (cl) => { const m = ((cl && cl.mediaLibrary) || []).find((x) => x && x.category === "logo" && httpsUrl(x.url)); return m ? httpsUrl(m.url) : httpsUrl(cl && cl.siteBrand && cl.siteBrand.logo); };

// ── Palettes ──────────────────────────────────────────────────────────────────────────────
// The 3D backdrop's colors: a base set per scene, leaned toward the client's own color.
const GL_BASE = {
  water: { dark: ["#03141C", "#0B4F6C", "#BFF3FA"], light: ["#D3EAF1", "#78C2D7", "#FFFFFF"], lean: [0.12, 0.18, 0.04] },
  chrome: { dark: ["#050608", "#4B5462", "#F2F5F9"], light: ["#D9DEE4", "#8C96A3", "#FFFFFF"], lean: [0.06, 0.14, 0] },
  silk: { dark: ["#0B0A0D", "#3B2C38", "#F3DED4"], light: ["#EFE7E2", "#D8C3BA", "#FFFFFF"], lean: [0.08, 0.22, 0.05] },
  topo: { dark: ["#07090B", "#18201F", "#3A4744"], light: ["#EEEBE5", "#DAD5CC", "#B7B0A3"], lean: [0.04, 0.1, 0.25] },
};
function glPalette(scene, dark, a, bg) {
  if (!scene) return null;
  if (scene === "liquid") return dark ? [mix(bg, a, 0.10), mix("#101826", a, 0.55), mix(bg, a, 0.85)] : [mix("#F3F1EC", a, 0.18), mix("#FFFFFF", a, 0.45), mix("#D9E6F7", a, 0.25)];
  const b = GL_BASE[scene];
  return (dark ? b.dark : b.light).map((c, i) => mix(c, a, b.lean[i]));
}

// The one brand colour rule, shared with the landing page so a business's website and its ad page can never disagree:
// the colour set in the website editor, then the colour set by hand on the client, then the generated page colour.
export function brandColorOf(cl) {
  const w = (cl && cl.website) || {};
  // A brand kit he set by hand (KB brand-kit) beats anything a generator chose.
  // Last: the colour read off their CURRENT website (siteBrand, KB brand-kit), so every preview is in their colours
  // even before anyone sets a kit. Anything set by hand still wins.
  for (const c of [cl && cl.brandKit && cl.brandKit.primary, w.brandColor, cl && cl.brandColor, cl && cl.landingPage && cl.landingPage.brandColor, cl && cl.siteBrand && cl.siteBrand.primary]) if (hexOk(c)) return c;
  return null;
}

function palette(theme, cl, scene, mode) {
  const P = paletteBase(theme, cl, scene, mode || modeOf(cl, theme));
  // The Brand kit's second and accent colours (KB brand-kit); without them both are the main colour, so a
  // site with no kit looks exactly as before.
  const A = brandAccents(cl, P.accent);
  let a2 = A.second, a3 = A.accent;
  // On a dark page a very dark brand colour (navy, black) would vanish from the small touches (dots, ticks, stars),
  // so those lift toward white. Buttons keep the true colour. Aurora is left exactly as it was.
  if (P.dark && theme !== "aurora" && lum(P.accent) < 0.05) { if (a2 === P.accent) a2 = mix(P.accent, "#FFFFFF", 0.45); if (a3 === P.accent) a3 = mix(P.accent, "#FFFFFF", 0.45); }
  return { ...P, mode: P.dark ? "dark" : "light", deep: P.dark ? P.bg2 : P.ink, accent2: a2, accent3: a3 };
}
// Each design in light and in dark. The light and dark of one design keep its type, shapes and layout; only the
// colours turn over.
const SURFACES = {
  cinematic: { light: { bg: "#F2F0EB", bg2: "#FFFFFF", ink: "#111111", mute: "#5F5B55", line: "rgba(17,17,17,.12)", card: "#FFFFFF" },
    dark: { bg: "#0C0C0E", bg2: "#151518", ink: "#F2F0EB", mute: "#A19D95", line: "rgba(255,255,255,.10)", card: "rgba(255,255,255,.04)" } },
  editorial: { light: { bg: "#F7F6F2", bg2: "#FFFFFF", ink: "#171A18", mute: "#686D69", line: "rgba(23,26,24,.12)", card: "#FFFFFF" },
    dark: { bg: "#131513", bg2: "#1B1E1C", ink: "#ECEAE3", mute: "#9DA39E", line: "rgba(236,234,227,.14)", card: "#1B1E1C" } },
  showcase: { light: { bg: "#F8F7F4", bg2: "#FFFFFF", ink: "#111214", mute: "#5E6166", line: "rgba(17,18,20,.10)", card: "#FFFFFF" },
    dark: { bg: "#0F1012", bg2: "#18191C", ink: "#F4F3F0", mute: "#A3A6AC", line: "rgba(255,255,255,.10)", card: "#18191C" } },
};
const DEFAULT_ACCENT = { cinematic: "#2F6FED", editorial: "#2F5D50", showcase: "#E4572E" };
function paletteBase(theme, cl, scene, mode) {
  const w = (cl && cl.website) || {};
  const brand = brandColorOf(cl);
  if (SURFACES[theme]) {
    const a = brand || DEFAULT_ACCENT[theme], dark = mode === "dark";
    return { ...SURFACES[theme][dark ? "dark" : "light"], accent: a, onAccent: onColor(a), dark, gl: null };
  }
  const a = brand || "#E8A15B";
  return { bg: "#0A0C10", bg2: "#12151B", ink: "#F3F2EF", mute: "#9C9B96", line: "rgba(255,255,255,.09)", accent: a, onAccent: onColor(a), card: "rgba(255,255,255,.04)", dark: true,
    gl: glPalette(scene, true, a, "#0A0C10") };
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────────
const FONTS = {
  cinematic: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap",
  aurora: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Geist:wght@300..700&display=swap",
  // Playfair Display since 2026-11-05 (Bryson: "I still want some sort of fancy but it needs to be readable"). Fraunces's
  // display cut came out squeezed and leaning on an iPhone (Google serves Safari a different file), and its italic crowded.
  editorial: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..700&family=Instrument+Sans:wght@400..700&display=swap",
  showcase: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap",
};

// The design's own typefaces, with the business's Brand kit fonts in front when it has them (KB brand-kit).
const typeOf = (theme, cl) => {
  const F = brandFonts(cl);
  return {
    display: withFont(F.heading, theme === "cinematic" ? "'Archivo',system-ui,sans-serif" : theme === "editorial" ? "'Playfair Display',Georgia,serif" : theme === "showcase" ? "'Plus Jakarta Sans',system-ui,sans-serif" : "'Bricolage Grotesque',system-ui,sans-serif"),
    body: withFont(F.body, theme === "cinematic" ? "'Archivo',system-ui,sans-serif" : theme === "editorial" ? "'Instrument Sans',system-ui,sans-serif" : theme === "showcase" ? "'Plus Jakarta Sans',system-ui,sans-serif" : "'Geist',system-ui,sans-serif"),
    r: theme === "editorial" ? "4px" : theme === "cinematic" ? "28px" : theme === "showcase" ? "20px" : "18px",
    fontHrefs: F.hrefs,
  };
};

// What a client's landing page borrows from their website once a design has been picked (Bryson, 2026-10-07: the
// website and the landing page for the same business must share colours and branding). Null when there is no website
// design yet, so an ads-only client's landing page keeps its own look.
export function siteBrandKit(cl) {
  const w = (cl && cl.website) || {};
  if (!SITE_THEMES[w.theme]) return null;
  const theme = w.theme, P = palette(theme, cl, null), T = typeOf(theme, cl);
  return { theme, dark: P.dark, bg: P.bg, bg2: P.bg2, ink: P.ink, mute: P.mute, line: P.line, accent: P.accent, onAccent: P.onAccent,
    fontHref: FONTS[theme], fontHrefs: T.fontHrefs, display: T.display, body: T.body, radius: T.r, second: P.accent2, accent3: P.accent3 };
}

const cssVars = (P) => `--bg:${P.bg};--bg2:${P.bg2};--ink:${P.ink};--mute:${P.mute};--line:${P.line};--ac:${P.accent};--ac2:${P.accent2};--ac3:${P.accent3};--on:${P.onAccent};--card:${P.card};--deep:${P.deep}`;
// `alt` is the same design in the other mode: written in too, so a preview's light/dark switch flips instantly
// (html[data-mode]) without a reload. A live site simply never switches.
function css(theme, P, cl, alt) {
  const { display, body, r } = typeOf(theme, cl);
  return `
:root{${cssVars(P)};--r:${r};--ease:cubic-bezier(.2,.7,.1,1);--io:cubic-bezier(.7,0,.2,1)}
${alt ? `html[data-mode=${alt.mode}]{${cssVars(alt)}}` : ""}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
html.lenis,html.lenis body{height:auto}.lenis.lenis-smooth{scroll-behavior:auto!important}.lenis.lenis-stopped{overflow:hidden}
body{background:var(--bg);color:var(--ink);font-family:${body};font-size:17px;line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
.wrap{width:min(1240px,100% - 40px);margin:0 auto}
.disp{font-family:${display};${theme === "cinematic" ? "font-stretch:125%;font-weight:600;letter-spacing:-.035em;" : theme === "showcase" ? "font-weight:800;letter-spacing:-.04em;" : theme === "editorial" ? "font-weight:500;letter-spacing:-.01em;" : "font-weight:700;font-variation-settings:'opsz' 96;letter-spacing:-.035em;"}line-height:.98}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:500;color:var(--mute)}
${theme === "aurora" ? ".eyebrow{border:1px solid var(--line);border-radius:999px;padding:7px 14px 7px 12px;color:var(--ink);background:rgba(255,255,255,.03)}" : ""}
.eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--ac3)}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;min-height:52px;padding:0 28px;border-radius:999px;background:var(--ac);color:var(--on);font-weight:600;font-size:15px;border:0;cursor:pointer;transition:transform .35s var(--ease),box-shadow .35s var(--ease),background .3s;will-change:transform}
.btn:hover{box-shadow:0 14px 40px -14px var(--ac)}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn.ghost:hover{border-color:var(--ink);box-shadow:none}
.bt{position:relative;display:inline-block;overflow:hidden;line-height:1.3;vertical-align:middle}
.bt>span{position:relative;display:inline-block;transition:transform .55s var(--ease)}
.bt>span::after{content:attr(data-t);content:attr(data-t) / "";position:absolute;left:0;top:100%;white-space:nowrap}
@media (hover:hover){.btn:hover .bt>span{transform:translateY(-100%)}}
${theme === "editorial" ? ".btn{border-radius:2px;letter-spacing:.02em}" : ""}
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
.nav a::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:1.5px;background:var(--ac);transform:scaleX(0);transform-origin:right;transition:transform .45s var(--ease)}
.nav a:hover::after,.nav a[aria-current]::after{transform:scaleX(1);transform-origin:left}
.hd .btn{min-height:42px;padding:0 20px;font-size:14px}
.burger{display:none;width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.burger span{display:block;width:18px;height:1.5px;background:currentColor;margin:4px auto;transition:transform .3s}
.mnav{position:fixed;inset:0;z-index:60;background:var(--bg);padding:100px 24px 40px;display:flex;flex-direction:column;gap:6px;opacity:0;pointer-events:none;transition:opacity .35s}
.mnav.open{opacity:1;pointer-events:auto}
.mnav a{font-size:34px;padding:8px 0;border-bottom:1px solid var(--line);transform:translateY(16px);opacity:0;transition:transform .6s var(--ease),opacity .5s}
.mnav.open a{transform:none;opacity:1}
.mnav.open a:nth-of-type(2){transition-delay:.04s}.mnav.open a:nth-of-type(3){transition-delay:.08s}.mnav.open a:nth-of-type(4){transition-delay:.12s}.mnav.open a:nth-of-type(5){transition-delay:.16s}.mnav.open a:nth-of-type(6){transition-delay:.2s}
.mnav .close{position:absolute;top:18px;right:20px}
@media(max-width:880px){.nav,.hd .btn{display:none}.burger{display:block}}
.nav a,.brand{white-space:nowrap}
.burger{flex:0 0 auto}
/* A long business name on a small phone shrinks rather than pushing the menu button off the screen. */
.brand{min-width:0;overflow:hidden;text-overflow:ellipsis}
@media(max-width:380px){.hd .wrap{gap:12px}.brand{font-size:15px}}
@media(max-width:1180px){.hd.many .nav,.hd.many .btn{display:none}.hd.many .burger{display:block}}
/* hero */
.hero{position:relative;min-height:100svh;display:flex;align-items:flex-end;overflow:hidden;isolation:isolate}
.hero .fx{position:absolute;inset:0;z-index:-1}
.hero canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.8s var(--ease)}
.hero canvas.on{opacity:1}
.hero .fx::before{content:"";position:absolute;inset:auto 0 0;z-index:1;height:160px;background:linear-gradient(transparent,var(--bg));pointer-events:none}
.hero .fx::after{content:"";position:absolute;inset:0 0 auto;height:180px;background:linear-gradient(var(--bg),transparent);opacity:.75;pointer-events:none}
.hero .copy{padding:140px 0 72px;margin-inline:auto}
.hero h1{font-size:clamp(46px,9vw,148px)}
.hero p.sub{max-width:520px;margin-top:22px;font-size:clamp(16px,1.6vw,19px);color:var(--mute)}
.hero .acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.page-hero{min-height:62svh}
.page-hero h1{font-size:clamp(40px,7vw,104px)}
.mk{background:linear-gradient(var(--ac),var(--ac)) no-repeat 0 94%/100% .07em;padding-bottom:.04em}
/* sections */
section{position:relative}
.sec{padding:clamp(80px,11vw,150px) 0}
.sec-h{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:clamp(36px,5vw,64px)}
.sec-h h2{font-size:clamp(34px,5.4vw,76px);max-width:900px}
.sec-h p{max-width:420px;color:var(--mute)}
.grid{display:grid;gap:18px}
.g3{grid-template-columns:repeat(3,1fr)}.g2{grid-template-columns:repeat(2,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:980px){.g3,.g4{grid-template-columns:repeat(2,1fr)}.g3>:last-child:nth-child(odd),.g4>:last-child:nth-child(odd){grid-column:1/-1}.gal.g3>:nth-child(3){aspect-ratio:16/9!important}}
@media(max-width:640px){.g3,.g2,.g4{grid-template-columns:1fr}}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:30px;transition:transform .5s var(--ease),border-color .4s}
.card:hover{border-color:color-mix(in srgb,var(--ac) 45%,var(--line))}
.card h3{font-size:22px;line-height:1.2;margin-bottom:10px;letter-spacing:-.01em}
.card p{color:var(--mute);font-size:15.5px}
.card .tick{display:block;width:28px;height:2px;background:var(--ac3);margin-bottom:22px;transform-origin:left;transition:transform .5s var(--ease)}
.card:hover .tick{transform:scaleX(1.8)}
.num{font-family:${display};font-size:15px;color:var(--ac);margin-bottom:22px;display:block}
.glow{position:absolute;inset:auto;pointer-events:none;width:420px;height:420px;border-radius:50%;filter:blur(90px);opacity:.28;background:var(--ac2)}
/* marquee */
.marq{border-block:1px solid var(--line);overflow:hidden;padding:22px 0;white-space:nowrap}
.marq .tr{display:inline-flex;animation:mq 60s linear infinite;will-change:transform}
.marq.vel .tr{animation:none}
.marq span{font-size:clamp(22px,3vw,40px);font-weight:600;color:var(--mute);padding-right:56px}
.marq span b{color:var(--ac2);font-weight:inherit;margin-right:56px}
@keyframes mq{to{transform:translateX(-50%)}}
/* story fill: the words are only split (and dimmed) by the script */
.fill{font-size:clamp(28px,4.2vw,58px);line-height:1.18;font-weight:${theme === "editorial" ? 450 : 600};letter-spacing:-.025em}
html.js .fill .w{opacity:.16;transition:opacity .3s}
html.js .fill .w.lit{opacity:1}
.lead{font-size:clamp(26px,3.6vw,48px);line-height:1.2;letter-spacing:-.02em}
/* photos */
.ph{position:relative;overflow:hidden;border-radius:var(--r);background:color-mix(in srgb,var(--ink) 8%,var(--bg))}
.ph img{width:100%;height:100%;object-fit:cover}
.split{display:grid;grid-template-columns:1.05fr 1fr;gap:clamp(28px,5vw,80px);align-items:center}
@media(max-width:880px){.split{grid-template-columns:minmax(0,1fr)}}
/* A long email or street address must wrap, not widen the column past a small phone's edge. */
.split>*{min-width:0}
.info dd,.ft a,.ft p{overflow-wrap:anywhere}
/* services list */
.svl{position:relative}
.svc{position:relative;display:grid;grid-template-columns:1fr 1.2fr;gap:28px;padding:38px 0;border-top:1px solid var(--line);align-items:start}
.svc:last-of-type{border-bottom:1px solid var(--line)}
.svc::before{content:"";position:absolute;left:0;top:-1px;height:1px;width:100%;background:var(--ac);transform:scaleX(0);transform-origin:left;transition:transform .7s var(--ease)}
.svc:hover::before{transform:scaleX(1)}
.svc h3{font-size:clamp(26px,3vw,44px);line-height:1.05;transition:transform .5s var(--ease)}
.svc:hover h3{transform:translateX(10px)}
.svc p{color:var(--mute)}
@media(max-width:760px){.svc{grid-template-columns:1fr;gap:10px}}
/* rail of service panels */
.track{width:min(1240px,100% - 40px);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:18px}@media(max-width:700px){.track{grid-template-columns:1fr}}
.rc{position:relative;display:block;aspect-ratio:4/5;overflow:hidden;border-radius:var(--r);background:radial-gradient(80% 70% at 30% 20%,color-mix(in srgb,var(--ac) 40%,transparent),transparent),var(--deep);color:#fff}
.rc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}
.rc:hover img{transform:scale(1.06)}
.rc::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.72))}
.rc .rt{position:absolute;left:0;right:0;bottom:0;z-index:1;padding:26px}
.rc h3{font-size:clamp(24px,2.4vw,34px);line-height:1.05;margin-bottom:8px}
.rc p{font-size:15px;opacity:.86}
/* stacked service cards */
.stk{display:grid;gap:18px}
.sk{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,4vw,56px);align-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:calc(var(--r) * 1.2);padding:clamp(22px,4vw,48px);box-shadow:0 -20px 60px -40px rgba(0,0,0,.35);transform-origin:50% 0}
.sk h3{font-size:clamp(30px,4vw,60px);line-height:1}
.sk p{color:var(--mute);margin-top:16px;max-width:460px}
.sk>*{min-width:0}
.sk .ph{aspect-ratio:4/3}
@media(max-width:760px){.sk{grid-template-columns:minmax(0,1fr)}}
/* the portal: a photo seen through a window, then stepped into */
.portal .stage{position:relative;min-height:88svh;display:grid;align-items:end;overflow:hidden}
.pframe{position:absolute;inset:0;background:radial-gradient(70% 70% at 30% 30%,color-mix(in srgb,var(--ac) 45%,transparent),transparent),var(--deep)}
.pframe img{width:100%;height:100%;object-fit:cover}
.pframe::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.62))}
.pword{display:none}
.pcopy{position:relative;z-index:2;color:#fff;padding:clamp(40px,8vw,110px) 0}
.pcopy p{font-size:clamp(28px,4.4vw,64px);line-height:1.12;max-width:1000px}
/* steps */
.steps{position:relative}
.step{padding:28px 0;border-top:1px solid var(--line);display:grid;grid-template-columns:120px 1fr;gap:20px}
.step h3{font-size:22px}
.step p{color:var(--mute)}
@media(max-width:640px){.step{grid-template-columns:1fr}}
/* faq */
details.faq{border-top:1px solid var(--line);padding:22px 0}
details.faq:last-child{border-bottom:1px solid var(--line)}
details.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;font-size:19px;font-weight:600}
details.faq summary::-webkit-details-marker{display:none}
details.faq summary i{flex-shrink:0;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-style:normal;transition:transform .35s var(--ease),background .3s}
details.faq[open] summary i{transform:rotate(45deg);background:var(--ac);color:var(--on);border-color:var(--ac)}
details.faq p{color:var(--mute);margin-top:12px;max-width:780px}
/* cta band */
.ctab{position:relative;overflow:hidden;border-radius:calc(var(--r) * 1.4);padding:clamp(48px,8vw,110px) clamp(24px,6vw,80px);background:${theme === "aurora" ? "linear-gradient(140deg,color-mix(in srgb,var(--ac) 22%,var(--bg2)),var(--bg2))" : "var(--ink)"};color:${theme === "aurora" ? "var(--ink)" : "var(--bg)"}}
.ctab h2{font-size:clamp(36px,6vw,92px);max-width:900px}
.ctab p{opacity:.72;max-width:520px;margin:18px 0 30px}
/* reviews */
.rev{break-inside:avoid;margin-bottom:18px}
.stars{color:var(--ac3);letter-spacing:3px;font-size:15px;margin-bottom:14px}
.revs{columns:3;column-gap:18px}
@media(max-width:980px){.revs{columns:2}}@media(max-width:640px){.revs{columns:1}}
/* contact */
.form{display:grid;gap:14px}
.form label{display:grid;gap:7px;font-size:13px;font-weight:600;color:var(--mute)}
.form input,.form textarea{font:inherit;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:calc(var(--r) * .5);padding:15px 16px;min-height:52px;transition:border-color .25s,box-shadow .25s}
.form input:focus,.form textarea:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 4px color-mix(in srgb,var(--ac) 18%,transparent)}
.form .err{display:none;color:#E5484D;font-size:14px}
.thanks{display:none;padding:28px;border:1px solid var(--line);border-radius:var(--r);background:var(--card)}
.info dt{font-size:13px;font-weight:600;color:var(--mute);margin-top:22px}
.info dd{font-size:20px;font-weight:600}
.map{aspect-ratio:16/10;border:0;width:100%;border-radius:var(--r);filter:saturate(.7)}
html[data-mode=dark] .map{filter:invert(.9) hue-rotate(180deg) saturate(.6)}
/* footer */
.ft{padding:70px 0 40px;border-top:1px solid var(--line);margin-top:40px}
.ft .wrap{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}
.ft h4{font-size:13px;font-weight:600;color:var(--mute);margin-bottom:14px}
.ft a,.ft p{display:block;font-size:15px;margin-bottom:8px;color:var(--ink)}
.ft .big{font-size:clamp(40px,8vw,120px);line-height:.9;margin-bottom:20px}
.ft .fine{grid-column:1/-1;font-size:13px;color:var(--mute);border-top:1px solid var(--line);padding-top:22px;margin-top:20px}
@media(max-width:760px){.ft .wrap{grid-template-columns:1fr}}
/* floating pill */
.pill{position:fixed;left:50%;bottom:18px;z-index:40;transform:translate(-50%,140%);transition:transform .6s var(--ease);display:flex;gap:6px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--bg2) 80%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);box-shadow:0 20px 50px -20px rgba(0,0,0,.45)}
.pill.show{transform:translate(-50%,0)}
/* Round buttons inside the round bar, on every design (Bryson, 2026-11-05: on Editorial the square buttons sat inside a
   round bar; "it should look like the dark one where it isnt a square inside of round button but round inside of round"). */
.pill .btn{min-height:46px;padding:0 20px;font-size:14px;border-radius:999px}
.pill .btn.ghost{gap:8px}
.pill .btn.ghost svg{width:16px;height:16px;flex:0 0 auto}
@media(max-width:380px){.pill .btn{padding:0 16px}.pill .btn.ghost{padding:0 15px}.pill .pl-t{display:none}}
.pill .btn.ghost{background:var(--bg2)}
/* page transitions: created by the script, so they never exist without it */
.veil{position:fixed;inset:0;z-index:100;pointer-events:none;background:var(--bg);opacity:0;transition:opacity .45s var(--ease)}
.veil.on{opacity:1}
body[data-tx=curtain] .veil{opacity:1;background:var(--ac);transform:translateY(100%);transition:transform .7s var(--io)}
body[data-tx=curtain] .veil.on{transform:none}
body[data-tx=curtain] .veil.out{transform:translateY(-100%)}
${motionCss()}
${themeCss(theme)}
`;
}

// Everything below exists only under html.mo: the script adds that class, and only when the
// visitor has not asked for less motion. Without it every element sits in its finished place.
// Mind specificity: the hidden states carry body[data-in]/body[data-rv], so every "shown" rule must
// be at least as specific and come later (hence `html.mo body .rv.in`), or nothing ever appears.
function motionCss() {
  return `
/* entrances */
html.mo .hl .ln{display:block;overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}
html.mo .hl .ln>span{display:inline-block}
html.mo body[data-in=rise] .hl .ln>span{transform:translateY(110%);transition:transform 1.3s var(--ease)}
html.mo body[data-in=focus] .hl .ln{overflow:visible}
html.mo body[data-in=focus] .hl .ln>span{opacity:0;filter:blur(18px);transform:scale(1.07);transition:opacity 1.5s var(--ease),filter 1.5s var(--ease),transform 1.8s var(--ease)}
html.mo body[data-in=wipe] .hl .ln>span{clip-path:inset(-20% 100% -20% 0);transform:translateX(-.12em);transition:clip-path 1.4s var(--io),transform 1.4s var(--ease)}
html.mo body[data-in=wipe] .hl.in .ln>span{clip-path:inset(-20% -5% -20% 0)}
html.mo body[data-in=chars] .hl .ch{display:inline-block;opacity:0;transform:translateY(105%) rotate(7deg);transform-origin:0 100%;transition:transform 1.1s var(--ease),opacity .7s var(--ease);transition-delay:calc(var(--i) * 24ms + .1s)}
html.mo body .hl.in .ln>span,html.mo body[data-in=chars] .hl.in .ch{opacity:1;filter:none;transform:none}
html.mo .hl.in .ln:nth-child(2)>span{transition-delay:.12s}
html.mo .hl.in .ln:nth-child(3)>span{transition-delay:.24s}
html.mo .hl .mk{background-size:0% .07em;transition:background-size 1.2s var(--io) .7s}
html.mo .hl.in .mk{background-size:100% .07em}
/* reveals */
html.mo body[data-rv=rise] .rv{opacity:0;transform:translateY(26px);transition:opacity .9s var(--ease),transform 1.1s var(--ease)}
html.mo body[data-rv=soft] .rv{opacity:0;transform:scale(.965);transition:opacity 1.2s var(--ease),transform 1.3s var(--ease)}
html.mo body[data-rv=clip] .rv{opacity:0;transform:translateY(14px);transition:opacity .8s var(--ease),transform .9s var(--ease)}
html.mo body[data-rv=clip] .ph.rv{opacity:1;transform:none;clip-path:inset(100% 0 0 0);transition:clip-path 1.4s var(--io)}
html.mo body[data-rv=clip] .ph.rv.in{clip-path:inset(0 0 0 0)}
html.mo body .rv.in{opacity:1;transform:none}
html.mo body .rv.d1{transition-delay:.08s}html.mo body .rv.d2{transition-delay:.16s}html.mo body .rv.d3{transition-delay:.24s}
html.mo .ph img{transform:scale(1.1);transition:transform 1.6s var(--ease)}
html.mo .ph.in img{transform:scale(1)}
/* the portal */
html.mo .portal{height:300svh}
html.mo .portal .stage{position:sticky;top:0;height:100svh;min-height:0;background:var(--bg);--k:clamp(0,1 - var(--p,0) * 1.75,1);--o:clamp(0,(var(--p,0) - .52) * 3.4,1)}
html.mo .pframe{clip-path:inset(calc(var(--k) * 24%) calc(var(--k) * 31%) round calc(var(--k) * 36px));will-change:clip-path}
html.mo .pframe img{transform:scale(calc(1 + var(--k) * .3))}
html.mo .pword{display:grid;place-items:center;position:absolute;inset:0;z-index:1;padding:0 20px;text-align:center;font-size:clamp(54px,13vw,230px);line-height:.9;color:#fff;mix-blend-mode:difference;pointer-events:none;opacity:var(--k);transform:scale(calc(1.12 - var(--k) * .12))}
html.mo .pcopy{opacity:var(--o);transform:translateY(calc((1 - var(--o)) * 40px))}
/* the rail */
html.mo .rail.on{padding:0}
html.mo .rail.on .stage{position:sticky;top:0;height:100svh;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
html.mo .rail.on .track{display:flex;gap:22px;width:max-content;margin:0;padding-inline:max(20px,(100vw - 1240px) / 2);transform:translate3d(calc(var(--dx,0) * var(--p,0) * -1px),0,0);will-change:transform}
html.mo .rail.on .rc{height:min(60svh,580px);aspect-ratio:4/5;flex:0 0 auto}
/* the stack */
html.mo .stk .sk{position:sticky;top:calc(96px + var(--i) * 18px);margin-bottom:10svh;transform:scale(calc(1 - var(--c,0) * .06));filter:brightness(calc(1 - var(--c,0) * .14))}
html.mo .stk .sk:last-child{margin-bottom:0}
/* steps draw a line as you pass them */
html.mo .steps::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac);transform-origin:top;transform:scaleY(var(--p,0))}
html.mo .steps .step{padding-left:28px}
html.mo [data-tilt]{transition:transform .8s var(--ease)}
@media (prefers-reduced-motion:reduce){
  .marq .tr{animation:none}html.js .fill .w{opacity:1}html{scroll-behavior:auto}.bt>span{transition:none}
}
`;
}

function themeCss(theme) {
  // Cinematic, rebuilt 2026-11-04 (Bryson: "redo one of them the whole layout and animations that way the three
  // templates give three completely different options"). A split screen: their photos stay pinned on one half and change
  // scene by scene, while the story scrolls on the other half. On a phone the photos become a band pinned under the
  // header. Showcase is one big photo with tiles; Editorial is a magazine; this one is told like a film.
  if (theme === "cinematic") return `
.cn{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);position:relative}
.cn-media{position:sticky;top:0;height:100svh;overflow:hidden;background:radial-gradient(70% 60% at 30% 30%,color-mix(in srgb,var(--ac) 45%,transparent),transparent),var(--deep)}
.cn-fr{position:absolute;inset:0}
.cn-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.1);transition:opacity 1.1s var(--ease),transform 2.8s var(--ease)}
.cn-img.on{opacity:1;transform:scale(1)}
.cn-none{background:radial-gradient(60% 50% at 70% 70%,color-mix(in srgb,var(--ac) 55%,transparent),transparent)}
.cn-media::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent 24%,transparent 62%,rgba(0,0,0,.62))}
.cn-cap{position:absolute;z-index:2;left:max(20px,(100vw - 1240px) / 2);right:clamp(20px,3vw,44px);bottom:clamp(22px,4vh,40px);display:flex;align-items:center;gap:18px;color:#fff;font-size:14px;font-weight:600;letter-spacing:.01em}
.cn-lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%}
.cn-bar{flex:1;max-width:240px;height:2px;background:rgba(255,255,255,.28);border-radius:2px;overflow:hidden}
.cn-bar b{display:block;height:100%;background:#fff;transform:scaleX(0);transform-origin:left}
.cn-text{min-width:0;padding:0 max(20px,(100vw - 1240px) / 2) 0 clamp(32px,5.5vw,96px)}
.cn-sc{min-height:86svh;display:flex;flex-direction:column;justify-content:center;padding:110px 0 70px;max-width:600px}
.cn-top .cn-sc:first-child{min-height:100svh}
.cn-sc+.cn-sc{border-top:1px solid var(--line)}
.cn-sc h1{font-size:clamp(42px,4.6vw,84px);margin-top:22px}
.cn-sc h2{font-size:clamp(34px,3.6vw,62px)}
.cn-sc>p{color:var(--mute);margin-top:18px;font-size:clamp(16px,1.3vw,19px);max-width:520px}
.cn-sc .eyebrow+h2{margin-top:16px}
.cn-sc .lead{color:var(--ink);font-size:clamp(24px,2.3vw,36px);line-height:1.22;margin-top:16px}
.cn-sc .go{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px}
.cn-sc .top{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.cn-why{list-style:none;margin-top:26px;display:grid;gap:16px}
.cn-why li{padding-top:16px;border-top:1px solid var(--line)}
.cn-why b{display:block;font-size:18px;letter-spacing:-.01em}
.cn-why span{display:block;color:var(--mute);font-size:15.5px;margin-top:4px}
.cn-ph{display:none}
.rate{display:inline-flex;align-items:center;gap:9px;padding:7px 14px;border-radius:999px;background:var(--bg2);border:1px solid var(--line);font-size:14px;font-weight:700}
.rate .st{color:#F5A524;letter-spacing:1px}.rate small{font-size:13px;font-weight:500;color:var(--mute)}
/* the inside pages open on the same split: a photo on one half, the title on the other */
.cnh{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:74svh}
.cnh-m{position:relative;overflow:hidden;background:radial-gradient(70% 60% at 30% 30%,color-mix(in srgb,var(--ac) 45%,transparent),transparent),var(--deep)}
.cnh-m img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cnh-m::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent 30%)}
.cnh-t{min-width:0;display:flex;flex-direction:column;justify-content:center;padding:120px max(20px,(100vw - 1240px) / 2) 64px clamp(32px,5.5vw,96px)}
.cnh-t h1{font-size:clamp(40px,4.4vw,80px);margin-top:20px}
.cnh-t p.sub{max-width:520px;margin-top:20px;font-size:clamp(16px,1.4vw,19px);color:var(--mute)}
/* the closing card: their photo behind the last word, like the end of a film */
.cn-end{position:relative;isolation:isolate;overflow:hidden;min-height:78svh;display:grid;place-items:center;text-align:center;color:#fff;margin-top:clamp(60px,8vw,110px)}
.cn-end-bg{position:absolute;inset:0;z-index:-1;background:radial-gradient(60% 70% at 50% 40%,color-mix(in srgb,var(--ac) 50%,transparent),transparent),#0B0B0C}
.cn-end-bg img{width:100%;height:100%;object-fit:cover;opacity:.5;transform:scale(calc(1.14 - var(--p,0) * .14))}
.cn-end-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55))}
.cn-end .wrap{padding:90px 0}
.cn-end h2{font-size:clamp(38px,6vw,104px);max-width:1000px;margin:0 auto}
.cn-end p{opacity:.82;max-width:560px;margin:20px auto 32px;font-size:clamp(16px,1.4vw,19px)}
.card{border:1px solid var(--line);box-shadow:none}
.card:hover{border-color:color-mix(in srgb,var(--ac) 55%,transparent)}
.ctab{background:radial-gradient(70% 120% at 90% 0%,color-mix(in srgb,var(--ac) 38%,transparent),transparent),var(--bg2);color:var(--ink);border:1px solid var(--line)}
.ctab .glow{display:none}
@media(min-width:900px){
  /* The scene being told is lit; the others wait, dimmed. Only with motion on: every word is readable without it. */
  html.mo .cn-sc>*:not(.cn-ph){opacity:.16;transform:translateY(22px);transition:opacity .8s var(--ease),transform 1s var(--ease)}
  html.mo .cn-sc.act>*{opacity:1;transform:none}
  html.mo .cn-sc.act>:nth-child(2){transition-delay:.06s}html.mo .cn-sc.act>:nth-child(3){transition-delay:.12s}html.mo .cn-sc.act>:nth-child(4){transition-delay:.18s}
  /* The business name sits over the photo half until the header turns solid. */
  body[data-theme=cinematic] .hd:not(.solid) .brand{color:#fff;text-shadow:0 1px 14px rgba(0,0,0,.35)}
  /* The menu can reach across onto the photo half on a narrower screen, so it sits in a frosted pill that reads on either. */
  body[data-theme=cinematic] .hd:not(.solid) .nav{background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:999px;padding:11px 20px}
}
@media(max-width:899px){
  /* Phone (Bryson, 2026-11-04: "it's still tight I think we need to change up the design a bit when scrolling"). A
     photo pinned at the top of a phone always ate a third of the screen, so on a phone there is no pinned photo: each
     scene is its own full-width photo, opening like a film frame as it scrolls in, with its words underneath and room
     to breathe. Computers keep the split screen. */
  .cn{display:block;padding-top:76px}
  .cn-media{display:none}
  .cn-text{padding:0 22px}
  .cn-sc,.cn-top .cn-sc:first-child{min-height:0;padding:0 0 64px;max-width:none}
  .cn-sc+.cn-sc{border-top:0}
  .cn-ph{display:block;position:relative;margin:0 -22px 26px;aspect-ratio:4/3;overflow:hidden;background:var(--deep)}
  .cn-top .cn-sc:first-child .cn-ph{aspect-ratio:16/9}
  .cn-ph img{width:100%;height:100%;object-fit:cover}
  /* Tied to the scroll, not a one-off (Bryson: "make sure when I scroll up the pictures close as well"): --o runs from
     0 as a photo's top enters at the bottom of the screen to 1 by the middle, set every frame by phUpd, so scrolling
     back up closes it again in step with the finger. */
  html.mo .cn-ph{--k:calc(1 - var(--o,0));clip-path:inset(calc(var(--k) * 34%) 0 calc(var(--k) * 34%) 0)}
  html.mo .cn-ph img{transform:scale(calc(1 + var(--k) * .18))}
  html.mo .cn-top .cn-sc:first-child .cn-ph{clip-path:none}html.mo .cn-top .cn-sc:first-child .cn-ph img{transform:none}
  .cn-sc h1{font-size:clamp(32px,8.4vw,46px);margin-top:14px}
  .cn-sc h2{font-size:clamp(27px,7.2vw,40px)}
  .cn-sc .eyebrow+h2{margin-top:12px}
  .cn-sc>p{font-size:16px;margin-top:14px}
  .cn-sc .lead{font-size:clamp(22px,6vw,30px)}
  .cn-why{margin-top:20px;gap:14px}.cn-why b{font-size:17px}
  .cn-sc .go{margin-top:20px}
  .cn-sc .go .btn.ghost{min-height:44px;padding:0;border:0;background:none;color:var(--ink);font-weight:650;gap:8px}
  .cn-sc .go .btn.ghost .bt{border-bottom:2px solid var(--ac3);padding-bottom:3px}
  .cn-sc .go .btn.ghost::after{content:"\\2192";color:var(--ac3)}
  .cn-top .cn-sc:first-child .go .btn.ghost{min-height:52px;padding:0 28px;border:1px solid var(--line)}
  .cn-top .cn-sc:first-child .go .btn.ghost .bt{border:0;padding:0}.cn-top .cn-sc:first-child .go .btn.ghost::after{content:none}
  .cnh{display:block;padding-top:76px;min-height:0}
  .cnh-m{height:30svh}
  .cnh-t{padding:30px 20px 8px}
}
@media (prefers-reduced-motion:reduce){.cn-img{transition:none;transform:none}.cn-end-bg img{transform:none}}
`;
  if (theme === "showcase") return `
.hero.sc{min-height:max(640px,100svh);color:#fff}
.hero.sc .scbg{position:absolute;inset:0;z-index:-2;overflow:hidden;background:linear-gradient(160deg,color-mix(in srgb,var(--ac) 70%,#111),#111)}
.hero.sc .scbg img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);transition:transform 2.4s var(--ease)}
html.mo .hero.sc .scbg img{animation:scz 2.4s var(--ease) both}
@keyframes scz{from{transform:scale(1.14)}to{transform:scale(1.06)}}
.hero.sc::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(8,9,11,.55) 0%,rgba(8,9,11,.15) 34%,rgba(8,9,11,.35) 58%,rgba(8,9,11,.86) 100%)}
.disp .pn{margin-left:-.07em}
.hero.sc .copy{width:min(1240px,100% - 40px);padding:150px 0 clamp(48px,8vh,84px);margin-inline:auto}
.hero.sc h1{font-size:clamp(44px,7.6vw,118px);line-height:.98;max-width:1050px;text-shadow:0 2px 30px rgba(0,0,0,.25)}
.hero.sc p.sub{color:rgba(255,255,255,.86);max-width:560px}
.hero.sc .eyebrow{color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:999px;padding:7px 14px 7px 12px}
.hero.sc .btn.ghost{color:#fff;border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.06);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.hero.sc .btn.ghost:hover{border-color:#fff}
.hero.sc .top{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.rate{display:inline-flex;align-items:center;gap:9px;padding:7px 14px;border-radius:999px;background:#fff;color:#111214;font-size:14px;font-weight:700;box-shadow:0 10px 30px -12px rgba(0,0,0,.45)}
.rate .st{color:#F5A524;letter-spacing:1px}.rate small{font-size:13px;font-weight:500;color:#5E6166}
body[data-page="home"] .hd:not(.solid){color:#fff}
body[data-page="home"] .hd:not(.solid) .nav a{color:rgba(255,255,255,.82)}
body[data-page="home"] .hd:not(.solid) .nav a:hover,body[data-page="home"] .hd:not(.solid) .nav a[aria-current]{color:#fff}
body[data-page="home"] .hd:not(.solid) .burger{border-color:rgba(255,255,255,.35);color:#fff}
.bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(220px,24vw);gap:14px}
.bento a{position:relative;display:block;overflow:hidden;border-radius:var(--r);background:var(--bg2);isolation:isolate;color:#fff;min-height:220px}
.bento a:first-child{grid-column:span 2;grid-row:span 2}
.bento a:nth-child(2),.bento.n3 a:nth-child(3){grid-column:span 2}
.bento.n1 a:first-child{grid-column:1/-1;grid-row:span 2}.bento.n2 a{grid-column:span 2;grid-row:span 2}
.bento img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform 1s var(--ease)}
.bento a::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 35%,rgba(8,9,11,.82))}
.bento a.np{color:var(--ink);border:1px solid var(--line)}.bento a.np::after{display:none}
.bento .bt2{position:absolute;left:0;right:0;bottom:0;padding:22px 24px}
.bento h3{font-size:clamp(20px,2vw,30px);line-height:1.1;letter-spacing:-.02em}
.bento p{font-size:14.5px;opacity:.86;margin-top:8px;max-width:420px}
.bento .go{position:absolute;top:18px;right:18px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.16);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:transform .5s var(--ease),background .3s}
@media(hover:hover){.bento a:hover img{transform:scale(1.05)}.bento a:hover .go{transform:rotate(-45deg);background:var(--ac)}}
@media(max-width:980px){.bento{grid-template-columns:repeat(2,1fr);grid-auto-rows:240px}.bento a:first-child,.bento.n2 a,.bento.n4 a:last-child{grid-column:span 2;grid-row:span 1}.bento a:nth-child(2),.bento.n3 a:nth-child(3),.bento.n2 a:nth-child(2){grid-column:span 1}.bento.n2 a:nth-child(2){grid-column:span 2}}
@media(max-width:640px){.bento{grid-template-columns:1fr;grid-auto-rows:260px}.bento a,.bento a:first-child,.bento a:nth-child(2),.bento.n2 a,.bento.n3 a:nth-child(3),.bento.n4 a:last-child{grid-column:auto;grid-row:auto}}
.card{box-shadow:0 1px 2px rgba(17,18,20,.04),0 18px 40px -30px rgba(17,18,20,.25)}
.ctab{background:linear-gradient(150deg,#16171A,#24262B)}
`;
  // Editorial, rebuilt 2026-11-04 (Bryson: "I like cinematic now I want to make editorial look better"). A magazine: a
  // cover (one huge serif headline across the page, a short intro, a wide photo with a caption), services as a table of
  // contents whose photo follows the pointer, the story as a feature spread with a drop cap, "why us" in newspaper
  // columns, the review as a pull quote. Its motion is quiet on purpose: rules draw themselves in, photos open like a
  // page being turned. Showcase is the big-photo one, Cinematic the film; this one is read.
  if (theme === "editorial") return `
.card{background:none;border:0;border-top:1px solid var(--ink);border-radius:0;box-shadow:none;padding:20px 0 0}
.card .tick{display:none}
.card h3{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:24px;letter-spacing:-.01em}
.sec-h{border-top:1px solid var(--line);padding-top:26px}
.ctab{border-radius:0;background:var(--bg2);color:var(--ink);border-top:3px solid var(--ink);border-bottom:1px solid var(--line);box-shadow:none}
.ctab .glow{display:none}
.ctab p{opacity:1;color:var(--mute)}
.rule{height:1px;background:var(--ink);transform-origin:left}
.fill{font-family:'Playfair Display',Georgia,serif;letter-spacing:-.01em}
html.mo .rule{transform:scaleX(0);transition:transform 1.4s var(--ease)}
html.mo .rule.in{transform:scaleX(1)}
/* the cover */
.edh{padding:118px 0 0}
.edh-meta{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px 16px;padding-bottom:14px;font-size:14px;color:var(--mute)}
.edh-rt{color:var(--ink);font-weight:600}.edh-rt b{color:#E0A100;letter-spacing:1px;margin-right:6px}
.edh h1{font-size:clamp(48px,8vw,138px);line-height:.95;margin-top:30px;max-width:1200px}
.edh-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:end;margin-top:34px}
.edh-lead{font-size:clamp(17px,1.45vw,21px);color:var(--mute);max-width:560px;line-height:1.55}
.edh .acts{display:flex;flex-wrap:wrap;gap:12px}
.edh-fig{margin-top:clamp(36px,5vw,64px)}
.edh-fig .ph{aspect-ratio:21/9;border-radius:2px}
.edh-fig figcaption,.ed-fig figcaption{margin-top:12px;font-size:13px;color:var(--mute);display:flex;gap:10px;align-items:center}
.edh-fig figcaption::before,.ed-fig figcaption::before{content:"";width:22px;height:1px;background:var(--ink)}
/* photos open top to bottom, like a page being turned (starting 22% open: a fully shut photo never counts as seen) */
html.mo .edh-fig .ph,html.mo .ed-fig .ph{clip-path:inset(0 0 78% 0);transition:clip-path 1.6s var(--io) .15s}
html.mo .edh-fig .ph.in,html.mo .ed-fig .ph.in{clip-path:inset(0 0 0 0)}
/* section heads: a title on a drawn rule */
.ed-sec{padding:clamp(70px,9vw,130px) 0 0}
.ed-sh{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px 20px;padding-bottom:16px}
.ed-sh h2{font-size:clamp(32px,4.4vw,64px)}
.ed-sh span{color:var(--mute);font-size:14px}
/* services: a table of contents */
.ed-idx{position:relative}
.ed-row{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) 48px;gap:28px;align-items:center;padding:30px 0;border-bottom:1px solid var(--line)}
.ed-row h3{font-size:clamp(28px,3.4vw,52px);font-weight:500;line-height:1.05;letter-spacing:-.01em;transition:transform .55s var(--ease),color .3s}
.ed-row p{color:var(--mute);font-size:16px}
.ed-go{justify-self:end;width:46px;height:46px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;transition:transform .5s var(--ease),background .3s,border-color .3s,color .3s}
.ed-go svg{width:18px;height:18px}
.ed-th{display:none}
@media(hover:hover){.ed-row:hover h3{transform:translateX(14px);color:var(--ac3)}.ed-row:hover .ed-go{background:var(--ac);border-color:var(--ac);color:var(--on);transform:rotate(-45deg)}}
/* the story: a feature spread */
.ed-feat{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,80px);align-items:start;margin-top:clamp(28px,4vw,48px)}
.ed-fig .ph{aspect-ratio:4/5;border-radius:2px}
.ed-big{font-size:clamp(28px,3.3vw,50px);line-height:1.2;font-weight:450;letter-spacing:-.01em}
.ed-cols{display:grid;grid-template-columns:repeat(var(--c,1),minmax(0,1fr));gap:0 44px;max-width:var(--mw,560px);margin-top:34px;color:var(--mute);font-size:16.5px;line-height:1.7}
.ed-cols p+p{border-left:1px solid var(--line);padding-left:44px;margin-left:-22px}
/* a drop cap only on a paragraph long enough to wrap around it */
.ed-cols p.dc::first-letter{float:left;font-family:'Playfair Display',Georgia,serif;font-size:4.3em;line-height:.8;padding:7px 10px 0 0;color:var(--ink)}
.ed-feat .go{margin-top:30px}
/* why us: newspaper columns */
.ed-why{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));margin-top:clamp(28px,4vw,44px)}
.ed-why>div{padding:4px 28px 0;border-left:1px solid var(--line)}
.ed-why>div:first-child{padding-left:0;border-left:0}
.ed-why h3{font-family:'Playfair Display',Georgia,serif;font-size:clamp(22px,2vw,28px);font-weight:600;line-height:1.2;margin-bottom:10px}
.ed-why p{color:var(--mute);font-size:16px}
/* the review: a pull quote */
.rvt p.disp{font-weight:450;letter-spacing:0;line-height:1.3}
.rvt .wrap::before{content:"\\201C";display:block;font-family:'Playfair Display',Georgia,serif;font-size:150px;line-height:.62;color:var(--ac3);margin-bottom:4px}
/* the strip: an italic ticker */
.marq span{font-family:'Playfair Display',Georgia,serif;font-weight:500}
/* inside pages */
.page-hero{min-height:0}
.page-hero .copy{padding:150px 0 44px;border-bottom:1px solid var(--ink)}
@media(max-width:880px){
  .edh{padding-top:104px}
  .edh h1{font-size:clamp(40px,11vw,64px);margin-top:22px}
  .edh-row{grid-template-columns:minmax(0,1fr);gap:22px;margin-top:22px}
  .edh-fig .ph{aspect-ratio:4/3}
  .ed-row{grid-template-columns:64px minmax(0,1fr) 36px;gap:4px 16px;padding:18px 0}
  .ed-row.np{grid-template-columns:minmax(0,1fr) 36px}
  .ed-th{display:block;width:64px;height:64px;object-fit:cover;border-radius:2px;grid-row:1 / span 2}
  .ed-row h3{font-size:clamp(22px,6.4vw,28px);align-self:end}
  .ed-row p{grid-column:-3 / -2;font-size:14.5px;line-height:1.45}
  .ed-go{grid-column:-2 / -1;grid-row:1 / span 2;width:36px;height:36px}
  .ed-feat{grid-template-columns:minmax(0,1fr)}
  .ed-cols{grid-template-columns:minmax(0,1fr)}.ed-cols p+p{border-left:0;padding-left:0;margin:14px 0 0}
  .ed-why{grid-template-columns:minmax(0,1fr)}
  .ed-why>div{border-left:0;padding:20px 0 0;border-top:1px solid var(--line);margin-top:20px}
  .ed-why>div:first-child{border-top:0;margin-top:0;padding-top:0}
  .page-hero .copy{padding:120px 0 32px}
}
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

// ── The 3D backdrop. Plain WebGL1, no library. One small shader per trade; the Cinematic design
// looks at it through a glass sphere that tilts toward the pointer.
const GL_HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R;uniform float T;uniform vec2 M;uniform vec3 A;uniform vec3 B;uniform vec3 C;uniform vec3 D;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return v;}
`;
const GL_FIELDS = {
  liquid: `vec3 field(vec2 uv,float t){vec2 p=uv*2.2;float q=fb(p+vec2(t*.05,-t*.03));float r=fb(p+q*1.8+vec2(-t*.04,t*.06));vec3 c=mix(A,B,smoothstep(.15,.85,r));return mix(c,C,smoothstep(.55,.95,fb(p*1.4+r-t*.02))*.75);}`,
  water: `vec2 h2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float vo(vec2 p,float t){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=h2(i+g);o=.5+.42*sin(t*.5+6.2831*o);float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}}return d2-d1;}
vec3 field(vec2 uv,float t){vec2 p=uv*vec2(R.x/R.y,1.)*3.;p+=.35*vec2(fb(p*.7+t*.06),fb(p*.7-t*.05+4.));
float l=(1.-smoothstep(0.,.2,vo(p,t)))*.7+(1.-smoothstep(0.,.12,vo(p*1.7+5.3,t*1.3)))*.35;
vec3 c=mix(A,B,clamp(uv.y*.75+fb(p*.4+t*.02)*.45,0.,1.));return c+C*l*.5;}`,
  chrome: `float mf(vec2 p,float t){float f=0.;for(int i=0;i<5;i++){float k=float(i);vec2 c=vec2(sin(t*(.21+k*.037)+k*2.1)*.4*R.x/R.y,cos(t*(.17+k*.041)+k*1.37)*.28);f+=(.016+.005*k)/dot(p-c,p-c);}return f;}
vec3 env(vec3 r){vec3 sky=mix(B,C,smoothstep(0.,.75,r.y));vec3 gr=mix(B*.45,A,smoothstep(0.,.6,-r.y));vec3 c=mix(gr,sky,smoothstep(-.02,.02,r.y));return c+D*(1.-smoothstep(0.,.05,abs(r.y-.3)))*.6;}
vec3 field(vec2 uv,float t){vec2 a=vec2(R.x/R.y,1.);vec2 p=(uv-.5)*a;float e=.003;
float f=mf(p,t);float H=1.-exp(-(f-1.)*.45);float hx=1.-exp(-(mf(p+vec2(e,0.),t)-1.)*.45);float hy=1.-exp(-(mf(p+vec2(0.,e),t)-1.)*.45);
vec3 nr=normalize(vec3(-(hx-H)/e+(fb(p*2.5+t*.05)-.5)*1.6,-(hy-H)/e+(fb(p*2.5-t*.04+3.)-.5)*1.6,3.));vec3 m=env(reflect(vec3(0.,0.,-1.),nr));m=mix(m,D,pow(1.-nr.z,3.)*.3);
vec3 bg=mix(A,mix(A,B,.35),uv.y)+(fb(p*2.+t*.03)-.5)*.04;return mix(bg,m,smoothstep(.98,1.12,f));}`,
  silk: `float f2(vec2 p){return n(p)*.65+n(p*2.03+1.7)*.35;}
float sh(vec2 p,float t){return sin(p.x*1.1+p.y*.35+f2(p*.45+vec2(t*.04,0.))*3.4+t*.12)*.6+sin(p.y*1.4-p.x*.45+f2(p*.6-t*.03)*2.2+t*.08)*.4;}
vec3 field(vec2 uv,float t){vec2 p=uv*vec2(R.x/R.y,1.)*2.4;float e=.01;float s=sh(p,t);
vec3 nr=normalize(vec3(-(sh(p+vec2(e,0.),t)-s)/e*.35,-(sh(p+vec2(0.,e),t)-s)/e*.35,1.));vec3 L=normalize(vec3(-.4,.6,.7));
float df=dot(nr,L)*.5+.5;float sp=pow(max(dot(reflect(-L,nr),vec3(0.,0.,1.)),0.),18.);return mix(A,B,df)+C*sp*.42+D*pow(1.-df,3.)*.08;}`,
  topo: `vec3 field(vec2 uv,float t){vec2 p=uv*vec2(R.x/R.y,1.)*1.6;float v=fb(p+vec2(t*.015,-t*.01))*1.2+fb(p*2.1-t*.02)*.25;float k=v*16.;
float ln=1.-smoothstep(0.,.07,.5-abs(fract(k)-.5));float mj=step(mod(floor(k+.5),5.),.5);
vec3 c=mix(A,B,clamp(v*.8,0.,1.));return mix(c,mix(C,D,mj),ln*(.4+.45*mj));}`,
};
const GL_ORB = `vec2 c=vec2(0.,.02)+M*.04;float rad=.31*min(1.,a.x*.62+.18);vec2 d=p-c;float l=length(d);
float edge=1.-smoothstep(rad-.004,rad,l);vec3 calm=mix(col,A,.45);if(l<rad){float z=sqrt(max(rad*rad-l*l,0.));vec3 nr=normalize(vec3(d,z));vec3 L=normalize(vec3(-.5+M.x*.6,.6+M.y*.4,.8));
float df=max(dot(nr,L),0.);float fr=pow(1.-nr.z,2.4);vec3 inside=field(uv+nr.xy*.22+vec2(.07,0.),T*1.3);
float sp=pow(max(dot(reflect(-L,nr),vec3(0,0,1)),0.),40.);vec3 sph=mix(inside*1.08,vec3(1.),fr*.55)+df*.06+sp*.9;col=mix(calm,sph,edge);}
else{col=calm*(1.-.18*(1.-smoothstep(rad,rad+.12,l)));}`;
export const glShader = (scene, orb) => `${GL_HEAD}${GL_FIELDS[scene] || GL_FIELDS.liquid}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 a=vec2(R.x/R.y,1.);vec2 p=(uv-.5)*a;vec3 col=field(uv+M*.03,T);
${orb ? GL_ORB : "col=mix(col,A,.42*(1.-smoothstep(0.,.62,length(p*vec2(.75,1.25)))));"}float g=h(gl_FragCoord.xy+fract(T))*.03;gl_FragColor=vec4(col+g-.015,1.);}`;

function glScript(P, theme, scene) {
  if (!P.gl || !scene) return "";
  const v = (h) => hexRgb(h).map((x) => (x / 255).toFixed(3)).join(",");
  return `(function(){var c=document.querySelector('.hero canvas');if(!c)return;
var mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;var nv=navigator||{};
if(mq||(nv.connection&&nv.connection.saveData)||(nv.deviceMemory&&nv.deviceMemory<4))return;
function go(){var g=c.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'});if(!g)return;
function sh(t,s){var o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);return o;}
var pr=g.createProgram();g.attachShader(pr,sh(g.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
g.attachShader(pr,sh(g.FRAGMENT_SHADER,${JSON.stringify(glShader(scene, theme === "cinematic"))}));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))return;g.useProgram(pr);
var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);
var lp=g.getAttribLocation(pr,'p');g.enableVertexAttribArray(lp);g.vertexAttribPointer(lp,2,g.FLOAT,false,0,0);
var U=function(n){return g.getUniformLocation(pr,n);};g.uniform3f(U('A'),${v(P.gl[0])});g.uniform3f(U('B'),${v(P.gl[1])});g.uniform3f(U('C'),${v(P.gl[2])});g.uniform3f(U('D'),${v(P.accent)});
var dpr=Math.min(window.devicePixelRatio||1,1.5),mx=0,my=0,tx=0,ty=0,vis=true,t0=performance.now(),n=0,slow=0,lt=0,dead=false;
function sz(){var w=c.clientWidth,h=c.clientHeight,k=dpr*.75;if(w*h*k*k>1500000)k=Math.sqrt(1500000/(w*h));c.width=Math.max(1,w*k|0);c.height=Math.max(1,h*k|0);g.viewport(0,0,c.width,c.height);g.uniform2f(U('R'),c.width,c.height);}
sz();addEventListener('resize',sz);addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5;ty=.5-e.clientY/innerHeight;},{passive:true});
if('IntersectionObserver' in window){new IntersectionObserver(function(es){vis=es[0].isIntersecting;}).observe(c);}
function fr(now){if(dead)return;if(vis&&!document.hidden){if(lt&&n<120){n++;if(now-lt>40)slow++;if(n===120&&slow>60){dead=true;return;}}lt=now;
mx+=(tx-mx)*.04;my+=(ty-my)*.04;g.uniform1f(U('T'),(now-t0)/1000);g.uniform2f(U('M'),mx,my);g.drawArrays(g.TRIANGLE_STRIP,0,4);}else{lt=0;}requestAnimationFrame(fr);}
requestAnimationFrame(function(t){fr(t);c.classList.add('on');});}
(window.requestIdleCallback||function(f){setTimeout(f,400);})(go);})();`;
}

// Everything that moves. Shipped verbatim to the client's domain, so: no comments, and nothing
// that only a modern build tool understands.
// A refresh always opens at the top (Bryson, 2026-11-04: "When I refresh it starts here make sure it starts at the top");
// a link to a section (#s2) still lands on it.
function motionScript(cl, recipe) {
  const M = JSON.stringify({ e: recipe.entrance, m: recipe.marquee, c: !!recipe.cursor }).replace(/</g, "\\u003c");
  return `(function(){var d=document,h=d.documentElement;h.classList.add('js');
var PREVIEW=String(location.href).indexOf('about:')===0;
try{if('scrollRestoration' in history)history.scrollRestoration='manual';if(!location.hash)scrollTo(0,0);}catch(x){}
try{var M=${M};
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine=window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches;
var nv=navigator||{},lite=!!(nv.connection&&nv.connection.saveData);
if(!rm)h.classList.add('mo');
function q(s,r){return [].slice.call((r||d).querySelectorAll(s));}
function cl(x,a,b){return x<a?a:x>b?b:x;}
if(!rm&&M.e==='chars'){q('.hl').forEach(function(t){t.setAttribute('aria-label',t.textContent.trim());var i=0;q('.ln>span',t).forEach(function(s){s.setAttribute('aria-hidden','true');s.innerHTML=s.textContent.split(/(\\s+)/).map(function(w){if(/^\\s+$/.test(w))return ' ';return '<span style="display:inline-block;white-space:nowrap">'+(w.match(/.[.,!?;:)]*/g)||[]).map(function(ch){return '<span class="ch" style="--i:'+(i++)+'">'+ch.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/^(.)([.,!?;:)]+)$/,'$1<span class="pn">$2</span>')+'</span>';}).join('')+'</span>';}).join('');});});}
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.12}):null;
q('.rv,.hl,.ph,.rule').forEach(function(el){if(io)io.observe(el);else el.classList.add('in');});
var fl=q('.fill');fl.forEach(function(p){p.innerHTML=p.textContent.trim().split(/\\s+/).map(function(w){return '<span class="w">'+w.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span> ';}).join('');});
var sc=q('[data-scene]'),sk=q('.stk .sk'),rails=q('.rail');
function measure(){rails.forEach(function(r){var tr=r.querySelector('.track'),on=!rm&&innerWidth>=900&&r.querySelectorAll('.rc').length>=5;r.classList.toggle('on',on);if(!on){r.style.height='';return;}var dx=Math.max(0,tr.scrollWidth-innerWidth);if(dx<innerWidth*.4){r.classList.remove('on');r.style.height='';return;}r.style.setProperty('--dx',dx);r.style.height=(innerHeight+dx)+'px';});}
function upd(){var vh=innerHeight;sc.forEach(function(el){var r=el.getBoundingClientRect(),p;if(el.getAttribute('data-scene')==='pass'){p=(vh*.8-r.top)/Math.max(1,r.height);}else{p=-r.top/Math.max(1,r.height-vh);}el.style.setProperty('--p',cl(p,0,1).toFixed(4));});
for(var i=0;i<sk.length-1;i++){var a=sk[i].getBoundingClientRect(),b=sk[i+1].getBoundingClientRect();sk[i].style.setProperty('--c',cl(1-(b.top-a.top)/Math.max(1,a.height),0,1).toFixed(3));}
fl.forEach(function(p){var r=p.getBoundingClientRect(),ws=p.querySelectorAll('.w');var k=cl((vh*.85-r.top)/(r.height+vh*.35),0,1);var m=Math.round(k*ws.length);for(var j=0;j<ws.length;j++)ws[j].classList.toggle('lit',rm||j<m);});}
var hd=d.querySelector('.hd'),pill=d.querySelector('.pill'),last=0,tk=false;
var cns=q('[data-cn]').map(function(s){return {s:s,sc:q('.cn-sc',s),im:q('.cn-img',s),lb:s.querySelector('.cn-lbl'),bar:s.querySelector('.cn-bar b'),k:0};});
function cnUpd(){var vh=innerHeight,ln=innerWidth<900?vh*.62:vh*.5;cns.forEach(function(c){var k=0;for(var i=0;i<c.sc.length;i++){if(c.sc[i].getBoundingClientRect().top<ln)k=i;}
if(k!==c.k){c.sc[c.k].classList.remove('act');c.sc[k].classList.add('act');for(var j=0;j<c.im.length;j++)c.im[j].classList.toggle('on',j===k);if(c.lb)c.lb.textContent=c.sc[k].getAttribute('data-l')||'';c.k=k;}
if(c.bar){var R=c.s.getBoundingClientRect();c.bar.style.transform='scaleX('+cl(-R.top/Math.max(1,R.height-vh),0,1).toFixed(3)+')';}});}
var cph=q('.cn-ph');
function phUpd(){if(rm||!cph.length||innerWidth>=900)return;var vh=innerHeight;for(var i=0;i<cph.length;i++){var r=cph[i].getBoundingClientRect();if(r.bottom<-60||r.top>vh+60)continue;cph[i].style.setProperty('--o',cl((vh-r.top)/(vh*.5),0,1).toFixed(3));}}
function frame(){tk=false;var y=scrollY;cnUpd();phUpd();if(hd){hd.classList.toggle('solid',y>30);hd.classList.toggle('hide',y>last&&y>420);}last=y;if(pill)pill.classList.toggle('show',y>innerHeight*.6);upd();}
function onScroll(){if(!tk){tk=true;requestAnimationFrame(frame);}}
measure();frame();addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',function(){measure();onScroll();});addEventListener('load',function(){measure();onScroll();});
var mqe=d.querySelector('.marq');if(mqe&&!rm&&M.m==='velocity'){mqe.classList.add('vel');var tr=mqe.querySelector('.tr'),x=0,v=0,ly=scrollY,mv=true;
if('IntersectionObserver' in window)new IntersectionObserver(function(es){mv=es[0].isIntersecting;}).observe(mqe);
(function lp(){if(mv&&!d.hidden){var y=scrollY;v+=((y-ly)-v)*.12;ly=y;var w=tr.scrollWidth/2||1;x-=.55+Math.min(Math.abs(v),60)*.18;if(-x>w)x+=w;tr.style.transform='translate3d('+x+'px,0,0) skewX('+cl(-v*.12,-7,7)+'deg)';}requestAnimationFrame(lp);})();}
if(fine&&!rm){h.classList.add('fine');
q('.card,[data-tilt]').forEach(function(c){c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform='perspective(1000px) rotateX('+(-y*5)+'deg) rotateY('+(x*7)+'deg)';});c.addEventListener('pointerleave',function(){c.style.transform='';});});
if(!lite){var ld=function(){var s=d.createElement('script');s.src='${LENIS.src}';s.integrity='${LENIS.sri}';s.crossOrigin='anonymous';s.onload=function(){try{if(window.Lenis)new window.Lenis({autoRaf:true,anchors:true,lerp:.1});}catch(x){}};d.head.appendChild(s);};
if(d.readyState==='complete')setTimeout(ld,300);else addEventListener('load',function(){setTimeout(ld,300);});}}
var mb=d.querySelector('.burger'),mn=d.querySelector('.mnav');if(mb&&mn){mb.addEventListener('click',function(){mn.classList.add('open');});q('.close,a',mn).forEach(function(a){a.addEventListener('click',function(){mn.classList.remove('open');});});}
var vl=null,ss=null;try{ss=window.sessionStorage;}catch(x){}
if(!rm){vl=d.createElement('div');vl.className='veil';vl.setAttribute('aria-hidden','true');d.body.appendChild(vl);
var came=false;try{came=!!(ss&&ss.getItem('blv'));if(ss)ss.removeItem('blv');}catch(x){}
if(came){vl.style.transition='none';vl.classList.add('on');void vl.offsetWidth;vl.style.transition='';requestAnimationFrame(function(){vl.classList.remove('on');vl.classList.add('out');});}}
d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var pg=a.getAttribute('data-page');
if(PREVIEW){e.preventDefault();if(pg&&window.parent){try{window.parent.postMessage({blSitePage:pg},'*');}catch(x){}}return;}
if(pg&&vl&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&a.target!=='_blank'&&a.href.split('#')[0]!==location.href.split('#')[0]){e.preventDefault();try{if(ss)ss.setItem('blv','1');}catch(x){}
vl.style.transition='none';vl.classList.remove('out','on');void vl.offsetWidth;vl.style.transition='';vl.classList.add('on');setTimeout(function(){location.href=a.href;},560);}});
addEventListener('pageshow',function(e){if(e.persisted&&vl){vl.classList.remove('on');vl.classList.add('out');}});
}catch(err){h.classList.remove('js','mo');var vv=d.querySelector('.veil');if(vv)vv.parentNode.removeChild(vv);}
${formScript(cl)}})();`;
}

function formScript(cl) {
  const token = encodeURIComponent((cl && cl.leadToken) || "");
  // A site handed over to a client who bought it outright (KB demo-sites) cannot depend on our lead intake, so its
  // form opens the visitor's own email app addressed to the business instead (`__mailto`, set only by site-export).
  const mailto = String((cl && cl.__mailto) || "").replace(/[^A-Za-z0-9@._+-]/g, "");
  return `var MAILTO=${JSON.stringify(mailto)};var f=d.getElementById('sf');if(f){f.addEventListener('submit',function(e){e.preventDefault();
var b=f.querySelector('button'),er=f.querySelector('.err'),ph=f.ph.value.trim(),em=f.em.value.trim();
if(!ph&&!em){er.textContent='Please add a phone number or an email so we can reach you.';er.style.display='block';return;}
er.style.display='none';b.disabled=true;var lbl=b.textContent;b.textContent='Sending...';
var p={name:f.nm.value,phone:ph,email:em,source:'website',message:f.msg?f.msg.value:'',smsConsentTransactional:false,smsConsentMarketing:false};
try{p.page=location.href.split('#')[0];var q=new URLSearchParams(location.search);['gclid','wbraid','gbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){var v=q.get(k);if(v)p[k]=v;});}catch(x){}
function done(){f.style.display='none';d.getElementById('sthx').style.display='block';}
if(PREVIEW){done();return;}
if(MAILTO){location.href='mailto:'+MAILTO+'?subject='+encodeURIComponent('New enquiry from your website')+'&body='+encodeURIComponent('Name: '+p.name+'\\nPhone: '+ph+'\\nEmail: '+em+(p.message?'\\n\\n'+p.message:''));done();return;}
fetch('/lead?token=${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(function(r){if(!r.ok)throw 0;done();})
.catch(function(){er.textContent='Something went wrong, please try again or call us.';er.style.display='block';b.disabled=false;b.textContent=lbl;});});}`;
}

// ── Page pieces ───────────────────────────────────────────────────────────────────────────
// The main button, wherever it appears: to the quote form, the Book page, the booking system the business
// already uses, or its phone (./booking.mjs intakeOf). Their own booking address is one he typed in, so it
// renders; it is always absolute https, never relative.
const ctaBtn = (C, base, cls = "btn") => {
  const I = C.intake || { how: "quote" };
  if (I.how === "link") return `<a href="${esc(I.link)}" class="${cls}" target="_blank" rel="noopener">${bt(I.label)}</a>`;
  if (I.how === "call") return `<a href="tel:${esc(digits(I.phone))}" class="${cls}">${bt(I.label)}</a>`;
  if (I.how === "book") return linkTo(base, "book", bt(I.label), cls);
  return linkTo(base, "contact", bt(C.cta.button), cls);
};
// Button text that rolls up to a copy of itself on hover. The copy is CSS-only and silent to
// screen readers.
const bt = (t) => `<span class="bt"><span data-t="${esc(t)}">${esc(t)}</span></span>`;
const pathOf = (id) => { const p = pageById(id); if (p) return p.path; if (id === "blog") return "blog"; if (id === "book") return "book"; if (/^x-[a-z0-9-]+$/.test(String(id))) return String(id).slice(2); return ""; };
const href = (base, id) => { const path = pathOf(id); return `${base}/${path ? path + "/" : ""}`; };
const postHref = (base, slug) => `${base}/blog/${encodeURIComponent(slug)}/`;
const linkTo = (base, id, inner, cls = "", extra = "") => `<a href="${esc(href(base, id))}" data-page="${id}"${cls ? ` class="${cls}"` : ""}${extra}>${inner}</a>`;

// Cinematic's headlines sit in a half-width column, so they wrap where the words fall rather than in fixed thirds
// (fixed thirds left "in" alone on a line on a phone).
const oneLine = (text) => `<span class="ln"><span>${esc(text)}</span></span>`;
function lines(text, theme) {
  // Splits a headline into up to three lines for the staggered entrance.
  const words = String(text).split(/\s+/).filter(Boolean);
  const per = Math.ceil(words.length / Math.min(3, Math.max(1, Math.ceil(words.length / 3))));
  const out = [];
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(" "));
  // Joined with a space: without the script the lines sit inline, and "better.Feel" would run together.
  // Trailing punctuation in its own tag, so a design can tuck it in (Showcase's heavy display face leaves "d ." gaps).
  const inner = out.map((l) => `<span class="ln"><span>${theme === "showcase" ? esc(l).replace(/([^\s.,!?;:)])([.,!?;:)]+)(?=\s|$)/g, '$1<span class="pn">$2</span>') : esc(l)}</span></span>`).join(" ");
  // Editorial underlines its last word with a line that draws itself in.
  return theme === "editorial" ? inner.replace(/(\s|<span>)([^\s<]+)<\/span><\/span>$/, (m, pre, last) => `${pre}<span class="mk">${last}</span></span></span>`) : inner;
}

function header(cl, base, pageId, C, pages = SITE_PAGES) {
  const logo = logoOf(cl);
  // The top bar stays readable: extra pages join it only while it holds seven links or fewer; past that
  // they live in the menu and the footer, which always list every page.
  const top = (pages.length <= 7 ? pages : pages.filter((p) => !p.extra)).filter((p) => p.nav !== false);
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  return `<header class="hd${top.length > 5 ? " many" : ""}"><div class="wrap">
${linkTo(base, "home", `${logo ? `<img src="${esc(logo)}" alt="" width="34" height="34">` : ""}<span>${esc(C.name)}</span>`, "brand")}
<nav class="nav" aria-label="Main">${top.map((p) => linkTo(base, p.id, esc(p.label), "", p.id === pageId ? ' aria-current="page"' : "")).join("")}</nav>
${phone && C.intake && C.intake.how !== "call" ? `<a class="hph" href="tel:${esc(digits(phone))}">${esc(phone)}</a>` : ""}${ctaBtn(C, base)}
<button class="burger" aria-label="Open menu"><span></span><span></span></button>
</div></header>
<div class="mnav" role="dialog" aria-label="Menu"><button class="burger close" aria-label="Close menu"><span style="transform:translateY(3px) rotate(45deg)"></span><span style="transform:translateY(-3px) rotate(-45deg)"></span></button>
${pages.map((p) => linkTo(base, p.id, esc(p.label))).join("")}
${phone ? `<a href="tel:${esc(digits(phone))}">${esc(phone)}</a>` : ""}</div>`;
}

// A payment link of the business's own (PayPal, Venmo, a Square or Stripe link). Only set on files handed over to a
// client who bought the site outright (own-site-setup.mjs); hosted sites take payment through their Book page.
const payLinkOf = (cl) => (/^https:\/\/[^\s"'<>]+$/.test(String((cl && cl.__payLink) || "")) ? cl.__payLink : "");
function footer(cl, base, C, pages = SITE_PAGES) {
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const email = String((cl && cl.website && cl.website.publicEmail) || "").trim();
  const addr = String((cl && cl.businessAddress) || "").trim();
  return `<footer class="ft"><div class="wrap">
<div><div class="big disp">${esc(C.name)}</div>${C.area ? `<p style="color:var(--mute)">Serving ${esc(C.area)}</p>` : ""}</div>
<div><h4>Pages</h4>${pages.map((p) => linkTo(base, p.id, esc(p.label))).join("")}</div>
<div><h4>Contact</h4>${phone ? `<a href="tel:${esc(digits(phone))}">${esc(phone)}</a>` : ""}${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ""}${payLinkOf(cl) ? `<a href="${esc(payLinkOf(cl))}" target="_blank" rel="noopener">Pay online</a>` : ""}${addr ? `<p>${esc(addr)}</p>` : ""}</div>
<div class="fine">&copy; ${new Date().getFullYear()} ${esc(C.name)}. All rights reserved.</div>
</div></footer>
<div class="pill">${ctaBtn(C, base)}${phone ? `<a class="btn ghost" href="tel:${esc(digits(phone))}" aria-label="Call ${esc(phone)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg><span class="pl-t">Call</span></a>` : ""}</div>`;
}

// The rating chip: only a REAL rating with a real count, never estimated (KB website-builder). From the business's own
// Google profile once linked (gbpStats, saved by gbp-watch), a rating Bryson typed (website.rating), or for a demo
// what the research found.
export function ratingOf(cl) {
  const w = (cl && cl.website) || {};
  const g = cl && cl.gbpStats;
  const pick = w.rating && Number(w.rating.stars) > 0 && Number(w.rating.count) > 0 ? { stars: Number(w.rating.stars), count: Math.round(Number(w.rating.count)), source: String(w.rating.source || "") }
    : g && Number(g.average) > 0 && Number(g.total) > 0 ? { stars: Number(g.average), count: Math.round(Number(g.total)), source: "Google" } : null;
  if (!pick || pick.stars > 5) return null;
  return { stars: Math.round(pick.stars * 10) / 10, count: pick.count, source: /^[A-Za-z ]{0,20}$/.test(pick.source) ? pick.source : "" };
}
const rateChip = (R) => !R ? "" : `<span class="rate"><span class="st" aria-hidden="true">${"&#9733;".repeat(Math.max(1, Math.min(5, Math.round(R.stars))))}</span>${R.stars.toFixed(1)} <small>from ${R.count} ${R.source ? esc(R.source) + " " : ""}review${R.count === 1 ? "" : "s"}</small></span>`;

function heroHome(theme, C, base, photos) {
  const acts = `<div class="acts rv d2">${ctaBtn(C, base)}${linkTo(base, "services", bt(C.cta.explore), "btn ghost")}</div>`;
  if (theme === "showcase") {
    const ph = photos[0];
    return `<section class="hero sc"><div class="scbg">${ph ? `<img src="${esc(ph.url)}" alt="${esc(ph.alt)}" fetchpriority="high">` : ""}</div>
<div class="copy"><div class="top rv"><span class="eyebrow"><i></i>${esc(C.hero.eyebrow)}</span>${rateChip(C.rating)}</div>
<h1 class="disp hl" style="margin-top:22px">${lines(C.hero.headline, theme)}</h1><p class="sub rv d1">${esc(C.hero.sub)}</p>${acts}</div></section>`;
  }
  return `<section class="hero"><div class="fx" style="background:radial-gradient(50% 55% at 70% 65%,color-mix(in srgb,var(--ac) 26%,transparent),transparent),radial-gradient(40% 45% at 20% 30%,color-mix(in srgb,var(--ac) 12%,transparent),transparent),var(--bg)"><canvas aria-hidden="true"></canvas></div>
<div class="wrap copy"><span class="eyebrow rv"><i></i>${esc(C.hero.eyebrow)}</span><h1 class="disp hl" style="margin-top:26px">${lines(C.hero.headline, theme)}</h1>
<p class="sub rv d1">${esc(C.hero.sub)}</p>${acts}</div></section>`;
}

function pageHero(theme, title, sub, eyebrow, ph) {
  if (theme === "cinematic") return `<section class="cnh"><div class="cnh-m" aria-hidden="true">${ph ? `<img src="${esc(ph.url)}" alt="" fetchpriority="high">` : ""}</div>
<div class="cnh-t"><span class="eyebrow rv"><i></i>${esc(eyebrow)}</span><h1 class="disp hl">${oneLine(title)}</h1>${sub ? `<p class="sub rv d1">${esc(sub)}</p>` : ""}</div></section>`;
  const fx = theme === "editorial" ? "" : `<div class="fx" style="background:radial-gradient(50% 60% at 75% 80%,color-mix(in srgb,var(--ac) ${theme === "aurora" ? 26 : 16}%,transparent),transparent),var(--bg)">${theme === "aurora" ? `<canvas aria-hidden="true"></canvas>` : ""}</div>`;
  return `<section class="hero page-hero">${fx}<div class="wrap copy"><span class="eyebrow rv"><i></i>${esc(eyebrow)}</span>
<h1 class="disp hl" style="margin-top:22px">${lines(title, theme)}</h1>${sub ? `<p class="sub rv d1">${esc(sub)}</p>` : ""}</div></section>`;
}

const marquee = (C) => {
  const items = (C.marquee.length ? C.marquee : C.services.map((s) => s.name)).slice(0, 8);
  if (!items.length) return "";
  // The strip slides left by exactly half its length and starts again, so each half has to be wider than the widest
  // screen. Three short services made a half about 1,000px, and on a big monitor the strip visibly ran out and left a
  // blank gap. Repeat the items until a half holds at least twelve, then show that half twice.
  const half = [];
  while (half.length < 12) half.push(...items);
  const row = half.map((t) => `<span><b>&#10022;</b>${esc(t)}</span>`).join("");
  return `<div class="marq" aria-hidden="true"><div class="tr">${row}${row}</div></div>`;
};

const svcCards = (C, base, n) => `<div class="grid ${n === 4 ? "g4" : "g3"}">${C.services.slice(0, n).map((s, i) =>
  `<a class="card rv d${i % 3}" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services"><span class="tick"></span><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p></a>`).join("")}</div>`;

const svcHead = (C) => `<div class="sec-h"><h2 class="disp rv">What we do</h2><p class="rv d1">${esc(C.services.length > 1 ? `${C.services.length} ways we can help.` : "Here's how we can help.")}</p></div>`;

// The home page's one big scroll moment. Each has a plain layout it falls back to.
function servicesSection(scene, C, base, photos) {
  if (scene === "rail") {
    return `<section class="sec rail" data-scene="pin"><div class="stage"><div class="wrap">${svcHead(C)}</div><div class="track">${C.services.slice(0, 6).map((s, i) => {
      const ph = photos.length ? photos[i % photos.length] : null;
      return `<a class="rc rv d${i % 3}" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services">${ph ? `<img src="${esc(ph.url)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async">` : ""}<div class="rt"><h3 class="disp">${esc(s.name)}</h3><p>${esc(s.blurb)}</p></div></a>`;
    }).join("")}</div></div></section>`;
  }
  if (scene === "stack") {
    return `<section class="sec"><div class="wrap">${svcHead(C)}<div class="stk">${C.services.slice(0, 6).map((s, i) => {
      const ph = photos.length ? photos[i % photos.length] : null;
      return `<article class="sk" style="--i:${i}"><div><h3 class="disp">${esc(s.name)}</h3><p>${esc(s.detail || s.blurb)}</p><div style="margin-top:24px">${linkTo(base, "services", bt(s.name.length <= 14 ? `More on ${s.name.toLowerCase()}` : "See the details"), "btn ghost")}</div></div>${photoBlock(ph, "4/3")}</article>`;
    }).join("")}</div></div></section>`;
  }
  return `<section class="sec"><div class="wrap">${svcHead(C)}${svcCards(C, base, Math.min(C.services.length, C.services.length >= 4 ? 4 : 3))}</div></section>`;
}

function bento(C, base, photos) {
  const list = C.services.slice(0, 5);
  if (!list.length) return "";
  return `<section class="sec"><div class="wrap">${svcHead(C)}<div class="bento n${list.length}">${list.map((s, i) => {
    const ph = photos.length ? photos[i % photos.length] : null;
    return `<a class="rv d${i % 3}${ph ? "" : " np"}" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services">${ph ? `<img src="${esc(ph.url)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async">` : ""}<span class="go" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12 12 4M5 4h7v7"/></svg></span><div class="bt2"><h3 class="disp">${esc(s.name)}</h3>${i < 2 ? `<p>${esc(s.blurb)}</p>` : ""}</div></a>`;
  }).join("")}</div></div></section>`;
}

const portal = (C, ph, story) => `<section class="portal" data-scene="pin"><div class="stage"><div class="pword disp" aria-hidden="true">${esc(C.name)}</div>
<div class="pframe">${ph ? `<img src="${esc(ph.url)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async">` : ""}</div>
<div class="wrap pcopy"><p class="disp">${esc(story)}</p></div></div></section>`;

const ctaBand = (C, base) => C.theme === "cinematic" ? `<section class="cn-end" data-scene="pass"><div class="cn-end-bg" aria-hidden="true">${C.endPh ? `<img src="${esc(C.endPh.url)}" alt="" loading="lazy" decoding="async">` : ""}</div>
<div class="wrap"><h2 class="disp rv">${esc(C.cta.headline)}</h2><p class="rv d1">${esc(C.cta.sub)}</p><div class="rv d2">${ctaBtn(C, base)}</div></div></section>` : `<section class="sec"><div class="wrap"><div class="ctab rv"><span class="glow" style="right:-120px;top:-160px"></span>
<h2 class="disp">${esc(C.cta.headline)}</h2><p>${esc(C.cta.sub)}</p>${ctaBtn(C, base)}</div></div></section>`;

// Cinematic's split screen. Each scene: { label, ph, html, id }. One photo per scene, stacked on the pinned half; the
// script lights the one whose words are being read (cnUpd). Without the script the first photo shows and every word
// is readable. The photos are decoration here (the words carry the meaning), so they are hidden from screen readers.
function cinemaScenes(scenes, top = false) {
  if (!scenes.length) return "";
  const media = scenes.map((x, i) => x.ph ? `<img class="cn-img${i ? "" : " on"}" src="${esc(x.ph.url)}" alt=""${i ? ' loading="lazy" decoding="async"' : top ? ' fetchpriority="high"' : ""}>` : `<div class="cn-img cn-none${i ? "" : " on"}"></div>`).join("");
  return `<section class="cn${top ? " cn-top" : ""}" data-cn><div class="cn-media" aria-hidden="true"><div class="cn-fr">${media}</div><div class="cn-cap"><span class="cn-lbl">${esc(scenes[0].label)}</span><i class="cn-bar"><b></b></i></div></div>
<div class="cn-text">${scenes.map((x, i) => `<div class="cn-sc${i ? "" : " act"}" data-l="${esc(x.label)}"${x.id ? ` id="${x.id}"` : ""}>${x.ph ? `<figure class="cn-ph" aria-hidden="true"><img src="${esc(x.ph.url)}" alt=""${i ? ' loading="lazy" decoding="async"' : ""}></figure>` : ""}${x.html}</div>`).join("\n")}</div></section>`;
}
const moreOn = (name) => name.length <= 14 ? `More on ${name.toLowerCase()}` : "See the details";
const serviceScene = (C, base, s, i, first) => ({ label: s.name, html: `${first ? `<span class="eyebrow"><i></i>What we do</span>` : ""}<h2 class="disp">${esc(s.name)}</h2><p>${esc(s.detail || s.blurb)}</p>
<div class="go"><a class="btn ghost" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services">${bt(moreOn(s.name))}</a></div>` });

function photoBlock(ph, ratio = "4/3") {
  if (!ph) return `<div class="ph rv" style="aspect-ratio:${ratio};background:radial-gradient(70% 70% at 30% 30%,color-mix(in srgb,var(--ac) 35%,transparent),transparent),var(--bg2)"></div>`;
  return `<div class="ph rv" style="aspect-ratio:${ratio}"><img src="${esc(ph.url)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async"></div>`;
}

const storyText = (fill, text) => fill ? `<p class="fill">${esc(text)}</p>` : `<p class="lead disp rv">${esc(text)}</p>`;

// ── The home page as sections he can show, hide, reorder and add to (Bryson, 2026-10-09: "edit any text, show,
// hide, reorder, add new sections, choose each photo", plus an AI that does it from what he says). KB site-editor.
// 🔴 A SITE NOBODY EDITED RENDERS EXACTLY AS BEFORE: no saved layout means the original order with nothing hidden.
export const HOME_SECTIONS = [["hero", "Top of the page"], ["marquee", "Moving strip of words"], ["services", "Services"], ["story", "Your story"],
  ["beforeafter", "Before and after"], ["why", "Why choose us"], ["steps", "How it works"], ["faq", "Questions"], ["reviews", "A review"], ["cta", "Closing call to action"]];
export const BLOCK_TYPES = { text: "Text", gallery: "Photo gallery", pricing: "Prices", video: "Video", areas: "Areas we serve", team: "Team" };
export const MAX_BLOCKS = 12;
const BUILT_KEYS = HOME_SECTIONS.map((x) => x[0]);
const blockId = (k) => String(k || "").replace(/[^a-z0-9]/gi, "").slice(0, 16);
// Every block, cleaned: only known types, only known fields, text trimmed, links https only.
export function cleanBlock(b) {
  if (!b || !BLOCK_TYPES[b.type]) return null;
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const base = { id: blockId(b.id), type: b.type, heading: clean(b.heading, 90) };
  if (!base.id) return null;
  if (b.type === "text") return { ...base, body: String(b.body == null ? "" : b.body).replace(/[—–]/g, ", ").slice(0, 2000).trim() };
  if (b.type === "gallery") return { ...base, photos: list(b.photos, 12).map(httpsUrl).filter(Boolean) };
  if (b.type === "pricing") return { ...base, items: list(b.items, 6).map((i) => ({ name: clean(i && i.name, 60), price: clean(i && i.price, 30), text: clean(i && i.text, 220) })).filter((i) => i.name), note: clean(b.note, 160) };
  if (b.type === "video") return { ...base, url: httpsUrl(b.url), text: clean(b.text, 300) };
  if (b.type === "areas") return { ...base, text: clean(b.text, 300), places: list(b.places, 30).map((p) => clean(p, 40)).filter(Boolean) };
  if (b.type === "team") return { ...base, people: list(b.people, 8).map((p) => ({ name: clean(p && p.name, 60), role: clean(p && p.role, 60), photo: httpsUrl(p && p.photo) })).filter((p) => p.name) };
  return null;
}
export const blocksOf = (cl) => ((cl && cl.website && cl.website.blocks) || []).map(cleanBlock).filter(Boolean).slice(0, MAX_BLOCKS);
const blockOf = (cl, id) => blocksOf(cl).find((b) => b.id === id) || null;
export function homeLayout(cl) {
  const saved = (cl && cl.website && cl.website.layout && Array.isArray(cl.website.layout.home)) ? cl.website.layout.home : [];
  const ids = new Set(blocksOf(cl).map((b) => b.id));
  const seen = new Set(); const out = [];
  for (const x of saved) {
    const key = String((x && x.key) || "");
    const ok = BUILT_KEYS.includes(key) || (key.startsWith("b:") && ids.has(key.slice(2)));
    if (!ok || seen.has(key)) continue;
    seen.add(key); out.push({ key, hidden: key !== "hero" && !!x.hidden });
  }
  // A section he never placed (a new built-in, or a block added without a position) goes where it belongs.
  BUILT_KEYS.forEach((k, i) => { if (!seen.has(k)) { const after = BUILT_KEYS.slice(0, i).reverse().find((p) => seen.has(p)); const at = after ? out.findIndex((x) => x.key === after) + 1 : 0; out.splice(at, 0, { key: k, hidden: false }); seen.add(k); } });
  blocksOf(cl).forEach((b) => { const k = `b:${b.id}`; if (!seen.has(k)) { const at = out.findIndex((x) => x.key === "cta"); out.splice(at < 0 ? out.length : at, 0, { key: k, hidden: false }); seen.add(k); } });
  // The top of the page is always first.
  const h = out.findIndex((x) => x.key === "hero"); if (h > 0) out.unshift(out.splice(h, 1)[0]);
  return out;
}
// The photo he chose for a spot, only if it is one this site actually has.
export const PHOTO_SPOTS = [["hero", "Top of the home page"], ["story", "Next to your story"], ["about", "About page"]];
export function photoPicks(cl, photos) {
  const pk = (cl && cl.website && cl.website.photoPick) || {};
  const out = {};
  PHOTO_SPOTS.forEach(([k]) => { const p = photos.find((x) => x.url === httpsUrl(pk[k])); if (p) out[k] = p; });
  return out;
}
const videoEmbed = (u) => {
  const t = String(u || "");
  let m = t.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
  if (m) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  m = t.match(/^https:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/);
  if (m) return { kind: "frame", src: `https://player.vimeo.com/video/${m[1]}` };
  return t ? { kind: "file", src: t } : null;
};
// An added section. One with nothing in it is not drawn, so an empty frame never reaches the live site.
function renderBlock(theme, b, C, base, photos) {
  if (!b) return "";
  const head = b.heading ? `<div class="sec-h"><h2 class="disp rv">${esc(b.heading)}</h2></div>` : "";
  if (b.type === "text") {
    if (!b.body && !b.heading) return "";
    return `<section class="sec"><div class="wrap" style="max-width:900px">${head}${b.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p class="rv" style="font-size:19px;margin-bottom:18px">${esc(p.replace(/\s+/g, " "))}</p>`).join("")}</div></section>`;
  }
  if (b.type === "gallery") {
    const own = photos.filter((p) => p.own);
    const pics = b.photos.length ? b.photos.map((u) => ({ url: u, alt: "" })) : own.slice(0, 6);
    if (!pics.length) return "";
    return `<section class="sec"><div class="wrap">${head}<div class="grid gal ${pics.length >= 3 ? "g3" : "g2"}">${pics.map((p) => photoBlock(p, "4/3")).join("")}</div></div></section>`;
  }
  if (b.type === "pricing") {
    if (!b.items.length) return "";
    return `<section class="sec"><div class="wrap">${head}<div class="grid ${b.items.length === 4 ? "g4" : b.items.length === 2 || b.items.length === 1 ? "g2" : "g3"}">${b.items.map((i, n) => `<div class="card rv d${n % 3}"><span class="tick"></span><h3>${esc(i.name)}</h3>${i.price ? `<p class="disp" style="font-size:30px;color:var(--ink);margin:6px 0 10px">${esc(i.price)}</p>` : ""}${i.text ? `<p>${esc(i.text)}</p>` : ""}</div>`).join("")}</div>
${b.note ? `<p class="rv" style="color:var(--mute);margin-top:18px">${esc(b.note)}</p>` : ""}<div class="rv" style="margin-top:26px">${ctaBtn(C, base)}</div></div></section>`;
  }
  if (b.type === "video") {
    const v = videoEmbed(b.url);
    if (!v) return "";
    const media = v.kind === "frame"
      ? `<iframe src="${esc(v.src)}" title="${esc(b.heading || "Video")}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>`
      : `<video src="${esc(v.src)}" controls playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000"></video>`;
    return `<section class="sec"><div class="wrap" style="max-width:1000px">${head}${b.text ? `<p class="rv" style="color:var(--mute);margin:-20px 0 24px">${esc(b.text)}</p>` : ""}<div class="ph rv" style="position:relative;aspect-ratio:16/9">${media}</div></div></section>`;
  }
  if (b.type === "areas") {
    if (!b.places.length && !b.text) return "";
    return `<section class="sec"><div class="wrap">${head}${b.text ? `<p class="rv" style="max-width:640px;color:var(--mute);margin-bottom:22px">${esc(b.text)}</p>` : ""}<div class="rv" style="display:flex;flex-wrap:wrap;gap:10px">${b.places.map((p) => `<span class="area-chip" style="display:inline-block;border:1px solid var(--line);border-radius:999px;padding:9px 16px;font-weight:600">${esc(p)}</span>`).join("")}</div></div></section>`;
  }
  if (b.type === "team") {
    if (!b.people.length) return "";
    return `<section class="sec"><div class="wrap">${head}<div class="grid ${b.people.length >= 3 ? "g3" : "g2"}">${b.people.map((p, n) => `<figure class="card rv d${n % 3}" style="padding:0;overflow:hidden">${p.photo ? `<div style="aspect-ratio:4/3;overflow:hidden"><img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover"></div>` : ""}<figcaption style="padding:22px"><h3>${esc(p.name)}</h3>${p.role ? `<p>${esc(p.role)}</p>` : ""}</figcaption></figure>`).join("")}</div></div></section>`;
  }
  return "";
}

function homeBody(theme, cl, C, base, photos0, M, ba = []) {
  // Photos he chose for a spot (KB site-editor) go first for that spot; otherwise the usual order.
  const pk = photoPicks(cl, photos0);
  const photos = pk.hero ? [pk.hero, ...photos0.filter((p) => p.url !== pk.hero.url)] : photos0;
  const storyPh = pk.story || photos0[theme === "editorial" ? 1 : 0] || photos0[0];
  const story = (C.about.story[0] || C.hero.sub);
  const why = C.why.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="disp rv">Why people choose ${esc(C.name)}</h2></div>
<div class="grid ${C.why.length === 4 ? "g4" : C.why.length === 2 ? "g2" : "g3"}">${C.why.map((w, i) => `<div class="card rv d${i % 3}"><span class="tick"></span><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div></div></section>` : "";
  const steps = C.process.length ? `<section class="sec"><div class="wrap split"><div><span class="eyebrow rv"><i></i>How it works</span><h2 class="disp rv" style="font-size:clamp(34px,5vw,68px);margin-top:18px">Simple from the first call.</h2></div>
<div class="steps" data-scene="pass">${C.process.map((s, i) => `<div class="step rv"><span class="num">Step ${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></div>`).join("")}</div></div></section>` : "";
  const faq = C.faqs.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="disp rv">Questions, answered</h2></div>
${C.faqs.slice(0, 5).map((f) => `<details class="faq rv"><summary>${esc(f.q)}<i aria-hidden="true">+</i></summary><p>${esc(f.a)}</p></details>`).join("")}</div></section>` : "";
  const storySec = M.scene === "portal" ? portal(C, storyPh, story)
    : `<section class="sec"><div class="wrap split">${storyText(M.fill, story)}${photoBlock(storyPh, "4/5")}</div></section>`;
  const built = {
    hero: () => heroHome(theme, C, base, photos), marquee: () => marquee(C), services: () => theme === "showcase" ? bento(C, base, photos) : servicesSection(M.scene, C, base, theme === "cinematic" && photos.length > 1 ? [...photos.slice(1), photos[0]] : photos),
    story: () => storySec, beforeafter: () => beforeAfterHTML(ba, { headClass: "disp rv" }), why: () => why, steps: () => steps, faq: () => faq,
    reviews: () => reviewsTeaser(cl, C, base), cta: () => ctaBand(C, base),
  };
  if (theme === "cinematic") return cinemaHome(cl, C, base, photos, pk, story, built, theme, photos0);
  if (theme === "editorial") return editorialHome(cl, C, base, photos, storyPh, story, built, theme, photos0);
  // The order, and which parts are switched off, are his (website.layout.home); added sections live in website.blocks.
  return homeLayout(cl).filter((x) => !x.hidden).map((x) => x.key.startsWith("b:") ? renderBlock(theme, blockOf(cl, x.key.slice(2)), C, base, photos0) : (built[x.key] ? built[x.key]() : ""))
    .filter(Boolean).join("\n");
}

// Cinematic's home: the top, the services, the story and "why us" become scenes of the split screen, in his order;
// everything else (strip, before and after, steps, questions, reviews, the closing card, his added sections) follows
// it at full width, also in his order. Hidden parts stay hidden.
const SCENE_KEYS = ["hero", "services", "story", "why"];
function cinemaHome(cl, C, base, photos, pk, story, built, theme, photos0) {
  let n = 0;
  const next = () => (photos.length ? photos[n++ % photos.length] : null);
  const scenes = [], pre = [], post = [];
  for (const x of homeLayout(cl).filter((y) => !y.hidden)) {
    if (SCENE_KEYS.includes(x.key)) {
      if (x.key === "hero") scenes.push({ label: "Scroll to explore", ph: next(), html: `<div class="top"><span class="eyebrow"><i></i>${esc(C.hero.eyebrow)}</span>${rateChip(C.rating)}</div>
<h1 class="disp hl">${oneLine(C.hero.headline)}</h1><p class="sub">${esc(C.hero.sub)}</p><div class="go">${ctaBtn(C, base)}${linkTo(base, "services", bt(C.cta.explore), "btn ghost")}</div>` });
      else if (x.key === "services") C.services.slice(0, 6).forEach((sv, i) => scenes.push({ ...serviceScene(C, base, sv, i, i === 0), ph: next() }));
      else if (x.key === "story") scenes.push({ label: "Our story", ph: pk.story || next(), html: `<span class="eyebrow"><i></i>Our story</span><p class="lead disp">${esc(story)}</p>
<div class="go">${linkTo(base, "about", bt("Read our story"), "btn ghost")}</div>` });
      else if (x.key === "why" && C.why.length) scenes.push({ label: "Why us", ph: next(), html: `<h2 class="disp">Why people choose ${esc(C.name)}</h2><ul class="cn-why">${C.why.map((w) => `<li><b>${esc(w.title)}</b><span>${esc(w.text)}</span></li>`).join("")}</ul>` });
      continue;
    }
    const html = x.key.startsWith("b:") ? renderBlock(theme, blockOf(cl, x.key.slice(2)), C, base, photos0) : (built[x.key] ? built[x.key]() : "");
    if (html) (scenes.length ? post : pre).push(html);
  }
  return [...pre, cinemaScenes(scenes, !pre.length && homeLayout(cl).some((y) => y.key === "hero" && !y.hidden)), ...post].filter(Boolean).join("\n");
}

// Editorial's home: the cover, the contents, the feature and the columns in his order; the other parts (strip, before
// and after, steps, questions, review, closing panel, his added sections) as they are, restyled by the design.
const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
function editorialHome(cl, C, base, photos, storyPh, story, built, theme, photos0) {
  const R = C.rating, phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const pick = (i) => (photos.length ? photos[i % photos.length] : null);
  const ed = {
    hero: () => { const ph = photos[0];
      return `<section class="edh"><div class="wrap"><div class="edh-meta"><span class="eyebrow rv"><i></i>${esc(C.hero.eyebrow)}</span>${R ? `<span class="edh-rt rv d1"><b aria-hidden="true">${"&#9733;".repeat(Math.max(1, Math.min(5, Math.round(R.stars))))}</b>${R.stars.toFixed(1)} from ${R.count} ${R.source ? esc(R.source) + " " : ""}review${R.count === 1 ? "" : "s"}</span>` : phone ? `<a class="edh-rt rv d1" href="tel:${esc(digits(phone))}">Call ${esc(phone)}</a>` : ""}</div>
<div class="rule"></div><h1 class="disp hl">${lines(C.hero.headline, theme)}</h1>
<div class="edh-row"><p class="edh-lead rv d1">${esc(C.hero.sub)}</p><div class="acts rv d2">${ctaBtn(C, base)}${linkTo(base, "services", bt(C.cta.explore), "btn ghost")}</div></div></div>
${ph ? `<figure class="edh-fig wrap"><div class="ph"><img src="${esc(ph.url)}" alt="${esc(ph.alt)}" fetchpriority="high"></div><figcaption>${esc(C.name)}${C.area ? `, ${esc(C.area)}` : ""}</figcaption></figure>` : ""}</section>`; },
    services: () => { const list = C.services.slice(0, 8); if (!list.length) return "";
      return `<section class="ed-sec"><div class="wrap"><div class="ed-sh"><h2 class="disp rv">What we do</h2><span class="rv d1">${list.length > 1 ? `${list.length} ways we can help` : "How we can help"}</span></div><div class="rule"></div>
<div class="ed-idx">${list.map((sv, i) => `<a class="ed-row rv${photos.length ? "" : " np"}" href="${esc(href(base, "services"))}#s${i + 1}" data-page="services" aria-label="${esc(sv.name)}">${photos.length ? `<img class="ed-th" src="${esc(pick(i + 1).url)}" alt="" loading="lazy" decoding="async">` : ""}<h3 class="disp">${esc(sv.name)}</h3><p>${esc(sv.blurb || sv.detail)}</p><span class="ed-go">${ARROW_SVG}</span></a>`).join("")}</div></div></section>`; },
    story: () => { const more = C.about.story.slice(1, 3).filter((x) => x && x !== story);
      return `<section class="ed-sec"><div class="wrap"><div class="ed-sh"><h2 class="disp rv">Our story</h2></div><div class="rule"></div>
<div class="ed-feat">${storyPh ? `<figure class="ed-fig"><div class="ph"><img src="${esc(storyPh.url)}" alt="${esc(storyPh.alt)}" loading="lazy" decoding="async"></div><figcaption>${esc(C.name)}</figcaption></figure>` : ""}
<div><p class="ed-big disp rv">${esc(story)}</p>${more.length ? `<div class="ed-cols rv d1" style="--c:${more.length};--mw:${more.length > 1 ? "none" : "560px"}">${more.map((x, i) => `<p${!i && x.length > 160 ? ' class="dc"' : ""}>${esc(x)}</p>`).join("")}</div>` : ""}<div class="go rv d2">${linkTo(base, "about", bt("Read our story"), "btn ghost")}</div></div></div></div></section>`; },
    why: () => !C.why.length ? "" : `<section class="ed-sec"><div class="wrap"><div class="ed-sh"><h2 class="disp rv">Why people choose ${esc(C.name)}</h2></div><div class="rule"></div>
<div class="ed-why" style="--n:${Math.min(4, C.why.length)}">${C.why.map((w, i) => `<div class="rv d${i % 3}"><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div></div></section>`,
  };
  return homeLayout(cl).filter((x) => !x.hidden).map((x) => x.key.startsWith("b:") ? renderBlock(theme, blockOf(cl, x.key.slice(2)), C, base, photos0) : ed[x.key] ? ed[x.key]() : (built[x.key] ? built[x.key]() : ""))
    .filter(Boolean).join("\n");
}

function reviewsTeaser(cl, C, base) {
  const revs = realReviews(cl);
  if (!revs.length) return "";
  const r = revs[0];
  return `<section class="sec rvt"><div class="wrap" style="max-width:980px;text-align:center"><div class="stars rv">${"&#9733;".repeat(r.stars)}</div>
<p class="disp rv" style="font-size:clamp(26px,3.6vw,46px);line-height:1.2">"${esc(r.text)}"</p><p class="rv d1" style="margin-top:20px;color:var(--mute)">${esc(r.name)}</p>
<div class="rv d2" style="margin-top:26px">${linkTo(base, "reviews", bt(revs.length > 1 ? `Read all ${revs.length} reviews` : "See the review"), "btn ghost")}</div></div></section>`;
}

function servicesBody(theme, C, base, photos) {
  if (theme === "cinematic") return `${pageHero(theme, "Our services", C.hero.sub, C.niche || "Services", C.pagePh)}
${cinemaScenes(C.services.map((sv, i) => ({ label: sv.name, ph: photos.length ? photos[(i + 1) % photos.length] : null, id: `s${i + 1}`,
    html: `<h2 class="disp">${esc(sv.name)}</h2><p>${esc(sv.detail || sv.blurb)}</p><div class="go">${ctaBtn(C, base)}</div>` })))}
${ctaBand(C, base)}`;
  return `${pageHero(theme, "Our services", C.hero.sub, C.niche || "Services", C.pagePh)}
<section class="sec"><div class="wrap svl">${C.services.map((s, i) => `<div class="svc rv" id="s${i + 1}"><h3 class="disp">${esc(s.name)}</h3><div><p>${esc(s.detail || s.blurb)}</p></div></div>`).join("")}</div></section>
${photos.length > 1 ? `<section class="sec" style="padding-top:0"><div class="wrap grid gal ${photos.length >= 3 ? "g3" : "g2"}">${photos.slice(0, 3).map((p) => photoBlock(p, photos.length >= 3 ? "3/4" : "4/3")).join("")}</div></section>` : ""}
${ctaBand(C, base)}`;
}

function aboutBody(theme, C, base, photos0, M, cl) {
  const pk = photoPicks(cl, photos0);
  const photos = pk.about ? [pk.about, ...photos0.filter((p) => p.url !== pk.about.url)] : photos0;
  const [first, ...rest] = C.about.story.length ? C.about.story : [C.hero.sub];
  // The word-by-word light goes wherever the home page did not use it.
  return `${pageHero(theme, C.about.headline, "", "About us", C.pagePh)}
<section class="sec"><div class="wrap">${storyText(!(M.fill && M.scene !== "portal"), first)}</div></section>
${rest.length || photos.length ? `<section class="sec" style="padding-top:0"><div class="wrap split">${photoBlock(photos[0], "5/4")}<div>${rest.map((p) => `<p class="rv" style="font-size:19px;margin-bottom:18px">${esc(p)}</p>`).join("")}${C.area ? `<p class="rv" style="color:var(--mute)">Proudly serving ${esc(C.area)}.</p>` : ""}</div></div></section>` : ""}
${C.why.length ? `<section class="sec"><div class="wrap grid ${C.why.length === 4 ? "g4" : "g3"}">${C.why.map((w, i) => `<div class="card rv d${i % 3}"><span class="tick"></span><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div></section>` : ""}
${ctaBand(C, base)}`;
}

function reviewsBody(theme, cl, C, base) {
  const revs = realReviews(cl);
  const listing = httpsUrl(cl && cl.website && cl.website.googleListingUrl);
  const write = httpsUrl(cl && cl.googleReviewUrl);
  const buttons = `${listing ? `<a class="btn" href="${esc(listing)}" target="_blank" rel="noopener">${bt("Read our Google reviews")}</a>` : ""}${write ? `<a class="btn ghost" href="${esc(write)}" target="_blank" rel="noopener">${bt("Leave a review")}</a>` : ""}`;
  return `${pageHero(theme, "What our customers say", revs.length ? "" : "We'd love to hear about your experience.", "Reviews", C.pagePh)}
<section class="sec"><div class="wrap">${revs.length ? `<div class="revs">${revs.map((r, i) => `<figure class="card rev rv d${i % 3}"><div class="stars">${"&#9733;".repeat(r.stars)}</div><blockquote style="font-size:17px">${esc(r.text)}</blockquote><figcaption style="margin-top:16px;color:var(--mute);font-size:14px">${esc(r.name)}</figcaption></figure>`).join("")}</div>` : ""}
${buttons ? `<div class="rv" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:${revs.length ? 40 : 0}px">${buttons}</div>` : ""}</div></section>
${ctaBand(C, base)}`;
}

function contactBody(theme, cl, C, base) {
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const email = String((cl && cl.website && cl.website.publicEmail) || "").trim();
  const addr = String((cl && cl.businessAddress) || "").trim();
  const hours = clean((cl && cl.website && cl.website.hours) || (cl && cl.websiteIntake && cl.websiteIntake.hours), 160);
  const map = addr ? `<iframe class="map rv" loading="lazy" title="Map" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(addr)}&amp;output=embed"></iframe>` : "";
  return `${pageHero(theme, C.cta.headline, C.cta.sub, "Contact", C.pagePh)}
<section class="sec" style="padding-top:20px"><div class="wrap split" style="align-items:start">
<div class="rv"><form id="sf" class="form" novalidate>
<label>Your name<input name="nm" autocomplete="name" required></label>
<label>Phone<input name="ph" type="tel" autocomplete="tel" inputmode="tel"></label>
<label>Email<input name="em" type="email" autocomplete="email"></label>
${isHealth(cl) ? "" : `<label>How can we help?<textarea name="msg" rows="4"></textarea></label>`}
<p class="err" role="alert"></p><button class="btn" type="submit">${esc(C.cta.send)}</button></form>
<div class="thanks" id="sthx"><h3 class="disp" style="font-size:30px">Thanks, we got it.</h3><p style="color:var(--mute);margin-top:8px">We'll be in touch shortly.</p></div></div>
<div><dl class="info rv d1">${phone ? `<dt>Call</dt><dd><a href="tel:${esc(digits(phone))}">${esc(phone)}</a></dd>` : ""}${email ? `<dt>Email</dt><dd><a href="mailto:${esc(email)}">${esc(email)}</a></dd>` : ""}${payLinkOf(cl) ? `<dt>Pay</dt><dd><a href="${esc(payLinkOf(cl))}" target="_blank" rel="noopener">Pay online</a></dd>` : ""}${addr ? `<dt>Visit</dt><dd>${esc(addr)}</dd>` : ""}${hours ? `<dt>Hours</dt><dd>${esc(hours)}</dd>` : ""}${C.area ? `<dt>Service area</dt><dd>${esc(C.area)}</dd>` : ""}</dl>
${map ? `<div style="margin-top:30px">${map}</div>` : ""}</div></div></section>`;
}

// The Book page (./booking.mjs): tap a package, pick a day and an open time, then where and who. The
// packages are in the page; open times come from /book as the customer picks.
function bookBody(theme, cl, C) {
  const cfg = bookingConfig(cl);
  const phone = (cl && (cl.businessPhone || cl.callTrackingNumber)) || "";
  const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const t12 = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}${mm ? ":" + String(mm).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };
  const hours = cfg.hours.map((h, i) => h ? `${DN[i]} ${t12(h[0])} to ${t12(h[1])}` : "").filter(Boolean);
  return `${pageHero(theme, `Book ${C.name}`, cfg.note || "Pick a package and a time that works for you. It takes about a minute.", "Book", C.pagePh)}
<section class="sec" style="padding-top:20px"><div class="wrap bk-wrap">
${bookingWidgetHTML(cl, { btnClass: "btn", headClass: "disp bk-h" })}
<aside class="bk-side">${phone ? `<div class="bk-call"><div>Rather talk to a person?</div><a class="btn ghost" href="tel:${esc(digits(phone))}">Call ${esc(phone)}</a></div>` : ""}${hours.length ? `<p>${hours.map(esc).join("<br>")}</p>` : ""}</aside>
</div></section>`;
}
const HPH_CSS = `.hd .hph{font-size:14.5px;font-weight:600;white-space:nowrap}@media (max-width:1000px){.hd .hph{display:none}}`;
const BOOK_CSS = `.bk{--bk-ac:var(--ac);--bk-on:var(--on);--bk-card:var(--card);--bk-line:var(--line);--bk-ink:var(--ink);--bk-mute:var(--mute);--bk-bg2:var(--bg2);--bk-r:var(--r)}
${BOOKING_WIDGET_CSS}
.bk-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px;align-items:start}
.bk-side{position:sticky;top:100px;display:grid;gap:16px}
.bk-call{padding:20px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);display:grid;gap:12px;font-weight:600}
.bk-side p{color:var(--mute);font-size:15px}
.bk-ok h3{font-family:inherit}
@media (max-width:900px){.bk-wrap{grid-template-columns:minmax(0,1fr)}.bk-side{position:static;order:-1}}`;

// An extra page: written by the builder from a one-line brief (site-build-background `extraPage`).
function extraBody(theme, C, base, photos, page) {
  const c = page.extra.content || {};
  const sections = (Array.isArray(c.sections) ? c.sections : []).slice(0, 8).map((x) => ({ h: clean(x && x.heading, 90), t: clean(x && x.text, 900) })).filter((x) => x.h && x.t);
  return `${pageHero(theme, clean(c.headline, 90) || page.label, clean(c.intro, 260), page.label, C.pagePh)}
${sections.map((x, i) => `<section class="sec"${i ? ' style="padding-top:0"' : ""}><div class="wrap split">${i % 2 && photos[i % photos.length] ? photoBlock(photos[i % photos.length], "4/3") : ""}<div><h2 class="disp rv" style="font-size:clamp(28px,3.6vw,48px)">${esc(x.h)}</h2><p class="rv d1" style="margin-top:16px;font-size:18px;color:var(--mute)">${esc(x.t)}</p></div>${!(i % 2) && photos[i % Math.max(1, photos.length)] ? photoBlock(photos[i % photos.length], "4/3") : ""}</div></section>`).join("")}
${ctaBand(C, base)}`;
}

const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }); } catch { return ""; } };

// The blog list. Posts come from the server (site-blog.mjs), already filtered to the published ones.
function blogBody(theme, C, base, posts) {
  const list = (posts || []).slice(0, 60);
  return `${pageHero(theme, "News and tips", `From the team at ${C.name}.`, "Blog", C.pagePh)}
<section class="sec" style="padding-top:10px"><div class="wrap">${list.length ? `<div class="grid g3">${list.map((p, i) =>
    `<a class="card rv d${i % 3}" href="${esc(postHref(base, p.slug))}" data-page="blog"><span class="num">${esc(fmtDate(p.publishAt))}</span><h3>${esc(clean(p.title, 120))}</h3><p>${esc(clean(p.excerpt, 220))}</p></a>`).join("")}</div>`
    : `<p class="rv" style="color:var(--mute);font-size:18px">The first articles are on their way.</p>`}</div></section>
${ctaBand(C, base)}`;
}

// One article. Headings and paragraphs only: the writer returns blocks, never HTML.
function postBody(theme, C, base, post) {
  const blocks = (Array.isArray(post.blocks) ? post.blocks : []).slice(0, 60);
  return `${pageHero(theme, clean(post.title, 120), "", fmtDate(post.publishAt), C.pagePh)}
<section class="sec" style="padding-top:10px"><div class="wrap" style="max-width:760px">${blocks.map((b) => b && b.kind === "h2"
    ? `<h2 class="disp rv" style="font-size:clamp(24px,3vw,36px);margin:36px 0 12px">${esc(clean(b.text, 140))}</h2>`
    : `<p class="rv" style="font-size:18px;line-height:1.75;margin-bottom:18px">${esc(clean(b && b.text, 1600))}</p>`).join("")}
<div class="rv" style="margin-top:34px">${linkTo(base, "blog", bt("Read the blog"), "btn ghost")}</div></div></section>
${ctaBand(C, base)}`;
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

// One page view, for the portal's visitor numbers (site-hit.mjs). Only on the live public site: never in
// a preview (about:), never on a ?preview= link, never for an automated browser. Sent as plain text so
// the browser needs no permission check, and it can never break the page.
function hitScript(track, base) {
  const url = /^https:\/\//.test(String(track.url || "")) ? String(track.url) : "";
  if (!url) return "";
  const basePath = (() => { try { return new URL(base).pathname.replace(/\/$/, ""); } catch { return ""; } })();
  return `(function(){try{var h=String(location.href);if(h.indexOf('about:')===0||/[?&]preview=/.test(location.search)||navigator.webdriver)return;
var p=location.pathname;if(p.indexOf(${JSON.stringify(basePath)})===0)p=p.slice(${basePath.length})||'/';
var b=JSON.stringify({s:${JSON.stringify(String(track.slug || ""))},p:p,r:document.referrer||'',a:/[?&](gclid|gbraid|wbraid)=/.test(location.search)?1:0});
if(navigator.sendBeacon){navigator.sendBeacon(${JSON.stringify(url)},new Blob([b],{type:'text/plain'}));}else{fetch(${JSON.stringify(url)},{method:'POST',body:b,keepalive:true,mode:'no-cors'});}}catch(e){}})();`;
}

// ── The page ──────────────────────────────────────────────────────────────────────────────
// opts.base: absolute origin + path of the site root, no trailing slash. Required.
export function renderSite(cl, pageId = "home", opts = {}) {
  const theme = themeOf(cl, opts.theme);
  const pages = pagesFor(cl);
  const pg = pages.find((p) => p.id === pageId) || pages[0];
  const page = pg.id;
  const post = page === "blog" && opts.post && opts.post.slug ? opts.post : null;
  const base = String(opts.base || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) throw new Error("renderSite needs an absolute https base");
  const M = motionRecipe(cl, theme);
  const mode = modeOf(cl, theme, opts.mode);
  const P = palette(theme, cl, M.gl, mode);
  const alt = theme === "aurora" ? null : palette(theme, cl, M.gl, mode === "dark" ? "light" : "dark");
  const C = siteContent(cl);
  // How this business takes customers decides where every main button goes (ctaBtn).
  C.intake = intakeOf(cl);
  C.rating = ratingOf(cl);
  C.bookOn = C.intake.how === "book";
  const photos = photosFor(cl);
  C.theme = theme;
  C.pagePh = photos[1] || photos[0] || null;
  C.endPh = photos[2] || photos[0] || null;
  // Before-and-after pairs from the Brand kit: drawn on the home page once at least one is uploaded (KB brand-kit).
  const ba = beforeAfterPairs(cl);
  const body = page === "book" && C.bookOn ? bookBody(theme, cl, C)
    : page === "services" ? servicesBody(theme, C, base, photos)
    : page === "about" ? aboutBody(theme, C, base, photos, M, cl)
    : page === "reviews" ? reviewsBody(theme, cl, C, base)
    : page === "contact" ? contactBody(theme, cl, C, base)
    : page === "blog" ? (post ? postBody(theme, C, base, post) : blogBody(theme, C, base, opts.posts))
    : pg.extra ? extraBody(theme, C, base, photos, pg)
    : homeBody(theme, cl, C, base, photos, M, ba);
  const label = pg.label;
  const title = page === "home" ? (C.seo.title || `${C.name}${C.niche ? " | " + C.niche : ""}`) : post ? `${clean(post.title, 70)} | ${C.name}` : `${label} | ${C.name}`;
  const desc = post ? clean(post.excerpt, 160) || C.hero.sub : pg.extra ? clean(pg.extra.content.intro, 160) || C.hero.sub : C.seo.description || C.hero.sub;
  // The address search engines should credit: the client's own domain once it is live, even when this
  // copy is being served at our /site/<slug>/ address (KB website-builder, step 3).
  const cbase = /^https:\/\//.test(String(opts.canonicalBase || "")) ? String(opts.canonicalBase).replace(/\/+$/, "") : base;
  const canonical = post ? postHref(cbase, post.slug) : href(cbase, page);
  const ogImg = photos[0] ? `<meta property="og:image" content="${esc(photos[0].url)}">` : "";
  const hasGl = !!P.gl && /<canvas/.test(body);
  const out = `<!doctype html><html lang="en" data-mode="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}">${ogImg}
<meta name="theme-color" content="${P.bg}">${opts.noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS[theme]}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${FONTS[theme]}"></noscript>
${fontLinks(typeOf(theme, cl).fontHrefs)}
<style>${css(theme, P, cl, alt)}${IOS_NO_ZOOM}</style><style>${HPH_CSS}${C.bookOn ? BOOK_CSS : ""}${ba.length && page === "home" ? `.ba-sec{--ba-r:var(--r);--ba-mute:var(--mute)}${BEFORE_AFTER_CSS}` : ""}</style><script type="application/ld+json">${jsonLd(cl, C, base)}</script>${post ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: clean(post.title, 110), datePublished: post.publishAt, author: { "@type": "Organization", name: C.name }, mainEntityOfPage: canonical }).replace(/</g, "\\u003c")}</script>` : ""}</head>
<body data-theme="${theme}" data-page="${page}" data-in="${M.entrance}" data-rv="${M.reveal}" data-tx="${M.transition}">
${header(cl, base, page, C, pages)}
<main>${body}</main>
${footer(cl, base, C, pages)}
<script>${motionScript(cl, M)}</script>${C.bookOn && page === "book" ? `<script>${bookingWidgetJS(cl)}</script>` : ""}${ba.length && page === "home" ? `<script>${BEFORE_AFTER_JS}</script>` : ""}${hasGl ? `<script>${glScript(P, theme, M.gl)}</script>` : ""}${opts.track ? `<script>${hitScript(opts.track, base)}</script>` : ""}
</body></html>`;
  // A preview link has to stay a preview link as you click around, or Services lands on "coming soon".
  const q = String(opts.query || "");
  if (!q) return out;
  const reBase = new RegExp(`href="${esc(base).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^"#]*)`, "g");
  return out.replace(reBase, (m) => m + esc(q));
}

// What the OS needs to tell whether a site is ready to show the client.
export const siteReady = (cl) => !!(cl && cl.website && cl.website.content && cl.website.content.hero && cl.website.content.hero.headline);
