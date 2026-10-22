---
name: founder-video
topic: Marketing
task: make, change or edit Bryson's founder / personal-brand video ("how I built a business that runs almost by itself", ARIA introduced)
keywords: [founder video, personal brand, build in public, how I built my business, aria intro video, talking head, voiceover, b-roll, os screen recording, founder story]
status: v2 SENT 2026-10-22 (BoldLine-founder-video-v2.mp4, 71.6s, clean captions); lines 4, 6, 8 were never recorded
summary: v2 2026-10-22 has the CLEAN CAPTIONS he asked for (no boxes; see 'Caption look'). CUT 2026-10-22 from his 11 recorded lines (4, 6 and 8 missing; a three-screen montage covers them), sent as BoldLine-founder-video.mp4 (71.6s, 1080x1920, -14 LUFS stereo, word-by-word captions, no music). Recipe in docs/founder-video/edit/. Original brief: Bryson 2026-10-21 - "a video describing how I built my business and made it almost fully automated and who/what ARIA is", "mainly voice over done by me and video of me talking to the camera and then have sections where it shows images/videos of the systems", and "I'll record it all in one go ... I'd like to have you take the videos and images and use arias voice that way I don't have to take screenshots and videos myself". Script in docs/founder-video/script.md (about 80s, 12 lines + 3 ARIA lines). Plan: ARIA greeting as the hook, Bryson on camera, real OS screens with made-up sample businesses over the system lines (Lead Scout, demo website, agreement + billing, campaign + landing page, leads + portal chart), ARIA introduces herself in her voice, a real "Hey ARIA, start Power Hour" moment, close on camera with boldlinemedia.com. Honesty: only live systems (text-back is off), no client counts or results, no real client data on screen, clients do not get ARIA.
verified: 2026-10-22
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

## Script v2 (2026-10-21, ~7pm Phoenix): the WHY of automation
Bryson asked for reasons: faster delivery of what the client paid for, no human error, accurate reports, no
miscommunication. Added lines 2, 8, 9, 13 (now 14 lines, ~90s). Advised against saying "100% accurate"; the line says
the reports pull the numbers straight from Google and Meta with nothing typed by hand. Footage map updated: 8 = a
client's Leads tab, 9 = the portal chart.

## The cut (2026-10-22, early afternoon Phoenix)
Recipe: `docs/founder-video/edit/` (prep.py joins and converts the clips, tx.py / tx_aria.py get word timings,
edit.py builds everything, sync.py proves every piece sits where the audio expects it). Edit map in script.md.
- **What he sent:** 13 files = 11 lines. IMG_1632 (line 9) and IMG_1640 (line 13) came in two halves each and were
  joined with ffmpeg's concat filter after converting each half to 30fps. Lines 4, 6, 8 were not recorded; a
  three-screen flash over "Everything else, the system handles" (Lead Scout / contract / client's leads) carries them.
- 🔴 **iPhone footage is HDR** (HLG, BT.2020, 10-bit). Played as-is on most apps it looks washed out. Tone map:
  `zscale tin=arib-std-b67 ... t=linear:npl=203, tonemap=hable:desat=0, zscale bt709`, then
  `eq=brightness=0.06:contrast=1.08:saturation=1.05`. Tried and rejected: no conversion (pale), mobius (pink skin),
  hable alone (too dark).
- iPhone .mov files carry a second audio track ("apac", spatial audio) ffmpeg cannot decode: map `0:a:0`.
- **Word timings:** whisper puts the first word of a clip at 0.0 and stretches a word across a pause, so the first word
  starts at the energy onset and a word spanning a pause starts where the pause ends. "Hey" in "Hey ARIA" is said fast
  into the name and only heard with a hint; it was added to the captions by hand.
- 🔴 **Measure loudness on the STEREO file.** Dual-mono reads 3 LU louder than the mono mix: the first pass, normalised
  in mono, came out at -11 LUFS. Now -14.0 LUFS, true peak -1.0, in stereo.
- **Captions:** ASS burned in with libass, Inter ExtraBold (TTF from Google Fonts via curl), size 96 on a dark pill,
  y=1420, max 840px wide to stay clear of TikTok's right-hand buttons. libass sizes by line height (about 1.22 em), so
  widths are measured with PIL at size/1.22. Breaks are hand-picked per line (`CHUNKS`) and checked word for word
  against what was heard; an automatic split (dynamic programme; brute force froze on a 19-word phrase) is the fallback.
- **Test frames:** cut them from the uncaptioned master `nocap.mp4` with `-ss T` + `setpts=PTS+T/TB`. Picking frames
  out of the concat demuxer with `select` landed seconds off in tests (the final itself was proven frame exact).
- 🔴 **Public footage rule in the OS capture.** The OS's own labels carry emojis and em dashes (fine there, Bryson
  alone sees them), but this video is public. `footage/film.cjs` now cleans visible text as it renders (emojis out,
  a dash between words becomes a comma, a placeholder dash a hyphen) and marks the sample client's welcome emails as
  sent so the "send the Welcome email" banner is not in shot. 🔴 It must skip text inside `<script>`: the OS's code
  arrives as a text node while the page loads, and cleaning it rewrote the OS's own strings ("–" became ", ") before
  Babel compiled them. Removing the banner moved the client page up 39 CSS px, so the contract highlight boxes moved.
