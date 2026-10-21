#!/usr/bin/env python3
"""Synthesises the soundtrack: slow ambient background music, interface sound
effects placed on the cues exported by the animation (build/cues.json), and a
soft technological room tone, then mixes them under the Kazakh voice-over.

Usage: python3 scripts/audio.py [--cues build/cues.json] [--vo assets/audio/voiceover.mp3] [--out build/mix.wav]
"""
import argparse
import json
import subprocess
import wave

import numpy as np
from scipy import signal

SR = 48000
VO_OFFSET = 0.6  # must match src/timeline.js
rng = np.random.default_rng(7)


# ----------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    if sustain_len is None:
        sustain_len = max(0, n - a - d - r)
    e = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.linspace(1, s, max(d, 1), endpoint=False),
        np.full(int(sustain_len), s),
        np.linspace(s, 0, max(r, 1)),
    ])
    out = np.zeros(n)
    m = min(n, len(e))
    out[:m] = e[:m]
    return out


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def sweep_bp(x, f_curve, q=1.2):
    """Time-varying state-variable band-pass (for whooshes)."""
    y = np.zeros_like(x)
    low = band = 0.0
    damp = 1.0 / q
    for i in range(len(x)):
        f = 2.0 * np.sin(np.pi * min(f_curve[i], SR / 6) / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def sine(freq, dur, phase=0.0):
    t = t_axis(dur)
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t + phase)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(ph + phase)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def pan(mono, p=0.0):
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def make_ir(dur=3.2, decay=1.1, lp_f=6000, seed=3):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / decay * 3.0)
    left = lp(r.standard_normal(n), lp_f) * env
    right = lp(r.standard_normal(n), lp_f) * env
    pre = int(0.012 * SR)
    left[:pre] = 0
    right[:pre] = 0
    ir = np.stack([left, right], 1)
    return ir / np.sqrt((ir ** 2).sum())


