import sys, json
SP = "/tmp/claude-0/-home-user-boldline-os/2dbaa2ea-f845-5f5d-a6f7-2b3c80378394/scratchpad"
sys.path.insert(0, f"{SP}/tools/fw")
from faster_whisper import WhisperModel
wh = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=f"{SP}/tools/whisper-models")
import wave, numpy as np
wf = wave.open(f"{SP}/fv3/take.wav"); audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
segs, _ = wh.transcribe(audio, word_timestamps=True, beam_size=5, vad_filter=False,
    initial_prompt="BoldLine Media. boldlinemedia.com. Google. qualified leads.")
words = []
for s in segs:
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text}", flush=True)
    words += [{"w": w.word, "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)} for w in s.words]
json.dump(words, open(f"{SP}/fv3/words.json", "w"), indent=1)
