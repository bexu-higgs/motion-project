#!/usr/bin/env python3
"""Procedural sound design + light ambient electronic music bed.

Reads the cue list exported by `node render.js --cues out/cues.json` (every cue is tied to an
animation event: pops, checks, whooshes, the drop impact ...) and writes 48 kHz stereo WAVs:

    out/audio/music.wav   music bed only
    out/audio/sfx.wav     UI clicks, glassy chimes, airy whooshes
    out/audio/bed.wav     music + sfx (what mux.sh mixes under the voice-over)

Everything is synthesised from scratch with numpy/scipy — no samples, no third-party audio.
"""
import json
import os
import sys

import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def pan_gains(p):  # p in [-1, 1], equal power
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


class Bus:
    def __init__(self, dur):
        self.x = np.zeros((2, int(dur * SR) + SR * 4))

    def add(self, t0, y, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i < 0:
            y = y[..., -i:] if y.ndim == 1 else y[:, -i:]
            i = 0
        if y.ndim == 1:
            gl, gr = pan_gains(pan)
            y = np.vstack([y * gl, y * gr])
        n = min(y.shape[1], self.x.shape[1] - i)
        if n > 0:
            self.x[:, i:i + n] += y[:, :n] * gain


def exp_env(t, tau, attack=0.002):
    return np.exp(-t / tau) * np.clip(t / attack, 0, 1)


def butter(y, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        f = [min(max(v, 20), SR / 2 - 200) for v in f]
    else:
        f = min(max(f, 20), SR / 2 - 200)
    sos = signal.butter(order, f, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, y, axis=-1)


def sweep_noise(dur, f0, f1, q=1.6, shape=None, seed=None):
    """Noise through a band-pass whose centre glides f0 -> f1 (STFT spectral shaping)."""
    rng = np.random.default_rng(seed) if seed is not None else RNG
    n = int(dur * SR)
    x = rng.standard_normal(n + 2048)
    f, frames, Z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
    u = np.clip(frames / dur, 0, 1)
    if shape is not None:
        u = shape(u)
    fc = f0 * (f1 / f0) ** u
    bw = fc / q
    G = np.exp(-0.5 * ((f[:, None] - fc[None, :]) / bw[None, :]) ** 2)
    _, y = signal.istft(Z * G, fs=SR, nperseg=1024, noverlap=768)
    y = y[:n]
    return y / (np.max(np.abs(y)) + 1e-9)


def bell(note, dur=2.2, bright=1.0):
    t = tt(dur)
    f = midi(note)
    ratios = [1.0, 2.0, 2.76, 4.07, 5.40, 6.80, 8.93]
    amps = [1.0, 0.30, 0.45, 0.18, 0.22 * bright, 0.08 * bright, 0.09 * bright]
    taus = [1.00, 0.70, 0.55, 0.35, 0.28, 0.20, 0.16]
    y = np.zeros_like(t)
    for r, a, k in zip(ratios, amps, taus):
        fr = f * r
        if fr > SR / 2 - 500:
            continue
        y += a * np.sin(2 * np.pi * fr * t + RNG.uniform(0, 6.28)) * exp_env(t, k * dur * 0.55)
        y += a * 0.35 * np.sin(2 * np.pi * (fr + 1.7) * t) * exp_env(t, k * dur * 0.5)
    return y * 0.28


def glint(pitch=0, dur=0.18):
    t = tt(dur)
    f = 3200 * 2 ** (pitch * 2 / 12)
    y = np.sin(2 * np.pi * f * t) * exp_env(t, 0.035) + 0.5 * np.sin(2 * np.pi * f * 1.51 * t) * exp_env(t, 0.02)
    return y * 0.25


def click(dur=0.05):
    t = tt(dur)
    n = butter(RNG.standard_normal(len(t)), 'bandpass', [2500, 7000]) * exp_env(t, 0.003, 0.0003)
    s = np.sin(2 * np.pi * 2100 * t) * exp_env(t, 0.008)
    return (n * 0.5 + s * 0.35) * 0.6


def tick(pitch=0):
    t = tt(0.12)
    f = 1350 * 2 ** (pitch / 12)
    y = (np.sin(2 * np.pi * f * t) * exp_env(t, 0.03) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t) * exp_env(t, 0.012)) * 0.35
    c = click()
    y[: len(c)] += c * 0.5
    return y


def pop(pitch=0, dur=0.16):
    t = tt(dur)
    f0 = 330 * 2 ** (pitch / 12)
    f = f0 * (1 + 0.9 * (1 - np.exp(-t / 0.025)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * exp_env(t, 0.045, 0.003)
    c = click()
    y[: len(c)] += c * 0.6
    return y * 0.55


def drip(pitch=0):
    t = tt(0.16)
    f0 = 1300 * 2 ** (pitch / 12)
    f = 450 + (f0 - 450) * np.exp(-t / 0.018)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(t, 0.05, 0.001)
    return y * 0.4


def whoosh(direction='in', dur=0.6, seed=None):
    if direction == 'up':
        y = sweep_noise(dur, 350, 3200, q=1.4, seed=seed)
        env = np.sin(np.pi * np.clip(tt(dur) / dur, 0, 1)) ** 1.5
    elif direction == 'out':
        y = sweep_noise(dur, 2400, 500, q=1.3, seed=seed)
        env = np.sin(np.pi * np.clip(tt(dur) / dur, 0, 1) ** 0.7) ** 2
    else:
        y = sweep_noise(dur, 2600, 380, q=1.3, seed=seed)
        u = np.clip(tt(dur) / dur, 0, 1)
        env = (u ** 1.6) * np.exp(-((u - 0.75) / 0.25) ** 2) / 0.7
    return y * env * 0.45


def shimmer(dur=1.1):
    t = tt(dur)
    y = np.zeros_like(t)
    for _ in range(16):
        f = RNG.uniform(2200, 8500)
        st = RNG.uniform(0, dur * 0.7)
        e = np.clip(t - st, 0, None)
        y += np.sin(2 * np.pi * f * t + RNG.uniform(0, 6.28)) * np.exp(-e / RNG.uniform(0.08, 0.3)) * (t > st) * RNG.uniform(0.4, 1)
    air = sweep_noise(dur, 3000, 9000, q=1.0) * np.sin(np.pi * t / dur) * 0.25
    return (y * 0.05 + air) * 0.6


def swell(dur=2.0):
    t = tt(dur)
    u = t / dur
    n = sweep_noise(dur, 180, 2400, q=0.9) * (u ** 2)
    pad = sum(np.sin(2 * np.pi * midi(m) * t) for m in (62, 69, 74, 78)) * (u ** 2.4) * 0.12
    return (n * 0.35 + pad) * np.clip((1 - u) * 12, 0, 1)


def morph(gain=1.0):
    y = whoosh('in', 0.75) * 0.9
    b = bell(86, 0.9, 0.6) * 0.25
    out = np.zeros(max(len(y), len(b) + int(0.45 * SR)))
    out[: len(y)] += y
    out[int(0.45 * SR): int(0.45 * SR) + len(b)] += b
    return out * gain


def draw(dur=0.6):
    t = tt(dur)
    return sweep_noise(dur, 700, 4200, q=3.0) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2 * 0.22


def riser(dur=1.35):
    t = tt(dur)
    u = t / dur
    f = 260 * (5 ** u)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.08 * u ** 1.5
    n = sweep_noise(dur, 300, 5000, q=1.2) * u ** 2 * 0.25
    return (tone + n) * np.clip((1 - u) * 20, 0, 1)


def burst():
    dur = 1.2
    t = tt(dur)
    n = butter(RNG.standard_normal(len(t)), 'highpass', 2500) * exp_env(t, 0.18) * 0.2
    y = n
    for _ in range(26):
        g = glint(RNG.integers(0, 7))
        i = int(RNG.uniform(0, 0.8) * SR)
        y[i: i + len(g)] += g[: len(y) - i] * RNG.uniform(0.3, 0.8)
    thump = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t / 0.05) + 45) / SR) * exp_env(t, 0.12) * 0.5
    return y + thump


