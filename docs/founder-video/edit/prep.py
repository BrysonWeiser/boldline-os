# Bryson's clips -> one clean SDR 1080x1920 30fps file per script line (split clips joined back together).
import subprocess, glob, os
SP = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"
FF = glob.glob(f"{SP}/tools/py/imageio_ffmpeg/binaries/ffmpeg-linux*")[0]
U = "/root/.claude/uploads/d9722fb2-4d16-5f71-986a-70a555565df3"
LINES = {1: ["1f21e476-IMG_1584"], 2: ["fbe89467-IMG_1594"], 3: ["60fd813a-IMG_1596"], 5: ["04881248-IMG_1603"],
  7: ["18733841-IMG_1615"], 9: ["66003647-IMG_1632", "66c29c4d-IMG_1632"], 10: ["d2d5bede-IMG_1633"], 11: ["05465d4e-IMG_1634"],
  12: ["b5cc6f78-IMG_1638"], 13: ["48bb6e60-IMG_1640", "5737cb41-IMG_1640"], 14: ["4d784086-IMG_1642"]}
TM = ("zscale=w=1080:h=1920:filter=spline36:tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,format=gbrpf32le,"
      "zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=brightness=0.06:contrast=1.08:saturation=1.05,fps=30,setsar=1")
for n, parts in LINES.items():
    out = f"{SP}/fv/cut/lines/L{n:02d}.mp4"
    if os.path.exists(out): continue
    ins = sum([["-i", f"{U}/{p}.mov"] for p in parts], [])
    fc = ";".join(f"[{i}:v]{TM}[v{i}];[{i}:a:0]aresample=48000,aformat=channel_layouts=stereo[a{i}]" for i in range(len(parts)))
    fc += ";" + "".join(f"[v{i}][a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a]"
    subprocess.run([FF, "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-c:a", "pcm_s16le", out.replace(".mp4", ".mov")], check=True)
    os.rename(out.replace(".mp4", ".mov"), out.replace(".mp4", ".mov"))
    print("done", n, flush=True)
