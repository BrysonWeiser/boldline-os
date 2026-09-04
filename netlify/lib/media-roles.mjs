// What each file in a client's media library is FOR, and which ones an ad may use.
//
// Bryson, 2026-09-04:
//   *"the image i select to use as a background image also got saved into the assets tab to
//    be used for ads which i dont want only the finalized image or images should be saved"*
//   *"i dont want the current ad we have running for leads to use the storm related images I
//    want them using the your leads arent sold to other roofers images"*
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 PROBLEM ONE: THE RAW BACKGROUND HAD TO BE SAVED, AND THEN BEHAVED LIKE A FINISHED AD.
//
// Picking a stock photo as the background for a creative COPIES it into the library, and that
// copy is not optional: the creative is drawn on a canvas and read back with `toBlob()`, and
// drawing an image from another origin taints the canvas so the read throws. The preview
// looks perfect and the download fails. Copying it makes it same-origin and fixes that.
//
// But it was copied in as `category: "photo"`, the same category an uploaded picture gets, so
// a bare stock photo with no words on it became a candidate for the ad itself and appeared in
// the Assets tab as though he had chosen it. It is raw material, not a deliverable. It is now
// saved as `source`: still stored, still usable by the canvas, never offered as an ad.
//
// 🔴 PROBLEM TWO: "NEWEST WINS" IS NOT "THE ONE I PICKED".
//
// The launch card took the newest `ad-creative` in the library. The Creative Studio saves the
// SAME design at four placement sizes in one press, so a set is four files. Make a second
// angle later and the newest four are the new angle, and the running ad silently switches to
// whatever was made most recently. That is exactly the storm-vs-leads complaint: two angles in
// one library, and the ad follows the clock rather than the choice.
//
// So each save now stamps a `group`, and an ad uses ONE group. Files in a group are the same
// picture at different sizes, which is precisely what he asked for: "the one I selected and
// the ones that look exactly like it just at different sizes".

// Anything an ad may be built from. `source` is deliberately absent.
export const AD_CATEGORIES = ["ad-creative"];

// Files that are raw material rather than something he made. Hidden from the Assets gallery
// and never offered to an ad, but kept, because the canvas needs a same-origin copy.
export const isSourceOnly = (m) => String((m || {}).category || "") === "source";

// Every category the library accepts. Anything else is rejected rather than stored under a
// name nothing filters on, which is how the background ended up looking like a deliverable.
export const MEDIA_CATEGORIES = ["ad-creative", "photo", "logo", "video", "source"];
export const isKnownCategory = (c) => MEDIA_CATEGORIES.includes(String(c || ""));

// 🔴 THE ONE LIST EVERY AD PICKER MUST USE. Three places chose images independently before
// this (the Meta launch card, the creative swap on a live ad, and the launch card's hint),
// and a fix applied to one of them would have left the others picking a stock photo.
export const adImages = (client) =>
  ((client || {}).mediaLibrary || []).filter((m) =>
    m && m.url && !isSourceOnly(m) && String(m.category || "") !== "video");

// Which set a file belongs to. The Creative Studio stamps this on every size it writes in one
// press. Older files predate it and fall back to their own path, so each is its own group of
// one rather than silently joining somebody else's set.
export const groupOf = (m) => String((m || {}).group || "") || `single:${(m || {}).path || (m || {}).url || ""}`;

// The library in group order, newest group first, with the files inside a group kept together.
// Returns [{ key, label, at, items }].
export function creativeGroups(client) {
  const imgs = adImages(client).filter((m) => String(m.category || "") === "ad-creative");
  const byKey = new Map();
  for (const m of imgs) {
    const k = groupOf(m);
    if (!byKey.has(k)) byKey.set(k, { key: k, label: "", at: "", items: [] });
    const g = byKey.get(k);
    g.items.push(m);
    // The newest timestamp in the set stands for the set, so a group sorts where its most
    // recent file would have.
    const at = String(m.uploadedAt || "");
    if (at > g.at) g.at = at;
    if (!g.label) g.label = String(m.groupLabel || "").trim();
  }
  const out = [...byKey.values()];
  for (const g of out) {
    // 🔴 A SET WITH NO NAME IS A ROW OF IDENTICAL TIMESTAMPS he cannot choose between, which
    // is the whole problem restated. Fall back to the design's own name from the filename,
    // which the studio has always written as `ad-<angle>-<w>x<h>-<stamp>.jpg`.
    if (!g.label) {
      const first = g.items[0] || {};
      const m = /^ad-(.+?)-\d+x\d+-\d+/.exec(String(first.label || ""));
      g.label = m ? m[1].replace(/[-_]+/g, " ") : (first.label || "Saved creative");
    }
    g.items.sort((a, b) => (Number(b.w || 0) * Number(b.h || 0)) - (Number(a.w || 0) * Number(a.h || 0)));
  }
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return out;
}

// The images an ad should actually use: the chosen set if it still exists, otherwise the
// newest set, otherwise anything usable.
//
// 🔴 THE FALLBACK MATTERS AS MUCH AS THE CHOICE. A campaign pinned to a set he later deleted
// must not stop having an image, and it must not silently keep pointing at a file that is
// gone. It falls back to the newest set and the caller can say so.
export function adImagesFor(client, groupKey) {
  const groups = creativeGroups(client);
  if (!groups.length) return { images: adImages(client), group: null, fellBack: false };
  const wanted = groupKey ? groups.find((g) => g.key === groupKey) : null;
  const g = wanted || groups[0];
  return { images: g.items, group: g, fellBack: !!groupKey && !wanted };
}