def reverb(stereo, ir, wet=0.3):
    out = np.zeros((len(stereo) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(stereo[:, c], ir[:, c])
    out = out[: len(stereo)]
    return stereo * (1 - wet) + out * wet * 2.2


# ----------------------------------------------------------------- music
CHORDS = [
    [38, 50, 57, 62, 64, 65, 69],  # Dm9
    [34, 46, 53, 57, 62, 65, 69],  # Bbmaj7(add9-ish)
    [41, 48, 57, 60, 64, 67, 72],  # Fmaj7
    [36, 48, 55, 62, 64, 67, 71],  # Cadd9 / Cmaj7
]


def pad_voice(freq, dur, bright=1.0, seed=0):
    t = t_axis(dur)
    r = np.random.default_rng(seed)
    out = np.zeros_like(t)
    for det in (-0.07, 0.0, 0.06):  # semitone detune
        f = freq * 2 ** (det / 12)
        ph = r.uniform(0, 2 * np.pi)
        for k in range(1, 9):
            if f * k > 5000:
                break
            out += np.sin(2 * np.pi * f * k * t + ph * k) / (k ** (1.55 - 0.25 * bright))
    vib = 1 + 0.004 * np.sin(2 * np.pi * 0.23 * t + seed)
    return out * vib / 3.0


def music(total):
    n = int(total * SR)
    mix = np.zeros((n, 2))
    bar = 60 / 72 * 4
    chord_len = bar * 2
    ir = make_ir(4.5, 2.0, 5000, seed=11)

    # pads + sub bass, one chord every two bars with long crossfades
    pads = np.zeros((n, 2))
    k = 0
    t0 = -0.5
    while t0 < total:
        ch = CHORDS[k % 4]
        dur = chord_len + 3.0
        seg = np.zeros((int(dur * SR), 2))
        for j, m in enumerate(ch[1:]):
            v = pad_voice(midi(m), dur, bright=0.8, seed=k * 10 + j)
            seg += pan(v * (0.11 if m < 60 else 0.08), -0.6 + 1.2 * j / (len(ch) - 2))
        e = env_adsr(len(seg), 2.2, 0.5, 0.85, 2.6)
        seg *= e[:, None]
        sub = sine(midi(ch[0]), dur) * 0.22 + sine(midi(ch[0] + 12), dur) * 0.05
        seg += pan(sub * env_adsr(len(seg), 1.5, 0.5, 0.9, 2.5), 0)
        a = int(max(t0, 0) * SR)
        b0 = int(max(-t0, 0) * SR)
        m_ = min(n - a, len(seg) - b0)
        if m_ > 0:
            pads[a:a + m_] += seg[b0:b0 + m_]
        t0 += chord_len
        k += 1
    for c in range(2):
        pads[:, c] = lp(pads[:, c], 1900)

    # gentle bell arpeggio from scene 2 onward
    arp = np.zeros((n, 2))
    step = 60 / 72 / 2
    tt = 6.6
    i = 0
    r = np.random.default_rng(5)
    while tt < total - 3:
        ci = int((tt + 0.5) // chord_len) % 4
        tones = [m + 12 for m in CHORDS[ci][2:]]
        if r.random() < (0.55 if tt < 61 else 0.7):
            note = tones[(i * 3 + r.integers(0, 2)) % len(tones)]
            f = midi(note)
            d = 2.4
            x = (sine(f, d) + 0.25 * sine(2 * f, d) + 0.08 * sine(3.01 * f, d)) * expdecay(int(d * SR), 0.55)
            x *= env_adsr(len(x), 0.004, 0.1, 1, 0.3)
            vel = 0.05 + 0.03 * r.random()
            a = int(tt * SR)
            m_ = min(n - a, len(x))
            arp[a:a + m_] += pan(x[:m_] * vel, r.uniform(-0.7, 0.7))
        tt += step
        i += 1
    # dotted-eighth echo on the arp
    dly = int(step * 1.5 * SR)
    echo = np.zeros_like(arp)
    echo[dly:] += arp[:-dly, ::-1] * 0.35
    echo[2 * dly:] += arp[:-2 * dly] * 0.15
    arp = arp + echo

    # airy noise bed
    air = lp(hp(noise(total), 3000), 9000) * 0.006
    air *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t_axis(total))
    mix = pads + arp + pan(air, 0)
    mix = reverb(mix, ir, wet=0.35)

    # arrangement envelope: fade in, small lift for the practice scene, outro
    t = t_axis(total)
    arr = np.interp(t, [0, 3.5, 60.5, 62, 74.5, 76, total - 3.2, total - 0.3, total],
                    [0, 0.75, 0.75, 0.9, 0.9, 1.0, 1.0, 0.0, 0.0])
    return mix * arr[:, None]


# ----------------------------------------------------------------- SFX
def sfx_whoosh(dur=0.9, gain=0.5, lo=250, hi=3200, soft=False):
    n = int(dur * SR)
    x = noise(dur)
    k = np.linspace(0, 1, n)
    curve = lo + (hi - lo) * np.sin(np.pi * np.clip(k * 1.1, 0, 1)) ** 1.5
    q = 0.9 if not soft else 0.7
    y = sweep_bp(sweep_bp(x, curve, q), curve, q)
    y = lp(y, min(hi * 1.8, 7000), order=4)
    e = np.sin(np.pi * k ** 0.75) ** 2
    y = y * e
    y = y / (np.sqrt(np.mean(y ** 2)) * 4 + 1e-9)
    st = np.stack([y * np.linspace(1, 0.5, n), y * np.linspace(0.5, 1, n)], 1)
    return st * gain


def sfx_boom(gain=0.8):
    d = 3.0
    n = int(d * SR)
    f = 58 * np.exp(-np.arange(n) / SR * 1.2) + 32
    body = sine(f, d) * expdecay(n, 0.9)
    thump = lp(noise(d), 180) * expdecay(n, 0.08) * 2
    air = hp(noise(d), 2000) * expdecay(n, 0.25) * 0.08
    y = body + thump + air
    return pan(y / np.abs(y).max(), 0) * gain


def sfx_hit(gain=0.6):
    d = 1.6
    n = int(d * SR)
    f = 90 * np.exp(-np.arange(n) / SR * 18) + 48
    y = sine(f, d) * expdecay(n, 0.35)
    y += hp(noise(d), 3000) * expdecay(n, 0.03) * 0.5
    y += (sine(1318.5, d) * 0.15 + sine(1975, d) * 0.08) * expdecay(n, 0.5)
    return pan(y / np.abs(y).max(), 0) * gain


def sfx_scan(dur=1.0, gain=0.4):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    f = 1800 + 3200 * k
    y = sine(f, dur) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * t_axis(dur)))
    y = y * 0.3 + bp(noise(dur), 3000, 9000) * 0.25
    y *= np.sin(np.pi * k) ** 1.2
    return pan(y, 0) * gain


