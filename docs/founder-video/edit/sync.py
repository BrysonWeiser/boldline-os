# Is every piece where the audio thinks it is? Compare frame (start+k) of the final with frame k of each piece.
import subprocess, numpy as np, json, glob
SP = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"; D = f"{SP}/fv/cut"
FF = glob.glob(f"{SP}/tools/py/imageio_ffmpeg/binaries/ffmpeg-linux*")[0]
import sys
final = sys.argv[1]
def frames(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-vf", "scale=54:96,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(np.float32)
F = frames(final); E = json.load(open(f"{D}/edit.json"))["pieces"]
start = 0; bad = 0
for i, p in enumerate(E):
    P = frames(f"{D}/pieces/p{i:02d}.mp4")
    errs = []
    for k in [1, p["n"] // 2, p["n"] - 2]:
        a = F[start + k][:60]; b = P[k][:60]                      # top 60% only: captions sit lower
        best = min(range(-3, 4), key=lambda d: np.abs(F[min(max(start + k + d, 0), len(F) - 1)][:60] - b).mean())
        errs.append((round(float(np.abs(a - b).mean()), 1), best))
    ok = all(e < 6 and d == 0 for e, d in errs)
    bad += not ok
    print(f"p{i:02d} start {start:5d} n {p['n']:4d}", errs, "" if ok else "  <-- OFF")
    start += p["n"]
print("total", start, "frames in final", len(F), "pieces off:", bad)
