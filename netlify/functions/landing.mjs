import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { findPage, clientForPage } from "../lib/landing-pages-shared.mjs";
import { fitPhrase } from "../lib/humanize.mjs";
import { normalizeHost } from "../lib/client-domain.mjs";
import { sellsNationally } from "../lib/market-research-shared.mjs";
import { CLICK_KEYS, UTM_KEYS, STORE_FORWARD_KEYS } from "../lib/attribution.mjs";

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
  // 🔴 THE HAND-SET COLOUR WINS, AND THE ORDER HERE IS THE WHOLE POINT OF THE FIELD.
  // `client.brandColor` is what Bryson typed; `landingPage.brandColor` is what the generator
  // produced. Reading the page first made the override INERT on every page that already had a
  // colour, which is every generated page: he would set his client's real brand colour, save,
  // and watch nothing change. Found by testing the field against a page rather than trusting
  // that shipping it was enough.
  //
  // It also means setting the colour updates EVERY page immediately, with no regeneration,
  // because a landing page is built from this record on each request rather than stored.
  const raw = (cl && cl.brandColor) || lp.brandColor || "";
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(raw).trim());
  const brand = m ? `#${m[1].toLowerCase()}` : "#4f6bed";
  const n = parseInt(brand.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onBrand = lum > 0.62 ? "#15110A" : "#ffffff";
  const tint = `rgba(${r},${g},${b},.16)`;
  const deep = `#${[r, g, b].map((v) => Math.round(v * 0.22).toString(16).padStart(2, "0")).join("")}`;
  const bright = `#${[r, g, b].map((v) => Math.min(255, Math.round(v + (255 - v) * 0.22)).toString(16).padStart(2, "0")).join("")}`;
  // Same order, same reason: a light/dark choice he made by hand beats the one generated with
  // the copy, otherwise that dropdown is decoration too.
  const dark = String((cl && cl.brandTheme) || lp.theme || "").toLowerCase() === "dark";
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
    layout: opt("layout", ["split", "centered", "overlay", "capture"], 0),
    bg: opt("background", ["glowgrid", "mesh", "dots", "clean"], 3),
    motion: opt("motion", ["up", "down", "alt"], 6),
    benefits: opt("benefits", ["cards", "list", "numbered"], 9),
    font: opt("font", ["modern", "elegant", "bold"], 12),
    shape: opt("shape", ["rounded", "soft", "sharp"], 15),
    order: opt("order", ["a", "b", "c", "d"], 19),
  };
}

// ─── HAND-OFF MODE ───────────────────────────────────────────────────────────
// Bryson, 2026-08-19: a Launch & Hand Off client HOSTS THE PAGE THEMSELVES.
//
// Rendering a hand-off variant rather than post-processing the finished HTML, because
// three things break the moment this page leaves BoldLine's domain and every one of them
// fails QUIETLY, which is the worst kind:
//
//  1. THE LEAD FORM. It posts to `/lead`, a RELATIVE path. On
//     their host that path does not exist, so every enquiry hits a 404 and the visitor
//     sees "something went wrong". The business would be paying for clicks that can never
//     reach them and would have no way of knowing why. In hand-off mode the form becomes
//     a plain Netlify Form: no JavaScript, no endpoint, submissions land in their own
//     Netlify dashboard and get emailed to them.
//  2. THE PHONE NUMBER. `callTrackingNumber` is a Twilio number BoldLine rents. It stops
//     working the day BoldLine stops paying for it, and until then their calls route
//     through an account they do not own. Hand-off mode uses THEIR real number.
//  3. CONVERSION TRACKING. Conversions currently reach Google through lead-intake. Once
//     that path is gone the campaign stops receiving conversion data, and a Google
//     campaign with no conversions cannot bid — it degrades over weeks while looking
//     fine. Hand-off mode fires their own Google Ads conversion tag on form submit.
//
// `opts.handoff` is `{ phone, conversionId, conversionLabel }`. Absent = normal page.
// 🔴 AN EMPTY GALLERY TILE MUST NOT LOOK LIKE A BROKEN ONE.
//
// Bryson, 2026-09-13, on Sebastian's live page: *"the landing page is still working good it
// loads the only issue is not all the images loaded"*. Every photo was fine: HTTP 200, valid
// pixels, every time, checked directly. What he caught was a tile laid out at full size and
// faded in on schedule with NOTHING IN IT yet.
//
// Reproduced by holding one gallery image back: the tile sits at full opacity and full height,
// empty, beside two tiles showing photos. On a dark page that is a black square, which is
// exactly what a dead image looks like. The tile now carries a surface colour, so a photo that
// has not arrived reads as a slot still filling rather than a hole.
//
// The first few are also fetched eagerly. Measured in Chrome this changes almost nothing
// (70ms versus 15ms — the gallery is near enough to the viewport that lazy loads it anyway),
// so this is INSURANCE, not the fix: Safari's lazy threshold is its own and could not be
// tested here, and the gallery is one screen down on a phone, so everybody scrolls to it and
// lazy saves nothing. Photos are 70KB to 170KB each after the resizer (KB
// `landing-image-weight`), so four eager is a rounding error. Beyond four, lazy is right again.
const GALLERY_EAGER = 4;

// 🔴 THE DEFAULT TAGS ON A STORE LINK, so a sale is attributable even with JavaScript off.
// Anything the page was actually opened with is added on top at runtime (see the script below),
// and a tag already present in the client's own URL is never overwritten — if they went to the
// trouble of writing one, it beats ours.
function withTags(url, cl) {
  const base = String(url || "").trim();
  if (!base) return "";
  const slug = String((cl && cl.landingSlug) || "").trim();
  const defaults = { utm_source: "boldline", utm_medium: "paid", utm_campaign: slug || "ads" };
  const hash = base.indexOf("#");
  const frag = hash >= 0 ? base.slice(hash) : "";
  const head = hash >= 0 ? base.slice(0, hash) : base;
  const q = head.indexOf("?");
  const path = q >= 0 ? head.slice(0, q) : head;
  const params = new URLSearchParams(q >= 0 ? head.slice(q + 1) : "");
  // 🔴 THREE SOURCES, AND THE ORDER BETWEEN THEM IS THE WHOLE POINT. What the client typed
  // into their own shop link beats everything, because they meant it. What the visitor
  // actually arrived with beats OUR defaults, because it names the real campaign that paid
  // for the click. Our defaults are the floor, so a page with JavaScript off still reports
  // something rather than nothing.
  //
  // `filled` is the list of keys WE invented, handed to the script below so it knows which
  // ones it is allowed to replace. Without it the baked-in `utm_source=boldline` would sit in
  // the way of the real `utm_source=google` on every single click, and every sale in the
  // client's shop would be credited to "boldline" instead of to the campaign that produced it.
  const filled = [];
  for (const [k, v] of Object.entries(defaults)) if (!params.has(k)) { params.set(k, v); filled.push(k); }
  const qs = params.toString();
  return { href: path + (qs ? "?" + qs : "") + frag, filled };
}

