#!/usr/bin/env python3
"""YEMELBAI FILMS × VeoSeeBot интросының дыбыс дизайны — үлгісіз, толығымен синтезделген.

Барлық уақыт белгілері timeline.js файлынан алынады, сондықтан дыбыс суретпен
кадрға дейін дәл келеді. Нәтиже: output/intro_audio.wav (48 kHz, стерео).

Дыбыс құрамы:
  * қараңғы E-минор пад + суб-дрон (бүкіл интро бойы)
  * сызық өскенде — шу-райзер, YEMELBAI ашылғанда — терең соққы + шыны тон
  * нүкте мен сақиналар — «сонар» пингі
  * жұлдыз сызылғанда — объектив сақинасының жиілеген шықылы, стереода айналатын
    «қалам» дыбысы, кері реверб; соққыда — суб-бум, камера затворы, аккорд
  * VeoSeeBot әріптері мен жазулар — жұмсақ ауа мен шыны тондар
  * соңында — сызық нүктеге жиырылғанда сору дыбысы, соңғы пинг пен құйрық
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

HERE = Path(__file__).resolve().parent
_src = (HERE / "timeline.js").read_text(encoding="utf-8")
T = json.loads(_src[_src.index("{", _src.index("window.TIMELINE")): _src.rindex("}") + 1])

SR = 48000
DUR = T["duration"]
N = int(round(DUR * SR))
rng = np.random.default_rng(1107)
mix = np.zeros((2, N))


# ---------------------------------------------------------------- helpers
def tv(d):
    return np.arange(int(round(d * SR))) / SR


def noise(d):
    return rng.standard_normal(int(round(d * SR)))


def _sos(kind, fc, order):
    return signal.butter(order, fc, kind, fs=SR, output="sos")


def lp(x, fc, order=2):
    return signal.sosfilt(_sos("lowpass", fc, order), x, axis=-1)


def hp(x, fc, order=2):
    return signal.sosfilt(_sos("highpass", fc, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", [lo, hi], order), x, axis=-1)


def sweep_lp(x, fc):
    """Two cascaded one-pole low-passes with a per-sample cutoff (fc: array)."""
    a = 1 - np.exp(-2 * np.pi * np.asarray(fc) / SR)
    y1 = y2 = 0.0
    out = np.empty_like(x)
    for i in range(len(x)):
        y1 += a[i] * (x[i] - y1)
        y2 += a[i] * (y1 - y2)
        out[i] = y2
    return out


def layer(*parts):
    """Sum (gain, mono signal) pairs of different lengths."""
    out = np.zeros(max(len(x) for _, x in parts))
    for g, x in parts:
        out[: len(x)] += g * x
    return out


def env_points(t, pts):
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


def fade(x, a=0.003, b=0.003):
    x = x.copy()
    na, nb = int(a * SR), int(b * SR)
    if na:
        x[..., :na] *= np.linspace(0, 1, na)
    if nb:
        x[..., -nb:] *= np.linspace(1, 0, nb)
    return x


def stereo(x, pan=0.0):
    if x.ndim == 2:
        return x
    th = (pan + 1) * np.pi / 4
    return np.vstack([x * np.cos(th), x * np.sin(th)]) * np.sqrt(2)


def place(x, at, gain=1.0, pan=0.0):
    x = stereo(x, pan)
    i0 = int(round(at * SR))
    if i0 < 0:
        x, i0 = x[:, -i0:], 0
    n = min(x.shape[1], N - i0)
    if n > 0:
        mix[:, i0:i0 + n] += gain * x[:, :n]


def make_ir(seconds, decay, bright=7000, dark=1400):
    """Stereo hall impulse response: decorrelated noise, darker as it decays."""
    t = np.arange(int(seconds * SR)) / SR
    env = np.exp(-6.9 * t / decay)
    ch = []
    for _ in range(2):
        x = rng.standard_normal(len(t))
        w = np.exp(-t / (decay * 0.3))
        y = (lp(x, bright) * w + lp(x, dark) * (1 - w)) * env
        y[: int(0.006 * SR)] *= np.linspace(0, 1, int(0.006 * SR))
        ch.append(np.concatenate([np.zeros(int(0.018 * SR)), y]))   # pre-delay
    ir = np.array(ch)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def reverb(x, ir, wet=0.35, dry=1.0):
    x = stereo(x)
    y = np.vstack([signal.fftconvolve(x[c], ir[c]) for c in range(2)])
    y *= wet
    y[:, : x.shape[1]] += dry * x
    return y


def tone(freqs, d, decay, attack=0.004):
    """Struck tone: list of (freq, amp, decay_mult)."""
    t = tv(d)
    y = np.zeros_like(t)
    for f, a, dm in freqs:
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / (decay * dm))
    y *= np.minimum(1, t / attack)
    return y


def boom(f_hi, f_lo, d, decay, glide=0.07):
    t = tv(d)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / glide)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / decay) * np.minimum(1, t / 0.002)
    return y + 0.25 * np.tanh(3 * y)        # a touch of harmonics so it reads on small speakers


def crack(d=0.12, lo=900, hi=7000):
    t = tv(d)
    x = bp(noise(d), lo, hi) * np.exp(-t / 0.022)
    x += 0.6 * bp(noise(d), 300, 1500) * np.exp(-np.maximum(t - 0.008, 0) / 0.03) * (t > 0.008)
    return fade(x, 0.0005, 0.01)


def saw(f, t, maxf=2400):
    y = np.zeros_like(t)
    ph = rng.uniform(0, 6.28)
    k = 1
    while k * f < maxf:
        y += np.sin(2 * np.pi * k * f * t + ph * k) / k
        k += 1
    return y * 2 / np.pi


E1, E2, B2, E3, G3, B3 = 41.20, 82.41, 123.47, 164.81, 196.00, 246.94
E4, B4, E5, B5, E6 = 329.63, 493.88, 659.25, 987.77, 1318.51

hall = make_ir(4.5, 3.6)
room = make_ir(2.4, 1.8, bright=9000, dark=2500)
t_all = tv(DUR)[:N]

# ---------------------------------------------------------------- drone & pad
h1, h2, OUT, DH = T["hit1"], T["hit2"], T["outro"], T["dotHit"]
sub_env = env_points(t_all, [(0, 0), (1.0, 0.10), (h1, 0.35), (T["logoOut"], 0.28), (T["logoGone"] + 0.2, 0.12),
                             (h2 - 0.6, 0.18), (h2, 0.55), (OUT - 0.9, 0.4), (DH, 0.3), (DH + 0.85, 0.0), (DUR, 0)])
sub = (np.sin(2 * np.pi * E1 * t_all) + 0.3 * np.sin(2 * np.pi * E2 * t_all)) * sub_env
sub *= 1 + 0.15 * np.sin(2 * np.pi * 0.21 * t_all)
place(sub, 0, 0.55)

pad_env = env_points(t_all, [(0, 0), (0.5, 0.0), (h1, 0.18), (h1 + 0.85, 0.42), (T["logoOut"], 0.4),
                             (T["logoGone"] + 0.1, 0.14), (T["drawStart"], 0.16), (h2, 0.42), (h2 + 0.8, 0.75),
                             (OUT - 0.6, 0.62), (DH, 0.22), (DH + 1.0, 0.0), (DUR, 0)])
minor = env_points(t_all, [(0, 0), (h2, 0), (h2 + 1.2, 1), (DUR, 1)])        # the minor third arrives with the logo
bright = env_points(t_all, [(0, 0), (h2 - 0.05, 0), (h2 + 0.05, 1), (h2 + 2.8, 0.15), (DUR, 0)])
pad = np.zeros((2, N))
for f, amp, gate in [(E2, 0.9, None), (B2, 0.6, None), (E3, 0.45, None), (G3, 0.38, minor), (B3, 0.22, None)]:
    for det, pan in [(-0.0016, -0.7), (0.0, 0.0), (0.0019, 0.7)]:
        v = saw(f * (1 + det), t_all) * amp * (gate if gate is not None else 1)
        pad += stereo(v, pan)
pad_dark = lp(pad, 380, 2)
pad_bright = lp(pad, 1800, 2)
pad_mix = (pad_dark + pad_bright * 0.45 * bright) * pad_env
pad_mix *= 1 + 0.12 * np.sin(2 * np.pi * 0.17 * t_all + np.array([[0], [1.7]]))
place(pad_mix, 0, 0.11)

# ---------------------------------------------------------------- 1. line + riser
d = T["hit1"] - T["lineStart"]
tt = tv(d)
p = tt / d
riser = sweep_lp(noise(d), 250 + 7000 * p ** 2.2) * (p ** 2.4)
place(fade(riser, 0.05, 0.012), T["lineStart"], 0.55, 0)
line_tone = (np.sin(2 * np.pi * E6 * tt) + 0.3 * np.sin(2 * np.pi * B5 * tt)) * p ** 1.6 * (1 + 0.2 * np.sin(2 * np.pi * 7 * tt))
place(reverb(fade(line_tone, 0.2, 0.01), room, 0.4), T["lineStart"], 0.03)

# ---------------------------------------------------------------- 2. YEMELBAI hit
hit1 = layer((0.9, boom(95, 38, 2.4, 0.75)), (0.35, crack(0.1, 1500, 9000)),
             (0.25, lp(noise(0.6), 320) * np.exp(-tv(0.6) / 0.18)))
glass = tone([(E5, 1, 1), (E5 * 2.001, 0.35, 0.6), (B5, 0.25, 0.8), (E5 * 3.98, 0.08, 0.35)], 3.0, 1.1)
place(reverb(hit1, hall, 0.4), h1, 0.9)
place(reverb(glass, hall, 0.6), h1, 0.12)

# FILMS / ҰСЫНАДЫ — air and a quiet glass touch
dd = 0.9
air = bp(noise(dd), 3500, 11000) * np.sin(np.pi * tv(dd) / dd) ** 2
place(np.vstack([air, np.roll(air, 400)]), T["filmsIn"], 0.05)
place(reverb(tone([(B5, 1, 1), (B5 * 2, 0.2, 0.5)], 1.6, 0.6), hall, 0.7), T["presentsIn"], 0.045)

# logo dissolves: falling filtered whoosh
d = T["logoGone"] - T["logoOut"] + 0.3
tt = tv(d)
p = tt / d
whoosh = sweep_lp(noise(d), 5000 * (1 - p) ** 2 + 200) * np.sin(np.pi * np.minimum(1, p * 1.25)) ** 1.5
place(reverb(np.vstack([whoosh, sweep_lp(noise(d), 5000 * (1 - p) ** 2 + 200) * np.sin(np.pi * np.minimum(1, p * 1.25)) ** 1.5]),
             room, 0.5), T["logoOut"], 0.16)

# ---------------------------------------------------------------- 3. dot + sonar pings with ping-pong echo
place(fade(np.sin(2 * np.pi * E1 * 2 * tv(1.2)) * np.sin(np.pi * tv(1.2) / 1.2), 0.01, 0.01), T["dotIn"], 0.18)
ping = tone([(E6, 1, 1), (E5, 0.35, 1.4), (E6 * 2.003, 0.12, 0.4)], 1.4, 0.32, attack=0.002)
pings = np.zeros((2, int(SR * (T["pingCount"] * T["pingInterval"] + 1.6))))
for n in range(T["pingCount"]):
    rep = ping if n == 0 else lp(ping, 7000 * 0.62 ** n + 900)
    rep = stereo(rep, 0 if n == 0 else (0.65 if n % 2 else -0.65))
    i0 = int(round(n * T["pingInterval"] * SR))
    pings[:, i0:i0 + rep.shape[1]] += 0.62 ** n * rep
place(reverb(pings, hall, 0.55), T["ping"], 0.26)

# ---------------------------------------------------------------- 4. the pen draws the star -> the iris opens on VeoSeeBot
ds = T["drawStart"]
d = h2 - ds
tt = tv(d)
p = tt / d


def click(f_res=3100, body=900):
    """One mechanical tick of a lens ring / shutter."""
    t = tv(0.05)
    x = bp(noise(0.05), 2000, 9000) * np.exp(-t / 0.0025)
    x += 0.5 * np.sin(2 * np.pi * f_res * t) * np.exp(-t / 0.012)
    x += 0.35 * np.sin(2 * np.pi * body * t) * np.exp(-t / 0.02)
    return fade(x, 0.0003, 0.005)


# the aperture ring turning: ticks that speed up as the star turns into place
ticks = np.zeros((2, int((d + 0.3) * SR)))
tk, k = 0.12, 0
while tk < d - 0.04:
    q = tk / d
    c = click(3100 + 400 * (k % 2), 850 + 120 * (k % 3))
    st = stereo(c, 0.35 if k % 2 else -0.35) * (0.35 + 0.65 * q)
    i0 = int(tk * SR)
    ticks[:, i0:i0 + st.shape[1]] += st
    tk += 0.17 + (0.045 - 0.17) * q ** 1.3
    k += 1
place(reverb(ticks, room, 0.35), ds, 0.16)

# the light pen: an airy tone that circles the stereo field together with the sweep on screen
ease = np.where(p < 0.5, 4 * p ** 3, 1 - (-2 * p + 2) ** 3 / 2)
pan = np.cos(-np.pi / 2 + 2 * np.pi * ease)
pen = bp(noise(d), 1500, 6000) * (0.3 + 0.7 * p) * np.sin(np.pi * np.minimum(1, p * 1.15)) ** 0.6
place(fade(np.vstack([pen * np.sqrt((1 - pan) / 2), pen * np.sqrt((1 + pan) / 2)]) * 1.4, 0.05, 0.02), ds, 0.07)

# reverse swell + inhale into the hit
src = layer((1.0, tone([(E3, 1, 1), (B3, 0.7, 1), (E4, 0.5, 0.8), (B4, 0.25, 0.6)], 0.5, 0.25)),
            (0.5, lp(noise(0.3), 3000) * np.exp(-tv(0.3) / 0.05)))
wet = reverb(src, hall, 1.0, dry=0.0)[:, ::-1]
swell_len = int((d + 0.4) * SR)
wet = wet[:, -swell_len:]
wet *= np.linspace(0, 1, swell_len) ** 1.8
place(fade(wet, 0.0, 0.006), h2 - swell_len / SR, 0.9)
inhale = sweep_lp(noise(d), 200 + 6000 * p ** 3) * p ** 3
place(fade(np.vstack([inhale, np.roll(inhale, 700)]), 0.05, 0.004), ds, 0.3)

# the impact: sub boom, crack, a camera shutter, and the chord
impact = layer((1.0, boom(110, 32, 3.5, 1.4, glide=0.09)), (0.45, crack(0.14, 900, 8000)),
               (0.4, lp(noise(0.9), 450) * np.exp(-tv(0.9) / 0.25)))
place(reverb(impact, hall, 0.45), h2, 1.0)
whirr = bp(noise(0.09), 1200, 5000) * np.minimum(1, tv(0.09) / 0.005) * np.exp(-tv(0.09) / 0.03)
shutter = layer((1.0, click(3600, 1100)), (0.5, whirr))
shutter = layer((1.0, shutter), (0.8, np.concatenate([np.zeros(int(0.055 * SR)), click(2700, 800)])))
place(reverb(shutter, room, 0.3), h2 - 0.005, 0.5)
chord = tone([(E3, 1, 1.2), (E4, 0.6, 1), (B4, 0.4, 0.9), (G3 * 2, 0.25, 0.8), (E5, 0.18, 0.6)], 5.0, 1.6, attack=0.006)
place(reverb(chord, hall, 0.55), h2, 0.13)

# VeoSeeBot letters rise: a soft rising breath; VSE AI ZDES and the credit line: quiet glass
d = 1.1
p = tv(d) / d
rise = sweep_lp(noise(d), 500 + 6500 * p ** 1.5) * np.sin(np.pi * p) ** 2
place(np.vstack([rise, np.roll(rise, 300)]), T["wordIn"], 0.1)
place(reverb(tone([(B5, 1, 1), (B5 * 2, 0.25, 0.5), (E6, 0.2, 0.6)], 1.8, 0.7), hall, 0.7), T["tagIn"], 0.05)
place(reverb(tone([(E5, 1, 1), (B5, 0.5, 0.9)], 2.2, 0.9), hall, 0.7), T["captionIn"], 0.04)

# light sweep across the logo: airy shimmer that travels left -> right
d = 1.5
p = tv(d) / d
sh = bp(noise(d), 5000, 13000) * np.sin(np.pi * p) ** 2
place(np.vstack([sh * np.cos(p * np.pi / 2), sh * np.sin(p * np.pi / 2)]) * 1.4, T["sweep"], 0.05)

# ---------------------------------------------------------------- 5. collapse into line -> point -> dark
d = DH - OUT
p = tv(d) / d
suck = sweep_lp(noise(d), 7000 * (1 - p) ** 1.5 + 250) * p ** 2.2
place(fade(np.vstack([suck, np.roll(suck, 500)]), 0.1, 0.004), OUT, 0.4)
place(reverb(layer((0.7, boom(80, 34, 2.0, 0.6)), (0.2, crack(0.08, 1200, 7000))), hall, 0.45), T["dotHit"], 0.75)
last = np.zeros((2, int(SR * 2.6)))
for n in range(3):
    rep = stereo(ping if n == 0 else lp(ping, 6000 * 0.6 ** n + 800), 0 if n == 0 else (0.6 if n % 2 else -0.6))
    i0 = int(round(n * T["echoInterval"] * SR))
    last[:, i0:i0 + rep.shape[1]] += 0.6 ** n * rep
place(reverb(last, hall, 0.6), T["dotHit"], 0.2)

# ---------------------------------------------------------------- master
out = hp(mix, 24, 2)
out /= np.max(np.abs(out))
out *= 1.35                                         # drive the loudest hits ~2.5 dB into the limiter

# peak limiter: instant attack (with 1.5 ms look-ahead), 120 ms release
look = int(0.0015 * SR)
peak = np.max(np.abs(out), axis=0)
peak = ndimage.maximum_filter1d(peak, size=2 * look + 1)
ceiling = 10 ** (-1.0 / 20)
target = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
gain = np.empty_like(target)
g = 1.0
rel = np.exp(-1 / (0.12 * SR))
for i in range(len(target)):
    g = target[i] if target[i] < g else target[i] + (g - target[i]) * rel
    gain[i] = g
out *= gain
out = np.clip(out, -ceiling, ceiling)
out = fade(out, 0.01, 0.5)

dither = (rng.random(out.shape) - rng.random(out.shape)) / 32768
pcm = np.clip(np.round((out + dither) * 32767), -32768, 32767).astype("<i2")
dst = HERE / "output" / "intro_audio.wav"
dst.parent.mkdir(exist_ok=True)
with wave.open(str(dst), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.T.tobytes())
rms = 20 * np.log10(np.sqrt(np.mean(out ** 2)) + 1e-12)
print(f"wrote {dst}  ({DUR:.2f}s, peak {20 * np.log10(np.max(np.abs(out))):.1f} dBFS, rms {rms:.1f} dBFS)")
