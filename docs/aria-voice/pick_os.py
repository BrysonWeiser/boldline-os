# ARIA's fixed OS lines (/aria/*.mp3) in the new voice: score every take, keep the best per line, write the mp3s.
#  must: every word heard back exactly (whisper), no dead air (> 0.42s) inside the line, a sane length
#  then: most natural (UTMOS), closest to ARIA (speaker embedding), livelier pitch as a tie-break
# Output matches the old files: mp3, 56 kbps, mono, 24 kHz, at the old loudness (-20 LUFS) so nothing jumps.
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
SR = 24000; MAXPAUSE = 0.42
LINES = json.load(open(f"{SP}/osclips/lines.json")); TAKES = sys.argv[1]; OUT = sys.argv[2]
# 🔴 Whisper fills in what it expects, so it passed "Opening Lead Scout" said as LED scout, a garbled "how you did" and
# "Yes?" with an "uh" in front. A phoneme recogniser with no language model (ear_ph) must also hear these sounds.
from ear_ph import phones
SOUNDS = {"open_leadscout": r"l iː d", "recap": r"h aʊ", "open_leads": r"l iː d z", "yes": r"^j ɛ s"}
norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("’", "'").replace("'", "")).split()
def emb(w16): e = np.asarray(ve.embeds_from_wavs([w16], sample_rate=16000)).mean(0); return e / np.linalg.norm(e)
ref = emb(librosa.load(f"{D}/aria-ref.wav", sr=16000)[0])
def frames_db(a, hop=240):
    n = len(a) // hop; r = np.sqrt(np.mean(a[:n*hop].reshape(n, hop) ** 2, 1) + 1e-12); return 20 * np.log10(r / (r.max() + 1e-12))
def trim(a):
    db = frames_db(a); on = np.where(db > -38)[0]
    s = max(0, on[0] * 240 - int(.03 * SR)); e = min(len(a), (on[-1] + 1) * 240 + int(.08 * SR)); return a[s:e]
def longest_gap(a):
    db = frames_db(a) < -42; best = run = 0
    for x in db: run = run + 1 if x else 0; best = max(best, run)
    return best * 240 / SR
meter = pyln.Meter(SR, block_size=0.2); report = {}
for lid, text in LINES.items():
    rows = []
    for f in sorted(x for x in glob.glob(f"{TAKES}/{lid}-*.wav") if ".trim." not in x):
        a, _ = sf.read(f); a = trim(a.astype(np.float32)); tmp = f.replace(".wav", ".trim.wav"); sf.write(tmp, a, SR)
        segs, _ = wh.transcribe(tmp, beam_size=5, language="en"); heard = " ".join(s.text.strip() for s in segs)
        ok = norm(heard) == norm(text)
        w16 = librosa.resample(a, orig_sr=SR, target_sr=16000)
        with torch.no_grad(): u = float(mos(torch.from_numpy(w16).unsqueeze(0), 16000))
        sim = float(np.dot(ref, emb(w16)))
        f0, _, _ = librosa.pyin(w16, fmin=80, fmax=400, sr=16000); f0 = f0[~np.isnan(f0)]
        sd = float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) > 5 else 0
        gap = longest_gap(a); dur = len(a) / SR; expect = 0.3 + 0.36 * len(text.split())
        ph = phones(w16) if lid in SOUNDS else ""; sounds = not ph or bool(re.search(SOUNDS[lid], ph))
        # a breath between two sentences is natural in a short line; inside a sentence it is dead air
        maxp = 0.6 if len(re.findall(r"[.?!]\s", text + " ")) >= 2 else MAXPAUSE
        sane = 0.5 * expect <= dur <= 1.8 * expect
        asks = text.count("?")
        score = u + 3 * (sim - 0.95) + 0.05 * sd + (0.15 if asks and heard.count("?") >= asks else 0) - (0 if gap <= maxp else 2) - (0 if ok else 10) - (0 if sane else 5) - (0 if sounds else 10)
        rows.append(dict(f=tmp, ok=ok and sounds, score=score, heard=heard, u=u, sim=sim, gap=gap, dur=dur, sane=sane, maxp=maxp))
        print(f"{lid:16s} {os.path.basename(f):20s} {'OK ' if ok else 'BAD'} mos {u:.2f} sim {sim:.3f} gap {gap:.2f} dur {dur:.2f}{'' if sane else ' ODD-LENGTH'} -> {score:.2f} | {heard}{'' if sounds else '  WRONG SOUNDS ' + ph}", flush=True)
    if not rows: print(f"{lid}: NO TAKES"); continue
    best = max(rows, key=lambda r: r["score"]); good = best["ok"] and best["gap"] <= best["maxp"] and best["sane"]
    print(f"  chose {os.path.basename(best['f'])}{'' if good else '  <<< NEEDS MORE TAKES'}", flush=True)
    report[lid] = {"take": os.path.basename(best["f"]), "good": good, "heard": best["heard"], "mos": round(best["u"], 2), "sim": round(best["sim"], 3), "dur": round(best["dur"], 2)}
    if not good: continue
    a, _ = sf.read(best["f"]); lufs = meter.integrated_loudness(a)
    a = np.clip(pyln.normalize.loudness(a, lufs, -20.0), -0.98, 0.98); wav = best["f"].replace(".trim.wav", ".final.wav"); sf.write(wav, a, SR)
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "56k", "-ac", "1", "-ar", "24000", f"{OUT}/{lid}.mp3"], check=True)
json.dump(report, open(f"{OUT}/report.json", "w"), indent=1)
print("good", sum(1 for r in report.values() if r["good"]), "of", len(LINES))
