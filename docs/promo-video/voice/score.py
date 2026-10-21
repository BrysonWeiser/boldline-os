# Objective checks for a narration clip: naturalness (UTMOS, 1-5), ARIA likeness (speaker-embedding cosine), pitch movement.
import sys, torch, librosa, numpy as np
sys.path.insert(0, "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/tools/smos")
from speechmos.utmos22.strong.model import UTMOS22Strong
m = UTMOS22Strong(); m.load_state_dict(torch.load("/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/tools/smos/utmos22_strong_step7459_v1.pt", map_location="cpu")); m.eval()
from chatterbox.models.voice_encoder import VoiceEncoder
from safetensors.torch import load_file
import glob
ve = VoiceEncoder(); ve.load_state_dict(load_file(glob.glob("/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/hf/hub/models--ResembleAI--chatterbox/snapshots/*/ve.safetensors")[0])); ve.eval()
def emb(path):
    w,_ = librosa.load(path, sr=16000)
    e = ve.embeds_from_wavs([w], sample_rate=16000)
    e = np.asarray(e).mean(0); return e/np.linalg.norm(e)
ref = emb(sys.argv[1])
print(f"{'file':40s} UTMOS  ARIA-sim  F0-sd(st)")
for f in sys.argv[2:]:
    w,_ = librosa.load(f, sr=16000)
    with torch.no_grad():
        # score in 10s windows and average, UTMOS is trained on short utterances
        win = 16000*10; segs = [w[i:i+win] for i in range(0, len(w), win) if len(w[i:i+win]) > 16000*2]
        mos = np.mean([float(m(torch.from_numpy(s).unsqueeze(0), 16000)) for s in segs])
    f0,_,_ = librosa.pyin(w, fmin=80, fmax=400, sr=16000); f0 = f0[~np.isnan(f0)]
    sd = np.std(12*np.log2(f0/np.median(f0))) if len(f0) else 0
    print(f"{f[-40:]:40s} {mos:5.2f}  {float(np.dot(ref, emb(f))):.3f}    {sd:.2f}")
