"""Музыканы талдау: темп (BPM), биттер, такт басы (downbeat), энергия және бөлімдер.

Тек numpy қолданылады. Алгоритмдер:
  * onset (дыбыс соққысы) қисығы — мел-спектрдің оң өзгерісі (spectral flux);
  * темп — onset қисығының автокорреляциясы + 120 BPM маңындағы логарифмдік приор;
  * биттер — динамикалық бағдарламалау (Ellis, 2007), librosa-дағы әдіс сияқты;
  * такт басы — төмен жиіліктегі (бас/барабан) соққылардың 4 фазасының ең күштісі;
  * бөлімдер — такт бойынша белгілердің өзін-өзі ұқсастық матрицасындағы «жаңалық» шыңдары.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np

SR = 22050
HOP = 512
N_FFT = 2048
ONSET_LAG = -0.026  # секунд: орталықтанған терезе шыңды ~26 мс ерте береді


@dataclass
class Section:
    start: float
    end: float
    energy: float  # 0..1
    label: str  # "тыныш" | "орташа" | "қарқынды"


@dataclass
class MusicAnalysis:
    duration: float
    bpm: float
    beats: list[float]
    downbeats: list[float]
    beat_strength: list[float]
    sections: list[Section] = field(default_factory=list)
    drops: list[float] = field(default_factory=list)  # энергия күрт өсетін сәттер
    confidence: float = 0.0  # ырғақтың айқындығы 0..1
    energy_curve: list[float] = field(default_factory=list)  # секундына 2 мән, 0..1

    def to_dict(self) -> dict:
        d = asdict(self)
        d["sections"] = [asdict(s) for s in self.sections]
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "MusicAnalysis":
        d = dict(d)
        d["sections"] = [Section(**s) for s in d.get("sections", [])]
        return cls(**d)

    # --- торға қатысты көмекші функциялар ---
    def grid(self, unit: str = "beat") -> np.ndarray:
        if unit == "bar":
            return np.asarray(self.downbeats, dtype=float)
        if unit == "half":
            b = np.asarray(self.beats, dtype=float)
            if len(b) < 2:
                return b
            mids = (b[:-1] + b[1:]) / 2
            return np.sort(np.concatenate([b, mids]))
        return np.asarray(self.beats, dtype=float)

    def nearest(self, t: float, unit: str = "beat") -> float:
        g = self.grid(unit)
        if len(g) == 0:
            return t
        return float(g[np.argmin(np.abs(g - t))])

    def energy_at(self, t: float) -> float:
        if not self.energy_curve:
            return 0.5
        i = int(t * 2)
        i = max(0, min(len(self.energy_curve) - 1, i))
        return float(self.energy_curve[i])


# ---------------------------------------------------------------------------
# спектр
# ---------------------------------------------------------------------------

def _mel_filterbank(sr: int, n_fft: int, n_mels: int = 64, fmin: float = 30.0, fmax: float | None = None
                    ) -> tuple[np.ndarray, np.ndarray]:
    fmax = fmax or sr / 2

    def hz_to_mel(f):
        return 2595.0 * np.log10(1.0 + np.asarray(f) / 700.0)

    def mel_to_hz(m):
        return 700.0 * (10 ** (np.asarray(m) / 2595.0) - 1.0)

    mels = np.linspace(hz_to_mel(fmin), hz_to_mel(fmax), n_mels + 2)
    hz = mel_to_hz(mels)
    bins = np.fft.rfftfreq(n_fft, 1.0 / sr)
    fb = np.zeros((n_mels, len(bins)), dtype=np.float32)
    for i in range(n_mels):
        lo, ce, hi = hz[i], hz[i + 1], hz[i + 2]
        up = (bins - lo) / max(ce - lo, 1e-9)
        down = (hi - bins) / max(hi - ce, 1e-9)
        fb[i] = np.maximum(0, np.minimum(up, down))
    return fb, hz[1:-1]


def _stft_mag(y: np.ndarray, n_fft: int = N_FFT, hop: int = HOP) -> np.ndarray:
    pad = n_fft // 2
    y = np.pad(y.astype(np.float32), (pad, pad), mode="reflect" if len(y) > pad else "constant")
    n_frames = 1 + max(0, (len(y) - n_fft) // hop)
    win = np.hanning(n_fft).astype(np.float32)
    out = np.empty((n_frames, n_fft // 2 + 1), dtype=np.float32)
    step = 1024
    strides = (y.strides[0] * hop, y.strides[0])
    frames = np.lib.stride_tricks.as_strided(y, shape=(n_frames, n_fft), strides=strides, writeable=False)
    for i in range(0, n_frames, step):
        out[i : i + step] = np.abs(np.fft.rfft(frames[i : i + step] * win, axis=1))
    return out


def onset_envelopes(y: np.ndarray, sr: int = SR) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(толық onset, төмен жиілік onset, кадр RMS) — бәрі HOP кадрмен."""
    mag = _stft_mag(y)
    fb, centers = _mel_filterbank(sr, N_FFT)
    mel = mag @ fb.T
    logmel = np.log1p(100.0 * mel)
    diff = np.diff(logmel, axis=0, prepend=logmel[:1])
    flux = np.maximum(diff, 0)
    env = flux.mean(axis=1)
    low = flux[:, centers < 180].mean(axis=1) if np.any(centers < 180) else env
    # жергілікті ортаны алып тастау — ұзақ crescendo-лар биттерді жасырмасын
    k = 16
    kernel = np.ones(k) / k
    env = np.maximum(0, env - np.convolve(env, kernel, mode="same") * 0.5)
    rms = np.sqrt((mag ** 2).mean(axis=1))
    return env.astype(np.float32), low.astype(np.float32), rms.astype(np.float32)


