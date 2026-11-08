"""Жоба: медиа қалтасы + талдау кэші + баптаулар + таймлайн + рендерлер.

Қалта құрылымы::

    менің_жобам/
      ...кез келген видео, фото, музыка файлдары (ішкі қалталар да болады)
      scenariy.txt          — (міндетті емес) сценарий
      timeline.json         — соңғы монтаж (агент жасайды, қолмен де өзгертуге болады)
      renders/              — preview.mp4, final.mp4
      exports/              — Premiere/DaVinci XML, EDL, SRT
      .montazh/             — кэш (талдау, кадрлар, аралық файлдар)
"""

from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import ffmpeg
from .analysis.audio import AudioAnalysis, analyze_audio
from .analysis.beats import MusicAnalysis, analyze_music
from .analysis.shots import VideoAnalysis, analyze_image, analyze_video
from .media import ROLE_PREFIX, MediaItem, find_media_files, probe_item

ANALYSIS_VERSION = 3

DEFAULT_SETTINGS: dict = {
    "aspect": "16:9",       # 16:9 | 9:16 | 1:1 | 4:5 | 2.39:1
    "height": 1080,         # шығыс биіктігі (тік форматта — ені)
    "fps": 0,               # 0 = видеоларға қарап автоматты
    "style": "cinematic",
    "grade": "auto",        # auto = стильден
    "platform": "youtube",  # дыбыс қаттылығының стандарты
    "music_fit": "auto",    # auto | edit | backtime | fade
    "target_duration": 0,   # 0 = материалға / музыкаға қарап
    "title": "",
    "script": "",
    "language": "kk",
    "transcribe": False,
}

ProgressFn = Callable[[str, float], None]


@dataclass
class Analysis:
    video: VideoAnalysis | None = None
    audio: AudioAnalysis | None = None
    music: MusicAnalysis | None = None


