#!/usr/bin/env python3
"""Ziyo Fest AI логотипін (ашық сұр фондағы түрлі-түсті) таза векторға айналдырады.

  python3 tools/trace_ziyo.py path/to/ziyo.jpg

Әр түс өз қабатына бөлінеді: көгілдір жапырақтар, алтын жапырақтар, «пиксель»
шаршылар, ортадағы ақ шеңбер және «Ziyo Fest AI» жазуы. Қабаттар 8 есе үлкейтіліп,
тегістеліп, potrace арқылы қисықтарға айналады; шаршылар мен шеңбер — нақты геометрия.
Нәтиже:
  assets/ziyo.js                       — intro.html оқитын қабаттар
  assets/ziyo-logo.svg                 — фоны жоқ түпнұсқа түстегі логотип
  assets/ziyo-logo-on-dark.svg         — қараңғы фонға арналған нұсқа (жазуы ақ)
"""
import colorsys
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
UP = 8
SMOOTH = 0.5          # edge smoothing, source px
PAD = 6

rgb = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
H_, W_ = rgb.shape[:2]
hsv = np.array([colorsys.rgb_to_hsv(*(p / 255)) for p in rgb.reshape(-1, 3)]).reshape(H_, W_, 3)
hue, sat, val = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722])

# background: light, unsaturated; estimate it smoothly over the frame (it is a soft gradient)
is_bg = (sat < 0.08) & (lum > 200) & (lum < 247)
yy, xx = np.mgrid[0:H_, 0:W_] / max(H_, W_)
A = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1)
bg = np.zeros_like(rgb)
for ch in range(3):
    coef, *_ = np.linalg.lstsq(A[is_bg], rgb[..., ch][is_bg], rcond=None)
    bg[..., ch] = A @ coef

gold_px = (sat > 0.45) & (hue > 25) & (hue < 55)
teal_px = (sat > 0.45) & (hue > 165) & (hue < 205)
GOLD = np.median(rgb[gold_px & (val > 0.8)], axis=0)
TEAL = np.median(rgb[teal_px], axis=0)
TEXT = np.median(rgb[(lum < 90) & (sat < 0.15)], axis=0)


def coverage(target, gate):
    """Soft coverage of a flat colour over the local background (handles anti-aliased edges)."""
    d = target - bg
    a = ((rgb - bg) * d).sum(-1) / (d * d).sum(-1)
    return np.clip(a, 0, 1) * gate


# colour gates (dark pixels are excluded: JPEG chroma noise makes their hue meaningless)
hue_gold = ((hue > 15) & (hue < 65) & (sat > 0.12) & (val > 0.55)).astype(float)
hue_teal = ((hue > 150) & (hue < 220) & (sat > 0.12) & (val > 0.3)).astype(float)
cov = {
    "gold": coverage(GOLD, hue_gold),
    "teal": coverage(TEAL, hue_teal),
    "text": coverage(TEXT, (sat < 0.2).astype(float)),
}
# the text sits below the flower; keep each layer to its own region
def biggest(mask):
    lab, n = ndimage.label(mask)
    return lab == 1 + int(np.argmax(ndimage.sum(mask, lab, range(1, n + 1))))


flower = biggest(ndimage.binary_dilation((cov["gold"] > 0.5) | (cov["teal"] > 0.5), iterations=4))   # bridge the thin gaps between petals
flower_bottom = np.where(flower.any(1))[0].max()
cov["text"][: flower_bottom + 3] = 0
cov["gold"][flower_bottom + 3:] = 0
cov["teal"][flower_bottom + 3:] = 0

# free-floating "pixels": small square gold islands, kept as exact squares
gl, gn = ndimage.label(cov["gold"] > 0.5)
sizes = ndimage.sum(np.ones_like(gl), gl, range(1, gn + 1))
main = 1 + int(np.argmax(sizes))
pixels = []
for i, sl in enumerate(ndimage.find_objects(gl), start=1):
    if i == main or sizes[i - 1] < 6:
        continue
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if sizes[i - 1] < 400 and 0.6 < w / h < 1.6:
        m = cov["gold"][sl] * (gl[sl] == i)
        area = m.sum()                                  # sub-pixel size from coverage
        cy, cx = ndimage.center_of_mass(m)
        side = float(np.sqrt(area))
        pixels.append({"cx": sl[1].start + cx + 0.5, "cy": sl[0].start + cy + 0.5, "s": side})
        cov["gold"][sl][gl[sl] == i] = 0
