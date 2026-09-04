// The niche photo gallery for ad backgrounds.
//
// Bryson, 2026-09-02: *"what if we can open a real gallery based on whatever niche I put
// of images that would be good backgrounds for the ads and to be able to visually see
// them before I select them"*.
//
// Three things are worth pinning here, and only one of them is about photos.
//
//   1. 🔴 THE HOST ALLOW LIST IS A SECURITY CONTROL. "save" makes the SERVER fetch a URL
//      the BROWSER chose. Without a check on where that URL points, anyone holding a
//      session could aim it at an internal address and read the response back out of the
//      media library afterwards. This is the one test in this file that is about an
//      attacker rather than about Bryson.
//   2. A saved photo has to be indistinguishable from an uploaded one, or it lands in a
//      library that nothing else can see.
//   3. The search button may not be hidden until the library is non-empty, because
//      searching is how the library stops being empty.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchTerms, isAllowedPhotoUrl, shapePhotos } from "../netlify/functions/stock-photos.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// ── 🔴 WHERE THE SERVER IS ALLOWED TO FETCH FROM ────────────────────────────────
t("only Pexels' own image host is accepted", () => {
  assert.ok(isAllowedPhotoUrl("https://images.pexels.com/photos/1/roof.jpg"));
});

t("🔴 every way of dressing up another host is refused", () => {
  const attacks = [
    // The classic substring escape. A check written as url.includes("images.pexels.com")
    // passes all four of these, which is why the hostname is parsed instead.
    "https://evil.com/images.pexels.com/x.jpg",
    "https://images.pexels.com.evil.com/x.jpg",
    "https://evil.com?images.pexels.com",
    "https://evil.com#images.pexels.com",
    // Credentials in the authority, which some naive parsers read as the host.
    "https://images.pexels.com@evil.com/x.jpg",
    // The reason the rule exists at all: reaching back into our own infrastructure.
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8888/.netlify/functions/clients",
    "http://127.0.0.1/",
    "file:///etc/passwd",
    // Plain HTTP even on the right host: strippable in transit, so not accepted.
    "http://images.pexels.com/photos/1/roof.jpg",
    // A sibling host is still not the image host.
    "https://api.pexels.com/v1/search",
    "https://www.pexels.com/photo/1/",
    "", null, undefined, "not a url", "//images.pexels.com/x.jpg",
  ];
  for (const a of attacks) {
    assert.equal(isAllowedPhotoUrl(a), false, `accepted a bad photo address: ${String(a)}`);
  }
});

// ── The search query, which is most of whether the photos are any good ─────────
t("the niche is turned into a query about people working", () => {
  assert.equal(searchTerms("roofers"), "roofers professional at work");
  assert.equal(searchTerms("  HVAC  Repair "), "hvac repair professional at work");
});

t("an empty niche still searches for something usable", () => {
  // 🔴 Not an empty query. Pexels answers "" with an error, and the gallery would open
  // empty on the exact press Bryson makes first, before he has typed a niche.
  for (const v of ["", "   ", null, undefined]) {
    const q = searchTerms(v);
    assert.ok(q.length > 3, `empty niche produced a useless query: "${q}"`);
  }
});

// ── Shaping the response ───────────────────────────────────────────────────────
const RESP = {
  photos: [
    { id: 11, alt: "Roofer nailing shingles", photographer: "A Person",
      src: { medium: "https://images.pexels.com/photos/11/m.jpg", large2x: "https://images.pexels.com/photos/11/l.jpg" } },
    // No usable size: must be dropped rather than shipped as a broken tile.
    { id: 12, alt: "x", src: {} },
    // 🔴 A photo whose full-size URL is off-host. It is dropped HERE too, not only at
    // save time, so a tile that could never be saved is never shown in the first place.
    { id: 13, alt: "y", src: { medium: "https://images.pexels.com/photos/13/m.jpg", large2x: "https://evil.com/13.jpg" } },
  ],
};

t("only complete, in-host photos survive shaping", () => {
  const out = shapePhotos(RESP);
  assert.equal(out.length, 1, `wrong photos survived: ${JSON.stringify(out.map((p) => p.id))}`);
  assert.equal(out[0].id, "11");
  assert.equal(out[0].thumb, "https://images.pexels.com/photos/11/m.jpg");
  assert.equal(out[0].full, "https://images.pexels.com/photos/11/l.jpg");
  assert.equal(out[0].alt, "Roofer nailing shingles");
});

t("a junk response is an empty list, not a crash", () => {
  for (const v of [null, undefined, {}, { photos: null }, { photos: "no" }, []]) {
    assert.deepEqual(shapePhotos(v), []);
  }
});

// ── The function's own shape ───────────────────────────────────────────────────
const FN = readFileSync(join(ROOT, "netlify/functions/stock-photos.mjs"), "utf8");

t("the request is authenticated before anything else happens", () => {
  const auth = FN.indexOf("auth.getUser");
  const fetchPos = FN.indexOf("await fetch(");
  assert.ok(auth > 0 && fetchPos > auth, "the function reaches out before it checks who is asking");
});

