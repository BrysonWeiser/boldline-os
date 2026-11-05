// Landing pages brought up to the 2026-11 standard (KB landing-page-standard).
// Run: node tests/verify-landing-standard.mjs
//
// Bryson, 2026-11-05: "with the landing pages that get made for clients and for myself for ads I want to update them to
// our new standard like we did for the websites. I dont want anything crazy but I want the landing pages to look better
// and be more alive". What this stops, worst first:
//  1. A headline a screen reader or a visitor without the script cannot read (it is split into words by script).
//  2. A star rating that is not their real one.
//  3. A page with a website losing its website's look to the new default typefaces.
import { renderLandingPage } from "../netlify/functions/landing.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const base = (x = {}) => ({ id: "c1", name: "Desert Gloss", landingSlug: "desert-gloss", callTrackingNumber: "(480) 555-0100", niche: "Mobile detailing",
  campaignSetup: { serviceArea: "Mesa, AZ" }, mediaLibrary: [{ category: "photo", url: "https://x.supabase.co/storage/v1/object/public/a/p1.jpg", path: "p1" }, { category: "photo", url: "https://x.supabase.co/storage/v1/object/public/a/p2.jpg", path: "p2" }],
  landingPage: { headline: "Showroom shine in your driveway", subheadline: "We come to you.", bullets: ["We come to you", "Gentle on paint"], design: { layout: "split", font: "modern" } }, ...x });
const H = renderLandingPage(base());
const script = (H.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/) || [""])[0];

ok("🔴 the headline is complete in the page itself; only the script splits it into words, and it keeps the whole line for screen readers",
  /<h1 class="headline an"[^>]*>Showroom shine in your driveway<\/h1>/.test(H) && /h1\.setAttribute\('aria-label',said\)/.test(script) && /'<span class="hw" aria-hidden="true"/.test(script));
ok("🔴 and it stays still for 'reduce motion'", /var still=window\.matchMedia&&window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;/.test(script) && /if\(h1&&!still&&/.test(script) && /if\(hi&&!still\)/.test(script));
ok("the headline's words are escaped when rebuilt", /w\.replace\(\/&\/g,'&amp;'\)\.replace\(\/<\/g,'&lt;'\)/.test(script));
ok("the hero photo settles in and drifts with the scroll (transform and translate only)", /\.js \.heroimg,\.js \.heroband img\{translate:0 var\(--py,0px\);animation:settle/.test(H) && /@keyframes settle\{from\{transform:scale\(1\.16\)\}to\{transform:scale\(1\.07\)\}\}/.test(H) && /hi\.style\.setProperty\('--py'/.test(script));
ok("photos open as they arrive, steps draw their top edge, section labels draw their line", /\.js \.gitem\.reveal\{scale:\.94;/.test(H) && /\.js \.step\.reveal:not\(\.in\)::after\{transform:scaleX\(0\)\}/.test(H) && /\.js \.sec-head\.reveal:not\(\.in\) \.sec-k::before\{transform:scaleX\(0\)\}/.test(H));
ok("the main hero button glints now and then (phones never hover, so they never saw the sheen)", /\.hero \.cta:not\(\.ghost\)::before\{animation:glint 7s/.test(H));
ok("bigger, more confident type and room", /\.headline\{font-size:clamp\(34px,5\.4vw,66px\)/.test(H) && /\.sec\{padding:clamp\(64px,8vw,104px\) 0\}/.test(H));
ok("🔴 the script shipped to a client's own domain has no comments and no modern syntax", !/\/\/ |=>|\blet |\bconst /.test(script.replace(/https?:\/\//g, "")));

// The rating: real or nothing.
ok("🔴 no rating known: no stars on the page", !/class="lrate/.test(H));
ok("their Google profile's real rating shows with its count", /class="lrate an"[^>]*>[\s\S]{0,200}4\.9 <small>from 61 Google reviews<\/small>/.test(renderLandingPage(base({ gbpStats: { average: 4.9, total: 61 } }))));
ok("🔴 a rating with no count is never shown", !/class="lrate/.test(renderLandingPage(base({ website: { rating: { stars: 4.8, count: 0 } } }))));

// Typefaces.
ok("a page with no website and no Brand kit fonts gets a proper typeface by its mood", /family=Plus\+Jakarta\+Sans/.test(H) && /\.headline,\.sec-t[^{]*\{font-family:'Plus Jakarta Sans'/.test(H));
ok("elegant pages get the readable serif, not the old one", /family=Playfair\+Display/.test(renderLandingPage(base({ landingPage: { ...base().landingPage, design: { layout: "split", font: "elegant" } } }))) && !/Fraunces/.test(renderLandingPage(base({ landingPage: { ...base().landingPage, design: { font: "elegant" } } }))));
ok("🔴 Brand kit fonts still win over the mood font", !/family=Plus\+Jakarta/.test(renderLandingPage(base({ brandKit: { headingFont: "Lora" } }))));
{
  const W = renderLandingPage(base({ website: { theme: "editorial", content: { hero: { headline: "x" } } } }));
  ok("🔴 a page whose business has a website keeps the website's typefaces, not the mood font", /class="[^"]*\bkit\b/.test(W) && !/family=Plus\+Jakarta|family=Archivo:wght@500/.test(W));
}
ok("🔴 reduce motion stills the new photo movement too", /@media\(prefers-reduced-motion:reduce\)\{\.js \.heroimg,\.js \.heroband img\{transform:none!important;translate:none!important\}\.js \.gitem\.reveal\{scale:none!important\}\}/.test(H));

console.log(`verify-landing-standard: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
