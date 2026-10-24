"""Sound: the result clip's own audio (frame-aligned with both clips) + light synthesized SFX.

The SFX hits are placed from the timeline constants in render.py so picture and sound stay in step.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

import render as R

SR = 48000
ROOT = Path(__file__).resolve().parent.parent


def _env(n, attack, release):
    e = np.ones(n, np.float32)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a) ** 2
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def swept_noise(dur, f0, f1, q=0.6, seed=0):
    """Noise through a band-pass whose centre glides f0 -> f1 (STFT overlap-add)."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = rng.normal(0, 1, n + 2048).astype(np.float32)
    win, hop = 2048, 512
    out = np.zeros_like(x)
    w = np.hanning(win).astype(np.float32)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / max(n - 1, 1))
        band = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / fc) / q) ** 2)
        seg = np.fft.irfft(np.fft.rfft(x[i:i + win] * w) * band)
        out[i:i + win] += seg * w
    out = out[:n]
    return out / (np.abs(out).max() + 1e-9)


def whoosh(dur, f0=300, f1=3000, peak=0.6, seed=0):
    y = swept_noise(dur, f0, f1, seed=seed)
    t = np.linspace(0, 1, len(y))
    shape = np.sin(np.pi * np.clip(t / peak, 0, 1) * 0.5) ** 2 * np.clip((1 - t) / (1 - peak), 0, 1) ** 1.5
    return y * shape


def riser(dur, seed=1):
    y = swept_noise(dur, 250, 7000, q=0.45, seed=seed)
    t = np.linspace(0, 1, len(y))
    return y * t ** 2.2 * _env(len(y), 0, 0.03)


def boom(dur=1.4, f0=120, f1=40):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 3.2)
    y += 0.25 * swept_noise(dur, 180, 60, seed=5) * np.exp(-t * 18)
    return np.tanh(y * 1.6) / np.tanh(1.6)


def shimmer(dur=1.2, base=1318.5, seed=2):
    t = np.arange(int(dur * SR)) / SR
    y = np.zeros_like(t)
    rng = np.random.default_rng(seed)
    for k, mult in enumerate((1, 1.5, 2, 3)):
        y += np.sin(2 * np.pi * base * mult * t + rng.uniform(0, 6)) * np.exp(-t * (3 + k * 1.5)) / (k + 1)
    return y * _env(len(t), 0.004, 0.05) * 0.5


def click(seed):
    y = swept_noise(0.03, 3500, 2500, q=0.8, seed=seed)
    return y * np.exp(-np.arange(len(y)) / SR * 220)


def pad(dur, notes=(110.0, 164.81, 220.0, 246.94, 329.63)):
    t = np.arange(int(dur * SR)) / SR
    y = np.zeros_like(t)
    for i, f in enumerate(notes):
        for det in (-0.6, 0.6):
            y += np.sin(2 * np.pi * (f + det) * t + i) / (1 + i * 0.6)
    y *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)
    return y / np.abs(y).max() * _env(len(t), 1.2, 1.5)


def build_sfx(total):
    mix = np.zeros((int(total * SR) + SR, 2), np.float32)

    def add(sig, t0, gain, pan=0.0):
        gain *= 0.5  # keep hits well under the clip's own sound
        i = int(t0 * SR)
        sig = np.asarray(sig, np.float32)[: len(mix) - i]
        mix[i:i + len(sig), 0] += sig * gain * (1 - max(pan, 0))
        mix[i:i + len(sig), 1] += sig * gain * (1 + min(pan, 0))

    # intro bed
    add(pad(R.STORY0 + 7.5), 0.0, 0.16)  # carries the quiet first seconds of the clip
    # Claude spark
    add(boom(), 0.32, 0.55)
    add(shimmer(base=1318.5), 0.28, 0.16, pan=-0.2)
    # typing "> claude code"
    for i in range(13):
        add(click(10 + i), 1.05 + i * 0.55 / 13, 0.10, pan=np.sin(i) * 0.3)
    # ×, Blender
    add(shimmer(0.5, base=1975.5, seed=4), 1.18, 0.08)
    add(boom(1.2, 110, 42), 1.45, 0.5)
    add(shimmer(base=1760.0, seed=3), 1.42, 0.14, pan=0.2)
    # morph + card
    add(whoosh(1.0, 250, 2600, peak=0.55, seed=6), R.T_MORPH[0] - 0.05, 0.35)
    # Higgsfield joins
    add(boom(1.0, 140, 50), R.T_HIGGS + 0.15, 0.45)
    add(shimmer(base=2093.0, seed=7), R.T_HIGGS + 0.12, 0.15)
    # wipe riser -> expand whoosh -> landing
    add(riser(R.T_WIPE[1] - R.T_WIPE[0] + 0.2, seed=8), R.T_WIPE[0], 0.22)
    add(whoosh(1.1, 3000, 300, peak=0.6, seed=9), R.T_EXPAND[0], 0.32)
    add(boom(1.6, 90, 35), R.T_EXPAND[1] - 0.05, 0.45)
    # outro
    add(pad(R.DURATION - R.T_OUTRO + 0.5), R.T_OUTRO, 0.16)
    add(whoosh(1.2, 400, 4000, peak=0.7, seed=11), R.T_OUTRO - 0.1, 0.3)
    add(boom(1.6, 110, 38), R.T_OUTRO + 0.6, 0.5)
    add(shimmer(1.6, base=1318.5, seed=12), R.T_OUTRO + 1.1, 0.16)
    return mix


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype("<i2").tobytes())


def mux(video, out, start=0.0, end=None):
    end = R.DURATION if end is None else end
    tmp = ROOT / "out" / "segments"
    sfx = tmp / "sfx.wav"
    write_wav(sfx, build_sfx(R.DURATION))
    res = ROOT / "assets/video/result_genjutsu.mp4"
    delay = int(R.STORY0 * 1000)
    fade_at = R.STORY0 + 29.4
    graph = (f"[1:a]aresample={SR},volume=2.0,afade=t=out:st={fade_at - R.STORY0}:d=0.6,"
             f"adelay={delay}|{delay},apad[r];"
             f"[2:a]aresample={SR}[s];"
             f"[r][s]amix=inputs=2:duration=shortest:normalize=0,"
             f"atrim={start}:{end},asetpts=PTS-STARTPTS")
    # static gain to ~-14 LUFS (Instagram-friendly) + peak limiter; avoids loudnorm's dynamic pumping
    measure = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(video), "-i", str(res), "-i", str(sfx),
         "-filter_complex", graph + ",ebur128", "-vn", "-f", "null", "-"],
        capture_output=True, text=True, check=True).stderr
    summary = measure[measure.rindex("Summary:"):]
    loud = float(summary.split("I:")[1].split("LUFS")[0])
    gain = -14.0 - loud
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(res), "-i", str(sfx),
         "-filter_complex", graph + f",volume={gain:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=false,"
         f"aresample={SR}[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-shortest", "-movflags", "+faststart", str(out)], check=True)
