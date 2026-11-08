"""Медиа кітапхана: файлдарды табу, ffprobe арқылы оқу, рөлін анықтау."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path

from . import ffmpeg

VIDEO_EXT = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".mts", ".m2ts", ".3gp", ".mpg", ".mpeg", ".wmv"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wma", ".aiff", ".aif"}

ROLE_PREFIX = {"footage": "V", "photo": "P", "music": "M", "voiceover": "VO", "sfx": "S"}

_MUSIC_WORDS = ("music", "musik", "музык", "muzyk", "song", "track", "ән", "әуен", "bgm", "soundtrack", "саундтрек")
_VO_WORDS = ("voiceover", "voice", "vo_", "_vo", "диктор", "diktor", "дауыс", "dauys", "narrat", "озвуч", "ozvuch",
             "speech", "сөз", "golos", "голос")
_SFX_WORDS = ("sfx", "fx_", "_fx", "whoosh", "swoosh", "effect", "эффект", "дыбыс", "hit", "riser", "impact")

# Монтажшыға қатысы жоқ қалталар
SKIP_DIRS = {".montazh", "renders", "exports", ".git", "__pycache__", ".venv", "node_modules"}


@dataclass
class MediaItem:
    id: str
    path: str  # жобаның түбірінен салыстырмалы жол (POSIX)
    kind: str  # video | image | audio
    role: str  # footage | photo | music | voiceover | sfx
    duration: float
    width: int = 0
    height: int = 0
    fps: float = 0.0
    has_audio: bool = False
    rotation: int = 0
    size: int = 0
    mtime: float = 0.0
    codec: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "MediaItem":
        known = {k: v for k, v in d.items() if k in cls.__dataclass_fields__}
        return cls(**known)

    @property
    def name(self) -> str:
        return Path(self.path).name

    @property
    def signature(self) -> str:
        return f"{self.size}:{int(self.mtime)}"

    @property
    def is_visual(self) -> bool:
        return self.kind in ("video", "image")

    @property
    def aspect(self) -> float:
        return self.width / self.height if self.height else 16 / 9


def kind_of(path: Path) -> str | None:
    ext = path.suffix.lower()
    if ext in VIDEO_EXT:
        return "video"
    if ext in IMAGE_EXT:
        return "image"
    if ext in AUDIO_EXT:
        return "audio"
    return None


def guess_role(path: Path, kind: str, duration: float) -> str:
    if kind == "video":
        return "footage"
    if kind == "image":
        return "photo"
    text = "/".join(p.lower() for p in path.parts[-3:])
    if any(w in text for w in _SFX_WORDS):
        return "sfx"
    if any(w in text for w in _VO_WORDS):
        return "voiceover"
    if any(w in text for w in _MUSIC_WORDS):
        return "music"
    return "music" if duration >= 25 else "sfx"


def _fps(stream: dict) -> float:
    for key in ("avg_frame_rate", "r_frame_rate"):
        v = stream.get(key) or "0/0"
        try:
            num, den = v.split("/")
            if float(den) > 0 and float(num) > 0:
                f = float(num) / float(den)
                if 1 <= f <= 240:
                    return round(f, 3)
        except ValueError:
            continue
    return 0.0


def probe_item(root: Path, path: Path, item_id: str) -> MediaItem:
    kind = kind_of(path)
    if kind is None:
        raise ValueError(f"Қолдау жоқ файл түрі: {path.name}")
    info = ffmpeg.probe(path)
    streams = info.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"
              and not (s.get("disposition") or {}).get("attached_pic")), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    try:
        duration = float((info.get("format") or {}).get("duration") or 0.0)
    except ValueError:
        duration = 0.0
    if not duration and v is not None:
        try:
            duration = float(v.get("duration") or 0.0)
        except ValueError:
            duration = 0.0
    width = height = rotation = 0
    fps = 0.0
    codec = ""
    if v is not None:
        width, height = int(v.get("width") or 0), int(v.get("height") or 0)
        rotation = ffmpeg._rotation(v)
        if rotation in (90, 270):
            width, height = height, width
        fps = _fps(v)
        codec = v.get("codec_name", "")
    if kind == "video" and v is None:
        kind = "audio"  # видео контейнерде тек дыбыс бар (мыс. .mp4 ән)
    if kind == "image":
        duration = 0.0
    elif kind == "audio" and a is not None:
        codec = a.get("codec_name", "")
    st = path.stat()
    rel = path.relative_to(root).as_posix()
    return MediaItem(
        id=item_id,
        path=rel,
        kind=kind,
        role=guess_role(Path(rel), kind, duration),
        duration=round(duration, 3),
        width=width,
        height=height,
        fps=fps,
        has_audio=a is not None,
        rotation=rotation,
        size=st.st_size,
        mtime=st.st_mtime,
        codec=codec,
    )


def natural_key(s: str) -> list:
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def find_media_files(root: Path) -> list[Path]:
    out = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        rel_parts = p.relative_to(root).parts
        if any(part in SKIP_DIRS or part.startswith(".") for part in rel_parts[:-1]):
            continue
        if p.name.startswith("."):
            continue
        if kind_of(p):
            out.append(p)
    return sorted(out, key=lambda p: natural_key(p.relative_to(root).as_posix()))
