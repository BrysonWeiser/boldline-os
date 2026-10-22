import sys, json, glob, os
SP = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"
sys.path.insert(0, f"{SP}/tools/fw")
from faster_whisper import WhisperModel
wh = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=f"{SP}/tools/whisper-models")
out = {}
for f in sorted(glob.glob(f"{SP}/fv/cut/wav/*.wav")):
    segs, _ = wh.transcribe(f, word_timestamps=True, beam_size=5, vad_filter=False, initial_prompt="BoldLine Media. ARIA. Power Hour. boldlinemedia.com.")
    words = [{"w": w.word, "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)} for s in segs for w in s.words]
    b = os.path.basename(f)[:-4]
    out[b] = words
    print(b, "|", "".join(x["w"] for x in words), "|", words[0]["s"] if words else None, words[-1]["e"] if words else None, flush=True)
json.dump(out, open(f"{SP}/fv/cut/words.json", "w"), indent=1)
