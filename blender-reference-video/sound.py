"""
Soundtrack for the reference video: synthesised sound effects + a light music bed.
Everything is generated with numpy, timed to the animation frames (24 fps).

    python sound.py soundtrack.wav
"""
import sys
import wave

import numpy as np

SR = 48000
FPS = 24
DUR = 24.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N)
R = np.zeros(N)
MUS_L = np.zeros(N)
MUS_R = np.zeros(N)


def sec(frame):
    return (frame - 1) / FPS


def tl(d):
    return np.arange(int(d * SR)) / SR


def add(sig, start, gain=1.0, pan=0.0, music=False):
    i0 = int(start * SR)
    if i0 >= N or i0 + len(sig) <= 0:
        return
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    sig = sig[:N - i0]
    a = (pan + 1) * np.pi / 4
    tl_, tr_ = (MUS_L, MUS_R) if music else (L, R)
    tl_[i0:i0 + len(sig)] += sig * gain * np.cos(a)
    tr_[i0:i0 + len(sig)] += sig * gain * np.sin(a)


def noise(d):
    return rng.standard_normal(int(d * SR))


def band(x, lo, hi, soft=0.3):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 / soft))
    if hi > 0:
        m *= 1 / (1 + (f / hi) ** (2 / soft))
    return np.fft.irfft(X * m, len(x))


def env(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0)
    rel = np.clip((t - a) / max(d, 1e-4), 0, 1)
    return e * np.exp(-curve * rel) * (1 - rel ** 6)


def norm(x):
    p = np.max(np.abs(x)) + 1e-9
    return x / p


def sweep(f0, f1, d, shape='exp'):
    t = tl(d)
    if shape == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ----------------------------------------------------------------- effects --
def footstep(soft=1.0):
    d = 0.18
    x = band(noise(d), 40, 260) * env(int(d * SR), 0.004, 0.06, 5)
    c = band(noise(d), 1500, 5000) * env(int(d * SR), 0.001, 0.012, 6) * 0.25
    return norm(x + c) * soft


def breath(d=0.32, strong=1.0):
    n = int(d * SR)
    x = band(noise(d), 500, 2200, 0.5)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return norm(x * e) * strong


def swish(d=0.3):
    n = int(d * SR)
    x = noise(d)
    out = np.zeros(n)
    segs = 6
    for k in range(segs):
        a, b = k * n // segs, (k + 1) * n // segs
        out[a:b] = band(x[a:b], 800 + 500 * k, 2500 + 700 * k, 0.6)
    return norm(out * np.sin(np.linspace(0, np.pi, n)) ** 2)


def click(freq=3000, d=0.03):
    t = tl(d)
    return np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.004)


def fridge_open():
    d = 0.35
    t = tl(d)
    thump = np.sin(2 * np.pi * (95 - 50 * t / d) * t) * np.exp(-t / 0.07)
    suction = band(noise(d), 200, 1200) * env(len(t), 0.01, 0.12, 4) * 0.5
    return norm(thump + suction)


def hum(d):
    t = tl(d)
    x = (np.sin(2 * np.pi * 50 * t) * 0.5 + np.sin(2 * np.pi * 100 * t) * 0.3 + np.sin(2 * np.pi * 150 * t) * 0.12
         + band(noise(d), 60, 400) * 0.05)
    fade = np.minimum(1, np.minimum(t / 0.4, (d - t) / 0.6))
    return x * fade


def door_close():
    d = 0.4
    t = tl(d)
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.09)
    knock = band(noise(d), 100, 900) * np.exp(-t / 0.03) * 0.6
    rattle = band(noise(d), 2000, 6000) * np.exp(-t / 0.02) * 0.1
    return norm(thump + knock + rattle)


def ding():
    d = 2.2
    t = tl(d)
    f0 = 1318.5
    x = sum(a * np.sin(2 * np.pi * f0 * p * t) * np.exp(-t / dec)
            for p, a, dec in ((1, 1.0, 0.9), (2.0, 0.45, 0.5), (2.76, 0.3, 0.35), (4.07, 0.15, 0.2)))
    sparkle = np.zeros_like(t)
    for k, f in enumerate((2637, 3136, 3951, 5274)):
        i0 = int((0.05 + k * 0.06) * SR)
        tt = t[:len(t) - i0]
        sparkle[i0:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.18) * 0.25
    return norm(x + sparkle)


def pss():
    d = 2.2
    n = int(d * SR)
    t = tl(d)
    snap = click(2400, 0.04)
    snap = np.pad(snap, (0, n - len(snap))) * 1.2
    hiss = band(noise(d), 2500, 12000, 0.5) * np.exp(-t / 0.33) * np.minimum(1, t / 0.006)
    fizz = np.zeros(n)
    k = 0.0
    while k < 1.9:
        k += rng.exponential(0.004 + k * 0.012)
        i = int(k * SR)
        if i >= n - 200:
            break
        m = rng.uniform(0.2, 1.0) * np.exp(-k / 0.8)
        fizz[i:i + 200] += click(rng.uniform(3500, 8000), 200 / SR)[:200] * m
    return norm(snap + hiss * 0.9 + band(fizz, 2500, 10000) * 0.8)


