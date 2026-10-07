// ARIA's voice and "Hey ARIA" (OS redesign, stage 4).
//
// Bryson, 2026-10-07: ARIA should speak "like Jarvis" with a smart English accent, not sound robotic, and
// answer to "Hey ARIA" while the OS is open. He auditioned and LOCKED one voice (KB os-redesign). What has
// to stay true:
//  1. It is that voice: the same blend, speed and sound chain, for the recorded lines and the live ones.
//  2. Every line the code asks for exists as a recording, so nothing plays silence.
//  3. 🔴 Nothing said out loud can change anything. Spoken commands only navigate, read out, or hand the
//     question to the ARIA chat, whose real actions still wait for a click. A misheard word must never log a
//     call, send, delete or spend.
//  4. 🔴 The microphone is his choice and is honest: off until he turns it on, only while the OS is open,
//     never while ARIA is talking (or she would hear herself), and no background listener.
//  5. Phones never download the 90 MB voice model.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const slice = (a, b) => { const i = S.indexOf(a); const j = S.indexOf(b, i + a.length); return i < 0 ? "" : S.slice(i, j < 0 ? undefined : j); };

const VOICE = slice("// ─── ARIA VOICE (Stage 4)", "\nfunction useAriaVoice(");
ok("the voice code was found", VOICE.length > 6000);

// 1. The locked voice
ok("🔴 the locked blend and speed", /blend: \[\["bf_emma", 0\.6\], \["bf_isabella", 0\.4\]\], speed: 0\.98, pitch: 0\.92/.test(VOICE));
ok("the locked sound chain: +3 dB bass at 140 Hz, 2.5:1 compressor, 1.4x gain", /bassHz: 140, bassDb: 3, ratio: 2\.5, thresholdDb: -18\.4, gain: 1\.4/.test(VOICE));
ok("live speech is made 1/0.92 faster and played at 0.92, so the pitch drops and the pace holds",
  /speed: ARIA_LOCK\.speed \/ ARIA_LOCK\.pitch/.test(VOICE) && /src\.playbackRate\.value = ARIA_LOCK\.pitch/.test(VOICE));
ok("British English (the model takes the accent from the bf_ voice)", /voice:d\.blend\[0\]\[0\]/.test(VOICE));
ok("the blend is written fresh from the original voices, never blended twice", /fetch\(VOX\+v\+"\.bin"\)/.test(VOICE) && /caches\.open\("kokoro-voices"\)/.test(VOICE));

// 2. Recordings
const clipList = (VOICE.match(/const ARIA_CLIPS = \[([\s\S]*?)\];/) || [])[1] || "";
const CLIPS = [...clipList.matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]);
ok("the clip list was read", CLIPS.length >= 20, String(CLIPS.length));
const missing = CLIPS.filter((c) => !existsSync(join(ROOT, "aria", c + ".mp3")));
ok("🔴 every listed line has a recording", missing.length === 0, missing.join(", "));
const asked = [...S.matchAll(/ARIA_VOICE\.(?:clip|say)\([^)]*?"([a-z_0-9]+)"\)/g)].map((m) => m[1]).concat([...S.matchAll(/ARIA_VOICE\.clip\(([a-z.]+)\)/g)].length ? [] : []);
const unknown = [...new Set(asked)].filter((c) => !CLIPS.includes(c));
ok("every line the code plays is a real recording", unknown.length === 0, unknown.join(", "));
ok("no stray recordings", readdirSync(join(ROOT, "aria")).filter((f) => f.endsWith(".mp3")).every((f) => CLIPS.includes(f.replace(/\.mp3$/, ""))));

