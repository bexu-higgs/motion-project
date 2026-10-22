#!/usr/bin/env python3
"""Қосымша белгішесін (иконкасын) салу: от жалыны + нысана + қошқар мүйіз өрнегі.

usage: make_icon.py <res_dir>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

N = 1024


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def radial_bg():
    img = Image.new('RGBA', (N, N))
    px = img.load()
    c_in, c_out = (255, 170, 40), (120, 10, 20)
    for y in range(N):
        for x in range(N):
            d = math.hypot(x - N * 0.5, y - N * 0.42) / (N * 0.75)
            px[x, y] = lerp(c_in, c_out, min(1.0, d ** 0.9)) + (255,)
    return img


def flame(draw, cx, cy, s, color):
    pts = []
    for i in range(181):
        t = i / 180 * 2 * math.pi
        # Тамшы пішінді жалын, жоғарғы ұшы иілген
        r = s * (0.55 + 0.45 * math.sin(t / 2) ** 2.2)
        x = cx + r * 0.62 * math.sin(t) + s * 0.10 * math.sin(t * 3) * (1 - math.cos(t)) * 0.3
        y = cy - r * math.cos(t) * 0.95 + s * 0.35
        pts.append((x, y))
    draw.polygon(pts, fill=color)


def horn(draw, cx, cy, s, flip, color, width):
    # Қошқар мүйіз — спираль
    pts = []
    for i in range(90):
        t = i / 89
        a = t * 3.6 * math.pi
        r = s * (1 - t) ** 1.1
        x = cx + flip * r * math.cos(a)
        y = cy - r * math.sin(a)
        pts.append((x, y))
    draw.line(pts, fill=color, width=width, joint='curve')


def main():
    res = sys.argv[1]
    base = radial_bg()
    d = ImageDraw.Draw(base)

    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    flame(gd, N * 0.5, N * 0.47, N * 0.36, (255, 230, 120, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    base = Image.alpha_composite(base, glow)
    d = ImageDraw.Draw(base)

    flame(d, N * 0.5, N * 0.47, N * 0.33, (255, 120, 20, 255))
    flame(d, N * 0.5, N * 0.53, N * 0.22, (255, 200, 60, 255))
    flame(d, N * 0.5, N * 0.58, N * 0.12, (255, 250, 210, 255))

    # Нысана (прицел)
    gold = (255, 236, 170, 255)
    cx, cy, r = N * 0.5, N * 0.6, N * 0.30
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=gold, width=26)
    for ang in range(4):
        a = ang * math.pi / 2
        x1, y1 = cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62
        x2, y2 = cx + math.cos(a) * r * 1.22, cy + math.sin(a) * r * 1.22
        d.line([(x1, y1), (x2, y2)], fill=gold, width=26)
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(255, 255, 255, 255))

    # Мүйіз өрнегі төменгі бұрыштарда
    horn(d, N * 0.17, N * 0.86, N * 0.12, 1, gold, 18)
    horn(d, N * 0.83, N * 0.86, N * 0.12, -1, gold, 18)
    horn(d, N * 0.17, N * 0.16, N * 0.10, 1, gold, 14)
    horn(d, N * 0.83, N * 0.16, N * 0.10, -1, gold, 14)

    # Дөңгелектенген шаршы маска
    mask = Image.new('L', (N, N), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, N - 1, N - 1], radius=int(N * 0.22), fill=255)
    out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)

    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for k, s in sizes.items():
        p = os.path.join(res, 'mipmap-' + k)
        os.makedirs(p, exist_ok=True)
        out.resize((s, s), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'), optimize=True)
    big = sys.argv[2] if len(sys.argv) > 2 else None
    if big:
        out.resize((512, 512), Image.LANCZOS).save(big, optimize=True)
    print('icons ->', res)


if __name__ == '__main__':
    main()
