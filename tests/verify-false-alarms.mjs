// The check that could only ever fail, and the photos the page was hiding.
// Run: node tests/verify-false-alarms.mjs
//
// 🔴 Bryson, 2026-09-13, on two things in the same breath:
//   *"the landing page is still working good it loads the only issue is not all the images
//   loaded so fix that but also make sure the checks are correct and not just throwing out
//   problems to throw them out"*
//
// He was right on both counts and the second one is the one that matters most.
//
// 1. THE CHECK COULD NOT HAVE PASSED. The daily check fetched
//    `/.netlify/functions/landing?c=<id>`. `landing.mjs` has no `c` parameter: it resolves a
//    client by `/lp/<slug>` or by the host header, and by nothing else. So that URL 404s for
//    every client, forever. It was not detecting a fault, it was reporting its own.
//
//    An alarm that cries wolf on day one is an alarm nobody reads on the day it is right, and
//    every false one costs him a morning. So the rule this file enforces is: **the address the
//    checker builds must be an address the router can actually resolve.** Asserted against the
//    real routing code, not against a copy of my assumptions about it.
//
// 2. THE PHOTOS WERE NEVER BROKEN. All three returned 200 with valid pixels every time. The
//    page hid them: one observer revealed a tile near the viewport, a second RE-HID it 160px
//    past the edge so the fade could replay, and everything in that band sat at opacity 0 with
//    a perfectly good photo inside. Scripted scrolling reproduced it exactly, with tiles 1 and
//    2 at opacity 0 while tile 3 was at 1. Content whose resting state is invisible can always
//    be caught invisible, and a blank tile on a client's advertised page is indistinguishable
//    from a dead image.