export function renderLandingPage(cl, opts = {}) {
  const HO = opts.handoff || null;

  // The client's own Google Ads conversion tag, set up by google-ads.mjs action
  // "conversionSetup" and stored on their record. A hand-off page carries the client's
  // hand-typed pair instead, since after hand-off there is nobody on our side to run it.
  const convId    = HO ? (HO.conversionId || "")    : String((cl && cl.conversionId) || "");
  const formLabel = HO ? (HO.conversionLabel || "") : String((((cl && cl.conversionActions) || {}).form || {}).label || "");
  const lp = cl.landingPage || {};
  const cs = cl.campaignSetup || {};
  const bv = cl.brandVoice || {};
  // 🔴 THE BUSINESS NAME IS TIDIED BEFORE IT IS PRINTED. Found on the live Stencil and
  // Thread page the night it went up: a stray TAB in front of the name, pasted in with it,
  // rendering as `Custom Screen Printed Apparel Done Right | \tStencil & Thread` in the
  // <title>. That is the line Google prints in its search results and the one every browser
  // tab shows, so a pasted whitespace character ends up in front of a client's name in
  // public. It was also in the logo's alt text, the header, and the footer.
  //
  // Trimmed at RENDER time rather than asked of whoever types it. The record can be fixed
  // by hand once; this fixes it for every client, including the next person who pastes a
  // name out of a contract or a spreadsheet with a tab riding along. Internal runs collapse
  // too, so "Stencil  &   Thread" reads as one space rather than three.
  const name = String(cl.name == null ? "" : cl.name).replace(/\s+/g, " ").trim();
  const media = cl.mediaLibrary || [];

  // A label the client typed is real alt text. A camera filename is not, and it is what
  // showed through on the broken page: IMG_6360.png, IMG_6110.jpeg, IMG_6679.jpeg.
  const photoAlt = (p, fallback) => {
    const l = String((p && p.label) || "").trim();
    const bare = l.replace(/\.[a-z0-9]{2,5}$/i, "");
    // 🔴 The crop editor appends a suffix, and `IMG_6360-cropped` walked straight past this
    // filter and printed on Sebastian's live page as the photo's description (Bryson saw it
    // 2026-09-13). Editor suffixes are stripped before the test: "IMG_6360" and
    // "IMG_6360-cropped" are the same non-description. The test stays FULLY ANCHORED, because
    // matching these ordinary words anywhere in a label would silently replace every properly
    // written description with the business name, which is a worse bug and an invisible one.
    const core = bare.replace(/[ _-]*(cropped|crop|edited|edit|copy|final|resized|small|large|\(\d+\))$/i, "").trim();
    const cameraish = !l || /^(img|dsc|dscn|pxl|photo|image|screenshot|scan|mvimg|pano)[ _-]?[\d_-]*$/i.test(core) || /^[\d_-]+$/.test(core);
    // The extension goes either way. Nobody describes a picture as "outside the shop.jpg".
    return cameraish ? fallback : bare;
  };

  const sized = (url, w) => {
    const u = String(url || "");
    const mark = "/storage/v1/object/public/";
    const i = u.indexOf(mark);
    if (i < 0 || !/^https:\/\/[a-z0-9-]+\.supabase\.co\//.test(u)) return u;
    // 🔴 WIDTH ALONE CROPS. THIS COST A LIVE CLIENT'S PAGE A SECOND TIME IN ONE EVENING.
    // Supabase's resizer defaults to `resize=cover`, and given a width with no height it
    // pairs it with the original's long side: a 4032x3024 photo came back 1100x4032, a
    // narrow strip cut out of the middle, and everything that made the photo worth showing
    // was in the two thirds it threw away. Bryson, looking at Sebastian's live page: *"the
    // images aren't showing the right spots... they showed the logos/embroidery"*. He was
    // looking at a shirt with the print cropped off it.
    //
    // A SQUARE BOX PLUS `contain` IS THE FIX. The longest side is scaled to `w`, the other
    // follows the real aspect ratio, and nothing is ever cut. Portrait comes back portrait,
    // landscape comes back landscape, and neither loses an edge. (It also applies the EXIF
    // rotation an iPhone leaves on a photo, so what comes out is the way up he shot it.)
    return u.slice(0, i) + "/storage/v1/render/image/public/" + u.slice(i + mark.length) + `?width=${w}&height=${w}&resize=contain&quality=72`;
  };
  // <<< end image helpers (the suite extracts everything above this line and runs it)

  const P = landingTheme(cl);
  const D = designConfig(cl);

  const mediaHero = (lp.heroPath && media.find((m) => m.path === lp.heroPath)) || media.find((m) => m.category === "photo") || media.find((m) => m.category === "logo");
  const hero = mediaHero || (lp.heroUrl ? { url: lp.heroUrl, category: "photo", path: "__web" } : null);
  const logoUrl = lp.logo || cl.brandLogo || "";
  const bullets = Array.isArray(lp.bullets) ? lp.bullets : [];
  // Their own number in hand-off mode: the tracking number dies with the rental.
  const phone = HO ? String(HO.phone || "") : (cl.callTrackingNumber || "");
  // 🔴 A NATIONAL BUSINESS MUST NOT BE ADVERTISED AS SERVING ONE TOWN. Bryson,
  // 2026-08-24, asked exactly the right question: "if i put gilbert, arizona would it
  // limit the ad to gilbert, arizona or show that I only services gilbert? because
  // remember i service the whole us and the world". The service area is where a business
  // is BASED and where competitor research starts. On a page it was being printed as a
  // public claim, "Serving Gilbert, Arizona", in the hero, the trust row and the footer.
  // For a business that sells remotely that is not a small wording problem, it turns away
  // every visitor outside that town.
  const national = sellsNationally(cl);
  const rawArea = cs.serviceArea || cs.targetLocations || "";
  const area = national ? "" : rawArea;
  // Said positively instead. Never "local businesses", per the standing rule.
  const reach = national ? "Working with businesses nationwide" : "";
  const offer = lp.announce != null ? String(lp.announce) : (cs.mainOffer || "");
  // 🔴 THE FURNITURE IS NOT ALWAYS A LOCAL SERVICE BUSINESS'S FURNITURE.
  //
  // Bryson, 2026-09-15, on his own audience pages: *"its still sort of using stuff from stencil
  // & threads landing page such as the free quotes with the checkmark, the very top of the page
  // there is a bar that includes what it is."* He was right, and no amount of choosing between
  // written options could ever have fixed it: the eyebrow, the trust row, the chip row and the
  // announcement bar are built HERE, from strings hard-coded for a local service business.
  // "Serving Gilbert, Arizona", "Free quote, no obligation", "Fast response", "Free quotes".
  // Two pages sharing all four read as the same page however different the words between them.
  //
  // So a page may now carry its own. Absent, every default below is exactly what it was, so no
  // client page changes; `announce: ""` is how a page says it wants no bar at all, which is
  // distinct from not having said anything.
  // The three lines beside the form, which were hard-coded and said "free quote" too. Same
  // rule as everything else here: absent is exactly the wording that was there before.
  const readyList = (Array.isArray(lp.readyList) && lp.readyList.length
    ? lp.readyList : ["Tell us a bit about what you need.", "We'll reach out fast with your free quote.",
                      "Book your slot and we handle the rest."]).filter(Boolean).map(String).slice(0, 3);
  const ownTrust = Array.isArray(lp.trust) ? lp.trust.filter(Boolean).map(String).slice(0, 4) : null;
  const ownChips = Array.isArray(lp.chips) ? lp.chips.filter(Boolean).map(String).slice(0, 4) : null;
  const differentiator = bv.differentiator || "";
  // A shop's default button asks for the sale. "Get My Free Quote" on a page selling an $11
  // bottle is the wrong verb and, worse, promises a quote that will never arrive. A ctaText the
  // client wrote always wins over either default.
  const cta = lp.ctaText || (String(cl.storeUrl || "").trim() ? "Shop Now" : "Get My Free Quote");
  // 🔴 WHERE A CLIENT'S PHOTOS GO, AND WHICH ONES GET USED. Bryson, 2026-09-02: *"make sure
  // on the see the results page that there is at least 4-6 good images and if there is less
  // to make sure that they are all used [...] make sure the images are put in the right
  // places to look good and make sense and not just in random spots (right now in the header
  // for one of the landing pages there is a background image of a T-shirt which doesn't make
  // sense)."* Stencil and Thread uploaded three t-shirt photos and got exactly that: one
  // shirt stretched full-bleed behind the headline, and only two left for the gallery.
  //
  // Two separate mistakes, and neither needs the page to understand what is IN a picture.
  //
  // 1. THE HERO ATE ONE. Every photo except the hero was excluded from the gallery, which is
  //    right for a client with a dozen images and wrong for one with three: it turns a thin
  //    set into a thinner one. A photo shown in the hero AND in the gallery is not wasted,
  //    it is used twice, which is what a small set needs. So the hero is only held back when
  //    there are enough others to fill the gallery without it.
  const allPhotos = media.filter((m) => m.category === "photo" && m.url);
  const heroIsUploaded = !!(hero && hero.path && hero.path !== "__web");
  const spareTheHero = allPhotos.length >= 5;
  const photos = (spareTheHero ? allPhotos.filter((m) => !hero || m.path !== hero.path) : allPhotos).slice(0, 6);
  // 🔴 EVERY DEFAULT IN THIS RENDERER IS A LOCAL SERVICE BUSINESS'S, and on a shop each one is a
  // promise nobody is going to keep. "Get a fast, free quote" on a page selling an $11 bottle is
  // not slightly off, it is describing a different business.
  const steps = (Array.isArray(lp.steps) && lp.steps.length ? lp.steps
    : String(cl.storeUrl || "").trim()
      ? ["Pick what you need", "Check out in a minute", "It arrives, and keeps arriving"]
      : ["Tell us what you need", "Get a fast, free quote", "We handle the rest"]).slice(0, 3);
  // ── 🔴 A SHOP'S PAGE SELLS. IT DOES NOT COLLECT ENQUIRIES. ──────────────────
  //
  // Bryson, 2026-09-16: *"we will need to do this in the future when we get more e-commerce
  // brands since most of them use Shopify"* and *"make sure everything is done right so it's
  // automated as much as possible and the parts that either party has to do is as simple as
  // possible"*.
  //
  // ONE FIELD switches the whole page: `storeUrl`, the address where the visitor can actually
  // buy. Set it and the buttons go to the shop, the lead form disappears, and the closing copy
  // stops asking for an enquiry. Nothing else to remember, nothing else to tick.
  //
  // 🔴 WHY THE FORM HAS TO GO, not just be ignored. A form on a shop's page collects enquiries
  // nobody is going to answer, from people who came to buy, and every one of them is a visitor
  // who did not click through to the store. It is not clutter, it is a leak.
  //
  // 🔴 AND WHY THE QUERY STRING IS CARRIED ACROSS, which is the part that decides whether anyone
  // gets paid. The agreement counts a Qualified Sale from the CLIENT'S OWN ORDER RECORDS, and a
  // shop can only tie an order to an ad if the tracking parameters reach it. Meta and Google
  // hang their click ids (`fbclid`, `gclid`) on the ad's URL, which lands on THIS page, not on
  // the shop. Drop them here and the shop sees an unattributed visitor, the platform cannot
  // match the purchase, and there is no evidence a sale came from the ads. So every parameter
  // this page was opened with is appended to the store link, and a default set of UTM tags is
  // baked into the href so attribution survives even with JavaScript off.
  const storeUrl = String(cl.storeUrl || "").trim();
  const booking = String(cl.bookingUrl || "").trim();
  const shopping = !!storeUrl;
  const tagged = shopping ? withTags(storeUrl, cl) : null;
  const storeHref = tagged ? tagged.href : "";
  const destination = storeHref || booking;
  const ctaHref = destination ? esc(destination) : "#lead-form";
  // 🔴 SAME TAB FOR A PURCHASE. A booking opens in a new tab so the visitor keeps the page they
  // were reading; a purchase is the end of the journey and a second tab only splits the session,
  // which some shop analytics then read as two visitors.
  const ctaAttr = shopping ? ' data-store="1"' : (booking ? ' target="_blank" rel="noopener"' : "");
  const telHref = phone ? `tel:${esc(phone.replace(/[^0-9+]/g, ""))}` : "";
  // 2. 🔴 A PRODUCT PHOTO IS NOT WALLPAPER. The overlay layout stretches the hero image
  //    full-bleed behind the headline under a dark scrim. That is right for a photo of a
  //    crew on a roof and wrong for a t-shirt on a white background, which is what Bryson
  //    actually saw. The page cannot tell what is IN a picture, but it does know where the
  //    picture CAME FROM, and that turns out to be the better signal:
  //      a scraped og:image (path "__web") is the banner the business already chose to
  //      represent itself, so it is built to sit behind text;
  //      an uploaded photo is whatever they had on their phone, usually a product or a job,
  //      and belongs in a frame beside the copy or in the gallery grid.
  //    So an uploaded photo only gets the full-bleed treatment when there are enough of them
  //    that at least one is likely to be a scene rather than a close-up. Below that the page
  //    falls back to the split layout, where the same photo sits in a rounded panel next to
  //    the headline and reads as a product shot, which is what it is.
  const overlaySuits = !!hero && (!heroIsUploaded || allPhotos.length >= 4);
  const layout = D.layout === "overlay" && !overlaySuits ? "split" : D.layout;
  const useOverlay = layout === "overlay" && !!hero;
  const useCentered = layout === "centered";
  const useCapture = layout === "capture"; // lead form sits IN the hero (above the fold)

  // 🔴 ONE ALIGNMENT RULE WORTH EXPLAINING, and the reasoning lives out here because this
  // stylesheet is delivered verbatim to the client's own domain. `.lay-centered .chips`
  // centres the chip row. Bryson, 2026-09-01: "make sure everything is always uniform and not
  // out of place", with a screenshot of the centred layout, where the headline, the button,
  // the trust line and every section heading were centred and then two pills sat hard against
  // the left edge. The CONTAINER was already centred; the items inside it were not, because a
  // flex row packs to the start unless told otherwise and text-align does nothing to flex
  // children. Measured rather than guessed: the row's centre read 490 of 980 while its
  // resolved alignment read start. Audited by tools/audit-landing-uniformity.js.
  const css = `
*{box-sizing:border-box;margin:0;padding:0}img{max-width:100%;display:block}
:root{--r:18px}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:${P.bg};color:${P.text};line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;--rv:20px}
.sh-soft{--r:12px}.sh-sharp{--r:6px}
/* EVERYTHING MOVES UP OR DOWN. Bryson, 2026-09-02: "make sure the animations are for up
   and down". The old vocabulary had a sideways slide and a zoom in it; both are gone. The
   three remaining feels are all vertical, which is what keeps the three page options
   visibly different from each other without anything sliding in from the edge.
   up   = content rises into place (the body default).
   down = content settles down into place.
   alt  = they alternate, so a row arrives from both directions at once. */
.mo-down{--rv:-22px}
.mo-alt .reveal:nth-child(even){--rv:-22px}
a{color:inherit}
.wrap{max-width:1140px;margin:0 auto;padding:0 20px}
/* header */
.hdr{position:sticky;top:0;z-index:40;background:${P.headBg};backdrop-filter:saturate(1.2) blur(10px);-webkit-backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid ${P.line}}
.hdr .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px}
.brandmark{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15.5px;color:${P.topName}}
.dot{width:10px;height:10px;border-radius:3px;background:${P.brand};box-shadow:0 0 0 4px ${P.tint}}
.blogo{height:30px;width:auto;max-width:180px;object-fit:contain;display:block}
/* reviews */
.revs{display:grid;gap:14px;grid-template-columns:1fr}
.rev{background:${P.cardBg};border:1px solid ${P.border};border-radius:var(--r);padding:22px 20px}
.rev .stars{color:${P.brand};font-size:13px;letter-spacing:2px;margin-bottom:9px}
.rev p{font-size:14.5px;color:${P.text};margin-bottom:12px;line-height:1.6}
.rev .who{font-size:13px;font-weight:700;color:${P.muted}}
/* faq */
.faqwrap{max-width:760px;margin:0 auto;display:grid;gap:10px}
.faq{background:${P.cardBg};border:1px solid ${P.border};border-radius:var(--r);padding:0 18px}
.faq summary{cursor:pointer;list-style:none;padding:16px 0;font-weight:700;font-size:15px;color:${P.headline};display:flex;justify-content:space-between;gap:12px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:${P.brand};font-size:22px;font-weight:800;line-height:1}
.faq[open] summary::after{content:"+"}
.faq p{padding:0 0 16px;font-size:14px;color:${P.muted};line-height:1.6}
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
.hero-form{position:relative;z-index:2}.hero-form .fcard{box-shadow:0 24px 60px rgba(0,0,0,.22)}
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
.lay-centered .chips{justify-content:center}
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
/* The gallery follows its own count, same reason the benefits do: four photos
   gave three across and one stranded underneath. */
.gal{display:grid;gap:12px;grid-template-columns:1fr 1fr}
.gal.g1{grid-template-columns:1fr}
/* A LONE PHOTO ON THE LAST ROW SITS IN THE MIDDLE, NOT OFF TO THE LEFT.
   Bryson, 2026-09-02, with a screenshot of Stencil and Thread's three shirts:
   *"make sure when there is 3 images the one one the bottom is in the middle and
   everything is uniform and formatted."* Two on top, the third hard against the left
   edge with a hole beside it, which reads as a page that broke rather than a page
   with three photos.
   The gallery is the ONLY grid on this page with a two-column base, so it is the only
   one where an odd count strands an item on a phone. The benefits, steps and reviews
   all stack single-column at this width and cannot.
   Centred at exactly one column wide, so it stays the same size as the two above it
   rather than stretching to fill the row, which would be a different kind of wrong. */
.gal.g3>:last-child,.gal.g5>:last-child{grid-column:1/-1;justify-self:center;width:calc(50% - 6px)}
.gitem{overflow:hidden;border-radius:var(--r);background:${P.surface}}
.gal{align-items:start}.gitem img{width:100%;height:auto;display:block;transition:transform .5s ease}.gal.uni .gitem img{aspect-ratio:var(--galr);object-fit:cover}
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
/* Consent. Left aligned and full width on purpose: a centred wall of small print reads as
   decoration, and this is the text that has to be legible if anyone ever asks what the
   visitor agreed to. Generous tap target on the box itself for phones. */
/* THE CONSENT BLOCK NEEDS AIR ON BOTH SIDES, AND THE SIDE THAT MATTERS IS THE BOTTOM.
   Shipped first with only a top margin, which left the second checkbox sitting flush against
   the submit button (Bryson, 2026-09-01: "the check boxes are to close to the get my free
   quote button"). Two problems with that, and the second is the real one: it reads as clutter,
   and a tick box a few pixels above the thing someone is about to tap is a mis-tap waiting to
   happen. Ticking a consent box by accident is not a cosmetic bug.
   Spacing lives on the wrapper so the gap before the button is one number, not a guess about
   which element happens to follow (the two form variants differ: one has an error row next). */
.consbox{margin:16px 0 20px}
.cons{display:flex;align-items:flex-start;gap:9px;margin-top:11px;text-align:left}
.cons:first-child{margin-top:0}
.cons input{width:18px;height:18px;min-width:18px;margin:1px 0 0;accent-color:${P.brand};cursor:pointer}
.cons label{font-size:12px;line-height:1.5;color:${P.muted};cursor:pointer}
.cons label b{color:${P.text};font-weight:600}
/* The texting box is the one that gates the instant reply, so it must not look like the
   optional one beside it. Registered consent wording runs long, so it gets real line height. */
.cons-main label{font-size:13px;color:${P.text};line-height:1.55}
.cons-main input{width:20px;height:20px;min-width:20px}
/* The policy links have to be visibly links. A carrier or a reviewer looking for them should
   not have to hunt, and underlined-on-a-muted-line is the convention people already read. */
.cons label a{color:${P.text};text-decoration:underline}
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
/* ── reveal / motion ─────────────────────────────────────────────────────────
   Bryson, 2026-09-02: "can we also add micro animations so they dont feel stale
   (do this for every one)". Two rules govern everything in this block, and both
   exist because of failures this project has already had.

   1. NOTHING HERE IS LOAD-BEARING. Every element's resting state is its
      finished, visible state, and motion is only ever layered on top. So a page
      with JavaScript off, a page whose animation never fires, and a visitor whose
      system asks for reduced motion all render COMPLETE. The one exception is
      .reveal, which is gated behind the .js class, backed by a 1.5s safety net
      that shows everything regardless, and explicitly unwound in the reduced-motion
      block at the end. That exception already bit this file once, when scroll
      reveals left whole sections blank in a non-scrolling context.
   2. ANYTHING THAT LOOPS ANIMATES TRANSFORM OR OPACITY ONLY. Those two the browser
      hands to the graphics card. Width, height, top, left and background-position
      make it re-measure the page every frame instead, which on a phone reads as a
      stutter in the middle of somebody reading, on the one page we are paying for
      clicks to. Hover and focus effects are exempt: they are brief and only ever
      one element at a time. */
/* THE REVEAL MOVES WITH translate, NOT transform, AND THAT IS THE WHOLE POINT.
   Nearly every element that reveals is also an element you can hover: cards, chips, steps,
   review tiles. .js .reveal.in outranks .bcard:hover on specificity, so while the reveal
   owned transform it pinned it to none and EVERY HOVER LIFT ON THE PAGE SILENTLY DID
   NOTHING. The rules were all there and read correctly; the cards just never moved.
   translate is a separate property the browser composes with transform, so the two jobs
   stop competing: the reveal owns translate, every hover and press owns transform.
   It also makes sideways reveal movement structurally impossible, since --rv is now a
   single Y offset fed into translate:0 var(--rv) rather than a whole transform string. */
.js .reveal{opacity:0;translate:0 var(--rv)}
.js .reveal.in{opacity:1;translate:none;transition:opacity .6s ease,translate .6s ease}
.js .an{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
.mo-down .an{animation-name:drop}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes drop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
/* The header settles when you leave the hero, so the page feels like it is moving
   under a fixed frame rather than sliding as one flat sheet. stuck is added by
   script; without script the header simply stays in its resting state. */
.hdr{transition:box-shadow .25s ease}
.hdr .wrap{transition:padding .25s ease}
.hdr.stuck{box-shadow:0 6px 22px rgba(0,0,0,.10)}
.hdr.stuck .wrap{padding:8px 20px}
/* The hero glow drifts. This is the one continuous movement on the page and it is
   deliberately the slowest thing on it: it should register as the page being alive,
   never as something asking to be looked at. Transform only, and the hero already
   clips its overflow, so the drift can never widen the page. */
.hero::before{animation:drift 26s ease-in-out infinite alternate;will-change:transform}
@keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(0,3.2%,0) scale(1.06)}}
/* The photo hero has no glow to drift, so its scrim breathes instead. Opacity is
   free to animate and the light over the photo shifts by a few percent. */
.hero-ov-scrim{animation:scrim 13s ease-in-out infinite alternate}
@keyframes scrim{from{opacity:1}to{opacity:.87}}
.hero-media .badge{animation:float 5.6s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
/* Buttons: a light sweeps across on hover, and the press is acknowledged. A button
   that visibly answers a press feels responsive even when the network is slow. */
.cta{overflow:hidden}
.cta:not(.ghost)::before{content:"";position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.34),transparent);transform:translateX(-220%) skewX(-18deg);opacity:0;pointer-events:none}
.cta:not(.ghost):hover::before{animation:sheen .75s ease-out}
@keyframes sheen{0%{transform:translateX(-220%) skewX(-18deg);opacity:1}100%{transform:translateX(340%) skewX(-18deg);opacity:0}}
.cta:active{transform:translateY(0) scale(.985)}
/* While the form is sending. The spinner is a pseudo-element so the script can keep
   using textContent for the label without wiping it. */
.cta.sending::after{content:"";width:15px;height:15px;flex-shrink:0;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .65s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.hdr-cta{transition:transform .18s ease,background-color .18s ease}
.hdr-cta:hover{transform:translateY(-1px)}
/* THE STICKY BAR STANDS DOWN WHEN A REAL BUTTON IS ON SCREEN. Bryson, 2026-09-02:
   *"make sure at the bottom of the page for mobile that there isnt two buttons like
   there is now [...] when your at the very top where there is a button or the very
   bottom where there is a button I want the one that stays at the bottom of the
   screen to disappear."* At the top the hero button and the sticky bar sat one above
   the other saying the same words, and again at the closing button. Two identical
   calls to action touching each other read as a mistake, and the sticky one is the
   one that has no reason to be there at that moment.
   It slides down rather than vanishing, so it never blinks in and out mid-scroll.
   Default is VISIBLE and the class is only ever added by script, so a phone with no
   JavaScript keeps the bar it has always had. */
.mcta{transition:transform .25s ease,opacity .25s ease}
.mcta.tuck{transform:translateY(115%);opacity:0;pointer-events:none}
.mcta a{transition:transform .15s ease}
.mcta a:active{transform:scale(.97)}
/* Everything a visitor can point at answers back. */
.chip{transition:transform .18s ease,border-color .18s ease}
.chip:hover{transform:translateY(-2px);border-color:${P.tint}}
.step,.rev{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.step:hover,.rev:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(0,0,0,.14);border-color:${P.tint}}
.faq{transition:border-color .2s ease}
.faq:hover{border-color:${P.tint}}
.bico{transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.bcard:hover .bico,.brow:hover .bico,.step:hover .num{transform:translateY(-2px) scale(1.07)}
.step .num{transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.brow{transition:background-color .2s ease}
.brow:hover{background:${P.surface}}
.bnum .bn{transition:opacity .25s ease,transform .25s ease}
.bnum:hover .bn{opacity:.85;transform:translateY(-2px)}
/* The FAQ marker TURNS instead of swapping glyph. It stays a plus and rotates 45
   degrees into a cross, so the change is one continuous movement rather than one
   character blinking into another. Swapping the glyph would also have meant shipping
   an en dash to a visitor, which the no-AI-voice rule bans outright. */
.faq summary::after{transition:transform .25s ease}
.faq[open] summary::after{transform:rotate(45deg)}
.faq[open] p{animation:faqin .28s ease both}
@keyframes faqin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
/* The footer link draws its own underline. The consent links are left alone on
   purpose: they are underlined at rest because someone auditing what a visitor
   agreed to should not have to hover to find them. */
.foot a{background-image:linear-gradient(currentColor,currentColor);background-size:0 1px;background-repeat:no-repeat;background-position:0 100%;transition:background-size .25s ease}
.foot a:hover{background-size:100% 1px}
/* THE OFF SWITCH. !important rather than source order, because this block is easy
   to move by accident and it has to win from anywhere.
   ::before AND ::after ARE LISTED SEPARATELY BECAUSE * DOES NOT MATCH THEM. The bare
   universal selector matches elements only, so the drifting hero glow, the button sheen
   and the sending spinner all kept running for a visitor who had asked their computer
   for less motion. Found in a real browser, not by reading this; every one of those
   three lives on a pseudo-element, so the omission covered the entire motion layer.
   .reveal needs its own line: it is the only thing here whose resting state is invisible,
   so removing its transition alone would freeze it hidden forever. */
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.js .reveal{opacity:1!important;translate:none!important}}
@media(min-width:720px){.bene.g2,.benum.g2,.bene.g4,.benum.g4{grid-template-columns:repeat(2,1fr)}.bene.g3,.benum.g3,.bene.g5,.benum.g5{grid-template-columns:repeat(3,1fr)}.steps{grid-template-columns:repeat(3,1fr)}.gal{grid-template-columns:repeat(3,1fr)}.revs{grid-template-columns:repeat(3,1fr)}.gal.g1{grid-template-columns:1fr}.gal.g2,.gal.g4{grid-template-columns:repeat(2,1fr)}.gal.g3,.gal.g5{grid-template-columns:repeat(3,1fr)}.gal.g3>:last-child,.gal.g5>:last-child{grid-column:auto;justify-self:stretch;width:auto}}
/* Four cards open out to a single row of four only when the container is genuinely wide
   enough to keep them readable. This block MUST stay after the 720px one: same specificity,
   so source order decides, and put earlier it loses and never applies at all. Numbered
   benefits are excluded on purpose, they lay out sideways and need the width. */
@media(min-width:940px){.hero{padding:64px 0 56px}.hero-g.has-img{grid-template-columns:1.05fr .95fr}.form-g{grid-template-columns:.9fr 1.1fr;gap:44px}}
@media(min-width:1100px){.bene.g4{grid-template-columns:repeat(4,1fr)}}
@media(max-width:719px){.mcta{display:flex}body{padding-bottom:76px}.hdr-cta{display:none}.hero-ov{min-height:440px}}
`;

  // ── hero (3 layouts) ──
  // Same rule as the "Serving one town" claim below: a business that sells remotely must
  // not head its own page as a local service. Only the fallback changes, a real niche is
  // still printed as given.
  const eyebrowText = lp.eyebrow != null ? String(lp.eyebrow)
    // A shop that posts orders anywhere is not a "Trusted local service", and a visitor who
    // reads that on a page selling a bottle they want shipped to them has been told the wrong
    // thing about the business in the first three words on the page.
    : (cl.niche || (shopping ? "Shop direct" : national ? "Marketing that brings you customers" : "Trusted local service"));
  const eyebrowH = eyebrowText ? `<div class="eyebrow an">${esc(eyebrowText)}</div>` : "";
  const headlineH = `<h1 class="headline an" style="animation-delay:.06s">${esc(lp.headline)}</h1>`;
  const subH = `<p class="subhead an" style="animation-delay:.12s">${esc(lp.subheadline || "")}</p>`;
  // 🔴 THE SAME PROMISE TWICE IS NOT TWICE THE PROMISE. Bryson, 2026-09-15: *"also make sure
  // information isnt listed twice."* True of every page this file has ever rendered: a client's
  // town appeared in the trust row, again in the chip row and again in the footer.
  //
  // ONE key function and ONE running set, shared by the trust row and the chip row below.
  // Writing a second copy of this for the chips is the same mistake in miniature.
  //
  // Matched on EXACT normalised equality, never on a substring. Lowercase, strip the tick and
  // a leading "Serving", drop punctuation. Enough to see that "Eugene, OR" and "Serving
  // Eugene, OR" are one fact, and deliberately too strict to notice that "Free quotes" and
  // "Free quote, no obligation" are nearly one: dropping a line off a live client's page
  // because it merely RESEMBLED another is a worse failure than printing one twice.
  const dedupKey = (t) => String(t || "")
    .replace(/&#10003;|\u2713/g, " ").toLowerCase()
    .replace(/^\s*serving\s+/, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  // A bullet already on the page wins over a chip or a trust bit, because the bullet is the
  // one with room to explain itself.
  const said = new Set((bullets || [])
    .map((b) => dedupKey(typeof b === "string" ? b : (b && b.text) || "")).filter(Boolean));
  const fresh = (t) => { const k = dedupKey(t); if (!k || said.has(k)) return false; said.add(k); return true; };
  const trustBits = (ownTrust
    ? ownTrust
    : shopping
      ? [area || reach || "", "&#10003; Ships straight to you", "&#10003; Cancel any time"]
      : [area || reach || "", "&#10003; Free quotes", phone ? "Fast response" : ""])
    .filter(Boolean)
    .filter(fresh)
    .map((t) => `<span><b>${/&#10003;/.test(t) ? t : esc(t)}</b></span>`).join("");
  const trustH = trustBits ? `<div class="trust an" style="animation-delay:.24s">${trustBits}</div>` : "";
  const ctasH = `<div class="ctarow an" style="animation-delay:.18s"><a class="cta" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a>${phone ? `<a class="cta ghost" href="${telHref}">Call now</a>` : ""}</div>`;
  // 🔴 A RAW .slice(0, 40) PRINTED THE OWNER'S TYPED NOTE, CHOPPED MID-WORD, ON A LIVE
  // PAGE. Same defect already fixed in the ad writers. `fitPhrase` trims to a whole
  // thought and returns nothing when it cannot, so the badge is HIDDEN rather than
  // showing half a sentence. No badge beats a broken one.
  const badgeText = fitPhrase(differentiator || offer, 44);
  const badgeH = badgeText ? `<div class="badge"><span class="bdot">✓</span><span>${esc(badgeText)}</span></div>` : "";

  // 🔴 SMS CONSENT. Shaun Smith, 2026-08-29, on why this decides whether a campaign is worth
  // running at all: *"If the form doesn't carry a consent checkbox, the lead still lands in
  // the CRM and Sebastian still sees it, but it gets no text. The one-minute response that
  // makes ad leads convert never happens, and the campaign quietly loses the thing we both
  // want from it."* Nothing anywhere in this system collected it before.
  //
  // Neither box is pre-ticked and neither is `required`. A box the visitor never touched is
  // not consent, it is the appearance of consent, which is worse than none. And marketing
  // consent must never gate the form: an untouched form still produces a lead, it just
  // produces one nobody may text. The rules and the wire format live in ../lib/sms-consent.mjs.
  //
  // The business is named in the text rather than "we", because the person reading it is on
  // the client's own domain and has never heard of BoldLine.
  //
  // 🔴 AND THE THREE LINKS, WHICH ARE A CARRIER REQUIREMENT AND NOT A NICETY. Shaun, on the
  // same spec: the consent language has to link the client's privacy policy, terms, and a
  // text-message consent page, *"exactly as written"* including any `.html`, because the
  // extensionless versions often do not resolve. A2P registration is checked against these,
  // so a checkbox without them collects consent the carrier will not honour. They also
  // satisfy Google's own landing page policy, so the one row does two jobs.
  //
  // Only the ones actually filled in are rendered. A client who does not text their leads
  // leaves all three blank and simply gets no link line, rather than a dead link on a live
  // page, which is the worse of the two failures.
  const policyLinks = [
    [cs.privacyUrl, "Privacy Policy"],
    [cs.termsUrl, "Terms"],
    [cs.smsOptInUrl, "Text Message Consent"],
  ].filter(([u]) => String(u || "").trim().startsWith("http"))
    .map(([u, label]) => `<a href="${esc(String(u).trim())}" target="_blank" rel="noopener">${label}</a>`);
  const policyLine = policyLinks.length
    ? ` See ${policyLinks.length > 1
        ? `${policyLinks.slice(0, -1).join(", ")} and ${policyLinks[policyLinks.length - 1]}`
        : policyLinks[0]}.`
    : "";

  // 🔴 THE TICK BOX IS BACK, AND THE ROUND TRIP IS THE LESSON WORTH KEEPING.
  //
  // It became a line of small print under the button on 2026-09-03 at Bryson's request, on the
  // reasoning that nobody should have to tick a box to be answered by the business they just
  // wrote to. That reasoning is sound in general. It was wrong HERE, and Shaun Smith caught it
  // the same day:
  //
  //   *"What is live now says 'by submitting this form you agree that Stencil & Thread may
  //   text you,' which makes texting a condition of getting a quote. That is the opposite of
  //   what is filed with the carriers for Sebastian's number, and they audit the live page
  //   against the filing."*
  //
  // 🔴 THE PAGE MUST MATCH WHAT WAS FILED, AND THE FILING SAYS "OPTIONAL". His registered
  // wording contains the words *"Optional, not required to get a quote"*. A sentence saying
  // "optional" under a button that opts everyone in is not a weaker consent record, it is a
  // FALSE one: the reader is told they have a choice and is then recorded as having made it.
  // His instruction to keep that wording AND set every submitter to yes cannot both hold. The
  // only version that is true is the one where the words and the mechanism agree, which means
  // a box the visitor actually ticks.
  //
  // 🔴 SO THE GENERAL RULE, WHICH OUTLIVES THIS CLIENT: the consent wording is not ours to
  // word. It is whatever that business filed with the carriers, and the mechanism on the page
  // has to match the promise in that wording. `smsConsentText` exists so the next client whose
  // filing reads differently is a paste, not a code change.
  const consentDefault = `Text me updates about my quote and order from ${name || "us"}. Optional, not required to get a quote. Msg frequency varies, msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
  const consentText = String(cs.smsConsentText || "").trim() || consentDefault;

  // 🔴 ONLY WHERE THE BUSINESS CAN ACTUALLY SEND. The rule above is that the wording belongs to
  // whatever that business filed with the carriers; a business that has filed nothing and
  // cannot send a message has no wording to show and no consent to collect. Undefined keeps
  // today's behaviour exactly, so no client page changes; `false` is set deliberately, and is
  // set for BoldLine's own audience pages because Twilio there is still a free trial.
  const showConsent = cs.smsConsent !== false;
  // 🔴 AND THE RECORD GOES WITH THE BOX. The submit script sends `consentDisclosure`, a copy of
  // the exact words shown, so a lead carries proof of what its person agreed to. With no box on
  // the page there were no such words, and sending them anyway would file a record saying a
  // disclosure was made that the visitor never saw. That is the same falseness the note above
  // rejects, arriving from the other direction.

  const consentHTML = !showConsent ? "" : `<div class="consbox"><div class="cons cons-main">
      <input type="checkbox" id="lf-sms" name="smsConsentTransactional" value="yes">
      <label for="lf-sms">${esc(consentText)}${policyLine}</label>
    </div>
    <div class="cons">
      <input type="checkbox" id="lf-mkt" name="smsConsentMarketing" value="yes">
      <label for="lf-mkt">Send me occasional offers and updates too. Optional, and you can stop any time.</label>
    </div></div>`;

  // The lead form (single instance on the page) — reused in the hero (capture layout)
  // or in the bottom form section (all other layouts). id="lead-form" is the scroll target.
  const formCardHTML = `<div class="fcard reveal" id="lead-form">
    <div class="formtitle">${esc(cta)}</div>
    <div class="formsub">Takes 20 seconds. We'll be in touch shortly.</div>
    ${HO ? `<form id="lf" name="leads" method="POST" data-netlify="true" netlify-honeypot="company-website" action="?sent=1">
      <input type="hidden" name="form-name" value="leads">
      <p style="display:none"><label>Do not fill this in: <input name="company-website"></label></p>
      <input class="inp" name="name" placeholder="Your name" required>
      <input class="inp" name="phone" placeholder="Phone number">
      <input class="inp" name="email" type="email" placeholder="Email address">
      <div class="fine" style="margin:-2px 0 4px">Phone or email, whichever you prefer.</div>
      ${consentHTML}
      <button class="cta" type="submit" style="width:100%;justify-content:center">${esc(cta)}</button>
      <div class="fine">Your info stays private. No spam, ever.</div>
    </form>` : `<form id="lf">
      <input class="inp" id="lf-name" placeholder="Your name" required>
      <input class="inp" id="lf-phone" placeholder="Phone number">
      <input class="inp" id="lf-email" type="email" placeholder="Email address">
      <div class="fine" style="margin:-2px 0 4px">Phone or email, whichever you prefer.</div>
      ${consentHTML}
      <div class="err" id="lf-err">Something went wrong, please try again.</div>
      <button class="cta" type="submit" id="lf-btn" style="width:100%;justify-content:center">${esc(cta)}</button>
      <div class="fine">Your info stays private. No spam, ever.</div>
    </form>`}
    <div class="thanks" id="lf-thanks"><h2>Got it, thank you.</h2><p>We'll be in touch shortly.</p></div>
  </div>`;

  let heroSection;
  // 🔴 THE CAPTURE LAYOUT IS A FORM IN THE HERO. On a shop there is no form, so that layout has
  // nothing to put there and would render an empty panel beside the headline. It falls back to
  // the split layout, which is the same page without the hole.
  if (useCapture && !shopping) {
    const callLine = phone ? `<div class="ctarow an" style="animation-delay:.2s"><a class="cta ghost" href="${telHref}">Call ${esc(phone)}</a></div>` : "";
    heroSection = `<section class="hero"><div class="wrap hero-g has-img"><div>${eyebrowH}${headlineH}${subH}${trustH}${callLine}</div><div class="hero-form reveal">${formCardHTML}</div></div></section>`;
  } else if (useOverlay) {
    heroSection = `<section class="hero hero-ov" style="--heroimg:url('${esc(hero.url)}')"><div class="hero-ov-scrim"></div><div class="wrap hero-ovc">${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div></section>`;
  } else if (useCentered) {
    const band = hero ? `<div class="wrap"><div class="heroband reveal"><img src="${esc(sized(hero.url, 1600))}" alt="${esc(name)}"></div></div>` : "";
    heroSection = `<section class="hero"><div class="wrap hero-c">${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div>${band}</section>`;
  } else {
    const media_ = hero ? `<div class="hero-media reveal"><img class="heroimg" src="${esc(sized(hero.url, 1600))}" alt="${esc(name)}">${badgeH}</div>` : "";
    heroSection = `<section class="hero"><div class="wrap hero-g${hero ? " has-img" : ""}"><div>${eyebrowH}${headlineH}${subH}${ctasH}${trustH}</div>${media_}</div></section>`;
  }

  // ── benefits (3 styles) ──
  const parsed = bullets.map((b) => {
    // Split at the FIRST separator only. Rejoining the tail put an em dash straight back
    // into the visitor's copy whenever a line contained two of them, which is exactly the
    // character the no-AI-voice rule bans.
    const raw = String(b); const at = raw.search(/[\u2014\u2013:]/);
    return at < 0 ? { h: raw.trim(), p: "" } : { h: raw.slice(0, at).trim(), p: raw.slice(at + 1).trim() };
  });
  // 🔴 NEVER LEAVE ONE ITEM ALONE ON A ROW. Bryson, 2026-09-01, with a screenshot of four
  // benefits in a three-wide grid: three across, then a lone fourth hanging under the left
  // edge. The grid was a fixed `repeat(3,1fr)` regardless of how many items the writer
  // produced, and the writer is asked for "3-4", so a stranded fourth was the common case
  // rather than an edge case.
  //
  // The column count follows the item count instead. Four go two-by-two, which reads as
  // deliberate, and open out to four across only when there is genuinely room. Five fall to
  // three-then-two, which is a full row and a pair rather than a row and an orphan.
  const gridFor = (n) => (n <= 1 ? "g1" : n === 2 ? "g2" : n === 4 ? "g4" : n === 5 ? "g5" : "g3");

  let benefitsInner, benefitsAlt = true;
  if (D.benefits === "list") {
    benefitsInner = `<div class="belist">${parsed.map((x, i) => `<div class="brow reveal" style="transition-delay:${i * 50}ms"><div class="bico">✓</div><div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div></div>`).join("")}</div>`;
    benefitsAlt = false;
  } else if (D.benefits === "numbered") {
    benefitsInner = `<div class="benum ${gridFor(parsed.length)}">${parsed.map((x, i) => `<div class="bnum reveal" style="transition-delay:${i * 60}ms"><div class="bn">${String(i + 1).padStart(2, "0")}</div><div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div></div>`).join("")}</div>`;
  } else {
    benefitsInner = `<div class="bene ${gridFor(parsed.length)}">${parsed.map((x, i) => `<div class="bcard reveal" style="transition-delay:${i * 60}ms"><div class="bico">✓</div><h3>${esc(x.h)}</h3>${x.p ? `<p>${esc(x.p)}</p>` : ""}</div>`).join("")}</div>`;
  }
  const benefitsSection = `<section class="sec${benefitsAlt ? " alt" : ""}"><div class="wrap"><div class="sec-head reveal"><div class="sec-k">Why us</div><h2 class="sec-t">Why choose ${esc(name)}</h2></div>${benefitsInner}</div></section>`;

  const stepsSection = `<section class="sec"><div class="wrap"><div class="sec-head reveal"><div class="sec-k">How it works</div><h2 class="sec-t">Getting started is easy</h2></div><div class="steps">${steps.map((s, i) => `<div class="step reveal" style="transition-delay:${i * 70}ms"><div class="num">${i + 1}</div><h3>${esc(s)}</h3></div>`).join("")}</div></div></section>`;

  const gallerySection = photos.length >= 2 ? `<section class="sec"><div class="wrap"><div class="sec-head reveal"><div class="sec-k">Our work</div><h2 class="sec-t">See the results</h2></div><div class="gal ${gridFor(photos.length)}">${photos.map((p, i) => `<div class="gitem reveal" style="transition-delay:${i * 60}ms"><img src="${esc(sized(p.url, 1100))}" alt="${esc(photoAlt(p, cl.name))}"${i < GALLERY_EAGER ? '' : ' loading="lazy"'} decoding="async"></div>`).join("")}</div></div></section>` : "";

  const offerSection = offer ? `<section class="sec"><div class="wrap"><div class="offer reveal"><div class="ok">Limited-time offer</div><h2>${esc(offer)}</h2><a class="cta" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a></div></div></section>` : "";

  // ─── EVERY PHOTO ON THIS PAGE IS RESIZED ON THE WAY OUT ──────────────────────
  //
  // Bryson, 2026-09-08, on Sebastian's live page: *"the images are showing up like this"*,
  // with three broken-image icons and the filenames showing through as alt text.
  //
  // 🔴 NOTHING WAS BROKEN. The files were public, valid and served 200. They were three
  // photos straight off an iPhone 13 Pro — 12 megapixels each, 13MB between them, on one
  // page, on a phone. Safari gave up before they finished and painted the broken icon,
  // which looks exactly like a dead link and is nothing of the sort. The most expensive
  // kind of bug: the page is live, the client is looking at it, and everything "works".
  //
  // Supabase can resize on delivery, so the fix applies to photos ALREADY uploaded rather
  // than only to the next ones. Same object, same bucket, rendered at a sane width, and it
  // negotiates WebP off the browser's own Accept header: 5.3MB became 72KB, 3.0MB became
  // 261KB, the page went from 13MB to under half a megabyte.
  //
  // 🔴 It rewrites ONLY our own storage URLs. A link typed in by hand, or an image hosted
  // anywhere else, is passed through exactly as given.
  // Reviews — REAL ones only, from the owner-entered client.reviews (one per line, "quote — Name"). Never AI-fabricated.
  const reviewList = String(cl.reviews || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => {
    // Split on the LAST delimiter so a quote may itself contain dashes.
    //
    // 🔴 A PLAIN HYPHEN COUNTS TOO, AS OF 2026-09-08, because clients now type these
    // themselves in their portal and nobody reaches for an em dash on a phone keyboard.
    // Whitespace on both sides is required, so "top-notch" inside a quote is never a split.
    // The hyphen carries a guard the other delimiters do not: a trailing chunk only becomes
    // a NAME if it is short and unpunctuated. Otherwise "they came out same day - amazing"
    // would credit the review to a customer called Amazing. Em dash, en dash and pipe keep
    // their old behaviour exactly, because owner-entered lines already rely on it.
    let m = l.match(/^(.*\S)\s+[—–|]\s+([^—–|]+)$/);
    if (!m) {
      const h = l.match(/^(.*\S)\s+-\s+([^-]+)$/);
      const tail = h ? h[2].trim() : "";
      // A NAME, not a trailing clause: short, few words, and starting with a capital. A
      // final full stop is allowed and must be, because "Maria B." is a surname initial and
      // rejecting it threw away the commonest real case of all. What this keeps out is
      // "they came out same day - and the price was fair", which would otherwise credit the
      // review to a customer called "and the price was fair".
      const looksLikeName = tail.length <= 40 && tail.split(/\s+/).length <= 5
        && /^[A-Z0-9]/.test(tail) && !/[!?,;:]$/.test(tail);
      if (h && looksLikeName) m = h;
    }
    const q = (m ? m[1] : l).replace(/^["'“]+|["'”]+$/g, "").trim();
    return { q, who: m ? m[2].trim() : "" };
  });
  const reviewsSection = reviewList.length ? `<section class="sec alt"><div class="wrap"><div class="sec-head reveal"><div class="sec-k">Reviews</div><h2 class="sec-t">What clients say</h2></div><div class="revs">${reviewList.map((r, i) => `<div class="rev reveal" style="transition-delay:${i * 70}ms"><div class="stars">★★★★★</div><p>${esc(r.q)}</p>${r.who ? `<div class="who">${esc(r.who)}</div>` : ""}</div>`).join("")}</div></div></section>` : "";

  // FAQ — AI-written honest Q&A (no fabricated specifics). Native <details> accordion, no JS.
  const faqs = Array.isArray(lp.faqs) ? lp.faqs.filter((f) => f && f.q && f.a).slice(0, 6) : [];
  const faqSection = faqs.length ? `<section class="sec"><div class="wrap"><div class="sec-head reveal"><div class="sec-k">FAQ</div><h2 class="sec-t">Common questions</h2></div><div class="faqwrap">${faqs.map((f, i) => `<details class="faq reveal" style="transition-delay:${i * 55}ms"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></div></section>` : "";

  const orders = {
    a: [benefitsSection, reviewsSection, stepsSection, gallerySection, faqSection, offerSection],
    b: [benefitsSection, gallerySection, reviewsSection, offerSection, faqSection, stepsSection],
    c: [offerSection, benefitsSection, reviewsSection, gallerySection, faqSection, stepsSection],
    d: [benefitsSection, gallerySection, stepsSection, reviewsSection, faqSection, offerSection],
  };
  const middle = (orders[D.order] || orders.a).filter(Boolean).join("\n");

  // Bottom conversion block: the full form section for most layouts; for the capture
  // layout (form already in the hero) a slim closing CTA that scrolls back to it.
  // 🔴 A SHOP'S CLOSING BLOCK SENDS THEM TO THE SHOP. The lead-gen version fills the screen with
  // a form and the words "no pressure, no obligation, we'll get right back to you" — three
  // promises about a conversation that is not going to happen, on a page whose only job is to
  // get the visitor to the buy button.
  const bottomBlock = shopping
    ? `<section class="formsec"><div class="wrap" style="text-align:center"><h2 class="form-copy-h2" style="font-size:clamp(22px,3vw,30px);font-weight:850;color:${P.headline};margin-bottom:8px">${esc(lp.closingHeadline || "Ready when you are")}</h2><p style="color:${P.muted};margin-bottom:20px">${esc(lp.closingLine || "Takes a minute, and it ships straight to you.")}</p><a class="cta" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a></div></section>`
    : useCapture
    ? `<section class="formsec"><div class="wrap" style="text-align:center"><h2 class="form-copy-h2" style="font-size:clamp(22px,3vw,30px);font-weight:850;color:${P.headline};margin-bottom:8px">Ready to get started?</h2><p style="color:${P.muted};margin-bottom:20px">No pressure and no obligation. Get your free quote today.</p><a class="cta" href="#lead-form">${esc(cta)}</a></div></section>`
    : `<section class="formsec"><div class="wrap"><div class="form-g">
  <div class="form-copy reveal">
    <h2>Ready to get started?</h2>
    <p>Fill out the form and we'll get right back to you. No pressure, no obligation.</p>
    <ul class="rlist">${readyList.map((t, i) => `<li><span class="rk">${i + 1}</span><span>${esc(t)}</span></li>`).join("")}</ul>
  </div>
  ${formCardHTML}
</div></div></section>`;

  // ── Form behaviour, chosen once ──────────────────────────────────────────
  // Managed: JS posts to lead-intake on BoldLine's domain.
  // Hand-off: no JS at all. The browser posts natively to Netlify Forms on the CLIENT's
  // own site, which then reloads with ?sent=1 — that is where the thank-you state and
  // their conversion fire. Fewer moving parts is the point: there is nobody left to fix
  // it if it breaks.
  // 🔴 THE CLICK ID HAS TO BE GRABBED HERE, WEEKS BEFORE ANYONE KNOWS THE LEAD IS GOOD.
  // Google can only credit a sale back to the ad that caused it if the lead carries the
  // `gclid` from the click that brought them in. Nobody will know whether this lead was
  // worth having for another week or two, and by then the query string is long gone. So
  // it is read on arrival, kept in this browser for 90 days (Google's own matching
  // window) so a visitor who comes back and converts later is still attributed, and sent
  // along with the form. `wbraid` and `gbraid` are what Google sends instead when the
  // browser blocks the usual one, mostly on iPhones. Missing them loses about half.
  //
  // The UTM tags ride along on the same machinery for the same reason: they are in the URL
  // on arrival and gone once the visitor clicks anything. They do a different job though.
  // Google never reads them back, so they can never stand in for a click id. They exist so
  // a person looking at an order weeks later can see which campaign produced it, which is
  // exactly what Sebastian's CRM wants to store against the contact.
  // 🔴 ONLY A CLICK ID SETS `clickAt`. That timestamp decides whether an outcome is still
  // inside Google's 90 day matching window at upload time, and a UTM tag proves nothing
  // about a Google click. Letting one stamp the clock would quietly age a lead that Google
  // was never going to match anyway.
  const clickJS = `
  var CK=${JSON.stringify(CLICK_KEYS)},UK=${JSON.stringify(UTM_KEYS)};
  function remember(k,qs,now){
    var v=qs.get(k);
    if(v){try{localStorage.setItem('bl_'+k,JSON.stringify({v:v,t:now}));}catch(e){}return v;}
    try{var s=JSON.parse(localStorage.getItem('bl_'+k)||'null');if(s&&s.v&&(now-s.t)<90*864e5)return s.v;}catch(e){}
    return '';
  }
  function clickIds(){
    var out={},qs=new URLSearchParams(location.search),now=Date.now();
    CK.forEach(function(k){
      var v=remember(k,qs,now);
      if(v)out[k]=v;
      if(v&&!out.clickAt){
        var t=now;try{var s2=JSON.parse(localStorage.getItem('bl_'+k)||'null');if(s2&&s2.t)t=s2.t;}catch(e){}
        out.clickAt=new Date(t).toISOString();
      }
    });
    UK.forEach(function(k){var v=remember(k,qs,now);if(v)out[k]=v;});
    return out;
  }
  try{clickIds();}catch(e){}`;

  // ── 🔴 META'S PIXEL, WITHOUT WHICH A META CAMPAIGN IS BUYING BLIND ─────────────
  //
  // Found 2026-09-22 on Bryson's own car-detailer ad, which had spent real money for zero
  // leads. Every generated page carried Google's tag and NOTHING for Meta. Two consequences,
  // and the second is the expensive one:
  //   1. Meta cannot COUNT a lead on the page, so the campaign reports zero whatever happens.
  //   2. Meta cannot OPTIMISE. With no conversion signal it has no idea who converts, so it
  //      buys the cheapest clicks it can find rather than the people who fill the form in.
  // That is not a reporting nicety. It is the difference between a campaign that learns and
  // one that spends.
  //
  // 🔴 IT MUST NEVER LOAD IN A PREVIEW, and this is the standing rule about previews rather
  // than a nicety too. The OS renders this same page into an iframe so Bryson can look at it.
  // A pixel that initialises there sends a real PageView to a real Meta account from a page
  // nobody visited, which pollutes the data the campaign optimises on and can feed an
  // audience. An `iframe srcdoc` has an `about:` URL, which is the same test the submit
  // handler below already uses, so the guard is one this file has already proven.
  //
  // Digits only: a pasted id routinely arrives with stray spaces or quotes around it, and a
  // malformed id in this snippet is a script error that takes the rest of the page's scripts
  // down with it.
  const metaPixelId = String((cl && cl.metaPixelId) || "").replace(/[^0-9]/g, "");
  const metaPixelTag = metaPixelId ? `<script>
(function(){if(String(location.href).indexOf('about:')===0)return;
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');})();
</script>` : "";

  // Reported in the SAME place as the Google conversion, which is inside the success branch
  // after the lead is actually saved. Firing on submit instead would tell Meta a lead happened
  // every time a bot tripped the honeypot or a request was refused, which is the exact bug that
  // once had Meta reporting two leads against one real one.
  const metaLead = metaPixelId ? `try{if(typeof fbq==='function'){fbq('track','Lead');}}catch(e){}` : "";

  // Fires the FORM SUBMISSION conversion, which is deliberately a secondary one in Google
  // (see ../lib/gads-conversions.mjs). It tells us the page works. It is not what the
  // account bids on, because a form fill and a real customer are not the same thing.
  const formConversion = (convId && formLabel)
    ? `try{if(typeof gtag==='function'){gtag('event','conversion',{'send_to':${JSON.stringify(convId + "/" + formLabel)}});}}catch(e){}`
    : `/* No conversion tag yet. Run Conversion Setup on this client so Google can see
         form submissions, otherwise the campaign is bidding blind. */`;

  // The managed form's submit handler. Everything below is SHIPPED VERBATIM into the client's
  // page, so the reasoning lives out here where a visitor viewing source never sees it. Three
  // things it does beyond the obvious, each of which has bitten once:
  //
  //  1. CONSENT IS SENT EVEN WHEN UNTICKED, as real booleans. The intake stores both keys
  //     either way, so a lead who declined stays distinguishable from a lead who was never
  //     asked, and that distinction is the entire gate on the auto-reply text.
  //  2. THE PAGE URL travels with the lead. Shaun's CRM spec asks for it, and it stops being
  //     obvious the moment a client runs more than one page.
  //  3. 🔴 A PREVIEW MUST NEVER CREATE A REAL LEAD. The OS renders this exact page in an
  //     iframe srcdoc carrying the real leadToken, same-origin with the OS, so a submit while
  //     checking a page over would put a phantom lead in the client's pipeline, text and email
  //     whatever was typed, and forward it to their CRM. A srcdoc document has no real URL, so
  //     an about: scheme is the tell, and the guard sits BEFORE the fetch. It is the SECOND
  //     lock, not the only one: measured in a browser, the OS preview omits allow-forms so the
  //     submit event never fires today. But that is an attribute in another file held up by
  //     habit, and adding allow-forms to make the preview feel alive is an obvious future edit.
  //     This is what makes that edit safe.
  //
  // (No backticks anywhere in the string below, comments included: it is a template literal
  // and one would terminate it and take the whole renderer down. That already happened once.)
  // ── 🔴 A PHONE NUMBER IS NOT WORTH A LOST LEAD ────────────────────────────────
  //
  // Both fields used to be "phone required, email optional". On cold traffic from an ad, from
  // somebody who had never heard of the business ninety seconds earlier, a required phone
  // number is the heaviest thing on the page: it is the field people close the tab over,
  // because handing a stranger your number feels like agreeing to be rung.
  //
  // So neither is required on its own, and ONE OF THE TWO is. A lead with no way to reach them
  // is not a lead, it is a row, and it would still be counted and still be billed. The rule is
  // enforced in the submit handler rather than with `required` on a field, because "required"
  // on both would demand both, and HTML has no way to say "either of these".
  const managedFormJS = `${clickJS}
  var lf=document.getElementById('lf');
  if(lf){lf.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=document.getElementById('lf-btn'),err=document.getElementById('lf-err');
    var ph=document.getElementById('lf-phone').value.trim(),em=document.getElementById('lf-email').value.trim();
    if(!ph&&!em){err.textContent='Please add a phone number or an email so we can reach you.';err.style.display='block';return;}
    err.textContent=${JSON.stringify("Something went wrong, please try again.")};
    err.style.display='none';btn.disabled=true;btn.classList.add('sending');btn.textContent='Sending…';
    var payload={name:document.getElementById('lf-name').value,phone:ph,email:em,source:'landing_page'};
    try{var sc=document.getElementById('lf-sms'),mc=document.getElementById('lf-mkt');
      payload.smsConsentTransactional=!!(sc&&sc.checked);payload.smsConsentMarketing=!!(mc&&mc.checked);
      ${showConsent ? `payload.consentDisclosure=${JSON.stringify(consentText)};` : ""}}catch(e){}
    try{payload.page=location.href.split('#')[0];}catch(e){}
    try{var ids=clickIds();for(var k in ids){payload[k]=ids[k];}}catch(e){}
    if(String(location.href).indexOf('about:')===0){
      document.getElementById('lf').style.display='none';
      document.getElementById('lf-thanks').style.display='block';
      return;
    }
    fetch('/lead?token=${encodeURIComponent(cl.leadToken || "")}',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }).then(function(r){if(!r.ok)throw 0;document.getElementById('lf').style.display='none';document.getElementById('lf-thanks').style.display='block';${formConversion}${metaLead}})
    .catch(function(){err.style.display='block';btn.disabled=false;btn.classList.remove('sending');btn.textContent=${JSON.stringify(cta)};});
  });}`;

  const conversionCall = (convId && formLabel)
    ? `if(typeof gtag==='function'){gtag('event','conversion',{'send_to':${JSON.stringify(convId + "/" + formLabel)}});}`
    : `/* No conversion tag was supplied, so Google receives no conversions from this page
         and the campaign cannot bid on them. Add one in Google Ads and paste it in. */`;
  const handoffFormJS = `
  try{
    if(location.search.indexOf('sent=1')>=0){
      var f=document.getElementById('lf'); if(f)f.style.display='none';
      var t=document.getElementById('lf-thanks'); if(t){t.style.display='block';t.scrollIntoView({block:'center'});}
      ${conversionCall}
    }
  }catch(e){}`;
  // 🔴 IN-PAGE LINKS MUST SCROLL, NOT NAVIGATE. Bryson, 2026-09-01: *"the get my free quote
  // button goes to my os which it shouldnt."* Reproduced rather than guessed at: the OS previews
  // this page in an `<iframe srcdoc>`, whose own document URL is `about:srcdoc`, so a bare
  // `href="#lead-form"` resolves against the PARENT document instead and the frame navigates to
  // the OS app. Confirmed in a headless browser, frame URL going from `about:srcdoc` to the OS
  // URL with `#lead-form` appended.
  //
  // The live page was never broken by this, but a preview that jumps to the OS the moment you
  // press the main button is a preview nobody can trust, and trusting it is the entire point of
  // having one. Handling the scroll in JS behaves identically in both places, and the plain
  // href stays as the fallback for a visitor with JS off, which only ever happens on the live
  // page where the fragment is correct anyway.
  // The header condenses once the visitor leaves the hero. Written without comments and
  // without modern syntax on purpose: this exact script is delivered verbatim to a hand-off
  // client's own domain, where their developer reads it and their visitors' browsers run it.
  // rAF-throttled and passive so it cannot make scrolling feel heavy, and every failure mode
  // simply leaves the header in its resting state, which is the state it ships in.
  const headerJS = `
  try{
    var hdr=document.querySelector('.hdr');
    if(hdr){
      var pending=false;
      var settle=function(){
        pending=false;
        var y=window.pageYOffset||document.documentElement.scrollTop||0;
        if(y>24){hdr.classList.add('stuck');}else{hdr.classList.remove('stuck');}
      };
      var onScroll=function(){if(pending)return;pending=true;(window.requestAnimationFrame||setTimeout)(settle,16);};
      window.addEventListener('scroll',onScroll,{passive:true});
      settle();
    }
  }catch(e){}`;
  // Hides the sticky mobile bar whenever any real call-to-action button is on screen.
  // Observed rather than measured on scroll: an observer fires only when something actually
  // crosses the edge, where a scroll handler would run on every frame of every scroll.
  const stickyJS = `
  try{
    var bar=document.querySelector('.mcta');
    var ctas=[];
    Array.prototype.forEach.call(document.querySelectorAll('.cta'),function(el){
      if(!bar||!bar.contains(el))ctas.push(el);
    });
    if(bar&&ctas.length&&window.IntersectionObserver){
      var seen=[];
      for(var i=0;i<ctas.length;i++)seen.push(false);
      var io2=new IntersectionObserver(function(es){
        es.forEach(function(e){
          var idx=ctas.indexOf(e.target);
          if(idx>=0)seen[idx]=e.isIntersecting;
        });
        var any=false;
        for(var j=0;j<seen.length;j++){if(seen[j]){any=true;break;}}
        if(any){bar.classList.add('tuck');}else{bar.classList.remove('tuck');}
      },{threshold:0});
      ctas.forEach(function(el){io2.observe(el);});
    }
  }catch(e){}`;
  const navJS = `
  try{
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'),function(a){
      a.addEventListener('click',function(e){
        var id=(a.getAttribute('href')||'').slice(1);
        var t=id&&document.getElementById(id);
        if(!t)return;
        e.preventDefault();
        try{t.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){t.scrollIntoView();}
      });
    });
  }catch(e){}`;
  // 🔴 THE REVEAL HAS TO KEEP HAPPENING, NOT HAPPEN ONCE.
  //
  // Bryson, 2026-09-02: *"make sure the up and down animation happens even after a person has
  // scrolled through the whole page"*. He was right, and the old version was worse than he
  // thought. It did two things that between them meant MOST OF THE PAGE NEVER ANIMATED AT ALL:
  // it un-observed each element the first time it appeared, so nothing could ever play twice,
  // and a blanket 1.5s safety net revealed EVERY element on the page whether it had been
  // reached or not. So on a real visit, anything below the first screenful was already marked
  // revealed before the visitor got anywhere near it, and simply sat there.
  //
  // That safety net is not optional, though: it is the only thing standing between us and the
  // bug it was added for, where a context nobody scrolls (the preview iframe, a screenshot,
  // a visitor who never moves) shows blank sections where the content should be. So the fix
  // is four pieces, and each of the four exists for one of the four ways this goes wrong:
  //
  //   1. REVEAL observer, tight margin. Adds `in` on entry. No unobserve, so it can fire again.
  //   2. RE-ARM observer, generous margin. Removes `in` once an element is EDGE px clear of the
  //      screen, which is where nobody can see it change. Its region strictly contains the
  //      reveal observer's, so the two can never fight over an element at the boundary.
  //   3. The 1.5s SAFETY NET, unchanged in what it guarantees: a context that never scrolls
  //      still ends up showing the whole page.
  //   4. FIRST SCROLL cancels the safety net and re-arms anything already off screen. This is
  //      the piece that makes 3 and 1 stop contradicting each other. Without it there are two
  //      broken visitors: one who scrolls before 1.5s (the net fires anyway and re-reveals
  //      everything below), and the slow reader who scrolls after it (the net has already run,
  //      and the re-arm observer will not fire again because those elements' intersection
  //      state never changed). Both end up with a dead page, which is exactly what he saw.
  // ─── ONE SHAPE FOR THE GALLERY, TAKEN FROM THE PHOTOS THEMSELVES ─────────────
  //
  // Bryson, 2026-09-09: *"add a rule to make sure they are all still uniform that way one
  // image isnt one size and shape and another image is completely different size and shape"*.
  // A ragged row of different-shaped tiles reads as unfinished on a page a stranger is
  // judging the business by.
  //
  // 🔴 THE SHAPE IS MEASURED, NOT CHOSEN, which is the whole difference from the two versions
  // that were wrong. Picking 4:3 cropped the print off portrait photos of shirts; picking a
  // square left grey bars. The MEDIAN of what this client actually uploaded fits most of
  // their photos exactly, so most tiles crop nothing at all, and only a genuine odd one out
  // is trimmed.
  //
  // 🔴 MEASURED IN THE BROWSER, because photos uploaded before today carry no stored size and
  // there is no second chance to ask the file. If the script never runs, the CSS above leaves
  // every photo at its own shape, which is safe and simply not uniform.
  // The median is clamped so one freak image cannot make every tile a letterbox or a tower,
  // and settle() runs immediately AND on every later load because the gallery images are
  // loading="lazy": below the fold, which on a phone is exactly where this gallery sits, a
  // lazy image is not complete at parse time and its load event does not fire until it is
  // scrolled to. The first version waited for all of them and therefore waited forever.
  //
  // 🔴 NO COMMENTS INSIDE THE STRING. It is delivered verbatim to the client's own domain
  // where their developer reads it, which is a standing rule and one the suite enforces.
  const galleryJS = `
  var gal=document.querySelector('.gal');
  if(gal){
    var ims=[].slice.call(gal.querySelectorAll('img'));
    var settle=function(){
      var rs=ims.map(function(i){return i.naturalWidth&&i.naturalHeight?i.naturalWidth/i.naturalHeight:0;})
                .filter(function(r){return r>0;}).sort(function(a,b){return a-b;});
      if(!rs.length) return;
      var m=rs.length%2?rs[(rs.length-1)/2]:(rs[rs.length/2-1]+rs[rs.length/2])/2;
      m=Math.max(0.62,Math.min(1.6,m));
      gal.style.setProperty('--galr',String(m.toFixed(3)));
      gal.classList.add('uni');
    };
    settle();
    ims.forEach(function(i){ i.addEventListener('load',settle); });
    window.addEventListener('load',settle);
  }
`;

  const revealJS = `  var els=[].slice.call(document.querySelectorAll('.reveal'));
  var EDGE=160;
  function showAll(){els.forEach(function(el){el.classList.add('in');});}
  function rearm(){
    var h=window.innerHeight||0;
    els.forEach(function(el){
      var r=el.getBoundingClientRect();
      if(r.top>h+EDGE||r.bottom< -EDGE)el.classList.remove('in');
    });
  }
  try{
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('in');});
    },{rootMargin:'0px 0px -6% 0px',threshold:0});
    var arm=new IntersectionObserver(function(es){
      es.forEach(function(e){if(!e.isIntersecting)e.target.classList.remove('in');});
    },{rootMargin:EDGE+'px 0px '+EDGE+'px 0px',threshold:0});
    els.forEach(function(el){io.observe(el);arm.observe(el);});
    var net=setTimeout(showAll,1500);
    var first=function(){
      window.removeEventListener('scroll',first);
      clearTimeout(net);
      rearm();
    };
    window.addEventListener('scroll',first,{passive:true});
  }catch(e){showAll();}`;

  // 🔴 CARRY THE AD'S TRACKING ACROSS TO THE SHOP. This is the line the billing rests on.
  //
  // Meta and Google hang their click ids (`fbclid`, `gclid`) on the URL of the ad, which lands
  // on THIS page. The shop never sees them unless they are passed on. Without them the shop
  // records an unattributed order, the platform cannot match the purchase to the click, and
  // nobody can show that a sale came from the ads — on an agreement that counts a Qualified
  // Sale from the client's own order records, that is the difference between getting paid and
  // not.
  //
  // The named tracking parameters the page was opened with are copied onto the store links,
  // and anything already on the link wins, so the defaults baked into the href are never
  // clobbered. With JavaScript off the href still carries its UTM tags, so the worst case is a
  // sale attributed to BoldLine generally rather than to one click.
  //
  // 🔴 A NAMED LIST, NOT THE WHOLE QUERY STRING — see STORE_FORWARD_KEYS. Copying everything
  // would let a stranger append a parameter of their choosing to a link our ads pay for, and
  // Shopify applies `?discount=CODE` straight off a storefront URL.
  //
  // 🔴 NO `//` COMMENTS: this script is delivered verbatim to the client's own domain, where
  // their developer reads it. Standing rule in CLAUDE.md, enforced by verify-lead-handoff.
  const storeJS = shopping ? `
  var SF = ${JSON.stringify(STORE_FORWARD_KEYS)};
  var SD = ${JSON.stringify(tagged.filled)};
  var inbound = new URLSearchParams(location.search);
  Array.prototype.forEach.call(document.querySelectorAll('a[data-store]'), function (a) {
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      SF.forEach(function (k) {
        var v = inbound.get(k);
        if (v && (!u.searchParams.has(k) || SD.indexOf(k) >= 0)) u.searchParams.set(k, v);
      });
      a.setAttribute('href', u.toString());
    } catch (e) {}
  });` : "";
  const formJS = `${HO ? handoffFormJS : managedFormJS}\n${navJS}\n${headerJS}\n${stickyJS}\n${storeJS}`;

  const annHTML = offer ? `<div class="ann"><b>${esc(offer.slice(0, 90))}</b></div>` : "";
  const diffChip = fitPhrase(differentiator, 64);
  // Built as labels first so the stagger delay counts the chips that SURVIVE the filter.
  // Indexing before filtering would leave gaps in the timing whenever a client has no
  // phone number or no service area, which is most of them at the start.
  const chipLabels = (ownChips
    ? ownChips.map((c) => esc(c))
    // 🔴 THE SECOND PLACE THE QUOTE LANGUAGE LIVES. The trust row above was fixed for shops and
    // the page STILL printed "Free quote, no obligation", from here, because the same promise is
    // written twice in this renderer. A shop makes no quotes, so both copies have to know.
    : shopping
      ? [area ? `Serving ${esc(area)}` : reach ? esc(reach) : "", diffChip ? esc(diffChip) : "",
         "&#10003; Secure checkout", phone ? "Questions? Call us" : ""]
      : [area ? `Serving ${esc(area)}` : reach ? esc(reach) : "", diffChip ? esc(diffChip) : "",
         "&#10003; Free quote, no obligation", phone ? "Fast response" : ""])
    .filter(Boolean)
    .filter(fresh);
  const chips = chipLabels.map((t, i) => `<div class="chip reveal" style="transition-delay:${i * 45}ms">${t}</div>`).join("");
  // 🔴 `js` IS NOT IN THIS LIST, AND THAT IS DELIBERATE. It used to be, hard-coded, which
  // meant the `.js` gate was never actually a test for JavaScript — it was on before a single
  // line ran. So `.js .reveal{opacity:0}` matched unconditionally and the only thing that ever
  // made those sections visible again was a script adding `.in`. With JavaScript off, or in
  // any context where the script does not run, EVERY SECTION BELOW THE HERO STAYED BLANK
  // FOREVER, on a page we pay for clicks to, while the comment above this block and the test
  // guarding it both said a no-JS visitor gets a complete page.
  //
  // Bryson found it in a saved copy of Stencil & Thread's page, where the scripts are stripped
  // on purpose: *"it only shows the header not the whole landing page"*. The archive was the
  // messenger, not the cause.
  //
  // The class now comes only from the head script, which puts it on <html> before the body is
  // parsed, so with JavaScript on nothing changes and there is no flash. With JavaScript off
  // the gate simply does not match and every element sits at its finished, visible state,
  // which is what rule 1 of the motion block above has always claimed.
  const bodyClass = `lay-${layout} bg-${D.bg} mo-${D.motion} be-${D.benefits} font-${D.font} sh-${D.shape}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>document.documentElement.className+=' js'</script><title>${esc(lp.headline)} | ${esc(name)}</title><meta name="description" content="${esc(lp.subheadline || "")}"><meta property="og:title" content="${esc(lp.headline)} | ${esc(name)}"><meta property="og:description" content="${esc(lp.subheadline || "")}">${hero ? `<meta property="og:image" content="${esc(hero.url)}">` : ""}<style>${css}</style></head><body class="${bodyClass}">
${annHTML}
<header class="hdr"><div class="wrap">${logoUrl ? `<div class="brandmark"><img class="blogo" src="${esc(sized(logoUrl, 400))}" alt="${esc(name)}"></div>` : `<div class="brandmark"><span class="dot"></span>${esc(name)}</div>`}${phone ? `<a class="hdr-cta" href="${telHref}">${esc(phone)}</a>` : ""}</div></header>
${heroSection}
${chips ? `<div class="wrap"><div class="chips">${chips}</div></div>` : ""}
${middle}
${bottomBlock}
${convId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(convId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(convId)});</script>` : ""}
${metaPixelTag}
<footer class="foot"><div class="wrap">${esc(name)}${area ? ` · Serving ${esc(area)}` : reach ? ` · ${esc(reach)}` : ""}${phone ? ` · <a href="${telHref}">${esc(phone)}</a>` : ""}</div></footer>
<nav class="mcta">${phone ? `<a class="call" href="${telHref}">Call</a>` : ""}<a class="quote" href="${ctaHref}"${ctaAttr}>${esc(cta)}</a></nav>
<script>
(function(){
${galleryJS}
${revealJS}
${formJS}
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

  // 🔴 A PAGE CAN BE REACHED TWO WAYS, AND THE SECOND ONE IS THE ONE THAT SHIPS.
  // `/lp/<slug>` on our own domain is how it is previewed and tested. A CLIENT's own
  // subdomain, pointed here by their web person, is how it is actually advertised, because
  // Google displays the address the ad points to and a screen printer's ad must not show a
  // marketing agency's domain. The edge function turns the second into `?host=`.
  const host = normalizeHost(url.searchParams.get("host") || req.headers.get("host") || "");
  if (!slug && !host) return notFoundPage();

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let { data, error } = slug
    ? await supabaseAdmin.from("clients").select("id, data").eq("data->>landingSlug", slug).maybeSingle()
    // Case-insensitive, so nobody has to remember which casing they typed it in. The host
    // has already been checked against a hostname pattern, so it cannot smuggle the `%`
    // and `_` wildcards this comparison would otherwise honour.
    : await supabaseAdmin.from("clients").select("id, data")
        .ilike("data->campaignSetup->>landingDomain", host).maybeSingle();
  if (error) {
    console.error("Landing page lookup failed:", error);
    return notFoundPage();
  }

  // 🔴 AN ACCOUNT MAY HOLD MORE THAN ONE PAGE, and the extra ones live in `landingPages[]`
  // rather than in `landingSlug`, so the indexed lookup above cannot see them. Only reached
  // when that lookup found nothing, so an ordinary page costs exactly what it did before.
  //
  // It SCANS rather than filtering inside the JSON on the server. A jsonb containment filter
  // would be neater and is not testable from here, and an untestable query on the path a paid
  // click takes is precisely the shape of thing this project keeps shipping broken. There are
  // a handful of records; revisit when that stops being true.
  let extraPage = null;
  if (!data && slug) {
    const { data: rows, error: scanErr } = await supabaseAdmin
      .from("clients").select("id, data").not("data->landingPages", "is", null);
    if (scanErr) { console.error("Extra landing page lookup failed:", scanErr); return notFoundPage(); }
    for (const row of rows || []) {
      const hit = findPage(row && row.data, slug);
      if (hit) { data = row; extraPage = hit; break; }
    }
  }
  if (!data) return notFoundPage();

  // Rendered by handing the renderer a copy of the account with this page's content in place,
  // so every layout, guard and test that covers the main page covers these unchanged.
  const cl = extraPage ? clientForPage(data.data, extraPage) : data.data;
  const lp = cl.landingPage || {};
  // 🔴 THE PREVIEW KEY, AND THE ONE THING IT MAY DO.
  //
  // Sending an unpublished page for approval used to be impossible without publishing it,
  // because this line serves a Coming Soon placeholder instead. So the approval email would
  // have carried a link to a page that is not there. `previewKey` lets the client see the
  // real page while it is still unpublished, and it does NOTHING else: it does not publish
  // the page, does not appear on the live page, and grants no access to anything but this
  // one render.
  //
  // It is its own random value and deliberately NOT the portal token. The full URL travels
  // in the referrer header to every third-party host the page loads (fonts, for one), so a
  // portal token in a page address would be handed away on the first request.
  //
  // Compared with `!==` against a NON-EMPTY stored key. Without the emptiness check, a
  // client with no key set would be previewable by anyone sending `?preview=`, which is the
  // whole gate defeated by an empty string.
  const key = String(url.searchParams.get("preview") || "");
  const previewing = !!key && !!lp.previewKey && key === String(lp.previewKey);
  if ((!lp.published && !previewing) || !lp.headline) return comingSoonPage(cl.name);

  return html(renderLandingPage(cl));
};
