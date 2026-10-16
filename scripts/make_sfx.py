"""Synthesise the soft UI sound effects used in the video (no third-party audio).

Run:  python3 scripts/make_sfx.py   ->  public/sfx/*.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx"
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack=0.002, decay=0.05):
    x = np.arange(n) / SR
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(x - attack, 0) / decay)


def lowpass(x, cutoff):
    # one-pole low-pass, cutoff may be an array (sweeps)
    cutoff = np.broadcast_to(cutoff, x.shape)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        a = 1 - np.exp(-2 * np.pi * cutoff[i] / SR)
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def save(name, x, peak=0.5):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = min(len(x), int(0.004 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    stereo = np.repeat(data[:, None], 2, axis=1)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


def tap():
    n = int(0.09 * SR)
    click = highpass(rng.standard_normal(n), 2500) * env(n, 0.0005, 0.004)
    body = np.sin(2 * np.pi * 1350 * t(0.09)) * env(n, 0.001, 0.018)
    return 0.6 * click + body


def pop():
    x = t(0.12)
    f = 520 + 520 * (x / x[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(len(x), 0.003, 0.035)


def whoosh(sec=0.55, f0=300, f1=2600):
    n = int(sec * SR)
    noise = rng.standard_normal(n)
    sweep = np.geomspace(f0, f1, n)
    band = highpass(lowpass(noise, sweep), sweep * 0.35)
    shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return band * shape


def toggle():
    a = tap()
    b = np.concatenate([np.zeros(int(0.055 * SR)), tap() * 0.7])
    out = np.zeros(max(len(a), len(b)))
    out[: len(a)] += a
    out[: len(b)] += b
    return out


def error():
    x = t(0.22)
    f = 260 - 90 * (x / x[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env(len(x), 0.004, 0.07)
    return tone


def success():
    out = np.zeros(int(0.45 * SR))
    for start, freq in ((0.0, 880.0), (0.09, 1318.5)):
        s = int(start * SR)
        x = t(0.36)
        note = (np.sin(2 * np.pi * freq * x) + 0.2 * np.sin(4 * np.pi * freq * x)) * env(len(x), 0.004, 0.12)
        out[s : s + len(note)] += note[: len(out) - s]
    return out


def tick():
    n = int(0.03 * SR)
    return np.sin(2 * np.pi * 2100 * t(0.03)) * env(n, 0.0005, 0.006)


def swipe():
    return whoosh(0.32, 600, 4200)


def rotate():
    return whoosh(0.85, 200, 1800)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    save("tap", tap(), 0.55)
    save("pop", pop(), 0.35)
    save("whoosh", whoosh(), 0.30)
    save("swipe", swipe(), 0.30)
    save("rotate", rotate(), 0.32)
    save("toggle", toggle(), 0.5)
    save("error", error(), 0.40)
    save("success", success(), 0.32)
    save("tick", tick(), 0.18)
    print("ok", sorted(p.name for p in OUT.iterdir()))
