---
name: agency-promo-video
topic: Marketing
task: make, change or re-render BoldLine's own short promo video (TikTok / Reels / Shorts), or make another motion-graphics video in that style
keywords: [promo video, tiktok, reels, shorts, motion graphics, agency video, detailers video, render video, ffmpeg, frames, webx style, jp.scales, scaling businesses, video for the agency]
status: v7 rendered 2026-10-21 and sent to Bryson (not posted yet)
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
  shown in v1 to v6. 🔴 THAT WAS A MISTAKE from a stale KB read: Meta has been fully approved since 2026-09-14 (KB
  meta-marketing-api). Meta ads are shown from v7 on.
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

## v2 (2026-10-20, ~10pm Phoenix): narrated, website-first, ends on the URL
Bryson: *"Make sure there is a voice narrating it also I think instead of a book a call we give a url because people
can't press a button that doesn't work also is it supposed to sell ads or websites"*.
- **It now sells WEBSITES first, ads as the step up** (matches KB niche-selection: lead with websites for detailers).
  Order: hook "No website? They booked someone else." > website that books the job > booking + deposit > every call
  and form caught > reviews > portal chart > "Ready for more? Top of Google." (ads) > all connected > closer > end.
- **End card has no button** (nothing is tappable in a video): "See what we'd build for you at" + big
  **boldlinemedia.com**. Tagline "Websites and ads for detailers".
- **Narration**: Piper TTS (local, free) with the **"joe" voice, dataset CC0** (cleared for commercial use; "ryan" and
  "hfc_male" are CC BY-NC-SA, NOT usable for a business ad; "john" is public domain, libritts_r CC BY 4.0). One clip per
  scene (`docs/promo-video/narration-lines.json`), length-scale 0.93; each scene lasts max(4.4s, line + 0.9s), voice
  starts 0.3s in, mixed with ffmpeg adelay + amix, loudnorm to -14 LUFS (TikTok level). "BoldLine" is spelled "Bold Line"
  for the voice. 52.4s total.
- 🔴 I cannot listen to audio, so the voice's naturalness was not judged here; told Bryson his own voice (CapCut
  voiceover over the no-voice version) usually performs better than any AI voice. Files sent: -voice.mp4; the
  -novoice.mp4 and script are ready if he wants to record his own.

## v3 (2026-10-20, ~10:45pm Phoenix): ARIA's voice, every word verified
Bryson: *"lets use arias voice and make sure it says every word correctly. it didnt say detailing correctly and make
sure it sounds human what you just showed me sounded very robitic"*. The Piper "joe" voice (v2) is retired for this.
- **Voice = ARIA's locked recipe** (KB os-redesign): kokoro-onnx (Apache 2.0) with `kokoro-v1.0.int8.onnx` +
  `voices-v1.0.bin` from the kokoro-onnx GitHub release `model-files-v1.0`; style 0.6 bf_emma + 0.4 bf_isabella,
  speed 0.98, lang en-gb; then ffmpeg `asetrate=24000*0.92,aresample=24000,atempo=1/0.92,bass=g=3:f=140,
  acompressor=threshold=0.12:ratio=2.5:attack=8:release=120,volume=1.4`. Mixed at -14 LUFS.
- **Pronunciation proof, not hope**: (1) each line's phonemes printed from Kokoro's own tokenizer (detailing =
  dˈiːteɪlɪŋ, detailer = dˈiːteɪlə, British non-rhotic); (2) faster-whisper `small.en` transcribed every clip AND the
  final video back, compared word for word to the script: 10 of 10 lines exact, "Bold Line Media dot com" heard as
  "boldlinemedia.com". Re-run this check whenever a line changes (scratchpad `kokoro/verify.py`).
- Re-timed to her pacing: 50.8s. File sent: BoldLine-promo-detailers-aria.mp4.

## v4 (2026-10-20, ~11pm Phoenix): one flowing read, matched to the screen, punchlines emphasized
Bryson: *"make sure she says just search for a mobile detailer (basically the words that are on screen)"* and *"make
sure there are no unnecessary pauses like there are now. it should flow smoothly with certain points that are
emphasized"*.
- **Voice drives the edit now, not the reverse.** Each sentence is synthesized, its silence trimmed, then laid end to
  end with designed gaps (0.1 to 0.22s inside a scene, 0.28s between scenes). Scene changes land 0.2s before each
  line starts. The only silence over 0.45s in the whole video is the 2.5s hold on the end card so people can read the
  address (checked with ffmpeg silencedetect).
- **Emphasis** = the punchline as its own sentence at a slower speed (0.9) and +2 dB: "They booked someone else.",
  "Automatically.", "We bring the customers.", plus "top of Google" (+1 dB) and the web address (0.92, +1.5 dB).
- **Matches the screen**: search box now types "mobile detailer near me"; she says "searched for a mobile detailer.
  No website? They booked someone else." with "No website?" and "They booked someone else." appearing as she says
  each. "You do the detailing" / "We bring the customers" also land on her words. Scenes 1 to 7 play their animation
  time-warped to the real scene length (designed at 4.6s).
- Script: `docs/promo-video/narration-script.json` (text, speed, gain dB, gap per sentence). Transcribed back: every
  line exact. 42.7s. Phonetic note: British accent says "mobile" as MOH-bile and "detailer" as DEE-tay-luh.

## v5 (2026-10-20, ~11:30pm Phoenix): a smoother, more human ARIA (new voice engine)
Bryson: *"its better but its still robotic and not smooth. remember the reference video i gave how their ai talked
smooth make sure to do the same but with ARIA's voice"*.
- **Why v4 sounded robotic**: Kokoro's compressed (int8) model, the pitch-down step (asetrate + atempo adds a metallic
  edge), and lines stitched sentence by sentence (no flow between them).
