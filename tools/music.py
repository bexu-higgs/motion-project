"""Synthesize the quiet ambient music bed (original, no samples, no licensing).

Additive pad + soft sub + sparse bell plucks + convolution reverb.
Writes public/audio/music/bed.flac (48 kHz stereo, lossless). Deterministic.
"""

import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 72
BAR = 4 * 60 / BPM  # 3.33 s
LENGTH = 104.0  # longer than the video; Remotion trims and fades it
OUT = Path(__file__).resolve().parent.parent / "public" / "audio" / "music" / "bed.flac"
rng = np.random.default_rng(11)

# Two bars per chord. Fmaj9 -> Dm9 -> Bbmaj7(#11) -> Csus2/6, warm and unresolved.
PROGRESSION = [
    [41, 53, 57, 60, 64, 67],
    [38, 53, 57, 60, 64, 69],
    [34, 53, 57, 62, 64, 69],
    [36, 55, 57, 60, 62, 67],
]


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n: int, a: float, r: float) -> np.ndarray:
    x = np.arange(n) / SR
    d = n / SR
    return np.clip(np.minimum(x / a, (d - x) / r), 0, 1) ** 1.5


def pad_note(freq: float, n: int, brightness: np.ndarray, detune: float) -> np.ndarray:
    x = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 14):
        if freq * h > 6000:
            break
        amp = (1 / h) * np.exp(-h / brightness)
        phase = rng.uniform(0, 2 * np.pi)
        out += amp * np.sin(2 * np.pi * freq * h * (1 + detune) * x + phase)
    return out


def main() -> None:
    n_total = int(LENGTH * SR)
    left = np.zeros(n_total)
    right = np.zeros(n_total)
    x_all = np.arange(n_total) / SR
    brightness_all = 2.2 + 1.2 * np.sin(2 * np.pi * x_all / 23.0) ** 2  # slow "filter" breathing

    chord_len = 2 * BAR
    n_chords = int(np.ceil(LENGTH / chord_len)) + 1
    for c in range(n_chords):
        start = c * chord_len - 1.0
        dur = chord_len + 2.6  # overlap for smooth crossfades
        s = int(max(start, 0) * SR)
        n = min(int(dur * SR), n_total - s)
        if n <= 0:
            continue
        e = adsr(n, 1.8, 2.4)
        chord = PROGRESSION[c % len(PROGRESSION)]
        bright = brightness_all[s : s + n]
        for i, m in enumerate(chord[1:]):
            pan = 0.5 + 0.35 * np.sin(i * 2.1)
            for det, side in ((-0.0025, 0.3), (0.0025, 0.7)):
                v = pad_note(hz(m), n, bright, det) * e * 0.08
                p = 0.5 * pan + 0.5 * side
                left[s : s + n] += v * (1 - p)
                right[s : s + n] += v * p
        xs = np.arange(n) / SR
        root = hz(chord[0] + 12)  # warm bass an octave up, so phone speakers can reproduce it
        sub = (np.sin(2 * np.pi * root * xs) + 0.25 * np.sin(4 * np.pi * root * xs)) * e * 0.07
        left[s : s + n] += sub
        right[s : s + n] += sub

        # sparse, soft bell plucks on chord tones (every other beat, some skipped)
        beat = 60 / BPM
        for b in range(0, 8, 2):
            if rng.random() < 0.35:
                continue
            m = chord[rng.integers(2, len(chord))] + 12
            t0 = c * chord_len + b * beat + rng.uniform(-0.01, 0.01)
            ps = int(t0 * SR)
            pn = int(2.2 * SR)
            if ps < 0 or ps + pn > n_total:
                continue
            xp = np.arange(pn) / SR
            f = hz(m)
            pluck = (np.sin(2 * np.pi * f * xp) + 0.3 * np.sin(2 * np.pi * 2 * f * xp) * np.exp(-xp / 0.2)) * np.exp(-xp / 0.7)
            pluck *= np.minimum(xp / 0.006, 1) * 0.06
            pan = rng.uniform(0.25, 0.75)
            left[ps : ps + pn] += pluck * (1 - pan)
            right[ps : ps + pn] += pluck * pan

    # stereo convolution reverb (decorrelated noise IRs)
    ir_n = int(3.2 * SR)
    xi = np.arange(ir_n) / SR
    lp = butter(1, 4200, "lowpass", fs=SR, output="sos")
    irs = [sosfilt(lp, rng.standard_normal(ir_n) * np.exp(-xi / 0.75)) for _ in range(2)]
    irs = [ir / np.sqrt(np.sum(ir**2)) for ir in irs]
    wet_l = fftconvolve(left, irs[0])[:n_total]
    wet_r = fftconvolve(right, irs[1])[:n_total]
    mix_l = 0.55 * left + 0.7 * wet_l
    mix_r = 0.55 * right + 0.7 * wet_r

    # tame lows/highs so the bed sits under the voice
    shelf = butter(2, [55, 7000], "bandpass", fs=SR, output="sos")
    mix_l, mix_r = sosfilt(shelf, mix_l), sosfilt(shelf, mix_r)
    # carve the speech presence region a little (1-4 kHz) to leave room for the narrator
    notch = butter(1, [1200, 3800], "bandpass", fs=SR, output="sos")
    mix_l -= 0.35 * sosfilt(notch, mix_l)
    mix_r -= 0.35 * sosfilt(notch, mix_r)

    fade_in, fade_out = int(1.5 * SR), int(4 * SR)
    for ch in (mix_l, mix_r):
        ch[:fade_in] *= np.linspace(0, 1, fade_in)
        ch[-fade_out:] *= np.linspace(1, 0, fade_out)
    stereo = np.stack([mix_l, mix_r], axis=1)
    stereo /= np.abs(stereo).max() / 10 ** (-3 / 20)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "bed.wav"
        wavfile.write(wav, SR, (stereo * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "flac", str(OUT)], check=True)
    print(f"music bed {LENGTH:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()
