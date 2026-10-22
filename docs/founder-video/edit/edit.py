# Founder video, final cut: Bryson's clips + OS B-roll + ARIA's three lines + word-by-word captions.
# Run with the cbenv python (numpy, soundfile, pyloudnorm). Steps are cached; delete a piece to redo it.
# CAPS_ONLY=1 rebuilds the captions and the uncaptioned master (nocap.mp4) without the final encode, for test frames:
#   ffmpeg -ss T -i nocap.mp4 -vf "setpts=PTS+T/TB,ass=captions.ass:fontsdir=fonts" -frames:v 1 test.png
# Paths (SP, the uploads folder in prep.py) are this session's scratchpad: a new session points them at its own.
import json, os, re, subprocess, glob, shutil, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
from concurrent.futures import ThreadPoolExecutor

SP = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"
D = f"{SP}/fv/cut"; BR = f"{SP}/fv/broll"
FF = glob.glob(f"{SP}/tools/py/imageio_ffmpeg/binaries/ffmpeg-linux*")[0]
FPS, SR = 30, 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{D}/founder-video.mp4"
run = lambda *a: subprocess.run([FF, "-v", "error", "-y", *a], check=True)
fr = lambda s: int(round(s * FPS))

W = json.load(open(f"{D}/words.json")); B = json.load(open(f"{D}/bounds.json")); AW = json.load(open(f"{D}/aria/words.json"))

# ── The edit. Times are seconds inside each line's clip. ─────────────────────────────────────────────────────────────
# face: Bryson on camera (zoom alternates so a cut between takes reads as intentional)
# broll: an OS clip over his voice     montage: three quick OS flashes over one phrase     aria: her line over a clip
P = [
  {"k": "aria",  "seg": "hook", "aria": "greet", "at": 0.25, "dur": 3.40},
  {"k": "face",  "L": "L01", "a": [(0.57, 5.58)], "z": 1.00},
  {"k": "face",  "L": "L02", "a": [(0.54, 4.52)], "z": 1.10},
  {"k": "face",  "L": "L02", "a": [(4.73, 7.28)], "z": 1.00},
  {"k": "face",  "L": "L03", "a": [(0.47, 3.02)], "z": 1.10},
  {"k": "montage", "L": "L03", "a": [(3.22, 5.03)], "parts": [("leadscout", 2.6, 4.0), ("contract", 2.5, 4.0), ("leads", 2.2, 4.0)]},
  {"k": "broll", "seg": "demo",  "L": "L05", "a": [(0.70, 4.02), (4.38, 6.87)]},
  {"k": "broll", "seg": "build", "L": "L07", "a": [(0.71, 5.84)]},
  {"k": "face",  "L": "L07", "a": [(6.05, 7.18)], "z": 1.12},
  {"k": "broll", "seg": "results", "L": "L09", "a": [(0.50, 5.75)]},
  {"k": "face",  "L": "L09", "a": [(6.24, 8.29)], "z": 1.00},
  {"k": "face",  "L": "L10", "a": [(0.85, 2.36)], "z": 1.10},
  {"k": "aria",  "seg": "aria", "aria": "intro", "at": 0.25, "dur": 5.75},
  {"k": "face",  "L": "L11", "a": [(0.90, 2.85)], "z": 1.00},
  {"k": "aria",  "seg": "powerhour", "aria": "power", "at": 0.60, "dur": 4.25, "t0": 0.9},
  {"k": "broll", "seg": "today", "L": "L12", "a": [(0.56, 4.91)]},
  {"k": "face",  "L": "L13", "a": [(0.94, 2.02)], "z": 1.00},
  {"k": "face",  "L": "L13", "a": [(2.20, 6.86)], "z": 1.12},
  {"k": "face",  "L": "L13", "a": [(7.10, 10.70)], "z": 1.00},
  {"k": "face",  "L": "L14", "a": [(0.88, 3.68)], "z": 1.10},
  {"k": "end",   "seg": "end", "L": "L14", "a": [(3.93, 5.71)], "hold": 1.30, "nocap": True},
]

