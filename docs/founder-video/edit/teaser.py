# Instagram story teaser for "How our automations help clients" (2026-11-10): his hook line (captioned, with sound),
# three quick flashes of the screens from the video, then a "new video coming" card with room for a countdown sticker.
# Story safe zone: keep text between y=270 and y=1600 (Instagram's own bars cover the top and bottom).
import subprocess, os
SP = "/tmp/claude-0/-home-user-boldline-os/2dbaa2ea-f845-5f5d-a6f7-2b3c80378394/scratchpad/fv3"
C = f"{SP}/cut"; T = f"{SP}/teaser"; os.makedirs(T, exist_ok=True)
FINAL, NOCAP = f"{C}/How our automations help clients.mp4", f"{C}/nocap.mp4"
OUT = f"{SP}/Story preview - How our automations help clients.mp4"
run = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30"]
HOOK, FLASH, CARD = 1.90, 0.80, 4.30

# 1. The hook, from the finished video (captions and his voice included).
run("-i", FINAL, "-t", f"{HOOK}", *ENC, "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", f"{T}/a.mp4")
# 2. Three flashes from the uncaptioned master, each with a gentle push-in.
for i, at in enumerate([27.2, 33.5, 46.6]):
    run("-ss", f"{at}", "-i", NOCAP, "-t", f"{FLASH}", "-vf", "scale=1188:2112,zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30", "-an", *ENC, f"{T}/f{i}.mp4")
# 3. The card: a blurred, darkened frame of him, with the words on top.
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment
Style: K,Inter,40,&H007AD2F0,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,9,0,1,0,0,5,40,40,40,1
Style: H,Inter,104,&H00FFFFFF,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,-1.5,0,1,1.4,3,5,40,40,40,1
Style: S,Inter,50,&H00D9DCE1,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,0,0,1,1.2,2,5,40,40,40,1
Style: G,Inter,62,&H007AD2F0,&H00FFFFFF,&H88000000,&H70000000,-1,0,0,0,100,100,0,0,1,1.2,2,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.10,0:00:09.00,K,,0,0,0,,{\\an5\\pos(540,640)\\fad(250,0)}NEW VIDEO
Dialogue: 0,0:00:00.25,0:00:09.00,H,,0,0,0,,{\\an5\\move(540,800,540,780,0,350)\\fad(300,0)}My agency almost
Dialogue: 0,0:00:00.40,0:00:09.00,H,,0,0,0,,{\\an5\\move(540,925,540,905,0,350)\\fad(300,0)}runs itself.
Dialogue: 0,0:00:00.85,0:00:09.00,S,,0,0,0,,{\\an5\\pos(540,1060)\\fad(300,0)}Here's how it works for my clients.
Dialogue: 0,0:00:01.30,0:00:09.00,G,,0,0,0,,{\\an5\\move(540,1215,540,1200,0,300)\\fad(300,0)}Coming soon
"""
open(f"{T}/card.ass", "w").write(ass)
run("-ss", "40.0", "-i", NOCAP, "-frames:v", "1", f"{T}/bg.png")
run("-loop", "1", "-i", f"{T}/bg.png", "-t", f"{CARD}",
    "-vf", f"gblur=sigma=38,eq=brightness=-0.22:saturation=0.8,ass={T}/card.ass:fontsdir={C}/fonts_cap,fade=t=in:st=0:d=0.25", "-an", *ENC, f"{T}/c.mp4")
# 4. Join: picture in order; his voice on the hook, quiet after (they add music in the app if they want).
lst = f"{T}/list.txt"; open(lst, "w").write("".join(f"file '{T}/{x}.mp4'\n" for x in ["a", "f0", "f1", "f2", "c"]))
run("-f", "concat", "-safe", "0", "-i", lst, "-an", *ENC, f"{T}/v.mp4")
total = HOOK + 3 * FLASH + CARD
run("-i", f"{T}/v.mp4", "-i", f"{T}/a.mp4", "-filter_complex", f"[1:a]afade=t=out:st={HOOK - 0.15}:d=0.15,apad=whole_dur={total}[a]",
    "-map", "0:v", "-map", "[a]", "-t", f"{total}", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", OUT)
print("wrote", OUT, f"{total:.2f}s")
