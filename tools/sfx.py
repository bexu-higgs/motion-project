#!/usr/bin/env python3
"""Procedural sound effects (no samples, no music). Deterministic: same seed, same sound.

Every generator returns a float32 stereo array (n, 2) at RATE. `make(id, dur=None, var=0)`
is the single entry point used by the mixer; `var` selects a variation (pitch/pan/noise).
Run directly to export a preview of every effect to audio/sfx/.
"""
import os
import sys
import wave

import numpy as np

RATE = 48000


def _rng(seed):
    return np.random.default_rng(seed)


def _t(dur):
    return np.arange(int(dur * RATE)) / RATE


def _env(n, attack, release, curve=4.0):
    """Linear attack, exponential release envelope of n samples."""
    a = max(1, int(attack * RATE))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    r = np.arange(n - a) / RATE
    e[a:] = np.exp(-curve * r / max(release, 1e-4))
    return e


def _biquad(x, kind, f, q=0.707):
    """RBJ biquad (lowpass / highpass / bandpass), applied sample by sample with scipy-free lfilter."""
    w = 2 * np.pi * f / RATE
    alpha = np.sin(w) / (2 * q)
    cw = np.cos(w)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    else:  # band-pass, constant peak gain
        b = [alpha, 0, -alpha]
    a = [1 + alpha, -2 * cw, 1 - alpha]
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return _lfilter(b, a, x)


def _lfilter(b, a, x):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b
    _, a1, a2 = a
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xi, y1, yi
        y[i] = yi
    return y


def _sweep_bp(x, f0, f1, q=1.2, block=256):
    """Band-pass with a centre frequency moving from f0 to f1 (log), processed in blocks."""
    y = np.zeros_like(x)
    state = np.zeros(4)
    n = len(x)
    for s in range(0, n, block):
        k = s / max(1, n - 1)
        f = f0 * (f1 / f0) ** k
        w = 2 * np.pi * f / RATE
        alpha = np.sin(w) / (2 * q)
        cw = np.cos(w)
        a0 = 1 + alpha
        b0, b1, b2 = alpha / a0, 0.0, -alpha / a0
        a1, a2 = -2 * cw / a0, (1 - alpha) / a0
        x1, x2, y1, y2 = state
        seg = x[s:s + block]
        out = np.empty_like(seg)
        for i, xi in enumerate(seg):
            yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1, y2, y1 = x1, xi, y1, yi
            out[i] = yi
        state = np.array([x1, x2, y1, y2])
        y[s:s + block] = out
    return y


def _stereo(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], axis=1).astype(np.float32)


def _norm(x, peak):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


# ------------------------------------------------------------------ effects
def key(var=0):
    r = _rng(100 + var % 8)
    n = int(0.05 * RATE)
    noise = r.standard_normal(n)
    click = _biquad(noise, "bp", 3200 + 900 * r.random(), 1.4) * _env(n, 0.0005, 0.008)
    t = _t(0.05)
    thock = np.sin(2 * np.pi * (150 + 60 * r.random()) * t) * _env(n, 0.001, 0.018)
    x = _norm(click + 0.45 * thock, 1.0)
    return _stereo(x, (r.random() - 0.5) * 0.3)


def tick(var=0):
    t = _t(0.06)
    n = len(t)
    f = 2600 + 300 * (var % 3)
    x = np.sin(2 * np.pi * f * t) * _env(n, 0.0005, 0.012)
    x += 0.3 * _biquad(_rng(5).standard_normal(n), "hp", 4000) * _env(n, 0.0002, 0.004)
    return _stereo(_norm(x, 1.0))


