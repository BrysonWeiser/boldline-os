---
name: os-redesign
topic: OS/App
task: redesign the OS look or navigation, rebuild the Outreach screen, the dashboard/Today screen, the sidebar, quick search, or make the OS feel more motivating
keywords: [os redesign, mission control, power hour, outreach redesign, today screen, dashboard redesign, sidebar groups, command palette, quick search, ctrl k, cinematic, motivating, crowded, hard to navigate, os look, os visual]
status: Stages 1 and 2 LIVE 2026-10-07; Stage 3 (Today screen + ARIA core) built on the dev branch, waiting on his OK; Stage 4 (voice) next
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

## v3 (2026-10-07): better 3D, ARIA talks right away, "Hey ARIA" like Siri, more utility
- **Globe replaced by the ARIA core**: a ~7,000-particle sphere (custom shader) that breathes when idle, swirls and
  turns ice blue when listening, and pulses on every spoken word (speech boundary events) when speaking. Three goal
  rings orbit it (calls gold, conversations ice, meetings green) and **fill as he works**, so the 3D shows his day.
- **Speaks right away**: browsers block sound until one tap, so the boot ends on "Tap to wake ARIA" (any key works);
  that tap unlocks audio and she reads the briefing immediately. British male voice preferred for the JARVIS feel.
- **"Hey ARIA"**: wake-word logic built on the browser's speech recognition (continuous, restarts itself, reacts to
  "aria" / common mishears). 🔴 The private preview page is NOT allowed the microphone (the artifact runtime offers
  no mic capability), so there it falls back to the typed command box with a note. In the real OS (a normal site)
  it works in Chrome and Safari after a one-time mic permission. Chrome's recognition sends audio to Google; note
  that to Bryson before shipping, and only listen while the OS tab is open.
- **Commands** (typed in the preview, spoken in the real build): start Power Hour, how am I doing, who's next, read
  my new leads, what's tomorrow, objections, booked / no answer while calling, end session. Unknown questions: in the
  real OS route to the existing ARIA (Claude) with the client/lead data.
- **Utility added**: Call windows strip (local time + open/prime/wrapping up/closed for Pacific, Arizona, Mountain,
  Central, Eastern, since he calls nationally); each prospect shows ITS local time and status + a per-call timer;
  Objections drawer (O) with five short comebacks (pricing line matches the real $400 minimum); tool buttons for
  Notes and Follow-up text; End session -> recap (calls, conversations, booked, calls an hour) with ARIA's spoken
  line; ARIA reacts out loud to each booking.
- Ideas raised but not built: Stark-style 3D "holotable" map of prospects by city (better fit for Lead Scout), UI sound
  design toggle, personal-best badges, voice notes after a call transcribed by ARIA.

## v4 (2026-10-07): phone layout fix, British female voice, always-on voice answer
- Phone bug (his screenshot): the ARIA block shrank to a sliver beside the headline (`flex:1` = basis 0 in a wrapping
  row). Fixed with a real basis and a stacked layout under 820px; call windows scroll sideways on phones.
- ARIA is **female** ("give her a smart English accent"). Voice picker now prefers the most natural en-GB female voice
  the device has: Edge "Microsoft Sonia/Libby Online (Natural)", Apple "Enhanced/Premium" (Serena, Kate, Stephanie,
  Martha), Chrome "Google UK English Female"; rate .97, pitch 1.04; waits for the voice list to load (iPhone loads late).
- **Always-on voice**: computer Chrome/Edge remembers the mic permission and can listen for "Hey ARIA" the whole time
  the OS tab is open; iPhone only while the OS is open and on screen (stops on lock or app switch); no web app can
  listen while closed. Not possible in the private preview (no mic).
- **Natural voice options put to him (decision pending)**: ElevenLabs (most natural, movie quality, British female
  voices, about $5/mo starter which covers short daily briefings) or Microsoft Azure neural "Sonia" (very good, free
  tier covers his use). Either is a small server function calling the service with a key kept in Netlify (setup steps
  go in the 10pm reminder). The preview can't call outside services, so it can only use device voices.

