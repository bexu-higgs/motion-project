"""yt-dlp форматтарынан сапалар тізімін жасау және ең жақсы форматты таңдау.

Бұл модуль Telegram-ға да, желіге де тәуелсіз: тек yt-dlp қайтаратын формат сөздіктерімен жұмыс істейді.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

# Су белгісі бар (TikTok «download» форматы), ойнатылмайтын немесе жабық форматтар.
BAD_MARKERS = ("watermark", "unplayable", "storyboard", "premium")
AUDIO_EXTS = {"m4a", "mp3", "aac", "opus", "ogg", "oga", "wav", "flac", "weba", "mka"}
MP3_KBPS = 192


@dataclass(frozen=True)
class Option:
    """Пайдаланушыға ұсынылатын бір нұсқа: видео сапасы немесе аудио."""

    key: str  # "v1080", "mp3", "m4a"
    kind: str  # "video" | "audio"
    label: str  # "1080p60", "MP3"
    quality: int  # видео үшін 1080, 720…; аудио үшін 0
    format: str  # yt-dlp формат жолы, мысалы "137+140"
    size: int | None  # болжамды өлшем (байт); белгісіз болса None
    ext: str = "mp4"

    def fits(self, limit: int) -> bool:
        return self.size is None or self.size <= limit


class NothingFits(Exception):
    """Бірде-бір нұсқа өлшем шегіне сыймайды (empty=True — сұралған түрдегі нұсқа мүлде жоқ)."""

    def __init__(self, smallest: int | None, empty: bool = False):
        super().__init__(smallest)
        self.smallest = smallest
        self.empty = empty


def _text(f: dict, key: str) -> str:
    return str(f.get(key) or "").lower()


def is_usable(f: dict) -> bool:
    marks = f"{_text(f, 'format_note')} {_text(f, 'format_id')}"
    if any(marker in marks for marker in BAD_MARKERS):
        return False
    if f.get("has_drm") or "mhtml" in (_text(f, "ext"), _text(f, "protocol")):
        return False
    return _text(f, "vcodec") != "bytevc2"


def has_video(f: dict) -> bool:
    vcodec = f.get("vcodec")
    if vcodec is None:  # белгісіз: аудио кеңейтімі болмаса, видео деп санаймыз
        return _text(f, "ext") not in AUDIO_EXTS
    return vcodec != "none"


def has_audio(f: dict) -> bool:
    return f.get("acodec") != "none"


def is_audio_only(f: dict) -> bool:
    return not has_video(f) and has_audio(f)


def is_m4a(f: dict) -> bool:
    return _text(f, "ext") == "m4a" or _text(f, "acodec").startswith(("mp4a", "aac"))


def size_of(f: dict | None, duration: float | None = None) -> int | None:
    if not f:
        return None
    for key in ("filesize", "filesize_approx"):
        if f.get(key):
            return int(f[key])
    tbr = f.get("tbr")
    if tbr and duration:
        return int(tbr * 125 * duration)  # кбит/с → байт
    return None


def quality_of(f: dict) -> int:
    """YouTube-тағыдай сапа саны: 1080, 720… (тік видеода — қысқа жағы)."""
    match = re.search(r"(\d{3,4})p", _text(f, "format_note"))
    if match:
        return int(match.group(1))
    width, height = f.get("width"), f.get("height")
    if width and height:
        return min(int(width), int(height))
    return int(height or width or 0)


def fps_of(f: dict) -> int:
    return int(round(f.get("fps") or 0))


def codec_rank(f: dict) -> int:
    """Telegram-да ең жақсы ойнайтын кодекке басымдық: H.264 > VP9/H.265 > AV1."""
    vcodec = _text(f, "vcodec")
    if vcodec.startswith(("avc", "h264")):
        return 3
    if vcodec.startswith(("av01", "av1")):
        return 1
    return 2


def _video_rank(f: dict) -> tuple:
    sdr = _text(f, "dynamic_range") in ("", "sdr")
    return (sdr, fps_of(f), codec_rank(f), f.get("tbr") or f.get("vbr") or 0, size_of(f) or 0)


def _audio_rank(f: dict, prefer_m4a: bool) -> tuple:
    return (
        f.get("language_preference") or 0,  # YouTube: түпнұсқа дыбыс жолы
        "drc" not in _text(f, "format_id"),
        is_m4a(f) if prefer_m4a else True,
        f.get("abr") or f.get("tbr") or 0,
    )


def best_audio(formats: Iterable[dict], prefer_m4a: bool = True) -> dict | None:
    # yt-dlp форматтарды нашарынан жақсысына қарай береді: тең болса, кейінгісі (жақсырағы) таңдалады.
    audios = [(i, f) for i, f in enumerate(formats) if is_usable(f) and is_audio_only(f)]
    best = max(audios, key=lambda item: (_audio_rank(item[1], prefer_m4a), item[0]), default=None)
    return best[1] if best else None


def _usable_videos(formats: list[dict]) -> list[dict]:
    videos = [f for f in formats if has_video(f)]
    usable = [f for f in videos if is_usable(f)]
    # Су белгісіз нұсқа мүлде жоқ болса ғана бар нұсқаны қолданамыз (бос қайтарғаннан жақсы).
    return usable or [f for f in videos if "unplayable" not in _text(f, "format_note")]


def video_label(quality: int, fps: int) -> str:
    if not quality:
        return ""
    return f"{quality}p{fps}" if fps > 30 else f"{quality}p"


def video_options(formats: list[dict], duration: float | None = None) -> list[Option]:
    """Әр сапаға (1080p, 720p…) бір нұсқа — жоғарыдан төменге қарай."""
    audio = best_audio(formats)
    audio_size = size_of(audio, duration)
    groups: dict[int, dict] = {}
    for f in _usable_videos(formats):
        quality = quality_of(f)
        # «>=»: тең болса, yt-dlp ретіндегі кейінгісі (ол жақсырақ деп санайды) таңдалады
        if quality not in groups or _video_rank(f) >= _video_rank(groups[quality]):
            groups[quality] = f
    options = []
    for quality, f in sorted(groups.items(), key=lambda item: item[0], reverse=True):
        merge = audio is not None and not has_audio(f)
        size = size_of(f, duration)
        if merge and size is not None and audio_size is not None:
            size += audio_size
        options.append(
            Option(
                key=f"v{quality}",
                kind="video",
                label=video_label(quality, fps_of(f)),
                quality=quality,
                format=f"{f['format_id']}+{audio['format_id']}" if merge else str(f["format_id"]),
                size=size,
            )
        )
    return options


def audio_options(formats: list[dict], duration: float | None = None) -> list[Option]:
    """MP3 (кез келген ойнатқышта ашылады) және болса — түпнұсқа M4A."""
    mp3_size = int(MP3_KBPS * 125 * duration) if duration else None
    best = best_audio(formats, prefer_m4a=False)
    if best is None:
        if any(has_audio(f) and is_usable(f) for f in formats):
            return [Option("mp3", "audio", "MP3", 0, "ba/b", mp3_size, "mp3")]
        return []
    options = [Option("mp3", "audio", "MP3", 0, str(best["format_id"]), mp3_size, "mp3")]
    m4a = best_audio(formats, prefer_m4a=True)
    if m4a is not None and is_m4a(m4a):
        options.append(Option("m4a", "audio", "M4A", 0, str(m4a["format_id"]), size_of(m4a, duration), "m4a"))
    return options


def all_options(formats: list[dict], duration: float | None = None) -> list[Option]:
    return video_options(formats, duration) + audio_options(formats, duration)


def select(
    formats: list[dict],
    want: str,
    limit: int,
    below: int | None = None,
    duration: float | None = None,
) -> Option:
    """Жүктеу кезінде нұсқаны таңдау.

    want="best" — шекке сыятын ең жоғары сапа (below берілсе — одан төмен);
    want="v720" — сол сапа (жоқ болса, одан төмен ең жақын сапа);
    want="mp3" / "m4a" — аудио.
    """
    if want in ("mp3", "m4a"):
        audios = audio_options(formats, duration)
        chosen = next((o for o in audios if o.key == want), audios[0] if audios else None)
        if chosen is None:
            raise NothingFits(None, empty=True)
        return chosen

    videos = video_options(formats, duration)
    if not videos:
        raise NothingFits(None, empty=True)
    if want != "best":
        wanted = int(want[1:]) if want[1:].isdigit() else 0
        exact = next((o for o in videos if o.key == want), None)
        if exact is not None:
            return exact
        lower = [o for o in videos if o.quality <= wanted]
        return lower[0] if lower else videos[-1]

    candidates = [o for o in videos if below is None or o.quality < below]
    for option in candidates:
        if option.fits(limit):
            return option
    sizes = [o.size for o in candidates if o.size]
    raise NothingFits(min(sizes) if sizes else None)
