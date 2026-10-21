# Which sounds does she actually make? A phoneme recogniser (wav2vec2 espeak, no language model) on the stretch from
# "searched" to "mobile": a swallowed article shows as nothing between "for" and "m", a weak one as a schwa (ə),
# the "ay" reading as eɪ.
import sys, glob, json, re, torch, librosa
from transformers import Wav2Vec2ForCTC, Wav2Vec2FeatureExtractor
from transformers.utils import logging as tl; tl.set_verbosity_error()
torch.set_num_threads(2)
P = glob.glob("/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/hf/hub/models--facebook--wav2vec2-lv-60-espeak-cv-ft/snapshots/*")[0]
fe = Wav2Vec2FeatureExtractor.from_pretrained(P); m = Wav2Vec2ForCTC.from_pretrained(P).eval()
inv = {v: k for k, v in json.load(open(f"{P}/vocab.json")).items()}
def phones(w):
    with torch.no_grad(): ids = m(fe(w, sampling_rate=16000, return_tensors="pt").input_values).logits.argmax(-1)[0].tolist()
    out, prev = [], None
    for i in ids:
        if i != prev and inv.get(i) not in ("<pad>", "<s>", "</s>", "<unk>"): out.append(inv[i])
        prev = i
    return " ".join(out)
if __name__ == "__main__":
    for f in sys.argv[1:]:
        w, _ = librosa.load(f, sr=16000)
        p = phones(w[: 16000 * 3])
        print(f"{f.split('/')[-1]:22s} {p}")
