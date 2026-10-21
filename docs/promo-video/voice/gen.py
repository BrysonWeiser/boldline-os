# Stage 1: several takes of each scene, read as one connected passage, in ARIA's voice (Chatterbox, MIT, cloned from her OS clips).
import json, os, sys, time, torch, torchaudio as ta
torch.set_num_threads(4)
from chatterbox.tts import ChatterboxTTS
D = os.path.dirname(os.path.abspath(__file__))
script = json.load(open(f"{D}/script.json"))
SETTINGS = [(0.6, 0.45), (0.6, 0.45), (0.75, 0.35), (0.75, 0.35)]   # (exaggeration, cfg_weight) per take
only = set(sys.argv[1:])
m = ChatterboxTTS.from_pretrained(device="cpu")
m.prepare_conditionals(f"{D}/aria-ref.wav", exaggeration=0.6)
for sid, sents in script:
    if only and sid not in only: continue
    text = " ".join(sents)
    for k, (ex, cfg) in enumerate(SETTINGS):
        out = f"{D}/takes/{sid}-{k}.wav"
        if os.path.exists(out): continue
        seed = 1000 + k * 17 + hash(sid) % 97
        torch.manual_seed(seed)
        t = time.time()
        wav = m.generate(text, exaggeration=ex, cfg_weight=cfg, temperature=0.8)
        ta.save(out, wav, m.sr)
        json.dump({"sid": sid, "k": k, "ex": ex, "cfg": cfg, "seed": seed, "text": text}, open(out + ".json", "w"))
        print(sid, k, ex, cfg, f"{wav.shape[-1]/m.sr:.2f}s in {time.time()-t:.0f}s", flush=True)
