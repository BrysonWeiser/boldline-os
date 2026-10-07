---
name: os-portal-dual-copy
topic: OS app
task: edit the client portal without the live and preview copies drifting apart
keywords: [portal.js, makePortalHTML, dual-copy, portal-token, server-rendered]
status: superseded 2026-10-07 — there is ONE portal now
summary: SUPERSEDED 2026-10-07. The OS no longer carries its own copy of the portal. The Live Client View (PortalPreview in index.html) fetches the real page from /.netlify/functions/portal?token= and shows it with srcdoc, so edit ONLY netlify/functions/portal.mjs. Do not recreate makePortalHTML in index.html; tests (osShowsServedPortal in tests/helpers/portal-script.mjs) and the daily health check fail if a copy comes back. See KB portal-redesign-2026-10.
verified: 2026-10-07
---

> **2026-10-07: everything below is HISTORY.** There is one portal (netlify/functions/portal.mjs). The OS preview fetches it. Kept for context only.

**Read this before editing the portal.** The portal HTML exists in **two** places and must be kept in sync:
- `netlify/functions/portal.mjs` — the **live** portal, server-rendered at `/portal?token=`.
- `makePortalHTML` inside root `index.html` — the **owner-side preview**.

They're structurally identical with slightly different syntax (portal.js: `(r) => … .join("")`; index.html: `r=> … .join('')`). **Change one, change the other or they drift.** (A 2026-06-25 "out of date" screenshot turned out to be a cached pre-upgrade view — the code was already ahead.)

This applies to every portal feature: media upload (`os-client-media-upload`), the upgrade flow (`os-alerts-notifications`), the media-category dropdown fix, etc. all had to be mirrored in both.

Minor caveat: the owner-side preview shares the portal JS, so performing an action *in the preview* (e.g. confirming an upgrade) can also persist to Supabase — unlikely but possible.
