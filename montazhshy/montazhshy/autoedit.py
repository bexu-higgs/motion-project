"""Автомонтаж (ЖИ-сыз): сценарий бойынша реттеу, музыка ырғағына кесу, стильге сай ауысулар.

Бұл модуль әрі ЖИ кілті жоқ кезде толық монтаж жасайды, әрі ЖИ агентіне «бірінші нұсқа» береді —
агент оны көзбен қарап, мағынасына қарай жетілдіреді.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .analysis.beats import MusicAnalysis
from .media import MediaItem, natural_key
from .musicfit import MusicFit, fit_music
from .project import Project
from .script import Script, latin_key, parse
from .styles import Style, get_style, platform
from .timeline import (DEFAULT_TRANSITION_DURATION, AudioItem, AudioMaster, Clip, Grade, Timeline, Title,
                       Transition, resolve)


@dataclass
class Candidate:
    media: MediaItem
    start: float
    end: float
    quality: float
    static: bool
    speech: bool
    order: int

    @property
    def length(self) -> float:
        return self.end - self.start if self.media.kind != "image" else 1e6


@dataclass
class Slot:
    start: float
    end: float
    mark: str = ""  # scene | section | drop | ""

    @property
    def length(self) -> float:
        return self.end - self.start


# ---------------------------------------------------------------------------
# сценарий → медиа
# ---------------------------------------------------------------------------

def _name_tokens(m: MediaItem) -> set[str]:
    base = Path(m.path).stem.lower()
    words = re.split(r"[\s_\-.,()\[\]]+", re.sub(r"\d+", " ", base))
    return {latin_key(w) for w in words if len(w) >= 3}


def assign_scenes(project: Project, visuals: list[MediaItem], script: Script) -> list[list[MediaItem]]:
    if script.empty:
        return [visuals]
    n = len(script.scenes)
    where: dict[str, int] = {}
    for sc in script.scenes:
        for ref in sc.refs:
            try:
                m = project.find(ref)
            except KeyError:
                continue
            if m in visuals:
                where.setdefault(m.id, sc.index - 1)
    for m in visuals:
        if m.id in where:
            continue
        toks = _name_tokens(m)
        if not toks:
            continue
        scores = [len(toks & {latin_key(w) for w in sc.words}) for sc in script.scenes]
        best = max(scores)
        if best > 0:
            where[m.id] = scores.index(best)
    rest = [m for m in visuals if m.id not in where]
    if rest and not where:
        for k, m in enumerate(rest):
            where[m.id] = min(n - 1, k * n // len(rest))
    else:
        cur = 0
        for m in visuals:
            if m.id in where:
                cur = where[m.id]
            else:
                where[m.id] = cur
    out: list[list[MediaItem]] = [[] for _ in range(n)]
    for m in visuals:
        out[where[m.id]].append(m)
    return out


# ---------------------------------------------------------------------------
# кандидат кадрлар
# ---------------------------------------------------------------------------

def candidates(project: Project, items: list[MediaItem], order0: int = 0) -> list[Candidate]:
    out: list[Candidate] = []
    k = order0
    for m in items:
        an = project.analysis(m.id)
        if m.kind == "image":
            q = an.video.shots[0].sharpness if an.video and an.video.shots else 0.7
            out.append(Candidate(m, 0.0, 0.0, 0.5 + 0.5 * q, True, False, k))
            k += 1
            continue
        va = an.video
        speech = an.audio.speech if an.audio else []
        shots = va.shots if va and va.shots else []
        if not shots:
            out.append(Candidate(m, 0.0, m.duration, 0.5, False, False, k))
            k += 1
            continue
        for s in shots:
            if s.duration < 0.5:
                continue
            pieces = [(s.start, s.end)]
            if s.duration > 9:  # ұзын кадрды бірнеше «әрекетке» бөлеміз
                nparts = int(s.duration // 4.5)
                step = s.duration / nparts
                pieces = [(s.start + i * step, s.start + (i + 1) * step) for i in range(nparts)]
            for a, b in pieces:
                cover = sum(max(0.0, min(b, y) - max(a, x)) for x, y in speech)
                q = 0.6 * s.sharpness + 0.25 * (1 - abs(s.motion - 0.12) * 2) + 0.15 * (1 - abs(s.brightness - 0.45) * 2)
                out.append(Candidate(m, a, b, q, s.motion < 0.04, cover / max(1e-3, b - a) > 0.3, k))
                k += 1
    return out


# ---------------------------------------------------------------------------
# уақыт тілімдері (slots)
# ---------------------------------------------------------------------------

def slots_from_music(fit: MusicFit, style: Style, length: float) -> list[Slot]:
    beats = [b for b in fit.beats if b < length - 0.3]
    if len(beats) < 4:
        return slots_free(style, length)
    beat_len = (beats[-1] - beats[0]) / max(1, len(beats) - 1)
    sec_starts = [s for s in fit.section_starts() if 0.5 < s < length - 0.5]
    drops = [d for d in fit.drops if 0.5 < d < length - 0.5]
    out: list[Slot] = []
    pos = 0.0
    mark = ""
    i = 0
    while True:
        e = fit.energy_at(pos + 0.1)
        level = 0 if e < 0.45 else 1 if e < 0.72 else 2
        n = style.beats_per_cut[level]
        while i < len(beats) and beats[i] <= pos + 0.05:
            i += 1
        j = i + n - 1
        if j >= len(beats):
            break
        nxt = beats[j]
        if n >= 4:
            near = [d for d in fit.downbeats if abs(d - nxt) <= beat_len * 1.01 and d > pos + 0.5]
            if near:
                nxt = min(near, key=lambda d: abs(d - nxt))
        new_mark = ""
        for s in sec_starts:
            if pos + 0.6 < s <= nxt + beat_len * 0.5:
                nxt, new_mark = s, "section"
                break
        for d in drops:
            if pos + 0.6 < d <= nxt + beat_len * 0.5:
                nxt, new_mark = d, "drop"
                break
        if nxt <= pos + 0.35:
            break
        if length - nxt < max(0.8, beat_len * min(2, n)):
            break
        out.append(Slot(pos, nxt, mark))
        mark = new_mark
        pos = nxt
    out.append(Slot(pos, length, mark))
    return out


def slots_free(style: Style, length: float) -> list[Slot]:
    lo, hi = style.shot_range
    pattern = (0.55, 0.3, 0.8, 0.45, 0.65, 0.2, 0.7)
    out: list[Slot] = []
    pos, k = 0.0, 0
    while pos < length - 1e-3:
        d = lo + (hi - lo) * pattern[k % len(pattern)]
        if length - (pos + d) < lo * 0.6:
            d = length - pos
        out.append(Slot(pos, min(length, pos + d)))
        pos += d
        k += 1
    return out


def time_budgets(total: float, weights: list[float], capacity: list[float]) -> list[float]:
    """Жалпы уақытты сахналарға салмағы бойынша бөлу, бірақ әр сахнаның бірегей материалынан асырмай."""
    n = len(weights)
    if n == 0:
        return []
    budget = [0.0] * n
    free = set(range(n))
    left = total
    for _ in range(n + 1):
        if not free or left <= 1e-6:
            break
        wsum = sum(weights[i] for i in free) or float(len(free))
        over = False
        for i in list(free):
            share = left * (weights[i] / wsum if wsum else 1 / len(free))
            if budget[i] + share > capacity[i] * 0.95 and capacity[i] > 0:
                over = True
        if not over:
            for i in free:
                budget[i] += left * (weights[i] / wsum if wsum else 1 / len(free))
            left = 0.0
            break
        for i in list(free):
            share = left * (weights[i] / wsum if wsum else 1 / len(free))
            if budget[i] + share > capacity[i] * 0.95:
                give = max(0.0, capacity[i] * 0.95 - budget[i])
                budget[i] += give
                free.discard(i)
        left = total - sum(budget)
    if left > 1e-6:  # материал бәрібір жетпесе — қалғанын салмақ бойынша
        wsum = sum(weights) or 1.0
        for i in range(n):
            budget[i] += left * weights[i] / wsum
    return budget


def _allocate(counts_total: int, weights: list[float]) -> list[int]:
    n = len(weights)
    if n == 0:
        return []
    if counts_total <= n:
        order = sorted(range(n), key=lambda i: -weights[i])[:counts_total]
        return [1 if i in order else 0 for i in range(n)]
    base = [1] * n
    rest = counts_total - n
    tot = sum(weights) or 1.0
    raw = [rest * w / tot for w in weights]
    flo = [int(r) for r in raw]
    rem = rest - sum(flo)
    order = sorted(range(n), key=lambda i: -(raw[i] - flo[i]))
    for i in order[:rem]:
        flo[i] += 1
    return [b + f for b, f in zip(base, flo)]


# ---------------------------------------------------------------------------
# негізгі функция
# ---------------------------------------------------------------------------

def build(project: Project, *, style: str | None = None, script_text: str | None = None,
          target: float | None = None, music_id: str | None = None, music_fit: str | None = None,
          title: str | None = None, use_music: bool = True) -> tuple[Timeline, dict]:
    st = project.settings
    sty = get_style(style or st.get("style"))
    plat = platform(st.get("platform"))
    script = parse(script_text if script_text is not None else st.get("script", ""))
    visuals = sorted(project.media("footage") + project.media("photo"), key=lambda m: natural_key(m.path))
    if not visuals:
        raise ValueError("Жобада видео немесе фото жоқ — алдымен кадрларды қосыңыз.")
    groups = assign_scenes(project, visuals, script)
    scene_cands: list[list[Candidate]] = []
    order = 0
    for g in groups:
        cs = candidates(project, g, order)
        order += len(cs)
        scene_cands.append(cs)
    scene_idx = [i for i, cs in enumerate(scene_cands) if cs]
    scene_cands = [scene_cands[i] for i in scene_idx]
    all_c = [c for cs in scene_cands for c in cs]
    material = sum(min(c.length, sty.shot_range[1] * 1.5) for c in all_c)

    vos = project.media("voiceover")
    vo_total = sum(m.duration for m in vos) + 0.8 * max(0, len(vos) - 1)
    T = target or float(st.get("target_duration") or 0)
    if not T:
        lo, hi = sty.preferred_duration
        T = min(max(material * sty.duration_factor, lo), hi)
        T = min(T, material * 0.9)
    T = max(T, 5.0, vo_total + 2.5 if vos else 0.0)

    # ---- музыка
    music_items = project.media("music")
    music: MediaItem | None = None
    if not use_music:
        music = None
    elif music_id:
        music = project.get(music_id)
    elif music_items:
        music = music_items[0]
    fit: MusicFit | None = None
    ma: MusicAnalysis | None = None
    if music is not None:
        ma = project.analysis(music.id).music
        if ma is not None and ma.duration > 2:
            fit = fit_music(ma, T, music_fit or (st.get("music_fit") if st.get("music_fit") != "auto" else
                                                 sty.music_fit) or "auto")
            L = fit.length
        else:
            L = min(T, music.duration)
    else:
        L = T
    L = round(L, 3)

    slots = slots_from_music(fit, sty, L) if fit and fit.beats else slots_free(sty, L)

    # ---- тілімдерді сахналарға бөлу: уақыт бойынша (бірегей материалы аз сахнаға артық уақыт бермейміз)
    cap = sty.shot_range[1] * 1.5
    weights = [sum(min(c.length, cap) for c in cs) for cs in scene_cands]
    unique = [sum(min(c.length, cap) if c.media.kind != "image" else 2 * cap for c in cs) for cs in scene_cands]
    budget = time_budgets(L, weights, unique)
    counts = [0] * len(scene_cands)
    acc = 0.0
    si_cur = 0
    for k_, sl in enumerate(slots):
        remaining_slots = len(slots) - k_
        remaining_scenes = len(scene_cands) - si_cur - 1
        if (si_cur < len(scene_cands) - 1 and counts[si_cur] > 0
                and (acc + sl.length / 2 > sum(budget[: si_cur + 1]) or remaining_slots <= remaining_scenes)):
            si_cur += 1
        counts[si_cur] += 1
        acc += sl.length
    k = 0
    assigned: list[tuple[Slot, Candidate, int]] = []
    for si, (cs, cnt) in enumerate(zip(scene_cands, counts)):
        if cnt == 0:
            continue
        my_slots = slots[k : k + cnt]
        if k > 0 and my_slots:
            my_slots[0].mark = my_slots[0].mark or "scene"
        k += cnt
        if len(cs) >= cnt:
            pick = sorted(sorted(cs, key=lambda c: -c.quality)[:cnt], key=lambda c: c.order)
        else:
            pick = [cs[i % len(cs)] for i in range(cnt)]
        # ұзын тілімдерге ұзын кадр: көршілес жұптарды ауыстыру
        for i in range(len(pick) - 1):
            a, b = pick[i], pick[i + 1]
            if (a.length < my_slots[i].length * 0.8 and b.length >= my_slots[i].length
                    and a.length >= my_slots[i + 1].length * 0.8):
                pick[i], pick[i + 1] = b, a
        for sl, c in zip(my_slots, pick):
            assigned.append((sl, c, si))

    # ---- ауысулар
    accents = list(sty.accent_transitions)
    trans: list[Transition] = [Transition("cut", 0.0)]
    for n_, (sl, _c, _si) in enumerate(assigned[1:], start=1):
        prev = assigned[n_ - 1][0]
        e = fit.energy_at(sl.start) if fit else 0.5
        if sl.mark == "drop":
            t = sty.drop_transition
        elif sl.mark == "scene":
            t = sty.scene_transition
        elif sl.mark == "section":
            t = sty.section_transition
        elif accents and e >= 0.72 and n_ % 6 == 0:
            t = accents[(n_ // 6) % len(accents)]
        else:
            t = "cut"
        d = DEFAULT_TRANSITION_DURATION.get(t, 0.0)
        d = min(d, 0.45 * min(prev.length, sl.length))
        if t != "cut" and d < 0.12:
            t, d = "cut", 0.0
        trans.append(Transition(t, d))

    # ---- кадрлар (кесу нүктесі = ауысудың ортасы). Барлығы кадр санымен есептеледі —
    # әйтпесе дөңгелектеу қателері жинақталып, соңғы кесулер биттен «қашады».
    fps = project.output_fps()
    tf = [2 * int(round(t.duration * fps / 2)) for t in trans]
    for t, f in zip(trans, tf):
        t.duration = f / fps
        if f == 0:
            t.type = "cut"
    bf = [int(round(sl.start * fps)) for sl, _, _ in assigned] + [int(round(L * fps))]
    clips: list[Clip] = []
    used: dict[str, list[tuple[float, float]]] = {}
    photo_moves = ("push_in", "pull_out", "pan_right", "push_in", "pan_left")
    for n_, (_sl, c, si) in enumerate(assigned):
        f_out = tf[n_ + 1] if n_ + 1 < len(tf) else 0
        frames = (bf[n_ + 1] + f_out // 2) - (bf[n_] - tf[n_] // 2)
        dur = max(1, frames) / fps
        m = c.media
        if m.kind == "image":
            clip = Clip(m.id, 0.0, round(dur, 4), motion=photo_moves[n_ % len(photo_moves)],
                        motion_amount=max(0.06, sty.motion_amount * 1.4), transition=trans[n_],
                        note=f"Сахна {scene_idx[si] + 1}")
        else:
            an = project.analysis(m.id)
            speed = 1.0
            need = dur
            if c.length < need:
                speed = max(0.5, round(c.length / need, 3))
                need = dur * speed
            a, b = (an.video.best_window(need, c.start, c.end, avoid=used.get(m.id))
                    if an.video else (c.start, c.start + need))
            if b - a < need - 1e-3:
                b = a + need  # рендер соңғы кадрды ұстап тұрады
            used.setdefault(m.id, []).append((a, b))
            motion = sty.motion if c.static and sty.motion != "none" else "none"
            clip = Clip(m.id, round(a, 4), round(a + need, 4), speed=speed, transition=trans[n_],
                        motion=motion, motion_amount=sty.motion_amount,
                        audio="dialog" if c.speech else "auto",
                        note=f"Сахна {scene_idx[si] + 1}" + (" · баяулату" if speed < 1 else ""))
        clips.append(clip)

    # ---- титрлер
    titles: list[Title] = []
    main_title = title or st.get("title") or script.title
    if main_title:
        titles.append(Title(main_title, 0.6, min(4.0, max(2.5, L * 0.12)), style=sty.title_style
                            if sty.title_style != "lower_third" else "cinematic"))
    slot_starts: dict[int, float] = {}
    for sl, _c, si in assigned:
        slot_starts.setdefault(si, sl.start)
    for si, sc_i in enumerate(scene_idx):
        sc = script.scenes[sc_i] if not script.empty and sc_i < len(script.scenes) else None
        if sc is None or si not in slot_starts:
            continue
        t0 = slot_starts[si] + 0.4
        for txt in sc.titles[:1]:
            if main_title and t0 < 4.5:
                t0 = 4.6
            titles.append(Title(txt, round(t0, 2), 3.0,
                                style="lower_third" if sty.key == "documentary" else "chapter"))

    # ---- дыбыс
    tl = Timeline(clips=clips, titles=titles, style=sty.key, fade_in=sty.fade_in, fade_out=sty.fade_out)
    if music is not None:
        if fit is not None:
            tl.music.append(AudioItem(music.id, 0.0, segments=fit.segments, fade_in=fit.fade_in,
                                      fade_out=max(fit.fade_out, 0.3), note=f"Музыка: {fit.strategy}"))
        else:
            tl.music.append(AudioItem(music.id, 0.0, 0.0, duration=L, fade_out=min(3.0, L * 0.1)))
    t = 1.0
    for v in vos:
        if t >= L - 1:
            break
        tl.voiceover.append(AudioItem(v.id, round(t, 3), duration=min(v.duration, L - t - 0.3)))
        t += v.duration + 0.8
    W, H = project.output_size()
    grade_key = st.get("grade") if st.get("grade") not in (None, "", "auto") else sty.grade
    tl.grade = Grade(preset=grade_key, intensity=sty.grade_intensity,
                     letterbox=sty.letterbox if sty.letterbox and W / H < sty.letterbox - 0.05 and W > H else 0.0,
                     grain=sty.grain, vignette=sty.vignette)
    tl.audio = AudioMaster(target_lufs=plat["lufs"], true_peak=plat["tp"], duck_db=sty.duck_db,
                           ambience_db=-14.0 if music is not None else -8.0)
    info = {
        "duration": L,
        "clips": len(clips),
        "scenes": len(scene_cands),
        "style": sty.name,
        "music": ({"id": music.id, "strategy": fit.strategy if fit else "fade", "bpm": ma.bpm if ma else None,
                   "segments": fit.segments if fit else None} if music else None),
    }
    tl.notes = (f"Автомонтаж: {sty.name}, {len(clips)} кадр, {L:.1f} с"
                + (f", музыка {ma.bpm:.0f} BPM ({fit.strategy})" if fit and ma else ""))
    return tl, info


# ---------------------------------------------------------------------------
# агентке арналған құралдар
# ---------------------------------------------------------------------------

def timeline_grid(project: Project, tl: Timeline) -> tuple[list[float], list[float]]:
    """Таймлайн уақытындағы биттер мен такт бастары (бірінші музыка бойынша)."""
    if not tl.music:
        return [], []
    a = tl.music[0]
    try:
        item = project.get(a.media)
    except KeyError:
        return [], []
    ma = project.analysis(item.id).music
    if ma is None:
        return [], []
    segs = a.source_ranges(item.duration)
    beats, downs = [], []
    off = a.start
    for s0, s1 in segs:
        beats += [round(off + t - s0, 3) for t in ma.beats if s0 <= t < s1]
        downs += [round(off + t - s0, 3) for t in ma.downbeats if s0 <= t < s1]
        off += s1 - s0
    return beats, downs


def snap_cuts(project: Project, tl: Timeline, unit: str = "beat", max_shift: float = 0.35) -> dict:
    """Әр кесу нүктесін жақын битке/тактке жылжыту (кадр ұзақтығын кадр санымен қайта есептеу)."""
    beats, downs = timeline_grid(project, tl)
    grid = downs if unit == "bar" else beats
    if unit == "half" and len(beats) > 1:
        grid = sorted(beats + [(a + b) / 2 for a, b in zip(beats[:-1], beats[1:])])
    if not grid:
        return {"moved": 0, "note": "Таймлайнда ырғағы талданған музыка жоқ."}
    fps = project.output_fps()
    media = {m.id: m for m in project.media()}
    res = resolve(tl, fps, {k: m.duration for k, m in media.items() if m.kind == "video"},
                  {k for k, m in media.items() if m.kind == "image"})
    placed = res.placed
    if len(placed) < 2:
        return {"moved": 0}
    tfr = [int(round(p.trans.duration * fps)) for p in placed]
    cuts = [p.start_frame + tfr[i + 1] // 2 for i, p in enumerate(placed[1:])]
    moved = 0
    min_f = max(2, int(0.3 * fps))
    for k in range(len(cuts)):
        cp = cuts[k] / fps
        target = min(grid, key=lambda g: abs(g - cp))
        tf_ = int(round(target * fps))
        if tf_ == cuts[k] or abs(target - cp) > max_shift:
            continue
        lo = (cuts[k - 1] if k > 0 else 0) + min_f
        hi = (cuts[k + 1] if k + 1 < len(cuts) else res.total_frames) - min_f
        if lo <= tf_ <= hi:
            cuts[k] = tf_
            moved += 1
    starts = [0] + [cuts[i] - tfr[i + 1] // 2 for i in range(len(cuts))]
    ends = [starts[i + 1] + tfr[i + 1] for i in range(len(cuts))] + [placed[-1].start_frame + placed[-1].frames]
    for i, p in enumerate(placed):
        c = p.clip
        d = max(1, ends[i] - starts[i]) / fps
        m = media.get(c.media)
        new_out = c.src_in + d * c.speed
        if m is not None and m.kind == "video" and new_out > m.duration:
            c.src_in = max(0.0, m.duration - d * c.speed)
            new_out = c.src_in + d * c.speed
        c.src_out = round(new_out, 4)
    return {"moved": moved, "grid": unit}