def tok(freq=900):
    d = 0.25
    t = tl(d)
    x = (np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.03) + 0.6 * np.sin(2 * np.pi * freq * 2.3 * t) * np.exp(-t / 0.02)
         + band(noise(d), 300, 3000) * np.exp(-t / 0.008) * 0.6)
    return norm(x)


def whoosh_shrink(d=1.45):
    n = int(d * SR)
    t = tl(d)
    out = np.zeros(n)
    x = noise(d)
    segs = 16
    for k in range(segs):
        a, b = k * n // segs, (k + 1) * n // segs
        c = 300 * (12 ** (k / segs))
        out[a:b] = band(x[a:b], c * 0.6, c * 1.8, 0.7)
    out *= np.sin(np.linspace(0, np.pi, n)) ** 1.2
    f = 220 * (8 ** ((t / d) ** 1.4)) * (1 + 0.025 * np.sin(2 * np.pi * 7 * t))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, n)) ** 0.7
    return norm(norm(out) * 0.7 + tone * 0.55)


def tink():
    d = 0.4
    t = tl(d)
    return norm(np.sin(2 * np.pi * 3520 * t) * np.exp(-t / 0.06) + 0.5 * np.sin(2 * np.pi * 5280 * t) * np.exp(-t / 0.04))


def squeak(f0=900, f1=1500, d=0.28):
    n = int(d * SR)
    t = tl(d)
    f = f0 + (f1 - f0) * (t / d) + 40 * np.sin(2 * np.pi * 31 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(k * ph) / k for k in range(1, 7))
    fr = band(noise(d), 1500, 6000) * 0.3
    return norm((saw * 0.5 + fr) * np.sin(np.linspace(0, np.pi, n)) ** 0.8)


def plunge():
    d = 0.5
    n = int(d * SR)
    x = noise(d)
    out = np.zeros(n)
    for k in range(10):
        a, b = k * n // 10, (k + 1) * n // 10
        c = 2500 * (0.15 ** (k / 10))
        out[a:b] = band(x[a:b], c * 0.5, c * 1.6)
    out *= np.sin(np.linspace(0, np.pi, n)) ** 1.5
    plip = np.zeros(n)
    b = sweep(500, 1300, 0.05) * np.exp(-tl(0.05) / 0.02)
    plip[n - len(b) - 1000:n - 1000] += b
    return norm(norm(out) * 0.7 + plip * 0.8)


def slurp(d=1.0):
    n = int(d * SR)
    t = tl(d)
    x = band(noise(d), 250, 1800, 0.6)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (7 + 3 * np.sin(2 * np.pi * 0.9 * t)) * t)
    out = x * am * np.sin(np.linspace(0, np.pi, n)) ** 0.6
    for k in range(int(d * 9)):
        i = int(rng.uniform(0, d - 0.06) * SR)
        g = sweep(rng.uniform(250, 450), rng.uniform(600, 900), 0.05) * np.exp(-tl(0.05) / 0.018)
        out[i:i + len(g)] += g * 0.5
    return norm(out)


# ------------------------------------------------------------------- music --
def note_hz(n):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    o = int(n[-1])
    return 440.0 * 2 ** ((names[n[:-1]] + 12 * (o + 1) - 69) / 12)


def pad(notes, d, gain=1.0):
    t = tl(d)
    x = np.zeros_like(t)
    for nm in notes:
        f = note_hz(nm)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            x += (np.sin(2 * np.pi * ff * t) + 0.3 * np.sin(4 * np.pi * ff * t) + 0.1 * np.sin(6 * np.pi * ff * t))
    e = np.minimum(1, t / 0.9) * np.minimum(1, (d - t) / 0.9)
    return x * e / (3 * len(notes)) * gain


def pluck(nm, d=0.6, bright=0.35):
    t = tl(d)
    f = note_hz(nm)
    x = (np.sin(2 * np.pi * f * t) + bright * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.08)
         + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.05))
    return x * np.exp(-t / 0.22) * np.minimum(1, t / 0.003)


def celesta(nm, d=1.2):
    t = tl(d)
    f = note_hz(nm)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.1)
    return x * np.exp(-t / 0.45) * np.minimum(1, t / 0.002)


