"""Cut the supplied logo images into transparent PNG layers (mark + wordmark).

Wordmarks are recoloured to cream so they read on the dark video background.
Run: python3 src/make_logos.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGOS = ROOT / "assets" / "logos"
UP = 2  # supersample before matting for cleaner edges when logos scale up
LAYOUT = {}  # piece name -> bbox in source-image pixels, used to rebuild lockups

CREAM = np.array([240, 238, 230], np.float32)
CLAUDE_ORANGE = np.array([217, 119, 87], np.float32)


def load(name):
    im = Image.open(LOGOS / name).convert("RGB")
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def save(rgb, alpha, name, box):
    x0, y0, x1, y1 = [v * UP for v in box]
    rgba = np.dstack([rgb, alpha * 255.0])[y0:y1, x0:x1]
    rgba = np.clip(rgba, 0, 255).astype(np.uint8)
    # trim to content
    ys, xs = np.where(rgba[..., 3] > 2)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba, "RGBA").save(LOGOS / name)
    LAYOUT[name] = [(x0 + xs.min()) / UP, (y0 + ys.min()) / UP,
                    (x0 + xs.max() + 1) / UP, (y0 + ys.max() + 1) / UP]
    print(name, rgba.shape[1], "x", rgba.shape[0])


def solid(color, shape):
    return np.broadcast_to(color, shape[:2] + (3,)).copy()


def claude():
    a = load("claude_src.jpg")
    bg = a[10, 10]
    # spark: distance from background relative to spark colour
    d = np.linalg.norm(a - bg, axis=2) / np.linalg.norm(CLAUDE_ORANGE - bg)
    save(solid(CLAUDE_ORANGE, a.shape), np.clip(d * 1.05, 0, 1), "claude_mark.png", (240, 350, 540, 650))
    # wordmark: dark-on-light luminance ramp
    lum = a.mean(axis=2)
    ink = np.percentile(lum[380 * UP:620 * UP, 580 * UP:1540 * UP], 1)
    alpha = np.clip((bg.mean() - lum) / (bg.mean() - ink), 0, 1)
    save(solid(CREAM, a.shape), alpha, "claude_word.png", (560, 370, 1545, 630))


def blender():
    a = load("blender_src.jpg")
    h, w = a.shape[:2]
    # mark: outer edge blends orange->black, inner parts are opaque
    mark = a.sum(axis=2) > 90
    filled = mark.astype(np.uint8)
    flood = filled.copy()
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
    interior = (flood != 2).astype(np.uint8)
    interior = cv2.erode(interior, np.ones((5, 5), np.uint8)) > 0
    edge_a = np.clip(a[..., 0] / 235.0, 0, 1)
    alpha = np.where(interior, 1.0, edge_a)
    rgb = np.where(alpha[..., None] > 0.02, a / np.maximum(alpha, 0.02)[..., None], 0)
    save(np.clip(rgb, 0, 255), alpha, "blender_mark.png", (0, 190, 410, 525))
    # wordmark: projection onto the blue -> cream text
    blue = np.array([33, 86, 136], np.float32)
    t = (a @ blue) / (blue @ blue)
    save(solid(CREAM, a.shape), np.clip(t * 1.05, 0, 1), "blender_word.png", (415, 290, 1238, 460))


def higgsfield():
    """Use the supplied logo if present, otherwise draw a stand-in lockup."""
    src = next((LOGOS / n for n in ("higgsfield_src.png", "higgsfield_src.jpg") if (LOGOS / n).exists()), None)
    if src is not None:
        a = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32)
        if src.suffix == ".jpg" or a[..., 3].min() > 250:
            # white background: anything clearly not white is logo; outline is black so a hard-ish key is fine
            dist = 255.0 * 3 - a[..., :3].sum(axis=2)
            mask = (dist > 40).astype(np.uint8)
            flood = mask.copy()
            h, w = mask.shape
            cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
            inside = flood != 2
            alpha = np.where(inside, 1.0, np.clip(dist / 255.0, 0, 1))
            a[..., 3] = alpha * 255.0
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(LOGOS / "higgsfield.png")
        print("higgsfield.png from", src.name)
        return

    font = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
    lime, ink, white = (212, 255, 0, 255), (8, 8, 8, 255), (255, 255, 255, 255)
    f1 = ImageFont.truetype(font, 300)
    f2 = ImageFont.truetype(font, 330)
    W, H = 2600, 900
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def tracked(text, f, x, y, fill, stroke=0, track=-14):
        for ch in text:
            d.text((x, y), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=ink)
            x += f.getlength(ch) + track
        return x

    def width(text, f, track=-14):
        return sum(f.getlength(c) + track for c in text) - track

    w1 = width("HIGGSFIELD", f1)
    x0 = (W - w1) / 2
    d.rounded_rectangle((x0 - 70, 60, x0 + w1 + 70, 420), radius=60, fill=lime, outline=ink, width=26)
    tracked("HIGGSFIELD", f1, x0, 70, ink)
    w2 = width("GENJUTSU", f2)
    tracked("GENJUTSU", f2, (W - w2) / 2, 400, white, stroke=22)
    # italic shear
    k = 0.2
    im = im.transform((W + int(k * H), H), Image.AFFINE, (1, k, -k * H, 0, 1, 0), Image.BICUBIC)
    bbox = im.getbbox()
    im = im.crop(bbox)
    im.save(LOGOS / "higgsfield.png")
    print("higgsfield.png (stand-in)", im.size)


if __name__ == "__main__":
    claude()
    blender()
    higgsfield()
    (LOGOS / "layout.json").write_text(json.dumps(LAYOUT, indent=2))
