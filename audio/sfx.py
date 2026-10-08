"""Procedural sound design, synthesized from scratch and locked to the cue
sheet in src/timeline.json (the same cues that drive the animation).

No music: a restrained ambience bed, digital pulses, particle grains, UI
ticks, whooshes, scans and low-frequency impacts.

Usage: python3 audio/sfx.py <out.wav>
"""
import json, sys
import numpy as np
from scipy import signal

SR = 48000
TL = json.load(open("src/timeline.json"))
C = TL["cues"]
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(7)

L = np.zeros(N); R = np.zeros(N)          # dry bus
RL = np.zeros(N); RR = np.zeros(N)        # reverb send


def db(x):
    return 10 ** (x / 20)


def tt(n):
    return np.arange(n) / SR


def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def place(x, t0, gain=1.0, pan=0.0, rev=0.25):
    """Mix mono x (or stereo tuple) at time t0 (s)."""
    i0 = int(round(t0 * SR))
    if isinstance(x, tuple):
        xl, xr = x
    else:
        gl, gr = pan_gains(pan) if np.isscalar(pan) else pan_gains(pan)
        xl, xr = x * gl, x * gr
    if i0 < 0:
        xl, xr = xl[-i0:], xr[-i0:]; i0 = 0
    n = min(len(xl), N - i0)
    if n <= 0:
        return
    L[i0:i0 + n] += xl[:n] * gain; R[i0:i0 + n] += xr[:n] * gain
    RL[i0:i0 + n] += xl[:n] * gain * rev; RR[i0:i0 + n] += xr[:n] * gain * rev


def env(n, a, d, curve=1.0):
    t = tt(n)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))
    return e ** curve


def noise(n):
    return rng.standard_normal(n)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "high", fs=SR, output="sos"), x)


def svf(x, fc, q=0.7, mode="bp"):
    """State-variable filter with per-sample cutoff (array) — for sweeps."""
    fc = np.broadcast_to(fc, x.shape)
    f = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 6) / SR)
    lo = bd = 0.0
    out = np.empty_like(x)
    damp = 1 / q
    for i in range(len(x)):
        hi_ = x[i] - lo - damp * bd
        bd += f[i] * hi_
        lo += f[i] * bd
        out[i] = bd if mode == "bp" else lo if mode == "lp" else hi_
    return out


def glide(f0, f1, n, curve=1.0):
    k = np.linspace(0, 1, n) ** curve
    f = f0 * (f1 / f0) ** k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)


# ───────────────────────── building blocks ─────────────────────────
def sub_boom(f0=55, f1=34, dur=1.4, click=True):
    n = int(dur * SR)
    x = glide(f0, f1, n, 0.5) * env(n, 0.004, dur * 0.35)
    x += 0.35 * glide(f0 * 2, f1 * 2, n, 0.5) * env(n, 0.002, 0.12)
    if click:
        c = hp(noise(n), 1500) * env(n, 0.0005, 0.006)
        x += 0.5 * c
    body = lp(noise(n), 700) * env(n, 0.002, 0.09)
    return x + 0.6 * norm(body) * 0.5


def tick(freq=4200, dur=0.03, click=0.6):
    n = int(dur * SR)
    x = np.sin(2 * np.pi * freq * tt(n)) * env(n, 0.0005, dur * 0.18)
    x += click * hp(noise(n), 3000) * env(n, 0.0002, 0.0015)
    return x


def blip(freq, dur=0.07, harm=0.2):
    n = int(dur * SR)
    t = tt(n)
    x = (np.sin(2 * np.pi * freq * t) + harm * np.sin(4 * np.pi * freq * t)) * env(n, 0.002, dur * 0.25)
    return x


def whoosh(dur, f0, f1, q=1.2, curve=1.0, shape="swell"):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (k ** curve)
    x = svf(noise(n), fc, q)
    if shape == "swell":
        e = np.sin(np.pi * k) ** 1.5
    elif shape == "in":          # grows to the end (reverse-like)
        e = k ** 2.2 * (1 - np.clip((k - 0.97) / 0.03, 0, 1))
    else:                        # out: fast attack, long tail
        e = np.minimum(1, k / 0.04) * np.exp(-k * 4)
    return norm(x) * e


def shimmer(freqs, dur=2.0, attack=0.02, detune=0.003):
    n = int(dur * SR)
    t = tt(n)
    x = np.zeros(n)
    for i, f in enumerate(freqs):
        for d in (-detune, detune):
            x += np.sin(2 * np.pi * f * (1 + d) * t + i) / (1 + i * 0.4)
    trem = 1 + 0.15 * np.sin(2 * np.pi * 5.5 * t)
    return norm(x) * env(n, attack, dur * 0.3) * trem


