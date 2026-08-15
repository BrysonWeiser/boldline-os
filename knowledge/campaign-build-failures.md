---
name: campaign-build-failures
topic: Ads
task: diagnose a failed Build Campaign, and why the Meta card said no image when images were saved
keywords: [createCampaign failed, required field was not present, an ad image is required, meta ad image, media library, imageUrl, useState initial value, apiErrMsg, fieldPathElements, google ads error]
status: partial
summary: First real Build attempt failed on both platforms. META was a genuine bug — `imageUrl` was a `useState` INITIAL value, evaluated once on mount, so creatives saved from the Ad Creative Studio afterwards never reached the card and Build failed with "an ad image is required" while four images sat in the library. Fixed with an effect that follows `client.mediaLibrary`, preferring `category:"ad-creative"`, newest first, and stopping the moment a URL is typed by hand. GOOGLE returned "The required field was not present." with NO field named — the error formatter now surfaces the exact `fieldPathElements` path, the Google error code, and the count of additional errors, and logs the whole failure. The Google cause is NOT yet identified; the next attempt will name it.
verified: 2026-08-14
---

**Bryson, 2026-08-14, first real Build attempt.** Both cards failed.

## 🟢 META — a real bug, fixed

**Symptom:** `createCampaign: an ad image is required — Meta link ads must have an image. Upload one to the client's media library, then retry.` — with **four creatives already saved** from the Ad Creative Studio moments earlier, and the Studio's own hint promising "the Meta launch card will use the newest one".

**Cause:** `MetaLaunchCard` computed `firstImg` at component top level and used it as the **`useState` initial value** for `f.imageUrl`. A `useState` initial value is evaluated **once, on mount**. The Studio saves later in the same session, `client.mediaLibrary` updates, the card re-renders — and `f.imageUrl` keeps the empty string it was born with. The promise in the UI was real; the wiring was not. **Same class of bug as the budget auto-link**, which is why the fix mirrors it exactly.

**Fix:** an effect that follows the library, plus two refinements worth keeping:
- **Ad creatives beat stock photos.** The Studio saves with `category: "ad-creative"`; those are preferred over any other image, so a client photo uploaded months ago cannot outrank the creative just generated.
- **A typed URL wins and stays won** (`imgTouched`), with an inline link back to the newest saved creative. Without that flag the effect would overwrite anything hand-entered on the next render.
- The empty state now says why Build will fail and exactly which button fixes it, rather than failing at the API.

## 🟡 GOOGLE — cause still unknown, but the next error will name it

**Symptom:** `createCampaign — createCampaign: The required field was not present.`

That message is Google's, and on its own it is close to useless: it does not say **which** field, on **which** operation, out of a mutate carrying a budget, a campaign, location + language + negative criteria, three ad groups, three ads and 26 keywords. Guessing costs a round-trip each time.

**What changed:** `apiErrMsg` now pulls up
- the **field path** from `location.fieldPathElements`, rendered like `operations[7].ad_group_ad_operation.create.ad.final_urls`,
- the **Google error code** (`fieldError=REQUIRED`),
- the **trigger** value when present,
- and **how many other errors came with it** — a mutate can fail several ways at once, and fixing one at a time is how three attempts become nine.

The full `error` object is also `console.error`'d, so the Netlify function log has everything if the surfaced line still is not enough.

**NOT diagnosed yet.** The honest state: the cause is unidentified. The next Build attempt will name the field, and the fix follows from that. Do not guess at candidate fields before that error arrives — `createCampaign` has never completed against the live API (it carried a "NOT yet verified against a live linked account" warning from the day it was written), so the failure may be pre-existing rather than anything the multi-ad-group change introduced.

**Verified by 16 cases:** the picker prefers an ad-creative over an older photo, falls back to a photo when no creative exists, skips videos, and returns nothing rather than crashing on an empty library; the effect exists, stops on a hand-typed URL, and offers a way back; and the error formatter renders the field path, the error code, the extra-error count, a sensible message for a bare failure, and no false "more errors" claim for a single one.
