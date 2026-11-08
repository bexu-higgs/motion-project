"""Музыканы видео ұзақтығына келтіру — кәсіби монтажшылардың тәсілдері.

  * fade      — басынан ойнатып, соңында баяу сөндіру;
  * backtime  — әнді соңынан санап қою: ән табиғи аяқталуы видеоның соңғы кадрымен дәл келеді;
  * edit      — «музыкалық монтаж»: ортасынан бірнеше тактіні алып тастап, жапсарды такт басында
                жасау — ән қысқарады, бірақ басы да, табиғи соңы да сақталады;
  * loop      — ән қысқа болса, қарқынды бөлімін такт бойынша қайталау.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .analysis.beats import MusicAnalysis


@dataclass
class MusicFit:
    strategy: str
    segments: list[list[float]]
    length: float
    fade_in: float
    fade_out: float
    beats: list[float] = field(default_factory=list)  # таймлайн уақытында
    downbeats: list[float] = field(default_factory=list)
    drops: list[float] = field(default_factory=list)
    sections: list[dict] = field(default_factory=list)  # {start, end, energy, label} таймлайнда
    joins: list[float] = field(default_factory=list)  # музыкалық жапсар нүктелері

    def energy_at(self, t: float) -> float:
        for s in self.sections:
            if s["start"] <= t < s["end"]:
                return s["energy"]
        return self.sections[-1]["energy"] if self.sections else 0.5

    def section_starts(self) -> list[float]:
        return [s["start"] for s in self.sections[1:]]


def effective_end(ma: MusicAnalysis) -> float:
    """Ән соңындағы тыныштықты есептемегендегі нақты соңы."""
    curve = ma.energy_curve
    if not curve:
        return ma.duration
    arr = np.asarray(curve)
    idx = np.flatnonzero(arr > 0.06)
    if len(idx) == 0:
        return ma.duration
    return min(ma.duration, (idx[-1] + 1) / 2.0 + 0.25)


def effective_start(ma: MusicAnalysis) -> float:
    curve = ma.energy_curve
    if not curve:
        return 0.0
    idx = np.flatnonzero(np.asarray(curve) > 0.04)
    return max(0.0, idx[0] / 2.0 - 0.1) if len(idx) else 0.0


def _map(times: list[float], segments: list[list[float]]) -> list[float]:
    out = []
    off = 0.0
    for a, b in segments:
        for t in times:
            if a - 1e-6 <= t < b - 1e-3:
                out.append(round(off + t - a, 3))
        off += b - a
    return sorted(set(out))


def _map_sections(ma: MusicAnalysis, segments: list[list[float]]) -> list[dict]:
    out: list[dict] = []
    off = 0.0
    for a, b in segments:
        for s in ma.sections:
            lo, hi = max(a, s.start), min(b, s.end)
            if hi - lo > 0.05:
                out.append({"start": round(off + lo - a, 3), "end": round(off + hi - a, 3),
                            "energy": s.energy, "label": s.label})
        off += b - a
    # көршілес бірдей бөлімдерді біріктіру
    merged: list[dict] = []
    for s in out:
        if merged and abs(merged[-1]["energy"] - s["energy"]) < 1e-6 and abs(merged[-1]["end"] - s["start"]) < 0.01:
            merged[-1]["end"] = s["end"]
        else:
            merged.append(dict(s))
    return merged


def _finish(ma: MusicAnalysis, strategy: str, segments: list[list[float]], fade_in: float, fade_out: float
            ) -> MusicFit:
    segments = [[round(a, 3), round(b, 3)] for a, b in segments if b - a > 0.05]
    length = sum(b - a for a, b in segments)
    joins = []
    off = 0.0
    for a, b in segments[:-1]:
        off += b - a
        joins.append(round(off, 3))
    return MusicFit(
        strategy=strategy, segments=segments, length=round(length, 3), fade_in=fade_in, fade_out=fade_out,
        beats=_map(ma.beats, segments), downbeats=_map(ma.downbeats, segments), drops=_map(ma.drops, segments),
        sections=_map_sections(ma, segments), joins=joins)


def fit_music(ma: MusicAnalysis, target: float, strategy: str = "auto") -> MusicFit:
    target = max(1.0, target)
    s0 = effective_start(ma)
    end = effective_end(ma)
    usable = end - s0
    downs = [d for d in ma.downbeats if s0 - 0.05 <= d <= end]
    rhythmic = ma.confidence >= 0.35 and len(downs) >= 8
    if strategy == "auto":
        ratio = usable / target
        if 0.97 <= ratio <= 1.1:
            strategy = "fade"
        elif ratio > 1.1:
            strategy = "edit" if rhythmic else "fade"
        else:
            strategy = "loop" if rhythmic else "fade"
    if strategy == "edit" and (not rhythmic or usable <= target):
        strategy = "backtime" if usable > target else ("loop" if rhythmic else "fade")
    if strategy == "loop" and (not rhythmic or usable >= target):
        strategy = "fade"

    if strategy == "backtime":
        a = max(s0, end - target)
        if downs:
            cands = [d for d in ma.downbeats if d <= a + 0.5] or [s0]
            a = max(cands, key=lambda d: (-(abs(d - a))))
            a = min(a, max(s0, end - 1.0))
        return _finish(ma, "backtime", [[a, end]], 1.2 if a > s0 + 0.5 else 0.05, 0.3)

    if strategy == "edit":
        best = None
        first = downs[0]
        bar = float(np.median(np.diff(downs))) if len(downs) > 1 else 2.0
        for i, a in enumerate(downs):
            if a < max(s0 + 2 * bar, target * 0.2):
                continue
            for j in range(i + 4, len(downs)):
                b = downs[j]
                length = (a - s0) + (end - b)
                err = abs(length - target)
                if err > 1.5 * bar:
                    continue
                score = err / bar
                # фраза шекарасы (4 тактілік) — құлаққа ең табиғи жапсар
                if round((a - first) / bar) % 4 != 0:
                    score += 0.6
                if round((b - first) / bar) % 4 != 0:
                    score += 0.6
                ea, eb = ma.energy_at(a - 0.25), ma.energy_at(b + 0.25)
                score += 1.5 * abs(ea - eb)
                sec_starts = [s.start for s in ma.sections]
                if any(abs(b - s) < 0.3 for s in sec_starts):
                    score -= 0.3  # жаңа бөлімнің басына секіру жақсы естіледі
                if best is None or score < best[0]:
                    best = (score, a, b)
        if best is not None:
            _, a, b = best
            return _finish(ma, "edit", [[s0, a], [b, end]], 0.05 if s0 < 0.2 else 0.3, 0.3)
        return fit_music(ma, target, "backtime")

    if strategy == "loop":
        bar = float(np.median(np.diff(downs))) if len(downs) > 1 else 2.0
        lo_i = next((i for i, d in enumerate(downs) if d >= s0 + usable * 0.25), 0)
        span = 8 if len(downs) - lo_i > 9 else 4
        la = downs[lo_i]
        lb = downs[min(len(downs) - 1, lo_i + span)]
        if lb - la < 2 * bar:
            return fit_music(ma, target, "fade")
        segs = [[s0, lb]]
        length = lb - s0 + (end - la)
        while length < target - 0.5 * bar:
            segs.append([la, lb])
            length += lb - la
        segs.append([la, end])
        # артығын соңынан backtime-пен емес, fade-пен қысқартамыз
        total = sum(b - a for a, b in segs)
        if total > target + bar:
            cut = total - target
            last = segs[-1]
            last[1] = max(last[0] + bar, last[1] - cut)
            return _finish(ma, "loop", segs, 0.05, min(3.0, target * 0.08))
        return _finish(ma, "loop", segs, 0.05, 0.3)

    # fade
    start = s0
    if downs and downs[0] - s0 < 3.0:
        start = downs[0] if downs[0] - s0 > 0.3 else s0
    length = min(target, ma.duration - start)
    return _finish(ma, "fade", [[start, start + length]], 0.05 if start < 0.2 else 0.4,
                   min(3.0, max(1.0, length * 0.08)) if start + length < end - 0.5 else 0.3)