# ---------------------------------------------------------------------------
# темп және биттер
# ---------------------------------------------------------------------------

def estimate_tempo(env: np.ndarray, fr: float, *, min_bpm: float = 50, max_bpm: float = 210,
                   prior_bpm: float = 120.0) -> tuple[float, float]:
    """(bpm, сенімділік) қайтарады."""
    if len(env) < fr * 4 or not np.any(env > 0):
        return 120.0, 0.0
    # Onset шыңдары тар (1–2 кадр) — бөлшек лагтарда автокорреляция «жоғалмасын» деп тегістейміз.
    g = np.exp(-0.5 * (np.arange(-4, 5) / 1.5) ** 2)
    x = np.convolve(env, g / g.sum(), mode="same")
    x = x - x.mean()
    n = 1 << int(np.ceil(np.log2(2 * len(x))))
    spec = np.fft.rfft(x, n)
    ac = np.fft.irfft(spec * np.conj(spec), n)[: len(x)]
    ac /= ac[0] + 1e-9
    lag_min = int(np.floor(60 * fr / max_bpm))
    lag_max = int(np.ceil(60 * fr / min_bpm))
    lags = np.arange(lag_min, lag_max + 1, dtype=float)
    lags = lags[lags * 4 < len(ac) - 1] if np.any(lags * 4 < len(ac) - 1) else lags[:1]
    fine = np.arange(lags[0], lags[-1] + 0.25, 0.25)

    def at(lag: np.ndarray) -> np.ndarray:
        return np.interp(lag, np.arange(len(ac)), ac)

    # Гармоникалық қосынды: шын период оның еселіктерінде де күшті корреляция береді.
    score = sum(w * np.maximum(at(fine * k), 0) for k, w in ((1, 1.0), (2, 0.5), (3, 0.33), (4, 0.25)))
    bpms = 60.0 * fr / fine
    prior = np.exp(-0.5 * (np.log2(bpms / prior_bpm) / 1.0) ** 2)
    total = score * prior
    i = int(np.argmax(total))
    lag = float(fine[i])
    bpm = 60.0 * fr / lag
    conf = float(np.clip(at(np.array([lag]))[0] * 2.0, 0, 1))
    return float(bpm), conf


def track_beats(env: np.ndarray, fr: float, bpm: float, tightness: float = 100.0) -> np.ndarray:
    """Ellis (2007) динамикалық бағдарламалау әдісі. Кадр индекстерін қайтарады."""
    n = len(env)
    if n == 0:
        return np.array([], dtype=int)
    period = 60.0 * fr / bpm
    std = env.std()
    if std <= 0:
        return np.array([], dtype=int)
    onset = env / std
    win = np.exp(-0.5 * (np.arange(-period, period + 1) * 32.0 / period) ** 2)
    local = np.convolve(onset, win, mode="same")
    backlink = np.full(n, -1, dtype=int)
    cum = np.zeros(n)
    lo = -int(round(2 * period))
    hi = -int(round(period / 2))
    offsets = np.arange(lo, hi + 1)
    txcost = -tightness * np.log(-offsets / period) ** 2
    first = True
    for i in range(n):
        idx = i + offsets
        valid = idx >= 0
        if not np.any(valid):
            cum[i] = local[i]
            continue
        cand = cum[idx[valid]] + txcost[valid]
        j = int(np.argmax(cand))
        best = cand[j]
        if first and local[i] < 0.01 * local.max():
            cum[i] = local[i]
            continue
        first = False
        cum[i] = local[i] + best
        backlink[i] = idx[valid][j]
    # соңғы бит: жергілікті максимумдардың медианасынан жоғары соңғысы
    maxes = (cum[1:-1] > cum[:-2]) & (cum[1:-1] >= cum[2:])
    peaks = np.flatnonzero(maxes) + 1
    if len(peaks) == 0:
        return np.array([], dtype=int)
    med = np.median(cum[peaks])
    good = peaks[cum[peaks] >= 0.5 * med]
    last = int(good[-1]) if len(good) else int(np.argmax(cum))
    beats = [last]
    while backlink[beats[-1]] >= 0:
        beats.append(int(backlink[beats[-1]]))
    beats = np.array(beats[::-1], dtype=int)
    # шеттегі әлсіз биттерді кесу
    thr = 0.5 * np.sqrt(np.mean(local ** 2))
    strong = np.flatnonzero(local[beats] > thr)
    if len(strong):
        beats = beats[strong[0] : strong[-1] + 1]
    return beats


