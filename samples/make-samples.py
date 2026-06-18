#!/usr/bin/env python3
"""Generate the sample dossier that ships with MIRL Aftermath.

Everything here is invented: the town of Tell Sumra, the Shrine of the Two
Springs, its assessor, and every harm recorded. The sample exists so the tool
opens with a worked example; it makes no claim about any real person, place,
monument, or event. The six photographs (a before and an after for each of
three assessments) are rendered from scratch with Pillow, with procedural stone
texture, directional light, soft shadows, atmospheric grading, and synthetic
blast damage. They are meant to read like field photographs while remaining
entirely drawn, so there are no downloads and no licensing or ethical questions:
real losses are never fictionalized here.

One assessment ships already registered (its before and after are of slightly
different viewpoints, with matched control points and a fitted homography), so
the compare view and the registered overlay in the dossier work the moment the
sample opens. One before photograph is marked restricted, and the site's
coordinates are left unsafe to publish, so the consent defaults are visible from
the first export. Each photograph's sha-256 is computed from the exact PNG file
written.

    python3 make-samples.py

Writes img/*.png, sample-project.json (for reading), and sample-data.js
(loaded by the page so the sample works even from file://). Needs Pillow.
"""

import base64
import hashlib
import io
import json
import math
import os
import random

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops, ImageEnhance
except ImportError:
    raise SystemExit("This script needs Pillow: python3 -m pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "img")
os.makedirs(IMG, exist_ok=True)

W, H = 1400, 1000
R = random.Random(20240209)   # the invented event date, for deterministic output

# a warm limestone palette
STONE = (190, 176, 150)
SKY_T, SKY_B = (150, 176, 200), (212, 222, 226)
GROUND_T, GROUND_B = (152, 142, 124), (108, 100, 86)
RECESS_T, RECESS_B = (26, 22, 18), (60, 54, 46)
SOOT = (44, 38, 32)
TILE = [(46, 92, 120), (38, 70, 96), (176, 146, 88), (150, 78, 62), (70, 110, 96)]


# ---------------------------------------------------------------------------
#  small colour + noise helpers
# ---------------------------------------------------------------------------
def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def mul(c, k):
    return (c[0] * k, c[1] * k, c[2] * k)


def clampc(c):
    return tuple(max(0, min(255, int(round(v)))) for v in c)


def randbytes(n):
    try:
        return R.randbytes(n)
    except AttributeError:
        return bytes(R.getrandbits(8) for _ in range(n))


def noise_img(w, h):
    return Image.frombytes("L", (w, h), randbytes(w * h))


def cloud(w, h, scale=12, blur=20):
    sw, sh = max(2, w // scale), max(2, h // scale)
    return noise_img(sw, sh).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))


def vgrad_img(w, h, top, bot):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bot, y / max(1, h - 1)))
    return img


def vgrad(d, box, top, bot):
    x0, y0, x1, y1 = box
    n = max(1, y1 - y0)
    for i in range(n):
        d.line([(x0, y0 + i), (x1, y0 + i)], fill=lerp(top, bot, i / n))


