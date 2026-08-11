from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC  = "/home/user/boldline-os/marketing-site/logo.png"
import os
OUT = os.path.dirname(os.path.abspath(__file__)) + "/"
BG   = (7, 8, 16)
GOLD = (200, 168, 75)
TEXT = (240, 242, 255)
DIM  = (139, 145, 184)
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SANS_R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
W, H = 1584, 396

def mark(h):
    im = Image.open(SRC).convert("RGBA").crop(Image.open(SRC).convert("RGBA").getbbox())
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)

def tracked(d, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track

# background + soft gold glow behind the text block (upper right)
im = Image.new("RGB", (W, H), BG)
gd = ImageDraw.Draw(im)
for i in range(130, 0, -1):
    r = i * 5.0
    a = (i / 130) ** 2.2 * 0.10
    c = tuple(round(BG[k] + (GOLD[k] - BG[k]) * a) for k in range(3))
    gd.ellipse([W * 0.68 - r, H * 0.05 - r, W * 0.68 + r, H * 0.05 + r], fill=c)
im = im.filter(ImageFilter.GaussianBlur(75))
d = ImageDraw.Draw(im)

f_eyebrow = ImageFont.truetype(SANS_B, 25)
f_head    = ImageFont.truetype(SANS_B, 55)
f_url     = ImageFont.truetype(SANS_R, 25)

X = 520              # clear of the profile photo (bottom-left overlay)
m = mark(40)
im.paste(m, (X, 84), m)
tracked(d, (X + m.width + 16, 89), "BOLDLINE MEDIA", f_eyebrow, GOLD, 5.5)

d.text((X, 148), "Google & Meta Ads + Landing Pages", font=f_head, fill=TEXT)
d.text((X, 212), "that turn clicks into customers.", font=f_head, fill=TEXT)

d.line([(X, 296), (X + 70, 296)], fill=GOLD, width=2)
d.text((X, 316), "boldlinemedia.com", font=f_url, fill=DIM)

im.save(OUT + "linkedin-banner-personal.png")
print("ok", Image.open(OUT + "linkedin-banner-personal.png").size)
