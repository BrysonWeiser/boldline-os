# Founder video take 3 ("How our automations help clients"), 2026-11-10: ONE continuous take (IMG_1776.MOV, 4K60 SDR),
# cut tight, OS clips over the system lines, v2 caption look (no box, word by word, gold key words), -14 LUFS stereo.
# Adapted from docs/founder-video/edit/edit.py. No ARIA.
import json, os, re, subprocess, glob, shutil, sys
SP = "/tmp/claude-0/-home-user-boldline-os/2dbaa2ea-f845-5f5d-a6f7-2b3c80378394/scratchpad"
sys.path.insert(0, f"{SP}/tools/py")
import numpy as np, soundfile as sf, pyloudnorm as pyln
from concurrent.futures import ThreadPoolExecutor

D = f"{SP}/fv3/cut"; BR = f"{SP}/fv3/broll"; SRC = f"{SP}/take3-dl/IMG_1776.MOV"
FPS, SR = 30, 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{D}/How our automations help clients.mp4"
run = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
fr = lambda s: int(round(s * FPS))
os.makedirs(D, exist_ok=True)

W = json.load(open(f"{SP}/fv3/words.json")); DB = np.load(f"{SP}/fv3/db.npy"); THR = -39.3

# ── The edit: source seconds. face = him on camera (zoom alternates so cuts read as intentional), broll = OS clip. ──
P = [
  {"k": "face",  "a": [(0.62, 2.52)], "z": 1.00},
  {"k": "face",  "a": [(3.10, 7.62)], "z": 1.10},
  {"k": "face",  "a": [(8.08, 8.52), (9.08, 11.15)], "z": 1.00},
  {"k": "broll", "seg": "system",  "a": [(12.40, 14.08), (14.34, 15.75)]},
  {"k": "face",  "a": [(19.22, 20.75), (21.58, 22.90), (23.22, 23.58), (24.50, 24.95)], "z": 1.10},
  {"k": "face",  "a": [(25.22, 29.52)], "z": 1.00},
  {"k": "face",  "a": [(30.56, 31.28), (32.32, 33.72), (34.55, 36.58)], "z": 1.10},
  {"k": "broll", "seg": "review",  "a": [(37.28, 42.18)]},
  {"k": "broll", "seg": "traced",  "a": [(42.55, 47.66), (48.42, 50.90)]},
  {"k": "face",  "a": [(51.24, 57.05)], "z": 1.00},
  {"k": "broll", "seg": "reports", "a": [(58.30, 59.58), (60.16, 67.45)]},
  {"k": "face",  "a": [(67.75, 72.52)], "z": 1.10},
  {"k": "face",  "a": [(73.66, 74.32), (74.98, 76.22)], "z": 1.00},
  {"k": "face",  "a": [(77.45, 79.48)], "z": 1.10},
  {"k": "end",   "seg": "end", "a": [(79.80, 81.66)], "hold": 1.30, "nocap": True},
]
t = 0
for p in P:
    p["a"] = [(s, s + fr(e - s) / FPS) for s, e in p["a"]]
    p["n"] = sum(fr(e - s) for s, e in p["a"]) + fr(p.get("hold", 0))
    p["t"] = t; t += p["n"] / FPS
TOTAL = sum(p["n"] for p in P)
print(f"pieces {len(P)}, {TOTAL} frames = {TOTAL / FPS:.2f}s")

# ── Video ──
os.makedirs(f"{D}/pieces", exist_ok=True); os.makedirs(f"{D}/frames", exist_ok=True)
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", str(FPS)]
SCRIM = f"{D}/scrim.png"
if not os.path.exists(SCRIM):
    from PIL import Image
    yy = np.arange(1920, dtype=np.float32); xx = np.clip((yy - 1050) / (1600 - 1050), 0, 1)
    al = (xx * xx * (3 - 2 * xx)) * 0.62
    im = np.zeros((1920, 1080, 4), np.uint8); im[..., 3] = (al[:, None] * 255).astype(np.uint8); Image.fromarray(im, "RGBA").save(SCRIM)

def render_broll(name, seg, n):
    fdir = f"{D}/frames/{name}"
    if len(glob.glob(f"{fdir}/f*.jpg")) != n:
        shutil.rmtree(fdir, ignore_errors=True)
        subprocess.run(["node", f"{BR}/rend.cjs", seg, f"{n / FPS:.4f}", fdir, "0", "0"], check=True, capture_output=True)
    got = len(glob.glob(f"{fdir}/f*.jpg")); assert got == n, (name, got, n)
    return fdir

LOOK = "eq=brightness=0.03:contrast=1.06:saturation=1.06"
def face_part(out, s, n, z):
    w, h = 1080 / z, 1920 / z; x = (1080 - w) / 2; y = min(max(0.42 * 1920 - h / 2, 0), 1920 - h)
    vf = f"fps={FPS},scale=1080:1920:flags=lanczos,crop={w:.0f}:{h:.0f}:{x:.0f}:{y:.0f},scale=1080:1920:flags=lanczos,setsar=1,{LOOK}"
    run("-ss", f"{s:.3f}", "-i", SRC, "-i", SCRIM, "-frames:v", str(n),
        "-filter_complex", f"[0:v]{vf}[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p", "-an", *ENC, out)