def grains(t0, t1, count, f_lo=3000, f_hi=9000, density=None, gain=1.0, pan_spread=0.9, dur=(0.003, 0.012)):
    times = np.sort(rng.uniform(t0, t1, count)) if density is None else density
    for t in times:
        d = rng.uniform(*dur)
        n = int(d * SR)
        f = rng.uniform(f_lo, f_hi)
        g = np.sin(2 * np.pi * f * tt(n)) * np.hanning(n)
        place(g, t, gain * rng.uniform(0.3, 1.0), pan=rng.uniform(-pan_spread, pan_spread), rev=0.35)


def weighted_times(t0, t1, count, power):
    """Times concentrated toward t1 (power>1) or t0 (power<1)."""
    u = rng.uniform(0, 1, count) ** (1 / power)
    return np.sort(t0 + (t1 - t0) * u)


# ───────────────────────── ambience bed ─────────────────────────
t = tt(N)
lvl = np.interp(t, [0, 0.4, C["hero"] - 0.8, C["hero"], C["shift"], C["shift"] + 1, C["converge"], C["bol"], C["end"] - 1.2, C["end"]],
                   [0, 0.55, 0.6, 1.0, 0.9, 0.6, 0.6, 0.8, 0.6, 0])
drone = (np.sin(2 * np.pi * 41.2 * t) + 0.5 * np.sin(2 * np.pi * 61.8 * t + 1) + 0.25 * np.sin(2 * np.pi * 82.4 * t + 2))
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
air = bp(noise(N), 1800, 7000)
air = norm(air) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t + 1))
air_r = norm(bp(noise(N), 1800, 7000)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t))
L += lvl * (db(-27) * drone + db(-50) * air)
R += lvl * (db(-27) * drone + db(-50) * air_r)

# ───────────────────────── act 1: pulse + Сәлем ─────────────────────────
for k, tp in enumerate([C["pulse1"], C["pulse2"]]):
    place(blip(880 * (1.335 if k else 1), 0.09), tp, db(-20), rev=0.6)
    place(sub_boom(70, 50, 0.35, click=False), tp, db(-17))
place(whoosh(0.42, 800, 7000, q=1.0, curve=1.6, shape="in"), C["salem"] - 0.42, db(-21), rev=0.3)
place(sub_boom(58, 36, 1.3), C["salem"], db(-9))
place(hp(noise(int(0.05 * SR)), 2500) * env(int(0.05 * SR), 0.0005, 0.01), C["salem"], db(-16))
place(shimmer([2637, 3951, 5274], 1.4, 0.005), C["salem"], db(-27), rev=0.8)
wo = whoosh(0.9, 6000, 900, q=0.9, shape="out")
place((wo * 0.8, np.roll(wo, 240) * 0.8), C["salem"] + 0.01, db(-21), rev=0.5)

# ───────────────────────── act 2: fragments → Бексұлтан ─────────────────────────
grains(C["salemOut"], C["salemOut"] + 0.7, 140, gain=db(-30))                       # dissolve
grains(C["salemOut"] + 0.4, C["name"], 0, gain=db(-31),
       density=weighted_times(C["gather"] - 0.4, C["name"] + 0.1, 260, 2.2))          # converge
n = int((C["name"] - C["gather"]) * SR)
place(whoosh(C["name"] - C["gather"], 300, 5000, q=1.4, curve=1.8, shape="in"), C["gather"], db(-24), rev=0.3)
place(glide(260, 780, n, 2.0) * np.linspace(0, 1, n) ** 3, C["gather"], db(-36))
for i in range(9):
    place(tick(3400 + i * 140, 0.035), C["name"] + i * C["nameStagger"], db(-17), pan=-0.6 + 1.2 * i / 8, rev=0.3)
place(sub_boom(64, 42, 0.9), C["name"] + 0.02, db(-15))
place(shimmer([1568, 2349, 3136], 1.6, 0.01), C["name"] + 8 * C["nameStagger"], db(-31), rev=0.9)
sw = whoosh(0.8, 2500, 9000, q=2.0, shape="swell")
k = np.linspace(-0.7, 0.7, len(sw)); gl, gr = pan_gains(k)
place((sw * gl, sw * gr), C["nameSweep"], db(-29), rev=0.5)

