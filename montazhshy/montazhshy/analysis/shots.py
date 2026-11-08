"""Видеоны талдау: монтаж кесінділерін (shot) табу, айқындық, қозғалыс, жарық, түс.

Әр файлдан тұрақты жиілікпен кішірейтілген кадрлар оқылады (numpy), сосын:
  * гистограмма айырмашылығы бойынша кесінділер табылады (дәл кадрға дейін нақтыланады);
  * әр кадр үшін айқындық (Лаплас дисперсиясы), қозғалыс (кадр айырмасы), жарық есептеледі;
  * әр кесіндінің ең сапалы «терезесі» белгіленеді — монтажға дәл осы бөлік алынады.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np

from .. import ffmpeg

ANALYSIS_WIDTH = 128


@dataclass
class Shot:
    start: float
    end: float
    sharpness: float
    motion: float
    brightness: float
    color: list[float]  # орташа R, G, B (0..1)
    best: list[float]  # [басы, соңы] — ең сапалы бөлік

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass
class VideoAnalysis:
    duration: float
    sample_fps: float
    shots: list[Shot] = field(default_factory=list)
    times: list[float] = field(default_factory=list)
    sharp: list[float] = field(default_factory=list)
    motion: list[float] = field(default_factory=list)
    bright: list[float] = field(default_factory=list)
    poster: float = 0.0

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "VideoAnalysis":
        d = dict(d)
        d["shots"] = [Shot(**s) for s in d.get("shots", [])]
        return cls(**d)

    # ------------------------------------------------------------------
    def quality(self) -> np.ndarray:
        s = np.asarray(self.sharp)
        m = np.asarray(self.motion)
        b = np.asarray(self.bright)
        if len(s) == 0:
            return s
        mq = 1 - np.clip(np.abs(m - 0.12) / 0.5, 0, 1)
        bq = 1 - np.clip(np.abs(b - 0.45) * 2.2, 0, 1)
        return 0.6 * s + 0.25 * mq + 0.15 * bq

    def shot_at(self, t: float) -> Shot | None:
        for s in self.shots:
            if s.start <= t < s.end:
                return s
        return self.shots[-1] if self.shots else None

    def best_window(self, length: float, start: float = 0.0, end: float | None = None,
                    avoid: list[tuple[float, float]] | None = None, margin: float = 0.12) -> tuple[float, float]:
        """[start, end] ішінен ``length`` ұзындықтағы ең сапалы бөлікті табу.

        Кесінді шекараларын (shot cut) кесіп өтпейді, ``avoid`` аралықтарынан қашады.
        """
        end = self.duration if end is None else min(end, self.duration)
        start = max(0.0, start)
        if end - start <= length + 1e-6:
            return round(start, 3), round(min(end, start + length), 3)
        times = np.asarray(self.times)
        q = self.quality()
        cuts = [s.start for s in self.shots[1:]]
        best_t, best_score = start, -1e9
        step = 1.0 / max(self.sample_fps, 1.0) / 2
        t = start + margin
        while t + length <= end - margin + 1e-6:
            a, b = t, t + length
            if any(a < c < b for c in cuts):
                t += step
                continue
            mask = (times >= a) & (times <= b)
            score = float(q[mask].mean()) if np.any(mask) and len(q) else 0.0
            if avoid:
                for x, y in avoid:
                    ov = max(0.0, min(b, y) - max(a, x))
                    score -= ov / length
            # кесінді ортасына сәл артықшылық — әрекеттің басы мен соңы жиі әлсіз
            if self.shots:
                sh = self.shot_at(a)
                if sh and sh.duration > 0:
                    mid = (a + b) / 2
                    score -= 0.05 * abs(mid - (sh.start + sh.end) / 2) / sh.duration
            if score > best_score:
                best_score, best_t = score, t
            t += step
        if best_score <= -1e8:  # кесінді шекарасынсыз орын жоқ — бастан аламыз
            return round(start, 3), round(start + length, 3)
        return round(best_t, 3), round(best_t + length, 3)


def _hist(frame: np.ndarray, bins: int = 16) -> np.ndarray:
    q = (frame.reshape(-1, 3) // (256 // bins)).astype(np.int32)
    out = np.concatenate([np.bincount(q[:, c], minlength=bins) for c in range(3)]).astype(np.float32)
    return out / out.sum()


def _laplacian_var(gray: np.ndarray) -> float:
    g = gray.astype(np.float32)
    lap = (-4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:])
    return float(lap.var())


def _refine_cut(path: Path, t0: float, t1: float, fps_hint: float) -> float:
    """t0..t1 аралығында нақты кесінді кадрын табу."""
    try:
        fb = ffmpeg.read_frames(path, fps=min(60.0, max(fps_hint, 24.0)), width=64, gray=True,
                                start=max(0.0, t0 - 0.05), duration=(t1 - t0) + 0.1)
    except ffmpeg.FFmpegError:
        return t1
    if len(fb.frames) < 2:
        return t1
    f = fb.frames.astype(np.float32)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    i = int(np.argmax(d)) + 1
    return float(fb.times[i])


def analyze_video(path: str | Path, duration: float, fps: float = 25.0) -> VideoAnalysis:
    path = Path(path)
    if duration <= 120:
        sfps = 4.0
    elif duration <= 600:
        sfps = 2.0
    else:
        sfps = 1.0
    fb = ffmpeg.read_frames(path, fps=sfps, width=ANALYSIS_WIDTH, gray=False)
    frames = fb.frames
    n = len(frames)
    if n == 0:
        return VideoAnalysis(duration=duration, sample_fps=sfps)
    gray = (0.299 * frames[..., 0] + 0.587 * frames[..., 1] + 0.114 * frames[..., 2]).astype(np.float32)
    sharp = np.array([_laplacian_var(g) for g in gray])
    sharp_n = np.clip(np.log10(1 + sharp) / 3.2, 0, 1)
    diffs = np.zeros(n)
    if n > 1:
        diffs[1:] = np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2)) / 255.0
    motion_n = np.clip(diffs / 0.12, 0, 1)
    bright = gray.mean(axis=(1, 2)) / 255.0
    hists = np.array([_hist(f) for f in frames])
    hd = np.zeros(n)
    if n > 1:
        hd[1:] = 0.5 * np.abs(np.diff(hists, axis=0)).sum(axis=1)
    # кесінді (cut) табу: гистограмма секірісі + пиксель айырмасы, жергілікті медианадан әлдеқайда жоғары
    cut_idx: list[int] = []
    for i in range(1, n):
        lo, hi = max(1, i - 6), min(n, i + 7)
        local = np.median(hd[lo:hi])
        if hd[i] > 0.35 and hd[i] > 3.0 * local + 0.05 and diffs[i] > 0.06:
            if not cut_idx or (i - cut_idx[-1]) / sfps >= 0.5:
                cut_idx.append(i)
    cut_times = []
    for i in cut_idx:
        cut_times.append(_refine_cut(path, float(fb.times[i - 1]), float(fb.times[i]), fps))
    # мотион кесінді шекарасында жалған жоғары — тегістейміз
    for i in cut_idx:
        motion_n[i] = motion_n[i - 1] if i > 0 else 0.0
    bounds = [0.0] + cut_times + [duration]
    va = VideoAnalysis(
        duration=round(duration, 3),
        sample_fps=sfps,
        times=[round(float(t), 3) for t in fb.times],
        sharp=[round(float(v), 3) for v in sharp_n],
        motion=[round(float(v), 3) for v in motion_n],
        bright=[round(float(v), 3) for v in bright],
    )
    times = fb.times
    for a, b in zip(bounds[:-1], bounds[1:]):
        if b - a < 0.05:
            continue
        mask = (times >= a) & (times < b)
        if not np.any(mask):
            mask = np.zeros(n, dtype=bool)
            mask[min(n - 1, int(a * sfps))] = True
        col = frames[mask].reshape(-1, 3).mean(axis=0) / 255.0
        va.shots.append(Shot(
            start=round(float(a), 3), end=round(float(b), 3),
            sharpness=round(float(sharp_n[mask].mean()), 3),
            motion=round(float(motion_n[mask].mean()), 3),
            brightness=round(float(bright[mask].mean()), 3),
            color=[round(float(c), 3) for c in col],
            best=[0.0, 0.0],
        ))
    for sh in va.shots:
        length = min(sh.duration, max(1.0, min(4.0, sh.duration * 0.6)))
        sh.best = list(va.best_window(length, sh.start, sh.end))
    q = va.quality()
    longest = max(va.shots, key=lambda s: s.duration) if va.shots else None
    if longest is not None and len(q):
        mask = (times >= longest.start) & (times < longest.end)
        idx = np.flatnonzero(mask)
        va.poster = round(float(times[idx[np.argmax(q[idx])]]), 3) if len(idx) else 0.0
    return va


def analyze_image(path: str | Path) -> VideoAnalysis:
    rgb = ffmpeg.grab_frame(path, 0.0, ANALYSIS_WIDTH, is_image=True)
    gray = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)
    s = float(np.clip(np.log10(1 + _laplacian_var(gray)) / 3.2, 0, 1))
    b = float(gray.mean() / 255.0)
    col = (rgb.reshape(-1, 3).mean(axis=0) / 255.0).tolist()
    shot = Shot(0.0, 1e6, round(s, 3), 0.0, round(b, 3), [round(c, 3) for c in col], [0.0, 1e6])
    return VideoAnalysis(duration=0.0, sample_fps=1.0, shots=[shot], times=[0.0], sharp=[round(s, 3)],
                         motion=[0.0], bright=[round(b, 3)], poster=0.0)