def make_piece(i, p):
    out = f"{D}/pieces/p{i:02d}.mp4"
    if os.path.exists(out): return out
    if p["k"] == "face":
        parts = []
        for j, (s, e) in enumerate(p["a"]):
            part = f"{D}/pieces/p{i:02d}-{j}.mp4"; face_part(part, s, fr(e - s), p["z"]); parts.append(part)
        if len(parts) == 1: os.rename(parts[0], out)
        else:
            lst = f"{D}/pieces/p{i:02d}.txt"; open(lst, "w").write("".join(f"file '{x}'\n" for x in parts))
            run("-f", "concat", "-safe", "0", "-i", lst, *ENC, out)
    else:
        fdir = render_broll(f"p{i:02d}-{p['seg']}", p["seg"], p["n"])
        run("-framerate", str(FPS), "-i", f"{fdir}/f%04d.jpg", "-frames:v", str(p["n"]), *ENC, out)
    return out

with ThreadPoolExecutor(3) as ex:
    outs = list(ex.map(lambda ip: make_piece(*ip), enumerate(P)))
open(f"{D}/pieces/all.txt", "w").write("".join(f"file '{o}'\n" for o in outs))

# ── Audio: his voice, gently cleaned, 8 ms fades at every cut, -14 LUFS stereo ──
os.makedirs(f"{D}/aud", exist_ok=True)
VOICE = "highpass=f=80,afftdn=nr=8:nf=-50,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=2,acompressor=threshold=0.08:ratio=2.8:attack=6:release=110:makeup=1.6"
VW = f"{D}/aud/voice.wav"
if not os.path.exists(VW): run("-i", SRC, "-map", "0:a:0", "-af", VOICE, "-ac", "1", "-ar", str(SR), VW)
V = sf.read(VW)[0]
mix = np.zeros(int(round(TOTAL / FPS * SR)) + SR, dtype=np.float64)
for p in P:
    off = p["t"]
    for s, e in p["a"]:
        x = V[int(round(s * SR)):int(round(e * SR))].copy(); f = int(0.008 * SR)
        x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
        i = int(round(off * SR)); mix[i:i + len(x)] += x; off += e - s
mix = mix[:int(round(TOTAL / FPS * SR))]
sf.write(f"{D}/aud/mix_raw.wav", mix.astype(np.float32), SR)
ST = "pan=stereo|c0=c0|c1=c0"
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{D}/aud/mix_raw.wav", "-af", f"{ST},loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
run("-i", f"{D}/aud/mix_raw.wav", "-af", f"{ST},loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true", "-ar", str(SR), f"{D}/aud/mix.wav")

# ── Captions ──
def snap(s, e=None):   # whisper starts words early: move a start sitting in silence to where the voice actually starts
    k = int(round(s * 100))
    if k < len(DB) and DB[k] < THR:
        for q in range(k, min(k + 80, len(DB))):
            if DB[q] >= THR: return q / 100 - 0.03
    # A word stretched across a pause ("and" drawn back over the silence before it): it starts after the pause.
    if e is not None:
        ke = min(int(round(e * 100)), len(DB) - 1)
        for q in range(ke, k + 25, -1):          # the last voice onset inside the word, after a mostly quiet stretch
            if DB[q] >= THR and DB[q - 1] < THR and np.mean(DB[q - 25:q] < THR) >= 0.8:
                return q / 100 - 0.03
    return s
words = []
for w in W:
    txt = w["w"].strip()
    if txt in (".com.", ".com") and words: words[-1]["e"] = w["e"]; words[-1]["w"] = "boldlinemedia.com"; continue
    words.append({"w": txt, "s": snap(w["s"], w["e"]), "e": w["e"]})
cap_words = []
for pi, p in enumerate(P):
    if p.get("nocap"): continue
    off = p["t"]
    for s, e in p["a"]:
        for w in words:
            mid = (w["s"] + w["e"]) / 2
            if s <= mid < e: cap_words.append((off + max(w["s"], s) - s, off + min(w["e"], e) - s, w["w"], "him", f"P{pi}", pi))
        off += e - s
