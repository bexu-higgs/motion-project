#!/usr/bin/env python3
"""Music bed + sound design for 0–10.5 s, synthesised with numpy, mixed with
the voiceover from tools/voice.py.

  * music: D-minor pad (Dm – B♭ – F – C), dombra-like Karplus–Strong strums,
    soft low drums once the map starts, a few bell notes;
  * sfx: risers, whooshes, booms, odometer ticks, chimes, pops, camera
    shutters, pin drop, pen-on-paper for the border drawing;
  * the bed is ducked under the voice, then everything goes through a light
    reverb and a soft limiter.

Cue times are read from scene/js/cues.js and mirror scene/js/timeline.js.

Usage: python3 tools/audio.py   ->  .cache/build/intro-mix.wav
"""
import json
import os
import re
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
BUILD = os.path.join(ROOT, ".cache", "build")
SR = 48000
DUR = 10.5
N = int(DUR * SR)
rng = np.random.default_rng(42)


# ------------------------------------------------------------------ cues
def load_cues():
    with open(os.path.join(ROOT, "scene", "js", "cues.js"), encoding="utf-8") as f:
        C = json.loads(re.search(r"=\s*(\{.*\})\s*;", f.read(), re.S).group(1))
    at = lambda k, fr: C[k][0] + (C[k][1] - C[k][0]) * fr
    cue = dict(men=C["men"][0], surname=C["name"][0], firstname=at("name", 0.6), nameEnd=C["name"][1],
               year=C["year"][0], yearLand=at("year", 0.62), month=C["month"][0], monthDay=at("month", 0.56),
               monthEnd=C["month"][1], oblast=C["oblast"][0], district=C["district"][0],
               districtEnd=C["district"][1], village=C["village"][0], born=C["born"][0], voEnd=C["born"][1])
    cue["mapIn"] = cue["monthEnd"] - 0.1
    return cue


# ------------------------------------------------------------------ helpers
def tvec(d):
    return np.arange(int(d * SR)) / SR


def env_ad(d, a=0.005, curve=4.0):
    t = tvec(d)
    e = np.exp(-curve * t / d)
    e *= np.clip(t / max(a, 1e-4), 0, 1)
    return e


def svf_bandpass(x, f, q=2.0):
    """State-variable band-pass with per-sample cutoff f (array or scalar)."""
    f = np.broadcast_to(np.asarray(f, dtype=np.float64), x.shape)
    g = np.tan(np.pi * np.clip(f, 20, SR * 0.45) / SR)
    k = 1.0 / q
    ic1 = ic2 = 0.0
    out = np.empty_like(x)
    for i in range(len(x)):
        gi = g[i]
        a1 = 1.0 / (1.0 + gi * (gi + k))
        v3 = x[i] - ic2
        v1 = a1 * ic1 + gi * a1 * v3
        v2 = ic2 + gi * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v1
    return out


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s
        y[i] = s
    return y


def stereo(x, pan=0.0):
    """pan -1..1 (scalar or array) -> (n, 2)."""
    p = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([x * np.cos(p), x * np.sin(p)], axis=-1)


def place(bus, sig, t0):
    i = int(round(t0 * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(bus) - i)
    if n > 0:
        bus[i:i + n] += sig[:n]


def db(x):
    return 10 ** (x / 20)


# ------------------------------------------------------------------ sound effects
def whoosh(d=0.9, f0=300, f1=3200, pan0=-0.7, pan1=0.7, peak=0.6):
    t = tvec(d)
    u = t / d
    f = f0 * (f1 / f0) ** np.sin(u * np.pi / 2)
    x = svf_bandpass(rng.standard_normal(len(t)), f, q=1.4)
    e = np.sin(np.pi * np.clip(u / peak, 0, 1) / 2) ** 2 * np.where(u < peak, 1, np.exp(-5 * (u - peak) / (1 - peak)))
    return stereo(x * e * 0.9, np.linspace(pan0, pan1, len(t)))


def riser(d=0.9):
    t = tvec(d)
    u = t / d
    x = svf_bandpass(rng.standard_normal(len(t)), 400 * 12 ** u, q=3) * u ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(220 * 4 ** u) / SR) * u ** 3 * 0.25
    return stereo((x * 0.7 + tone), 0)