def music():
    # A: thirsty, slow minor pad (0 - 11.7 s)
    prog_a = [(['A2', 'E3', 'A3', 'C4'], 0.0), (['F2', 'C3', 'F3', 'A3'], 3.0),
              (['D3', 'A3', 'D4', 'F4'], 6.0), (['E2', 'B2', 'E3', 'G#3'], 9.0)]
    for notes, s in prog_a:
        add(pad(notes, 3.6, 0.9), s, 0.55, music=True)
    for k, nm in enumerate(['E4', 'C4', 'A3', 'C4', 'F4', 'C4', 'A3', 'C4', 'F4', 'D4', 'A3', 'D4', 'E4', 'B3', 'G#3', 'B3']):
        add(pluck(nm, 0.9, 0.2), 0.0 + k * 0.75, 0.16, pan=-0.3 + 0.2 * (k % 3), music=True)
    # B: the idea -> playful major (11.75 - 24 s)
    t0 = sec(283)
    prog_b = [(['C3', 'G3', 'C4', 'E4'], ['C4', 'E4', 'G4', 'C5']), (['G2', 'D3', 'G3', 'B3'], ['B3', 'D4', 'G4', 'D4']),
              (['A2', 'E3', 'A3', 'C4'], ['A3', 'C4', 'E4', 'A4']), (['F2', 'C3', 'F3', 'A3'], ['A3', 'C4', 'F4', 'C5']),
              (['C3', 'G3', 'C4', 'E4'], ['E4', 'G4', 'C5', 'G4']), (['G2', 'D3', 'G3', 'B3'], ['D4', 'G4', 'B4', 'D5']),
              (['F2', 'C3', 'F3', 'A3'], ['F4', 'A4', 'C5', 'A4']), (['C3', 'G3', 'C4', 'E4'], ['C5', 'G4', 'E4', 'C4'])]
    beat = 0.375
    for i, (padn, arp) in enumerate(prog_b):
        s = t0 + i * 8 * beat * 0.5
        add(pad(padn, 1.9, 0.8), s, 0.45, music=True)
        for k in range(8):
            nm = arp[k % 4]
            tt = s + k * beat * 0.5
            if tt < DUR:
                add(pluck(nm, 0.5), tt, 0.2 if k % 2 == 0 else 0.13, pan=0.25 * ((k % 4) - 1.5) / 1.5, music=True)
    # sparkle while shrinking and on the tiny can
    for k, nm in enumerate(['C6', 'E6', 'G6', 'C7', 'E7', 'G7']):
        add(celesta(nm, 1.0), sec(400) + k * 0.12, 0.12, pan=0.4, music=True)
    for k, nm in enumerate(['G5', 'C6', 'E6', 'G6']):
        add(celesta(nm, 1.4), sec(544) + k * 0.5, 0.1, pan=-0.3, music=True)
    add(pad(['C3', 'G3', 'C4', 'E4', 'G4'], 2.4, 0.9), sec(528), 0.45, music=True)


def effects():
    for f in (2, 15, 29, 43, 56, 66):
        add(footstep(0.9), sec(f), 0.32, pan=0.2)
    for k in range(9):
        add(breath(0.3, 1.0), 0.15 + k * 0.42, 0.075 * (1.0 if k % 2 == 0 else 0.6), pan=0.05)
    for k in range(6):
        add(breath(0.36, 1.0), sec(66) + k * 0.45, 0.07 * (1.0 if k % 2 == 0 else 0.55))
    add(swish(0.35), sec(80), 0.18, pan=-0.2)
    add(swish(0.25), sec(93), 0.12, pan=-0.4)
    add(click(2600), sec(114), 0.25, pan=0.3)
    add(fridge_open(), sec(116), 0.5, pan=0.3)
    add(hum(sec(384) - sec(117)), sec(117), 0.05, pan=0.2)
    for f in (152, 159, 190, 197):
        add(footstep(0.7), sec(f), 0.22)
    add(tok(700), sec(176), 0.18)
    add(swish(0.2), sec(236), 0.07)
    add(ding(), sec(283), 0.28, pan=0.15)
    add(click(1800, 0.02), sec(316), 0.15)
    add(pss(), sec(320), 0.55)
    for f in (343, 351):
        add(footstep(0.8), sec(f), 0.25)
    add(tok(950), sec(370), 0.3)
    add(door_close(), sec(386), 0.32, pan=-0.5)
    add(footstep(1.0), sec(396), 0.3)
    add(whoosh_shrink(1.45), sec(397), 0.42)
    add(tink(), sec(430), 0.3)
    add(tok(2600), sec(434), 0.12)
    for f in (466, 476, 486):
        add(squeak(900, 1500, 0.3), sec(f), 0.17, pan=0.1)
    add(squeak(700, 2600, 0.42), sec(494), 0.2)
    add(plunge(), sec(513), 0.32)
    add(tok(3300), sec(536), 0.1)
    add(slurp(1.1), sec(545), 0.2)
    add(slurp(1.0), sec(566), 0.17)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
    music()
    effects()
    room = band(rng.standard_normal(N), 40, 900) * 0.004
    l = L + MUS_L * 0.7 + room
    r = R + MUS_R * 0.7 + room
    # gentle end fade
    t = np.arange(N) / SR
    fade = np.clip((DUR - t) / 0.6, 0, 1)
    l, r = l * fade, r * fade
    peak = max(np.max(np.abs(l)), np.max(np.abs(r)))
    g = 0.89 / peak
    data = np.stack([l * g, r * g], axis=1)
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", out)


if __name__ == "__main__":
    main()