def open_lid():
    dur = 0.8
    t = tt(dur)
    p = pop(-3)
    w = whoosh('up', 0.7) * 0.8
    thump = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t / 0.04) + 55) / SR) * exp_env(t, 0.15) * 0.4
    y = thump.copy()
    y[: len(w)] += w
    y[: len(p)] += p
    return y


def magic(dur=2.5):
    t = tt(dur)
    y = np.zeros(len(t) + SR)
    notes = [74, 78, 81, 85, 86, 90, 93]
    for k in range(9):
        b = bell(notes[k % len(notes)], 1.4, 0.8) * 0.35
        i = int(k * dur / 10 * SR)
        y[i: i + len(b)] += b[: len(y) - i]
    for _ in range(40):
        g = glint(RNG.integers(0, 7)) * RNG.uniform(0.2, 0.6)
        i = int(RNG.uniform(0, dur) * SR)
        y[i: i + len(g)] += g[: len(y) - i]
    return y * 0.8


def pulse():
    t = tt(0.7)
    return np.sin(2 * np.pi * 72 * t) * exp_env(t, 0.22, 0.01) * 0.55 + np.sin(2 * np.pi * 144 * t) * exp_env(t, 0.1, 0.01) * 0.12


def denied():
    out = np.zeros(int(0.35 * SR))
    for k, f in enumerate((262, 208)):
        t = tt(0.12)
        y = np.tanh(2.2 * np.sin(2 * np.pi * f * t)) * exp_env(t, 0.04, 0.003) * 0.3
        y = butter(y, 'lowpass', 1800)
        i = int(k * 0.12 * SR)
        out[i: i + len(y)] += y
    return out


