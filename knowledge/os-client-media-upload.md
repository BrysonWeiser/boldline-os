---
name: os-client-media-upload
topic: OS app
task: work on client media uploads, deletes, the owner-side media gallery, and how the AI picks media
keywords: [media.mjs, mediaLibrary, signed-url, autoCat, option-background, category-select, action-delete, heroPath, heroIndex, media-del, client-media-gallery]
status: verified
summary: Portal My-Info media upload — media.mjs action=sign → browser PUTs to the signed URL → action=confirm appends {category,label,url,path} to the client's mediaLibrary[]. action=delete (2026-07-05) removes storage object + entry, used by BOTH the client portal (✕ per row) and the owner's Client Media gallery (Client View tab). The AI landing-page generator SEES the actual images (vision: URL image blocks, Supabase-only, max 10, text-only fallback) and OPTIONALLY picks a hero (heroIndex → landingPage.heroPath); renderers fall back to first photo → logo.
verified: 2026-07-05
---

**Flow:** on the portal **My Info** tab (a prominent gold "Your Photos & Video" card at the TOP of the tab since 2026-06-25, with an amber empty-state nudge that disappears after the first upload). `media.mjs` `action=sign` → the browser PUTs the file to the signed URL → `action=confirm` appends `{category,label,url,path}` to the client's `mediaLibrary[]`. Uploads fire on their own button, independent of "Save My Information" (which only saves the text fields).

**Why the category dropdown stays** (even though the "Worth adding" list already tells clients what to bring): the tag is **not just descriptive** — the **AI landing-page generator reads it** and uses the first photo/logo as the hero image.

**Gotcha — white-on-white `<option>` (2026-06-25):** the closed `<select>` was styled dark by `.inp`, but the native opened `<option>` list inherited no override → a white dropdown with near-white text (unreadable). Fix: `option{background:#0D0F16;color:#F9FAFB}`. Also smoothed the UX: reordered options to default to "Photo" (the common case), added a "What are you uploading?" label, and an `autoCat(input)` (wired via `onchange` on the file input) that auto-switches the category to "Video" when the file's MIME type starts with `video/` (logo/review still need a manual pick).

Applied identically to **both** `portal.js` and `index.html`'s `makePortalHTML` (see `os-portal-dual-copy`).

**Delete + gallery + AI media choice (2026-07-05):**
- `media.mjs` gained `action=delete` (body `{path}`, path must start with `<clientId>/`): removes the
  storage object (logs but proceeds if storage remove fails — the DB entry is what drives everything)
  and filters `mediaLibrary[]` by path; returns the updated list.
- **Client side** (both portal copies): each media row now shows a 36px thumbnail (▶ tile for video),
  `data-path`, and a red ✕ (`delMedia(this)` → confirm() → delete → row removed, empty-state restored).
  `uploadMedia` reads the confirm response (`d2.mediaLibrary[0]`) to build the new row with its path,
  and prepends (`insertBefore`) to match server newest-first order.
- **Owner side**: ClientHub → **Client View tab → "Client Media (N)" card** (between checklist and
  Landing Page): 2-col grid, `<img>` for photos/logos/reviews (click = open full size), `<video controls>`
  for videos, category chip + date + label, per-item Delete (window.confirm; calls media.mjs with
  `client.portalToken`, then `onUpdate` with the server-returned mediaLibrary).
- **AI is NOT required to use every asset**: `generate-landing.mjs` accepts `mediaLibrary` (ClientHub
  passes it), lists assets as an indexed AVAILABLE MEDIA block marked optional, and the tool schema has
  optional `heroIndex` (-1/omit = use none; video picks rejected server-side). Chosen asset →
  `landingPage.heroPath`. Renderers (`landing.mjs` + `makeLandingHTML`) resolve
  `lp.heroPath && media.find(path)` first, then fall back to first photo → logo — so deleting the chosen
  image degrades gracefully.
- **Vision selection (2026-07-05):** the generator attaches the ACTUAL images to the Claude request as
  URL image blocks (`{type:"image",source:{type:"url",url}}`), each preceded by a text block with its
  asset number, so heroIndex is picked by looking at the pixels (sharp/well-lit/real work), not filenames.
  Guards: only URLs on our own `SUPABASE_URL` host are attached (endpoint is unauthenticated — prevents
  feeding arbitrary URLs to the API), videos are never attached (no video input support), attach cap 10
  images to bound cost (~10–25¢ of image input tokens per generation on Opus). If the vision request
  errors (e.g. an unfetchable image), it retries once text-only rather than failing the generation.
  A/B split testing against real leads was assessed 2026-07-05 and deliberately DEFERRED until the first
  client has live traffic (design: landing.mjs 50/50 cookie split, variant tag on lead-intake leads,
  test big swings only — low-traffic significance takes months for small tweaks).
