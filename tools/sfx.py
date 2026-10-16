"""Synthesize the subtle UI sound effects (no samples, no licensing).

Writes public/audio/sfx/*.wav (48 kHz mono). Deterministic: same output every run.
"""

from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "public" / "audio" / "sfx"
rng = np.random.default_rng(7)


def t(d: float) -> np.ndarray:
    return np.arange(int(d * SR)) / SR


def env(d: float, a: float, decay: float) -> np.ndarray:
    x = t(d)
    return np.minimum(x / max(a, 1e-4), 1) * np.exp(-np.maximum(x - a, 0) / decay)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def room(x: np.ndarray, decay: float = 0.6, mix: float = 0.18) -> np.ndarray:
    n = int(decay * 3 * SR)
    ir = rng.standard_normal(n) * np.exp(-t(n / SR) / decay * 3)
    ir = sosfilt(butter(1, 5000, "lowpass", fs=SR, output="sos"), ir)
    dry = np.pad(x, (0, n))
    wet = np.pad(fftconvolve(x, ir), (0, 1))[: len(dry)]
    wet /= np.abs(wet).max() + 1e-9
    return dry + mix * wet * np.abs(x).max()


def save(name: str, x: np.ndarray, peak_db: float) -> None:
    x = x / (np.abs(x).max() + 1e-12) * 10 ** (peak_db / 20)
    audible = np.where(np.abs(x) > 10 ** (-66 / 20))[0]
    x = x[: audible[-1] + 1]  # drop the inaudible reverb tail
    fade = int(0.004 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(OUT / f"{name}.wav", SR, (x * 32767).astype(np.int16))
    print(f"{name:12s} {len(x) / SR:.2f}s")


def whoosh(d: float, lo: float, hi: float) -> np.ndarray:
    x = t(d)
    noise = rng.standard_normal(len(x))
    out = np.zeros_like(noise)
    bands = 24
    shape = np.sin(np.pi * np.clip(x / d, 0, 1)) ** 2
    for i in range(bands):  # sweep a band-pass by crossfading a bank of bands
        f = lo * (hi / lo) ** (i / (bands - 1))
        centre = i / (bands - 1)
        w = np.exp(-(((x / d) - centre) ** 2) / 0.02)
        out += bp(noise, f * 0.8, min(f * 1.25, SR / 2 - 100)) * w
    return out * shape


def bell(freq: float, d: float, decay: float, partials=((1, 1), (2.0, 0.35), (3.01, 0.12), (4.2, 0.05))) -> np.ndarray:
    x = t(d)
    out = sum(a * np.sin(2 * np.pi * freq * r * x) * np.exp(-x / (decay / r**0.5)) for r, a in partials)
    return out * np.minimum(x / 0.004, 1)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    save("whoosh", room(whoosh(0.7, 300, 3200), 0.4, 0.12), -14)
    save("whoosh-soft", room(whoosh(0.5, 200, 1400), 0.4, 0.1), -18)

    x = t(0.12)
    click = 0.6 * bp(rng.standard_normal(len(x)), 2500, 9000) * np.exp(-x / 0.002)
    click += 0.5 * np.sin(2 * np.pi * 1700 * x) * np.exp(-x / 0.018)
    click += 0.4 * np.sin(2 * np.pi * 140 * x) * np.exp(-x / 0.03)
    save("click", room(click, 0.25, 0.1), -10)

    x = t(0.22)
    sweep = 2 * np.pi * np.cumsum(700 + 500 * np.exp(-x / 0.03)) / SR
    pop = np.sin(sweep) * env(0.22, 0.003, 0.06) + 0.2 * np.sin(2 * sweep) * env(0.22, 0.003, 0.03)
    save("pop", room(pop, 0.3, 0.12), -16)

    for i, f in enumerate((2900, 3300, 3100, 3600)):
        x = t(0.05)
        key = bp(rng.standard_normal(len(x)), f * 0.7, f * 1.3) * np.exp(-x / 0.004)
        key += 0.25 * np.sin(2 * np.pi * (f / 6) * x) * np.exp(-x / 0.008)
        save(f"type-{i + 1}", key, -24 - i % 2)

    shimmer = np.zeros(int(2.4 * SR))
    for k, (f, a) in enumerate(((1046.5, 1), (1318.5, 0.8), (1568.0, 0.7), (1975.5, 0.5), (2637.0, 0.3))):
        b = a * bell(f, 2.4 - 0.06 * k, 0.9)
        shimmer[int(0.06 * k * SR) : int(0.06 * k * SR) + len(b)] += b
    shimmer += 0.15 * whoosh(2.4, 2500, 9000)
    save("shimmer", room(shimmer, 1.0, 0.3), -17)

    chime = bell(659.25, 3.0, 1.2) + 0.7 * np.pad(bell(987.77, 2.82, 1.1), (int(0.18 * SR), 0))[: int(3.0 * SR)]
    save("chime", room(chime, 1.4, 0.35), -15)

    ok = bell(783.99, 1.6, 0.5) + 0.8 * np.pad(bell(1174.66, 1.48, 0.5), (int(0.12 * SR), 0))[: int(1.6 * SR)]
    save("success", room(ok, 0.8, 0.25), -17)


if __name__ == "__main__":
    main()
