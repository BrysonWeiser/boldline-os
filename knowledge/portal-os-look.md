---
name: portal-os-look
topic: Client portal
task: change the client portal's look, its 3D progress core, fonts, header or animations, or bring the OS style to a client-facing page
keywords: [portal look, portal 3d, progress core, particle sphere, webgl, os look, chakra petch, ibm plex mono, hud, corner ticks, blueprint grid, count up, bars rise, portal-look.mjs, PORTAL_LOOK_CSS, PORTAL_LOOK_JS, client portal modern, old portal]
status: LIVE 2026-10-19 (Bryson: "yes put it live")
summary: Built 2026-10-19 after Bryson opened Springbok's portal and said it looked like the old version ("didnt we update the client portals to be a bit more modern and more like the os with the 3d models?"). The 3D had only ever been built for the OS; the portal had the 7 Oct results refresh, and a client not yet live (Springbok) only sees the setup screen. v4 is a pure LAYER (netlify/lib/portal-look.mjs) over the same markup: the OS's fonts (Chakra Petch headings and numbers, IBM Plex Mono captions, Inter body), the blueprint grid, glass panels with gold corner ticks, gold glowing tabs, a header with a name chip, and a hand-written WebGL particle sphere inside the progress ring that fills with gold up to the client's stage (full once live). Numbers count up once, chart bars rise once. No library; skipped for Data Saver, 2G and low-memory phones; reduce-motion gets one still frame; no WebGL leaves the old ring.
verified: 2026-10-19
---

## Why it looked old
1. The "3D models" were the OS's (ARIA core, KB `os-redesign`); nothing 3D was ever built for the portal.
2. The 7 Oct portal refresh (KB `portal-redesign-2026-10`) made the RESULTS screen, which only shows once a client is
   live (stage active+, any lead, or synced spend). Springbok is in setup, so he saw the progress screen, the part that
   changed least.

## What v4 does (all in `netlify/lib/portal-look.mjs`, three lines in portal.mjs)
- CSS appended after the existing css; fonts link swapped for `PORTAL_FONTS_HREF`; header markup uses `hb-name`,
  `hb-sub`, `hb-client` (name escaped); status welcome carries `data-k` ("Campaign status" / "Live results") shown as a
  mono caption; `PORTAL_LOOK_JS` appended as the last script.
- 🔴 Motion must be true (KB `cool-but-clear`): the sphere's gold fill = stage progress (`--p` on `.ring`, rising to
  it on open); count-up only on KPI numbers; bars rise once. Slow spin is the only idle motion, and it stops when off
  screen, when the tab is hidden, and for reduce motion.
- 🔴 Fast: plain WebGL points (1,100 or 600), additive blend, starts 60ms after `load`, no download.
- 🔴 Preview-safe: the script makes no requests (pinned), so the OS's Live Client View stays harmless.

## Tests
`tests/verify-portal-look.mjs` (11). Full suite 165/165 before it was added. Rendered setup and live states at
390/768/1280/1600: no sideways scroll, core mounted, Chakra Petch loaded, no console errors.

## Status
Approved and merged Mon 2026-10-19 (Bryson: "yes put it live").
