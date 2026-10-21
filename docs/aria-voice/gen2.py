# Generic take recorder: jobs.json = [{"id", "text", "takes": [[exaggeration, cfg], ...]}], one model load for all.
import json, os, sys, time, zlib, torch, torchaudio as ta
torch.set_num_threads(4)
from chatterbox.tts import ChatterboxTTS
D = os.path.dirname(os.path.abspath(__file__))
jobs = json.load(open(sys.argv[1])); outdir = sys.argv[2]; os.makedirs(outdir, exist_ok=True)
m = ChatterboxTTS.from_pretrained(device="cpu")
m.prepare_conditionals(f"{D}/aria-ref.wav", exaggeration=0.6)
for j in jobs:
    for k, (ex, cfg) in enumerate(j["takes"]):
        out = f"{outdir}/{j['id']}-{k}.wav"
        if os.path.exists(out): continue
        seed = 7 + k * 31 + zlib.crc32(j["id"].encode()) % 1000
        torch.manual_seed(seed); t = time.time()
        wav = m.generate(j["text"], exaggeration=ex, cfg_weight=cfg, temperature=0.8)
        ta.save(out, wav, m.sr)
        json.dump({"id": j["id"], "k": k, "ex": ex, "cfg": cfg, "seed": seed, "text": j["text"]}, open(out + ".json", "w"))
        print(j["id"], k, ex, cfg, f"{wav.shape[-1]/m.sr:.2f}s in {time.time()-t:.0f}s", flush=True)
