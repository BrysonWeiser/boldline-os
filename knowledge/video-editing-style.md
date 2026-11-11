---
name: video-editing-style
topic: Marketing
task: edit any talking-head video Bryson sends (Instagram, TikTok, Reels, stories, YouTube Shorts)
keywords: [video editing, captions, talking head, reels, tiktok, instagram video, edit my video, cut the video, b-roll, os screens in video, caption style, story preview, teaser]
status: STANDING DEFAULT (Bryson, 2026-11-10: "remember that editing style for future videos")
summary: Default for every video he sends - his face + captions + tight cuts, nothing else unless he asks. Captions in the house style (no box, Inter Bold, words appear as said, a few gold key words, soft edge and drop shadow) placed LOW (centre y=1560 of 1920). Cut long pauses and restarts but NEVER cut his words without asking first (suggest instead). Only add OS screens, end cards or other visuals when he says so; when he does, each screen must show the literal thing being said at that moment. 1080x1920, 30 fps, -14 LUFS stereo, no music baked in. Recipe in docs/founder-video/edit/edit3.py.
verified: 2026-11-10
---

## The default (what "edit my video" means)
- **Picture:** his face only. A gentle zoom change (1.00 / 1.10) on alternate pieces so every cut reads as intentional.
  Light look lift (`eq=brightness=0.03:contrast=1.06:saturation=1.06`). If the clip is iPhone HDR (HLG/BT.2020),
  tone-map first (recipe in KB founder-video).
- **Cuts:** remove pauses longer than ~0.4s and any restarts or flubbed takes; keep his pacing otherwise.
  🔴 **Never cut his words** for wording, honesty or length reasons on my own. If a line seems risky, ask him or
  suggest the cut; he caught a removed "that is fully automated" and wanted it back.
- **Captions:** house style from founder-video v2 (no box; Inter Bold 72 in ASS units; white with a few hand-picked
  gold key words; outline 1.6 at 47% opacity, blur 1.2, drop shadow 3 down; each word fades in as said; 1 to 5 words
  per phrase, broken at natural points; phrase rises 14 px in, fades out on a pause). **Position: centre y=1560**
  (his ask: lower). A soft dark fade at the bottom of face shots (y 1200 to 1720) carries the contrast.
- **Sound:** his voice cleaned (high-pass 80, light denoise, presence), -14 LUFS integrated, true peak -1, stereo.
  No music: he adds a sound in the app.
- **Output:** 1080x1920, 30 fps, H.264, named by the video's topic (e.g. "How our automations help clients.mp4"),
  sent in chat. Big source files come in as a Google Drive link (gdown), see KB founder-video.

## Only when he asks
- OS screens (B-roll), end cards, logos, montages, zooms on details. When asked: every screen is the literal thing
  he is saying at that moment, made with sample businesses only (no real client data), and with no old prices.