# ───────────────────────── act 3: ribbon → Сіздерге ─────────────────────────
d = 1.5
rb = whoosh(d, 400, 3200, q=1.1, shape="swell")
k = np.linspace(-0.9, 0.9, len(rb)); gl, gr = pan_gains(k)
place((rb * gl, rb * gr), C["flow"], db(-19), rev=0.35)
place(lp(noise(int(d * SR)), 180) * np.sin(np.linspace(0, np.pi, int(d * SR))) * 4, C["flow"], db(-27))
place(tick(2600, 0.05, 0.4), C["siz"] - 0.01, db(-18), pan=-0.3)
sw = whoosh(0.45, 1500, 6000, q=1.6, shape="out")
k = np.linspace(-0.5, 0.5, len(sw)); gl, gr = pan_gains(k)
place((sw * gl, sw * gr), C["siz"], db(-24), rev=0.4)
# collapse riser into the hero
rd = C["hero"] - C["collapse"]
n = int(rd * SR)
kk = np.linspace(0, 1, n)
riser = whoosh(rd, 200, 9000, q=1.8, curve=2.0, shape="in")
tone = glide(180, 1400, n, 2.4) * kk ** 3
trem = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * np.cumsum(4 + 26 * kk ** 2) / SR))
cut = 1 - np.clip((kk - 0.975) / 0.025, 0, 1)
place(riser * cut, C["collapse"], db(-17), rev=0.3)
place(tone * trem * cut, C["collapse"], db(-33), rev=0.4)

# ───────────────────────── act 4: hero ─────────────────────────
place(sub_boom(52, 30, 2.2), C["hero"], db(-6))
place(lp(noise(int(0.5 * SR)), 900) * env(int(0.5 * SR), 0.001, 0.12), C["hero"], db(-14))
place(shimmer([440, 659.3, 880, 1318.5, 1975.5], 3.2, 0.03), C["hero"] + 0.02, db(-26), rev=0.9)
wo = whoosh(1.4, 7000, 600, q=0.8, shape="out")
place((wo, np.roll(wo, 300)), C["hero"], db(-20), rev=0.6)
# ЖАСАНДЫ: algorithmic dot field (L→R data ticks) + scanning beam (high → low)
for i, tg in enumerate(np.linspace(C["hero"], C["hero"] + 0.3, 26)):
    place(tick(rng.choice([2800, 3300, 3950, 4700]), 0.02, 0.2), tg + rng.uniform(0, 0.015), db(-27), pan=-0.7 + 1.4 * i / 25, rev=0.2)
n = int(0.55 * SR)
scan = svf(noise(n), np.geomspace(6500, 1400, n), q=6)
place(norm(scan) * np.sin(np.linspace(0, np.pi, n)) ** 0.8, C["hero"] + 0.1, db(-27), rev=0.5)
place(glide(2200, 900, n, 1.0) * np.sin(np.linspace(0, np.pi, n)), C["hero"] + 0.1, db(-38), rev=0.5)
# ИНТЕЛЛЕКТ: signals arrive, each neuron fires
n = int(0.32 * SR)
place(whoosh(0.32, 700, 4000, q=2.5, curve=1.5, shape="in"), C["intel"] - 0.3, db(-26), rev=0.3)
for b in range(9):
    tb = C["intel"] + b * 0.05
    place(glide(1800, 5200, int(0.04 * SR), 0.7) * env(int(0.04 * SR), 0.002, 0.02), tb - 0.035, db(-30), pan=-0.65 + 1.3 * b / 8)
    place(mix(tick(1500 + 180 * b, 0.06, 0.5), 0.6 * blip(220 + 25 * b, 0.08, 0.0)), tb, db(-18), pan=-0.65 + 1.3 * b / 8, rev=0.35)
place(sub_boom(70, 48, 0.7), C["intel"] + 0.2, db(-17))
# hold: data blips on a quantized grid, second scan
grid = np.arange(C["intel"] + 0.75, C["shift"] - 0.25, 0.125)
for g in grid:
    if rng.uniform() < 0.32:
        place(blip(rng.choice([1320, 1760, 1980, 2640, 3520]), 0.035, 0.0), g, db(-33), pan=rng.uniform(-0.8, 0.8), rev=0.6)
n = int(1.1 * SR)
s2 = svf(noise(n), np.geomspace(7000, 2000, n), q=5)
place(norm(s2) * np.sin(np.linspace(0, np.pi, n)), C["scan2"], db(-31), rev=0.5)

# ───────────────────────── act 5: structure ─────────────────────────
wo = whoosh(0.55, 5000, 400, q=1.0, curve=0.8, shape="swell")
place((wo, np.roll(wo, 200)), C["shift"] - 0.05, db(-21), rev=0.4)
place(sub_boom(60, 45, 0.6, click=False), C["shift"], db(-19))
for tg in weighted_times(C["shift"] + 0.25, C["shift"] + 0.95, 22, 1.6):     # nodes snapping into the lattice
    place(tick(rng.uniform(1800, 3200), 0.025, 0.8), tg, db(-29), pan=rng.uniform(-0.8, 0.8), rev=0.25)
