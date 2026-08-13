---
name: ad-creative-studio
topic: OS app
task: generate the ad IMAGE inside the OS so Build Campaign produces artwork as well as copy
keywords: [ad creative studio, AdCreativeStudio, drawAdCreative, canvas ad image, generate ad image, media library, ad-creative category, imageUrl auto-pick, meta launch card image, photo background scrim, adFitSize]
status: verified
summary: `AdCreativeStudio` + `drawAdCreative()` in index.html draw finished ad images on a browser `<canvas>` and push them into the client's media library via the existing media.mjs sign→PUT→confirm flow — which `MetaLaunchCard` ALREADY reads to auto-pick `imageUrl`, so Build Campaign now produces artwork as well as copy with nothing uploaded by hand. Five angle templates parameterized by niche + city, every field editable, four Meta sizes, auto-shrinking headlines, and an optional media-library photo drawn cover-fit under a scrim (the path a CLIENT creative takes). Built 2026-08-12. Scoped to the internal house account for now. 31-case Playwright suite, all passing.
verified: 2026-08-12
---

**Why (Bryson, 2026-08-12): *"wont the ai make the images and everything for the ad?"*** He was right that it was a gap, and the gap was narrower than it looked:
- **Copy was already automatic** — "✨ Fill copy" writes name/headline/primary text/description from the niche (`metaAgencySeed`).
- **The image was already auto-SELECTED** — `MetaLaunchCard` does `firstImg = (client.mediaLibrary||[]).find(m => m.url && m.category!=="video")` and passes it as `imageUrl`; `uploadImage()` in `meta-ads.mjs` POSTs it to `{act}/adimages` and stamps the returned hash on the creative.
- **Nothing ever CREATED an image.** The pipeline picks one if one exists; the house account's library was empty, so there was nothing to pick. That is the whole bug — hence a zip of files handed over by hand.

**The fix is a renderer, not intelligence.** `drawAdCreative(canvas, opts)` reproduces the offline `scripts/build-ad-creatives.js` design in canvas 2D: ink base, gold corner bloom + violet counter-bloom, hairline grid, top gold rule, logo lockup (from the `LOGO` data URI already in index.html:45) + letter-spaced gold kicker, headline lines with one gold accent line, wrapped sub, and the footer hairline + domain + offer.

**Why canvas and not a headless browser server-side:** no new dependency, no Chromium in a Lambda (which is a fight with the 50MB bundle limit), and it worked the same day. **The trade-off, stated honestly:** it only renders while the OS is open in a browser. A bot building a campaign unattended needs this moved server-side — Satori + resvg-js, or `@sparticuz/chromium`. Do that when the bots actually run unattended, not before.

**HONEST SCOPE — the words are templates, not an LLM call.** `AD_ANGLES` holds five angle builders (`top-of-google`, `phone-ringing`, `be-first`, `shared-leads`, `own-account`) parameterized by niche + city; picking an angle reseeds the editable fields. This is instant and free, which matters given the standing lean-on-credits preference — but it is **not** a model writing bespoke copy per creative. Wiring an AI rewrite is a small follow-up (one function, one button) and was deliberately not done in v1. Don't let the name imply more than it does.

**Layout safety:** `adFitSize()` steps the headline size down until the longest line fits the inner width, so a hand-typed line can never render clipped; `adWrap()` wraps the sub. The middle block is centred between the lockup and the footer, so every size composes without per-size tuning. Story sizes get a 300px top/bottom pad for the platform's UI chrome.

**Photo background — this is the CLIENT path.** An optional media-library image is drawn cover-fit with a diagonal scrim (`rgba(7,8,16,.95)` → `.55`), so the headline side stays dark and readable while the photo shows through on the open side. The picker only appears when the library has a non-video image. Same renderer, so a client creative built from their own photography is a UI change, not a new engine.

**Saving:** the same `media.mjs` `sign` → PUT signed URL → `confirm` flow the client portal uses, authenticated with `client.portalToken` (the internal house account gets one from `makeInternalClient`). Category `ad-creative`. On success `onUpdate` refreshes the client record so the launch card sees the new image immediately.

**Placement:** rendered in the Campaigns tab **above** the launch cards (make the image, then build the campaign that consumes it), gated `client.internal && runsMeta`. **Deliberately not shown for real clients yet** — a client's ad needs THEIR brand and logo, not BoldLine's; see the open question below.

**Same two hard rules as KB `ad-creatives`:** no drawn buttons (Meta prohibits non-functional buttons; a painted pill can't be tapped), and no claims about results BoldLine has not produced.

**Verified 2026-08-12 — 31 Playwright cases, all passing**, driving the real component in real Chromium: renders at all four sizes with content actually present (pixel-lit %) and **nothing touching the right edge at any size**; a deliberately over-long headline shrinks instead of clipping; the photo path shows through on the open side while the text side stays dark; the studio mounts, the photo picker hides on an empty library, headlines reseed from niche + city, three previews render, and Save issues exactly 3 sign + 3 PUT + 3 confirm calls carrying the portalToken, updates the client record and confirms to the user; 0px overflow at 390/768/1280/1600.

**OPEN — the client case (Bryson asked in the same breath):** *"a client pays for a Meta package, has assets but no single finished image — what then? I don't want to make it myself."* The renderer already handles it (photo + scrim); what's missing is **brand-per-client** — their logo, their colours, their name in the lockup instead of BoldLine's. That means a small brand block on the client record (logo from the media library, primary colour, tagline) and passing it into `drawAdCreative` instead of the hard-coded BoldLine tokens. Then the same studio opens on any client. Not built yet.