## Voice: free option chosen to audition (2026-10-07)
Bryson didn't want to depend on the Edge browser or a paid service. Answer: **Kokoro** (open-source, Apache 2.0,
commercial use OK), an 82M-parameter neural voice with British female voices (bf_emma, bf_isabella, bf_alice,
bf_lily) and voice BLENDING (mix two style vectors into a voice unique to BoldLine).
- Audition page (private artifact): https://claude.ai/artifact/YDAiLLiA1ixrp5U4yFNcpu with six samples of the same
  briefing: blend A (0.6 Emma + 0.4 Isabella, speed .95), blend B (0.5 Emma + 0.5 Alice, .95), then Emma, Isabella,
  Alice, Lily at 1.0. Generated here with `kokoro-onnx` (int8 model ~92MB + voices.bin ~28MB from the kokoro-onnx
  GitHub release `model-files-v1.0`), lang en-gb.
- Real-OS plan: run Kokoro IN THE BROWSER (kokoro-js / onnxruntime-web, WebGPU where available, WASM otherwise).
  One-time model download (~90MB with the int8/q8 model) cached by the browser, then free and offline. Fine on a
  laptop; on iPhone it's heavy (slow first load, slower speech), so phones fall back to the device's Enhanced
  British voice or we pre-render the fixed lines (boot, booking reactions) as audio files. Waiting on his pick.

## Voice round 2 (2026-10-07): Bryson liked #1 (blend A), wanted "slightly deeper, more powerful"
Same audition URL, version 2. Base = 0.6 Emma + 0.4 Isabella at speed .93 (or .92). Variants:
- **A**: base, pitch x0.92 (~1.5 semitones down, tempo kept), bass shelf +3dB @140Hz, gentle compression.
- **B**: base, pitch x0.87 (~2.5 semitones down), same warmth/compression.
- **C**: 0.85 base + 0.15 bm_george, pitch x0.95. **D**: 0.75 base + 0.25 bm_george, natural pitch.
- **E**: 0.8 base + 0.2 bm_daniel, pitch x0.94.
ffmpeg chain: `asetrate=24000*F,aresample=24000,atempo=1/F,bass=g=3:f=140,acompressor=threshold=0.12:ratio=2.5:attack=8:release=120,volume=1.4`.
In-browser build note: pitch-down + EQ can be done live with the Web Audio API (playbackRate + a lowshelf filter +
DynamicsCompressor), or bake the chosen style vector and render at a lower pitch.

## Voice round 3 (2026-10-07): Bryson picked **Deeper A**, then asked for "older" rather than deeper
Same audition URL, version 3. All built on Deeper A (base 0.6 Emma + 0.4 Isabella; WARM = bass +3 @140 + compressor):
- **1 Measured**: speed .88, pitch x0.92, WARM, treble -2.5 @4.5k.
- **2 Mature tone**: speed .91, asetrate x0.86 then rubberband pitch 1.07 formant=preserved (net pitch = A, formants
  lower, i.e. a "larger" vocal tract), WARM, treble -2.
- **3 Alice blend**: 0.45 Emma + 0.3 Isabella + 0.25 Alice, speed .9, pitch x0.92, WARM, treble -2.
- **4 Lily blend**: 0.45 Emma + 0.3 Isabella + 0.25 Lily, same chain.
- **5 Seasoned**: speed .86, same as 2 plus vibrato f=4.5 d=0.025 and treble -3.

