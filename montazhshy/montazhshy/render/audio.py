"""Кәсіби дыбыс миксі.

Кезеңдер:
  1. Әр кадрдың дыбысы FFmpeg-те өңделеді (диалог: шу азайту, EQ, де-эссер, компрессор) — кэшке.
  2. Әр бөліктің қаттылығы (LUFS) өлшеніп, диалогтар бір деңгейге теңестіріледі.
  3. numpy-да шиналарға (диалог / табиғи дыбыс / музыка / эффектілер) орналастырылады:
     J/L-кесулер, тең қуатты (equal-power) кроссфейдтер.
  4. Музыка «алдын ала көретін» ducking-пен басылады: сөйлеу басталардан 0,2 с бұрын төмендейді,
     сөйлеу біткен соң баяу қайтады — нақты уақыттағы компрессор мұны істей алмайды.
  5. Мастер: екі өтімді loudnorm (платформа стандарты, мыс. −14 LUFS, −1 dBTP).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from .. import ffmpeg
from ..media import MediaItem
from ..timeline import AudioItem, AudioMaster, Placed, Resolved

SR = 48000
CH = 2
MICRO_FADE = 0.008  # кесу кезіндегі «шырт» дыбысын болдырмайтын микро-кроссфейд


@dataclass
class AudioReport:
    integrated_lufs: float | None = None
    true_peak: float | None = None
    lra: float | None = None
    dialog_clips: int = 0
    ambience_clips: int = 0
    ducked_seconds: float = 0.0
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return dict(self.__dict__)


# ---------------------------------------------------------------------------
# көмекші функциялар
# ---------------------------------------------------------------------------

def _atempo(speed: float) -> list[str]:
    out = []
    s = speed
    while s > 2.0:
        out.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        out.append("atempo=0.5")
        s /= 0.5
    if abs(s - 1.0) > 1e-3:
        out.append(f"atempo={s:.5f}")
    return out


def dialog_chain(master: AudioMaster, strong: bool = False) -> list[str]:
    if not master.dialog_enhance:
        return ["highpass=f=70"]
    chain = ["highpass=f=80"]
    if master.denoise == "light":
        chain.append("afftdn=nr=10:nf=-42:tn=1")
    elif master.denoise == "strong" or strong:
        chain.append("afftdn=nr=18:nf=-38:tn=1")
    chain += [
        "equalizer=f=250:t=q:w=1.2:g=-2",     # «балшық» жиілікті азайту
        "equalizer=f=4200:t=q:w=1.0:g=2.5",   # анықтық (presence)
        "deesser=i=0.35",
        "acompressor=threshold=-22dB:ratio=3:attack=6:release=120:makeup=2",
    ]
    return chain


def ambience_chain() -> list[str]:
    return ["highpass=f=50"]


def read_raw(path: Path) -> np.ndarray:
    data = np.fromfile(path, dtype="<f4")
    return data.reshape(-1, CH)


def decode(path: Path, *, start: float = 0.0, duration: float | None = None, filters: list[str] | None = None,
           out: Path | None = None) -> np.ndarray:
    args: list[str] = []
    if start > 0:
        args += ["-ss", f"{start:.4f}"]
    args += ["-i", str(path)]
    if duration is not None:
        args += ["-t", f"{duration:.4f}"]
    args += ["-vn", "-sn"]
    if filters:
        args += ["-af", ",".join(filters)]
    args += ["-ac", str(CH), "-ar", str(SR), "-f", "f32le"]
    if out is not None:
        out.parent.mkdir(parents=True, exist_ok=True)
        ffmpeg.run(args + [str(out)])
        return read_raw(out)
    data, _ = ffmpeg.run_capture(args + ["-"])
    return np.frombuffer(data, dtype="<f4").reshape(-1, CH).copy()


def measure_raw(path: Path) -> tuple[float | None, float | None, float | None]:
    """(integrated LUFS, true peak dBTP, LRA) — raw f32 stereo файл үшін."""
    args = ["-f", "f32le", "-ar", str(SR), "-ac", str(CH), "-i", str(path),
            "-af", "ebur128=framelog=quiet:peak=true", "-f", "null", "-"]
    try:
        _, err = ffmpeg.run_capture(args)
    except ffmpeg.FFmpegError:
        return None, None, None
    i = re.findall(r"I:\s+(-?[\d.]+|-inf)\s+LUFS", err)
    tp = re.findall(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS", err)
    lra = re.findall(r"LRA:\s+(-?[\d.]+)\s+LU", err)

    def val(xs: list[str]) -> float | None:
        if not xs or xs[-1] == "-inf":
            return None
        v = float(xs[-1])
        return None if v < -69 else v

    return val(i), val(tp), val(lra)


def eq_fade(n: int, kind: str) -> np.ndarray:
    if n <= 0:
        return np.ones(0, dtype=np.float32)
    x = (np.arange(n, dtype=np.float32) + 0.5) / n
    return (np.sin(0.5 * np.pi * x) if kind == "in" else np.cos(0.5 * np.pi * x)).astype(np.float32)


def apply_fades(y: np.ndarray, fade_in: float, fade_out: float) -> np.ndarray:
    n = len(y)
    fi = min(n, int(round(fade_in * SR)))
    fo = min(n, int(round(fade_out * SR)))
    if fi > 0:
        y[:fi] *= eq_fade(fi, "in")[:, None]
    if fo > 0:
        y[n - fo:] *= eq_fade(fo, "out")[:, None]
    return y


def place(bus: np.ndarray, y: np.ndarray, start: float, gain_db: float = 0.0) -> None:
    i = int(round(start * SR))
    if i < 0:
        y = y[-i:]
        i = 0
    j = min(len(bus), i + len(y))
    if j > i:
        bus[i:j] += y[: j - i] * np.float32(10 ** (gain_db / 20))


def _hash(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# кадр дыбысының рөлі
# ---------------------------------------------------------------------------

def clip_audio_role(p: Placed, item: MediaItem, speech: list[list[float]] | None) -> str:
    mode = p.clip.audio
    if mode in ("mute", "dialog", "ambience"):
        return mode
    if not item.has_audio or item.kind != "video":
        return "mute"
    if not speech:
        return "ambience"
    a, b = p.clip.src_in, p.clip.src_out
    cover = sum(max(0.0, min(b, y) - max(a, x)) for x, y in speech)
    return "dialog" if cover / max(1e-3, b - a) > 0.3 else "ambience"


# ---------------------------------------------------------------------------
# негізгі микс
# ---------------------------------------------------------------------------

@dataclass
class MixInputs:
    resolved: Resolved
    media: dict[str, MediaItem]
    paths: dict[str, Path]
    speech: dict[str, list[list[float]]]  # media id → сөйлеу кесінділері (көз уақытында)
    lufs: dict[str, float | None]  # media id → файлдың қаттылығы
    music: list[AudioItem]
    voiceover: list[AudioItem]
    sfx: list[AudioItem]
    master: AudioMaster
    cache: Path


def mix(inp: MixInputs, out_wav: Path, *, stems_dir: Path | None = None,
        progress: Callable[[float], None] | None = None) -> AudioReport:
    total = inp.resolved.total
    n = int(np.ceil(total * SR)) + 1
    dialog = np.zeros((n, CH), dtype=np.float32)
    amb = np.zeros((n, CH), dtype=np.float32)
    music = np.zeros((n, CH), dtype=np.float32)
    fx = np.zeros((n, CH), dtype=np.float32)
    rep = AudioReport()
    m = inp.master
    placed = inp.resolved.placed
    steps = max(1, len(placed) + len(inp.music) + len(inp.voiceover) + len(inp.sfx) + 2)
    step = 0

    def tick() -> None:
        nonlocal step
        step += 1
        if progress:
            progress(min(0.95, step / steps))

    # ---- кадрлардың өз дыбысы
    for k, p in enumerate(placed):
        tick()
        item = inp.media.get(p.clip.media)
        if item is None:
            continue
        role = clip_audio_role(p, item, inp.speech.get(item.id))
        if role == "mute" or not item.has_audio:
            continue
        c = p.clip
        sp = c.speed
        nxt = placed[k + 1] if k + 1 < len(placed) else None
        # J/L-кесулер және микро-кроссфейд үшін көз аралығын кеңейту
        lead = max(0.0, c.j_cut) + (MICRO_FADE / 2 if p.trans.type == "cut" else 0.0)
        tail = max(0.0, c.l_cut) + (MICRO_FADE / 2 if (nxt is None or nxt.trans.type == "cut") else 0.0)
        a_in = max(0.0, c.src_in - lead * sp)
        a_out = min(item.duration, c.src_out + tail * sp)
        lead = (c.src_in - a_in) / sp
        dur_src = a_out - a_in
        if dur_src <= 0.02:
            continue
        chain = _atempo(sp) + (dialog_chain(m) if role == "dialog" else ambience_chain())
        key = _hash("clipaudio", item.path, item.size, item.mtime, round(a_in, 4), round(dur_src, 4), chain)
        raw = inp.cache / f"a_{key}.f32"
        meta = inp.cache / f"a_{key}.json"
        if raw.exists() and meta.exists():
            y = read_raw(raw)
            lufs = json.loads(meta.read_text()).get("lufs")
        else:
            y = decode(inp.paths[item.id], start=a_in, duration=dur_src, filters=chain, out=raw)
            lufs, _, _ = measure_raw(raw)
            meta.write_text(json.dumps({"lufs": lufs}))
        if len(y) == 0:
            continue
        y = y.copy()
        fade_in = p.trans.duration if p.trans.type != "cut" else (min(0.25, c.j_cut) if c.j_cut > 0 else MICRO_FADE)
        if nxt is not None and nxt.trans.type != "cut":
            fade_out = nxt.trans.duration
        else:
            fade_out = min(0.3, c.l_cut) if c.l_cut > 0 else MICRO_FADE
        apply_fades(y, fade_in, fade_out)
        if role == "dialog":
            target = m.dialog_lufs
            rep.dialog_clips += 1
        else:
            target = m.dialog_lufs + m.ambience_db
            rep.ambience_clips += 1
        gain = 0.0 if lufs is None else max(-15.0, min(15.0, target - lufs))
        place(dialog if role == "dialog" else amb, y, p.start - lead, gain + c.gain_db)

    # ---- дикторлық мәтін (voice-over)
    for a in inp.voiceover:
        tick()
        item = inp.media.get(a.media)
        if item is None:
            continue
        for (s0, s1) in a.source_ranges(item.duration)[:1]:
            chain = dialog_chain(m)
            key = _hash("vo", item.path, item.size, item.mtime, round(s0, 4), round(s1 - s0, 4), chain)
            raw = inp.cache / f"a_{key}.f32"
            meta = inp.cache / f"a_{key}.json"
            if raw.exists() and meta.exists():
                y = read_raw(raw)
                lufs = json.loads(meta.read_text()).get("lufs")
            else:
                y = decode(inp.paths[item.id], start=s0, duration=s1 - s0, filters=chain, out=raw)
                lufs, _, _ = measure_raw(raw)
                meta.write_text(json.dumps({"lufs": lufs}))
            y = apply_fades(y.copy(), max(MICRO_FADE, a.fade_in), max(MICRO_FADE, a.fade_out))
            gain = 0.0 if lufs is None else max(-15.0, min(15.0, m.dialog_lufs - lufs))
            place(dialog, y, a.start, gain + a.gain_db)

    # ---- музыка (музыкалық монтажбен)
    for a in inp.music:
        tick()
        item = inp.media.get(a.media)
        if item is None:
            continue
        src = decode(inp.paths[item.id])
        ranges = a.source_ranges(len(src) / SR)
        y = splice(src, ranges)
        if len(y) == 0:
            continue
        apply_fades(y, max(MICRO_FADE, a.fade_in), max(MICRO_FADE, a.fade_out))
        lufs = inp.lufs.get(item.id)
        gain = 0.0 if lufs is None else max(-20.0, min(12.0, m.music_lufs - lufs))
        target = music if a.duck else fx
        place(target, y, a.start, gain + a.gain_db)

    # ---- дыбыс эффектілері
    for a in inp.sfx:
        tick()
        item = inp.media.get(a.media)
        if item is None:
            continue
        s0, s1 = a.source_ranges(item.duration)[0]
        y = decode(inp.paths[item.id], start=s0, duration=s1 - s0)
        apply_fades(y, max(MICRO_FADE, a.fade_in), max(MICRO_FADE, a.fade_out))
        place(fx, y, a.start, a.gain_db)

    # ---- алдын ала көретін ducking
    env, ducked = duck_envelope(dialog, m.duck_db)
    rep.ducked_seconds = round(ducked, 2)
    music *= env[:, None]
    # табиғи дыбыс та диктор/диалог астында сәл басылады
    amb *= (1 - (1 - env) * 0.35)[:, None]

    premaster = dialog + amb + music + fx
    tick()
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    pre_raw = out_wav.with_suffix(".premaster.f32")
    premaster.astype("<f4").tofile(pre_raw)
    stats = loudnorm(pre_raw, out_wav, m.target_lufs, m.true_peak, total)
    rep.integrated_lufs, rep.true_peak, rep.lra = stats
    if stems_dir is not None:
        write_stems(stems_dir, {"dialog": dialog, "music": music, "effects": amb + fx}, pre_raw, out_wav)
    pre_raw.unlink(missing_ok=True)
    if progress:
        progress(1.0)
    return rep


def splice(src: np.ndarray, ranges: list[list[float]], xfade: float = 0.04) -> np.ndarray:
    """Музыка бөліктерін тең қуатты қысқа кроссфейдпен біріктіру (жапсар — дәл такт басында)."""
    if not ranges:
        return np.zeros((0, CH), dtype=np.float32)
    h = int(xfade * SR / 2)
    pieces = []
    for k, (a, b) in enumerate(ranges):
        i0 = int(round(a * SR)) - (h if k > 0 else 0)
        i1 = int(round(b * SR)) + (h if k < len(ranges) - 1 else 0)
        i0, i1 = max(0, i0), min(len(src), i1)
        pieces.append(src[i0:i1].copy())
    out = pieces[0]
    for nxt in pieces[1:]:
        L = min(2 * h, len(out), len(nxt))
        if L > 0:
            mixz = out[-L:] * eq_fade(L, "out")[:, None] + nxt[:L] * eq_fade(L, "in")[:, None]
            out = np.concatenate([out[:-L], mixz, nxt[L:]])
        else:
            out = np.concatenate([out, nxt])
    return out


def duck_envelope(dialog: np.ndarray, duck_db: float, *, lookahead: float = 0.22, attack: float = 0.18,
                  release: float = 0.7, hold: float = 0.35) -> tuple[np.ndarray, float]:
    """Диалог шинасының белсенділігінен музыканың көбейткіш қисығын жасау."""
    n = len(dialog)
    if n == 0 or duck_db <= 0:
        return np.ones(n, dtype=np.float32), 0.0
    hop = int(0.02 * SR)
    nb = n // hop + 1
    mono = np.abs(dialog).max(axis=1)
    pad = np.zeros(nb * hop, dtype=np.float32)
    pad[:n] = mono
    rms = np.sqrt((pad.reshape(nb, hop) ** 2).mean(axis=1))
    active = rms > 10 ** (-42 / 20)
    if not np.any(active):
        return np.ones(n, dtype=np.float32), 0.0
    # hold: қысқа үзілістерде музыка «секірмесін»
    hb = int(hold / 0.02)
    act = active.copy()
    last = -10**9
    for i in range(nb):
        if active[i]:
            last = i
        elif i - last <= hb:
            act[i] = True
    # lookahead: сөйлеу басталмай тұрып баса бастау
    la = int(lookahead / 0.02)
    if la > 0:
        shifted = np.zeros_like(act)
        shifted[:-la] = act[la:]
        act = act | shifted
    target = np.where(act, 10 ** (-duck_db / 20), 1.0).astype(np.float32)
    env = np.empty(nb, dtype=np.float32)
    g = 1.0
    a_step = 0.02 / attack
    r_step = 0.02 / release
    lo = 10 ** (-duck_db / 20)
    for i in range(nb):
        t = target[i]
        if t < g:
            g = max(t, g - a_step * (1 - lo))
        else:
            g = min(t, g + r_step * (1 - lo))
        env[i] = g
    full = np.interp(np.arange(n) / hop, np.arange(nb), env).astype(np.float32)
    return full, float(act.sum() * 0.02)


def _measure_loudnorm(inp: list[str], target: float, tp: float) -> dict | None:
    try:
        _, err = ffmpeg.run_capture(inp + ["-af", f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json",
                                           "-f", "null", "-"])
        js = json.loads(err[err.rindex("{"): err.rindex("}") + 1])
        return js if float(js["input_i"]) > -69 else None
    except (ffmpeg.FFmpegError, ValueError, KeyError):
        return None


def loudnorm(pre_raw: Path, out_wav: Path, target: float, tp: float, total: float
             ) -> tuple[float | None, float | None, float | None]:
    """EBU R128 нормалау. Қайтарады: шығыс (LUFS, dBTP, LRA).

    Шыңы биік (crest factor үлкен) микс тікелей күшейтуге көнбейді: ондай кезде алдымен мастер-лимитер
    (look-ahead, true peak) қолданамыз, сосын сызықтық loudnorm — нәтиже мақсатқа ±0.5 LU дәл түседі.
    """
    inp = ["-f", "f32le", "-ar", str(SR), "-ac", str(CH), "-i", str(pre_raw)]
    js = _measure_loudnorm(inp, target, tp)
    if js is None:  # тыныштық: тек форматын ауыстырамыз
        ffmpeg.run(inp + ["-t", f"{total:.4f}", "-c:a", "pcm_s24le", str(out_wav)])
        return None, None, None
    gain = target - float(js["input_i"])
    if float(js["input_tp"]) + gain > tp - 0.2:
        limited = pre_raw.with_suffix(".lim.f32")
        lim = 10 ** ((tp - 0.6) / 20)
        ffmpeg.run(inp + ["-af", f"volume={gain + 0.4:.2f}dB,alimiter=limit={lim:.5f}:attack=4:release=60:level=false",
                          "-ac", str(CH), "-ar", str(SR), "-f", "f32le", str(limited)])
        inp = ["-f", "f32le", "-ar", str(SR), "-ac", str(CH), "-i", str(limited)]
        js = _measure_loudnorm(inp, target, tp) or js
    else:
        limited = None
    second = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}"
              f":measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}"
              f":offset={js['target_offset']}:linear=true:print_format=json,aresample={SR}")
    try:
        _, err2 = ffmpeg.run_capture(inp + ["-af", second, "-t", f"{total:.4f}", "-c:a", "pcm_s24le", "-y",
                                            str(out_wav)])
    finally:
        if limited is not None:
            limited.unlink(missing_ok=True)
    try:
        js2 = json.loads(err2[err2.rindex("{"): err2.rindex("}") + 1])
        return float(js2["output_i"]), float(js2["output_tp"]), float(js2["output_lra"])
    except (ValueError, KeyError):
        return None, None, None


def write_stems(stems_dir: Path, buses: dict[str, np.ndarray], pre_raw: Path, master_wav: Path) -> None:
    """Диалог / музыка / эффектілер стемдері (мастермен бірдей күшейтумен)."""
    stems_dir.mkdir(parents=True, exist_ok=True)
    # мастердің орташа күшейтуін табу: қаттылықтар айырмасы
    pre_i, _, _ = measure_raw(pre_raw)
    try:
        _, err = ffmpeg.run_capture(["-i", str(master_wav), "-af", "ebur128=framelog=quiet", "-f", "null", "-"])
        mi = re.findall(r"I:\s+(-?[\d.]+)\s+LUFS", err)
        post_i = float(mi[-1]) if mi else None
    except ffmpeg.FFmpegError:
        post_i = None
    gain = 0.0 if pre_i is None or post_i is None else post_i - pre_i
    k = np.float32(10 ** (gain / 20))
    for name, bus in buses.items():
        raw = stems_dir / f"{name}.f32"
        (bus * k).astype("<f4").tofile(raw)
        ffmpeg.run(["-f", "f32le", "-ar", str(SR), "-ac", str(CH), "-i", str(raw), "-c:a", "pcm_s24le",
                    str(stems_dir / f"{name}.wav")])
        raw.unlink(missing_ok=True)
