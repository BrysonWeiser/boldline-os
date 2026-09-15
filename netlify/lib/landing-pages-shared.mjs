// Several landing pages on ONE account, one per audience, instead of one page per record.
//
// Bryson, 2026-09-15: *"for my ads i want a way to have multiple different landing pages that i
// can choose from for each ad ... lets say i want to run an ad targeting car detailers i want to
// have a landing page that fits that ad ... and then I also want the ability to run a seperate ad
// lets say for roofers and have a landing page that fits that ad"*.
//
// 🔴 WHY NOT A RECORD PER AUDIENCE, WHICH WOULD HAVE BEEN FREE. Every feature he wants already
// exists per client record, so the cheap answer was to make "BoldLine: Roofers" a pretend client.
// Four places take `find(c => c.internal)` and use the FIRST match — the My Ads screen, the owner
// report, and two heartbeat reads in alerts-watch — so a second internal record makes all four
// pick one at random. It would also split his own ad performance across several fake clients,
// which is the exact blending that KB `campaign-breakdown` was written to stop. These are not
// separate advertising accounts. They are separate pages on one account.
//
// So: a record MAY hold `landingPages[]`. `landingPage` stays exactly as it is and stays the
// account's main page, so nothing that reads it today changes behaviour.

export const MAX_PAGES = 24;

// A slug is the whole public address, so it has to be safe in a URL, stable, and never collide
// with the record's own `landingSlug`.
export const pageSlug = (s) => String(s || "")
  .toLowerCase().trim()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60);

export const listPages = (cl) => {
  const arr = (cl && Array.isArray(cl.landingPages)) ? cl.landingPages : [];
  return arr.filter((p) => p && p.slug);
};

// 🔴 EVERY SLUG ON THE ACCOUNT, INCLUDING THE RECORD'S OWN. Two pages answering the same address
// is a coin flip over which one a paid click lands on, and the losing one is invisible: it is
// live, it is in the OS, and it never receives a visitor.
export const slugsTaken = (cl) => {
  const out = new Set();
  if (cl && cl.landingSlug) out.add(String(cl.landingSlug).toLowerCase());
  for (const p of listPages(cl)) out.add(String(p.slug).toLowerCase());
  return out;
};

// Returns a free slug based on `wanted`, appending -2, -3 … rather than refusing, because a
// refusal mid-flow loses whatever he had typed.
export const freeSlug = (cl, wanted, ignoreId = null) => {
  const base = pageSlug(wanted) || "page";
  const taken = new Set();
  if (cl && cl.landingSlug) taken.add(String(cl.landingSlug).toLowerCase());
  for (const p of listPages(cl)) if (p.id !== ignoreId) taken.add(String(p.slug).toLowerCase());
  if (!taken.has(base)) return base;
  for (let n = 2; n < 200; n++) {
    const s = `${base}-${n}`.slice(0, 60);
    if (!taken.has(s)) return s;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
};

export const findPage = (cl, slug) => {
  const want = String(slug || "").toLowerCase();
  if (!want) return null;
  return listPages(cl).find((p) => String(p.slug).toLowerCase() === want) || null;
};

// 🔴 THE RENDERER IS NOT TOUCHED. It reads `landingPage` and `landingSlug`, so an extra page is
// rendered by handing it a shallow copy of the account with those two swapped. Every layout,
// every guard and every test that already covers the renderer therefore covers these pages too,
// which is the entire reason it is done this way rather than by teaching the renderer about a
// second shape.
// 🔴 BOLDLINE'S OWN BRAND, STAMPED IN CODE, NOT ASKED FOR IN A PROMPT.
//
// Bryson, 2026-09-15: *"make sure the landing pages for my ads match my branding right now they
// are matching stencil & threads branding."* They were not carrying a client's colours — they
// were carrying NOBODY's. `landingTheme` falls back to `#4f6bed` on a light page when no brand
// colour is set, which is the same fallback Stencil & Thread's page lands on, so BoldLine's own
// ads pointed at a page that looked like another company's.
//
// `landingTheme`'s own comment says the colour comes from the client's branding and "Never
// BoldLine's". That is right for a CLIENT page and exactly inverted here: these pages ARE
// BoldLine's, advertising BoldLine, on BoldLine's domain.
//
// Set as top-level `brandColor`/`brandTheme` because those beat whatever the generator wrote,
// so the look does not depend on a model choosing to follow an instruction. A page may still
// carry its own if one is ever wanted per audience.
export const BOLDLINE_BRAND = "#c8a84b";
export const BOLDLINE_THEME = "dark";

export const clientForPage = (cl, page) => {
  if (!cl || !page) return cl;
  // 🔴 THE PAGE'S OWN DESIGN IS KEPT, AND AN EARLIER VERSION OF THIS THREW IT AWAY.
  //
  // Bryson, 2026-09-15: *"it looks exactly like the landing page for stencil & thread."* Every
  // audience page was coming out with the same layout, because the single-write path asks the
  // model the same question every time and a model returns the same answer. The first fix
  // stripped `design` so the slug seed decided instead.
  //
  // That was the wrong lever and it fought the right one. `generate-landing` ALREADY has a
  // variety mechanism: `planOptions` writes three options with deliberately different angles
  // AND different layouts, and takes an `exclude` list so more options explore new ground. A
  // page built from a chosen option carries that layout on purpose, and stripping it here
  // would have silently discarded the very thing he picked. So the design stays, the single
  // write passes a moving seed and the other pages' layouts to exclude, and the options card
  // is wired up per page.
  const pageCopy = (page.page || {});
  return { ...cl, landingSlug: page.slug, landingPage: pageCopy,
    brandColor: page.brandColor || BOLDLINE_BRAND,
    brandTheme: page.theme || BOLDLINE_THEME,
    // 🔴 NO SMS CONSENT BOX ON BOLDLINE'S OWN PAGES. `landing.mjs`'s own rule is that the
    // consent wording "is not ours to word, it is whatever that business filed with the
    // carriers". BoldLine has filed NOTHING and cannot send a text at all: Twilio is still on
    // the free trial (KB `call-tracking`). So the page was asking a prospect to agree to
    // messages that cannot be sent, and recording a consent under wording never registered —
    // which is worse than useless the day SMS does arrive. Flip this when BoldLine completes
    // A2P registration, and only then.
    campaignSetup: { ...(cl.campaignSetup || {}), smsConsent: false },
    // Kept so an extra page can carry its own candidates without colliding with the account's.
    landingVariants: Array.isArray(page.variants) ? page.variants : [] };
};

export const newPage = ({ label, slug, page, now = new Date() } = {}) => ({
  id: `lp-${now.toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`,
  at: now.toISOString(),
  label: String(label || "Untitled page").trim().slice(0, 80),
  slug: pageSlug(slug || label) || "page",
  page: page || { headline: "", subheadline: "", bullets: [], ctaText: "", published: false, generatedAt: null },
  variants: [],
});

// The address a visitor types, and the one Google prints under the ad. `/for/<slug>` on the
// marketing domain is proxied straight through to `/lp/<slug>` here, so the ad never shows a
// netlify.app address (Bryson chose this over a subdomain each, 2026-09-15, because a subdomain
// needs a DNS record and a Netlify job before every new audience and this needs neither).
export const PUBLIC_BASE = "https://boldlinemedia.com/for";
export const publicUrlFor = (page) => `${PUBLIC_BASE}/${(page && page.slug) || ""}`;
