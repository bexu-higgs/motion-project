"""Сапа бақылауы: контакт-парақтар (кадрлар торы уақыт белгілерімен).

Агент бұл суреттерді «көреді»: бастапқы материалды таңдау үшін де, өз рендерін тексеру үшін де.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .. import ffmpeg
from .video import FONT_SEMI


def timecode(t: float, fps: float | None = None) -> str:
    t = max(0.0, t)
    m, s = divmod(t, 60)
    if fps:
        frames = int(round((t - int(t)) * fps))
        return f"{int(m):02d}:{int(s):02d}:{frames:02d}"
    return f"{int(m):02d}:{s:05.2f}"


def _font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(FONT_SEMI), size)
    except OSError:  # pragma: no cover
        return ImageFont.load_default()


def contact_sheet(path: str | Path, times: list[float], *, labels: list[str] | None = None, cols: int = 4,
                  tile_w: int = 320, is_image: bool = False, title: str = "", marks: list[str] | None = None
                  ) -> Image.Image:
    """Берілген уақыттардағы кадрлардан тор жасау."""
    times = list(times)
    labels = labels or [timecode(t) for t in times]

    def grab(t: float) -> np.ndarray | None:
        try:
            return ffmpeg.grab_frame(path, t, tile_w, is_image=is_image)
        except ffmpeg.FFmpegError:
            return None

    with ThreadPoolExecutor(max_workers=4) as ex:
        frames = list(ex.map(grab, times))
    ok = [f for f in frames if f is not None]
    tile_h = ok[0].shape[0] if ok else int(tile_w * 9 / 16)
    cols = max(1, min(cols, len(times)))
    rows = max(1, (len(times) + cols - 1) // cols)
    head = 34 if title else 0
    gap = 4
    sheet = Image.new("RGB", (cols * tile_w + (cols + 1) * gap, head + rows * (tile_h + gap) + gap), (18, 18, 22))
    draw = ImageDraw.Draw(sheet)
    if title:
        draw.text((10, 7), title, fill=(235, 235, 240), font=_font(18))
    f_lab = _font(max(12, tile_w // 20))
    for i, (fr, lab) in enumerate(zip(frames, labels)):
        r, c = divmod(i, cols)
        x = gap + c * (tile_w + gap)
        y = head + gap + r * (tile_h + gap)
        if fr is not None:
            img = Image.fromarray(fr)
            if img.height != tile_h:
                img = img.resize((tile_w, tile_h))
            sheet.paste(img, (x, y))
        else:
            draw.rectangle([x, y, x + tile_w, y + tile_h], fill=(60, 20, 20))
        tw = draw.textlength(lab, font=f_lab)
        draw.rectangle([x, y + tile_h - f_lab.size - 8, x + tw + 12, y + tile_h], fill=(0, 0, 0))
        draw.text((x + 6, y + tile_h - f_lab.size - 5), lab, fill=(255, 220, 90), font=f_lab)
        if marks and i < len(marks) and marks[i]:
            mw = draw.textlength(marks[i], font=f_lab)
            draw.rectangle([x + tile_w - mw - 12, y, x + tile_w, y + f_lab.size + 8], fill=(200, 40, 60))
            draw.text((x + tile_w - mw - 6, y + 3), marks[i], fill=(255, 255, 255), font=f_lab)
    return sheet


def to_jpeg_bytes(img: Image.Image, max_side: int = 1568, quality: int = 80) -> bytes:
    if max(img.size) > max_side:
        k = max_side / max(img.size)
        img = img.resize((int(img.width * k), int(img.height * k)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def sample_times(start: float, end: float, n: int) -> list[float]:
    if end <= start:
        return [start]
    n = max(1, n)
    step = (end - start) / n
    return [round(start + step * (i + 0.5), 3) for i in range(n)]