pixels.sort(key=lambda p: p["cx"] - p["cy"])          # along the trail, from the flower outwards

# white centre: a disc
white = (lum > 247) & (sat < 0.05)
wl, _ = ndimage.label(white)
cy0, cx0 = H_ / 2, W_ / 2
best = max(range(1, wl.max() + 1), key=lambda i: (wl == i).sum())
wm = wl == best
cyc, cxc = ndimage.center_of_mass(wm)
r = float(np.sqrt(wm.sum() / np.pi)) + 0.5
circle = {"cx": cxc + 0.5, "cy": cyc + 0.5, "r": r}

# one shared crop for every layer so they line up exactly
any_ink = (cov["gold"] > 0.3) | (cov["teal"] > 0.3) | (cov["text"] > 0.3)
for p in pixels:
    any_ink[int(p["cy"]), int(p["cx"])] = True
ys, xs = np.where(any_ink)
x0, y0, x1, y1 = xs.min() - PAD, ys.min() - PAD, xs.max() + 1 + PAD, ys.max() + 1 + PAD
cw, ch = (x1 - x0) * UP, (y1 - y0) * UP


def trace(mask, alphamax=1.1):
    img = Image.fromarray((255 * (1 - mask[y0:y1, x0:x1])).astype(np.uint8))
    big = img.resize((cw, ch), Image.LANCZOS).filter(ImageFilter.GaussianBlur(SMOOTH * UP))
    bw = big.point(lambda v: 0 if v < 128 else 255).convert("1")
    with tempfile.TemporaryDirectory() as td:
        pbm, svg = Path(td) / "in.pbm", Path(td) / "out.svg"
        bw.save(pbm)
        subprocess.run(["potrace", str(pbm), "-s", "-o", str(svg), "-t", "30", "-a", str(alphamax), "-O", "1.0",
                        "--unit", "1"], check=True)
        return [" ".join(p.split()) for p in re.findall(r'<path d="([^"]+)"', svg.read_text())]


hexc = lambda c: "#%02x%02x%02x" % tuple(int(round(v)) for v in c)
layers = {
    "teal": {"color": hexc(TEAL), "paths": trace(cov["teal"])},
    "gold": {"color": hexc(GOLD), "paths": trace(cov["gold"], 0.9)},
    "text": {"color": hexc(TEXT), "paths": trace(cov["text"])},
}
for k, v in layers.items():
    print(k, v["color"], len(v["paths"]), "paths")
print("pixels", len(pixels), "circle", {k: round(v, 2) for k, v in circle.items()})

data = {"scale": UP, "box": [int(x0), int(y0), int(x1), int(y1)], "w": int(cw), "h": int(ch),
        "layers": layers, "pixels": pixels, "circle": circle}
out = HERE / "assets"
out.mkdir(exist_ok=True)
(out / "ziyo.js").write_text("// Generated by tools/trace_ziyo.py — vector layers of the Ziyo Fest AI logo.\n"
                             "window.ZIYO = " + json.dumps(data) + ";\n", encoding="utf-8")


def svg(text_color, centre_color):
    k = 1 / UP
    g = f'<g transform="scale({k}) translate(0,{ch}) scale(1,-1)">'
    parts = []
    for name in ("teal", "gold", "text"):
        col = text_color if name == "text" else layers[name]["color"]
        parts.append(g + "".join(f'<path fill="{col}" d="{d}"/>' for d in layers[name]["paths"]) + "</g>")
    parts.append(f'<circle cx="{circle["cx"] - x0:.2f}" cy="{circle["cy"] - y0:.2f}" r="{circle["r"]:.2f}" fill="{centre_color}"/>')
    for p in pixels:
        parts.append(f'<rect x="{p["cx"] - p["s"] / 2 - x0:.2f}" y="{p["cy"] - p["s"] / 2 - y0:.2f}" '
                     f'width="{p["s"]:.2f}" height="{p["s"]:.2f}" fill="{layers["gold"]["color"]}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x1 - x0} {y1 - y0}" fill-rule="evenodd">'
            + "".join(parts) + "</svg>\n")


(out / "ziyo-logo.svg").write_text(svg(layers["text"]["color"], "#ffffff"), encoding="utf-8")
(out / "ziyo-logo-on-dark.svg").write_text(svg("#ffffff", "#ffffff"), encoding="utf-8")
print("wrote", out / "ziyo.js", out / "ziyo-logo.svg", out / "ziyo-logo-on-dark.svg")
