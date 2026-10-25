"""Әр UNO картасының стикер суретін Pillow арқылы салу.

Іске қосу:  python -m unobot.images
Нәтиже:     assets/cards/<кілт>.png  (Telegram стикер талаптары: PNG, биіктігі 512 px)
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from .cards import (
    COLORED_WILD_KEYS,
    COLORS,
    DRAW_TWO,
    FACE_KEYS,
    OPTION_KEYS,
    REVERSE,
    SKIP,
    WILD,
    WILD_DRAW_FOUR,
    WILDS,
    grey_key,
)
from .config import ASSETS_DIR

W, H = 336, 512
SS = 2  # тегіс жиектер үшін екі есе үлкен салып, кейін кішірейтеміз
MARGIN = 16

PALETTE = {
    "red": (226, 35, 26),
    "yellow": (252, 199, 0),
    "green": (40, 160, 70),
    "blue": (0, 110, 190),
}
BLACK = (24, 24, 24)
WHITE = (255, 255, 255)
SLATE = (69, 90, 100)
OVAL_ANGLE = -28

FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf",
    "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "DejaVuSans-Bold.ttf",
)
LABEL_FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/inter/Inter-Black.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "DejaVuSans-Bold.ttf",
)


def _load_font(candidates: tuple[str, ...], size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def _font(size: int) -> ImageFont.FreeTypeFont:
    return _load_font(FONT_CANDIDATES, size)


def _label_font(size: int) -> ImageFont.FreeTypeFont:
    return _load_font(LABEL_FONT_CANDIDATES, size)


def _s(value: float) -> int:
    return int(round(value * SS))


def _blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def _outlined(layer: Image.Image, width: int, shadow: int = 0) -> Image.Image:
    """Белгінің айналасына қара жиек және көлеңке қосу."""
    alpha = layer.getchannel("A")
    grown = alpha
    for _ in range(width):
        grown = grown.filter(ImageFilter.MaxFilter(3))
    out = _blank(*layer.size)
    black = Image.new("RGBA", layer.size, BLACK + (255,))
    if shadow:
        out.paste(black, (shadow, shadow), grown)
    out.paste(black, (0, 0), grown)
    out.alpha_composite(layer)
    return out


def _text_layer(text: str, box_w: int, box_h: int, fill, font_factory=_font) -> Image.Image:
    """Мәтінді берілген қорапқа сыйғызып салу."""
    size = box_h * 2
    while size > 8:
        font = font_factory(size)
        left, top, right, bottom = font.getbbox(text)
        if right - left <= box_w and bottom - top <= box_h:
            break
        size = int(size * 0.94)
    layer = _blank(box_w, box_h)
    draw = ImageDraw.Draw(layer)
    left, top, right, bottom = font.getbbox(text)
    x = (box_w - (right - left)) / 2 - left
    y = (box_h - (bottom - top)) / 2 - top
    draw.text((x, y), text, font=font, fill=fill)
    if text in ("6", "9"):
        # 6 мен 9-ды ажырату үшін астын сызамыз
        bar_h = max(2, (bottom - top) // 12)
        y0 = y + bottom + bar_h
        draw.rectangle((x + left, y0, x + right, y0 + bar_h), fill=fill)
    return layer


def _skip_layer(size: int, fill) -> Image.Image:
    layer = _blank(size, size)
    draw = ImageDraw.Draw(layer)
    pad = size * 0.12
    ring = size * 0.15
    draw.ellipse((pad, pad, size - pad, size - pad), outline=fill, width=int(ring))
    c = size / 2
    r = size / 2 - pad - ring / 2
    dx = r * math.cos(math.radians(45))
    draw.line((c - dx, c + dx, c + dx, c - dx), fill=fill, width=int(ring))
    return layer


def _arrow_points(length: float, shaft: float, head_len: float, head_w: float) -> list[tuple[float, float]]:
    half = length / 2
    return [
        (-half, -shaft / 2),
        (half - head_len, -shaft / 2),
        (half - head_len, -head_w / 2),
        (half, 0),
        (half - head_len, head_w / 2),
        (half - head_len, shaft / 2),
        (-half, shaft / 2),
    ]


def _transform(points, angle_deg: float, dx: float, dy: float):
    a = math.radians(angle_deg)
    cos_a, sin_a = math.cos(a), math.sin(a)
    return [(x * cos_a - y * sin_a + dx, x * sin_a + y * cos_a + dy) for x, y in points]


def _reverse_layer(size: int, fill) -> Image.Image:
    layer = _blank(size, size)
    draw = ImageDraw.Draw(layer)
    c = size / 2
    arrow = _arrow_points(size * 0.74, size * 0.15, size * 0.24, size * 0.36)
    offset = size * 0.2
    # бірі жоғары-оңға, екіншісі төмен-солға қарайды
    nx, ny = math.cos(math.radians(45)), math.sin(math.radians(45))
    draw.polygon(_transform(arrow, -45, c - offset * nx, c - offset * ny), fill=fill)
    draw.polygon(_transform(arrow, 135, c + offset * nx, c + offset * ny), fill=fill)
    return layer


def _chevrons_layer(size: int, fill) -> Image.Image:
    layer = _blank(size, size)
    draw = ImageDraw.Draw(layer)
    t = size * 0.17
    for shift in (-size * 0.2, size * 0.14):
        x0 = size * 0.32 + shift
        pts = [
            (x0, size * 0.18),
            (x0 + t, size * 0.18),
            (x0 + t + size * 0.3, size * 0.5),
            (x0 + t, size * 0.82),
            (x0, size * 0.82),
            (x0 + size * 0.3, size * 0.5),
        ]
        draw.polygon(pts, fill=fill)
    return layer


def _oval_mask(w: int, h: int, ow: float, oh: float, angle: float = OVAL_ANGLE) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse(((w - ow) / 2, (h - oh) / 2, (w + ow) / 2, (h + oh) / 2), fill=255)
    return mask.rotate(angle, resample=Image.BICUBIC, center=(w / 2, h / 2))


def _quadrant_fill(w: int, h: int, angle: float = OVAL_ANGLE) -> Image.Image:
    """Wild картасының төрт түсті сопақшасы."""
    layer = Image.new("RGBA", (w, h), BLACK + (255,))
    draw = ImageDraw.Draw(layer)
    cx, cy = w / 2, h / 2
    draw.rectangle((0, 0, cx, cy), fill=PALETTE["red"])
    draw.rectangle((cx, 0, w, cy), fill=PALETTE["blue"])
    draw.rectangle((0, cy, cx, h), fill=PALETTE["yellow"])
    draw.rectangle((cx, cy, w, h), fill=PALETTE["green"])
    return layer.rotate(angle, resample=Image.BICUBIC, center=(cx, cy))


def _mini_oval(size: int, color: str | None) -> Image.Image:
    """Wild карталарының бұрышындағы кішкентай сопақша."""
    w, h = size, size
    mask = _oval_mask(w, h, w * 0.62, h * 0.95)
    fill = _quadrant_fill(w, h) if color is None else Image.new("RGBA", (w, h), PALETTE[color] + (255,))
    layer = _blank(w, h)
    layer.paste(fill, (0, 0), mask)
    return layer


def _symbol(value: str, fill, box: int, wild_color: str | None = None) -> Image.Image:
    if value == SKIP:
        return _skip_layer(box, fill)
    if value == REVERSE:
        return _reverse_layer(box, fill)
    if value == DRAW_TWO:
        return _text_layer("+2", box, int(box * 0.8), fill)
    if value == WILD_DRAW_FOUR:
        return _text_layer("+4", box, int(box * 0.8), fill)
    if value == WILD:
        return _mini_oval(box, wild_color)
    return _text_layer(value, int(box * 0.8), box, fill)


class _Canvas:
    """Бір картаның суретін құрастыруға арналған көмекші."""

    def __init__(self, inner_color) -> None:
        self.w, self.h = _s(W), _s(H)
        self.img = _blank(self.w, self.h)
        draw = ImageDraw.Draw(self.img)
        draw.rounded_rectangle(
            (_s(1), _s(1), self.w - _s(1), self.h - _s(1)),
            radius=_s(34),
            fill=WHITE,
            outline=(60, 60, 60),
            width=_s(2.5),
        )
        m = _s(MARGIN)
        self.inner_box = (m, m, self.w - m, self.h - m)
        self.inner_mask = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(self.inner_mask).rounded_rectangle(self.inner_box, radius=_s(22), fill=255)
        self.img.paste(Image.new("RGBA", (self.w, self.h), inner_color + (255,)), (0, 0), self.inner_mask)

    def oval(self, fill_layer: Image.Image, ow: float = 0.76, oh: float = 0.94) -> None:
        iw = self.inner_box[2] - self.inner_box[0]
        ih = self.inner_box[3] - self.inner_box[1]
        mask = _oval_mask(self.w, self.h, iw * ow, ih * oh)
        mask = Image.composite(mask, Image.new("L", mask.size, 0), self.inner_mask)
        self.img.paste(fill_layer, (0, 0), mask)

    def center(self, layer: Image.Image, outline: int = 7, shadow: int = 9, dy: int = 0) -> None:
        pad = outline + shadow + 2
        padded = _blank(layer.width + 2 * pad, layer.height + 2 * pad)
        padded.paste(layer, (pad, pad))
        out = _outlined(padded, outline, shadow)
        x = (self.w - out.width) // 2
        y = (self.h - out.height) // 2 + dy
        self.img.alpha_composite(out, (x, y))

    def corners(self, layer: Image.Image) -> None:
        pad = 7
        padded = _blank(layer.width + 2 * pad, layer.height + 2 * pad)
        padded.paste(layer, (pad, pad))
        out = _outlined(padded, 3, 4)
        x = y = _s(MARGIN + 4)
        self.img.alpha_composite(out, (x, y))
        flipped = out.rotate(180)
        self.img.alpha_composite(flipped, (self.w - x - out.width, self.h - y - out.height))

    def banner(self, text: str) -> None:
        bw, bh = _s(270), _s(66)
        x0 = (self.w - bw) // 2
        y0 = self.h - _s(MARGIN) - bh - _s(22)
        draw = ImageDraw.Draw(self.img)
        draw.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), radius=_s(18), fill=WHITE, outline=BLACK, width=_s(4))
        label = _text_layer(text, bw - _s(28), bh - _s(22), BLACK, _label_font)
        self.img.alpha_composite(label, (x0 + _s(14), y0 + _s(11)))

    def result(self) -> Image.Image:
        return self.img.resize((W, H), Image.LANCZOS)


def _white(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), WHITE + (255,))


def render_face(key: str) -> Image.Image:
    """54 негізгі карта бетінің бірі: red_5, blue_skip, wild, wild4 ..."""
    if key in WILDS:
        return _render_wild(key, None)
    color, _, value = key.partition("_")
    rgb = PALETTE[color]
    canvas = _Canvas(rgb)
    canvas.oval(_white(canvas.w, canvas.h))
    canvas.center(_symbol(value, rgb, _s(205)))
    canvas.corners(_symbol(value, WHITE, _s(70)))
    return canvas.result()


def _render_wild(value: str, color: str | None) -> Image.Image:
    canvas = _Canvas(BLACK)
    if color is None:
        canvas.oval(_quadrant_fill(canvas.w, canvas.h))
    else:
        canvas.oval(Image.new("RGBA", (canvas.w, canvas.h), PALETTE[color] + (255,)))
    if value == WILD_DRAW_FOUR:
        canvas.center(_symbol(WILD_DRAW_FOUR, WHITE, _s(200)))
        canvas.corners(_symbol(WILD_DRAW_FOUR, WHITE, _s(70)))
    else:
        canvas.corners(_mini_oval(_s(70), color))
    return canvas.result()


def render_colored_wild(key: str) -> Image.Image:
    """Түсі таңдалған Wild: wild_red, wild4_blue ..."""
    value, _, color = key.partition("_")
    return _render_wild(value, color)


def render_option(key: str) -> Image.Image:
    if key == "option_draw":
        canvas = _Canvas(BLACK)
        canvas.oval(Image.new("RGBA", (canvas.w, canvas.h), PALETTE["red"] + (255,)), ow=0.8, oh=0.8)
        uno = _text_layer("UNO", _s(240), _s(120), PALETTE["yellow"]).rotate(18, expand=True, resample=Image.BICUBIC)
        canvas.center(uno, outline=6, shadow=7, dy=-_s(30))
        canvas.banner("КАРТА АЛУ")
    elif key == "option_pass":
        canvas = _Canvas(SLATE)
        canvas.oval(_white(canvas.w, canvas.h), ow=0.8, oh=0.8)
        canvas.center(_chevrons_layer(_s(190), SLATE), dy=-_s(30))
        canvas.banner("ӨТКІЗУ")
    elif key == "option_uno":
        canvas = _Canvas(PALETTE["red"])
        canvas.oval(Image.new("RGBA", (canvas.w, canvas.h), PALETTE["yellow"] + (255,)))
        uno = _text_layer("UNO!", _s(250), _s(120), PALETTE["red"]).rotate(18, expand=True, resample=Image.BICUBIC)
        canvas.center(uno, outline=6, shadow=8)
    else:
        raise ValueError(key)
    return canvas.result()


def to_grey(img: Image.Image) -> Image.Image:
    """Ойнауға болмайтын карталарға арналған сұр нұсқа."""
    alpha = img.getchannel("A")
    grey = ImageOps.grayscale(img.convert("RGB")).convert("RGB")
    grey = Image.blend(grey, Image.new("RGB", grey.size, WHITE), 0.45)
    grey.putalpha(alpha)
    return grey


def render(key: str) -> Image.Image:
    if key.startswith("grey_"):
        return to_grey(render(key[len("grey_") :]))
    if key in COLORED_WILD_KEYS:
        return render_colored_wild(key)
    if key in OPTION_KEYS:
        return render_option(key)
    return render_face(key)


def all_keys() -> list[str]:
    return list(FACE_KEYS) + list(COLORED_WILD_KEYS) + list(OPTION_KEYS) + [grey_key(k) for k in FACE_KEYS]


def generate(out_dir: Path = ASSETS_DIR) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    cache: dict[str, Image.Image] = {}
    paths = []
    for key in all_keys():
        if key.startswith("grey_"):
            img = to_grey(cache[key[len("grey_") :]])
        else:
            img = cache[key] = render(key)
        path = out_dir / f"{key}.png"
        img.save(path, optimize=True)
        paths.append(path)
    return paths


def contact_sheet(keys: list[str], out: Path, columns: int = 13, scale: float = 0.36) -> None:
    """README үшін барлық карталардың жиынтық суреті."""
    cw, ch = int(W * scale), int(H * scale)
    gap = 8
    rows = math.ceil(len(keys) / columns)
    sheet = Image.new("RGB", (columns * (cw + gap) + gap, rows * (ch + gap) + gap), (236, 239, 241))
    for i, key in enumerate(keys):
        img = Image.open(ASSETS_DIR / f"{key}.png").convert("RGBA").resize((cw, ch), Image.LANCZOS)
        x = gap + (i % columns) * (cw + gap)
        y = gap + (i // columns) * (ch + gap)
        sheet.paste(img, (x, y), img)
    sheet.save(out, optimize=True)


if __name__ == "__main__":
    written = generate()
    print(f"{len(written)} сурет жасалды: {ASSETS_DIR}")
    preview_keys = [f"{c.value}_{v}" for c in COLORS for v in ("0", "6", "9", SKIP, REVERSE, DRAW_TWO)]
    preview_keys += [WILD, WILD_DRAW_FOUR] + list(COLORED_WILD_KEYS) + list(OPTION_KEYS)
    preview_keys += ["grey_red_7", "grey_wild4"]
    contact_sheet(preview_keys, ASSETS_DIR.parent / "preview.png", columns=12)
