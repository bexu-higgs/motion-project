"""Монтаж таймлайны: деректер моделі, JSON, тексеру және кадрға дейін дәл орналастыру.

Таймлайн — монтаждың толық сипаттамасы (EDL). Агент те, автомонтаж да, адам да осы JSON-ды
жасайды/өзгертеді; рендер мен экспорт тек осы файлды оқиды.

Уақыт ережесі: i-кадрдың ұзақтығы D_i = (out - in) / speed; i-ге кіретін ауысу ұзақтығы T_i.
Кадр басталатын уақыт S_i = S_{i-1} + D_{i-1} - T_i (ауысу кезінде кадрлар қабаттасады).
Көрермен «кесуді» ауысудың ортасында сезеді: cut_point_i = S_i + T_i / 2.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any

# Кәсіби атау → xfade ауысуы
TRANSITIONS: dict[str, str | None] = {
    "cut": None,
    "dissolve": "fade",
    "dip_black": "fadeblack",
    "dip_white": "fadewhite",
    "flash": "fadewhite",
    "whip_left": "smoothleft",
    "whip_right": "smoothright",
    "whip_up": "smoothup",
    "whip_down": "smoothdown",
    "slide_left": "slideleft",
    "slide_right": "slideright",
    "push_up": "slideup",
    "push_down": "slidedown",
    "wipe": "wipeleft",
    "wipe_right": "wiperight",
    "zoom": "zoomin",
    "iris": "circleopen",
    "blur": "hblur",
    "radial": "radial",
    "fade_slow": "fadeslow",
    "pixelize": "pixelize",
    "squeeze": "squeezeh",
}

DEFAULT_TRANSITION_DURATION = {
    "cut": 0.0, "dissolve": 0.6, "dip_black": 0.8, "dip_white": 0.5, "flash": 0.2,
    "whip_left": 0.3, "whip_right": 0.3, "whip_up": 0.3, "whip_down": 0.3,
    "slide_left": 0.4, "slide_right": 0.4, "push_up": 0.4, "push_down": 0.4,
    "wipe": 0.5, "wipe_right": 0.5, "zoom": 0.35, "iris": 0.6, "blur": 0.4, "radial": 0.5,
    "fade_slow": 1.0, "pixelize": 0.4, "squeeze": 0.4,
}

MOTIONS = ("none", "auto", "push_in", "pull_out", "pan_left", "pan_right", "tilt_up", "tilt_down")
REFRAMES = ("auto", "fill", "fit", "blur")
AUDIO_MODES = ("auto", "dialog", "ambience", "mute")
TITLE_STYLES = ("cinematic", "center", "lower_third", "subtitle", "end_card", "chapter")


def _from_dict(cls, d: dict | None):
    if d is None:
        return cls()
    names = {f.name for f in fields(cls)}
    return cls(**{k: v for k, v in d.items() if k in names})


@dataclass
class Transition:
    type: str = "cut"
    duration: float = 0.0

    def normalized(self) -> "Transition":
        t = self.type if self.type in TRANSITIONS else "dissolve"
        d = self.duration if t != "cut" else 0.0
        if t != "cut" and d <= 0:
            d = DEFAULT_TRANSITION_DURATION.get(t, 0.5)
        return Transition(t, float(d))


@dataclass
class Clip:
    media: str
    src_in: float = 0.0
    src_out: float = 0.0
    speed: float = 1.0
    transition: Transition = field(default_factory=Transition)  # осы кадрға кіретін ауысу
    audio: str = "auto"
    gain_db: float = 0.0
    j_cut: float = 0.0  # дыбыс суреттен бұрын басталады (сек)
    l_cut: float = 0.0  # дыбыс келесі кадрға созылады (сек)
    motion: str = "none"
    motion_amount: float = 0.08
    reframe: str = "auto"
    focus: list[float] = field(default_factory=lambda: [0.5, 0.5])
    zoom: float = 1.0
    grade: dict = field(default_factory=dict)  # жеке түзетулер: exposure, temperature, saturation, contrast
    note: str = ""

    @property
    def duration(self) -> float:
        return max(0.0, (self.src_out - self.src_in) / max(self.speed, 1e-6))

    @classmethod
    def from_dict(cls, d: dict) -> "Clip":
        d = dict(d)
        # JSON-да «in»/«out» деп те жазуға рұқсат
        if "in" in d and "src_in" not in d:
            d["src_in"] = d.pop("in")
        if "out" in d and "src_out" not in d:
            d["src_out"] = d.pop("out")
        tr = d.pop("transition", None)
        c = _from_dict(cls, d)
        if isinstance(tr, str):
            c.transition = Transition(tr, DEFAULT_TRANSITION_DURATION.get(tr, 0.5))
        elif isinstance(tr, dict):
            c.transition = _from_dict(Transition, tr)
        return c


@dataclass
class AudioItem:
    media: str
    start: float = 0.0  # таймлайндағы басы
    src_in: float = 0.0
    duration: float | None = None  # None = файлдың соңына дейін (немесе segments қосындысы)
    segments: list[list[float]] | None = None  # музыкалық монтаж: көз бөліктері [[a,b], ...]
    gain_db: float = 0.0
    fade_in: float = 0.0
    fade_out: float = 0.0
    duck: bool = True
    note: str = ""

    def source_ranges(self, media_duration: float) -> list[list[float]]:
        if self.segments:
            return [[max(0.0, a), min(media_duration, b)] for a, b in self.segments if b > a]
        end = media_duration if self.duration is None else min(media_duration, self.src_in + self.duration)
        return [[self.src_in, end]]

    def length(self, media_duration: float) -> float:
        return sum(b - a for a, b in self.source_ranges(media_duration))

    @classmethod
    def from_dict(cls, d: dict) -> "AudioItem":
        d = dict(d)
        if "in" in d and "src_in" not in d:
            d["src_in"] = d.pop("in")
        return _from_dict(cls, d)


@dataclass
class Title:
    text: str
    start: float
    duration: float = 3.0
    style: str = "cinematic"
    subtext: str = ""
    size: float = 1.0
    position: str = "auto"  # auto | top | center | bottom

    @classmethod
    def from_dict(cls, d: dict) -> "Title":
        return _from_dict(cls, d)


@dataclass
class Grade:
    preset: str = "natural"
    intensity: float = 0.8
    auto_match: bool = True  # кадрлардың жарығы мен ақ балансын бір-біріне теңестіру
    letterbox: float = 0.0  # 0 — жоқ, әйтпесе арақатынас (мыс. 2.39)
    grain: float = 0.0  # 0..1
    vignette: float = 0.0  # 0..1
    sharpen: float = 0.0  # 0..1


@dataclass
class AudioMaster:
    target_lufs: float = -14.0
    true_peak: float = -1.0
    dialog_enhance: bool = True
    denoise: str = "light"  # off | light | strong
    duck_db: float = 11.0  # сөйлеу кезінде музыканы қаншаға басу
    music_lufs: float = -16.0  # таза музыканың алдын ала деңгейі
    dialog_lufs: float = -19.0
    ambience_db: float = -10.0  # табиғи дыбыстың диалогқа қатысты деңгейі


@dataclass
class Timeline:
    clips: list[Clip] = field(default_factory=list)
    music: list[AudioItem] = field(default_factory=list)
    voiceover: list[AudioItem] = field(default_factory=list)
    sfx: list[AudioItem] = field(default_factory=list)
    titles: list[Title] = field(default_factory=list)
    grade: Grade = field(default_factory=Grade)
    audio: AudioMaster = field(default_factory=AudioMaster)
    fade_in: float = 0.5
    fade_out: float = 1.0
    style: str = "cinematic"
    notes: str = ""

    # ---------------------------------------------------------------- JSON
    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=1)

    @classmethod
    def from_dict(cls, d: dict) -> "Timeline":
        tl = cls()
        tl.clips = [Clip.from_dict(c) for c in d.get("clips", [])]
        tl.music = [AudioItem.from_dict(a) for a in d.get("music", [])]
        tl.voiceover = [AudioItem.from_dict(a) for a in d.get("voiceover", [])]
        tl.sfx = [AudioItem.from_dict(a) for a in d.get("sfx", [])]
        tl.titles = [Title.from_dict(t) for t in d.get("titles", [])]
        tl.grade = _from_dict(Grade, d.get("grade"))
        tl.audio = _from_dict(AudioMaster, d.get("audio"))
        for k in ("fade_in", "fade_out"):
            if k in d:
                setattr(tl, k, float(d[k]))
        tl.style = d.get("style", tl.style)
        tl.notes = d.get("notes", "")
        return tl

    @classmethod
    def load(cls, path: str | Path) -> "Timeline":
        return cls.from_dict(json.loads(Path(path).read_text("utf-8")))

    def save(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(self.to_json(), "utf-8")
        tmp.replace(p)


# ---------------------------------------------------------------------------
# Кадрға дейін дәл орналастыру
# ---------------------------------------------------------------------------

@dataclass
class Placed:
    index: int
    clip: Clip
    start: float  # таймлайндағы басы (сек), кадрға тураланған
    duration: float  # кадрға тураланған ұзақтық
    trans: Transition  # кіретін ауысу (ұзақтығы кадрға тураланған)
    frames: int
    start_frame: int

    @property
    def end(self) -> float:
        return self.start + self.duration

    @property
    def cut_point(self) -> float:
        return self.start + self.trans.duration / 2


@dataclass
class Resolved:
    fps: float
    placed: list[Placed]
    total: float
    total_frames: int
    warnings: list[str] = field(default_factory=list)


def resolve(tl: Timeline, fps: float, media_durations: dict[str, float] | None = None,
            stills: set[str] | None = None) -> Resolved:
    """Таймлайнды кадрларға тураланған кестеге айналдыру.

    ``media_durations`` берілсе, кіріс/шығыс нүктелері файл шегінен шықпайтындай түзетіледі.
    ``stills`` — фото файлдардың ID-лері (оларда шек жоқ).
    """
    warnings: list[str] = []
    stills = stills or set()
    placed: list[Placed] = []
    cur_frame = 0
    prev_frames = 0
    for i, clip in enumerate(tl.clips):
        c = clip
        c.speed = float(min(4.0, max(0.25, c.speed or 1.0)))
        if media_durations is not None and c.media not in media_durations and c.media not in stills:
            warnings.append(f"#{i + 1}: «{c.media}» медиасы жоқ — кадр өткізілді")
            continue
        if c.media not in stills and media_durations is not None:
            md = media_durations[c.media]
            if c.src_out <= c.src_in:
                c.src_out = c.src_in + 2.0 * c.speed
            if c.src_out > md + 1e-3:
                shift = c.src_out - md
                c.src_out = md
                c.src_in = max(0.0, c.src_in - shift)
                warnings.append(f"#{i + 1} ({c.media}): шығыс нүктесі файл ұзақтығынан асты — түзетілді")
            if c.src_in < 0:
                c.src_in = 0.0
        elif c.src_out <= c.src_in:
            c.src_out = c.src_in + 3.0
        frames = max(1, int(round(c.duration * fps)))
        if frames < max(2, int(fps * 0.25)):
            warnings.append(f"#{i + 1} ({c.media}): кадр тым қысқа ({frames / fps:.2f} с)")
        tr = c.transition.normalized() if placed else Transition("cut", 0.0)
        # жұп кадр саны: көрерменге «кесу» сезілетін орта нүкте дәл кадрға түседі
        t_frames = 2 * int(round(tr.duration * fps / 2))
        if tr.type != "cut":
            limit = min(prev_frames, frames) - 1
            if t_frames > limit:
                t_frames = max(0, limit - limit % 2)
            if t_frames < 2:
                warnings.append(f"#{i + 1}: ауысуға орын жоқ — тікелей кесуге ауыстырылды")
                tr = Transition("cut", 0.0)
                t_frames = 0
        tr = Transition(tr.type, t_frames / fps)
        start_frame = cur_frame - t_frames
        # нақты көз ұзақтығын кадрға сәйкестендіру
        c.src_out = round(c.src_in + frames / fps * c.speed, 4)
        placed.append(Placed(i, c, start_frame / fps, frames / fps, tr, frames, start_frame))
        cur_frame = start_frame + frames
        prev_frames = frames
    total_frames = cur_frame
    return Resolved(fps=fps, placed=placed, total=total_frames / fps, total_frames=total_frames,
                    warnings=warnings)


def cut_points(res: Resolved) -> list[float]:
    return [p.cut_point for p in res.placed[1:]]


def describe(res: Resolved, beats: list[float] | None = None) -> dict[str, Any]:
    """Агентке арналған қысқа есеп: ұзақтық, кесулердің битке сәйкестігі, ескертулер."""
    cps = cut_points(res)
    out: dict[str, Any] = {
        "total_seconds": round(res.total, 3),
        "clips": len(res.placed),
        "avg_shot": round(res.total / max(1, len(res.placed)), 2),
        "warnings": res.warnings,
    }
    if beats:
        b = sorted(beats)
        offs = []
        for t in cps:
            j = min(range(len(b)), key=lambda k: abs(b[k] - t))
            offs.append(t - b[j])
        on = sum(1 for o in offs if abs(o) <= 0.045)
        out["cuts_on_beat"] = f"{on}/{len(cps)}"
        worst = sorted(((abs(o), i + 2) for i, o in enumerate(offs)), reverse=True)[:5]
        out["off_beat_cuts"] = [f"#{n}: {o * 1000:.0f} мс" for o, n in worst if o > 0.045]
    return out


def frame_snap(t: float, fps: float) -> float:
    return round(t * fps) / fps


def media_ids(tl: Timeline) -> set[str]:
    ids = {c.media for c in tl.clips}
    for group in (tl.music, tl.voiceover, tl.sfx):
        ids |= {a.media for a in group}
    return ids


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def is_finite(v: Any) -> bool:
    try:
        return math.isfinite(float(v))
    except (TypeError, ValueError):
        return False