- Pacing fixes after the first pass: the beat between "start Power Hour" and ARIA's answer cut from 0.9s to 0.6s
  (the clip starts later in the tap animation), end-card hold 1.7s to 1.3s.
- No music baked in, same as the promos. Posting: add a sound in the app at low volume; caption without emojis or
  dashes; never "local businesses".

## Caption look, v2 (2026-10-22, afternoon Phoenix)
Bryson on v1: *"Can you make the captions cleaner and more aesthetic right now they are ugly"* (v1 sat every phrase in a
dark rounded pill). The house style for captions on his videos is now:
- **No box.** Inter Bold 72 (ASS size), letter spacing -0.5, white; a few hand-picked key words in gold (`*stars*` in
  `CHUNKS`); ARIA's words gold throughout. A fine soft edge (outline 1.6, 47% opaque, blur 1.2) and a gentle drop
  shadow straight down (yshad 3, 56% opaque).
- **Words appear as they are said** (120 ms fade each; words not yet said are invisible but keep their space, so the
  line never shifts). Each phrase rises 14 px into place over 0.18 s and fades out over 0.11 s when he pauses. Phrases
  are 1 to 5 words, up to about 25 characters, broken by hand at natural points.
- **The contrast comes from the picture, not a box.** Face shots get a soft dark fade at the bottom of the frame
  (smoothstep from y=1050 to 62% black at y=1600, baked into the face pieces). The phone screens fade to dark over their
  bottom part (`broll.html` `.capfade`, switched on by `chips=0`), so the words sit in a clean dark band instead of on
  top of the app's own text, which is what made v1's captions collide with the screens.
- Tried and rejected on the way: plain white text with a halo (lost on his white shirt, clashed with app text); a
  blurred dark "cloud" behind the words (read as a smudge on the shirt).
- Captions stay at y=1430, max about 860 px wide (clear of TikTok's right-hand buttons and bottom text).

## Recording feedback for the next take (2026-10-22, Bryson asked)
Bryson: *"I feel like I should have more energy and keep it a bit more brief and less script like"*. Measured from his
clips (whisper word timings + pitch tracking), plus what the frames show:
- 🔴 **He talks fast, which is what reads as "script":** about 217 words a minute overall (a confident on-camera pace is
  closer to 160 to 180), and the website line hit about 280. Rushing to get the sentence out is the tell. More energy
  should come from emphasis, a smile and pitch, not speed.
- **He warmed up as he went:** his voice sat around 102 Hz on the first lines and around 120 Hz on the last two, with
  more movement, so the closing lines are the liveliest. Warm up first, or redo the opening lines at the end.
- Pitch variety is moderate (about 3 semitones spread), not monotone. Face is neutral throughout: little smiling.
- Good already: eye contact into the lens, steady eye-level framing, the same position in every clip (the cuts were
  clean because of it), clear sound.
- Picture: white shirt on white walls is flat and fought the captions; a dark shirt fits the black-and-gold brand.
  The wall behind him (antique guns, arrows) pulls attention from him in a business video; a plain wall, a desk with the
  OS open on a laptop, or outside reads more "agency". One fixed shot for every line; two framings or a walk-and-talk
  adds life. iPhone HDR video is why the raw clips looked washed out: Settings, Camera, Record Video, HDR Video off.
- 🔴 **Preference for future talking-head videos: talking points, not a word-for-word script, and 30 to 45 seconds.**
  Say each point in his own words, two or three takes each, keep the most natural. Honesty wording still applies
  ("almost runs itself", never "runs itself").