def click(var=0):
    r = _rng(7)
    n = int(0.12 * RATE)
    t = _t(0.12)
    x = np.zeros(n)
    for off, g in ((0, 1.0), (0.045, 0.55)):
        s = int(off * RATE)
        m = n - s
        burst = _biquad(r.standard_normal(m), "bp", 2400, 1.0) * _env(m, 0.0003, 0.006)
        tone = np.sin(2 * np.pi * 1500 * t[:m]) * _env(m, 0.0005, 0.01)
        body = np.sin(2 * np.pi * 220 * t[:m]) * _env(m, 0.001, 0.02)
        x[s:] += g * (burst + 0.5 * tone + 0.35 * body)
    return _stereo(_norm(x, 1.0))


def pop(var=0):
    t = _t(0.22)
    n = len(t)
    f = 520 + 420 * (1 - np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(f) / RATE
    x = np.sin(ph) * _env(n, 0.003, 0.09)
    x += 0.25 * np.sin(2 * ph) * _env(n, 0.003, 0.04)
    return _stereo(_norm(x, 1.0))


def whoosh(var=0, dur=0.85, f0=280, f1=2200, pan=True):
    r = _rng(20 + var)
    n = int(dur * RATE)
    noise = r.standard_normal(n)
    half = n // 2
    f_mid = f1
    x = np.concatenate([
        _sweep_bp(noise[:half], f0, f_mid, 0.9),
        _sweep_bp(noise[half:], f_mid, f0 * 1.6, 0.9),
    ])
    k = np.linspace(0, 1, n)
    env = np.sin(np.pi * np.clip(k * 1.15, 0, 1)) ** 1.6
    x = _norm(x * env, 1.0)
    if not pan:
        return _stereo(x)
    p = np.linspace(-0.45, 0.45, n)
    return np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)], axis=1).astype(np.float32)


def swipe(var=0):
    return whoosh(var + 5, dur=0.5, f0=700, f1=4200)


def slide(var=0):
    r = _rng(40)
    n = int(1.1 * RATE)
    x = _biquad(r.standard_normal(n), "lp", 900)
    x += 0.6 * _sweep_bp(r.standard_normal(n), 200, 600, 1.5)
    k = np.linspace(0, 1, n)
    env = np.sin(np.pi * k) ** 2
    return _stereo(_norm(x * env, 1.0))


def gen(var=0):
    """Generation shimmer: rising filtered noise with soft granular sparkle."""
    r = _rng(60 + var)
    dur = 1.5
    n = int(dur * RATE)
    k = np.linspace(0, 1, n)
    x = _sweep_bp(r.standard_normal(n), 600, 5200, 2.5) * (k ** 1.2) * (1 - k) ** 0.6 * 2
    sparkle = np.zeros(n)
    for _ in range(46):
        s = int(r.random() ** 0.7 * (n - 3000))
        m = 2400
        tt = np.arange(m) / RATE
        f = 2400 + 3600 * r.random()
        sparkle[s:s + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.012) * (0.3 + 0.7 * r.random())
    x = x + 0.22 * sparkle * (0.3 + k)
    x *= np.minimum(1, (1 - k) * 6)
    return _stereo(_norm(x, 1.0))


def shutter(var=0):
    r = _rng(80)
    n = int(0.16 * RATE)
    x = np.zeros(n)
    for off, f in ((0, 3000), (0.07, 2200)):
        s = int(off * RATE)
        m = n - s
        x[s:] += _biquad(r.standard_normal(m), "bp", f, 1.8) * _env(m, 0.0003, 0.012)
        x[s:] += 0.4 * np.sin(2 * np.pi * 400 * _t(m / RATE)) * _env(m, 0.0005, 0.015)
    return _stereo(_norm(x, 1.0))


def check(var=0):
    x = np.zeros(int(0.22 * RATE))
    for off, f in ((0, 1046.5), (0.07, 1568)):
        s = int(off * RATE)
        m = len(x) - s
        tt = _t(m / RATE)
        x[s:] += np.sin(2 * np.pi * f * tt) * _env(m, 0.002, 0.05) * (0.8 if off else 1)
    return _stereo(_norm(x, 1.0))


