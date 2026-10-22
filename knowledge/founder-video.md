---
name: founder-video
topic: Marketing
task: make, change or edit Bryson's founder / personal-brand video ("how I built a business that runs almost by itself", ARIA introduced)
keywords: [founder video, personal brand, build in public, how I built my business, aria intro video, talking head, voiceover, b-roll, os screen recording, founder story]
status: script written; OS footage + ARIA intro DONE 2026-10-21; waiting on Bryson's recording to cut it
summary: Bryson 2026-10-21 - "a video describing how I built my business and made it almost fully automated and who/what ARIA is", "mainly voice over done by me and video of me talking to the camera and then have sections where it shows images/videos of the systems", and "I'll record it all in one go ... I'd like to have you take the videos and images and use arias voice that way I don't have to take screenshots and videos myself". Script in docs/founder-video/script.md (about 80s, 12 lines + 3 ARIA lines). Plan: ARIA greeting as the hook, Bryson on camera, real OS screens with made-up sample businesses over the system lines (Lead Scout, demo website, agreement + billing, campaign + landing page, leads + portal chart), ARIA introduces herself in her voice, a real "Hey ARIA, start Power Hour" moment, close on camera with boldlinemedia.com. Honesty: only live systems (text-back is off), no client counts or results, no real client data on screen, clients do not get ARIA.
verified: 2026-10-21
---

## Why this framing (advice given)
A video about ARIA alone was judged not worth it for selling to detailers (KB agency-promo-video thread). This one is
personal brand: "how I built it" is a proven format and quietly tells prospects he runs a tight operation. ARIA is
one beat inside it, with her greeting as the 2-second hook.

## Status / next
- Script: docs/founder-video/script.md. Bryson records it in one take, two seconds between lines.
- Visuals: Claude records real OS screens via a headless harness with a stubbed database of sample businesses
  (never a real client), ARIA's new lines via the Chatterbox recipe (KB aria-natural-voice).
- Edit: cut his take, cover the system lines with screens, captions, stereo audio (KB agency-promo-video).

## Footage made (2026-10-21, evening Phoenix)
- Real OS screens, never a real client: `docs/founder-video/footage/film.cjs` runs index.html in headless Chromium
  with Supabase and every server call answered by made-up businesses (Summit Roofing, Luxe Med Spa, Apex Auto
  Detailing; Lead Scout list Northline Auto Detailing, Summit Handyman Co., Bluebird Pet Grooming, Ridgeway
  Remodeling, Copper Canyon Landscaping). The page clock is shifted to 9:12am Phoenix so it reads "Good morning,
  Bryson" (ARIA's opening line), with time still running so Power Hour ticks. 390x844 at 3x.
- `pages.mjs`: the sample detailer site with the real demo strip (decorateDemo), the sample handyman landing page
  (examples/handyman/landing), and the client portal from makePortalHTML for a sample roofer with 8 weeks of rising
  leads (chart "Up, 9 leads"). `demoscroll.mjs`: the demo site at six scroll points (its full-page capture repeats
  the hero).
- `broll.html` + `rend.cjs`: one moving clip per script beat (hook, leadscout, demo, contract, build, portal, aria,
  powerhour, today, end) in a phone frame on the BoldLine grid; gold highlight boxes, a tap on START, ARIA's core
  glowing with her voice (env.json = her loudness 30 times a second). `?chips=0` drops the callout chips.
- ARIA intro "Hi, I'm ARIA. I work alongside Bryson every day, so nothing slips through." chosen take saved as
  docs/founder-video/aria-intro.wav (whisper exact + phoneme check; 2 of 6 takes said "Arya" and were thrown out).
- Next: when Bryson's one-take clip arrives, transcribe it with word timings, cut out restarts and long pauses, map
  each numbered line to its clip (render each clip at that line's exact length), add ARIA's three lines, captions
  of his words, stereo audio at -14 LUFS.