def light_map(w, h, tl=152, br=104):
    """A 2x2 luminance ramp (bright upper-left, dark lower-right), upscaled."""
    g = Image.new("L", (2, 2))
    g.putpixel((0, 0), tl)
    g.putpixel((1, 0), (tl + br) // 2)
    g.putpixel((0, 1), (tl + br) // 2)
    g.putpixel((1, 1), br)
    g = g.resize((w, h), Image.BILINEAR)
    return Image.merge("RGB", (g, g, g))


def soft_dark(img, box, strength=0.55, blur=44):
    """Paint a soft shadow / scorch by multiplying within a blurred ellipse."""
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).ellipse(box, fill=int(255 * strength))
    m = m.filter(ImageFilter.GaussianBlur(blur))
    dark = ImageChops.multiply(img, Image.new("RGB", img.size, SOOT))
    return Image.composite(dark, img, m)


# ---------------------------------------------------------------------------
#  materials: a textured ashlar wall, an arched opening, a lit dome
# ---------------------------------------------------------------------------
def make_wall(w, h, base, course=42, joint=90, lit=True, tl=152, br=104):
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    # individual stones, each tonally jittered
    y, row = 0, 0
    while y < h + course:
        off = (joint // 2) if row % 2 else 0
        x = -off
        while x < w + joint:
            j = R.uniform(-13, 13)
            wv = R.uniform(-5, 5)
            d.rectangle([x, y, x + joint, y + course],
                        fill=clampc((base[0] + j + wv, base[1] + j, base[2] + j - wv)))
            x += joint
        y += course
        row += 1
    # mortar: a recessed dark joint with a thin highlight just beneath
    y = 0
    while y < h + course:
        d.line([(0, y), (w, y)], fill=clampc(mul(base, 0.64)), width=3)
        d.line([(0, y + 2), (w, y + 2)], fill=clampc(mul(base, 1.08)), width=1)
        y += course
    y, row = 0, 0
    while y < h + course:
        off = (joint // 2) if row % 2 else 0
        x = -off
        while x < w + joint:
            d.line([(x, y), (x, y + course)], fill=clampc(mul(base, 0.64)), width=2)
            x += joint
        y += course
        row += 1
    # weathering blotches, then the directional light
    img = ImageChops.overlay(img, cloud(w, h, scale=8, blur=18).convert("RGB"))
    if lit:
        img = ImageChops.overlay(img, light_map(w, h, tl, br))
    return img


def arch_opening(img, box, surround=STONE):
    """A recessed, shadowed arched opening (window or door) in a wall."""
    x0, y0, x1, y1 = box
    w = x1 - x0
    r = w // 2
    d = ImageDraw.Draw(img)
    # the void: dark, darkest at the head
    vgrad(d, (x0, y0, x1, y1), RECESS_T, RECESS_B)
    d.pieslice([x0, y0 - r, x1, y0 + r], 180, 360, fill=RECESS_T)
    # an inner cast shadow on the head and the left reveal
    sh = Image.new("L", img.size, 0)
    sd = ImageDraw.Draw(sh)
    sd.pieslice([x0, y0 - r, x1, y0 + r], 180, 360, fill=150)
    sd.rectangle([x0, y0, x0 + r // 2, y1], fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    img.paste(Image.new("RGB", img.size, (10, 8, 6)), (0, 0), sh)
    d = ImageDraw.Draw(img)
    # stone surround: a shadowed left reveal, a lit right reveal
    d.arc([x0 - 5, y0 - r - 5, x1 + 5, y0 + r + 5], 180, 360, fill=clampc(mul(surround, 0.7)), width=6)
    d.line([(x0 - 5, y0), (x0 - 5, y1)], fill=clampc(mul(surround, 0.7)), width=6)
    d.line([(x1 + 5, y0), (x1 + 5, y1)], fill=clampc(mul(surround, 1.16)), width=3)
    d.line([(x0 - 5, y1), (x1 + 5, y1)], fill=clampc(mul(surround, 0.75)), width=4)


def draw_dome(img, bbox, base):
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    rad = ImageOps.invert(Image.radial_gradient("L")).resize((w, h))
    canvas = Image.new("L", (w, h), 36)
    canvas.paste(rad, (int(-w * 0.16), int(-h * 0.12)))   # push the highlight up-left
    canvas = canvas.filter(ImageFilter.GaussianBlur(max(2, int(w * 0.05))))
    col = ImageOps.colorize(canvas, clampc(mul(base, 0.5)), clampc(mul(base, 1.22)))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).pieslice([0, 0, w - 1, h - 1], 180, 360, fill=255)
    img.paste(col, (x0, y0), mask)
    d = ImageDraw.Draw(img)
    cx, cyb = x0 + w // 2, y0 + h // 2
    for a in range(195, 346, 15):                          # ribs
        ex = cx + int((w / 2 - 8) * math.cos(math.radians(a)))
        ey = cyb + int((h / 2 - 8) * math.sin(math.radians(a)))
        d.line([(cx, cyb), (ex, ey)], fill=clampc(mul(base, 0.8)), width=1)
    d.line([(cx, y0 + 6), (cx, y0 - 34)], fill=clampc(mul(base, 0.7)), width=4)  # finial
    d.ellipse([cx - 8, y0 - 52, cx + 8, y0 - 34], fill=clampc(mul(base, 0.82)))
    d.line([(x0 + 8, cyb), (x1 - 8, cyb)], fill=clampc(mul(base, 0.58)), width=2)


def draw_collapse(img, bbox, base):
    """The dome gone: a dark interior void, ragged masonry teeth, a sky gap."""
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    cx, cyb = x0 + w // 2, y0 + h // 2
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).pieslice([x0 + 18, cyb - h // 2 + 24, x1 - 18, cyb + 40], 180, 360, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(5))
    void = ImageChops.multiply(img, Image.new("RGB", img.size, (40, 35, 30)))
    void = Image.composite(Image.new("RGB", img.size, (30, 26, 22)), void, m)
    img = Image.composite(void, img, m)
    d = ImageDraw.Draw(img)
    d.polygon([(cx - 64, cyb - 118), (cx + 8, cyb - 150), (cx + 52, cyb - 108), (cx - 14, cyb - 86)],
              fill=(198, 206, 208))                        # sky through the breach
    for tx in range(x0 + 26, x1 - 30, 32):                 # broken teeth on the rim
        ht = R.randint(28, 82)
        col = clampc(mul(base, R.uniform(0.55, 0.95)))
        d.polygon([(tx, cyb + 4), (tx + 8, cyb - ht), (tx + 22, cyb - ht + 14), (tx + 30, cyb + 4)], fill=col)
        d.line([(tx + 8, cyb - ht), (tx + 22, cyb - ht + 14)], fill=clampc(mul(base, 1.12)), width=1)
    return img


def crack(img, pts, width):
    d = ImageDraw.Draw(img)
    d.line(pts, fill=(28, 24, 20), width=width, joint="curve")
    d.line([(x + 2, y) for (x, y) in pts], fill=clampc(mul(STONE, 1.12)), width=1)


def rubble(img, region, n):
    x0, y0, x1, y1 = region
    band = Image.new("L", img.size, 0)
    ImageDraw.Draw(band).ellipse([x0, (y0 + y1) // 2, x1, y1 + 30], fill=120)
    band = band.filter(ImageFilter.GaussianBlur(28))
    img = Image.composite(ImageChops.multiply(img, Image.new("RGB", img.size, (96, 88, 76))), img, band)
    d = ImageDraw.Draw(img)
    chunks = sorted((R.randint(y0, y1), R.randint(x0, x1), R.randint(8, 30)) for _ in range(n))
    for cy, cx, s in chunks:
        d.ellipse([cx - s, cy + s // 3, cx + s + 4, cy + s], fill=(64, 58, 50))      # contact shadow
        base = clampc(mul(STONE, R.uniform(0.7, 1.02)))
        top = [(cx - s, cy + s // 4), (cx - s // 2, cy - s // 2), (cx + s // 3, cy - s // 3), (cx + s, cy)]
        d.polygon(top + [(cx + s, cy + s // 3), (cx - s // 2, cy + s // 2)], fill=clampc(mul(base, 0.78)))
        d.polygon(top + [(cx + s, cy)], fill=base)
        d.line([(cx - s // 2, cy - s // 2), (cx + s // 3, cy - s // 3)], fill=clampc(mul(base, 1.2)), width=1)
    return img


def smoke(img, cx, cy):
    m = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(m)
    x, y = cx, cy
    for i in range(16):
        rr = 28 + i * 5
        md.ellipse([x - rr, y - rr - i * 38, x + rr, y + rr - i * 38], fill=64)
        x += R.randint(-6, 16)
    m = m.filter(ImageFilter.GaussianBlur(36))
    return Image.composite(Image.new("RGB", img.size, (156, 152, 146)), img, m)


def sky(w, h, top, bot):
    img = vgrad_img(w, h, top, bot)
    cl = cloud(w, h, scale=11, blur=18)
    mask = cl.point(lambda v: max(0, (v - 126)) * 2)
    return Image.composite(Image.new("RGB", (w, h), (240, 242, 240)), img, mask)


def photo_finish(img, warm=0.0, contrast=1.07, bright=1.0, vignette=0.30, grain=0.05, blur=0.7, haze=0.0):
    """Grade a flat render into something that reads as a field photograph."""
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    img = ImageEnhance.Contrast(img).enhance(contrast)
    if bright != 1.0:
        img = ImageEnhance.Brightness(img).enhance(bright)
    if warm:
        tint = (255, 236, 206) if warm > 0 else (206, 222, 255)
        img = Image.blend(img, ImageChops.multiply(img, Image.new("RGB", img.size, tint)), abs(warm))
    if haze:
        hz = vgrad_img(img.size[0], img.size[1], (214, 212, 204), (198, 196, 188))
        img = Image.blend(img, hz, haze)
    if grain:
        img = Image.blend(img, ImageChops.overlay(img, noise_img(*img.size).convert("RGB")), grain)
    if vignette:
        v = Image.new("L", img.size, 0)
        ImageDraw.Draw(v).ellipse([-img.size[0] * 0.28, -img.size[1] * 0.28,
                                   img.size[0] * 1.28, img.size[1] * 1.28], fill=255)
        v = v.filter(ImageFilter.GaussianBlur(min(img.size) // 4))
        dark = ImageChops.multiply(img, Image.merge("RGB", (v, v, v)))
        img = Image.blend(img, dark, vignette)
    return img


# ---------------------------------------------------------------------------
#  A-001 : the domed shrine, frontal (before) and warped + ruined (after)
# ---------------------------------------------------------------------------
BLOCK = (300, 300, 1100, 820)   # the facade block, also the four control corners
DOOR = (620, 556, 780, 820)
DOME_BB = (565, 150, 835, 430)


def draw_shrine(damaged=False):
    img = sky(W, H, SKY_T, SKY_B)
    d = ImageDraw.Draw(img)
    vgrad(d, (0, 818, W, H), GROUND_T, GROUND_B)
    # the building's soft cast shadow on the ground
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).polygon([(300, 818), (1100, 818), (1180, 1000), (360, 1000)], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    img = Image.composite(ImageChops.multiply(img, Image.new("RGB", img.size, (74, 68, 58))), img, sh)
    d = ImageDraw.Draw(img)

    bx0, by0, bx1, by1 = BLOCK
    # the drum under the dome
    img.paste(make_wall(206, 86, clampc(mul(STONE, 0.97))), (597, 228))
    # the dome, or the collapse
    if not damaged:
        draw_dome(img, DOME_BB, STONE)
    else:
        img = draw_collapse(img, DOME_BB, STONE)
    d = ImageDraw.Draw(img)

    # the facade block, its cornice and string course
    img.paste(make_wall(bx1 - bx0, by1 - by0, STONE), (bx0, by0))
    d = ImageDraw.Draw(img)
    d.rectangle([bx0 - 12, by0 - 18, bx1 + 12, by0], fill=clampc(mul(STONE, 0.9)))
    d.line([(bx0 - 12, by0 - 18), (bx1 + 12, by0 - 18)], fill=clampc(mul(STONE, 1.12)), width=2)
    d.rectangle([bx0, 460, bx1, 476], fill=clampc(mul(STONE, 0.84)))
    d.line([(bx0, 460), (bx1, 460)], fill=clampc(mul(STONE, 1.12)), width=2)
    # corner pilasters, in a slightly paler stone
    for px in (bx0 - 8, bx1 - 28):
        img.paste(make_wall(40, by1 - by0, clampc(mul(STONE, 1.05)), 46, 46), (px, by0))
    d = ImageDraw.Draw(img)

    # openings
    for wx in (372, 470, 930, 1028):
        arch_opening(img, (wx, 360, wx + 58, 452))
    for wx in (372, 470, 930, 1028):
        arch_opening(img, (wx, 560, wx + 58, 652))
    arch_opening(img, DOOR)

    if damaged:
        crack(img, [(700, 300), (680, 432), (708, 560), (686, 700), (700, 818)], 5)
        crack(img, [(520, 300), (484, 470), (516, 640), (468, 818)], 3)
        crack(img, [(905, 300), (962, 500), (922, 690), (994, 818)], 3)
        img = soft_dark(img, (560, 250, 840, 470), 0.5, 46)     # scorched dome seat
        img = soft_dark(img, (596, 470, 804, 600), 0.42, 40)    # scorched door head
        img = rubble(img, (456, 742, 1044, 862), 150)
        # a low band of settling dust
        hz = Image.new("L", img.size, 0)
        ImageDraw.Draw(hz).rectangle([0, 720, W, H], fill=120)
        hz = hz.filter(ImageFilter.GaussianBlur(52))
        img = Image.composite(Image.new("RGB", img.size, (198, 192, 180)), img, hz)
        img = smoke(img, 705, 250)
    return img


# ---------------------------------------------------------------------------
#  A-002 : the mihrab niche, frontal; the after has lost its mosaic
# ---------------------------------------------------------------------------
def mosaic_tiles(img, box, missing):
    """Glazed tilework inside the niche, with patches fallen to bare mortar."""
    x0, y0, x1, y1 = box
    tile = 34
    d = ImageDraw.Draw(img)
    cols = (x1 - x0) // tile
    rows = (y1 - y0) // tile
    for iy in range(rows):
        for ix in range(cols):
            x, y = x0 + ix * tile, y0 + iy * tile
            if (ix, iy) in missing:
                # bare, rough bedding mortar in shadow, with a broken lip above
                d.rectangle([x, y, x + tile, y + tile], fill=clampc(mul(STONE, 0.52)))
                d.point([(x + R.randint(2, tile - 2), y + R.randint(2, tile - 2)) for _ in range(10)],
                        fill=clampc(mul(STONE, 0.4)))
                if (ix, iy - 1) not in missing:
                    d.line([(x, y), (x + tile, y)], fill=(20, 17, 14), width=3)  # shadow under the lip
                continue
            c = TILE[(ix * 2 + iy * 3 + ix // 3) % len(TILE)]
            d.rectangle([x + 2, y + 2, x + tile - 2, y + tile - 2], fill=c)
            d.rectangle([x + 2, y + 2, x + tile - 2, y + tile - 2], outline=clampc(mul(c, 0.7)), width=1)
            d.ellipse([x + 8, y + 8, x + tile - 8, y + tile - 8], fill=clampc(mul(c, 1.25)))
            d.ellipse([x + 10, y + 9, x + 15, y + 14], fill=clampc(mul(c, 1.7)))  # glaze specular


def draw_mihrab(damaged=False):
    img = make_wall(W, H, clampc(mul(STONE, 0.98)), 46, 104)
    d = ImageDraw.Draw(img)
    nx0, ny0, nx1, ny1 = 470, 250, 930, 900
    r = (nx1 - nx0) // 2
    # the recess back, in shadow
    vgrad(d, (nx0, ny0, nx1, ny1), clampc(mul(STONE, 0.55)), clampc(mul(STONE, 0.7)))
    d.pieslice([nx0, ny0 - r, nx1, ny0 + r], 180, 360, fill=clampc(mul(STONE, 0.5)))
    # the tilework, set a little inside the reveal
    missing = set()
    if damaged:
        for (mx, my, mw, mh) in [(1, 1, 4, 3), (8, 5, 3, 6), (2, 11, 3, 4), (7, 13, 4, 3)]:
            for ix in range(mx, mx + mw):
                for iy in range(my, my + mh):
                    missing.add((ix, iy))
    mosaic_tiles(img, (nx0 + 26, ny0 + 8, nx1 - 26, ny1 - 26), missing)
    d = ImageDraw.Draw(img)
    # a hood arch springing line and a soft inner shadow on the reveal
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).pieslice([nx0, ny0 - r, nx1, ny0 + r], 180, 360, fill=130)
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    img.paste(Image.new("RGB", img.size, (16, 13, 10)), (0, 0), sh)
    d = ImageDraw.Draw(img)
    # the stone surround and flanking colonnettes
    d.arc([nx0 - 6, ny0 - r - 6, nx1 + 6, ny0 + r + 6], 180, 360, fill=clampc(mul(STONE, 0.72)), width=8)
    d.line([(nx0 - 6, ny0), (nx0 - 6, ny1)], fill=clampc(mul(STONE, 0.72)), width=8)
    d.line([(nx1 + 6, ny0), (nx1 + 6, ny1)], fill=clampc(mul(STONE, 1.16)), width=5)
    for cxx in (nx0 - 30, nx1 + 6):
        img.paste(make_wall(24, ny1 - ny0, clampc(mul(STONE, 1.02)), 40, 24), (cxx, ny0))
    d = ImageDraw.Draw(img)
    if damaged:
        crack(img, [(700, 250), (688, 520), (716, 760), (700, 900)], 4)
        # fallen tesserae heaped on the sill
        img = rubble(img, (520, 880, 880, 945), 60)
        img = soft_dark(img, (470, 250, 930, 520), 0.28, 50)
    return img


# ---------------------------------------------------------------------------
#  A-003 : the foundation inscription panel; the after is cracked + stained
# ---------------------------------------------------------------------------
def draw_panel(damaged=False):
    img = make_wall(W, H, clampc(mul(STONE, 0.92)), 52, 112)
    d = ImageDraw.Draw(img)
    px0, py0, px1, py1 = 320, 300, 1080, 720
    # the framed panel, a paler dressed slab proud of the wall
    img.paste(make_wall(px1 - px0, py1 - py0, clampc(mul(STONE, 1.08)), 60, 200, tl=150, br=110), (px0, py0))
    d = ImageDraw.Draw(img)
    d.rectangle([px0, py0, px1, py1], outline=clampc(mul(STONE, 0.65)), width=8)
    d.line([(px0, py0), (px1, py0)], fill=clampc(mul(STONE, 1.2)), width=3)         # lit top edge
    d.rectangle([px0 + 20, py0 + 20, px1 - 20, py1 - 20], outline=clampc(mul(STONE, 0.78)), width=2)
    # incised inscription: each stroke a dark groove with a lit upper lip
    for i, ly in enumerate(range(py0 + 74, py1 - 50, 96)):
        x = px0 + 64
        while x < px1 - 90:
            gw = 24 + (i * 7 + x) % 30
            d.line([(x, ly + 2), (x + gw, ly + 2)], fill=clampc(mul(STONE, 1.18)), width=2)  # lip
            d.line([(x, ly), (x + gw, ly)], fill=clampc(mul(STONE, 0.5)), width=6)            # groove
            if (x // 11) % 3 == 0:
                d.line([(x, ly - 16), (x, ly)], fill=clampc(mul(STONE, 0.5)), width=5)
            x += gw + 16
    if damaged:
        crack(img, [(px0, 432), (520, 470), (760, 440), (px1, 502)], 5)
        crack(img, [(642, py0), (660, 470), (624, py1)], 3)
        # water staining rising from the sill, with pale efflorescence at its edge
        stain = Image.new("L", img.size, 0)
        ImageDraw.Draw(stain).polygon(
            [(px0, py1), (px1, py1), (px1, py1 - 150), (900, py1 - 96), (640, py1 - 178),
             (430, py1 - 86), (px0, py1 - 134)], fill=150)
        stain = stain.filter(ImageFilter.GaussianBlur(26))
        img = Image.composite(ImageChops.multiply(img, Image.new("RGB", img.size, (120, 116, 120))), img, stain)
        eff = Image.new("L", img.size, 0)
        ImageDraw.Draw(eff).line([(px0, py1 - 130), (430, py1 - 84), (640, py1 - 176),
                                  (900, py1 - 94), (px1, py1 - 148)], fill=120, width=10)
        eff = eff.filter(ImageFilter.GaussianBlur(7))
        img = Image.composite(Image.new("RGB", img.size, (224, 222, 214)), img, eff)
    return img


# ---------------------------------------------------------------------------
#  homography helpers, for the registered pair (A-001)
# ---------------------------------------------------------------------------
def gauss_solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        for j in range(col, n + 1):
            M[col][j] /= pv
        for r in range(n):
            if r != col and M[r][col]:
                f = M[r][col]
                for j in range(col, n + 1):
                    M[r][j] -= f * M[col][j]
    return [M[i][n] for i in range(n)]


def homography_4pt(src, dst):
    A, b = [], []
    for (x, y), (X, Y) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.append(X)
        A.append([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.append(Y)
    return gauss_solve(A, b) + [1.0]


def mat_inv(M):
    a, b, c, d, e, f, g, h, i = M
    A = e * i - f * h; B = -(d * i - f * g); C = d * h - e * g
    D = -(b * i - c * h); E = a * i - c * g; F = -(a * h - b * g)
    G = b * f - c * e; Hh = -(a * f - c * d); I = a * e - b * d
    inv = 1 / (a * A + b * B + c * C)
    return [A * inv, D * inv, G * inv, B * inv, E * inv, Hh * inv, C * inv, F * inv, I * inv]


def applyH(M, p):
    x, y = p
    w = M[6] * x + M[7] * y + M[8]
    return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w]


SRC_CORNERS = [(300, 300), (1100, 300), (1100, 820), (300, 820)]
DST_CORNERS = [(366, 332), (1156, 250), (1124, 902), (332, 760)]
HWARP = homography_4pt(SRC_CORNERS, DST_CORNERS)
HINV = mat_inv(HWARP)
CTRL_BEFORE = SRC_CORNERS + [(620, 556), (780, 556), (700, 300)]


def warp_after(front_damaged):
    coeffs = [v / HINV[8] for v in HINV[:8]]
    return front_damaged.transform((W, H), Image.PERSPECTIVE, coeffs,
                                   resample=Image.BICUBIC, fillcolor=SKY_B)


# ---------------------------------------------------------------------------
#  build the photographs and their records
# ---------------------------------------------------------------------------
def sha256_of(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def data_url(img, mx=1200, q=82):
    im = img.copy().convert("RGB")
    im.thumbnail((mx, mx))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


_pid = [0]


def photo(name, pil, date, provenance, consent="public"):
    _pid[0] += 1
    path = os.path.join(IMG, name)
    if name.lower().endswith((".jpg", ".jpeg")):
        pil.convert("RGB").save(path, "JPEG", quality=92)   # a camera-like original
    else:
        pil.save(path)
    return {
        "id": "ph-%02d" % _pid[0],
        "name": name,
        "dataUrl": data_url(pil),
        "natW": pil.width, "natH": pil.height,
        "sha256": sha256_of(path),
        "date": date, "provenance": provenance, "consent": consent,
    }


T = "2026-03-20T12:00:00.000Z"


def assessment(n, **kw):
    base = {
        "id": "A-%03d" % n,
        "area": "", "date": "", "assessor": "the sample assessor",
        "category": "structural", "severity": "moderate", "eventId": None,
        "summary": "", "recommendation": "",
        "before": None, "after": None,
        "align": {"beforePts": [], "afterPts": [], "H": None, "rms": None},
        "created": T, "modified": T,
    }
    base.update(kw)
    return base


print("rendering the shrine...")
shrine_before = photo_finish(draw_shrine(False), warm=0.10, contrast=1.08, vignette=0.30, grain=0.05, blur=0.7)
shrine_after = photo_finish(warp_after(draw_shrine(True)), warm=-0.05, contrast=1.04, vignette=0.34, grain=0.06, blur=0.9, haze=0.10)
print("rendering the mihrab...")
mihrab_before = photo_finish(draw_mihrab(False), warm=0.08, contrast=1.06, vignette=0.26, grain=0.045)
mihrab_after = photo_finish(draw_mihrab(True), warm=-0.03, contrast=1.03, vignette=0.30, grain=0.06, haze=0.06)
print("rendering the inscription panel...")
panel_before = photo_finish(draw_panel(False), warm=0.09, contrast=1.06, vignette=0.24, grain=0.045)
panel_after = photo_finish(draw_panel(True), warm=-0.02, contrast=1.03, vignette=0.28, grain=0.05, haze=0.05)

before_pts = [list(p) for p in CTRL_BEFORE]
after_pts = [applyH(HWARP, p) for p in CTRL_BEFORE]

EVENTS = [
    {"id": "evt-1", "date": "9 February 2024", "type": "shelling or airstrike",
     "source": "field report, MIRL Aftermath sample",
     "note": "Two shells struck the shrine during the February exchange; the dome took a direct hit."},
    {"id": "evt-2", "date": "11 February 2024", "type": "fire",
     "source": "witness account (invented for the sample)",
     "note": "A fire in the prayer hall two days later spread to the west door."},
]

assessments = [
    assessment(
        1,
        area="The dome and north portico",
        date="2024-03-18", category="collapse", severity="destroyed", eventId="evt-1",
        summary=("The masonry dome over the prayer hall has collapsed entirely. The drum stands to "
                 "roughly two metres, its rim scorched, with the shell of the cupola fallen inward "
                 "onto the floor below. Blast cracking runs the full height of the north facade from "
                 "the dome seat to the plinth, and the portico arch is fractured at the crown.\n\n"
                 "The before photograph is a frontal record made in 2019; the after was taken from "
                 "the northeast on the day of assessment. The two are registered here so the loss of "
                 "the dome reads against the standing facade."),
        recommendation=("Emergency shoring of the drum and portico arch before any clearance. Record "
                        "and retain the fallen voussoirs in situ for possible anastylosis. Sheet the "
                        "opening against weather."),
        before=photo("shrine-before.jpg", shrine_before, "2019-05-02",
                     "MIRL Aftermath sample, frontal survey 2019"),
        after=photo("shrine-after.jpg", shrine_after, "2024-03-18",
                    "MIRL Aftermath sample, northeast view 2024"),
        align={"beforePts": before_pts, "afterPts": after_pts, "H": HWARP, "rms": 0.0,
               "compare": "curtain", "split": 0.5},
    ),
    assessment(
        2,
        area="محراب الجناح الجنوبي",
        date="2024-03-19", category="material", severity="moderate", eventId="evt-1",
        summary=("Roughly a third of the glazed mosaic of the south-aisle mihrab has detached and "
                 "fallen, exposing the rough bedding mortar in four patches across the hood and "
                 "jambs. A vertical crack passes through the niche. The surviving tilework is sound "
                 "but drummy where it borders the losses.\n\n"
                 "The before photograph was supplied by the community under restriction and is held "
                 "out of this dossier; only the after is published here."),
        recommendation=("Face-bond and consolidate the tile borders before further loss. Gather and "
                        "label fallen tesserae. Defer reintegration pending the community's consent "
                        "to use the historic photograph."),
        before=photo("mihrab-before.jpg", mihrab_before, "2018",
                     "community photograph, held under restriction", consent="restricted"),
        after=photo("mihrab-after.jpg", mihrab_after, "2024-03-19",
                    "MIRL Aftermath sample, south aisle 2024"),
    ),
    assessment(
        3,
        area="Foundation inscription, west door",
        date="2024-03-19", category="cracking", severity="minor", eventId="evt-2",
        summary=("The carved foundation panel over the west door is structurally intact. A hairline "
                 "crack crosses the lower third, and a tide of water staining has risen from the "
                 "sill where the fire-fighting water pooled. The text remains fully legible."),
        recommendation=("Monitor the crack with tell-tales. Improve drainage at the sill to arrest "
                        "the rising damp. No intervention on the carved face at this stage."),
        before=photo("panel-before.jpg", panel_before, "2019-05-02",
                     "MIRL Aftermath sample, frontal survey 2019"),
        after=photo("panel-after.jpg", panel_after, "2024-03-19",
                    "MIRL Aftermath sample, west door 2024"),
    ),
]

project = {
    "site": {
        "name": "Shrine of the Two Springs",
        "place": "Tell Sumra (invented for this sample)",
        "lat": 34.213, "lon": 38.476, "safe": False,
        "designation": "National monument (fictional register)",
        "identifier": "TS-MON-014",
        "description": ("A small domed shrine of dressed limestone, of the kind that gathers around a "
                        "spring: a single prayer hall under a masonry dome, a north portico, and a "
                        "south aisle whose mihrab carried a glazed mosaic. Everything recorded in this "
                        "dossier is invented. The town of Tell Sumra, the shrine, its assessor, and "
                        "every harm here are fictional, and any resemblance to a real place or event "
                        "is coincidental."),
    },
    "dossier": {
        "reference": "MIRL-AM-2026-03",
        "assessor": "the sample assessor",
        "organization": "MIRL Aftermath sample data",
        "contact": "",
        "note": ("A worked example, entirely fictional. It exists to show how MIRL Aftermath turns "
                 "before-and-after photographs into a standardized condition dossier. Rapid condition "
                 "survey on foot; photographs at the element scale."),
    },
    "events": EVENTS,
    "assessments": assessments,
    "created": T,
    "modified": T,
}

data = {"format": "mirl-aftermath", "version": 1, "project": project}

with open(os.path.join(HERE, "sample-project.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("wrote sample-project.json")

js = ("/* sample-data.js: the fictional sample dossier, generated by\n"
      "   samples/make-samples.py. Loaded as a script so the sample opens\n"
      "   even from file://, where fetch() cannot read local JSON. */\n"
      "window.AM = window.AM || {};\n"
      "AM.SAMPLE = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
with open(os.path.join(HERE, "sample-data.js"), "w", encoding="utf-8") as f:
    f.write(js)
print("wrote sample-data.js")
print("done.")
