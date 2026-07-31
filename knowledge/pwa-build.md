---
name: pwa-build
topic: OS app
task: install the BoldLine OS as an app on phone/desktop, or change the app icon, manifest, or service worker
keywords: [pwa, manifest, webmanifest, service-worker, service worker, installable, add to home screen, standalone, maskable, apple-touch-icon, theme-color, install prompt, offline, network-first]
status: verified
summary: Phase 1 of the PWA is BUILT + verified (2026-07-30) — the OS is now installable on desktop/Android/iOS from an icon. Added manifest.webmanifest + service-worker.js + PWA icons at repo root, PWA meta in index.html <head>, SW registration script, and netlify.toml headers. SW is network-first (always fresh online, cached shell offline). Phase 2 (web-push to phone) still pending.
verified: 2026-07-30
---

**What Phase 1 shipped (installable app):** the OS (`index.html`, repo-root Netlify site) is now an
installable PWA. Files added **at the repo root** (the OS site's web root — NOT marketing-site/):

- **`manifest.webmanifest`** — `name` "BoldLine OS", `short_name` "BoldLine OS" (the home-screen icon
  label; changed from "BoldLine" on 2026-07-31 — installed WebAPKs update the label on Chrome's periodic
  manifest refresh or on reinstall, not instantly), `display: standalone`,
  `start_url`/`scope` `/`, `theme_color`/`background_color` `#070810` (matches the app bg), `id: "/"`,
  and 4 icons (192 + 512, each in `purpose: "any"` and `purpose: "maskable"`).
- **`service-worker.js`** — **network-first** (see strategy below). `CACHE_VERSION = "v1"` — bump it to
  force a clean cache rollover on a breaking change.
- **Icons** (generated, see below): `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`,
  `icon-512-maskable.png`, `apple-touch-icon.png` (180²), plus `favicon.ico` (copied from marketing-site).
- **`index.html` `<head>`** (inserted right after `<title>`): `<link rel="manifest">`, `theme-color`,
  `<link rel="icon">` (favicon.ico + icon-192.png), `apple-touch-icon`, and apple/mobile web-app metas
  (`apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black`,
  `apple-mobile-web-app-title=BoldLine OS`, `mobile-web-app-capable=yes`).
- **`index.html`** SW registration: a small plain `<script>` before the final `</body>` that registers
  `/service-worker.js` on `load` (guarded by `'serviceWorker' in navigator`).
- **`netlify.toml`** `[[headers]]`: `Cache-Control: public, max-age=0, must-revalidate` on
  `/service-worker.js` (so code updates roll to installed apps) + `Content-Type: application/manifest+json`
  on `/manifest.webmanifest`.

**Service-worker strategy = NETWORK-FIRST (deliberate, per the plan):** the OS is one big live
`index.html`, so we must always run the freshest deploy online. The SW fetches fresh every time and only
falls back to the cached shell when offline — avoids the classic PWA stale-cache-after-deploy footgun.
It **skips** cross-origin (Supabase, unpkg CDNs) and all dynamic routes (`/.netlify/*`, `/portal`,
`/lead`, `/lp/*`) — those always hit the network, never cached. Navigations fall back to cached
`/index.html` offline.

**Netlify shadowing gotcha (why the SPA catch-all doesn't eat the new files):** the `/* -> /index.html
200` rewrite has NO `force`, so Netlify serves real files (manifest, SW, icons) directly and only
rewrites paths with no matching file. No redirect changes were needed. (Only `/knowledge/*` uses
`force=true`.)

**Icon generation (no sharp/ImageMagick/PIL in this env):** used the pre-installed **headless Chromium
as an image engine** via the global Playwright (`/opt/node22/lib/node_modules`, chromium at
`/opt/pw-browsers`). A canvas draws the 512² source (`marketing-site/icon.png`, gold "BL" monogram on a
`#0d0d0d` rounded square) at each size and re-encodes via `toDataURL`. **"any"** icons keep the source
as-is (rounded-square look for iOS/desktop). **"maskable"** icons are full-bleed: fill the canvas with the
source's sampled bg (`#0d0d0d`) then draw the monogram at 88% centered, so it sits inside the maskable
safe zone (inner 80%) and Android's adaptive mask crops only background. Script archived in the
verification-harness pattern; re-run if the source logo changes. **To change the app icon:** replace
`marketing-site/icon.png` (512² source) and regenerate all six outputs.

**Verified headlessly (20/20 checks passed):** a harness serves the repo root like Netlify (real files
first, SPA fallback for navigations) and drives Chromium to confirm: manifest valid JSON + correct
content-type, all 6 icons 200, head tags present, **SW registers + controls the page after reload**, and
**Chrome's own `Page.getAppManifest` (CDP) reports zero installability errors**. On the real HTTPS
Netlify site that means the desktop Install button + Android "Add to Home Screen" will appear.

**How Bryson installs it (teach-the-setup):**
- **Desktop Chrome/Edge:** open the OS URL → an **install icon** appears at the right end of the address
  bar (a monitor with a down-arrow), or menu (⋮) → **"Install BoldLine OS…"** → Install. It opens in its
  own window with the gold BL icon; pin it to the taskbar/dock.
- **Android (his Galaxy S25), Chrome:** open the OS URL → menu (⋮) → **"Add to Home screen"** / **"Install
  app"** → Install. Launches full-screen from the home-screen icon.
- **iPhone (future 17 Pro), Safari:** open the URL → **Share** (square-with-up-arrow) → **"Add to Home
  Screen"** → Add. (iOS only installs PWAs from **Safari**, not Chrome.)

**Still pending / follow-ups:**
- **Phase 2 — web-push notifications** (the point of the whole thing: OS alerts hit his phone). Needs VAPID
  keys, an SW `push` handler + a "turn on notifications" subscribe flow, store subscriptions in Supabase,
  and server-side send wired into `dispatchAlert`/alerts. Free (Web Push). See `pwa-plan` + `os-alerts-notifications`.
- **Domain switch:** when the Wix→domain transfer finishes, stand up **app.boldlinemedia.com** (CNAME
  `app` → the OS Netlify site) and switch `start_url`/`scope` — Bryson re-installs once from the new URL
  (~10 sec). See `domain-dns-wix`.
- **iOS launch splash (optional polish):** no `apple-touch-startup-image` tags yet, so iOS shows a brief
  plain screen on launch (harmless; skipped — Android is his current device).

**Deploy note:** DEPLOYED to production 2026-07-30 — merged `claude/pwa-build-k5zm1o` into `main`
(Netlify auto-deploys `main`). Pre-merge restore point: `rollback/20260730T201705Z` (main @ `fde9f67`);
logged in `docs/DEPLOYS.md`. Installable from the live HTTPS OS URL now.
