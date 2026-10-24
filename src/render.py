"""Render the 9:16 intro: Claude Code x Blender blockout -> Higgsfield Genjutsu result.

    python3 src/render.py                      # full video -> out/final.mp4
    python3 src/render.py --stills 1.5,5,12    # PNG stills -> out/stills/
    python3 src/render.py --start 0 --end 6    # partial render
"""
import argparse
import json
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from fx import (H, W, Sprite, Video, blurred_cover, clamp01, in_out_cubic,  # noqa: E402
                lerp, out_back, out_cubic, out_expo, paste, place, prog,
                rounded_rect_mask, shadow, text_sprite)

ROOT = Path(__file__).resolve().parent.parent
LOGOS = ROOT / "assets" / "logos"
OUT = ROOT / "out"
FPS = 30

# ------------------------------------------------------------- timeline ----
STORY0 = 3.9           # screen time at which both source clips are at t=0 (they are frame-aligned)
T_MORPH = (3.15, 4.0)  # intro stack -> header row
T_CARD = (3.75, 4.65)    # blockout card rises in
T_HIGGS = 9.9          # "+ Higgsfield Genjutsu" joins the header
T_WIPE = (11.0, 12.3)  # blockout -> realistic wipe on the card
T_OUTRO = 33.2         # card leaves, header settles into the end lockup
DURATION = 37.6

CREAM = (240, 238, 230)
ORANGE = (217, 119, 87)
LIME = np.array([212, 255, 0], np.float32) / 255

CARD = (40, 719, 1040, 719 + 1000 * 1078 / 1920)  # x0, y0, x1, y1
CARD_R = 30

def story(t):
    return t - STORY0


# --------------------------------------------------------------- assets ----
class Assets:
    def __init__(self):
        lay = json.loads((LOGOS / "layout.json").read_text())
        self.spr = {n: Sprite.load(LOGOS / f"{n}.png", base=0.5)
                    for n in ("claude_mark", "claude_word", "blender_mark", "blender_word")}
        higgs = Sprite.load(LOGOS / "higgsfield.png")
        higgs.base = 1.0 / higgs.w  # scale == display width in px
        self.higgs = higgs
        self.lockups = {}
        for brand in ("claude", "blender"):
            boxes = {p: lay[f"{brand}_{p}.png"] for p in ("mark", "word")}
            x0 = min(b[0] for b in boxes.values())
            x1 = max(b[2] for b in boxes.values())
            y0 = min(b[1] for b in boxes.values())
            y1 = max(b[3] for b in boxes.values())
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            self.lockups[brand] = {
                "width": x1 - x0,
                "pieces": {p: ((b[0] + b[2]) / 2 - cx, (b[1] + b[3]) / 2 - cy) for p, b in boxes.items()},
            }
        self.blockout = Video(ROOT / "assets/video/reference_blender.mp4")
        self.result = Video(ROOT / "assets/video/result_genjutsu.mp4")
        self.bg = make_background()
        rng = np.random.default_rng(7)
        self.grain = [rng.normal(0, 0.007, (H, W, 1)).astype(np.float32) for _ in range(6)]


def make_background():
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.array([11, 11, 14], np.float32) / 255
    glow = np.exp(-(((xs - 540) / 700) ** 2 + ((ys - 880) / 820) ** 2))[..., None]
    warm = np.array(ORANGE, np.float32) / 255
    vign = 1 - 0.55 * np.clip(np.sqrt(((xs - 540) / 760) ** 2 + ((ys - 960) / 1250) ** 2) - 0.35, 0, 1)[..., None]
    return ((base + warm * 0.07 * glow) * vign).astype(np.float32)


def draw_lockup(frame, a, brand, cx, cy, k, mark=None, word=None, opacity=1.0):
    """mark/word: dicts of per-piece overrides (scale, rot, opacity, wipe, dx, dy)."""
    for piece, over in (("mark", mark or {}), ("word", word or {})):
        ox, oy = a.lockups[brand]["pieces"][piece]
        paste(frame, a.spr[f"{brand}_{piece}"],
              cx + ox * k + over.get("dx", 0), cy + oy * k + over.get("dy", 0),
              scale=k * over.get("scale", 1.0), rot=over.get("rot", 0.0),
              opacity=opacity * over.get("opacity", 1.0), wipe=over.get("wipe"))


