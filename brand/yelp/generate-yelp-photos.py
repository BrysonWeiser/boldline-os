"""Square brand cards for listing profiles (Yelp / Google Business / Bing).

Why square-with-a-safe-band: Yelp shows the same upload as BOTH a square grid
thumbnail AND a wide banner across the top of the mobile page. A 1200x630 asset
(like og-image.png) gets its sides chopped in the square crop, and a square logo
that fills the frame gets its top and bottom chopped in the wide crop — which is
exactly what happened on the first upload. So: 1200x1200 canvas, but every
meaningful pixel lives inside the centre band that survives a 3:2 centre crop.

Run:  python3 generate-yelp-photos.py     (writes the PNGs next to this file)
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MARK = os.path.join(ROOT, "marketing-site", "logo.png")

S = 1200                      # square canvas
SAFE_TOP, SAFE_BOT = 240, 960  # 3:2 centre crop keeps y 200..1000 — leave margin
SAFE_L, SAFE_R = 110, 1090

BG = (7, 8, 16)
GOLD = (200, 168, 75)
TEXT = (240, 242, 255)
DIM = (139, 145, 184)

SANS = "/tmp/bl-fonts/Inter.ttf"
SERIF = "/tmp/bl-fonts/Playfair.ttf"


def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight:
        try:
            f.set_variation_by_axes([weight])   # both faces are variable
        except Exception:
            pass
    return f


def mark(h):
    im = Image.open(MARK).convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def canvas():
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    for i in range(140, 0, -1):                 # soft gold glow behind the content
        r = i * 4.6
        a = (i / 140) ** 2.2 * 0.09
        c = tuple(round(BG[k] + (GOLD[k] - BG[k]) * a) for k in range(3))
        d.ellipse([S / 2 - r, S * 0.34 - r, S / 2 + r, S * 0.34 + r], fill=c)
    return im.filter(ImageFilter.GaussianBlur(90))


def tracked(d, text, f, y, fill, track, center=S / 2):
    w = sum(d.textlength(c, font=f) for c in text) + track * (len(text) - 1)
    x = center - w / 2
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + track
    return w


def centered(d, text, f, y, fill):
    w = d.textlength(text, font=f)
    d.text((S / 2 - w / 2, y), text, font=f, fill=fill)
    return w


def rule(d, y, half=70):
    d.line([(S / 2 - half, y), (S / 2 + half, y)], fill=GOLD, width=3)


def card_brand():
    im = canvas(); d = ImageDraw.Draw(im)
    m = mark(230)
    im.paste(m, (round(S / 2 - m.width / 2), 300), m)
    tracked(d, "BOLDLINE MEDIA", font(SANS, 62, 700), 580, TEXT, 9)
    rule(d, 690)
    centered(d, "Google & Meta Ads", font(SERIF, 50, 500), 730, DIM)
    centered(d, "+ Landing Pages", font(SERIF, 50, 500), 800, DIM)
    return im


def card_what():
    im = canvas(); d = ImageDraw.Draw(im)
    tracked(d, "WHAT WE DO", font(SANS, 34, 700), 300, GOLD, 8)
    centered(d, "Google & Meta Ads", font(SERIF, 84, 600), 400, TEXT)
    centered(d, "and the landing pages", font(SERIF, 84, 600), 520, TEXT)
    centered(d, "behind them.", font(SERIF, 84, 600), 640, TEXT)
    rule(d, 790)
    centered(d, "boldlinemedia.com", font(SANS, 38, 400), 830, DIM)
    return im


def card_own():
    im = canvas(); d = ImageDraw.Draw(im)
    tracked(d, "THE RULE THAT NEVER BENDS", font(SANS, 30, 700), 300, GOLD, 6)
    centered(d, "You own your", font(SERIF, 92, 600), 400, TEXT)
    centered(d, "ad account.", font(SERIF, 92, 600), 525, TEXT)
    rule(d, 690)
    centered(d, "We only ever manage it — we never", font(SANS, 36, 400), 730, DIM)
    centered(d, "hold or touch your ad spend.", font(SANS, 36, 400), 785, DIM)
    return im


def card_outcome():
    im = canvas(); d = ImageDraw.Draw(im)
    tracked(d, "THE POINT OF ALL OF IT", font(SANS, 30, 700), 300, GOLD, 6)
    centered(d, "Clicks that turn", font(SERIF, 92, 600), 400, TEXT)
    centered(d, "into customers.", font(SERIF, 92, 600), 525, TEXT)
    rule(d, 690)
    centered(d, "Phoenix based. Working with businesses", font(SANS, 34, 400), 730, DIM)
    centered(d, "across the U.S. and remotely.", font(SANS, 34, 400), 782, DIM)
    return im


CARDS = [("yelp-1-brand.png", card_brand), ("yelp-2-what-we-do.png", card_what),
         ("yelp-3-you-own-it.png", card_own), ("yelp-4-outcome.png", card_outcome)]

if __name__ == "__main__":
    ok = True
    for name, fn in CARDS:
        im = fn()
        path = os.path.join(HERE, name)
        im.save(path, optimize=True)
        # Verify every non-background pixel sits inside the crop-safe band.
        diff = Image.new("L", im.size)
        px, dp = im.load(), diff.load()
        for y in range(0, S, 4):
            for x in range(0, S, 4):
                p = px[x, y]
                dp[x, y] = 255 if max(abs(p[i] - BG[i]) for i in range(3)) > 26 else 0
        bb = diff.getbbox()
        safe = bb and bb[1] >= SAFE_TOP - 40 and bb[3] <= SAFE_BOT + 40 and bb[0] >= SAFE_L - 40 and bb[2] <= SAFE_R + 40
        ok &= bool(safe)
        print(f"{'PASS' if safe else 'FAIL'}  {name:<24} content bbox={bb}  {os.path.getsize(path)//1024}KB")
    print("\nAll content inside the 3:2 centre-crop safe band" if ok else "\nSOME CONTENT WOULD BE CROPPED")
