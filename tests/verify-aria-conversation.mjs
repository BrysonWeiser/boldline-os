// ARIA's voice and microphone, actually run (Bryson, 2026-10-09: "I spoke to her and she worked then I tried
// saying something else and it didn't work and I needed to disable and reenable the speak to aria thing").
//
// verify-aria-voice reads the code. This one RUNS the real voice engine out of index.html against a stand-in
// browser (a speaker that plays for a set time, a listener whose sessions can start, end and be fed speech,
// a voice model that answers after a moment) and holds a conversation with her:
//   1. "Hey ARIA, <question>": the question reaches the OS, she says "thinking", her spoken answer cuts that
//      short, and when she finishes she is NOT stuck speaking and the microphone is back.
//   2. He then just carries on talking, no "Hey ARIA": she hears it (a short follow-up window).
//   3. After the window, plain talk is ignored again (she does not act on overheard speech).
//   4. Every restart is a NEW listener, and one that ends on its own is replaced without a click.
//   5. A listener that silently never starts is thrown away and replaced by the check that runs every few seconds.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const a = S.indexOf("const ARIA_LOCK = "), b = S.indexOf("// Plain-language helpers for what he says to her");
const SRC = a > 0 && b > a ? S.slice(a, b) : "";
ok("the voice engine was found", SRC.includes("const ARIA_VOICE = (() => {"));

// ── The stand-in browser ─────────────────────────────────────────────────────────────────────────
const recs = [];
class FakeSR {
  constructor() { this.started = false; this.ended = false; recs.push(this); }
  start() { if (this.started) throw new Error("InvalidStateError"); this.started = true; if (!FakeSR.deaf) setTimeout(() => this.onstart && this.onstart(), 5); }
  abort() { if (this.ended) return; this.ended = true; setTimeout(() => this.onend && this.onend(), 5); }
  endByItself() { this.ended = true; this.onend && this.onend(); }
  say(text) { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
}
const node = () => ({ connect() {}, gain: { value: 1 }, frequency: { value: 0 }, threshold: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, knee: { value: 0 }, fftSize: 0, getByteTimeDomainData() {} });
const CLIP_MS = { thinking: 400, yes: 80 };
class FakeAC {
  constructor() { this.state = "running"; this.destination = {}; }
  resume() { return Promise.resolve(); }
  createAnalyser() { return node(); } createGain() { return node(); } createBiquadFilter() { return node(); } createDynamicsCompressor() { return node(); }
  createBuffer() { return { copyToChannel() {}, ms: 60 }; }
  decodeAudioData(ab) { return Promise.resolve({ ms: CLIP_MS[String.fromCharCode(...new Uint8Array(ab))] || 100 }); }
  createBufferSource() { const s = { playbackRate: { value: 1 }, connect() {}, stopped: false,
    start() { const ms = (s.buffer && s.buffer.ms) || 60; setTimeout(() => { if (!s.stopped && s.onended) s.onended(); }, ms); },
    stop() { s.stopped = true; } }; return s; }
}
class FakeWorker { postMessage(m) { setTimeout(() => this.onmessage({ data: m.type === "say" ? { type: "audio", id: m.id, pcm: new Float32Array(4), sr: 24000 } : { type: "ready", id: m.id } }), 40); } }
const store = {};
const W = { AudioContext: FakeAC, SpeechRecognition: FakeSR, Worker: FakeWorker, caches: {}, innerWidth: 1400, navigator: {},
  matchMedia: () => ({ matches: false }) };
const ctx = vm.createContext({ window: W, Worker: FakeWorker, navigator: W.navigator, matchMedia: W.matchMedia, console, setTimeout, clearTimeout, setInterval, URL: { createObjectURL: () => "blob:x" }, Blob: class {},
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  requestAnimationFrame: () => 0, Float32Array, Uint8Array, Promise, Date, Math, Number, String, Object, Set, Array,
  fetch: async (u) => { const name = String(u).replace(/^.*\/|\.mp3$/g, ""); return { arrayBuffer: async () => new Uint8Array([...name].map((c) => c.charCodeAt(0))).buffer }; } });
let V;
try { vm.runInContext(SRC + "\nthis.ARIA_VOICE = ARIA_VOICE;", ctx); V = ctx.ARIA_VOICE; } catch (e) { fails.push("the engine runs: " + e.message); }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const live = () => recs.filter((r) => r.started && !r.ended);
const mic = () => live()[0] || { say() {}, endByItself() {} };   // a missing listener fails the checks, never crashes them
if (V) {
  const asked = [];
  V.setHandler((t) => { asked.push(t); if (/question/.test(t)) { V.clip("thinking"); setTimeout(() => V.say("Here is the answer. And one more line."), 120); } else V.clip("on_it"); });
  V.warm(); await wait(80);
  ok("the voice model reports ready", V.state().neural === "ready");
  V.setMic(true); await wait(30);
  ok("the mic switch starts a listener", V.state().listening && live().length === 1);

  // 1. A spoken question, answered out loud, with "thinking" cut short by the answer.
  mic().say("hey aria I have a question about med spas");
  ok("the question reaches the OS without the wake word", asked[0] === "I have a question about med spas", asked[0]);
  await wait(60);
  ok("she stops listening while she talks", V.state().speaking && live().length === 0);
  await wait(900);
  const st1 = V.state();
  ok("🔴 when she has finished, she is not stuck 'speaking'", !st1.speaking);
  ok("🔴 the microphone came back on its own", st1.listening && live().length === 1);
  ok("🔴 it is a NEW listener, not the old one restarted", recs.length >= 2 && live()[0] !== recs[0]);
  ok("she keeps listening for a follow-up", st1.awake);

  // 2. He just carries on talking.
  mic().say("open outreach");
  ok("🔴 the follow-up is heard without saying Hey ARIA again", asked[1] === "open outreach", String(asked[1]));
  await wait(400);
  ok("after that answer the mic is back again", V.state().listening && !V.state().speaking && live().length === 1);

  // 3. The follow-up window closes; overheard talk is ignored again.
  await wait(8300);
  ok("the follow-up window closes by itself", !V.state().awake);
  const n = asked.length; mic().say("so anyway I told him the price");
  ok("🔴 once it closes, overheard talk is not acted on", asked.length === n);

  // 4. A listener that ends by itself (Chrome does this after a quiet spell) is replaced without a click.
  const before = recs.length; mic().endByItself(); await wait(400);
  ok("🔴 a listener that ended on its own is replaced with a new one", recs.length === before + 1 && V.state().listening);

  // 5. A listener that never starts is caught by the check every few seconds.
  FakeSR.deaf = true; mic().endByItself(); await wait(400);
  ok("a replacement was attempted", recs.length === before + 2 && !V.state().listening);
  FakeSR.deaf = false; await wait(9500);
  ok("🔴 the check every few seconds throws away a listener that never started and starts a working one", V.state().listening && live().some((x) => x !== recs[before + 1]));

  // Switching off really stops it.
  V.setMic(false); await wait(30);
  ok("switching Hey ARIA off stops listening", !V.state().listening && live().length === 0);
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-aria-conversation: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