# --------------------------------------------------------------- layout ----
# A: stacked intro; B: header row above the card; C: outro
A = {"claude": (540, 790, 0.57), "x": (540, 1022, 1.0), "blender": (540, 1192, 0.56)}


def row_layout(y, k, xsize):
    cw = 1296 * k
    bw = 1233.5 * k
    gap = 30 + 60 * k
    xw = 30 * xsize
    total = cw + bw + 2 * gap + xw
    left = 540 - total / 2
    return {"claude": (left + cw / 2, y, k), "x": (left + cw + gap + xw / 2, y, xsize),
            "blender": (left + cw + 2 * gap + xw + bw / 2, y, k)}


def header_y(t):
    return lerp(470, 390, in_out_cubic(prog(t, T_HIGGS - 0.3, T_HIGGS + 0.4)))


# ---------------------------------------------------------------- scenes ----
def outro_mix(t):
    """0 -> 1 as the header settles into the centred end lockup."""
    return in_out_cubic(prog(t, T_OUTRO + 0.25, T_OUTRO + 1.35))


def logos_stage(frame, a, t):
    """Intro reveal, morph into the header, header life, then the centred end lockup."""
    breathe = 1 + 0.025 * out_cubic(prog(t, 0, T_MORPH[0]))
    o = outro_mix(t)
    settle = 1 + 0.02 * out_cubic(prog(t, T_OUTRO + 1.35, DURATION))
    hy = lerp(header_y(t), 800, o)
    B = row_layout(hy, lerp(0.30, 0.33, o) * settle, lerp(0.9, 1.0, o) * settle)

    def pos(name, stagger):
        m = in_out_cubic(prog(t, T_MORPH[0] + stagger, T_MORPH[1] + stagger))
        ax, ay, ak = A[name]
        ax, ay = 540 + (ax - 540) * breathe, 960 + (ay - 960) * breathe
        bx, by, bk = B[name]
        return lerp(ax, bx, m), lerp(ay, by, m), lerp(ak * breathe, bk, m)

    # "MADE WITH"
    mw_op = out_cubic(prog(t, 0.15, 0.6)) * (1 - prog(t, 2.95, 3.3))
    paste(frame, text_sprite("MADE WITH", "display-medium", 34, CREAM, 0.32),
          540, 610 + 18 * (1 - out_cubic(prog(t, 0.15, 0.7))), opacity=0.55 * mw_op)

    # Claude
    x, y, k = pos("claude", 0.0)
    p = prog(t, 0.2, 1.0)
    pw = out_cubic(prog(t, 0.55, 1.25))
    draw_lockup(frame, a, "claude", x, y, k,
                mark={"scale": out_back(p, 1.6), "rot": -140 * (1 - out_cubic(p)), "opacity": prog(t, 0.2, 0.35)},
                word={"wipe": pw, "dx": -30 * (1 - pw)})

    # "> claude code" typed under the Claude lockup
    code = "> claude code"
    n = int(round(len(code) * prog(t, 1.05, 1.6)))
    code_op = (1 - prog(t, 2.95, 3.3))
    if n and code_op > 0:
        cx0 = 540 - text_sprite(code, "mono", 38, ORANGE).size()[0] / 2
        spr = text_sprite(code[:n], "mono", 38, ORANGE)
        sw, sh = spr.size()
        paste(frame, spr, cx0 + sw / 2, 925, opacity=code_op)
        if (t * 2.2) % 1 < 0.6 or n < len(code):  # cursor
            frame[925 - 19:925 + 21, int(cx0 + sw):int(cx0 + sw) + 18] = \
                frame[925 - 19:925 + 21, int(cx0 + sw):int(cx0 + sw) + 18] * (1 - 0.85 * code_op) \
                + np.array(ORANGE, np.float32) / 255 * 0.85 * code_op

    # ×
    x, y, k = pos("x", 0.04)
    p = prog(t, 1.15, 1.55)
    paste(frame, text_sprite("×", "display-light", 84, CREAM), x, y,
          scale=k * lerp(0.4, 1, out_back(p)), rot=90 * (1 - out_cubic(p)),
          opacity=0.7 * prog(t, 1.15, 1.3))

    # Blender
    x, y, k = pos("blender", 0.08)
    p = prog(t, 1.35, 2.1)
    pw = out_cubic(prog(t, 1.65, 2.35))
    draw_lockup(frame, a, "blender", x, y, k,
                mark={"scale": out_back(p, 1.5), "rot": 160 * (1 - out_cubic(p)), "opacity": prog(t, 1.35, 1.5)},
                word={"wipe": pw, "dx": -30 * (1 - pw)})

    # "+ Higgsfield Genjutsu"
    p = prog(t, T_HIGGS, T_HIGGS + 0.4)
    paste(frame, text_sprite("+", "display-light", 70, CREAM), 540, lerp(hy + 92, 935, o),
          scale=lerp(0.3, 1, out_back(p)) * lerp(1, 76 / 70, o) * settle, opacity=0.75 * clamp01(p * 3))
    p = prog(t, T_HIGGS + 0.12, T_HIGGS + 0.75)
    paste(frame, a.higgs, 540, lerp(hy + 212, 1085, o) + 30 * (1 - out_cubic(p)),
          scale=lerp(430, 540, o) * settle * lerp(0.7, 1, out_back(p, 2.0)), opacity=clamp01(p * 3))