@dataclass
class Project:
    root: Path
    _media: dict[str, MediaItem] = field(default_factory=dict)  # id -> item
    _settings: dict = field(default_factory=dict)
    _next: dict[str, int] = field(default_factory=dict)
    _locked_roles: set[str] = field(default_factory=set)
    _lock: threading.RLock = field(default_factory=threading.RLock)
    _analysis_cache: dict[str, Analysis] = field(default_factory=dict)

    # ------------------------------------------------------------------ жолдар
    @property
    def cache_dir(self) -> Path:
        return self.root / ".montazh"

    @property
    def renders_dir(self) -> Path:
        return self.root / "renders"

    @property
    def exports_dir(self) -> Path:
        return self.root / "exports"

    @property
    def timeline_path(self) -> Path:
        return self.root / "timeline.json"

    @property
    def state_path(self) -> Path:
        return self.cache_dir / "project.json"

    def thumb_path(self, item_id: str) -> Path:
        return self.cache_dir / "thumbs" / f"{item_id}.jpg"

    def analysis_path(self, item_id: str) -> Path:
        return self.cache_dir / "analysis" / f"{item_id}.json"

    def abspath(self, item: MediaItem | str) -> Path:
        if isinstance(item, str):
            item = self.get(item)
        return self.root / item.path

    # ------------------------------------------------------------------ жүктеу/сақтау
    @classmethod
    def open(cls, root: str | Path) -> "Project":
        root = Path(root).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        p = cls(root=root)
        p._load()
        return p

    def _load(self) -> None:
        self._settings = dict(DEFAULT_SETTINGS)
        if self.state_path.exists():
            data = json.loads(self.state_path.read_text("utf-8"))
            self._media = {d["id"]: MediaItem.from_dict(d) for d in data.get("media", [])}
            self._settings.update(data.get("settings", {}))
            self._next = data.get("next", {})
            self._locked_roles = set(data.get("locked_roles", []))
        if not self._settings.get("script"):
            for name in ("scenariy.txt", "сценарий.txt", "script.txt", "scenario.txt"):
                f = self.root / name
                if f.exists():
                    self._settings["script"] = f.read_text("utf-8", errors="replace").strip()
                    break

    def save(self) -> None:
        with self._lock:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            data = {
                "media": [m.to_dict() for m in self.media()],
                "settings": self._settings,
                "next": self._next,
                "locked_roles": sorted(self._locked_roles),
            }
            tmp = self.state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")
            tmp.replace(self.state_path)

    # ------------------------------------------------------------------ баптаулар
    @property
    def settings(self) -> dict:
        return dict(self._settings)

    def update_settings(self, **kw) -> dict:
        with self._lock:
            for k, v in kw.items():
                if k in DEFAULT_SETTINGS and v is not None:
                    self._settings[k] = v
            self.save()
        return self.settings

    # ------------------------------------------------------------------ медиа
    def media(self, role: str | None = None) -> list[MediaItem]:
        from .media import natural_key

        items = sorted(self._media.values(), key=lambda m: (natural_key(m.id[:2]), natural_key(m.id)))
        items.sort(key=lambda m: list(ROLE_PREFIX).index(m.role) if m.role in ROLE_PREFIX else 9)
        return [m for m in items if role is None or m.role == role]

    def get(self, item_id: str) -> MediaItem:
        try:
            return self._media[item_id]
        except KeyError:
            raise KeyError(f"Медиа табылмады: {item_id}") from None

    def find(self, ref: str) -> MediaItem:
        """ID, файл аты немесе салыстырмалы жол бойынша табу."""
        if ref in self._media:
            return self._media[ref]
        for m in self._media.values():
            if m.path == ref or m.name == ref or Path(m.path).stem == ref:
                return m
        raise KeyError(f"Медиа табылмады: {ref}")

    def _new_id(self, role: str) -> str:
        prefix = ROLE_PREFIX.get(role, "X")
        n = self._next.get(prefix, 1)
        while f"{prefix}{n}" in self._media:
            n += 1
        self._next[prefix] = n + 1
        return f"{prefix}{n}"

    def set_role(self, item_id: str, role: str) -> MediaItem:
        if role not in ROLE_PREFIX:
            raise ValueError(f"Белгісіз рөл: {role}")
        with self._lock:
            item = self.get(item_id)
            item.role = role
            self._locked_roles.add(item.path)
            self.save()
            return item

    def scan(self) -> list[MediaItem]:
        """Қалтадағы файлдарды табу, жаңаларын тіркеу, жойылғандарын алып тастау."""
        with self._lock:
            by_path = {m.path: m for m in self._media.values()}
            seen: set[str] = set()
            for path in find_media_files(self.root):
                rel = path.relative_to(self.root).as_posix()
                seen.add(rel)
                st = path.stat()
                old = by_path.get(rel)
                if old and old.size == st.st_size and int(old.mtime) == int(st.st_mtime):
                    continue
                try:
                    tmp = probe_item(self.root, path, "tmp")
                except (ffmpeg.FFmpegError, ValueError):
                    continue
                if old:
                    tmp.id = old.id
                    if rel in self._locked_roles:
                        tmp.role = old.role
                    self._analysis_cache.pop(old.id, None)
                else:
                    tmp.id = self._new_id(tmp.role)
                self._media[tmp.id] = tmp
            for m in list(self._media.values()):
                if m.path not in seen:
                    del self._media[m.id]
                    self._analysis_cache.pop(m.id, None)
            self.save()
            return self.media()

    # ------------------------------------------------------------------ талдау
    def analysis(self, item_id: str) -> Analysis:
        if item_id in self._analysis_cache:
            return self._analysis_cache[item_id]
        p = self.analysis_path(item_id)
        if not p.exists():
            return Analysis()
        d = json.loads(p.read_text("utf-8"))
        a = Analysis(
            video=VideoAnalysis.from_dict(d["video"]) if d.get("video") else None,
            audio=AudioAnalysis.from_dict(d["audio"]) if d.get("audio") else None,
            music=MusicAnalysis.from_dict(d["music"]) if d.get("music") else None,
        )
        self._analysis_cache[item_id] = a
        return a

    def is_analyzed(self, item: MediaItem) -> bool:
        p = self.analysis_path(item.id)
        if not p.exists():
            return False
        try:
            d = json.loads(p.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            return False
        return d.get("signature") == item.signature and d.get("version") == ANALYSIS_VERSION

    def _analyze_one(self, item: MediaItem) -> None:
        path = self.abspath(item)
        out: dict = {"signature": item.signature, "version": ANALYSIS_VERSION}
        if item.kind == "video":
            out["video"] = analyze_video(path, item.duration, item.fps or 25.0).to_dict()
        elif item.kind == "image":
            out["video"] = analyze_image(path).to_dict()
        if item.has_audio or item.kind == "audio":
            out["audio"] = analyze_audio(path, item.duration).to_dict()
        if item.kind == "audio" and item.duration >= 8:
            y = ffmpeg.read_pcm(path, 22050)
            out["music"] = analyze_music(y).to_dict()
        self._make_thumb(item, out)
        p = self.analysis_path(item.id)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(out, ensure_ascii=False), "utf-8")
        self._analysis_cache.pop(item.id, None)
        # рөлді нақтылау: сөйлеу көп, ырғақ әлсіз → дикторлық мәтін
        if item.kind == "audio" and item.path not in self._locked_roles:
            sp = (out.get("audio") or {}).get("speech_ratio", 0)
            conf = (out.get("music") or {}).get("confidence", 0)
            if item.role in ("music", "sfx") and sp > 0.5 and conf < 0.45:
                item.role = "voiceover"

    def _make_thumb(self, item: MediaItem, out: dict) -> None:
        if not item.is_visual:
            return
        from PIL import Image

        t = (out.get("video") or {}).get("poster", 0.0)
        try:
            rgb = ffmpeg.grab_frame(self.abspath(item), t, 320, is_image=item.kind == "image")
        except ffmpeg.FFmpegError:
            return
        p = self.thumb_path(item.id)
        p.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgb).save(p, quality=82)

    def analyze(self, progress: ProgressFn | None = None, force: bool = False, workers: int = 3) -> None:
        items = [m for m in self.media() if force or not self.is_analyzed(m)]
        if not items:
            if progress:
                progress("Талдау дайын", 1.0)
            return
        done = 0
        lock = threading.Lock()

        def job(m: MediaItem) -> None:
            nonlocal done
            try:
                self._analyze_one(m)
            except ffmpeg.FFmpegError as e:  # бір файлдың қатесі бүкіл жобаны тоқтатпасын
                if progress:
                    progress(f"⚠️ {m.name}: {e.args[0]}", done / len(items))
            with lock:
                done += 1
                if progress:
                    progress(f"Талданды: {m.name}", done / len(items))

        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            list(ex.map(job, items))
        with self._lock:
            for m in items:  # рөлі нақтыланған файлдардың ID-ін рөліне сәйкестендіру (S3 → VO1)
                if m.id in self._media and not m.id.startswith(ROLE_PREFIX.get(m.role, "?")):
                    self._reid(m)
            self.save()

    def _reid(self, item: MediaItem) -> None:
        old = item.id
        new = self._new_id(item.role)
        for src, dst in ((self.analysis_path(old), self.analysis_path(new)),
                         (self.thumb_path(old), self.thumb_path(new))):
            if src.exists():
                src.replace(dst)
        del self._media[old]
        self._analysis_cache.pop(old, None)
        item.id = new
        self._media[new] = item

    # ------------------------------------------------------------------ шолу
    def output_fps(self) -> float:
        fps = float(self._settings.get("fps") or 0)
        if fps:
            return fps
        rates = [m.fps for m in self.media("footage") if m.fps]
        if not rates:
            return 30.0
        common = max(set(round(r) for r in rates), key=lambda r: sum(1 for x in rates if round(x) == r))
        std = min((24, 25, 30, 50, 60), key=lambda x: abs(x - common))
        if abs(std - common) > 1:
            return 30.0
        return {50: 25.0, 60: 30.0}.get(std, float(std))

    def output_size(self) -> tuple[int, int]:
        aspect = self._settings.get("aspect", "16:9")
        base = int(self._settings.get("height") or 1080)
        ratios = {"16:9": (16, 9), "9:16": (9, 16), "1:1": (1, 1), "4:5": (4, 5), "2.39:1": (2.39, 1),
                  "4:3": (4, 3)}
        rw, rh = ratios.get(aspect, (16, 9))
        if rw >= rh:
            h = base
            w = int(round(h * rw / rh / 2)) * 2
        else:
            w = base
            h = int(round(w * rh / rw / 2)) * 2
        return w, h