def _refine_peaks(env: np.ndarray, frames: np.ndarray, radius: int = 2) -> np.ndarray:
    """Әр биттің уақытын жергілікті шыңға жылжытып, параболамен бөлшек кадрға дейін нақтылау."""
    out = np.empty(len(frames), dtype=float)
    n = len(env)
    for i, f in enumerate(frames):
        a, b = max(1, f - radius), min(n - 1, f + radius + 1)
        if b <= a:
            out[i] = float(f)
            continue
        j = a + int(np.argmax(env[a:b]))
        if 0 < j < n - 1:
            y0, y1, y2 = env[j - 1], env[j], env[j + 1]
            denom = y0 - 2 * y1 + y2
            frac = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-12 else 0.0
            out[i] = j + float(np.clip(frac, -0.5, 0.5))
        else:
            out[i] = float(j)
    return out


def _downbeat_phase(beat_frames: np.ndarray, low_env: np.ndarray, env: np.ndarray, rms: np.ndarray,
                    meter: int = 4) -> int:
    if len(beat_frames) < meter * 2:
        return 0
    low_n = low_env / (low_env.std() + 1e-9)
    env_n = env / (env.std() + 1e-9)

    def pick(arr: np.ndarray, f: int) -> float:
        return float(arr[max(0, f - 2) : f + 3].max())

    strengths = np.array([1.5 * pick(low_n, f) + 0.5 * pick(env_n, f) for f in beat_frames])
    # гармониялық өзгерістер такт басында жиі: RMS өсімін де қосамыз
    scores = [strengths[p::meter].mean() for p in range(meter)]
    return int(np.argmax(scores))


# ---------------------------------------------------------------------------
# бөлімдер
# ---------------------------------------------------------------------------

def _sections(bar_times: np.ndarray, frame_rms: np.ndarray, mag_feats: np.ndarray, fr: float, duration: float
              ) -> tuple[list[Section], list[float]]:
    if len(bar_times) < 4:
        e = float(np.clip(np.mean(frame_rms) / (np.percentile(frame_rms, 95) + 1e-9), 0, 1)) if len(frame_rms) else 0.5
        return [Section(0.0, duration, e, _label(e))], []
    edges = list(bar_times) + [duration]
    feats = []
    energies = []
    for a, b in zip(edges[:-1], edges[1:]):
        fa, fb = int(a * fr), max(int(a * fr) + 1, int(b * fr))
        seg = mag_feats[fa:fb]
        r = frame_rms[fa:fb]
        feats.append(seg.mean(axis=0) if len(seg) else np.zeros(mag_feats.shape[1]))
        energies.append(float(np.sqrt(np.mean(r ** 2))) if len(r) else 0.0)
    feats = np.array(feats)
    energies = np.array(energies)
    ref = np.percentile(energies, 95) + 1e-9
    en = np.clip(energies / ref, 0, 1)
    f = feats / (np.linalg.norm(feats, axis=1, keepdims=True) + 1e-9)
    f = np.concatenate([f, en[:, None] * 2.0], axis=1)
    ssm = f @ f.T
    k = 4
    nb = len(bar_times)
    novelty = np.zeros(nb)
    kern = np.ones((2 * k, 2 * k))
    kern[:k, k:] = -1
    kern[k:, :k] = -1
    padded = np.pad(ssm, k, mode="edge")
    for i in range(nb):
        novelty[i] = float((padded[i : i + 2 * k, i : i + 2 * k] * kern).sum())
    novelty = np.maximum(novelty, 0)
    # энергия секірістері де бөлім шекарасы
    jump = np.abs(np.diff(en, prepend=en[0]))
    nov = novelty / (novelty.max() + 1e-9) + 1.2 * jump
    bounds = [0]
    order = np.argsort(-nov)
    thr = max(0.35, np.percentile(nov, 75))
    for i in order:
        if nov[i] < thr:
            break
        if i == 0:
            continue
        if all(abs(i - b) >= 4 for b in bounds):
            bounds.append(int(i))
    bounds = sorted(bounds)
    sections: list[Section] = []
    for j, b in enumerate(bounds):
        e_idx = bounds[j + 1] if j + 1 < len(bounds) else nb
        start = 0.0 if j == 0 else float(bar_times[b])
        end = float(bar_times[e_idx]) if e_idx < nb else duration
        e = float(en[b:e_idx].mean()) if e_idx > b else float(en[b])
        sections.append(Section(round(start, 3), round(end, 3), round(e, 3), _label(e)))
    drops = []
    for prev, cur in zip(sections[:-1], sections[1:]):
        if cur.energy - prev.energy > 0.22 and cur.energy > 0.6:
            drops.append(cur.start)
    return sections, drops