words = {w["w"]: w for w in TL["words"]}
for k, (key, wkey) in enumerate([("mod1", "нақты"), ("mod2", "базалық"), ("mod3", "сабақтарды")]):
    T = C[key]
    nletters = len(wkey)
    place(tick(2200, 0.03, 0.3), T - 0.42, db(-26), rev=0.3)                          # connector
    n = int(0.4 * SR)
    place(glide(520 * 2 ** (k / 6), 1040 * 2 ** (k / 6), n, 1.0) * np.sin(np.linspace(0, np.pi, n)) ** 2, T - 0.24, db(-31), rev=0.5)
    place(whoosh(0.4, 1200, 5000, q=2.0, shape="swell"), T - 0.24, db(-30), rev=0.3)
    place(mix(tick(3000, 0.05, 0.9), 0.5 * blip(660 * 2 ** (k / 6), 0.12, 0.3)), T, db(-17), rev=0.35)
    place(sub_boom(66, 50, 0.4, click=False), T, db(-22))
    for i in range(nletters):                                                        # letters typed in
        place(tick(4200 + rng.uniform(-300, 300), 0.012, 0.9), T + 0.02 + i * 0.034, db(-31), pan=-0.4 + 0.8 * i / max(1, nletters - 1))

# ───────────────────────── act 6: resolution ─────────────────────────
cd = C["ui"] - C["converge"]
place(whoosh(cd, 600, 7000, q=1.3, curve=1.6, shape="in"), C["converge"], db(-19), rev=0.3)
n = int(cd * SR)
place(glide(300, 900, n, 2.0) * np.linspace(0, 1, n) ** 3, C["converge"], db(-35))
place(sub_boom(62, 44, 0.8), C["ui"], db(-15))
sw = whoosh(0.6, 900, 4500, q=1.4, shape="out")
place((sw, np.roll(sw, 160)), C["ui"], db(-24), rev=0.4)
land = C["bol"] + 0.1
place(whoosh(0.22, 1500, 8000, q=1.2, curve=1.4, shape="in"), land - 0.22, db(-22))
place(sub_boom(48, 28, 2.6), land, db(-5))
place(lp(noise(int(0.6 * SR)), 1200) * env(int(0.6 * SR), 0.001, 0.1), land, db(-13))
place(shimmer([523.25, 783.99, 1046.5, 1567.98], 3.0, 0.04), land + 0.03, db(-27), rev=1.0)
# lockup
place(whoosh(0.35, 6000, 500, q=1.5, curve=0.7, shape="in"), C["lockup"] + 0.05, db(-25), rev=0.3)
place(mix(blip(1760, 0.6, 0.15) * 0.8, 0.6 * blip(2637, 0.9, 0.0)), C["lockup"] + 0.42, db(-26), rev=1.0)
for i in range(3):
    place(tick(2800 + 400 * i, 0.04, 0.3), C["lockup"] + 0.75 + 0.07 * i, db(-27), pan=(-0.4, 0.0, 0.4)[i], rev=0.6)
sw = whoosh(0.7, 900, 3500, q=1.2, shape="swell")
place((sw, np.roll(sw, 200)), C["lockup"] + 0.65, db(-29), rev=0.5)
place(sub_boom(55, 40, 1.5, click=False), C["lockup"] + 0.7, db(-19))
sw = whoosh(0.85, 3000, 10000, q=2.0, shape="swell")
k = np.linspace(-0.6, 0.6, len(sw)); gl, gr = pan_gains(k)
place((sw * gl, sw * gr), C["lockup"] + 1.5, db(-31), rev=0.6)
place(shimmer([659.25, 987.77, 1318.5], 2.4, 0.3), C["lockup"] + 1.0, db(-33), rev=1.0)

# ───────────────────────── reverb + output ─────────────────────────
def ir(seconds, seed):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    e = np.exp(-np.arange(n) / SR * 6.9 / seconds)
    x = r.standard_normal(n) * e
    x = lp(x, 7000)
    x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return x / np.sqrt(np.sum(x ** 2))

wl = signal.fftconvolve(RL, ir(2.2, 1))[:N]
wr = signal.fftconvolve(RR, ir(2.2, 2))[:N]
outL, outR = L + 0.55 * wl, R + 0.55 * wr
fade = np.clip((DUR - t) / 0.45, 0, 1) ** 2
out = np.stack([outL * fade, outR * fade], 1)
out = out / max(1e-9, np.max(np.abs(out))) * db(-1.0)
import soundfile as sf
sf.write(sys.argv[1] if len(sys.argv) > 1 else "build/sfx.wav", out.astype(np.float32), SR, subtype="FLOAT")
print("sfx written", out.shape)
