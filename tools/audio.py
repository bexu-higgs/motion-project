#!/usr/bin/env python3
"""Sound design: a UI sound on every cue (clicks, typing, highlights, scene
changes) and a quiet ambient music bed that ducks under the voice-over.

    python3 tools/audio.py        (after tools/prepare.mjs and render.mjs --sfx)

Reads build/sfx.json + build/voiceover.timed.wav, writes build/mix.wav
(48 kHz stereo, -16 LUFS). Every sound is synthesized here, so there are no
samples or tracks to license.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def t_(n):
    return np.arange(n) / SR


def decay(n, tau, attack=0.002):
    t = t_(n)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def sine(f, n, phase=0.0):
    return np.sin(2 * np.pi * f * t_(n) + phase)


def filt(x, kind, f, order=2):
    w = np.array(f, dtype=float) / (SR / 2)
    b, a = signal.butter(order, w, kind)
    return signal.lfilter(b, a, x)


def noise(n):
    return rng.standard_normal(n)


def peak(x, db):
    m = np.max(np.abs(x)) or 1
    return x / m * 10 ** (db / 20)


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ sound effects
def sfx_click():
    n = int(0.07 * SR)
    p = rng.uniform(0.95, 1.05)
    x = filt(noise(n), "high", 2500) * decay(n, 0.004) * 0.8
    x += sine(1650 * p, n) * decay(n, 0.012) * 0.6 + sine(310 * p, n) * decay(n, 0.022) * 0.7
    return peak(x, -17)


def sfx_key(space=False):
    n = int(0.035 * SR)
    x = filt(noise(n), "high", 3200) * decay(n, 0.003)
    x += sine(rng.uniform(2300, 2900) * (0.8 if space else 1), n) * decay(n, 0.006) * 0.35
    return peak(x, (-34 if space else -31) + rng.uniform(-2.5, 1.5))


def sfx_tick():
    n = int(0.12 * SR)
    x = sine(1250, n) * decay(n, 0.028) + sine(2500, n) * decay(n, 0.014) * 0.3
    return peak(x, -26)


def sfx_pop():
    n = int(0.2 * SR)
    t = t_(n)
    f = 380 + 520 * np.exp(-t / 0.045)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.06, 0.003)
    return peak(x, -21)


def sfx_check():
    n = int(0.55 * SR)
    x = np.zeros(n)
    for f, at in ((1318.5, 0.0), (1975.5, 0.075)):
        k = int(at * SR)
        m = n - k
        x[k:] += (sine(f, m) + 0.2 * sine(2 * f, m)) * decay(m, 0.16, 0.003)
    return peak(x, -22)


def sweep_noise(n, lo, hi, amp_peak=0.6):
    """Noise whose band moves up and back, with a swell envelope."""
    t = t_(n) / (n / SR)
    lowband = filt(noise(n), "band", (lo, lo * 3))
    highband = filt(noise(n), "band", (hi / 3, hi))
    mix = np.clip(np.sin(np.pi * t) ** 1.5, 0, 1)
    x = lowband * (1 - mix) + highband * mix
    env = np.where(t < amp_peak, (t / amp_peak) ** 2, ((1 - t) / (1 - amp_peak)) ** 1.6)
    return x * env


def stereo_pan(x, start=-0.6, end=0.6):
    p = np.linspace(start, end, len(x))
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], 1)


def sfx_whoosh():
    return peak(sweep_noise(int(0.7 * SR), 350, 6000), -23)


def sfx_sweep():
    return peak(sweep_noise(int(0.95 * SR), 250, 4200, 0.55), -27)


def sfx_rise():
    n = int(1.9 * SR)
    t = t_(n)
    swell = (t / t[-1]) ** 2
    x = sweep_noise(n, 300, 5000, 0.85) * 0.5
    for f in (440, 659.3, 880):
        x += sine(f, n) * swell * np.exp(-np.maximum(0, t - 1.5) / 0.25) * 0.25
    return peak(x, -22)


def sfx_chime():
    n = int(3.0 * SR)
    x = np.zeros(n)
    for f, g in ((880, 1), (1108.7, 0.7), (1318.5, 0.8), (1975.5, 0.35)):
        x += g * (sine(f, n) + 0.12 * sine(f * 2.76, n)) * decay(n, 1.1, 0.004)
    return peak(x, -19)


MAKERS = {
    "click": sfx_click, "key": sfx_key, "space": lambda: sfx_key(True), "tick": sfx_tick, "pop": sfx_pop,
    "check": sfx_check, "whoosh": sfx_whoosh, "sweep": sfx_sweep, "rise": sfx_rise, "chime": sfx_chime,
}
PANNED = {"whoosh": (-0.5, 0.5), "sweep": (0.5, -0.5), "rise": (-0.2, 0.2)}


def render_sfx(cues, n):
    out = np.zeros((n, 2))
    for c in cues:
        x = MAKERS[c["type"]]() * c.get("gain", 1.0)
        st = stereo_pan(x, *PANNED[c["type"]]) if c["type"] in PANNED else np.stack([x, x], 1) * 0.7071
        k = int(c["t"] * SR)
        if k < 0 or k >= n:
            continue
        m = min(len(st), n - k)
        out[k:k + m] += st[:m]
    return out


# ------------------------------------------------------------------ music
MUSIC_LUFS = -29.0  # bed level before ducking (the voice is at -16)
BPM = 68
BEAT = 60 / BPM
CHORD = 8 * BEAT  # two bars per chord
# Fmaj9 – Cmaj7 – Am9 – G6(add9): calm, unresolved, loops seamlessly
CHORDS = [(41, [57, 60, 64, 67]), (48, [52, 55, 59, 62]), (45, [60, 64, 67, 71]), (43, [59, 62, 64, 69])]


def pad_note(f, n):
    t = t_(n)
    voices = []
    for cents, pan in ((-7, -0.55), (0, 0.0), (7, 0.55)):
        ff = f * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi, 8)
        v = sum((1 / h ** 1.7) * np.sin(2 * np.pi * ff * h * t + ph[h - 1]) for h in range(1, 9))
        voices.append((v, pan))
    left = sum(v * np.sqrt((1 - p) / 2) for v, p in voices)
    right = sum(v * np.sqrt((1 + p) / 2) for v, p in voices)
    return np.stack([left, right], 1)


def pluck(f, n):
    x = (sine(f, n) + 0.25 * sine(2 * f, n) + 0.08 * sine(3 * f, n)) * decay(n, 0.55, 0.006)
    return x


def reverb(x, seconds=3.2, tau=0.95):
    n = int(seconds * SR)
    irs = []
    for _ in range(2):
        ir = filt(noise(n), "low", 5500) * np.exp(-t_(n) / tau)
        ir[: int(0.018 * SR)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack([signal.fftconvolve(x[:, ch], irs[ch])[: len(x)] for ch in range(2)], 1)


def music(n, arp_from, arp_to):
    pad = np.zeros((n, 2))
    sub = np.zeros(n)
    arp = np.zeros((n, 2))
    k = 0
    while k * CHORD < n / SR:
        bass, notes = CHORDS[k % len(CHORDS)]
        t0, xf = k * CHORD, 2.0
        a, b = int(max(0, t0 - xf / 2) * SR), int(min(n / SR, t0 + CHORD + xf / 2) * SR)
        m = b - a
        tt = t_(m)
        env = np.minimum(1, tt / xf) * np.minimum(1, (tt[-1] - tt) / xf)
        env = np.sin(env * np.pi / 2) ** 2
        seg = sum(pad_note(mtof(p), m) for p in notes) / len(notes)
        pad[a:b] += seg * env[:, None]
        sub[a:b] += (sine(mtof(bass), m) + 0.35 * sine(mtof(bass + 12), m)) * env
        # sparse plucks: one per beat, gently walking the chord upwards
        for beat in range(8):
            tb = t0 + beat * BEAT
            if not (arp_from <= tb <= arp_to) or beat in (3, 7):
                continue
            idx = (0, 2, 1, 3, 2, 3, 1, 0)[beat]
            f = mtof(notes[idx] + 12)
            m2 = int(1.8 * SR)
            s0 = int(tb * SR)
            if s0 + m2 > n:
                continue
            vel = rng.uniform(0.55, 0.9)
            pan = (-0.35, 0.35)[beat % 2]
            x = pluck(f, m2) * vel
            arp[s0:s0 + m2, 0] += x * np.sqrt((1 - pan) / 2)
            arp[s0:s0 + m2, 1] += x * np.sqrt((1 + pan) / 2)
        k += 1
    pad = np.stack([filt(pad[:, ch], "low", 2400) for ch in range(2)], 1)
    lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.06 * t_(n))
    pad *= lfo[:, None]
    sub = filt(sub, "low", 220)
    dry = pad * 0.9 + np.stack([sub, sub], 1) * 0.12 + arp * 0.32
    wet = reverb(pad * 0.5 + arp * 0.6)
    out = dry * 0.7 + wet * 0.55
    fade_in, fade_out = int(3.0 * SR), int(5.0 * SR)
    out[:fade_in] *= np.linspace(0, 1, fade_in)[:, None] ** 2
    out[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5
    return out


def duck_gain(voice, n, depth_db=-6.0):
    """Music gain that dips while the narrator speaks (10 ms frames, 40/450 ms)."""
    hop = int(0.01 * SR)
    frames = len(voice) // hop
    rms = np.sqrt(np.mean(voice[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    active = (rms > 10 ** (-42 / 20)).astype(float)
    g, out = 0.0, np.zeros(frames)
    up, down = np.exp(-0.01 / 0.04), np.exp(-0.01 / 0.45)
    for i, a in enumerate(active):
        g = a + (g - a) * (up if a > g else down)
        out[i] = g
    gain_db = depth_db * out
    gain = 10 ** (np.interp(np.arange(n) / hop, np.arange(frames), gain_db, right=0) / 20)
    return gain


# ------------------------------------------------------------------ loudness via ffmpeg
def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    j = r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1]
    return json.loads(j)


def write_wav(path, x):
    import wave
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1] if x.ndim == 2 else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def read_mono(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(float)


def main():
    build = ROOT / "build"
    cues = json.loads((build / "sfx.json").read_text())
    duration = cues["duration"]
    n = int(round(duration * SR))
    voice = read_mono(build / "voiceover.timed.wav")
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    timing = json.loads((build / "timing.json").read_text())
    scenes = {s["id"]: s for s in timing["scenes"]}

    # music: pad from the start, plucks from the Video section to just before the end card
    bed = music(n, scenes["video"]["start"], duration - 5.0)
    write_wav(build / "music.raw.wav", bed / (np.max(np.abs(bed)) or 1) * 0.5)
    lu = loudness(build / "music.raw.wav")
    bed = bed / (np.max(np.abs(bed)) or 1) * 0.5 * 10 ** ((MUSIC_LUFS - float(lu["input_i"])) / 20)
    bed *= duck_gain(voice, n)[:, None]

    fx = render_sfx(cues["cues"], n)
    mix = np.stack([voice, voice], 1) + bed + fx  # voice centred at its own level
    write_wav(build / "mix.pre.wav", mix * 0.5)  # headroom; loudness is set below

    m = loudness(build / "mix.pre.wav")
    if "--stems" in sys.argv:
        g = 0.5 * 10 ** ((-16 - float(m["input_i"])) / 20)
        for name, stem in (("voice", np.stack([voice, voice], 1)), ("music", bed), ("sfx", fx)):
            write_wav(build / f"stem_{name}.wav", stem * g)
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
          f"aresample={SR}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(build / "mix.pre.wav"), "-af", af, "-ac", "2",
                    str(build / "mix.wav")], check=True)
    for f in ("music.raw.wav", "mix.pre.wav"):
        (build / f).unlink()
    out = loudness(build / "mix.wav")
    print(f"build/mix.wav: {duration:.2f}s, {len(cues['cues'])} sound cues, "
          f"{out['input_i']} LUFS, true peak {out['input_tp']} dBTP")


if __name__ == "__main__":
    main()