## 🔒 ARIA's voice LOCKED (2026-10-07): Deeper A, slightly quicker
Bryson: "Let's just go with deeper a and can you just ever so slightly speed it up remember I still want to feel
energized and like it's Jarvis from Ironman."
- **Recipe**: Kokoro style = 0.6 bf_emma + 0.4 bf_isabella, `speed=0.98` (was .93), lang en-gb; then pitch x0.92
  (tempo kept), bass +3dB @140Hz, compressor (threshold .12, ratio 2.5, attack 8ms, release 120ms), volume x1.4.
  A faster alternative at speed 1.02 is on the audition page if he wants more pace.
- **In the preview (v5)**: the briefing (morning/afternoon/evening/late), "Power Hour is live", both booking reactions
  and the recap opener are pre-recorded in this voice and embedded (~550KB); the core's pulse follows the real audio
  level (Web Audio analyser). Dynamic answers still fall back to the device voice in the preview only.
- **Real OS plan**: run Kokoro in the browser with this exact style vector + the same chain rebuilt in Web Audio
  (lowshelf filter + DynamicsCompressor; pitch via a lower playbackRate on a slightly faster render, or render then
  pitch-shift offline before playback), so EVERY line is in her voice. Pre-render the fixed lines as files for phones.

## Stage 1 BUILT (2026-10-07): Outreach becomes Power Hour (real OS, dev branch)
He said "That's it" to the concept. Staged plan: 1 Power Hour, 2 grouped sidebar + Ctrl K + theme, 3 Today screen with
the ARIA core, 4 ARIA voice + "Hey ARIA". Each stage: before/after screenshots, his OK, THEN merge.
- **What it is**: a layer on top of the existing Outreach screen in `index.html` (block `POWER HOUR`, placed just
  ABOVE the `COLD OUTREACH` banner). Nothing underneath changed: every outcome still goes through `choose()`/`commit()`,
  so cadence, do-not-contact, undo and the counters are untouched.