import { readFileSync } from "node:fs";
import { landingUrlFor, pageImages, PAGE_IMAGE_LIMIT } from "../netlify/functions/daily-check.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const LANDING = readFileSync(new URL("../netlify/functions/landing.mjs", import.meta.url), "utf8");
const CHECK = readFileSync(new URL("../netlify/functions/daily-check.mjs", import.meta.url), "utf8");
// 🔴 Comments QUOTE the broken URL, on purpose, so the next person knows what went wrong.
// Testing the raw file would match that quote and pass forever. Only the code is searched.
const CHECK_CODE = CHECK.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const BASE = "https://boldlinemedia.netlify.app";

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE CHECKER'S URL MUST BE ONE THE ROUTER CAN RESOLVE
// ══════════════════════════════════════════════════════════════════════════════
// Read the router's real rules out of landing.mjs rather than restating them here. If someone
// changes how a landing page is addressed, this fails instead of quietly going back to 404.
{
  const routes = {
    path: /url\.pathname\.match\(\/\^\\\/lp\\\/\(\[\^\/\]\+\)/.test(LANDING.replace(/\s/g, "")) ||
          LANDING.includes("/^\\/lp\\/([^/]+)\\/?$/"),
    slugParam: LANDING.includes('url.searchParams.get("slug")'),
    hostParam: LANDING.includes('url.searchParams.get("host")'),
  };
  ok("the router still serves /lp/<slug>", routes.path, "the checker's fallback address depends on this route existing");
  ok("and still resolves a client's own domain by host", routes.hostParam);
  eq("🔴 and there is still NO ?c= parameter, which is what the old check used",
    /searchParams\.get\("c"\)/.test(LANDING), false,
    "if a c parameter is ever added, this test is what says the old URL became valid");
  eq("🔴 so the checker no longer asks for one", /landing\?c=/.test(CHECK_CODE), false,
    "that URL 404s for every client, forever: a check whose only possible outcome is failure");
  ok("(and the comments still explain the old mistake)", /landing\?c=/.test(CHECK),
    "the next person needs to know why this address is what it is");
}

// The real client, with the real values off his record.
{
  const stencil = { name: "Stencil & Thread", landingSlug: "stencil-thread",
    campaignSetup: { landingDomain: "quote.stencilandthread.com" } };
  const t = landingUrlFor(stencil, BASE);
  eq("🔴 a client with their own domain is checked AT that domain", t.url, "https://quote.stencilandthread.com/",
    "that is the address the ads point at and the only one a visitor ever types");
  ok("and the alert would say which address it tried", /checked \$\{target\.why\}/.test(CHECK),
    "an alert naming no address is an alert he has to reverse-engineer");
}
{
  const t = landingUrlFor({ landingSlug: "stencil-thread" }, BASE);
  eq("a client with no domain yet falls back to our own route", t.url, `${BASE}/lp/stencil-thread`);
  ok("which is a path the router matches", /^https:\/\/[^/]+\/lp\/[^/]+$/.test(t.url));
}
eq("🔴 no address at all is a SKIP, not a failure", landingUrlFor({}, BASE), null,
  "reporting a fault because a field is empty is exactly the crying-wolf this file exists to stop");
eq("junk in does not throw", landingUrlFor(null, BASE), null);
{
  // A domain typed with the scheme or a trailing slash must not become https://https://...
  eq("a domain pasted with https:// is cleaned up",
    landingUrlFor({ campaignSetup: { landingDomain: "https://quote.example.com/" } }, BASE).url,
    "https://quote.example.com/");
  eq("and one with stray spaces", landingUrlFor({ campaignSetup: { landingDomain: "  quote.example.com  " } }, BASE).url,
    "https://quote.example.com/");
  eq("an empty domain does not win over a good slug", landingUrlFor({ campaignSetup: { landingDomain: "   " }, landingSlug: "s" }, BASE).url,
    `${BASE}/lp/s`);
}
eq("a slug with a space is escaped, not broken", landingUrlFor({ landingSlug: "a b" }, BASE).url, `${BASE}/lp/a%20b`);

// A published page with no address is a skip, and an unpublished one says so differently:
// two different situations must not read as the same line.
{
  const i = CHECK.indexOf("A published landing page to check");
  const body = CHECK.slice(i, i + 420);
  ok("published-but-no-address and never-published say different things",
    /no address set yet/.test(body) && /no published page yet/.test(body),
    "one of those needs a field filled in and the other needs nothing at all");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 THE CHECK NOW LOOKS AT THE PHOTOS, WHICH IS WHAT HE WAS LOOKING AT
// ══════════════════════════════════════════════════════════════════════════════
// Everything the check did asked whether the HTML arrived. Nothing asked whether the pictures
// in it did. A page that returns 200 with dead images is a page the ads keep paying for.
{
  const h = `<img src="https://cdn.test/a.jpg?w=1&amp;h=2"><img src="data:image/png;base64,zz">
             <img src="/relative.png"><img src="https://cdn.test/a.jpg?w=1&amp;h=2"><img alt="no src">`;
  const out = pageImages(h);
  eq("🔴 &amp; is decoded before the image is fetched", out, ["https://cdn.test/a.jpg?w=1&h=2"],
    "fetching it verbatim sends a literal amp; and 400s on every resized photo, which is a brand new false alarm");
  eq("the same photo twice is fetched once", out.length, 1);
  ok("an inline data image is skipped", !out.some((u) => /^data:/.test(u)));
  ok("a relative src is skipped rather than guessed at", !out.some((u) => /relative/.test(u)),
    "guessing a base URL is how you invent a 404 that nobody can reproduce");
}
{
  const many = Array.from({ length: 30 }, (_, i) => `<img src="https://cdn.test/${i}.jpg">`).join("");
  eq("a thirty-photo gallery does not turn the check into a crawl", pageImages(many).length, PAGE_IMAGE_LIMIT);
  eq("and the cap is a sane number", PAGE_IMAGE_LIMIT, 8);
  eq("the cap can be overridden for a test", pageImages(many, 2).length, 2);
}
eq("a page with no images is not a failure", pageImages("<p>hi</p>"), []);
eq("junk in does not throw", pageImages(null), []);
{
  const c = CHECK.slice(CHECK.indexOf("const imgs = pageImages"), CHECK.indexOf("const imgs = pageImages") + 900);
  ok("🔴 no images at all is a SKIP, not a failure", /add\("The landing page's photos load", null/.test(c),
    "a page with no photos is a design choice, not a fault");
  ok("and the alert names which ones failed", /did not: \$\{bad\.slice/.test(c),
    "a count with no filenames is something he has to go and find himself");
  ok("and how many were looked at", /\$\{imgs\.length\} checked/.test(c));
}

// 🔴 WHAT WAS **NOT** CHANGED, AND WHY. The first diagnosis of the missing photo was that the
// scroll animation un-hides a tile and then RE-HIDES it on the way past. That was wrong: it was
// measured with a settle shorter than the 600ms fade, so what looked like blank tiles was the
// fade itself, mid-flight. Re-measured with a proper settle, nothing is ever left invisible.
//
// That matters because the replay is a FEATURE Bryson asked for on 2026-09-02: *"make sure the
// up and down animation happens even after a person has scrolled through the whole page"*, and
// `verify-landing-motion` guards it. Deleting it would have quietly reversed his own decision
// on the strength of a bad measurement. The guard below is a signpost for the next person who
// arrives at the same wrong idea.
{
  const i = LANDING.indexOf("const revealJS =");
  const js = LANDING.slice(i, LANDING.indexOf("`;", i));
  ok("the reveal still replays, as he asked",
    /if\(!e\.isIntersecting\)e\.target\.classList\.remove\('in'\)/.test(js) && /function rearm\(\)/.test(js),
    "measured properly this never leaves a loaded photo invisible; see verify-landing-motion");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 AN EMPTY TILE MUST NOT LOOK LIKE A BROKEN ONE
// ══════════════════════════════════════════════════════════════════════════════
// Reproduced by holding one gallery image back: the tile sits at full size and full opacity
// with nothing in it. On a dark page that is a black square, and a black square is what a dead
// image looks like.
{
  ok("🔴 a tile has a surface colour behind it", /\.gitem\{overflow:hidden;border-radius:var\(--r\);background:\$\{P\.surface\}\}/.test(LANDING),
    "an unfilled tile on a dark page is indistinguishable from a photo that failed");
  ok("the first photos are not lazy", /i < GALLERY_EAGER \? '' : ' loading="lazy"'/.test(LANDING),
    "the gallery is one screen down on a phone, so everybody scrolls to it and lazy saves nothing");
  ok("and later ones still are", /loading="lazy"/.test(LANDING),
    "a thirty-photo gallery should not fetch all thirty up front");
  const n = Number((LANDING.match(/const GALLERY_EAGER = (\d+)/) || [])[1]);
  ok("the eager count is small", n >= 2 && n <= 6, `GALLERY_EAGER is ${n}`);
  ok("and it is honest that this is insurance, not the fix", /INSURANCE, not the fix/.test(LANDING),
    "measured in Chrome it changes 55ms; claiming it fixed the report would be a guess dressed as a finding");
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE CAMERA FILENAME THAT PRINTED ON HIS CLIENT'S LIVE PAGE
// ══════════════════════════════════════════════════════════════════════════════
// `alt="IMG_6360-cropped"` was on Sebastian's advertised page. The filter was there; the crop
// editor's suffix walked straight past it.
{
  const src = LANDING.slice(LANDING.indexOf("const photoAlt ="), LANDING.indexOf("const sized ="));
  const photoAlt = new Function("return " + src.replace(/^const photoAlt =/, "").replace(/;\s*$/, ""))();
  const NAME = "Stencil & Thread";
  eq("🔴 the exact filename from his live page is caught", photoAlt({ label: "IMG_6360-cropped" }, NAME), NAME);
  eq("and the .jpg version of it", photoAlt({ label: "IMG_6360-cropped.jpg" }, NAME), NAME);
  eq("the ones already caught still are", photoAlt({ label: "IMG_6110.jpeg" }, NAME), NAME);
  for (const junk of ["DSC_0912-edited", "PXL_20260101_1200-copy", "photo-1 (2)", "IMG_1234-final", "screenshot_55-resized", "IMG_6360-crop"])
    eq(`${junk} is not a description`, photoAlt({ label: junk }, NAME), NAME);
  eq("no label at all falls back to the business", photoAlt({}, NAME), NAME);

  // 🔴 AND IT MUST NOT EAT REAL DESCRIPTIONS. Over-matching here silently replaces every
  // client's alt text with their own name, which is worse than the leak it fixes.
  for (const real of ["Team hoodies for the Boys and Girls Club", "Navy tee, one colour front", "School Garden Project shirts"])
    eq(`a real description survives: ${real}`, photoAlt({ label: real }, NAME), real);
  // 🔴 THE WORDS IN THE FILTER ARE ORDINARY ENGLISH. Matching them ANYWHERE in a label would
  // replace a client's own description with their business name, silently, on every photo
  // they ever described properly. That is a worse bug than the leak it fixes, because the
  // leak is visible and this would not be.
  for (const real of ["Photo of the shop front", "Scanned artwork proof", "Panoramic shot of the press",
                      "Image transfer on a navy tee", "Screenshot of the customer's artwork",
                      "DSC members club hoodies", "Final proof, copy approved by the client"])
    eq(`a description CONTAINING a filter word survives: ${real}`, photoAlt({ label: real }, NAME), real,
      "the filter must key on the whole label looking like a filename, never on a word appearing in it");
  eq("a description that merely ends in a word like final survives",
    photoAlt({ label: "Screen printed tees, final run" }, NAME), "Screen printed tees, final run",
    "the suffix rule must key on the filename shape, not on a word appearing anywhere");
  eq("and the extension is still dropped from a real one",
    photoAlt({ label: "navy team shirts.jpg" }, NAME), "navy team shirts");
}

console.log(`verify-false-alarms: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