def boom(d=1.6, f0=85, f1=38, gain=1.0):
    t = tvec(d)
    f = f1 + (f0 - f1) * np.exp(-t * 7)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    click = onepole_lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 60) * 1.8
    return stereo((s + click) * gain, 0)


def bell(freq, d=2.2, gain=0.3, pan=0.0, bright=1.0):
    t = tvec(d)
    x = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 2.2), (2.0, 0.5, 3.0), (2.76, 0.35 * bright, 4.2), (5.4, 0.18 * bright, 6.5), (8.93, 0.08 * bright, 9)]:
        x += amp * np.sin(2 * np.pi * freq * ratio * t + rng.random() * 6) * np.exp(-dec * t)
    x *= np.clip(t / 0.003, 0, 1)
    return stereo(x * gain, pan)


def chime(t0, root=587.33, gain=0.22):
    """bright arpeggiated bell chord (D major pentatonic)."""
    out = []
    for i, r in enumerate([1, 1.25, 1.5, 2, 2.5]):
        out.append((t0 + i * 0.045, bell(root * r, 2.4, gain * (1 - i * 0.12), pan=-0.5 + i * 0.25)))
    return out


def tick(gain=0.25, f=3800):
    t = tvec(0.04)
    x = (np.sin(2 * np.pi * f * t) * 0.6 + rng.standard_normal(len(t)) * 0.4) * np.exp(-t * 180)
    return stereo(x * gain, rng.uniform(-0.3, 0.3))


def pop(gain=0.35):
    t = tvec(0.18)
    f = 220 + 700 * np.exp(-t * 40)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26)
    return stereo(x * gain, 0)


def shutter(gain=0.4):
    out = np.zeros((int(0.2 * SR), 2))
    for dt, g in [(0, 1.0), (0.075, 0.7)]:
        t = tvec(0.05)
        x = svf_bandpass(rng.standard_normal(len(t)), 2500, q=1.2) * np.exp(-t * 120) * g
        place(out, stereo(x * gain, 0.35), dt)
    return out


def pen(d=0.8, gain=0.12):
    t = tvec(d)
    x = svf_bandpass(rng.standard_normal(len(t)), 4200 + 1500 * np.sin(t * 37), q=1.0)
    grit = (rng.random(len(t)) < 0.004).astype(float) * rng.uniform(0.5, 1.5, len(t))
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 7 * t) ** 2
    e = np.clip(t / 0.08, 0, 1) * np.clip((d - t) / 0.15, 0, 1)
    return stereo((x * am + onepole_lp(grit, 3000) * 2) * e * gain, np.linspace(-0.4, 0.4, len(t)))


def pin_drop(gain=0.6):
    t = tvec(0.5)
    f = 60 + 90 * np.exp(-t * 30)
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)
    out = stereo(thud * gain, 0)
    place(out, bell(1760, 0.5, 0.12), 0.0)
    return out


# ------------------------------------------------------------------ music
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"])}


def hz(name, octave):
    return NOTE[name] * 2 ** (octave - 4)


def pad_voice(freq, d):
    t = tvec(d)
    x = np.zeros_like(t)
    for det in (-0.12, 0.0, 0.11):
        f = freq * 2 ** (det / 12)
        for h in range(1, 7):
            x += np.sin(2 * np.pi * f * h * t + h * det * 10) / h ** 1.6
    return x / 6


