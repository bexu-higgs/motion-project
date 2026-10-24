"""Sound: the result clip's own audio (frame-aligned with both clips) + synthesized sound design.

Sound design is a small D-major palette: FM plucks on the logo hits, terminal blips for the typing,
reverse swells into transitions, a glitch stutter for Higgsfield, a panning sweep that follows the
wipe line, and a soft pad bed that hands over to the clip's own sound once the result takes over.
Hits are placed from the timeline constants in render.py so picture and sound stay in step.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

import render as R

SR = 48000
ROOT = Path(__file__).resolve().parent.parent

# note frequencies
D3, A3, B3, D4, E4, Fs4, Gs4, A4, B4, Cs5, D5, E5, Fs5, B5 = (
    146.83, 220.0, 246.94, 293.66, 329.63, 369.99, 415.30, 440.0, 493.88, 554.37, 587.33, 659.25,
    739.99, 987.77)
HIGH = (1174.66, 1318.51, 1479.98, 1760.0, 1975.53)  # D6 pentatonic, for blips


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def _fade(x, attack=0.0, release=0.0):
    x = x.copy()
    a, r = int(attack * SR), int(release * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a) ** 2
    if r:
        x[-r:] *= np.linspace(1, 0, r) ** 2
    return x


def _lowpass(x, fc):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(spec / (1 + (f / fc) ** 4), len(x))


def noise_sweep(dur, f0, f1, q=0.5, seed=0):
    """Noise through a band-pass gliding f0 -> f1 (STFT overlap-add)."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    win, hop = 2048, 512
    x = rng.normal(0, 1, n + win)
    out = np.zeros_like(x)
    w = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / max(n - 1, 1))
        band = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / fc) / q) ** 2)
        out[i:i + win] += np.fft.irfft(np.fft.rfft(x[i:i + win] * w) * band) * w
    out = out[:n]
    return out / (np.abs(out).max() + 1e-9)


# ------------------------------------------------------------------ voices ----
def pluck(f, dur=1.8, index=2.4, ratio=2.0, decay=3.2):
    """Two slightly detuned FM voices: glassy, modern pluck."""
    t = _t(dur)
    env = np.exp(-t * decay) * (1 - np.exp(-t * 900))
    idx = index * np.exp(-t * 6)
    y = 0
    for det in (1.0, 1.0035):
        ff = f * det
        y = y + np.sin(2 * np.pi * ff * t + idx * np.sin(2 * np.pi * ff * ratio * t))
    return y * 0.5 * env


def chord(freqs, strum=0.024, **kw):
    voices = [pluck(f, **kw) for f in freqs]
    n = max(len(v) for v in voices) + int(strum * SR * len(freqs))
    out = np.zeros(n)
    for i, v in enumerate(voices):
        o = int(i * strum * SR)
        out[o:o + len(v)] += v / (1 + 0.15 * i)
    return out / len(freqs) ** 0.5


def sub(dur=0.8, f0=64, f1=38):
    t = _t(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 14)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)
    return np.tanh(1.4 * y) / np.tanh(1.4)


def blip(f, dur=0.09):
    t = _t(dur)
    ph = 2 * np.pi * np.cumsum(f * (1 - 0.06 * t / dur)) / SR
    return np.sin(ph) * np.exp(-t * 55) * (1 - np.exp(-t * 3000))


def swell(dur, seed=0):
    """Reverse-cymbal style rise that stops dead on the hit."""
    y = noise_sweep(dur, 500, 9000, q=0.7, seed=seed)
    t = np.linspace(0, 1, len(y))
    return y * t ** 3


def swish(dur=0.35, seed=1):
    y = noise_sweep(dur, 7000, 700, q=0.45, seed=seed)
    t = np.linspace(0, 1, len(y))
    return y * np.sin(np.pi * t) ** 2