# Frame-exact lengths: every piece is a whole number of frames, and its audio is trimmed to match.
t = 0
for p in P:
    if "a" in p:
        p["a"] = [(s, s + fr(e - s) / FPS) for s, e in p["a"]]
        p["n"] = sum(fr(e - s) for s, e in p["a"]) + fr(p.get("hold", 0))
    else:
        p["n"] = fr(p["dur"])
    p["t"] = t; t += p["n"] / FPS
TOTAL = sum(p["n"] for p in P)
print(f"pieces {len(P)}, {TOTAL} frames = {TOTAL / FPS:.2f}s")

# ── Video pieces ─────────────────────────────────────────────────────────────────────────────────────────────────────
os.makedirs(f"{D}/pieces", exist_ok=True); os.makedirs(f"{D}/frames", exist_ok=True)
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", str(FPS)]

def render_broll(name, seg, n, t0=0.0, page_dur=None):
    fdir = f"{D}/frames/{name}"
    if len(glob.glob(f"{fdir}/f*.jpg")) != n:
        shutil.rmtree(fdir, ignore_errors=True)
        args = ["node", f"{BR}/rend.cjs", seg, f"{n / FPS:.4f}", fdir, str(t0), "0"] + ([str(page_dur)] if page_dur else [])
        subprocess.run(args, check=True, capture_output=True)
    got = len(glob.glob(f"{fdir}/f*.jpg")); assert got == n, (name, got, n)
    return fdir

def frames_to_mp4(fdir, out, n):
    run("-framerate", str(FPS), "-i", f"{fdir}/f%04d.jpg", "-frames:v", str(n), *ENC, out)

SCRIM = f"{D}/scrim.png"
if not os.path.exists(SCRIM):
    from PIL import Image
    yy = np.arange(1920, dtype=np.float32); xx = np.clip((yy - 1050) / (1600 - 1050), 0, 1)
    al = (xx * xx * (3 - 2 * xx)) * 0.62                    # smoothstep to 62% black by the bottom sixth
    im = np.zeros((1920, 1080, 4), np.uint8); im[..., 3] = (al[:, None] * 255).astype(np.uint8); Image.fromarray(im, "RGBA").save(SCRIM)