t("🔴 the allow list is checked on the value that is actually fetched", () => {
  const check = FN.indexOf("isAllowedPhotoUrl(photoUrl)");
  const fetchIt = FN.indexOf("await fetch(photoUrl)");
  assert.ok(check > 0, "save does not check the photo address at all");
  assert.ok(fetchIt > check, "the photo is fetched before the address is checked");
});

t("a non-image response is refused even from the allowed host", () => {
  assert.match(FN, /startsWith\("image\/"\)/, "content type is not checked, so any file on the host could be saved");
});

t("🔴 the CALLER decides what a stock copy is for", () => {
  // This used to be hard-coded to "photo", the category an uploaded picture gets, so a bare
  // stock photo chosen as the BACKGROUND for a creative became a candidate for the ad itself
  // and showed up in Assets as though Bryson had made it (2026-09-04). A background is raw
  // material. The Creative Studio asks for "source"; a landing-page photo still asks for
  // "photo". Both are still copied, because the canvas cannot read a cross-origin image back.
  assert.match(FN, /category: category,/, "the category is hard-coded again, so every copy has the same role");
  assert.match(FN, /body\.category === "source" \? "source" : "photo"/,
    "an unknown category would file the photo where nothing looks for it");
  assert.match(FN, /getPublicUrl/, "no public URL is produced, so nothing could display it");
});

t("a missing key explains itself in Bryson's words", () => {
  const m = /PEXELS_API_KEY[\s\S]{0,400}?error: "([^"]+)"/.exec(FN);
  assert.ok(m, "no message at all when the key is missing");
  const msg = m[1];
  assert.ok(!/env|variable|API|401|config/i.test(msg.replace(/Pexels/g, "")),
    `the missing-key message is written for a developer: ${msg}`);
  assert.ok(/Netlify/.test(msg), `the message does not say where to fix it: ${msg}`);
});

// ── The OS side ────────────────────────────────────────────────────────────────
const S = readFileSync(join(ROOT, "index.html"), "utf8");

t("🔴 the Creative Studio asks for a BACKGROUND, not a finished ad", () => {
  // Split from the check above because `S` is read further down this file than that test.
  assert.match(S, /credit:p\.credit,category:"source"/,
    "the background picker still files backgrounds as finished ad images, so a bare photo "
    + "with no words on it can be chosen as the ad");
});

t("🔴 the search button is not hidden behind a non-empty library", () => {
  // This is the bug the whole feature exists to fix, in a new costume: the dropdown was
  // gated on photos.length, so on the house account it never appeared, and there was no
  // way to put a first photo in. Gating the SEARCH the same way would rebuild that trap.
  const btn = S.indexOf("Find photos for this niche");
  assert.ok(btn > 0, "the search button is gone");
  // 🔴 The first version of this check looked for the gate sitting IMMEDIATELY before the
  // button and a real mutation walked straight past it, because the gate opens a few lines
  // and a wrapping div earlier. Any mention of the library's size in the block that leads
  // to this button is the thing worth failing on, wherever in that block it sits.
  //
  // 🔴 And comments are stripped first, because the SECOND version failed on the clean
  // file: the comment above the button explains that it is deliberately not gated on
  // photos.length, and the check read its own prose as the thing it was warning about.
  // This repo has made that exact mistake before in verify-app-boots.
  const before = S.slice(Math.max(0, btn - 1200), btn)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/photos\.length/.test(before),
    "the photo search is gated on the library already having photos in it, which is the trap this feature exists to remove");
});

t("the chosen photo is copied into the library, not linked straight onto the canvas", () => {
  // 🔴 Drawing a cross-origin image taints the canvas and toBlob() then throws, so the ad
  // would preview perfectly and fail to download. Nothing may pass a pexels.com URL to the
  // renderer; it goes through save first and comes back as one of our own URLs.
  assert.match(S, /action:"save",clientId:client\.id,photoUrl:p\.full/,
    "the studio no longer copies a chosen photo through the server");
  assert.ok(!/adLoadImage\(p\.full\)/.test(S), "a stock URL is being drawn straight onto the canvas");
});

t("saving refreshes the client so the new photo is in the dropdown", () => {
  assert.match(S, /onUpdate\(\{\.\.\.client,mediaLibrary:d\.mediaLibrary\}\)/,
    "the saved photo never reaches the rest of the OS, so the dropdown stays stale");
  assert.match(S, /setPhotoPath\(d\.entry\.path\)/, "the photo is saved but not selected, so nothing visibly happens");
});

t("the gallery is a grid of pictures, not another dropdown", () => {
  const g = S.indexOf("repeat(auto-fill,minmax(104px,1fr))");
  assert.ok(g > 0, "the photo grid is gone, which was the entire request");
  assert.match(S.slice(g, g + 900), /objectFit:"cover"/, "the tiles do not crop to a uniform shape");
});

console.log(`✓ verify-stock-photos: ${n} checks passed`);
