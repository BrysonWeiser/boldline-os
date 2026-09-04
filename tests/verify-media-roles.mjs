// A background is not an ad, and an ad runs the set he picked rather than the newest file.
//
// Bryson, 2026-09-04:
//   *"the image i select to use as a background image also got saved into the assets tab to
//    be used for ads which i dont want only the finalized image or images should be saved"*
//   *"i dont want the current ad we have running for leads to use the storm related images I
//    want them using the your leads arent sold to other roofers images"*
//
// 🔴 TWO BUGS, AND BOTH LOOKED LIKE FEATURES.
//
// One: picking a stock photo as a background COPIES it into the library, and that copy is not
// optional. The creative is drawn on a canvas and read back with `toBlob()`, and drawing a
// cross-origin image taints the canvas so the read throws. But it was filed as `photo`, the
// same category an uploaded picture gets, so a bare photo with no words on it became a
// candidate for the ad itself and appeared in Assets as though he had made it.
//
// Two: the launch card took the newest `ad-creative`. One press of Save writes the same design
// at FOUR placement sizes, so a set is four files. Make a second angle later and the newest
// four are the new angle, and a running ad silently switches to it. Two angles in one library
// and the ad following the clock instead of the choice.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const LIB = await import("../netlify/lib/media-roles.mjs");

// 🔴 THE BROWSER COPY, EXTRACTED AND RUN. index.html cannot import the lib, so there are two
// copies and they must agree. Every case below runs against BOTH.
const start = S.indexOf("const isSourceOnly = (m) =>");
assert.ok(start > 0, "the browser copy of the media-role helpers is gone");
const end = S.indexOf("const adPerfStats = (cl) => {", start);
assert.ok(end > start, "the browser copy's end anchor moved");
const BROWSER = new Function(S.slice(start, end) + "\nreturn { isSourceOnly, adImages, groupOf, creativeGroups, adImagesFor };")();

const img = (o) => ({ url: `https://x/${o.path || o.label}`, category: "ad-creative", ...o });
const CLIENT = {
  mediaLibrary: [
    // The newest thing in the library is a BACKGROUND, which is exactly the trap.
    { url: "https://x/storm-bg.jpg", path: "storm-bg", category: "source", label: "Storm clouds", uploadedAt: "2026-09-04T10:00:00Z" },
    img({ path: "s1", label: "ad-storm-1080x1080-2.jpg", group: "storm-2", groupLabel: "Storm damage season", uploadedAt: "2026-09-03T10:00:00Z", w: 1080, h: 1080 }),
    img({ path: "s2", label: "ad-storm-1200x628-2.jpg", group: "storm-2", groupLabel: "Storm damage season", uploadedAt: "2026-09-03T10:00:00Z", w: 1200, h: 628 }),
    img({ path: "l1", label: "ad-leads-1080x1080-1.jpg", group: "leads-1", groupLabel: "Your leads aren't sold to other roofers", uploadedAt: "2026-09-01T10:00:00Z", w: 1080, h: 1080 }),
    img({ path: "l2", label: "ad-leads-1080x1350-1.jpg", group: "leads-1", groupLabel: "Your leads aren't sold to other roofers", uploadedAt: "2026-09-01T10:00:00Z", w: 1080, h: 1350 }),
    { url: "https://x/clip.mp4", path: "v", category: "video", label: "clip", uploadedAt: "2026-09-02T10:00:00Z" },
  ],
};
const both = (fn) => { fn(LIB, "server"); fn(BROWSER, "browser"); };

// ── 1. 🔴 A BACKGROUND IS NEVER AN AD ───────────────────────────────────────
t("🔴 a background is excluded from everything an ad can use", () => {
  both((M, where) => {
    const urls = M.adImages(CLIENT).map((m) => m.url);
    assert.ok(!urls.includes("https://x/storm-bg.jpg"),
      `[${where}] the raw background is still offered as an ad image, so a bare photo with no `
      + "words on it can be chosen as the ad");
  });
});

t("and so is a video, which was already true and must stay true", () => {
  both((M, where) => {
    assert.ok(!M.adImages(CLIENT).some((m) => m.category === "video"), `[${where}] a video is offered as an ad image`);
  });
});

t("the finished creatives are all still there", () => {
  both((M, where) => {
    assert.equal(M.adImages(CLIENT).length, 4, `[${where}] the exclusion is eating real creatives`);
  });
});

// ── 2. 🔴 AN AD RUNS THE SET HE PICKED ──────────────────────────────────────
t("🔴 sets are grouped, not listed as loose files", () => {
  both((M, where) => {
    const g = M.creativeGroups(CLIENT);
    assert.equal(g.length, 2, `[${where}] four files should be two sets of two`);
    assert.deepEqual(g.map((x) => x.items.length), [2, 2], `[${where}] the sets are not whole`);
  });
});

t("newest set first, so the default is the one he just made", () => {
  both((M, where) => {
    assert.equal(M.creativeGroups(CLIENT)[0].key, "storm-2", `[${where}] the newest set is not first`);
  });
});

