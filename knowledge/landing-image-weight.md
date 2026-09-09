---
name: landing-image-weight
topic: Landing pages
task: fix landing page photos that show as broken images, and stop client uploads arriving at full phone resolution
keywords: [broken images, images not loading, landing page photos, image weight, iphone photos, 12 megapixel, supabase render image, image transformation, resize on upload, blShrink, photoAlt, alt text filename, IMG_6360, page too heavy, slow landing page]
status: verified
summary: Sebastian's live landing page showed three broken-image icons with the filenames as visible text. NOTHING WAS BROKEN — the files were public, valid, and served HTTP 200. They were three photos straight off an iPhone 13 Pro, 12 megapixels each, 13MB between them, on one page, on a phone; Safari gave up before they finished and painted the broken icon, which looks exactly like a dead link. Fixed at both ends. (1) `landing.mjs` now serves every stored photo through Supabase's `/storage/v1/render/image/public/` resizer at a sane width, which fixes photos ALREADY uploaded and negotiates WebP off the browser's Accept header: 5.3MB became 72KB, the page went from 13MB to under half a megabyte. (2) The portal shrinks an image in the browser BEFORE upload (max 1600px, JPEG 0.85, PNG kept for logos so transparency survives). Alt text no longer leaks camera filenames. Found and fixed 2026-09-08.
verified: 2026-09-08
---

**Why (Bryson, 2026-09-08):** *"Right now the live landing page the images are showing up like
this"*, with a screenshot of three broken-image placeholders reading `IMG_6360.png`,
`IMG_6110.jpeg`, `IMG_6679.jpeg`.

## 🔴 The diagnosis, which was the whole job

Everything that normally causes this was fine, and checking each one is what made the real
cause obvious:

| Suspected | Actual |
|---|---|
| Bucket is private, `getPublicUrl` returns a dead link | Bucket is public. Files return **HTTP 200** with correct content types. |
| URLs are relative and resolve against the client's own domain | Absolute Supabase URLs. |
| A CSP is blocking cross-origin images | No CSP anywhere in the repo. |
| Files are corrupt or HEIC misnamed | Valid PNG and JPEG headers, EXIF says iPhone 13 Pro. |

The measurements settled it:

```
IMG_6679.jpeg   2.97 MB   4032x3024   12.2 MP
IMG_6360.png    5.30 MB   1284x2778    3.6 MP
IMG_6110.jpeg   4.83 MB   4032x3024   12.2 MP
```

**13MB on one page, on a phone.** Safari stops waiting and paints the broken-image icon with
the alt text, which is visually identical to a 404 and is nothing of the sort. The most
expensive shape of bug there is: the page is live, the client is looking at it, and every
individual piece "works".

## Fix 1 — resize on delivery (fixes photos already uploaded)

Supabase image transformation **is enabled on this project** (tested, not assumed).
`sized(url, w)` in `netlify/functions/landing.mjs` rewrites
`/storage/v1/object/public/…` to `/storage/v1/render/image/public/…?width=<w>&quality=72`.
Hero 1600, gallery 1100, logo 400.

Measured: `5.3MB → 72KB`, `3.0MB → 261KB`. Format negotiates off the browser's own `Accept`
header, so modern browsers get WebP and old ones get the original type. **This is the half
that matters today**, because it fixes the photos Sebastian has already uploaded without
asking him to do anything.

🔴 **It rewrites ONLY our own storage URLs** — matched on `https://<sub>.supabase.co/` plus the
public-object path. A link typed in by hand, an image hosted elsewhere, or a relative path
comes out exactly as it went in.

🔴 **The helpers must be defined ABOVE the hero**, which is their first caller. Defined lower
down, a `const` throws on render and the whole page 500s. The suite caught exactly this.

## Fix 2 — shrink in the browser before upload (fixes the next one)

`blShrink(file, category, cb)` in the portal's inline script, applied in `uploadMedia`. Canvas
resize to max 1600px, `toBlob` at 0.85. The same technique was already in the file for help-chat
screenshots and had never been applied to the uploads that actually reach a client's page.

Four guards, each of which is a way this could quietly do harm:
- **A logo stays PNG** (`category === "logo"`). Flattening one to JPEG puts a white rectangle
  behind it, which on a dark landing page is worse than the original problem. Non-logos get a
  white fill painted first so a transparent PNG does not turn black.
- **Anything that is not an image uploads untouched.** A video cannot go through a canvas, and
  losing an upload is a far worse outcome than a slow one.
- **Never upload something bigger than what he picked.** A small image can come out heavier
  after a re-encode; if it does, the original goes.
- **Any decode failure falls back to the original** rather than failing the upload.

## Fix 3 — a camera filename is not alt text

`alt="${p.label || cl.name}"` printed `IMG_6360.png`, which is exactly what a visitor read on
the broken page and what a screen reader reads out even when it works. `photoAlt()` keeps a
label the client actually typed (minus its extension) and falls back to the business name for
anything matching a camera pattern (`IMG_`, `DSC_`, `PXL_`, `MVIMG_`, bare digits).

## Tests

`tests/verify-lead-handoff.mjs`, 208 checks. The helpers are **extracted and executed**, not
pattern-matched, and a page is **rendered with real fixtures** and its `<img>` tags read — a
mutation swapping the gallery's alt back to the raw label passed cleanly until that render
existed. 12 mutations, all caught.
