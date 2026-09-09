---
name: crop-studio
topic: OS
task: crop a client's photo from the OS without asking them to re-upload it
keywords: [crop, crop studio, image editor, crop photo, edit client photo, CropStudio, media library crop, screenshot crop, retire original, source category]
status: verified
summary: A crop editor on the OS Client Media card (Assets tab). Drag to move, drag the corner to resize, with Free / Square / Landscape / Wide presets, all on pointer events because he is on a phone. 🔴 It NEVER destroys the original: the crop uploads as a NEW photo and the original is re-filed as `source`, a category everything already excludes from pages and ads, so a bad crop costs one more crop rather than the client's only photo of a job. Cuts at the FILE's resolution capped at 1600px, fills white first so a transparent PNG does not crop to black, and loads the image cross-origin so the canvas can be read at all. Built 2026-09-09.
verified: 2026-09-09
---

**Why (Bryson, 2026-09-09):** after finding a phone screenshot on a client's live landing
page, *"is there a way i can just crop the images myself like a little editor for myself"*.
The alternative was messaging the client, waiting, and hoping the next upload is better, with
the wrong picture live the whole time.

`CropStudio` in `index.html`, opened by a **Crop** button on each tile of the Client Media
card (Assets tab), beside the Delete button that was already there.

## 🔴 It never destroys the original

The crop uploads as a **new** photo through the same token-authed `media` endpoint the portal
uses, and the original is re-filed as **`source`** — an existing category that `isSourceOnly`
already excludes from every page and every ad (KB `media-roles`). So:
- a bad crop costs one more crop, not the client's only photo of a job they did months ago,
- the client never sees a file of theirs disappear from their own portal,
- and it is reversible by editing the category back.

A cropped **logo stays a logo**; filing it as a photo would drop it into the gallery of their
work. Videos get no Crop button at all, because a canvas cannot crop one.

## Things that would have been quietly wrong

- 🔴 **Cut at the file's resolution, not the displayed size.** `sx = nat.w / el.clientWidth`.
  Cropping the on-screen copy hands back a ~180px image off a 12MP photo, and it looks fine
  in review.
- 🔴 **`crossOrigin="anonymous"` or nothing works at all.** The file is served from Supabase,
  another origin, and without it `toBlob` throws on a tainted canvas. Verified first that
  Supabase storage returns `access-control-allow-origin: *`.
- **White fill before drawing**, so a transparent PNG does not crop to black.
- **Capped at 1600px**, or a crop could re-introduce the multi-megabyte files that caused the
  broken-image bug in the first place (KB `landing-image-weight`).
- **Pointer events with `touchAction:"none"`** and a 26px handle, because on a phone a corner
  pixel is not a target and a drag would otherwise scroll the page.

## 🔴 Gotcha, hit TWICE now

`CropStudio` is JSX and must live **with the components**, not among the plain-JS helpers
between `isSourceOnly` and `adPerfStats`. Two suites (`verify-media-roles`, and the field
formatters) extract that range and `eval` it; a component dropped inside breaks them. The
same trap caught `FieldNotes` earlier the same day.

Moving it then emptied the crop tests' own slice, which **passed silently** because every
"is not present" assertion is true of an empty string. `verify-crop-studio` now fails loudly
if the extraction comes back empty.

## Tests

- `tests/verify-crop-studio.mjs` — 29 checks. The clamp maths is extracted and RUN: a box
  dragged off the edge, one bigger than the picture, one collapsed to nothing, and a locked
  ratio inside a picture too short for it.
- `tests/verify-crop-pixels.mjs` — runs the component's **real `save()`** in headless
  Chromium against a red/blue quadrant image and reads the pixels of the blob it uploads.
  Cropping the top-left must come back red, the bottom-right blue, and a 400px source cropped
  in half must be ~200px rather than the ~180px it was displayed at. Skips cleanly with no
  browser. Pattern-matching cannot tell you a crop cut the right part of the picture.

11 mutations, all caught, including reading the on-screen size, deleting the original, and
offering the button on a video.
