"""Small compositing toolkit: easing, sprites, video sources, masks.

Frames are float32 RGB in 0..1. Sprites are premultiplied float32 RGBA.
"""
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FONTS = Path("/usr/share/fonts/opentype")


# ---------------------------------------------------------------- easing ----
def clamp01(x):
    return min(1.0, max(0.0, x))


def prog(t, t0, t1):
    return clamp01((t - t0) / (t1 - t0))


def out_cubic(x):
    return 1 - (1 - x) ** 3


def in_cubic(x):
    return x ** 3


def in_out_cubic(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def out_expo(x):
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def in_out_expo(x):
    if x <= 0 or x >= 1:
        return x
    return 2 ** (20 * x - 10) / 2 if x < 0.5 else (2 - 2 ** (-20 * x + 10)) / 2


def out_back(x, s=1.70158):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def lerp(a, b, x):
    return a + (b - a) * x


def keyframes(t, keys):
    """Smooth (Catmull-Rom) interpolation through [(t, value), ...]."""
    ts = [k[0] for k in keys]
    vs = [k[1] for k in keys]
    if t <= ts[0]:
        return vs[0]
    if t >= ts[-1]:
        return vs[-1]
    i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
    x = (t - ts[i]) / (ts[i + 1] - ts[i])
    p0 = vs[max(i - 1, 0)]
    p1, p2 = vs[i], vs[i + 1]
    p3 = vs[min(i + 2, len(vs) - 1)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * x + (2 * p0 - 5 * p1 + 4 * p2 - p3) * x ** 2
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * x ** 3)


# --------------------------------------------------------------- sprites ----
class Sprite:
    def __init__(self, rgba_u8, base=1.0):
        a = rgba_u8.astype(np.float32) / 255.0
        a[..., :3] *= a[..., 3:4]
        self.img = a
        self.base = base  # display scale at which the sprite is "1.0"
        self.h, self.w = a.shape[:2]

    @classmethod
    def load(cls, path, base=1.0):
        return cls(np.asarray(Image.open(path).convert("RGBA")), base)

    def size(self, scale=1.0):
        return self.w * self.base * scale, self.h * self.base * scale


def paste(frame, spr, cx, cy, scale=1.0, rot=0.0, opacity=1.0, wipe=None, soft=0.08):
    """Composite sprite centred on (cx, cy). wipe in 0..1 reveals left-to-right."""
    if opacity <= 0.003 or scale <= 0.003:
        return
    img = spr.img
    if wipe is not None:
        if wipe <= 0:
            return
        if wipe < 1:
            u = np.linspace(0, 1, spr.w, dtype=np.float32)
            ramp = np.clip((wipe * (1 + soft) - u) / soft, 0, 1)
            img = img * ramp[None, :, None]
    s = spr.base * scale
    if s < 1:
        nw, nh = max(1, round(spr.w * s)), max(1, round(spr.h * s))
        img = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
        sx, sy = spr.w * s / nw, spr.h * s / nh
    else:
        sx = sy = s
    h, w = img.shape[:2]
    th = np.deg2rad(rot)
    c, si = np.cos(th), np.sin(th)
    A = np.array([[c * sx, -si * sy], [si * sx, c * sy]], np.float32)
    corners = np.array([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], np.float32)
    pts = corners @ A.T + [cx, cy]
    x0, y0 = np.floor(pts.min(0)).astype(int) - 1
    x1, y1 = np.ceil(pts.max(0)).astype(int) + 1
    X0, Y0, X1, Y1 = max(x0, 0), max(y0, 0), min(x1, frame.shape[1]), min(y1, frame.shape[0])
    if X1 <= X0 or Y1 <= Y0:
        return
    b = np.array([cx, cy], np.float32) - A @ np.array([w / 2, h / 2], np.float32) - [X0, Y0]
    M = np.hstack([A, b[:, None]])
    out = cv2.warpAffine(img, M, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    region = frame[Y0:Y1, X0:X1]
    a = out[..., 3:4] * opacity
    region *= 1 - a
    region += out[..., :3] * opacity


# ------------------------------------------------------------------ text ----
FONT_FILES = {
    "display": FONTS / "inter/InterDisplay-SemiBold.otf",
    "display-light": FONTS / "inter/InterDisplay-Light.otf",
    "display-medium": FONTS / "inter/InterDisplay-Medium.otf",
    "mono": Path("/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf"),
}


def _font_path(kind):
    p = FONT_FILES[kind]
    if p.exists():
        return str(p)
    import subprocess
    name = "JetBrains Mono:style=Medium" if kind == "mono" else "Inter Display"
    return subprocess.check_output(["fc-match", "-f", "%{file}", name]).decode()


@lru_cache(maxsize=512)
def text_sprite(text, kind="display", size=40, color=(240, 238, 230), tracking=0.0):
    """Render text at 2x and return a Sprite whose base scale shows it at `size` px."""
    ss = 2
    f = ImageFont.truetype(_font_path(kind), size * ss)
    widths = [f.getlength(ch) for ch in text]
    tw = sum(widths) + tracking * size * ss * max(len(text) - 1, 0)
    asc, desc = f.getmetrics()
    im = Image.new("RGBA", (int(tw) + 8 * ss, asc + desc + 8 * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 4 * ss
    for ch, cw in zip(text, widths):
        d.text((x, 4 * ss), ch, font=f, fill=tuple(color) + (255,))
        x += cw + tracking * size * ss
    return Sprite(np.asarray(im), base=1 / ss)


# ----------------------------------------------------------------- video ----
class Video:
    """Sequential-friendly frame reader addressed by time in seconds."""

    def __init__(self, path):
        self.cap = cv2.VideoCapture(str(path))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.pos = -1
        self.cur = None

    def frame(self, t):
        idx = int(np.clip(round(t * self.fps), 0, self.n - 1))
        if idx == self.pos:
            return self.cur
        if idx < self.pos or idx > self.pos + 30:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            self.pos = idx - 1
        while self.pos < idx:
            ok, img = self.cap.read()
            if not ok:
                break
            self.pos += 1
            self.cur = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        return self.cur


def place(src, scale, cx, cy, out_w=W, out_h=H, sharpen=0.0):
    """Scale `src` and position its centre at (cx, cy) on an out_w x out_h canvas."""
    sh, sw = src.shape[:2]
    if scale < 1:
        nw, nh = max(1, round(sw * scale)), max(1, round(sh * scale))
        src = cv2.resize(src, (nw, nh), interpolation=cv2.INTER_AREA)
        sx, sy = sw * scale / nw, sh * scale / nh
        interp = cv2.INTER_LINEAR
    else:
        sx = sy = scale
        interp = cv2.INTER_CUBIC
    h, w = src.shape[:2]
    M = np.float32([[sx, 0, cx - sx * w / 2], [0, sy, cy - sy * h / 2]])
    out = cv2.warpAffine(src, M, (out_w, out_h), flags=interp, borderMode=cv2.BORDER_REFLECT)
    if sharpen > 0:
        blur = cv2.GaussianBlur(out, (0, 0), 1.6)
        out = np.clip(out + (out - blur) * sharpen, 0, 1)
    return out


def blurred_cover(src, darken=0.4, sigma=10):
    """Cheap heavy blur of src scaled to cover the canvas."""
    sh, sw = src.shape[:2]
    small_h = 120
    small = cv2.resize(src, (round(sw * small_h / sh), small_h), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), sigma * small_h / 480)
    scale = max(W / small.shape[1], H / small.shape[0])
    return place(small, scale, W / 2, H / 2) * darken


# ----------------------------------------------------------------- masks ----
def rounded_rect_mask(w, h, x0, y0, x1, y1, r):
    """Anti-aliased rounded-rect coverage on a w x h grid (float32)."""
    ys = np.arange(h, dtype=np.float32)[:, None] + 0.5
    xs = np.arange(w, dtype=np.float32)[None, :] + 0.5
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    qx = np.abs(xs - cx) - ((x1 - x0) / 2 - r)
    qy = np.abs(ys - cy) - ((y1 - y0) / 2 - r)
    outside = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2)
    dist = outside + np.minimum(np.maximum(qx, qy), 0) - r
    return np.clip(0.5 - dist, 0, 1)


def shadow(frame, x0, y0, x1, y1, r, strength=0.6, spread=40):
    """Soft drop shadow under a rect (computed at 1/4 res)."""
    q = 4
    m = rounded_rect_mask(W // q, H // q, x0 / q, (y0 + spread * 0.4) / q, x1 / q, (y1 + spread * 0.4) / q, r / q)
    m = cv2.GaussianBlur(m, (0, 0), spread / q / 2)
    m = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)
    frame *= 1 - m[..., None] * strength
