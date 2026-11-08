"""Дыбысты талдау: қаттылық (LUFS), сөйлеу белсенділігі (VAD), тыныштық, толқын пішіні."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np

from .. import ffmpeg

VAD_SR = 16000


@dataclass
class AudioAnalysis:
    duration: float
    lufs: float | None  # интегралды қаттылық
    peak_db: float
    speech: list[list[float]] = field(default_factory=list)  # [[басы, соңы], ...]
    speech_ratio: float = 0.0
    silence: list[list[float]] = field(default_factory=list)
    noise_floor_db: float = -90.0
    waveform: list[int] = field(default_factory=list)  # секундына WAVE_RATE мән, 0..100
    wave_rate: int = 10

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "AudioAnalysis":
        return cls(**d)

    def is_speech_at(self, t: float) -> bool:
        return any(a <= t <= b for a, b in self.speech)


def measure_lufs(path: str | Path, start: float | None = None, duration: float | None = None) -> float | None:
    args: list[str] = []
    if start:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if duration:
        args += ["-t", f"{duration:.3f}"]
    args += ["-vn", "-af", "ebur128=framelog=quiet", "-f", "null", "-"]
    try:
        _, err = ffmpeg.run_capture(args)
    except ffmpeg.FFmpegError:
        return None
    m = re.findall(r"I:\s+(-?[\d.]+|-inf)\s+LUFS", err)
    if not m or m[-1] == "-inf":
        return None
    v = float(m[-1])
    return None if v < -69 else v


def _frames(y: np.ndarray, size: int, hop: int) -> np.ndarray:
    if len(y) < size:
        y = np.pad(y, (0, size - len(y)))
    n = 1 + (len(y) - size) // hop
    return np.lib.stride_tricks.as_strided(y, shape=(n, size), strides=(y.strides[0] * hop, y.strides[0]),
                                           writeable=False)


def detect_speech(y: np.ndarray, sr: int = VAD_SR) -> tuple[list[list[float]], float]:
    """Қарапайым, бірақ сенімді VAD: энергия + сөйлеу жолағының үлесі + спектрлік тегістік.

    Қайтарады: (сөйлеу кесінділері, шу деңгейі dB).
    """
    if len(y) < sr // 2:
        return [], -90.0
    size, hop = 512, 256  # 32 мс / 16 мс
    fr = _frames(y.astype(np.float32), size, hop)
    win = np.hanning(size).astype(np.float32)
    spec = np.abs(np.fft.rfft(fr * win, axis=1)) ** 2 + 1e-12
    freqs = np.fft.rfftfreq(size, 1 / sr)
    total = spec.sum(axis=1)
    band = spec[:, (freqs >= 150) & (freqs <= 4000)].sum(axis=1)
    ratio = band / total
    energy_db = 10 * np.log10(total / size + 1e-12)
    flat = np.exp(np.mean(np.log(spec), axis=1)) / np.mean(spec, axis=1)
    noise = float(np.percentile(energy_db, 10))
    loud = energy_db > max(noise + 9.0, -60.0)
    voiced = loud & (ratio > 0.5) & (flat < 0.3)
    # тегістеу: 0.25 с медианасы + «hangover»
    k = 15
    sm = np.convolve(voiced.astype(float), np.ones(k) / k, mode="same") > 0.35
    hang = int(0.25 * sr / hop)
    out = sm.copy()
    last = -10**9
    for i, v in enumerate(sm):
        if v:
            last = i
        elif i - last <= hang:
            out[i] = True
    segs: list[list[float]] = []
    t = lambda i: i * hop / sr  # noqa: E731
    i = 0
    n = len(out)
    while i < n:
        if out[i]:
            j = i
            while j < n and out[j]:
                j += 1
            a, b = t(i), t(j) + size / sr
            # Сөйлеудің буындық тербелісі бар; тұрақты тон/гуіл (std аз) сөйлеу емес.
            if b - a >= 0.3 and float(np.std(energy_db[i:j])) > 3.0:
                segs.append([round(a, 3), round(b, 3)])
            i = j
        else:
            i += 1
    # жақын кесінділерді біріктіру (сөз арасындағы қысқа үзілістер)
    merged: list[list[float]] = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 0.35:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged, noise


def silences(speech: list[list[float]], duration: float, min_len: float = 0.4) -> list[list[float]]:
    out: list[list[float]] = []
    cur = 0.0
    for a, b in speech:
        if a - cur >= min_len:
            out.append([round(cur, 3), round(a, 3)])
        cur = max(cur, b)
    if duration - cur >= min_len:
        out.append([round(cur, 3), round(duration, 3)])
    return out


def waveform_peaks(y: np.ndarray, sr: int, rate: int = 10) -> list[int]:
    step = max(1, sr // rate)
    n = len(y) // step
    if n == 0:
        return []
    blocks = np.abs(y[: n * step]).reshape(n, step).max(axis=1)
    ref = max(1e-6, float(np.percentile(blocks, 99.5)))
    return [int(v) for v in np.clip(blocks / ref * 100, 0, 100).round()]


def analyze_audio(path: str | Path, duration: float, *, want_speech: bool = True) -> AudioAnalysis:
    y = ffmpeg.read_pcm(path, VAD_SR)
    if len(y) == 0:
        return AudioAnalysis(duration=duration, lufs=None, peak_db=-90.0)
    peak = float(np.abs(y).max())
    peak_db = 20 * np.log10(peak) if peak > 0 else -90.0
    speech, noise = detect_speech(y) if want_speech else ([], -90.0)
    sp_total = sum(b - a for a, b in speech)
    real_dur = len(y) / VAD_SR
    return AudioAnalysis(
        duration=round(real_dur, 3),
        lufs=measure_lufs(path),
        peak_db=round(peak_db, 2),
        speech=speech,
        speech_ratio=round(sp_total / max(real_dur, 1e-6), 3),
        silence=silences(speech, real_dur) if want_speech else [],
        noise_floor_db=round(noise, 1),
        waveform=waveform_peaks(y, VAD_SR),
    )