cap_words.sort()
from PIL import ImageFont
FS = 72
FONT = ImageFont.truetype(f"{D}/fonts_cap/Inter-700.ttf", round(FS / 1.21))
MAXW = 860
textw = lambda t: FONT.getlength(t)
CHUNKS = {
  "P0": "My agency / *almost runs itself*",
  "P1": "For those of you / who don't know / I'm Bryson / I run a marketing agency / called *BoldLine Media*",
  "P2": "Now / let me explain / what I mean",
  "P3": "It literally / *almost runs itself* / I built a system",
  "P4": "Now most of you guys / are thinking / you did that / to *cut corners* / right? / *No*",
  "P5": "I did it so my clients / get the results *faster* / and without the risk / of *human error*",
  "P6": "But Bryson / isn't that / a little bit risky? / Yes / that's why there's / still *human involved*",
  "P7": "Every time my system / finishes up a task / it sends it to me / for me to *review*",
  "P8": "and then from there / I send it to my client / That way my client / can see what is going on / where their *money* is going / and they can *approve it*",
  "P9": "That way there's / *constant communication* / and the client knows / what's going on / They stay *updated*",
  "P10": "Same thing / with *reports* / My system comes up / with the reports / taking the data / straight from / the *live sources* / and then sends it / to me and to the client",
  "P11": "That way everyone's / *in the loop* / and there's no / missing information / or human error",
  "P12": "Best part / clients only pay / for *results*",
  "P13": "If you want / something like this / working for your business",
}
def parse(spec):
    out = []
    for c in spec.split(" / "):
        ws, on = [], False
        for tk in c.split():
            if tk.startswith("*"): on = True
            ws.append((tk.strip("*"), on))
            if tk.endswith("*"): on = False
        out.append(ws)
    return out
norm = lambda x: re.sub(r"[^a-z0-9']", "", x.lower().replace("’", "'"))
by_src = {}
for w in cap_words: by_src.setdefault(w[4], []).append(w)
groups = []
for src, ws in by_src.items():
    toks = parse(CHUNKS[src]); flat = [norm(x) for c in toks for x, _ in c]
    heard = [norm(w[2]) for w in ws]
    if flat != heard:
        print("MISMATCH", src, "\n  spec:", flat, "\n  heard:", heard); sys.exit(1)
    i = 0
    for c in toks:
        chunk = list(zip(ws[i:i + len(c)], c)); i += len(c)
        groups.append({"w": [(w[0], w[1], w[2].rstrip(",."), key) for w, (_, key) in chunk]})
        if textw(" ".join(w[2].rstrip(",.") for w, _ in chunk)) + 40 > MAXW: print("caption too wide:", " ".join(w[2] for w, _ in chunk))
groups.sort(key=lambda g: g["w"][0][0])
def ts(x):
    x = max(0, x); h = int(x // 3600); m_ = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m_:02d}:{s:05.2f}"
WHITE, GOLD = "&HFFFFFF&", "&H7AD2F0&"
VIS, HID = "\\1a&H00&\\3a&H88&\\4a&H70&", "\\1a&HFF&\\3a&HFF&\\4a&HFF&"
CX, CY, RISE, RISE_T, FADE_IN = 540, 1430, 14, 0.18, 120
ev = []
for gi, g in enumerate(groups):
    last = g["w"][-1][1]; nxt = groups[gi + 1]["w"][0][0] if gi + 1 < len(groups) else None
    joined = nxt is not None and nxt - last < 0.35
    g_end = nxt if joined else (min(last + 0.28, nxt) if nxt is not None else last + 0.28)
    n = len(g["w"]); t0 = g["w"][0][0]
    for k in range(n):
        a = g["w"][k][0]; b = g["w"][k + 1][0] if k + 1 < n else g_end
        if b - a < 0.02: continue
        parts = []
        for q, (_, _, txt, key) in enumerate(g["w"]):
            col = GOLD if key else WHITE
            if q < k: parts.append(f"{{{VIS}\\c{col}}}{txt}")
            elif q == k: parts.append(f"{{{HID}\\c{col}\\t(0,{FADE_IN},{VIS})}}{txt}")
            else: parts.append(f"{{{HID}\\c{col}}}{txt}")
        dt = a - t0
        place = (f"\\move({CX},{CY + RISE * (1 - dt / RISE_T):.1f},{CX},{CY},0,{round((RISE_T - dt) * 1000)})" if dt < RISE_T else f"\\pos({CX},{CY})")
        fade = "\\fad(0,110)" if k == n - 1 and not joined else ""
        ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\an5{place}\\blur1.2\\xshad0\\yshad3{fade}}}" + " ".join(parts))
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment
Style: Cap,Inter,{FS},&H00FFFFFF,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,-0.5,0,1,1.6,3,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
open(f"{D}/captions.ass", "w").write(ass)

# ── Final ──
NOCAP = f"{D}/nocap.mp4"
if not os.path.exists(NOCAP) or os.path.getmtime(NOCAP) < max(os.path.getmtime(o) for o in outs):
    run("-f", "concat", "-safe", "0", "-i", f"{D}/pieces/all.txt", "-frames:v", str(TOTAL), *ENC[:4], "-crf", "14", "-pix_fmt", "yuv420p", "-r", str(FPS), NOCAP)
if os.environ.get("CAPS_ONLY"): sys.exit(0)
run("-i", NOCAP, "-i", f"{D}/aud/mix.wav",
    "-filter_complex", f"[0:v]ass={D}/captions.ass:fontsdir={D}/fonts_cap,format=yuv420p[v];[1:a]aresample=44100[a]",
    "-map", "[v]", "-map", "[a]", "-frames:v", str(TOTAL), "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-r", str(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", OUT)
print("wrote", OUT, f"{TOTAL / FPS:.2f}s")