- **HUD bar**: goal ring (today's calls from the real logged touches, Phoenix day, goal `PH_GOAL=40`), session clock
  START/PAUSE/RESUME/END, session counters (calls, talked, booked, calls an hour), Objections button.
- **Card**: slides in per company with a scan line + "TARGET ACQUIRED" + reticle rings; chips for the prospect's local
  time + call window (state to timezone map, prime 7:30-9:30 and 4-6pm, wrapping up 6-7:30, closed nights/Sunday) and an
  "On this call" timer. Next company auto-scrolls into view after logging.
- **Keys**: 1-n log the outcomes in button order (hint badges on the buttons); a key that needs a time scrolls to and
  focuses the time box, Enter saves; O objections; S or Right arrow skip; Space start/pause; Esc cancels. Keys are
  ignored while typing, and a confirmation panel (do-not-contact) only listens for Esc, so nothing permanent happens
  from a stray key.
- **Side panel (desktop)**: Up next queue + This session log. On phone it stacks.
- **Booking moment**: a calm "MEETING SECURED" card (dimmed backdrop, card opens from a centre line, gold ring + tick draw
  in, one light sheen, business name, meeting day/time, "N booked from M calls this session", Prep this deal / Next call
  (Enter), 7s countdown bar, auto-closes, any number key also closes it). 🔴 Bryson, 2026-10-07: the first version's
  confetti burst "makes it seem childish", so NO confetti/particles; keep celebrations understated. **Recap** on END.
- 🔴 **Test gotcha**: `tests/verify-outreach.mjs` evaluates everything between `const OUT_OUTCOMES = [` and
  `function OutreachScreen` with `new Function` (plain JS, no JSX). Anything JSX in that span crashes it, which is why
  the Power Hour block lives ABOVE the banner. Same test requires the History block within 800 characters of the
  attempt count, which is why the time chips are a small component (`PHTimeChips`) instead of inline.
- **Harness** (scratchpad, not in repo): `osh/outreach-shot.cjs` stubs Supabase + the outreach endpoint with four sample
  prospects; actions `key:`, `click:`, `wait:`, `setwhen`; `WIDTHS="390:844:phone;..."` for other sizes. Its one
  console 404 is a script the stub server doesn't serve, present before the change too.
- Verified: renders at 390/768/1280/1600 with no sideways scroll; full suite 135/135.

## Stage 2 BUILT (2026-10-07): grouped menu, Ctrl K quick search, Mission Control theme (dev branch)
- **Sidebar**: brand reads "Mission Control"; Search button (Ctrl K); groups Command (Dashboard, Alerts, ARIA) · Get
  clients (Outreach first, Lead Scout, Deal Prep, Calendar) · Run clients (Leads, Campaigns, My Ads, Website, Content)
  · Money (Revenue). Middle scrolls on short laptops. Footer: live Phoenix clock (`PhxClock`) + icon-only log out.
- **Phone More sheet**: search bar on top, same groups, two-per-row tiles, scrolls past 88% height.
- **Quick search** (`CommandPalette`, before `function App`): screens, actions (add client, ARIA, alerts), every client,
  up to 300 leads. Arrow keys + Enter, Esc, Ctrl/Cmd K toggles from anywhere. 🔴 Results only navigate or open a panel;
  `tests/verify-os-nav.mjs` whitelists each result's action and fails on anything else.
- **Theme**: tokens darker (`bg #05060A`), `textMuted` brighter (#555B80, the old one was nearly unreadable);
  Chakra Petch for screen titles (`.os-title`), labels (`Label`, `.os-hud`) and HUD text; JetBrains Mono for clocks
  (`.os-mono`). Both fonts load non-blocking. Background: faint gold HUD grid fading down from the top, one slow
  scan band, vignette (all off for reduce-motion). Cards get a gold top hairline + glass sheen via background-image,
  so no positioning changed.
- 🔴 **Test gotcha**: `verify-nav-parity` slices the sidebar from `function SideNav({` to the next `\n// ─── ` and
  falls back to 6,000 characters if none; the longer grouped sidebar pushed Revenue past that, so a `// ─── QUICK
  SEARCH` section header now ends the slice. Keep a section header right after the sidebar.
- **Screenshot harness** now lets Google Fonts through via curl (Chromium can't reach gstatic through the proxy), or the
  shots show fallback fonts instead of the real look.
- Left for Stage 3: the dashboard tiles still use emoji icons (internal-only, allowed, but off-theme); the Today screen
  replaces that dashboard.

## Stage 3 BUILT (2026-10-07): Today screen with the ARIA core (dev branch)
- Top of the Dashboard is now `TodayHero` (code block `TODAY (the Dashboard's top)`, just above `RevenueScreen`):
  Phoenix date + "Good morning/afternoon/evening/Working late, Bryson.", ARIA's typed briefing built locally (calls so
  far vs 40, new leads, meetings today, nearest contract ending; no AI call), three goal tiles (Calls /40, Talked /8,
  Booked /2, same numbers the 3D rings show), actions (Start Power Hour, Lead Scout, Deal Prep, Ask ARIA), a "Needs you"
  list (new leads, meetings today, urgent alerts, contracts ending) and "Your week" (7 Phoenix-day bars + calling streak).
- Reads the Outreach call log (`/outreach?action=touches&days=30`) and nothing else; verify-today fails on any write.
- `AriaCore`: the concept's 7,000-particle shader sphere (4,200 on small screens) with three goal rings, ported to React.
  three.js r128 loads from cdnjs on idle, only on this screen; skipped on Data Saver / deviceMemory <= 2 (CSS glow
  `.td-orb` instead); reduce motion renders one still frame; pauses off screen; disposes on leave.
  `window.__ariaCore = {state, env}` is the hook Stage 4's voice will drive (speak pulses, listen turns it ice blue).
- Sidebar "Dashboard" renamed "Today"; the emoji shortcut tiles and the two leftover emoji icons on the dashboard are now
  line icons / glowing dots.
- Harness: also lets cdnjs through and launches Chromium with SwiftShader WebGL so the core renders in screenshots.
