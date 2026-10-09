---
name: brand-kit
topic: My Businesses
task: set a business's exact brand colours (typed, picked, or read from an uploaded file such as a brand guide PDF, logo or picture), fonts, logo, photos and video from the OS; make the website, landing page and emails use them
keywords: [brand kit, brand colours, brand colors, hex, rgb, brand guide, pdf, logo upload, svg colours, palette, photos, video, media library, upload, brandKit, brandColor, bkParseColor, bkPalette, bkUpload, BrandKitCard, read-brand, brand-kit.mjs]
status: verified
summary: Bryson, 2026-10-09 - "i need a way to import my businesses or other businesses brand colors not by seeing their website but by being able to upload a file and or type in the actual colors as well as uploading images videos etc like how they would if they were an ad client for their landing page" and "work only on the my business part first ... then we will go to clients side". Built a Brand kit card on an owned business's Overview tab - main/second/accent colours (typed in any common form, colour picker, or tapped from colours found in a file), fonts, logo upload, photos and video upload into the same media library an ad client's portal uses. Files - an SVG's own colours, a picture's exact main colours sampled in the browser, a PDF brand guide (or picture) read by the AI for printed HEX codes and named fonts. Saving makes the main colour win on the website, landing page and emails. Clients' side is next.
verified: 2026-10-09
---

## What he asked (2026-10-09)

- "i need a way to import my businesses or other businesses brand colors not by seeing their website but by
  being able to upload a file and or type in the actual colors as well as uploading images videos etc like
  how they would if they were an ad client for their landing page."
- "work only on the my business part first for building then once we finish that we will go to clients side"

**Not done yet: the clients' side.** The card is mounted for `isOwned` only.

## Where

The **Brand kit** card is on an owned business's Overview tab, below Business portal and above Customer
emails. The Customer emails card no longer has its own logo, colour and website fields; it shows a preview
and points to the Brand kit.

## Colours

- **Main, second and accent colour** slots. Tap a slot to highlight it.
- Each slot takes a typed code: `#1D4ED8`, `1D4ED8`, `#abc` or `rgb(29, 78, 216)`
  (`bkParseColor`, the same rules as `parseColor` in `netlify/lib/brand-kit.mjs`, and verify-brand-kit
  runs both). A bad code turns red and is never saved. A colour picker sits next to each slot.
- **"Get colours from a file":**
  - **SVG:** its own fill, stroke and stop colours, with brand colours before black, white and greys
    (`bkSvgColors` and `svgColors`).
  - **Picture:** sampled in the browser (`bkPalette`). Pixels are bucketed, and each bucket returns the
    AVERAGE of its real pixels, so a flat colour comes back exact (an earlier version rounded #0F766E to
    #007766). Buckets under 2% are edge blends and are dropped. Greys go last, and near-duplicates are
    skipped.
  - **PDF or picture:** uploaded to `client-media/<id>/brand-file/` (signed upload, NOT added to the
    media library). Then `biz-email` `read-brand` sends it to the AI by URL (claude-sonnet-5-5, falling
    back to claude-sonnet-5) with `BRAND_READ_PROMPT`: use printed HEX codes exactly, never guess a font.
    `parseBrandRead` keeps only real HEX codes, no repeats, at most 8, with names and fonts as plain
    words.
  - 🔴 **Only a path inside this business's own folder** is read, only PDF/PNG/JPG/WEBP/GIF, only for an
    owned business, and only when signed in.
- Colours found show as swatches. Tapping one fills the highlighted slot and moves to the next.
- **"Pull from website"** (the old sniff) moved here. It still runs once on first open when the business
  was added with a website.

## Fonts

Headings and body. The AI fills them only when the file names them. 🔴 **They are saved but NOT yet used:**
the website designs still use their own fonts. This is suggested as the next step.

## Saving: the main colour wins everywhere

- `brandKit = {primary, secondary, accent, headingFont, bodyFont, updatedAt}`.
- It also sets `brandColor`, `brand.color`, and `website.brandColor` when the website is an object.
- Reading order:
  - `brandColorOf` (site-render, used by website, reports, partner page and portal) checks
    `brandKit.primary` first;
  - landing.mjs's colour reads it first;
  - `bizBrand` (emails) reads it first.
- Second and accent are saved with the kit; nothing uses them yet.

## Logo, photos, video

- `bkUpload` uses the same `media` sign, PUT and confirm path as an ad client's portal, with the
  business's `portalToken` (owned businesses have one from `makeInternalClient`).
- **Logo:** goes in as `category:"logo"` and also sets `brandLogo` and `brand.logoUrl`, so the website
  (mediaLibrary logo), landing page (`brandLogo`) and emails (`brand.logoUrl`) all use it.
  `bizBrand` also falls back to a library logo. Uploading a logo with no kit yet offers its colours as
  swatches.
- **Photos and video:** several at once, sorted into `photo` or `video` by file type, with the pixel size
  recorded for photos. The card shows the last 8 and links to the Assets tab to crop or remove them.
  Files must be under 50 MB (storage limit).

## Verification

- `tests/verify-brand-kit.mjs` (27 checks).
- Driven in a browser on laptop and phone: uploading a two-colour PNG gave exactly #0F766E and #F59E0B,
  and tapping a swatch filled the slot. No sideways scroll.
