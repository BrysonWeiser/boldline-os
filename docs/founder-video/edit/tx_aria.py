import sys, json, glob, os, soundfile as sf, numpy as np
SP = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"
from faster_whisper import WhisperModel
wh = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=f"{SP}/tools/whisper-models")
out = {}
for b in ["greet", "intro", "power"]:
    f = f"{SP}/fv/cut/aria/{b}.wav"
    segs, _ = wh.transcribe(f, word_timestamps=True, beam_size=5, initial_prompt="ARIA. Bryson. Power Hour.")
    words = [{"w": w.word, "s": round(w.start, 2), "e": round(w.end, 2)} for s in segs for w in s.words]
    x, sr = sf.read(f); hop = int(sr*0.01)
    r = np.array([np.sqrt(np.mean(x[i:i+hop]**2)) for i in range(0, len(x)-hop, hop)]); db = 20*np.log10(r+1e-9)
    idx = np.where(db > db.max()-30)[0]
    out[b] = {"words": words, "on": round(idx[0]*0.01, 2), "off": round(idx[-1]*0.01, 2), "dur": round(len(x)/sr, 3)}
    print(b, out[b]["on"], out[b]["off"], out[b]["dur"], " ".join("%s[%.2f-%.2f]" % (w["w"].strip(), w["s"], w["e"]) for w in words))
json.dump(out, open(f"{SP}/fv/cut/aria/words.json", "w"), indent=1)