t("🔴 THE STORM/LEADS CASE ITSELF: picking the leads set gets ONLY the leads images", () => {
  both((M, where) => {
    const { images, group, fellBack } = M.adImagesFor(CLIENT, "leads-1");
    assert.equal(group.key, "leads-1", `[${where}] the chosen set was not honoured`);
    assert.equal(fellBack, false, `[${where}] it reported falling back when the set exists`);
    assert.deepEqual(images.map((m) => m.path).sort(), ["l1", "l2"],
      `[${where}] a storm image is in an ad that is meant to run the leads angle, which is `
      + "the exact thing reported");
  });
});

t("each set carries a name he would recognise", () => {
  both((M, where) => {
    const g = M.creativeGroups(CLIENT).find((x) => x.key === "leads-1");
    assert.match(g.label, /leads aren't sold/i, `[${where}] the set is unnamed, so it cannot be chosen from a list`);
  });
});

t("🔴 and a set with no stored name falls back to the design's name, not a blank", () => {
  // Everything saved before the group stamp existed has no label. A row of blanks is the
  // original problem restated: he cannot tell which is which.
  both((M, where) => {
    const old = { mediaLibrary: [img({ path: "o1", label: "ad-winter-check-1080x1080-9.jpg", uploadedAt: "2026-08-01T00:00:00Z" })] };
    const g = M.creativeGroups(old)[0];
    assert.equal(g.label, "winter check", `[${where}] an older creative has no readable name: ${g.label}`);
  });
});

t("🔴 files saved before groups existed do not merge into one another's sets", () => {
  both((M, where) => {
    const old = { mediaLibrary: [
      img({ path: "a", label: "ad-one-1080x1080-1.jpg", uploadedAt: "2026-08-01T00:00:00Z" }),
      img({ path: "b", label: "ad-two-1080x1080-2.jpg", uploadedAt: "2026-08-02T00:00:00Z" }),
    ] };
    assert.equal(M.creativeGroups(old).length, 2,
      `[${where}] two unrelated old creatives were merged into one set, so an ad would run both`);
  });
});

t("🔴 a set that was deleted falls back and SAYS it fell back", () => {
  both((M, where) => {
    const r = M.adImagesFor(CLIENT, "deleted-set");
    assert.equal(r.group.key, "storm-2", `[${where}] a deleted set left the ad with no image at all`);
    assert.equal(r.fellBack, true,
      `[${where}] it silently used a different set, so he would never know his choice was lost`);
  });
});

t("a library with no creatives at all still returns something usable", () => {
  both((M, where) => {
    const bare = { mediaLibrary: [{ url: "https://x/p.jpg", category: "photo", path: "p" }] };
    const r = M.adImagesFor(bare, "");
    assert.equal(r.images.length, 1, `[${where}] a client with only an uploaded photo gets no ad image`);
    assert.equal(r.group, null);
  });
});

t("empty and malformed input does not throw", () => {
  both((M, where) => {
    for (const c of [null, undefined, {}, { mediaLibrary: null }, { mediaLibrary: [null, {}] }]) {
      assert.doesNotThrow(() => M.adImagesFor(c, "x"), `[${where}] threw on ${JSON.stringify(c)}`);
    }
  });
});

// ── 3. Wired into the things that actually pick images ──────────────────────
t("🔴 the Creative Studio files a background as a background", () => {
  assert.match(UI, /credit:p\.credit,category:"source"/,
    "the background picker still files backgrounds as finished ad images");
});

t("🔴 every size saved in one press shares a group", () => {
  assert.match(UI, /const group=`\$\{\(angleId\|\|"creative"\)\}-\$\{stamp\}`/, "sizes are saved with no set stamp");
  assert.match(UI, /label:name,group,groupLabel,w:s\.w,h:s\.h/, "the stamp is computed and never sent");
  const MEDIA = readFileSync(join(ROOT, "netlify/functions/media.mjs"), "utf8");
  assert.match(MEDIA, /body\.group \? \{ group:/, "the server drops the stamp, so it never survives the round trip");
});

t("🔴 the launch card follows the chosen set", () => {
  assert.match(UI, /const picked = adImagesFor\(client, groupPick\)/, "the card does not use the chosen set");
  assert.match(UI, /adCreativeGroup/, "there is nowhere to record which set an ad runs");
  assert.match(S, /Only this set is used\. The other designs in your library are left alone\./,
    "nothing on screen says the other designs are not being used, which is the reassurance he asked for");
});

t("🔴 and BOTH other image pickers exclude backgrounds too", () => {
  // Three places chose images independently. A fix applied to one leaves the others still
  // offering a bare stock photo as the ad.
  const spots = [...UI.matchAll(/category\|\|""\)!=="video"/g)];
  assert.ok(spots.length >= 1, "the swap picker's filter is gone");
  assert.ok(!/m\.url && m\.category!=="video"\)/.test(UI),
    "a picker still filters only videos, so a background is still offered as an ad image");
  assert.match(UI, /m\.category!=="video" && m\.category!=="source"/, "the launch card does not exclude backgrounds");
});

console.log(`✓ verify-media-roles: ${n} checks passed`);