def error(var=0):
    x = np.zeros(int(0.24 * RATE))
    for off, f in ((0, 330), (0.09, 262)):
        s = int(off * RATE)
        m = len(x) - s
        tt = _t(m / RATE)
        x[s:] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * _env(m, 0.002, 0.06)
    return _stereo(_norm(x, 1.0))


def rain(dur=6.0, var=0):
    r = _rng(90 + var)
    n = int(dur * RATE)
    bed = _biquad(_biquad(r.standard_normal(n), "hp", 500), "lp", 6500)
    drops = np.zeros(n)
    for _ in range(int(dur * 70)):
        s = int(r.random() * (n - 800))
        m = 800
        tt = np.arange(m) / RATE
        drops[s:s + m] += np.sin(2 * np.pi * (2500 + 3000 * r.random()) * tt) * np.exp(-tt / 0.003) * r.random()
    x = _norm(bed, 1.0) * 0.8 + 0.35 * _norm(drops, 1.0)
    l = x
    rr = np.roll(x, int(0.013 * RATE)) * 0.9 + 0.1 * _biquad(r.standard_normal(n), "hp", 800) * 0.3
    return np.stack([l, rr], axis=1).astype(np.float32)


def wind(dur=6.0, var=0):
    r = _rng(110 + var)
    n = int(dur * RATE)
    x = _sweep_bp(r.standard_normal(n), 300, 700, 0.7)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * _t(dur) + 1.3) * np.sin(2 * np.pi * 0.07 * _t(dur))
    x = _norm(x * lfo, 1.0)
    return np.stack([x, np.roll(x, int(0.02 * RATE))], axis=1).astype(np.float32)


def swell(var=0):
    r = _rng(130)
    dur = 3.2
    n = int(dur * RATE)
    t = _t(dur)
    k = t / dur
    env = np.where(k < 0.25, (k / 0.25) ** 2, np.exp(-(k - 0.25) * 3.2))
    low = np.sin(2 * np.pi * 55 * t) * 0.6 + np.sin(2 * np.pi * 82.5 * t) * 0.25
    air = _sweep_bp(r.standard_normal(n), 300, 1800, 0.8) * 0.5
    x = (low + air) * env
    return _stereo(_norm(x, 1.0))


GENERATORS = {
    "key": key, "tick": tick, "click": click, "pop": pop, "whoosh": whoosh, "swipe": swipe,
    "slide": slide, "gen": gen, "shutter": shutter, "check": check, "error": error, "swell": swell,
}
BEDS = {"rain": rain, "wind": wind}
# peak level (linear) for gain 1.0 in a cue
LEVEL = {
    "key": 0.16, "tick": 0.12, "click": 0.3, "pop": 0.2, "whoosh": 0.22, "swipe": 0.2, "slide": 0.2,
    "gen": 0.2, "shutter": 0.25, "check": 0.16, "error": 0.16, "swell": 0.35, "rain": 0.16, "wind": 0.18,
}
_cache = {}


def make(name, dur=None, var=0):
    if name in BEDS:
        d = round(dur or 4.0, 2)
        key_ = (name, d)
        if key_ not in _cache:
            x = BEDS[name](d + 0.05, var)
            f = min(int(0.8 * RATE), len(x) // 3)
            ramp = np.linspace(0, 1, f) ** 2
            x[:f] *= ramp[:, None]
            x[-f:] *= ramp[::-1][:, None]
            _cache[key_] = x * LEVEL[name]
        return _cache[key_]
    key_ = (name, var)
    if key_ not in _cache:
        _cache[key_] = GENERATORS[name](var) * LEVEL[name]
    return _cache[key_]


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audio", "sfx")
    os.makedirs(out, exist_ok=True)
    for name in list(GENERATORS) + list(BEDS):
        x = make(name, dur=4.0)
        write_wav(os.path.join(out, name + ".wav"), x / max(1e-6, np.abs(x).max()) * 0.8)
        print("wrote", name, "%.2fs" % (len(x) / RATE))
    sys.exit(0)