- **New engine: Chatterbox (Resemble AI, MIT licence, model weights MIT on Hugging Face `ResembleAI/chatterbox`)**, a
  voice-cloning model trained on real speech. It copies ARIA's voice from her own OS clips (`aria/greet_morning`,
  `booked_2`, `power_start`, `greet_afternoon`, `recap` joined into a 16s reference). No pitch shifting afterwards.
  Each scene is read as ONE connected passage, so the pauses and emphasis come from the model, not from cut points.
  Its output carries Resemble's inaudible "Perth" watermark (marks it as AI audio; harmless).
- **Four takes per scene, best kept automatically** (`docs/promo-video/voice/pick.py`): must be heard back word for
  word by faster-whisper; no silence over 0.42s inside a scene; then the most natural (UTMOS naturalness score), the
  closest to ARIA (speaker-embedding similarity 0.92 to 0.96), livelier pitch as a tie-break, and a bonus when "No
  website?" is heard as a question. Takes alternate exaggeration/cfg 0.6/0.45 and 0.75/0.35.
- Result: 126 of 126 words exact in the finished video; the only pause over 0.4s is the deliberate beat before
  "Automatically."; -14.7 LUFS. 45.6s. File sent: BoldLine-promo-detailers-aria-smooth.mp4.
- 🔴 Gotchas: whisper writes the brand as "boldlinemedia .com" (compare with the brand collapsed); whisper word timings
  map to script words through contractions ("we'd" is one whisper word, two script tokens); a glob of `*.wav` also
  picks up the `.trim.wav` copies, so exclude them.
- Re-render recipe: `docs/promo-video/voice/` (gen.py > pick.py > apply_flow.py, then frames.cjs + ffmpeg). Runs on
  CPU here: ~27s per take, ~20 min for 40 takes. Paths inside point at that session's scratchpad.
- 🔴 Still true: I cannot listen to audio. The checks prove every word is right, no dead air, and that it is ARIA's
  voice; "does it sound human" is Bryson's ear. If it still isn't smooth enough, the next step up is a paid voice
  (ElevenLabs, about $5/mo) or his own voiceover.

## v6 (2026-10-20, ~midnight Phoenix): "for A mobile detailer", and a smooth ending
Bryson: *"make sure in the beginning she says 'someone searched for A mobile detailer' not 'someone searched for
mobile detailer'"* and *"make sure at the end of the video the website and last part of the video come up smoothly"*.
- 🔴 **He was right and whisper was wrong.** The v5 take went straight from "for" into "mobile" (phonemes `f ɚ ɹ m oʊ
  b`), yet whisper wrote "for a" because its language model fills in small words. A phoneme recogniser with no
  language model (`facebook/wav2vec2-lv-60-espeak-cv-ft`, Apache 2.0, `docs/promo-video/voice/ear_ph.py`) shows it.
  The picker now REQUIRES a second vowel between "for" and "m" on the first line. 8 new takes; 6 had it. Chosen take:
  `f ɔːɹ ɹ ɐ m oʊ b aɪ l` (also says "mobile" as MOH-bile). Lesson for any narration: whisper-exact is not proof that
  a short word (a, the, to) is audible; use the phoneme check.
- Measures that did NOT work, so don't retry them: letter-level CTC frame counts (every letter is a one-frame spike)
  and counting loudness beats between "for" and "mobile" (always 2).
- **End card rebuilt** (`edit_end.py`): logo, then name, then tagline come up one after another on ease-in-out curves
  with a little blur-to-sharp (the name's letter-spacing animation, which reflows text every frame and can jitter, is
  gone); "See what we'd build for you at" rises just before she says the address; the address rises with her words
  (`URL9`, injected by apply_flow from whisper word timing), then one slow shine across it; the whole card drifts in
  3% over the hold so it never looks frozen. Checked by frame-to-frame change across the end card: largest step 0.97
  (the crossfade in), median 0.12, no pops.
- Verified: 126 of 126 words exact, the only pause over 0.4s is the deliberate beat before "Automatically.",
  -14.7 LUFS, 45.8s. File sent: BoldLine-promo-detailers-v6.mp4.

## v7 (2026-10-21, ~12:30am Phoenix): Meta ads and landing pages shown
Bryson: *"when it shows the list of things we do connected to the b it only shows Google ads not meta and I feel like
we should showcase the ads a bit more (meta and google) and that they are paired with a landing page"*.
- Story stays website-first; "when you're ready for more" is now an ads section: Google (top of Google, as before) >
  **new s10** "And in front of car owners nearby, on Facebook and Instagram." (a phone feed: the sample detailer's
  Sponsored post scrolls in, a like, "Book now" tapped; "Facebook" / "Instagram" chips, no platform logos) > **new
  s11** "Your ads send people to a landing page, built to turn that click into a booking." (northlinedetailing.com/ceramic:
  form fills, "Got it, Jordan.", banner "New lead: Jordan R. Ceramic coating, from your Instagram ad").
- Hub now 8 items on an ellipse: Google Ads, Meta Ads, Landing pages, Website, Booking, Calls & forms, Reviews, Your
  portal. Line: "Your website, ads, landing pages, booking and reviews. All connected, in one system."
- Honesty kept: no texting claim on the landing page (text-back is still off), sample business only.
- The whisper check caught two bad takes ("Your abs send people", "Your website adds landing pages"). 155 of 155 words
  exact, first line still has the "a", -14.7 LUFS, 55.4s. File sent: BoldLine-promo-detailers-v7.mp4.
- 🔴 Running two Chatterbox jobs at once (4 threads each on 4 cores) slowed both about 20x. Run one at a time
  (pause the other with kill -STOP / -CONT).