def glitch(src, seed=0):
    """Stutter the head of a sound with shrinking repeats, alternating bit-crushed slices."""
    rng = np.random.default_rng(seed)
    out = []
    for i, ms in enumerate((60, 60, 45, 45, 32, 32, 24, 24, 18, 18, 14, 14)):
        n = int(ms / 1000 * SR)
        g = src[:n].copy() * np.hanning(n) ** 0.25
        if i % 2:
            hold = 6
            g = np.repeat(g[::hold], hold)[:n]
            g = np.round(g * 12) / 12
        out.append(g * (0.85 if i % 2 else 1.0) * rng.uniform(0.85, 1.0))
    return np.concatenate(out)


def sweep_tone(dur, f0=220, f1=1800):
    """Rising FM tone with growing vibrato; follows the wipe line."""
    t = _t(dur)
    x = t / dur
    f = f0 * (f1 / f0) ** (x ** 1.3)
    f = f * (1 + 0.012 * x * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph + 0.8 * x * np.sin(2 * ph))
    air = noise_sweep(dur, 800, 9000, q=0.6, seed=9) * 0.35
    return (y * 0.6 + air) * x ** 1.6 * _fade(np.ones_like(t), 0.02, 0.04)


def pad(dur, freqs, bright=1.0):
    t = _t(dur)
    y = np.zeros_like(t)
    for i, f in enumerate(freqs):
        for det in (-0.5, 0.0, 0.5):
            for h in range(1, 5):
                y += np.sin(2 * np.pi * (f + det) * h * t + i + h) / (h ** (2.4 - 0.6 * bright)) / 3
    y *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.2 * t)
    y = _lowpass(y, 1800 * bright)
    return y / np.abs(y).max()


