---
name: os-portal-dual-copy
topic: OS app
task: edit the client portal without the live and preview copies drifting apart
keywords: [portal.js, makePortalHTML, dual-copy, portal-token, server-rendered]
status: verified
summary: The client portal HTML lives in TWO places that must be edited together — netlify/functions/portal.js (the LIVE portal at /portal?token=) and a near-identical makePortalHTML inside index.html (the owner-side preview). Change one, change the other or they drift.
verified: 2026-07-02
---

**Read this before editing the portal.** The portal HTML exists in **two** places and must be kept in sync:
- `netlify/functions/portal.js` — the **live** portal, server-rendered at `/portal?token=`.
- `makePortalHTML` inside root `index.html` — the **owner-side preview**.

They're structurally identical with slightly different syntax (portal.js: `(r) => … .join("")`; index.html: `r=> … .join('')`). **Change one, change the other or they drift.** (A 2026-06-25 "out of date" screenshot turned out to be a cached pre-upgrade view — the code was already ahead.)

This applies to every portal feature: media upload (`os-client-media-upload`), the upgrade flow (`os-alerts-notifications`), the media-category dropdown fix, etc. all had to be mirrored in both.

Minor caveat: the owner-side preview shares the portal JS, so performing an action *in the preview* (e.g. confirming an upgrade) can also persist to Supabase — unlikely but possible.