def _label(e: float) -> str:
    if e < 0.45:
        return "тыныш"
    if e < 0.72:
        return "орташа"
    return "қарқынды"


# ---------------------------------------------------------------------------
# негізгі функция
# ---------------------------------------------------------------------------

def analyze_music(y: np.ndarray, sr: int = SR) -> MusicAnalysis:
    duration = len(y) / sr
    fr = sr / HOP
    if duration < 2.0 or not np.any(np.abs(y) > 1e-4):
        return MusicAnalysis(duration=duration, bpm=0.0, beats=[], downbeats=[], beat_strength=[],
                             sections=[Section(0.0, duration, 0.0, "тыныш")], confidence=0.0)
    env, low, rms = onset_envelopes(y, sr)
    # Ырғақты көбіне бас/барабан ұстайды: жалпы onset-ке төмен жиілікті onset-ті қосамыз,
    # әйтпесе хэт сияқты жоғары жиілікті соққылар 8-ші үлестерді бит деп алдап кетеді.
    beat_env = env / (env.std() + 1e-9) + low / (low.std() + 1e-9)
    bpm, conf = estimate_tempo(beat_env, fr)
    beat_frames = track_beats(beat_env, fr, bpm)
    beat_pos = _refine_peaks(beat_env, beat_frames)
    if len(beat_pos) >= 8:
        # нақты биттерге сызықтық регрессия — темп бөлшек кадрға дейін дәл
        k = np.arange(len(beat_pos))
        slope = np.polyfit(k, beat_pos, 1)[0]
        if slope > 0:
            bpm = 60.0 * fr / slope
    # Орталықтанған STFT терезесі соққыны сәл ерте «сезеді» — тұрақты ығысуды түзетеміз.
    beat_times = np.maximum(0.0, beat_pos * HOP / sr - ONSET_LAG)
    env_n = env / (env.max() + 1e-9)
    strength = [float(env_n[max(0, f - 2) : f + 3].max()) for f in beat_frames]
    phase = _downbeat_phase(beat_frames, low, env, rms)
    downbeats = beat_times[phase::4] if len(beat_times) else np.array([])
    # бөлімдер үшін қарапайым спектрлік белгілер (төмен/орта/жоғары жолақтар)
    mag = _stft_mag(y)
    nb = mag.shape[1]
    bands = np.stack([
        mag[:, : nb // 32].mean(axis=1),
        mag[:, nb // 32 : nb // 8].mean(axis=1),
        mag[:, nb // 8 : nb // 3].mean(axis=1),
        mag[:, nb // 3 :].mean(axis=1),
    ], axis=1)
    bands = np.log1p(100 * bands)
    sections, drops = _sections(downbeats, rms, bands, fr, duration)
    # энергия қисығы: секундына 2 мән
    step = max(1, int(fr / 2))
    curve = [float(np.sqrt(np.mean(rms[i : i + step] ** 2))) for i in range(0, len(rms), step)]
    ref = np.percentile(curve, 95) + 1e-9 if curve else 1.0
    curve = [round(float(min(1.0, c / ref)), 3) for c in curve]
    regularity = 0.0
    if len(beat_frames) > 4:
        d = np.diff(beat_frames)
        regularity = float(np.clip(1.0 - np.std(d) / (np.mean(d) + 1e-9) * 4, 0, 1))
    confidence = round(float(np.clip(0.5 * conf + 0.5 * regularity, 0, 1)), 3)
    return MusicAnalysis(
        duration=round(duration, 3),
        bpm=round(float(bpm), 2),
        beats=[round(float(t), 3) for t in beat_times],
        downbeats=[round(float(t), 3) for t in downbeats],
        beat_strength=[round(s, 3) for s in strength],
        sections=sections,
        drops=[round(float(d), 3) for d in drops],
        confidence=confidence,
        energy_curve=curve,
    )