def make_piece(i, p):
    out = f"{D}/pieces/p{i:02d}.mp4"
    if os.path.exists(out): return out
    if p["k"] == "face":
        (s, e), = p["a"]; z = p["z"]
        w, h = 1080 / z, 1920 / z; x = (1080 - w) / 2; y = min(max(0.42 * 1920 - h / 2, 0), 1920 - h)
        vf = f"crop={w:.0f}:{h:.0f}:{x:.0f}:{y:.0f},scale=1080:1920:flags=lanczos,setsar=1"
        run("-ss", f"{s:.3f}", "-i", f"{D}/lines/{p['L']}.mov", "-i", SCRIM, "-frames:v", str(p["n"]),
            "-filter_complex", f"[0:v]{vf}[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p", "-an", *ENC, out)
    elif p["k"] == "montage":
        parts = []; per = [p["n"] // 3 + (1 if j < p["n"] % 3 else 0) for j in range(3)]
        for j, ((seg, t0, pd), m) in enumerate(zip(p["parts"], per)):
            fdir = render_broll(f"p{i:02d}-{seg}", seg, m, t0, pd); part = f"{D}/pieces/p{i:02d}-{j}.mp4"
            frames_to_mp4(fdir, part, m); parts.append(part)
        lst = f"{D}/pieces/p{i:02d}.txt"; open(lst, "w").write("".join(f"file '{x}'\n" for x in parts))
        run("-f", "concat", "-safe", "0", "-i", lst, *ENC, out)
    else:
        fdir = render_broll(f"p{i:02d}-{p['seg']}", p["seg"], p["n"], p.get("t0", 0.0), (p.get("t0", 0.0) + p["n"] / FPS) if p.get("t0") else None)
        frames_to_mp4(fdir, out, p["n"])
    return out

with ThreadPoolExecutor(3) as ex:
    outs = list(ex.map(lambda ip: make_piece(*ip), enumerate(P)))
open(f"{D}/pieces/all.txt", "w").write("".join(f"file '{o}'\n" for o in outs))

# ── Audio ────────────────────────────────────────────────────────────────────────────────────────────────────────────
# His voice: gentle clean-up (rumble off, light denoise, a touch of presence, even level). ARIA matched to his loudness.
os.makedirs(f"{D}/aud", exist_ok=True)
VOICE = "highpass=f=80,afftdn=nr=8:nf=-50,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=2,acompressor=threshold=0.08:ratio=2.8:attack=6:release=110:makeup=1.6"
def voice(L):
    f = f"{D}/aud/{L}.wav"
    if not os.path.exists(f): run("-i", f"{D}/lines/{L}.mov", "-af", VOICE, "-ac", "1", "-ar", str(SR), f)
    return sf.read(f)[0]
V = {L: voice(L) for L in sorted({p["L"] for p in P if "L" in p})}
A = {k: sf.read(f"{D}/aria/{k}.wav")[0] for k in ["greet", "intro", "power"]}
meter = pyln.Meter(SR)
mix = np.zeros(int(round(TOTAL / FPS * SR)) + SR, dtype=np.float64)
def place(x, at):
    i = int(round(at * SR)); fade = int(0.008 * SR); x = x.copy()
    x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    mix[i:i + len(x)] += x
his = []
for p in P:
    off = p["t"]
    for s, e in p.get("a", []):
        x = V[p["L"]][int(round(s * SR)):int(round(e * SR))]; place(x, off); his.append(x); off += e - s
his_lufs = meter.integrated_loudness(np.concatenate(his))
for p in P:
    if p["k"] == "aria":
        x = A[p["aria"]]; g = 10 ** ((his_lufs - 0.5 - meter.integrated_loudness(x)) / 20)
        place(x * g, p["t"] + p["at"])
mix = mix[:int(round(TOTAL / FPS * SR))]
sf.write(f"{D}/aud/mix_raw.wav", mix.astype(np.float32), SR)
# Two-pass loudness to -14 LUFS (TikTok / Reels level), true peak -1 dB.
ST = "pan=stereo|c0=c0|c1=c0"   # measure what people hear: dual-mono stereo reads 3 dB louder than the mono mix
m = subprocess.run([FF, "-hide_banner", "-i", f"{D}/aud/mix_raw.wav", "-af", f"{ST},loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
run("-i", f"{D}/aud/mix_raw.wav", "-af", f"{ST},loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample={SR}", "-ac", "2", f"{D}/aud/mix.wav")

# ── Captions ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def fixed_words(L):
    ws = [dict(w) for w in W[L]]; on = B[L]["on"]
    if ws and ws[0]["s"] < on - 0.1: ws[0]["s"] = on - 0.05
    for g0, g1 in B[L]["gaps"]:
        for w in ws:
            if w["s"] < g1 - 0.08 and w["e"] > g1 + 0.02 and w["s"] >= g0 - 0.3: w["s"] = g1 - 0.04
    return ws
def clean(L, ws):
    out = []
    for w in ws:
        txt = w["w"].strip()
        if txt in (".com.", ".com"):                                # whisper split boldlinemedia | .com
            if out: out[-1]["e"] = w["e"]
            continue
        if txt.lower().startswith("work") and out and out[-1]["w"].lower().startswith("busy"): out[-1]["e"] = w["e"]; out[-1]["w"] = "busywork."; continue
        if txt.rstrip(".,").lower() == "boldlinemedia": txt = "boldlinemedia.com"
        if txt.rstrip(".,") == "Aria": txt = txt.replace("Aria", "ARIA")
        if L == "L11" and not out and txt.startswith("ARIA"):
            mid = w["s"] + (w["e"] - w["s"]) * 0.32
            out += [{**w, "w": "Hey", "e": mid}, {**w, "w": "ARIA,", "s": mid}]; continue
        if L == "L11" and txt == "Start": txt = "start"
        out.append({**w, "w": txt})
    return out
cap_words = []   # (start, end, text, who, source, piece) on the timeline
for pi, p in enumerate(P):
    if p.get("nocap"): continue
    if "a" in p:
        ws = clean(p["L"], fixed_words(p["L"])); off = p["t"]
        for s, e in p["a"]:
            for w in ws:
                mid = (w["s"] + w["e"]) / 2
                if s <= mid < e: cap_words.append((off + max(w["s"], s) - s, off + min(w["e"], e) - s, w["w"], "him", p["L"], pi))
            off += e - s
    if p["k"] == "aria":
        for w in clean("", AW[p["aria"]]["words"]):
            cap_words.append((p["t"] + p["at"] + w["s"], p["t"] + p["at"] + w["e"], w["w"], "aria", "aria:" + p["aria"], pi))
cap_words.sort()
# ── How the captions look ──
# Bryson, 2026-10-22: "make the captions cleaner and more aesthetic right now they are ugly" (they sat in dark pills).
# Now there is no box: Inter Bold, white, a few key words in gold, a fine soft edge and a gentle drop shadow. Words
# appear as they are said (a quick fade), each phrase rises in softly and fades out when he pauses. The picture gives
# the contrast instead of a box: face shots carry a soft dark fade at the bottom of the frame (scrim.png), and the
# phone screens fade out at the bottom (broll.html .capfade), so the words always sit on a quiet dark band.
# ARIA's words are gold all the way through, so her voice reads as hers.
from PIL import ImageFont
FS = 72                                              # caption size (ASS units: Inter's line height, about 1.21 em)
FONT = ImageFont.truetype(f"{D}/fonts_cap/Inter-700.ttf", round(FS / 1.21))
MAXW = 860                                           # widest a caption line may be (clear of TikTok's buttons)
textw = lambda t: FONT.getlength(t)
phrases = []
for w in cap_words:
    ph = phrases[-1] if phrases else None
    if ph is None or ph["who"] != w[3] or ph["stop"] or w[0] - ph["w"][-1][1] > 0.3 or ph["pi"] != w[5]:
        ph = {"who": w[3], "w": [], "stop": False, "pi": w[5]}; phrases.append(ph)
    ph["w"].append((w[0], w[1], w[2].rstrip(",."), False)); ph["stop"] = w[2].endswith((",", ".", "?", "!"))
WEAK = {"a", "an", "the", "to", "of", "and", "my", "their", "your", "in", "on", "for", "i", "i'm", "so", "with", "that", "what", "is", "at", "it", "can", "get", "they"}
def split_phrase(ws):
    # Fallback only. Additive cost, so a dynamic programme finds the best split in linear time.
    n = len(ws); memo = {n: (0.0, [])}
    def part_cost(a, b):
        w = textw(" ".join(x[2] for x in ws[a:b])) + 40
        c = 3.0 + abs(w - 560) / 400
        if w > MAXW and b - a > 1: c += 1000
        if b - a == 1 and n > 1: c += 4
        if b < n and ws[b - 1][2].lower() in WEAK: c += 6
        return c
    for i in range(n - 1, -1, -1):
        memo[i] = min(((part_cost(i, i + k) + memo[i + k][0], [(i, i + k)] + memo[i + k][1]) for k in (1, 2, 3, 4) if i + k <= n), key=lambda x: x[0])
    return [ws[a:b] for a, b in memo[0][1]]
# How each line breaks on screen, picked by hand so every caption is a natural phrase. *Stars* mark the few words shown
# in gold. Each source's words must match what was heard, word for word, or it falls back to the automatic split.
CHUNKS = {
  "aria:greet": "Good morning Bryson / Everything's ready / when you are",
  "L01": "I'm Bryson / I run *BoldLine Media* / a marketing agency / and I *automated* / almost all of it",
  "L02": "Not to cut corners / I did it so my clients / get what they paid for / *faster* / without the *mistakes* / that come from / doing it by hand",
  "L03": "My job is making calls / and *closing deals* / Everything else / *the system* handles",
  "L05": "Before I even / get on a call / it can build / that business / a *full website* / so instead of explaining / what I do / I can just *show them*",
  "L07": "Then it builds their ads / on *Google* and *Meta* / plus the *landing pages* / those ads send people to / I just *approve* them",
  "L09": "My clients can check / the *results anytime* / in their own portal / and they get updates / without having to ask / so they always know / *where things stand*",
  "L10": "And then there's *ARIA*",
  "aria:intro": "Hi I'm ARIA / I work alongside Bryson / every day / so nothing slips through",
  "L11": "Hey ARIA / start *Power Hour*",
  "aria:power": "Power Hour is live / First call is up / Let's go",
  "L12": "She *plans my day* / and runs my / calling sessions / and I just *talk to her*",
  "L13": "That's the *whole point* / My clients get / the results *faster* / and they're never left / wondering what's going on / And my time goes / towards talking / to *business owners* / not busywork",
  "L14": "If you want / *a system like this* / working for your business",
}
def parse(spec):
    out = []
    for c in spec.split(" / "):
        words, on = [], False
        for t in c.split():
            if t.startswith("*"): on = True
            words.append((t.strip("*"), on))
            if t.endswith("*"): on = False
        out.append(words)
    return out
norm = lambda t: re.sub(r"[^a-z0-9']", "", t.lower().replace("’", "'"))
by_src = {}
for w in cap_words: by_src.setdefault(w[4], []).append(w)
groups = []
for src, ws in by_src.items():
    spec = CHUNKS.get(src)
    if spec:
        toks = parse(spec)
        flat = [norm(t) for c in toks for t, _ in c]
        if flat == [norm(w[2]) for w in ws]:
            i = 0; chunks = []
            for c in toks: chunks.append([(w, key) for w, (_, key) in zip(ws[i:i + len(c)], c)]); i += len(c)
            if all(len({w[5] for w, _ in c}) == 1 for c in chunks):
                for c in chunks:
                    groups.append({"who": c[0][0][3], "w": [(w[0], w[1], w[2].rstrip(",."), key) for w, key in c]})
                    if textw(" ".join(w[2].rstrip(",.") for w, _ in c)) + 40 > MAXW: print("caption too wide:", " ".join(w[2] for w, _ in c))
                continue
            print("caption chunk spans a cut, falling back:", src)
        else:
            print("caption chunks do not match the words heard, falling back:", src, flat, [norm(w[2]) for w in ws])
    for ph in phrases:
        if ph["w"] and ph["w"][0][0] >= ws[0][0] - 1e-6 and ph["w"][-1][1] <= ws[-1][1] + 1e-6:
            groups += [{"who": ph["who"], "w": c} for c in split_phrase(ph["w"])]
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
    aria = g["who"] == "aria"; n = len(g["w"]); t0 = g["w"][0][0]
    for k in range(n):
        a = g["w"][k][0]; b = g["w"][k + 1][0] if k + 1 < n else g_end
        if b - a < 0.02: continue
        parts = []
        for q, (_, _, txt, key) in enumerate(g["w"]):
            col = GOLD if (aria or key) else WHITE
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
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter,{FS},&H00FFFFFF,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,-0.5,0,1,1.6,3,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
open(f"{D}/captions.ass", "w").write(ass)
json.dump({"pieces": [{k: v for k, v in p.items()} for p in P], "groups": [[g["who"], " ".join(x[2] for x in g["w"]), g["w"][0][0]] for g in groups]}, open(f"{D}/edit.json", "w"), indent=1, default=str)

# ── Final ────────────────────────────────────────────────────────────────────────────────────────────────────────────
# One uncaptioned master first (also what caption test frames are cut from), then captions + sound on top.
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