def card_stage(frame, a, t):
    if t < T_CARD[0]:
        return
    s = story(max(t, STORY0))
    x0, y0, x1, y1 = CARD
    cw, ch = x1 - x0, y1 - y0
    wipe = in_out_cubic(prog(t, *T_WIPE))

    # card entry / exit
    p = out_expo(prog(t, *T_CARD))
    leave = in_out_cubic(prog(t, T_OUTRO, T_OUTRO + 0.7))
    vis = prog(t, T_CARD[0], T_CARD[0] + 0.3) * (1 - leave)
    if vis <= 0:
        return
    dy = 140 * (1 - p) + 60 * leave
    k = (0.92 + 0.08 * p) * (1 - 0.06 * leave)

    blk = a.blockout.frame(s) if wipe < 1 else None
    res = a.result.frame(s) if wipe > 0 else None

    # ambient blurred fill behind the card
    fill = blurred_cover(res if wipe > 0.5 else blk, darken=0.45)
    frame += (fill - frame) * (0.55 * vis)

    ccx, ccy = (x0 + x1) / 2, (y0 + y1) / 2 + dy
    rx0, rx1 = ccx - cw / 2 * k, ccx + cw / 2 * k
    ry0, ry1 = ccy - ch / 2 * k, ccy + ch / 2 * k
    vscale = cw / 1920 * k

    shadow(frame, rx0, ry0, rx1, ry1, CARD_R, strength=0.55 * vis, spread=60)

    vid_res = place(res, vscale, ccx, ccy) if res is not None else None
    vid_blk = place(blk, vscale * 1920 / 1280, ccx, ccy) if blk is not None else None

    if vid_blk is not None and vid_res is not None:
        ys = np.arange(H, dtype=np.float32)[:, None]
        xs = np.arange(W, dtype=np.float32)[None, :]
        span = (rx1 - rx0) + 0.18 * ch + 60
        bx = rx0 - 0.09 * ch - 30 + span * wipe + (ys - ccy) * -0.18
        d = xs - bx
        m = np.clip(0.5 - d / 2.0, 0, 1)[..., None]
        vid = vid_res * m + vid_blk * (1 - m)
        glow = (np.exp(-(d / 5.0) ** 2) * 0.9 + np.exp(-(d / 40.0) ** 2) * 0.28)[..., None]
        vid = np.clip(vid + glow * LIME * np.sin(np.pi * wipe) ** 0.5, 0, 1)
    else:
        vid = vid_res if vid_res is not None else vid_blk

    mask = rounded_rect_mask(W, H, rx0, ry0, rx1, ry1, CARD_R * k)[..., None] * vis
    frame *= 1 - mask
    frame += vid * mask

    # label under the card
    lab_op = prog(t, 4.2, 4.6) * (1 - prog(t, T_OUTRO, T_OUTRO + 0.35))
    if lab_op > 0:
        ly = y1 + 52 + dy
        sw_ = prog(t, T_WIPE[0] + 0.5, T_WIPE[0] + 0.7)
        for txt, op, ddy in (("01  BLOCKOUT", 1 - sw_, -14 * sw_), ("02  REALISTIC", sw_, 14 * (1 - sw_))):
            spr = text_sprite(txt, "mono", 28, CREAM, 0.06)
            paste(frame, spr, x0 + spr.size()[0] / 2 - 4, ly + ddy, opacity=0.8 * op ** 2 * lab_op)
        tc = f"00:{int(min(max(s, 0), 29)):02d}"
        spr = text_sprite(tc, "mono", 28, CREAM, 0.06)
        paste(frame, spr, x1 - spr.size()[0] / 2 + 4, ly, opacity=0.45 * lab_op)
        # status dot: orange for Claude/Blender, lime once Genjutsu takes over
        dot = np.array(ORANGE, np.float32) / 255 * (1 - sw_) + LIME * sw_
        dx = x1 - spr.size()[0] - 14
        pulse = 0.55 + 0.45 * np.cos(t * 5) ** 2
        yy, xx = np.mgrid[int(ly) - 10:int(ly) + 11, int(dx) - 10:int(dx) + 11]
        cov = np.clip(7.5 - np.sqrt((xx - dx) ** 2 + (yy - ly) ** 2), 0, 1)[..., None] * lab_op * pulse
        frame[int(ly) - 10:int(ly) + 11, int(dx) - 10:int(dx) + 11] *= 1 - cov
        frame[int(ly) - 10:int(ly) + 11, int(dx) - 10:int(dx) + 11] += dot * cov


