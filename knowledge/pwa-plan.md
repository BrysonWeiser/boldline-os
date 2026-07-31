---
name: pwa-plan
topic: OS app
task: turn the BoldLine OS into an installable desktop + mobile app (PWA) with push notifications
keywords: [pwa, app, installable, manifest, service worker, add to home screen, desktop app, mobile app, push notifications, web push, VAPID, standalone, icon]
status: verified
summary: Approved plan (Bryson, 2026-07-29/30) to turn the OS (index.html, served at the repo-root Netlify site) into an installable PWA so it launches from an icon on his phone + computer, then wire web-push so OS alerts hit his phone. UPDATE 2026-07-31 — **BOTH phases BUILT + deployed: Phase 1 (installable) → `pwa-build`; Phase 2 (web-push) → `pwa-push` (needs a one-time VAPID env + Supabase table setup to activate).** Remaining: switch to app.boldlinemedia.com once the domain transfer finishes (he re-installs once — trivial).
verified: 2026-07-31
---

**Decisions (Bryson):**
- **Do a PWA**, not native/app-store (no fees, no review, one codebase). He just doesn't want to use it in a browser tab.
- **Phase 1 — installable app:** manifest + service worker + icons → installs on desktop (Chrome/Edge "Install"), Android ("Add to Home Screen"), and his future **iPhone 17 Pro** (iOS 16.4+ PWA, all functions). His current phone is a **Samsung Galaxy S25 (Android)** — install + push both work TODAY.
- **Phase 2 — web-push notifications** wired into the existing alert path (`dispatchAlert` / alerts) so OS alerts (billing, approvals, client decisions, spend spikes, etc.) hit his phone like a native app. Web Push = free (VAPID keys), needs: SW push handler + a "turn on notifications" subscribe flow + store subscriptions (Supabase) + server-side send from dispatchAlert.
- **URL:** build on the CURRENT OS URL now (the OS is the repo-root Netlify site, currently `boldline-media.netlify.app` / whatever the OS site domain is — NOT the marketing boldlinemedia.com site). When the Wix→Namecheap→Cloudflare domain transfer finishes, stand up **app.boldlinemedia.com** (CNAME `app` → the OS Netlify site) and switch the manifest `start_url`/scope; he **re-installs once** from the new URL (10 sec). Optionally add a redirect so the old install keeps working. (Domain transfer still pending as of 2026-07-30 — see domain-dns-wix / the send_later reminders.)
- **No extra re-auth lock** (relies on device lock).
- **Service worker = network-first** for the app shell (always fetch fresh code online, fall back to cache offline) to avoid the classic PWA stale-cache footgun after deploys.

**Build notes / gotchas:**
- The OS is a **single `index.html`** (React via in-browser Babel) served by Netlify from the **repo root** — a SEPARATE Netlify site from the marketing site (`marketing-site/`, boldlinemedia.com). So the PWA manifest + icon files must live at the **repo root** (the OS site's web root), NOT in marketing-site/. The black icon assets currently only exist under `marketing-site/` (icon.png 512², favicon.ico) per KB `site-favicon` — copy/reuse those into the OS site root for the app icon (maskable 192/512 recommended).
- Add to index.html `<head>`: `<link rel="manifest">`, theme-color, apple-touch-icon, apple-mobile-web-app-* metas.
- Register the service worker from index.html. Keep the SW tiny + network-first; version it so updates roll cleanly.
- Netlify serves the SW from root scope fine; make sure `service-worker.js` is at web root and served with the right content-type (Netlify does this by default).
- Verify install headlessly where possible + confirm the app boots in standalone mode (auth/Supabase session persists — it does; token in localStorage).

**Kickoff for the fresh session:** "build the PWA" — recall surfaces this entry. Do Phase 1 (installable) first, verify, deploy; then Phase 2 (push) as a follow-up.