def flow():
    dur = 1.45
    t = tt(dur)
    n = sweep_noise(dur, 500, 2600, q=2.2)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 17 * t + 3 * np.sin(2 * np.pi * 2.3 * t))
    env = np.sin(np.pi * t / dur) ** 1.4
    y = n * am * env * 0.2
    l, r = np.cos((t / dur) * np.pi / 2), np.sin((t / dur) * np.pi / 2)
    return np.vstack([y * l, y * r])


def fill(dur=2.6):
    t = tt(dur)
    y = sweep_noise(dur, 300, 1800, q=1.6) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8 * 0.12
    for k in range(22):
        st = k * dur / 22 * 0.9
        f0 = 500 + k * 45
        tb = tt(0.09)
        f = f0 * (1 + 0.6 * (1 - np.exp(-tb / 0.02)))
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(tb, 0.025, 0.002) * 0.16
        i = int(st * SR)
        y[i: i + len(b)] += b[: len(y) - i]
    return y


def bounce():
    t = tt(0.15)
    return np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t / 0.03) + 80) / SR) * exp_env(t, 0.05, 0.002) * 0.45


def melt():
    dur = 1.3
    t = tt(dur)
    n = sweep_noise(dur, 3200, 280, q=1.1) * np.sin(np.pi * t / dur) ** 1.2 * 0.35
    f = 820 * (0.25 ** (t / dur)) * (1 + 0.04 * np.sin(2 * np.pi * 7 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) * 0.08
    return n + s


def fall():
    dur = 0.6
    t = tt(dur)
    f = 1300 * (0.28 ** (t / dur))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 0.6 * 0.12


def impact():
    dur = 2.5
    t = tt(dur)
    f = 850 + 1100 * np.exp(-t / 0.012)
    plink = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(t, 0.16, 0.001) * 0.55
    boom = np.sin(2 * np.pi * np.cumsum(30 * np.exp(-t / 0.08) + 44) / SR) * exp_env(t, 0.55, 0.004) * 0.9
    splash = butter(RNG.standard_normal(len(t)), 'bandpass', [600, 5000]) * exp_env(t, 0.09, 0.002) * 0.25
    return plink + boom + splash


SFX = {
    'swell': lambda c: swell(c.get('dur', 2.0)),
    'drip': lambda c: drip(c.get('pitch', 0)),
    'morph': lambda c: morph(),
    'glint': lambda c: glint(c.get('pitch', 0)),
    'shimmer': lambda c: shimmer(),
    'pop': lambda c: pop(c.get('pitch', 0)),
    'whoosh': lambda c: whoosh(c.get('dir', 'in')),
    'flip': lambda c: np.concatenate([whoosh('in', 0.38) * 0.9, click() * 0.8]),
    'chime': lambda c: bell(c.get('note', 76)),
    'swing': lambda c: swing(),
    'draw': lambda c: draw(c.get('dur', 0.6)),
    'click': lambda c: click(),
    'tick': lambda c: tick(c.get('pitch', 0)),
    'riser': lambda c: riser(c.get('dur', 1.35)),
    'check': lambda c: check(c.get('note', 76)),
    'burst': lambda c: burst(),
    'open': lambda c: open_lid(),
    'magic': lambda c: magic(c.get('dur', 2.5)),
    'pulse': lambda c: pulse(),
    'denied': lambda c: denied(),
    'flow': lambda c: flow(),
    'fill': lambda c: fill(c.get('dur', 2.6)),
    'bounce': lambda c: bounce(),
    'melt': lambda c: melt(),
    'fall': lambda c: fall(),
    'impact': lambda c: impact(),
}
# base level, stereo position, reverb send
MIX = {
    'swell': (0.9, 0.0, 0.5), 'drip': (0.7, 0.0, 0.5), 'morph': (0.8, 0.0, 0.4), 'glint': (0.7, None, 0.6),
    'shimmer': (0.8, 0.2, 0.6), 'pop': (0.8, 0.1, 0.3), 'whoosh': (0.85, None, 0.3), 'flip': (0.8, -0.2, 0.3),
    'chime': (0.6, 0.15, 0.7), 'swing': (0.7, 0.25, 0.4), 'draw': (0.8, 0.3, 0.3), 'click': (0.7, 0.0, 0.2),
    'tick': (0.65, None, 0.3), 'riser': (0.8, 0.0, 0.4), 'check': (0.75, None, 0.5), 'burst': (0.8, 0.0, 0.6),
    'open': (0.85, 0.3, 0.4), 'magic': (0.55, 0.2, 0.8), 'pulse': (0.7, 0.0, 0.3), 'denied': (0.7, 0.3, 0.2),
    'flow': (0.9, 0.0, 0.5), 'fill': (0.8, 0.0, 0.4), 'bounce': (0.6, 0.0, 0.2), 'melt': (0.85, 0.0, 0.5),
    'fall': (0.7, 0.0, 0.5), 'impact': (0.7, 0.0, 0.8),
}


def swing():
    out = np.zeros(int(2.4 * SR))
    for k in range(4):
        y = tick(5 - k * 2) * (0.8 ** k)
        i = int(k * 0.59 * SR)
        out[i: i + len(y)] += y
    b = bell(88, 1.4, 0.7) * 0.25
    out[: len(b)] += b
    return out


def check(note):
    b = bell(note, 1.3, 1.0) * 0.7
    c = click()
    b[: len(c)] += c * 0.5
    return b


def reverb_ir(dur=2.4, seed=3):
    rng = np.random.default_rng(seed)
    t = tt(dur)
    ir = []
    for ch in range(2):
        bright = butter(rng.standard_normal(len(t)), 'highpass', 1500) * np.exp(-t / 0.35)
        dark = butter(rng.standard_normal(len(t)), 'lowpass', 2500) * np.exp(-t / 0.75)
        x = (bright * 0.5 + dark) * np.clip(t / 0.012, 0, 1)
        ir.append(x / np.sqrt(np.sum(x ** 2)))
    return np.array(ir)


def reverb(x, ir):
    return np.vstack([signal.fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])


# ------------------------------------------------------------------ music bed
CHORDS = [  # (pad voicing, bass root, arp tones) — Dmaj9 | Bm9 | Gmaj9 | Asus2, two bars each
    ([50, 57, 61, 64, 66], 38, [74, 78, 81, 85, 88, 85, 81, 78]),
    ([47, 54, 57, 61, 62], 35, [71, 74, 78, 81, 85, 81, 78, 74]),
    ([43, 50, 54, 57, 59], 31, [67, 71, 74, 78, 81, 78, 74, 71]),
    ([45, 52, 57, 59, 64], 33, [69, 71, 76, 81, 83, 81, 76, 71]),
]


def pad_note(f, dur, cutoff):
    t = tt(dur)
    out = np.zeros((2, len(t)))
    for ch, det in enumerate((-0.0045, 0.0045)):
        for k in range(1, 10):
            fk = f * k * (1 + det * (1 if k % 2 else -1))
            if fk > 9000:
                break
            a = (1 / k ** 1.3) * np.exp(-fk / cutoff)
            out[ch] += a * np.sin(2 * np.pi * fk * t + RNG.uniform(0, 6.28))
    return out


def music(total, TL):
    bpm = 96.0
    beat = 60 / bpm
    bar = beat * 4
    bus = Bus(total)
    seg = bar * 2
    n_seg = int(np.ceil(total / seg)) + 1
    for s in range(n_seg):
        voicing, root, arp = CHORDS[s % 4]
        t0 = s * seg
        if t0 > total:
            break
        dur = seg + 2.0
        t = tt(dur)
        env = np.clip(t / 1.2, 0, 1) * np.clip((dur - t) / 1.8, 0, 1)
        lift = 0.6 + 0.4 * np.clip((t0 - TL['s2']) / 20, 0, 1)
        p = sum(pad_note(midi(m), dur, 900 + 1300 * lift) for m in voicing) * env * 0.05
        bus.add(t0, p)
        # sub bass, soft
        b = (np.sin(2 * np.pi * midi(root) * t) + 0.25 * np.sin(2 * np.pi * midi(root + 12) * t)) * env * 0.11
        if t0 >= TL['s3'] - 1.0:
            bus.add(t0, b)
        # arpeggio plucks (eighths), from scene 2 until the outro
        for k in range(16):
            tk = t0 + k * beat / 2
            if tk < TL['s2'] + 0.1 or tk > TL['s8'] + 0.2:
                continue
            f = midi(arp[k % 8])
            tp = tt(0.6)
            y = (np.sin(2 * np.pi * f * tp) + 0.18 * np.sin(2 * np.pi * 2 * f * tp)) * exp_env(tp, 0.22, 0.004)
            vel = 0.05 * (1.0 if k % 2 == 0 else 0.75) * (0.9 + 0.2 * RNG.random())
            bus.add(tk, y, vel, pan=0.35 * np.sin(k * 0.9))
    # dotted-eighth ping-pong delay on the whole bed (mostly plucks)
    d = int(beat * 0.75 * SR)
    x = bus.x
    wet = np.zeros_like(x)
    src = x.copy()
    for k in range(1, 6):
        g = 0.32 ** k
        sh = d * k
        ch = k % 2
        wet[ch, sh:] += src[(ch + 1) % 2, :-sh] * g if sh < src.shape[1] else 0
    bus.x = x + butter(wet, 'lowpass', 4500) * 0.6
    # light beat: from scene 3 until the outro
    kick_t = tt(0.45)
    kick = np.sin(2 * np.pi * np.cumsum(48 + 110 * np.exp(-kick_t / 0.035)) / SR) * exp_env(kick_t, 0.16, 0.002) * 0.55
    hat_t = tt(0.06)
    hat = butter(RNG.standard_normal(len(hat_t)), 'highpass', 8000) * exp_env(hat_t, 0.012, 0.0005) * 0.12
    snap_t = tt(0.25)
    snap = butter(RNG.standard_normal(len(snap_t)), 'bandpass', [1200, 6000]) * exp_env(snap_t, 0.05, 0.001) * 0.10
    beat_start = TL['s3'] - (TL['s3'] % bar) + bar
    duck = np.ones(bus.x.shape[1])
    b = 0
    while True:
        tb = b * beat
        if tb > TL['s8'] - 0.1:
            break
        if tb >= beat_start:
            if b % 2 == 0:
                bus.add(tb, kick, 1.0)
                i = int(tb * SR)
                n = min(int(0.35 * SR), len(duck) - i)
                duck[i: i + n] = np.minimum(duck[i: i + n], 1 - 0.35 * np.exp(-np.arange(n) / SR / 0.12))
            else:
                bus.add(tb, snap, 1.0, pan=0.1)
            bus.add(tb + beat / 2, hat, 1.0, pan=-0.3)
            if tb >= TL['s4']:
                bus.add(tb + beat / 4 * 3, hat, 0.5, pan=0.3)
        b += 1
    bus.x *= duck[None, :]
    # gentle fade at the very end
    tl = np.arange(bus.x.shape[1]) / SR
    bus.x *= np.clip((total + 0.4 - tl) / 2.5, 0, 1)[None, :]
    bus.x *= np.clip(tl / 0.8, 0, 1)[None, :]
    return bus.x


def main():
    cues_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'cues.json')
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'out', 'audio')
    os.makedirs(out_dir, exist_ok=True)
    data = json.load(open(cues_path))
    TL = data['TL']
    total = TL['end']
    ir = reverb_ir()

    sfx = Bus(total)
    send = Bus(total)
    for c in data['cues']:
        fn = SFX.get(c['type'])
        if fn is None:
            print('unknown cue', c['type'])
            continue
        y = fn(c)
        lvl, pan, rv = MIX[c['type']]
        if pan is None:
            pan = RNG.uniform(-0.5, 0.5)
        g = lvl * c.get('gain', 1.0)
        sfx.add(c['t'], y, g, pan)
        send.add(c['t'], y, g * rv, pan)
    n = int(total * SR) + SR * 3
    fx = sfx.x[:, :n] + reverb(send.x[:, :n], ir) * 0.55

    mus = music(total, TL)[:, :n]
    mus = mus + reverb(mus, ir) * 0.25

    def finish(x, peak=0.89):
        x = x[:, : int((total + 0.05) * SR)]
        m = np.max(np.abs(x)) + 1e-9
        x = x / m * peak
        return np.tanh(x * 1.1) / np.tanh(1.1)

    def write(name, x):
        import wave
        y = (np.clip(x, -1, 1) * 32767).astype('<i2').T.copy()
        with wave.open(os.path.join(out_dir, name), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(y.tobytes())
        print('wrote', os.path.join(out_dir, name))

    # leave room for the voice: thin the low-mids of the music, keep a clean sub
    low = butter(mus, 'lowpass', 320, order=2)
    mus = butter(mus - 0.5 * low, 'highpass', 45) 
    mus = butter(mus, 'lowpass', 11000)

    def rms_db(x):
        a = np.sqrt(np.mean(x[:, int(SR * 0.5): int(SR * (total - 1))] ** 2)) + 1e-12
        return 20 * np.log10(a)

    def limit(x, ceiling=0.89):
        return np.tanh(x / ceiling) * ceiling

    # loudness targets (RMS, dBFS): music bed -26, effects -27 (they are sparse, so peaks sit far higher)
    mus_n = mus * 10 ** ((-26 - rms_db(mus)) / 20)
    fx_n = fx * 10 ** ((-27 - rms_db(fx)) / 20)
    fx_n = limit(fx_n, 0.7)
    cut = int((total + 0.05) * SR)
    write('music.wav', limit(mus_n)[:, :cut])
    write('sfx.wav', limit(fx_n)[:, :cut])
    write('bed.wav', limit(mus_n + fx_n)[:, :cut])


if __name__ == '__main__':
    main()
