---
name: aria-natural-voice
topic: OS
task: change, re-record or extend ARIA's voice in the OS (the /aria/ recordings), bring back live spoken answers, or set up the hosted natural voice
keywords: [aria voice, natural voice, robotic, chatterbox, voice clone, aria recordings, aria mp3, re-record aria, live voice, kokoro off, ARIA_LIVE, deepinfra, hosted voice, aria sounds robotic]
status: built 2026-10-21 (recordings replaced; live voice off; hosted voice ON HOLD by Bryson's choice)
summary: Bryson 2026-10-21 - "make sure this new more human sounding version of aria is implemented into the os because right now she sounds robotic in the os". All 24 fixed lines in /aria/ re-recorded with Chatterbox (MIT) cloned from her original voice (docs/aria-voice/reference.flac), several takes per line, best kept automatically (every word heard back exactly, no dead air, natural, closest to ARIA), same format and loudness as before (mp3 56k mono 24 kHz, -20 LUFS). The in-browser Kokoro model (the robotic sound, computers only) is switched OFF (ARIA_LIVE = "off"): live sentences (briefing, chat answers, "Opening <client>") now play the matching recording and the words stay on screen, as on his phone. To have her READ live sentences in the natural voice again: hosted Chatterbox on DeepInfra ($10 per million characters, about $1 to $3 a month; custom voice_id, exaggeration, cfg, mp3) via a small server function. Proposed to Bryson 2026-10-21; he said "no we can hold off on that". Do not build it unless he raises it again.
verified: 2026-10-21
---

## What changed for him
- Every line ARIA says in the OS (greetings, "Power Hour is live", "that one's booked", "Opening Outreach", "Let me look
  into that"...) is the new natural voice, on phone and computer.
- The old recordings had a slip: "Opening Deal Prep" sounded like "Opening deal prepped" (whisper heard it that way).
  Wording is now written down in `docs/aria-voice/lines.json` and pinned by verify-aria-voice ("Opening Deal Prep.",
  "On it.", "Yes?" as a question when he says "Hey ARIA").
- "Yes?" (after "Hey ARIA" alone) is now **"Yes, Bryson."**: a one-word line was too short for the model (takes came
  out as "kess", "Yves" or "uh, yes"), and it reads like Jarvis's "Yes, sir."
- On a computer she no longer reads the briefing or answers in the robotic voice. She plays the matching recording
  ("Here's your day.", or "Let me look into that." then the answer on screen).

## Why live sentences are off instead of upgraded
The natural model (Chatterbox, 0.5B parameters, PyTorch) cannot run in a browser and is too big and slow for a
Netlify function. The only in-browser option is Kokoro, which is what sounded robotic. So: recordings everywhere now,
and a hosted voice for live sentences if he wants it.

## The hosted option (proposed 2026-10-21, ON HOLD: Bryson "no we can hold off on that")
DeepInfra runs `ResembleAI/chatterbox` (MIT): `POST https://api.deepinfra.com/v1/inference/ResembleAI/chatterbox`
with `text` (max 5000), `voice_id` (a custom voice created on DeepInfra from our reference clip), `exaggeration`,
`cfg`, `temperature`, `seed`, `response_format` mp3. Price from their model list: 0.001 cents per input character
($10 per million). `chatterbox-turbo` is $1 per million but has no exaggeration/cfg. Plan: a Netlify function
`aria-speak` (auth = OS session) that calls it with the key in env `DEEPINFRA_API_KEY`, caches by text hash, and a
third ARIA_LIVE mode "hosted" that fetches mp3 per sentence. Works on phones too (no download). Setup steps for him:
make a DeepInfra account, add a card, create an API key, add it in Netlify (10pm reminder rule applies).

## How the recordings are made (re-record a line)
- Reference: `docs/aria-voice/reference.flac` (16s, ARIA's original clips joined: greet_morning, booked_2,
  power_start, greet_afternoon, recap). Keep it: the originals in /aria/ have been replaced.
- `docs/aria-voice/gen2.py jobs.json outdir`: Chatterbox `prepare_conditionals(reference)`, takes alternate
  exaggeration/cfg 0.5/0.5, 0.6/0.45, 0.45/0.55, 0.55/0.5; 6 takes for lines of 3 words or fewer, 4 otherwise.
- `docs/aria-voice/pick_os.py takes outdir`: faster-whisper small.en must hear every word; longest silence <= 0.42s;
  length sane for the word count; then UTMOS + speaker similarity + pitch movement; trim, -20 LUFS, libmp3lame 56k.
- Environment recipe (CPU, ~15 to 20s per take): venv with torch 2.6.0 CPU, `chatterbox-tts==0.1.7 --no-deps` plus
  its deps minus gradio, models from Hugging Face `ResembleAI/chatterbox` (MIT). Same stack as KB
  agency-promo-video v5/v6.
- Adding a NEW line: add it to `lines.json` AND `ARIA_CLIPS`, record, pick, drop the mp3 in /aria/. verify-aria-voice
  fails if the three disagree.

## Code
`index.html`: `const ARIA_LIVE = "off"` right after `ARIA_LOCK`; `ensureWorker`, `warm` and `say` all check it. With no
live voice, `say(text)` with no fallback stops "thinking" and clears `lastClip`, so the follow-up listening window
still opens after an answer appears. verify-aria-conversation runs the conversation twice: with a live voice (the
hand-offs stay proven for the hosted day) and as shipped (no model download ever, recordings only).

## 🔴 Checking a recording: whisper is not enough
Whisper "heard" every first-round take exactly, yet the phoneme recogniser (`docs/aria-voice/ear_ph.py`,
`facebook/wav2vec2-lv-60-espeak-cv-ft`, no language model) showed: all 6 "Opening Lead Scout" takes said LED (`l ɛ d`),
"Here's how you did" came out `h aɪ iː d ɪd`, "Here are your leads" lost its final s, "Yes?" had a g/k onset.
`pick_os.py` now requires the right sounds on those lines (`SOUNDS`) and allows a natural breath (<= 0.6s) between two
sentences. Fix for a misread word: give the voice a respelling in `docs/aria-voice/pronounce.json`
(`"open_leadscout": "Opening Leed Scout."`); the written line in `lines.json` stays correct.
- Re-running gen2.py on the same line with the same settings gives the SAME audio (seed comes from line id + take
  number). For genuinely new takes, change the settings or the seed.
