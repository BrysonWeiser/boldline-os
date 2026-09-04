---
name: media-roles
topic: Assets/Media
task: control which images an ad uses, or why a background photo appeared in Assets
keywords: [background image saved to assets, source category, media roles, ad-creative, creative set, adCreativeGroup, creativeGroups, adImagesFor, storm images, wrong image in ad, newest wins, canvas taint, media library category]
status: built
summary: Picking a stock photo as a creative background copied it into the library as a normal photo, so a bare image became a candidate for the ad itself. And the launch card used the newest ad-creative FILE, so making a second angle later silently switched a running ad onto it. Backgrounds are now filed as "source" and excluded everywhere, and each Save stamps a group so an ad runs one chosen set. 16 checks, ten mutations caught.
verified: 2026-09-04
---

## Two bugs, both of which looked like features

Bryson, 2026-09-04:
> *"the image i select to use as a background image also got saved into the assets tab to be
> used for ads which i dont want only the finalized image or images should be saved"*
> *"i dont want the current ad we have running for leads to use the storm related images I
> want them using the your leads arent sold to other roofers images"*

### 🔴 One: the background had to be copied, and then behaved like a deliverable

Choosing a stock photo as a background **copies it into the library, and that copy is not
optional**: the creative is drawn on a canvas and read back with `toBlob()`, and drawing a
cross-origin image **taints the canvas so the read throws**. The preview looks perfect and the
download fails. Copying makes it same-origin.

But it was filed as **`photo`**, the category an uploaded picture gets, so a bare photo with no
words on it was a candidate for the ad itself and sat in Assets as though he had made it.

**Now `source`**: still stored, still readable by the canvas, never offered to an ad. The
category is passed by the caller, so a photo picked for a **landing page** hero is still
`photo`.

### 🔴 Two: "newest wins" is not "the one I picked"

The launch card took the newest `ad-creative`. **One press of Save writes the same design at
four placement sizes**, so a set is four files. Make a second angle later and the newest four
are the new angle, so a running ad silently switches to it. That is the storm-vs-leads report
exactly: two angles in one library and the ad following the clock rather than the choice.

Each save now stamps a **`group`** (`<angle>-<timestamp>`) and a **`groupLabel`** (the
headline). `campaignSetup.adCreativeGroup` records which set an ad runs, with a picker on the
launch card and the line *"Only this set is used. The other designs in your library are left
alone."*

## Details worth keeping

- 🔴 **A deleted set falls back to the newest AND says so** on screen. Silently swapping would
  mean he never learns his choice was lost.
- 🔴 **Files saved before groups existed do not merge.** Each falls back to `single:<path>`, so
  two unrelated old creatives are two sets, not one set an ad would run both of.
- **An unnamed set is named from its filename** (`ad-<angle>-<w>x<h>-<stamp>.jpg`), because a
  row of identical timestamps is the original problem restated.
- 🔴 **THREE pickers chose images independently** (the Meta launch card, the creative swap on a
  live ad, and the card's hint). A fix to one would have left the others offering a bare
  background. They all go through `adImages` now, and a check fails if any picker filters only
  videos again.

## 🔴 Two copies

`netlify/lib/media-roles.mjs` and an inlined copy in `index.html`, because the browser cannot
import the lib. `tests/verify-media-roles.mjs` **extracts the browser copy and runs every case
against both**, so drift fails rather than ships.

16 checks, ten mutations all caught, including one that changed only the browser copy.
