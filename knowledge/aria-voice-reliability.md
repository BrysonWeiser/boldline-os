---
name: aria-voice-reliability
topic: OS
task: fix or change ARIA speaking when the OS opens, the Hey ARIA microphone, or a conversation with her that stops working
keywords: [aria voice, hey aria, speak with aria, aria greeting, aria glitchy, mic stops, microphone stops, speech recognition, autoplay, audio unlock, silent switch, audioSession, follow-up window, conversation mode, aria not speaking, greet on open]
status: verified
summary: Bryson 2026-10-09: ARIA only sometimes spoke when the OS opened, and Hey ARIA worked once then stopped until he toggled it. Causes found and fixed - greeting waited for pointerdown (not a real tap on a phone), so audio stayed locked, yet the day was marked greeted; a reply cutting the "thinking" clip short could leave her "speaking" forever so the mic never resumed; one SpeechRecognition object was reused for the whole visit; iPhone silent switch muted Web Audio; and plain follow-up talk after an answer needed "Hey ARIA" again. Now: greets every open (3 min cooldown), tries before any tap, unlocks on pointerup/touchend/click/keydown, busy-counted speech, fresh listener each start, watchdog every 3s, 8s follow-up window after she answers something said aloud. verify-aria-conversation runs the real engine in a fake browser (17 checks).
verified: 2026-10-09
---

## Symptoms he reported (2026-10-09)
1. "sometimes she speaks sometimes she doesn't" when the OS opens.
2. "I spoke to her and she worked then I tried saying something else and it didn't work and I needed to disable
   and reenable the speak to aria thing."

## Causes (all in the `ARIA_VOICE` engine and the greeting effect in index.html)
- **Greeting gesture:** listened for `pointerdown`. On touch devices that is NOT user activation (spec: touch
  activation is `pointerup`/`touchend`), so the AudioContext never unlocked, the greeting played silently, and
  `markGreeted()` (once a DAY) meant no retry until tomorrow.
- **Stuck "speaking":** `stopNow()` nulled `onended` of the cut-off sound, so that sound's promise never resolved;
  `speaking` only cleared when the last sound ended by itself. Mic resume is gated on `!speaking`.
- **Stale listener:** one `SpeechRecognition` object stopped/restarted all visit; Chrome can leave a restarted one
  "listening" but deaf. Toggling the switch made a new one, which is why that "fixed" it.
- **iPhone silent switch** mutes Web Audio (his screenshots show silent mode on).
- **Follow-up talk** without the wake word was ignored by design, which reads as "didn't work".

## Fix
- Greeting: every open, not again within 3 minutes (`shouldGreet`, key `aria-greeted-at`). Tries immediately via
  `canPlay()` (works on installed app / high-engagement sites), else on first `pointerup|touchend|click|keydown`
  (capture), listeners kept until `canPlay` confirms the context is running. `unlock()` plays a 1-sample silent
  buffer inside the tap (older iOS).
- `busy` counter: `say`/`clip` run through `run()` (try/finally), `stopNow()` resolves the cut-off sound's promise,
  `done()` only when nothing playing/queued/being made. Synth requests time out after 25s.
- Fresh `SpeechRecognition` for every start; handlers ignore a replaced instance. Watchdog every 3s: heals stuck
  speaking, discards a listener that never started (6s), starts one when none, swaps a listener that heard
  nothing for 45s.
- `navigator.audioSession.type = "playback"` when mic off ("auto" when on, so capture still works).
- Conversation: after she finishes speaking an answer to something said aloud (within 90s), an 8s follow-up
  window (`wakeFor(8000)`) lets him just keep talking. Not after the "thinking" clip. Window closes, then
  overheard talk is ignored again.

## Tests
- `tests/verify-aria-conversation.mjs` runs the engine (sliced from `const ARIA_LOCK` to the helpers comment) in a vm
  with fake AudioContext / SpeechRecognition / Worker and holds a conversation. The pre-fix stopNow fails 9/17.
- `tests/verify-aria-voice.mjs` static checks updated (greeting events, silent switch, fresh listener).

## Limits
- A browser can still refuse sound until a tap; then she speaks on his first tap anywhere.
- iPhone Safari's speech recognition is flakier than Chrome's on a computer; the watchdog restarts it.