def sfx_blip(pitch=1.0, gain=0.4):
    d = 0.35
    n = int(d * SR)
    f0 = 880 * pitch
    y = (sine(f0, d) + 0.3 * sine(2 * f0, d)) * expdecay(n, 0.06)
    y *= env_adsr(n, 0.002, 0.05, 1, 0.05)
    return pan(y, 0.15) * gain


def sfx_pop(pitch=1.0, gain=0.4):
    d = 0.25
    n = int(d * SR)
    f = 620 * pitch * (1 + 0.7 * np.exp(-np.arange(n) / SR * 40))
    y = sine(f, d) * expdecay(n, 0.045)
    return pan(y, rng.uniform(-0.4, 0.4)) * gain


def sfx_tick(pitch=1.0, gain=0.3):
    d = 0.06
    n = int(d * SR)
    y = hp(noise(d), 3500) * expdecay(n, 0.004) + sine(3800 * pitch, d) * expdecay(n, 0.01) * 0.4
    return pan(y, rng.uniform(-0.3, 0.3)) * gain


def sfx_click(gain=0.6):
    d = 0.2
    n = int(d * SR)
    y = np.zeros(n)
    for off, a in ((0, 1.0), (0.07, 0.6)):
        i = int(off * SR)
        b = bp(noise(0.03), 1800, 6000) * expdecay(int(0.03 * SR), 0.004)
        y[i:i + len(b)] += b * a
    y += sine(2400, d) * expdecay(n, 0.008) * 0.3
    return pan(y / np.abs(y).max(), 0.1) * gain


def sfx_lift(gain=0.4):
    w = sfx_whoosh(0.4, 1.0, 800, 4000, soft=True)
    d = 0.4
    tone = sine(np.linspace(500, 900, int(d * SR)), d) * np.sin(np.pi * np.linspace(0, 1, int(d * SR))) * 0.25
    return (w + pan(tone, 0)) * gain


def sfx_drop(gain=0.7):
    d = 0.8
    n = int(d * SR)
    f = 150 * np.exp(-np.arange(n) / SR * 14) + 55
    y = sine(f, d) * expdecay(n, 0.12)
    y += bp(noise(d), 1500, 5000) * expdecay(n, 0.01) * 0.6
    y += (sine(1760, d) * 0.12 + sine(2637, d) * 0.06) * expdecay(n, 0.25)
    return pan(y / np.abs(y).max(), 0) * gain


def sfx_typing(dur=2.0, gain=0.4):
    n = int((dur + 0.2) * SR)
    y = np.zeros(n)
    t = 0.0
    r = np.random.default_rng(21)
    while t < dur:
        kd = 0.025
        b = bp(noise(kd), 1200 + r.random() * 1500, 6000) * expdecay(int(kd * SR), 0.0035)
        b += lp(noise(kd), 400) * expdecay(int(kd * SR), 0.006) * 0.5
        i = int(t * SR)
        y[i:i + len(b)] += b * (0.5 + 0.5 * r.random())
        t += 0.055 + r.random() * 0.06 + (0.12 if r.random() < 0.12 else 0)
    return pan(y / (np.abs(y).max() + 1e-9), -0.1) * gain


def sfx_process(dur=1.0, gain=0.5):
    n = int((dur + 0.3) * SR)
    y = np.zeros(n)
    r = np.random.default_rng(31)
    scale = [0, 3, 5, 7, 10, 12, 15, 17]
    t = 0.0
    while t < dur:
        f = midi(84 + scale[r.integers(0, len(scale))])
        g = sine(f, 0.05) * expdecay(int(0.05 * SR), 0.012)
        i = int(t * SR)
        y[i:i + len(g)] += g * (0.2 + 0.3 * (t / dur))
        t += 0.035 + r.random() * 0.03
    k = np.linspace(0, 1, int(dur * SR))
    riser = bp(noise(dur), 800, 6000) * k ** 2 * 0.25
    hum = (sine(110, dur) * 0.2 + sine(220.5, dur) * 0.1) * np.sin(np.pi * k) * 0.6
    y[: len(k)] += riser + hum
    return pan(y / (np.abs(y).max() + 1e-9), 0) * gain