// 3. Spoken commands are safe
const route = new Function(slice("const ARIA_SCREENS = [", "\n\nfunction useAriaVoice(") + "\nreturn ariaRoute;")();
const r = (t) => route(t);
ok("'open lead scout' opens Lead Scout", r("open lead scout").kind === "go" && r("open lead scout").screen === "leadscout");
ok("'start power hour' starts Power Hour", r("start power hour").kind === "power");
ok("'how am I doing' reads the briefing", r("how am I doing").kind === "brief");
ok("'objections' opens the comebacks", r("objections").kind === "objections");
ok("'stop' stops her", r("stop").kind === "stop");
ok("'show me my calendar' opens the calendar", r("show me my calendar").screen === "calendar");
ok("a real question goes to the ARIA chat", r("what should I say to a med spa owner who already has an agency").kind === "ask");
ok("🔴 'log a no answer' is NOT an action (logging stays a key or a click)", r("log a no answer for this one").kind === "ask");
const H = slice("ARIA_VOICE.setHandler((text)=>{", "}); });");
ok("the command handler was found", H.length > 400);
ok("🔴 the handler only navigates, reads out or asks: no fetch, writes, sends or logging",
  !/fetch\(|api\(|commit\(|choose\(|update[A-Z]\w*\(|delete\w*\(|\.insert\(|\.upsert\(|localStorage/.test(H));
const keys = [...H.matchAll(/new KeyboardEvent\("keydown",\{key:"([^"]+)"\}\)/g)].map((m) => m[1]);
ok("🔴 the only keys it presses are 'objections' and 'skip', never an outcome number", keys.length > 0 && keys.every((k) => k === "o" || k === "ArrowRight"), keys.join(","));
ok("questions go to the chat, where actions still wait for a click", /setAriaAsk\(String\(text\)\); setShowARIA\(true\)/.test(H) && /pendingAction/.test(slice("function ARIAPanel(", "\nfunction ")));

// 4. The microphone
ok("🔴 off until he turns it on", /micOn: get\(LS\.mic, false\)/.test(VOICE));
ok("the wake word catches the usual mishearings", ["hey aria open outreach", "Hey Arya", "ok area how am I doing"].every((t) => new RegExp(VOICE.match(/const ARIA_WAKE = \/(.*)\/i;/)[1], "i").test(t)));
ok("🔴 she stops listening while she talks, and resumes after", /const pauseMic = \(\) => \{ if \(rec && st\.listening\)/.test(VOICE) && /cur = src; patch\(\{ speaking: true \}\); core\(\)\.state = "speak"; pauseMic\(\);/.test(VOICE) && /const resumeMic = \(\) => \{ if \(st\.micOn && rec && !st\.speaking/.test(VOICE));
ok("🔴 no background listening: no service worker, nothing after the tab closes", !/serviceWorker|navigator\.wakeLock|Notification\.requestPermission/.test(VOICE));
ok("a blocked microphone turns the switch off and says how to fix it", /not-allowed[\s\S]{0,200}st\.micOn = false/.test(VOICE));
ok("the switch says Chrome uses Google's speech service", /Chrome uses Google's speech service/.test(S));

// 5. Phones
ok("🔴 phones never start the voice model download", /if \(worker \|\| isPhone\(\) \|\| !W\.Worker \|\| !W\.caches\) return worker;/.test(VOICE));
ok("phones (and the first visit, before the download) use the recordings", /if \(isPhone\(\) \|\| st\.neural === "off" \|\| !W\.Worker\) \{ if \(fallback\) await clip\(fallback\); return; \}/.test(VOICE)
  && /if \(st\.neural !== "ready"\) \{ warm\(\); if \(fallback\) await clip\(fallback\); return; \}/.test(VOICE));
ok("the model runs in a background worker, so the OS never freezes while she thinks", /new Worker\(URL\.createObjectURL\(new Blob\(\[ARIA_WORKER_SRC\]/.test(VOICE));
ok("greets once a day, on his first click (browsers block sound before that)", /if\(!ARIA_VOICE\.greetedToday\(\)\)\{ ARIA_VOICE\.markGreeted\(\);/.test(S));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-aria-voice: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
