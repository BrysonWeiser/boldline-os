from PIL import Image, ImageDraw, ImageFont

SRC = "/home/user/boldline-os/marketing-site/logo.png"
import os
OUT = os.path.dirname(os.path.abspath(__file__)) + "/"
BG   = (7, 8, 16)          # #070810 site bg
GOLD = (200, 168, 75)      # #C8A84B
TEXT = (240, 242, 255)
DIM  = (139, 145, 184)
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SANS_R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

def mark(h):
    """Gold BP mark, transparent bg, scaled to height h."""
    im = Image.open(SRC).convert("RGBA")
    bbox = im.getbbox()
    im = im.crop(bbox)
    w = round(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)

def tracked(d, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track
    return x - track

def tracked_w(d, text, font, track):
    return sum(d.textlength(c, font=font) for c in text) + track * (len(text) - 1)

# ---------- 1. Company logo 400x400 ----------
L = 400
im = Image.new("RGB", (L, L), BG)
m = mark(round(L * 0.52))
im.paste(m, ((L - m.width) // 2, (L - m.height) // 2), m)
im.save(OUT + "linkedin-logo.png")

# ---------- 2. Company cover 1128x191 ----------
W, H = 1128, 191
im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)
f_word = ImageFont.truetype(SANS_B, 34)
f_tag  = ImageFont.truetype(SANS_R, 21)
m = mark(58)
word, track = "BOLDLINE MEDIA", 5.5
tag = "Google & Meta Ads  +  High-Converting Landing Pages"
gap = 20
block_w = m.width + gap + tracked_w(d, word, f_word, track)
x0 = (W - block_w) / 2
y_mid = H / 2 - 20
im.paste(m, (round(x0), round(y_mid - m.height / 2)), m)
tracked(d, (x0 + m.width + gap, y_mid - 21), word, f_word, TEXT, track)
tw = tracked_w(d, tag, f_tag, 1.2)
tracked(d, ((W - tw) / 2, y_mid + 34), tag, f_tag, DIM, 1.2)
d.line([(W / 2 - 34, y_mid + 24), (W / 2 + 34, y_mid + 24)], fill=GOLD, width=2)
im.save(OUT + "linkedin-cover-company.png")

for f in ["linkedin-logo.png", "linkedin-cover-company.png"]:
    print(f, Image.open(OUT + f).size)