def sfx_success(gain=0.5, pitch=1.0):
    d = 2.0
    n = int(d * SR)
    y = np.zeros(n)
    for off, m in ((0, 76), (0.09, 83), (0.18, 88)):
        f = midi(m) * pitch
        i = int(off * SR)
        x = (sine(f, d - off) + 0.2 * sine(2 * f, d - off) + 0.05 * sine(3.0 * f, d - off)) * expdecay(n - i, 0.45)
        y[i:] += x[: n - i] * (1 if off == 0 else 0.8)
    return pan(y / np.abs(y).max(), 0.1) * gain


def sfx_shimmer(dur=1.2, gain=0.3):
    n = int((dur + 0.8) * SR)
    y = np.zeros((n, 2))
    r = np.random.default_rng(41)
    t = 0.0
    while t < dur:
        f = r.uniform(3000, 8500)
        g = sine(f, 0.4) * expdecay(int(0.4 * SR), 0.06) * np.sin(np.pi * min(1, t / dur)) ** 0.7
        i = int(t * SR)
        y[i:i + len(g)] += pan(g * 0.4, r.uniform(-0.9, 0.9))
        t += 0.012 + r.random() * 0.025
    return y * gain


def sfx_play(gain=0.5):
    a = sfx_blip(0.9, 1.0)
    b = sfx_blip(1.35, 1.0)
    out = np.zeros((len(a) + int(0.08 * SR), 2))
    out[: len(a)] += a
    out[int(0.08 * SR):] += b
    return out * gain


def sfx_thud(gain=0.3):
    d = 0.5
    n = int(d * SR)
    y = sine(70 * np.exp(-np.arange(n) / SR * 10) + 40, d) * expdecay(n, 0.09) + lp(noise(d), 300) * expdecay(n, 0.03)
    return pan(y / np.abs(y).max(), 0) * gain


def sfx_morph(gain=0.4):
    d = 0.9
    n = int(d * SR)
    f = np.linspace(660, 990, n)
    y = (sine(f, d) + 0.3 * sine(f * 1.5, d)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return pan(y * 0.5, 0) * gain


def sfx_upload(dur=0.9, gain=0.35):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    y = sine(400 + 800 * k ** 1.5, dur) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * t_axis(dur))) * np.sin(np.pi * k) ** 0.8
    return pan(y * 0.4, 0) * gain


def sfx_reveal(gain=0.6):
    w = sfx_whoosh(1.0, 0.7, 300, 2500)
    s = sfx_shimmer(1.0, 0.6)
    d = 2.0
    n = int(d * SR)
    swell = sine(midi(50), d) * 0.2 * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    out = np.zeros((max(len(w), len(s), n), 2))
    out[: len(w)] += w
    out[: len(s)] += s
    out[:n] += pan(swell, 0)
    return out * gain


def sfx_outro(gain=0.7):
    d = 3.5
    n = int(d * SR)
    k = np.linspace(0, 1, n)
    rise = bp(noise(d), 2000, 9000) * np.clip(k * 2.5, 0, 1) ** 3 * np.exp(-np.clip(k - 0.4, 0, 1) * 8) * 0.25
    y = np.zeros(n)
    for m in (62, 69, 74, 76, 81):
        f = midi(m)
        i = int(0.9 * SR)
        x = (sine(f, d - 0.9) + 0.2 * sine(2 * f, d - 0.9)) * expdecay(n - i, 0.9)
        y[i:] += x * 0.2
    y += rise
    return pan(y / np.abs(y).max(), 0) * gain


SFX = {
    'whoosh': lambda c: sfx_whoosh(c.get('dur', 0.9), 1.0),
    'whooshSoft': lambda c: sfx_whoosh(0.7, 1.0, 200, 1800, soft=True),
    'swish': lambda c: sfx_whoosh(0.45, 1.0, 900, 5000, soft=True),
    'wipe': lambda c: sfx_whoosh(0.6, 1.0, 600, 3600, soft=True),
    'boom': lambda c: sfx_boom(1.0),
    'hit': lambda c: sfx_hit(1.0),
    'scan': lambda c: sfx_scan(c.get('dur', 1.0), 1.0),
    'blip': lambda c: sfx_blip(c.get('pitch', 1.0), 1.0),
    'pop': lambda c: sfx_pop(c.get('pitch', 1.0), 1.0),
    'tick': lambda c: sfx_tick(c.get('pitch', 1.0), 1.0),
    'click': lambda c: sfx_click(1.0),
    'lift': lambda c: sfx_lift(1.0),
    'drop': lambda c: sfx_drop(1.0),
    'typing': lambda c: sfx_typing(c.get('dur', 2.0), 1.0),
    'process': lambda c: sfx_process(c.get('dur', 1.0), 1.0),
    'success': lambda c: sfx_success(1.0, c.get('pitch', 1.0)),
    'shimmer': lambda c: sfx_shimmer(c.get('dur', 1.2), 1.0),
    'play': lambda c: sfx_play(1.0),
    'thud': lambda c: sfx_thud(1.0),
    'morph': lambda c: sfx_morph(1.0),
    'upload': lambda c: sfx_upload(c.get('dur', 0.9), 1.0),
    'reveal': lambda c: sfx_reveal(1.0),
    'outro': lambda c: sfx_outro(1.0),
}


