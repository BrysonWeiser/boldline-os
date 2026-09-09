// Cropping a client's photo from the OS.
//
// Bryson, 2026-09-09, after finding a phone screenshot on a client's live page: *"is there a
// way i can just crop the images myself like a little editor for myself"*. The alternative
// was messaging the client, waiting, and hoping the next upload is better, with the wrong
// picture live the whole time.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S  = readFileSync(join(ROOT, "index.html"), "utf8");
const UI = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const SRC = S.slice(S.indexOf("function CropStudio("), S.indexOf("function LaunchChecklistCard("));

// 🔴 A SLICE THAT SILENTLY COMES BACK EMPTY PASSES EVERY "not present" CHECK AND FAILS
// NOTHING. Moving the component once already emptied it.
if (!SRC.includes("const save = async")) { console.log("  FAIL  CropStudio could not be extracted"); process.exit(1); }
let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

// ── It is reachable, on the screen where the photos are ─────────────────────
{
  ok("every photo has a Crop button", /onClick=\{\(\)=>setCropping\(m\)\}/.test(UI));
  ok("🔴 but a video does not, because a canvas cannot crop one",
    /\{m\.category!=="video"&&\([\s\S]{0,300}?setCropping\(m\)/.test(UI),
    "offering a button that cannot work is worse than not offering it");
  ok("the editor opens over the screen and can be cancelled",
    /<CropStudio client=\{client\} media=\{cropping\}/.test(UI) && /onCancel=\{\(\)=>setCropping\(null\)\}/.test(UI));
  ok("one photo at a time", /const \[cropping,setCropping\]/.test(UI) && !/croppings/.test(UI));
}

// ── 🔴 IT NEVER DESTROYS THE ORIGINAL ───────────────────────────────────────
{
  ok("🔴 the crop is uploaded as a NEW file",
    /action=sign/.test(SRC) && /action=confirm/.test(SRC) && !/action=delete/.test(SRC),
    "a bad crop must cost one more crop, not the client's only photo of a job they did months ago");
  ok("🔴 and the original is re-filed as source, not removed",
    /x\.path === media\.path \? \{ \.\.\.x, category: "source" \}/.test(SRC),
    "source is already excluded from every page and every ad, so it stops showing without anything being lost");
  ok("the source category really is excluded everywhere",
    /const isSourceOnly = \(m\) => String\(\(m\|\|\{\}\)\.category\|\|""\)==="source";/.test(UI)
    && /!isSourceOnly\(m\)/.test(UI));
  ok("a cropped logo stays a logo rather than becoming a photo",
    /media\.category === "logo" \? "logo" : "photo"/.test(SRC),
    "filing a logo as a photo would put it in the gallery of their work");
  // 🔴 landing.mjs resolves the hero by PATH FIRST and does not check the category, so a
  // retired original would stay the hero forever: the page would keep showing the exact
  // picture he just cropped because it was bad. Cropping the hero is the case where he cared
  // most about how it looks.
  ok("🔴 cropping the pinned hero moves the pin onto the crop",
    /lp\.heroPath === media\.path\s*\?\s*\{ landingPage: \{ \.\.\.lp, heroPath: sign\.path, heroUrl: "" \} \}/.test(SRC),
    "the hero is found by path and the category is never checked, so a retired original stays the hero");
  ok("and cropping any other photo leaves the hero alone",
    /: null;/.test(SRC) && /onDone\(next, patch\)/.test(SRC));
  ok("the screen applies whatever the editor hands back",
    /onDone=\{\(lib,patch\)=>\{ onUpdate\(\{\.\.\.client, mediaLibrary:lib, \.\.\.\(patch\|\|\{\}\)\}\)/.test(UI));
  ok("the client is never asked to confirm anything, since this is the owner's tool",
    !/window\.confirm/.test(SRC));
}

// ── The crop itself ─────────────────────────────────────────────────────────
{
  ok("🔴 it cuts from the FILE's resolution, not the size on screen",
    /const sx = nat\.w \/ el\.clientWidth, sy = nat\.h \/ el\.clientHeight;/.test(SRC),
    "cutting from the on-screen copy hands back a 300px image off a 12MP photo");
  ok("and the result is capped so a crop cannot re-introduce a huge file",
    /const cap = 1600/.test(SRC),
    "the whole page weight problem was 13MB of phone photos; a crop must not undo that");
  ok("it fills white first, so a transparent PNG does not crop to black",
    /ctx\.fillStyle = "#FFFFFF"; ctx\.fillRect/.test(SRC));
  ok("🔴 the image is loaded cross-origin, or the canvas cannot be read at all",
    /crossOrigin="anonymous"/.test(SRC),
    "Supabase serves the file from another origin; without this toBlob throws on a tainted canvas");
  ok("the new file records its own size, so the screenshot check works on it too",
    /w: ow, h: oh/.test(SRC));
  ok("a failed crop says so rather than closing silently",
    /The crop could not be created/.test(SRC) && /setErr\(String/.test(SRC));
  ok("every step of the upload has its own message",
    /Could not start the upload/.test(SRC) && /The upload was refused/.test(SRC)
    && /uploaded but could not be saved/.test(SRC));
}

// ── It works with a thumb, on a phone ───────────────────────────────────────
{
  ok("🔴 pointer events, not mouse events",
    /onPointerMove=/.test(SRC) && /onPointerDown=/.test(SRC) && !/onMouseDown=/.test(SRC),
    "he is on a phone almost every time he opens this");
  ok("dragging does not scroll the page instead of moving the box",
    (SRC.match(/touchAction:"none"/g) || []).length >= 3);
  ok("the resize handle is a real thumb target, not a corner pixel",
    /width:26,height:26/.test(SRC));
  ok("the pointer is captured, so a fast drag off the image does not strand the box",
    /setPointerCapture/.test(SRC));
  ok("there are ratio presets, including the square most galleries want",
    /\["Square",1\]/.test(SRC) && /\["Landscape",4\/3\]/.test(SRC));
  ok("it says how to use it in one line", /Drag the box to move it/.test(SRC));
  ok("and says the original is kept, which is the thing that makes it safe to try",
    /The original is kept and simply stops being used/.test(SRC));
}

// ── The maths, extracted and RUN ────────────────────────────────────────────
// A crop that is off by a scale factor is invisible in a screenshot and obvious on a client's
// page, so the numbers are computed here rather than eyeballed.
{
  const clampSrc = SRC.slice(SRC.indexOf("  const clamp = (b) => {"), SRC.indexOf("  const start ="));
  const mk = (ratio, W, H) => new Function("b", `
    const imgRef = { current: { clientWidth: ${W}, clientHeight: ${H} } };
    const ratio = ${ratio};
    ${clampSrc.replace("const clamp = (b) => {", "return (function(b){").replace(/\};\s*$/, "})(b);")}`);
  const clamp = (r, W, H) => (b) => mk(r, W, H)(b);

  const c = clamp(0, 400, 300);
  ok("🔴 a box dragged off the right edge is pulled back inside",
    (() => { const r = c({ x: 380, y: 10, w: 100, h: 100 }); return r.x + r.w <= 400 && r.x >= 0; })(),
    "a crop rectangle outside the picture reads from nothing and produces a blank image");
  ok("and off the top", (() => { const r = c({ x: 10, y: -50, w: 100, h: 100 }); return r.y >= 0; })());
  ok("a box bigger than the picture is shrunk to fit",
    (() => { const r = c({ x: 0, y: 0, w: 9999, h: 9999 }); return r.w <= 400 && r.h <= 300; })());
  ok("it never collapses to nothing",
    (() => { const r = c({ x: 10, y: 10, w: 1, h: 1 }); return r.w >= 28 && r.h >= 28; })(),
    "a zero-width crop is a zero-byte upload");
  ok("🔴 a locked ratio is honoured",
    (() => { const r = clamp(1, 400, 300)({ x: 0, y: 0, w: 200, h: 50 }); return Math.abs(r.w - r.h) < 0.01; })());
  ok("and a locked ratio still fits inside a picture too short for it",
    (() => { const r = clamp(1, 400, 100)({ x: 0, y: 0, w: 400, h: 400 }); return r.w <= 400 && r.h <= 100; })(),
    "forcing the ratio without re-checking the height pushes the box off the bottom");
}

console.log(`verify-crop-studio: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
