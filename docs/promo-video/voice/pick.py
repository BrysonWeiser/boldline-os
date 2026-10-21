# Stage 2: score every take, keep the best per scene, lay the scenes end to end, write flow.json for the video.
#  must: every word heard back exactly (whisper), no dead air inside a line (> MAXPAUSE)
#  then: most natural (UTMOS), closest to ARIA (speaker embedding), livelier pitch as a tie-breaker
import json, os, re, glob, sys, subprocess, numpy as np, soundfile as sf, librosa, torch, pyloudnorm as pyln
D = os.path.dirname(os.path.abspath(__file__)); SP = os.path.dirname(D)
FF = glob.glob(f"{SP}/tools/py/imageio_ffmpeg/binaries/ffmpeg-linux*")[0]
sys.path.insert(0, f"{SP}/tools/smos")
from speechmos.utmos22.strong.model import UTMOS22Strong
from chatterbox.models.voice_encoder import VoiceEncoder
from safetensors.torch import load_file
from faster_whisper import WhisperModel
torch.set_num_threads(4)
mos = UTMOS22Strong(); mos.load_state_dict(torch.load(f"{SP}/tools/smos/utmos22_strong_step7459_v1.pt", map_location="cpu")); mos.eval()
ve = VoiceEncoder(); ve.load_state_dict(load_file(glob.glob(f"{SP}/hf/hub/models--ResembleAI--chatterbox/snapshots/*/ve.safetensors")[0])); ve.eval()
wh = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=f"{SP}/tools/whisper-models")
SR = 24000; MAXPAUSE = 0.42; SCENE_GAP = 0.24; END_HOLD = 2.6; LEAD = 0.2
# whisper writes the brand as one word ("boldlinemedia .com"), which is right, so compare it as the script spells it
norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", re.sub(r"boldline\s*media", "bold line media", s.lower()).replace(".com", " dot com")).split()
def emb(w16):
    e = np.asarray(ve.embeds_from_wavs([w16], sample_rate=16000)).mean(0); return e / np.linalg.norm(e)
ref = emb(librosa.load(f"{D}/aria-ref.wav", sr=16000)[0])
def frames_db(a, hop=240):
    n = len(a) // hop; r = np.sqrt(np.mean(a[:n*hop].reshape(n, hop) ** 2, 1) + 1e-12); return 20 * np.log10(r / (r.max() + 1e-12))
def trim(a):
    db = frames_db(a); on = np.where(db > -38)[0]
    s = max(0, on[0] * 240 - int(.04 * SR)); e = min(len(a), (on[-1] + 1) * 240 + int(.09 * SR)); return a[s:e]
def longest_gap(a):
    db = frames_db(a) < -42; best = run = 0
    for x in db: run = run + 1 if x else 0; best = max(best, run)
    return best * 240 / SR
script = json.load(open(f"{D}/script.json")); chosen = {}
ONLY = os.environ.get("ONLY")   # score just these scenes (comma list), no assembly
if ONLY: script = [x for x in script if x[0] in ONLY.split(",")]
for sid, sents in script:
    rows = []
    for f in sorted(x for x in glob.glob(f"{D}/takes/{sid}-*.wav") if ".trim." not in x):
        a, sr = sf.read(f); a = trim(a.astype(np.float32)); tmp = f.replace(".wav", ".trim.wav"); sf.write(tmp, a, SR)
        segs, _ = wh.transcribe(tmp, beam_size=5, language="en", word_timestamps=True)
        words = [w for s in segs for w in s.words]; heard = " ".join(w.word.strip() for w in words)
        ok = norm(heard) == norm(" ".join(sents))
        w16 = librosa.resample(a, orig_sr=SR, target_sr=16000)
        with torch.no_grad(): u = float(mos(torch.from_numpy(w16).unsqueeze(0), 16000))
        sim = float(np.dot(ref, emb(w16)))
        f0, _, _ = librosa.pyin(w16, fmin=80, fmax=400, sr=16000); f0 = f0[~np.isnan(f0)]
        sd = float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) else 0
        gap = longest_gap(a)
        asks = " ".join(sents).count("?")   # a question should sound like one; whisper only writes "?" when it rises
        score = u + 3 * (sim - 0.95) + 0.05 * sd + (0.15 if asks and heard.count("?") >= asks else 0) - (0 if gap <= MAXPAUSE else 2) - (0 if ok else 10)
        rows.append(dict(f=tmp, ok=ok, mos=u, sim=sim, sd=sd, gap=gap, dur=len(a) / SR, score=score, heard=heard, words=[(w.word.strip(), w.start, w.end) for w in words]))
        print(f"{sid} {os.path.basename(f):10s} {'OK ' if ok else 'BAD'} mos {u:.2f} sim {sim:.3f} f0sd {sd:.2f} gap {gap:.2f} dur {len(a)/SR:.2f} -> {score:.2f} | {heard}", flush=True)
    best = max(rows, key=lambda r: r["score"]); chosen[sid] = best
    print(f"  chose {os.path.basename(best['f'])}{'' if best['ok'] and best['gap'] <= MAXPAUSE else '  <<< NEEDS MORE TAKES'}", flush=True)
if ONLY: sys.exit(0)
# Assemble at one loudness so no scene jumps out.
meter = pyln.Meter(SR); track = [np.zeros(int(0.15 * SR))]; t = 0.15; marks = {}; seg = {}   # a breath of room so autoplay never clips her first word
for i, (sid, sents) in enumerate(script):
    r = chosen[sid]; a, _ = sf.read(r["f"])
    a = pyln.normalize.loudness(a, meter.integrated_loudness(a), -20.0)
    marks[sid] = t
    # whisper words can hold several script tokens ("we'd", "boldlinemedia.com"), so map token index -> whisper word
    tok = [wi for wi, w in enumerate(r["words"]) for _ in norm(w[0])]
    at = lambda k: round(t + max(0.0, r["words"][tok[k]][1] - 0.02), 3)
    k = 0
    for j, s in enumerate(sents):
        seg[f"{sid}.{j}"] = at(k); k += len(norm(s))
    if sid == "s9":   # the web address appears on screen as she starts saying it
        seg["s9.url"] = at(norm(" ".join(sents)).index("bold"))
    track.append(a); t += len(a) / SR
    if i < len(script) - 1: track.append(np.zeros(int(SCENE_GAP * SR))); t += SCENE_GAP
full = np.concatenate(track); sf.write(f"{D}/narration-raw.wav", full, SR)
subprocess.run([FF, "-loglevel", "error", "-y", "-i", f"{D}/narration-raw.wav", "-af", "highpass=f=70,acompressor=threshold=0.18:ratio=2:attack=10:release=150,alimiter=limit=0.95", "-ar", str(SR), "-ac", "1", f"{D}/narration-flow.wav"], check=True)
total = t + END_HOLD; ids = [s for s, _ in script]; order = []
for n, sid in enumerate(ids):
    start = 0.0 if n == 0 else marks[sid] - LEAD
    end = (marks[ids[n + 1]] - LEAD) if n + 1 < len(ids) else total
    order.append([int(sid[1:]), round(end - start, 3)])
json.dump({"order": order, "marks": marks, "seg": seg, "total": total, "chosen": {k: os.path.basename(v["f"]) for k, v in chosen.items()}}, open(f"{D}/flow.json", "w"), indent=1)
print("voice", round(t, 2), "total", round(total, 2)); print(order); print(seg)
