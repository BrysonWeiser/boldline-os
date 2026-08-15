---
name: campaign-build-failures
topic: Ads
task: diagnose a failed Build Campaign, and why the Meta card said no image when images were saved
keywords: [createCampaign failed, required field was not present, an ad image is required, meta ad image, media library, imageUrl, useState initial value, apiErrMsg, fieldPathElements, google ads error]
status: verified
summary: First real Build attempt failed on both platforms. META was a genuine bug — `imageUrl` was a `useState` INITIAL value, evaluated once on mount, so creatives saved from the Ad Creative Studio afterwards never reached the card and Build failed with "an ad image is required" while four images sat in the library. Fixed with an effect that follows `client.mediaLibrary`, preferring `category:"ad-creative"`, newest first, and stopping the moment a URL is typed by hand. GOOGLE returned "The required field was not present." with NO field named — the error formatter now surfaces the exact `fieldPathElements` path, the Google error code, and the count of additional errors, and logs the whole failure. The Google cause WAS then named by that very error: Google now requires `containsEuPoliticalAdvertising` on every campaign create (EU TTPA regulation). One field, fixed.
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

## 🟢 GOOGLE — diagnosed and fixed by the better error

**Symptom:** `createCampaign: The required field was not present.` — naming nothing.

**The improved formatter paid for itself on the very next press:**
```
[field: mutate_operations[1].campaign_operation.create.contains_eu_political_advertising | fieldError=REQUIRED]
```

**Cause:** Google now **requires `containsEuPoliticalAdvertising` on every campaign create** — the EU Transparency and Targeting of Political Advertising (TTPA) regulation. It is not optional and has no default, so every campaign build failed at operation 1 before any ad group was even reached. Nothing to do with the multi-ad-group work; `createCampaign` had simply never completed against the live API since the day it was written.

**Fix:** one field, always the negative declaration, since BoldLine and its clients run commercial lead-gen and never political advertising:
```js
containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
```
**If a genuinely political advertiser is ever onboarded** this must become a per-client field and that client needs EU verification. Recorded here so nobody hard-codes their way into a compliance problem.

**The lesson worth keeping:** the first instinct was to guess which field was missing. Guessing costs a full round-trip per attempt and had already been wrong once that day (the Netlify secret). Spending one round-trip on making the ERROR better instead turned an unbounded guessing game into a one-line fix. Any Google Ads failure from here names its own field, error code, trigger, and how many other errors came with it.

**Verified by 34 + 16 cases:** the declaration is asserted on both the multi-ad-group and legacy single-group build paths; the Meta picker prefers an ad-creative over an older photo, falls back to a photo, skips videos and survives an empty library; the effect exists, stops on a hand-typed URL and offers a way back; and the error formatter renders the field path, the code, the extra-error count, a sensible bare-failure message, and no false "more errors" claim on a single one.
