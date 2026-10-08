---
name: ios-input-zoom
topic: Responsive
task: fix a page that looks cut off or zoomed in on an iPhone after typing in a form, or add any new form box to the website, landing pages, client websites or portal
keywords: [iphone zoom, ios zoom, safari zoom, cut off on mobile, page cut off after submit, input font size, 16px, maximum-scale, pinch zoom, form box text size, mobile fit]
status: LIVE 2026-10-08
summary: Bryson, 2026-10-08, screenshot of /contact/ cut off on the right after sending a test message on his iPhone. NOT an overflow (headless Chromium measured 0px sideways scroll at 360 to 414): Safari on iPhone zooms in when a form box with text under 16px is tapped and stays zoomed after submit. Nearly every form box was 13 to 15px on the marketing site AND on client landing pages and client websites. Fix: one identical rule (every text input/select/textarea 16px !important on max-width 1024px or pointer:coarse) in base.css, the standalone get-started page, landing.mjs (IOS_NO_ZOOM), site-render.mjs (IOS_NO_ZOOM) and the portal; the portal's maximum-scale=1 removed (blocked pinch zoom). verify-no-ios-zoom (19).
verified: 2026-10-08
---

- 🔴 Headless Chromium does NOT reproduce this. Measuring scrollWidth shows nothing. The check that finds it is the
  COMPUTED font-size of every visible input at phone width (< 16px = will zoom on iPhone). Range sliders, checkboxes and
  radios never trigger it.
- Do not "fix" it with `maximum-scale=1` / `user-scalable=no`: it hides the symptom and blocks pinch zoom for people who
  need it. The OS app itself (index.html, Bryson only) still has maximum-scale=1.0; it is internal and was left alone.
- Public CSS/HTML must not carry dated incident comments (verify-public-source), so the rule ships without a comment there;
  the explanation lives in landing.mjs / site-render.mjs / this entry.
- Any NEW form surface must include the same rule string; verify-no-ios-zoom pins all five copies and the rendered portal.
