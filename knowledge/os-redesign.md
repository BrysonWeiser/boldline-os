---
name: os-redesign
topic: OS/App
task: redesign the OS look or navigation, rebuild the Outreach screen, the dashboard/Today screen, the sidebar, quick search, or make the OS feel more motivating
keywords: [os redesign, mission control, power hour, outreach redesign, today screen, dashboard redesign, sidebar groups, command palette, quick search, ctrl k, cinematic, motivating, crowded, hard to navigate, os look, os visual]
status: concept v2 (JARVIS layer) published, waiting on Bryson's reaction
summary: Bryson, 2026-10-07 - the OS is crowded and hard to navigate; he wants it more functional AND "cool as shit... like out of a movie", motivating to open. Outreach is his most-used screen. Agreed direction is "mission control" - deep black + BoldLine gold, glass panels, live HUD, quick motion. Clickable preview with made-up data published as a private artifact (https://claude.ai/artifact/KfcP7as8TWs6ZEm65pQuEf). Real OS untouched until he says "that's it"; then build Outreach first, screen by screen, with before/after screenshots.
verified: 2026-10-07
---

## What he said
- *"right now it's crowded and hard to navigate"* / *"everything needs revamped"* / *"I want to open it and be like wow
  this is fucking cool it's motivating it's like out of a movie."* Most-used screen: **Outreach**.

## The plan given to him
1. **Sidebar grouped by job**: Command (Today) · Get clients (Outreach, Lead Scout, Deal Prep, Calendar) · Run clients
   (Clients, Leads, Campaigns, Websites, Content; My Ads folds in) · Money (Revenue). Alerts + ARIA pinned at the bottom.
2. **Dashboard becomes "Today"**: greeting with Phoenix time, today's mission (calls/conversations/meetings goals with a
   ring), "Needs you" (only what needs him now), pipeline, calls this week + calling streak.
3. **Quick search** (Ctrl K): jump to any screen, client or prospect.
4. **Visual system**: one look on every screen (spacing, cards, type, fewer colours), dark + gold like the new site.
5. **Phone**: bottom bar with 4 most used + search; same grouping.
6. **Outreach = "Power Hour" mode**: one prospect big in the middle (who picks up, website/ads/reviews facts, what to
   open with, earlier tries), session timer, live counters (calls, conversations, booked, calls an hour), keyboard
   outcomes 1-5 (no answer, gatekeeper, call back, not interested, booked), auto-advance with a slide, "up next"
   queue, tonight's log, and a gold burst + "Meeting booked" moment. Everything Outreach does today stays (notes,
   follow-up cadence, do-not-contact enforcement, booked vs showed counters, nothing sends).

## The preview (concept only)
- Private artifact, made-up businesses, marked "PREVIEW · MADE-UP DATA": https://claude.ai/artifact/KfcP7as8TWs6ZEm65pQuEf
- Type: Chakra Petch (display/HUD), Geist (body), IBM Plex Mono (data/timer). Gold #D4B05A on near-black #06070A,
  green for good, red for urgent, ice blue for info/ARIA. Respects reduce-motion.
- Only Today and Power Hour work; other menu items show "in the real build this opens X".
- To change it: read the artifact (Artifact action read with the URL), edit, republish to the same URL.

## Rules for the real build
- One screen at a time, Outreach first, before/after screenshots for his OK before merging.
- Nothing about how things work changes in a restyle; keep every existing safety (do-not-contact, nothing sends,
  previews can't change real data). Four-width check (390/768/1280/1600). No emojis in client-facing parts (the OS is
  internal, so icons are fine).
- Index.html is ~1.7MB single file; restyle via a shared token/theme layer rather than editing every inline style.

## v2 (2026-10-07): "feel like Jarvis from Iron Man", with "a 3d thing"
Same artifact URL, version 2. Added:
- **Start-up sequence**: arc-reactor style core (three counter-rotating rings + glowing heart), typed status lines
  (authenticating, syncing prospect field, call list ready, "ARIA online"), progress bar, ~2.2s, skipped by any key
  or click, skipped entirely for reduce-motion.
- **3D hologram globe** (three.js r128 from cdnjs) on Today: wireframe + dotted sphere in gold, glowing points for
  prospects (gold), new leads (ice blue) and clients (green), signal arcs drawing out from Phoenix to each point and
  fading, three orbiting rings + a spinning tick arc, slow auto-spin, drag to rotate, tilt follows the pointer,
  "SCAN %" counter, sweep line. Falls back to a glow if WebGL is missing.
- **ARIA briefing**: typed-out line under the greeting (time-of-day aware, Phoenix clock), "Hear it" reads it aloud
  with the browser's voice (prefers a British male voice for the JARVIS feel).
- **Power Hour target lock**: rotating rings around the business's badge, a scan line sweeps the card, corner brackets
  snap in and "TARGET ACQUIRED" flashes each time a new business loads.
- For the real build: three.js is ~600KB; load it only on the Today screen, after the screen is usable, and skip on
  slow phones (same rule as client websites).