def karplus(freq, d=1.2, bright=0.5):
    n = int(d * SR)
    L = int(SR / freq)
    buf = rng.uniform(-1, 1, L)
    buf = onepole_lp(buf, 1500 + 5000 * bright)
    out = np.empty(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        v = buf[idx]
        nv = 0.996 * 0.5 * (v + prev)
        prev = v
        buf[idx] = nv
        out[i] = v
        idx = (idx + 1) % L
    return out * np.exp(-np.arange(n) / SR * 1.3)


def music(cue):
    bus = np.zeros((N + SR, 2))
    chords = [  # (start, end, notes)
        (0.0, 2.6, [("D", 3), ("A", 3), ("D", 4), ("F", 4)]),
        (2.4, cue["mapIn"] + 0.1, [("Bb", 2), ("F", 3), ("D", 4), ("F", 4)]),
        (cue["mapIn"], cue["district"] + 0.2, [("F", 3), ("C", 4), ("F", 4), ("A", 4)]),
        (cue["district"], DUR + 0.6, [("C", 3), ("G", 3), ("E", 4), ("G", 4)]),
    ]
    for a, b, notes in chords:
        d = b - a + 0.6
        t = tvec(d)
        e = np.clip(t / 0.8, 0, 1) * np.clip((d - t) / 0.6, 0, 1)
        x = sum(pad_voice(hz(n, o), d) for n, o in notes) * e * 0.16
        bus_chunk = np.stack([x, np.roll(x, 240)], axis=-1)  # slight stereo spread
        place(bus, bus_chunk, a)
    # bass swell into the map
    place(bus, stereo(np.sin(2 * np.pi * hz("F", 2) * tvec(3.0)) * np.clip(tvec(3.0) / 0.5, 0, 1) * np.exp(-tvec(3.0) * 0.8) * 0.12, 0), cue["mapIn"])

    # dombra-like strums: two strings a fifth apart, 16th pattern
    beat = 0.6
    strings_for = lambda tt: ([("D", 3), ("A", 3)] if tt < 2.5 else [("Bb", 2), ("F", 3)] if tt < cue["mapIn"]
                              else [("F", 3), ("C", 4)] if tt < cue["district"] else [("C", 3), ("G", 3)])
    pattern = [(0.0, 1.0), (0.15, 0.45), (0.3, 0.8), (0.45, 0.5)]
    tt = 2.4
    while tt < DUR:
        level = 0.45 if tt < cue["mapIn"] else 0.8
        for off, acc in pattern:
            when = tt + off
            if when >= DUR:
                break
            for k, (n, o) in enumerate(strings_for(when)):
                s = karplus(hz(n, o), 0.9, bright=0.35 + 0.4 * acc) * acc * level * 0.13
                place(bus, stereo(s, -0.25 + 0.5 * k), when + k * 0.009)
        tt += beat
    # soft low drums once the map starts
    tt = cue["mapIn"]
    while tt < DUR:
        place(bus, boom(0.7, 70, 45, 0.18), tt)
        tt += beat * 2
    # bell motif over the intro (D minor pentatonic)
    for when, n, o in [(0.55, "A", 5), (1.15, "D", 6), (1.9, "C", 6), (2.55, "A", 5), (3.4, "F", 5), (4.3, "G", 5)]:
        place(bus, bell(hz(n, o), 2.2, 0.06, pan=rng.uniform(-0.5, 0.5)), when)
    return bus[:N]


# ------------------------------------------------------------------ sfx timeline
def sfx(cue):
    bus = np.zeros((N + SR, 2))
    ev = []
    ev += [(0.0, riser(0.75) * 0.5), (0.62, boom(1.8, 90, 38, 0.55)), (0.3, whoosh(1.0, 250, 2600, -0.6, 0.3) * 0.6)]
    ev += chime(0.68, 587.33, 0.1)
    ev += [(cue["men"] - 0.05, whoosh(0.5, 900, 3500, -0.8, -0.2) * 0.22)]
    for i in range(11):  # surname letters
        ev.append((cue["surname"] + i * 0.045, tick(0.05, 5200 + i * 120)))
    ev += [(cue["firstname"] - 0.2, whoosh(0.7, 400, 4200, -0.5, 0.5) * 0.45)]
    ev += chime(cue["firstname"] + 0.3, 880, 0.12)
    ev += [(cue["year"] - 0.4, whoosh(0.6, 2500, 300, 0.6, -0.6) * 0.4)]
    # odometer ticks, slowing down as the reels land
    a, b = cue["year"] - 0.1, cue["yearLand"] + 0.05
    k = 0
    for u in np.linspace(0, 1, 34):
        when = a + (b - a) * (1 - (1 - u) ** 0.5)
        ev.append((when, tick(0.11 * (0.6 + 0.4 * u), 3200 + 300 * (k % 3))))
        k += 1
    ev += [(cue["yearLand"] + 0.06, bell(1174.66, 1.6, 0.16)), (cue["yearLand"] + 0.06, pop(0.2))]
    ev += [(cue["month"] - 0.1, whoosh(0.5, 800, 3000, -0.4, 0.4) * 0.25)]
    ev += [(cue["monthDay"] - 0.05, pop(0.32)), (cue["monthDay"], bell(1318.5, 1.4, 0.12, 0.3))]
    # into the map
    m = cue["mapIn"]
    ev += [(m - 0.45, riser(0.5) * 0.35), (m - 0.05, whoosh(1.2, 200, 3000, 0.8, -0.8) * 0.75), (m + 0.05, boom(2.0, 80, 36, 0.65))]
    ev += [(m + 0.05, pen(0.8, 0.1))]
    ev += [(cue["oblast"] + 0.05, pop(0.3))] + chime(cue["oblast"] + 0.1, 698.46, 0.1)
    ev += [(cue["oblast"] + 0.32, whoosh(1.0, 300, 2400, -0.3, 0.3) * 0.35)]
    ev += [(cue["district"] - 0.05, whoosh(0.9, 350, 2800, 0.3, -0.3) * 0.4), (cue["district"] + 0.05, pen(0.8, 0.11))]
    ev += [(cue["district"] + 0.42, shutter(0.45)), (cue["district"] + 0.45, pop(0.25))]
    # dive to the village
    ev += [(cue["districtEnd"] - 0.05, whoosh(1.3, 150, 2200, -0.6, 0.6) * 0.7), (cue["districtEnd"] + 0.6, boom(1.4, 70, 34, 0.35))]
    ev += [(cue["village"] - 0.05, whoosh(0.45, 2500, 600, -0.2, 0.6) * 0.25)]
    ev += [(cue["village"] + 0.47, shutter(0.4)), (cue["village"] + 0.95, pin_drop(0.55))]
    ev += chime(cue["born"] + 0.05, 587.33, 0.14) + chime(cue["born"] + 0.4, 880, 0.08)
    ev += [(cue["born"] + 0.6, bell(1760, 2.0, 0.05, -0.4)), (cue["born"] + 0.75, bell(2349.3, 2.0, 0.04, 0.4))]
    for t0, s in ev:
        place(bus, s, t0)
    return bus[:N]


# ------------------------------------------------------------------ mix
def reverb(x, seconds=1.8, mix=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.empty_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir = onepole_lp(ir, 5000)
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x[:, ch]) + n
        size = 1 << int(np.ceil(np.log2(L)))
        wet = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, ch] = x[:, ch] * (1 - mix) + wet * mix * 1.4
    return out


def read_voice():
    with wave.open(os.path.join(BUILD, "voice.wav")) as w:
        v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return out


def main():
    cue = load_cues()
    voice = read_voice()
    mus = music(cue)
    fx = sfx(cue)

    # duck the bed under the voice
    env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode="same")
    env = onepole_lp(np.clip(env / (env.max() + 1e-9) * 3, 0, 1), 4)
    duck = 1 - 0.45 * env

    bed = mus * db(-3) * duck[:, None] + fx * db(-4) * (1 - 0.25 * env)[:, None]
    bed = reverb(bed, 1.8, 0.24)
    vo = stereo(voice, 0) * db(1.5)
    vo = vo * 0.93 + reverb(vo, 0.9, 0.08) * 0.07
    mix = bed + vo
    # gentle fade-in of the very first frames, soft limiter
    mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix *= 0.8 / np.abs(mix).max()

    out = os.path.join(BUILD, "intro-mix.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("wrote", out, {k: round(v, 2) for k, v in cue.items()})


if __name__ == "__main__":
    main()