def render_frame(a, t):
    frame = a.bg.copy()
    card_stage(frame, a, t)
    logos_stage(frame, a, t)
    frame += a.grain[int(t * FPS) % len(a.grain)] * (1 - 0.6 * prog(t, T_CARD[0], T_CARD[1]))
    fade = min(prog(t, 0, 0.4), 1 - prog(t, DURATION - 0.45, DURATION))
    frame *= fade
    return (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---------------------------------------------------------------- output ----
def encode_segment(args):
    f0, f1, path = args
    a = Assets()
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "16M", "-bufsize", "32M",
           "-pix_fmt", "yuv420p", "-g", str(FPS), str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(f0, f1):
        proc.stdin.write(render_frame(a, f / FPS).tobytes())
    proc.stdin.close()
    proc.wait()
    return path


def render_video(start, end, out, workers):
    f0, f1 = int(round(start * FPS)), int(round(end * FPS))
    tmp = OUT / "segments"
    tmp.mkdir(parents=True, exist_ok=True)
    bounds = np.linspace(f0, f1, workers + 1).astype(int)
    jobs = [(bounds[i], bounds[i + 1], tmp / f"seg{i:02d}.mp4") for i in range(workers)]
    with ProcessPoolExecutor(workers) as ex:
        paths = list(ex.map(encode_segment, jobs))
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in paths))
    silent = tmp / "video.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c", "copy", str(silent)], check=True)
    return silent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=DURATION)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", default=str(OUT / "final.mp4"))
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    if args.stills:
        from PIL import Image
        a = Assets()
        d = OUT / "stills"
        d.mkdir(exist_ok=True)
        for ts in args.stills.split(","):
            Image.fromarray(render_frame(a, float(ts))).save(d / f"t{float(ts):05.2f}.png")
        print("stills ->", d)
        return
    silent = render_video(args.start, args.end, Path(args.out), args.workers)
    import audio
    out = Path(args.out)
    audio.mux(silent, out, args.start, args.end)
    alt = out.with_name(out.stem + "_no_sfx" + out.suffix)  # clip sound only, no sound design
    audio.mux(silent, alt, args.start, args.end, sfx=False)
    print("->", out, "+", alt.name)


if __name__ == "__main__":
    main()