def sfx_track(cues, total):
    n = int(total * SR)
    out = np.zeros((n + 5 * SR, 2))
    for c in cues:
        fn = SFX.get(c['type'])
        if not fn:
            print('unknown cue', c['type'])
            continue
        x = fn(c) * c.get('gain', 0.5)
        i = int(max(0, c['t']) * SR)
        out[i:i + len(x)] += x
    for c in range(2):
        out[:, c] = lp(out[:, c], 13000, order=4)
    ir = make_ir(1.8, 0.6, 7000, seed=5)
    out = reverb(out, ir, wet=0.18)
    return out[:n]


def ambience(total):
    t = t_axis(total)
    room = lp(hp(noise(total), 60), 420) * 0.02
    room *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t)
    hum = (sine(55, total) * 0.004 + sine(110, total) * 0.0025) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.11 * t))
    hiss = lp(hp(noise(total), 5000), 12000) * 0.0025
    a = np.stack([room + hum + hiss, lp(hp(noise(total), 60), 420) * 0.02 + hum + hiss], 1)
    fade = np.interp(t, [0, 1.0, total - 2.0, total], [0, 1, 1, 0])
    return a * fade[:, None]


# ----------------------------------------------------------------- mix
def load_vo(path, total):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    out = np.zeros(int(total * SR))
    i = int(VO_OFFSET * SR)
    m = min(len(out) - i, len(vo))
    out[i:i + m] = vo[:m]
    return out


def follower(x, attack=0.02, release=0.45):
    """Envelope follower (one-pole, separate attack/release) on a decimated signal."""
    dec = 48
    a = np.abs(x[::dec])
    ka = np.exp(-1 / (attack * SR / dec))
    kr = np.exp(-1 / (release * SR / dec))
    e = np.zeros_like(a)
    v = 0.0
    for i, s in enumerate(a):
        k = ka if s > v else kr
        v = k * v + (1 - k) * s
        e[i] = v
    return np.repeat(e, dec)[: len(x)]


def write_wav(path, stereo):
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cues', default='build/cues.json')
    ap.add_argument('--vo', default='assets/audio/voiceover.mp3')
    ap.add_argument('--out', default='build/mix.wav')
    a = ap.parse_args()
    data = json.load(open(a.cues))
    total = data['duration']

    vo = load_vo(a.vo, total)
    vo = vo / (np.abs(vo).max() + 1e-9) * 0.89
    print('music…')
    mus = music(total)
    mus = mus / (np.abs(mus).max() + 1e-9)
    print('sfx…', len(data['cues']), 'cues')
    fx = sfx_track(data['cues'], total)
    amb = ambience(total)

    # duck music and ambience under the narration
    env = follower(vo)
    duck = 1 - 0.5 * np.clip(env / 0.08, 0, 1)
    mix = np.stack([vo, vo], 1)
    mix += mus * 0.19 * duck[:, None]
    mix += amb * (0.85 + 0.15 * duck[:, None])
    mix += fx * 0.42 * (1 - 0.25 * np.clip(env / 0.08, 0, 1))[:, None]
    peak = np.abs(mix).max()
    if peak > 0.89:  # keep ~1 dB of headroom for the AAC encoder
        mix *= 0.89 / peak
    write_wav(a.out, mix)
    # stems for inspection
    write_wav(a.out.replace('.wav', '_music.wav'), mus * 0.5)
    write_wav(a.out.replace('.wav', '_sfx.wav'), np.clip(fx * 0.6, -1, 1))
    print('wrote', a.out)


if __name__ == '__main__':
    main()