def reverb(x, seconds=2.6, tau=0.55, seed=3):
    """Stereo FFT convolution with a darkened, decorrelated noise tail."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((len(x) + n, 2))
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-t / tau)
        ir = _lowpass(ir, 5500) * (1 - np.exp(-t * 200))
        ir /= np.sqrt((ir ** 2).sum())
        m = 1 << int(np.ceil(np.log2(len(x) + n)))
        out[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch], m) * np.fft.rfft(ir, m), m)[:len(x) + n]
    return out


# ------------------------------------------------------------------- score ----
def build_sfx(total):
    n = int(total * SR) + 3 * SR
    dry = np.zeros((n, 2))
    send = np.zeros((n, 2))

    def add(sig, t0, gain, pan=0.0, verb=0.25):
        i = int(t0 * SR)
        sig = np.asarray(sig)[: n - i] * gain
        if np.ndim(pan) == 0:
            pan = np.full(len(sig), pan)
        else:
            pan = np.interp(np.linspace(0, 1, len(sig)), np.linspace(0, 1, len(pan)), pan)
        lr = np.stack([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
        dry[i:i + len(sig)] += sig[:, None] * lr
        send[i:i + len(sig)] += sig[:, None] * lr * verb

    # Claude: swell -> pluck chord + sub
    add(swell(0.34, seed=1), 0.0, 0.18, verb=0.4)
    add(chord((D4, Fs4, A4, Cs5)), 0.32, 0.30, pan=-0.15, verb=0.6)
    add(sub(), 0.32, 0.42, verb=0.0)
    # typing "> claude code": terminal blips
    rng = np.random.default_rng(4)
    for i in range(13):
        add(blip(rng.choice(HIGH)), 1.05 + i * 0.55 / 13, 0.06, pan=0.35 * np.sin(i * 1.7), verb=0.3)
    # × and Blender
    add(blip(2349.3, 0.12), 1.18, 0.07, verb=0.5)
    add(chord((B3, Fs4, A4, Cs5, Fs5)), 1.45, 0.28, pan=0.15, verb=0.6)
    add(sub(0.8, 58, 36), 1.45, 0.38, verb=0.0)
    # bed under the intro and blockout; hands over to the clip's sound after the wipe
    add(_fade(pad(R.T_HIGGS + 0.4, (D3, A3, E4, Fs4, Cs5), bright=0.8), 1.6, 0.8), 0.3, 0.055, verb=0.5)
    # morph -> card
    add(swell(0.45, seed=2), R.T_MORPH[0], 0.14, verb=0.4)
    add(swish(0.4), R.T_MORPH[0] + 0.4, 0.16, pan=np.array([0.6, -0.6]), verb=0.3)
    add(pluck(D5, 1.2, index=1.4), R.T_CARD[0] + 0.2, 0.14, verb=0.7)
    add(sub(0.6, 54, 38), R.T_CARD[0] + 0.2, 0.22, verb=0.0)
    # Higgsfield: glitch stutter, then a brighter chord on a new root
    add(glitch(chord((E5, B5), strum=0.0, index=3.0), seed=5), R.T_HIGGS, 0.20, verb=0.3)
    add(chord((E4, Gs4, B4, Fs5)), R.T_HIGGS + 0.2, 0.28, verb=0.6)
    add(sub(0.8, 66, 40), R.T_HIGGS + 0.2, 0.40, verb=0.0)
    add(_fade(pad(R.T_WIPE[1] - R.T_HIGGS + 0.6, (E4, Gs4, B4, Fs5), bright=1.0), 0.5, 0.9),
        R.T_HIGGS + 0.2, 0.05, verb=0.5)
    # wipe: rising tone that pans with the line, airy tail as the real world takes over
    wdur = R.T_WIPE[1] - R.T_WIPE[0]
    add(sweep_tone(wdur), R.T_WIPE[0], 0.14, pan=np.linspace(-0.8, 0.8, 50), verb=0.5)
    add(pluck(B5, 2.4, index=1.0, decay=1.6), R.T_WIPE[1] - 0.02, 0.10, pan=0.6, verb=0.9)
    # outro: swell into the final chord, pad to the end
    add(swell(0.6, seed=6), R.T_OUTRO + 0.25, 0.16, verb=0.4)
    add(chord((D3, A3, E4, Fs4, Cs5), strum=0.035), R.T_OUTRO + 0.85, 0.30, verb=0.7)
    add(sub(1.0, 60, 34), R.T_OUTRO + 0.85, 0.40, verb=0.0)
    add(_fade(pad(R.DURATION - R.T_OUTRO, (D3, A3, E4, Fs4, Cs5), bright=0.9), 0.8, 1.6),
        R.T_OUTRO + 0.6, 0.06, verb=0.5)
    add(blip(HIGH[3], 0.15), R.T_OUTRO + 1.4, 0.05, pan=0.4, verb=0.8)

    mix = dry + reverb(send)[:n] * 0.9
    return mix[: int(total * SR) + SR]


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype("<i2").tobytes())


def mux(video, out, start=0.0, end=None, sfx=True):
    """Mux the clip's audio (+ sound design if sfx) onto `video`, normalised to ~-14 LUFS."""
    end = R.DURATION if end is None else end
    tmp = ROOT / "out" / "segments"
    res = ROOT / "assets/video/result_genjutsu.mp4"
    delay = int(R.STORY0 * 1000)
    fade_at = 29.4
    inputs = ["-i", str(video), "-i", str(res)]
    clip = (f"[1:a]aresample={SR},volume=2.0,afade=t=out:st={fade_at}:d=0.6,"
            f"adelay={delay}|{delay},apad=whole_dur={R.DURATION}")
    if sfx:
        wav = tmp / "sfx.wav"
        write_wav(wav, build_sfx(R.DURATION))
        inputs += ["-i", str(wav)]
        graph = (clip + f"[r];[2:a]aresample={SR}[s];"
                 f"[r][s]amix=inputs=2:duration=first:normalize=0,")
    else:
        graph = clip + ","
    graph += f"atrim={start}:{end},asetpts=PTS-STARTPTS"
    # static gain to ~-14 LUFS + peak limiter (no dynamic pumping)
    measure = subprocess.run(["ffmpeg", "-hide_banner", *inputs, "-filter_complex", graph + ",ebur128",
                              "-vn", "-f", "null", "-"], capture_output=True, text=True, check=True).stderr
    loud = float(measure[measure.rindex("Summary:"):].split("I:")[1].split("LUFS")[0])
    gain = -14.0 - loud
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *inputs,
         "-filter_complex", graph + f",volume={gain:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=false,"
         f"aresample={SR}[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-shortest", "-movflags", "+faststart", str(out)], check=True)
