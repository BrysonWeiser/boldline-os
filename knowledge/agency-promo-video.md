---
name: agency-promo-video
topic: Marketing
task: make, change or re-render BoldLine's own short promo video (TikTok / Reels / Shorts), or make another motion-graphics video in that style
keywords: [promo video, tiktok, reels, shorts, motion graphics, agency video, detailers video, render video, ffmpeg, frames, webx style, jp.scales, scaling businesses, video for the agency]
status: rendered 2026-10-20 and sent to Bryson (not posted yet)
summary: Bryson, 2026-10-20 sent a TikTok by @jp.scales ("Joseph | Scaling Businesses", WebX Marketing Agency): a ~55s text-led motion-graphics promo, black + neon green, one feature per beat ("You missed a call today. That was a $3,000 job", "Built to convert", "Never lose a lead", "Works while you sleep", "Five stars. Automatically", "All connected. One system", logo end card), letterboxed 16:9 in a vertical frame. He wanted OUR OWN version, not a copy: detailers, full phone screen, end on "Book a free call". Built a 45s 1080x1920 video in BoldLine black + gold, rendered frame by frame from an HTML animation in this container (Playwright screenshots + ffmpeg). No music on purpose: he adds a trending sound in TikTok.
verified: 2026-10-20
---

## The beats (45s, ~4.5s each)
Hook "Someone near you just searched 'ceramic coating near me'. They booked someone else." > "Show up first on Google"
(search results, sponsored result rises to the top) > "A website that books the job" (phone, sample detailer site
scrolling, Book a detail tap) > "Every call and form, caught" (leads drop in + phone banner) > "Booked while you're on
a job" (package, Saturday 10:30, deposit paid) > "Five stars, on autopilot" (review email, 4.6 to 4.9) > "See it grow"
(the portal's weekly chart, Up) > "All connected. One system" (hub: Google Ads, Website, Calls & forms, Booking,
Reviews, Your portal) > "You do the detailing. We bring the customers." > end card: logo, BoldLine Media, "Ads,
websites and booking for detailers", Book a free call, boldlinemedia.com.

## 🔴 Honesty rules applied (do not loosen)
- Only features BoldLine delivers TODAY. Left out on purpose: an AI phone assistant (not offered) and "we text every
  lead in seconds" (built but SWITCHED OFF until Twilio is paid and A2P clears, KB client-text-back). Meta ads not
  shown (still gated behind Meta approval, KB site-coming-soon). Add them back only when they are live.
- All numbers are a made-up SAMPLE business (Northline Auto Detailing, the marketing site's detailer sample), shown
  as product UI. Never captioned or narrated as a client's result (Content Studio guardrail: no invented results).
- No emojis (a phone glyph was swapped for an SVG icon), no em dashes.

## How it is made (re-render recipe)
Source: scratchpad `video/promo.html` (copy kept in `docs/promo-video/promo.html`). One `render(t)` function draws the
whole frame from the time `t` (no CSS animations), so every frame is deterministic. Logo + photo are inlined as data
URIs. `frames.cjs` screenshots 30 fps (1350 frames), ffmpeg (pip `imageio-ffmpeg` gives a static binary; there is no
system ffmpeg here) encodes H.264 yuv420p, faststart. Fonts load through curl in the Playwright route.

Transitions: scenes crossfade over 0.3s with the next headline starting 0.05s early; the first render had a ~0.4s empty black gap at every change.
File sent: BoldLine-promo-detailers.mp4 (1080x1920, 30fps, H.264, 45s, ~8MB). Posting advice: add a trending sound in TikTok/Instagram (none baked in), caption without emojis or dashes, pin a comment with the booking link.
