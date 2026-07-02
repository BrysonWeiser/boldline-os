---
name: os-client-media-upload
topic: OS app
task: work on client media uploads in the portal and the category-drives-hero behavior
keywords: [media.mjs, mediaLibrary, signed-url, autoCat, option-background, category-select]
status: verified
summary: Portal My-Info media upload — media.mjs action=sign → browser PUTs to the signed URL → action=confirm appends {category,label,url,path} to the client's mediaLibrary[]. The category tag is load-bearing: the AI landing-page generator reads it to pick the hero image. Includes the white-on-white <option> fix.
verified: 2026-07-02
---

**Flow:** on the portal **My Info** tab (a prominent gold "Your Photos & Video" card at the TOP of the tab since 2026-06-25, with an amber empty-state nudge that disappears after the first upload). `media.mjs` `action=sign` → the browser PUTs the file to the signed URL → `action=confirm` appends `{category,label,url,path}` to the client's `mediaLibrary[]`. Uploads fire on their own button, independent of "Save My Information" (which only saves the text fields).

**Why the category dropdown stays** (even though the "Worth adding" list already tells clients what to bring): the tag is **not just descriptive** — the **AI landing-page generator reads it** and uses the first photo/logo as the hero image.

**Gotcha — white-on-white `<option>` (2026-06-25):** the closed `<select>` was styled dark by `.inp`, but the native opened `<option>` list inherited no override → a white dropdown with near-white text (unreadable). Fix: `option{background:#0D0F16;color:#F9FAFB}`. Also smoothed the UX: reordered options to default to "Photo" (the common case), added a "What are you uploading?" label, and an `autoCat(input)` (wired via `onchange` on the file input) that auto-switches the category to "Video" when the file's MIME type starts with `video/` (logo/review still need a manual pick).

Applied identically to **both** `portal.js` and `index.html`'s `makePortalHTML` (see `os-portal-dual-copy`).
