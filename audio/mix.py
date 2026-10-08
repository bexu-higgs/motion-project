"""Final mix: voiceover (placed on the timeline, cleaned and compressed) over
the sound design, with gentle ducking, then loudness-normalised for social
delivery (-14 LUFS integrated, -1 dBTP).

Usage: python3 audio/mix.py <sfx.wav> <out.wav>
"""
import json, subprocess, sys, tempfile, os
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal

SR = 48000
TL = json.load(open("src/timeline.json"))
N = int(TL["duration"] * SR)
sfx_path, out_path = sys.argv[1], sys.argv[2]

# 1. dry voice track on the master timeline
vo = np.zeros(N)
for key, ch in TL["chunks"].items():
    x, sr = sf.read(f"assets/vo/{key}.wav")
    x = signal.resample_poly(x, SR, sr)
    i0 = int(round(ch["start"] * SR))
    vo[i0:i0 + len(x)] += x[: N - i0]

tmp = tempfile.mkdtemp()
sf.write(f"{tmp}/vo_dry.wav", vo.astype(np.float32), SR, subtype="FLOAT")
# 2. voice chain: rumble cut, de-mud, presence, gentle de-ess, compression, short plate
chain = ("highpass=f=75:poles=2,"
         "equalizer=f=280:t=q:w=1.0:g=-2.5,"
         "equalizer=f=140:t=q:w=0.9:g=1.5,"
         "equalizer=f=3400:t=q:w=1.3:g=2.5,"
         "deesser=i=0.35:f=0.55,"
         "acompressor=threshold=-22dB:ratio=3.2:attack=6:release=90:makeup=3,"
         "aecho=0.9:0.5:23|37:0.08|0.05")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{tmp}/vo_dry.wav", "-af", chain,
                "-ar", str(SR), "-c:a", "pcm_f32le", f"{tmp}/vo.wav"], check=True)
vo, _ = sf.read(f"{tmp}/vo.wav")
vo = vo[:N] if len(vo) >= N else np.pad(vo, (0, N - len(vo)))

sfx, _ = sf.read(sfx_path)
meter = pyln.Meter(SR)
vo_l = meter.integrated_loudness(np.stack([vo, vo], 1))
sfx_l = meter.integrated_loudness(sfx)
# voice sits ~8 LU above the design layer
vo *= 10 ** ((-16 - vo_l) / 20)
sfx *= 10 ** ((-24.5 - sfx_l) / 20)

# 3. ducking: design layer dips ~3.5 dB under the voice
env = np.abs(vo)
win = int(0.03 * SR)
env = np.convolve(env, np.ones(win) / win, "same")
active = np.clip(env / (np.percentile(env[env > 1e-4], 60) + 1e-9), 0, 1)
k = int(0.08 * SR)
active = np.convolve(active, np.hanning(k) / np.hanning(k).sum(), "same")
duck = 1 - (1 - 10 ** (-3.5 / 20)) * np.clip(active, 0, 1)
mix = sfx * duck[:, None] + np.stack([vo, vo], 1)

# 4. loudness for social (-14 LUFS), peak safety
mix *= 10 ** ((-14 - meter.integrated_loudness(mix)) / 20)
peak = np.max(np.abs(mix))
if peak > 10 ** (-1.2 / 20):
    # soft-knee limiting of the rare overs (sub impacts)
    th = 10 ** (-3 / 20)
    a = np.abs(mix)
    over = a > th
    mix[over] = np.sign(mix[over]) * (th + (1 - th) * np.tanh((a[over] - th) / (1 - th)))
    mix *= 10 ** (-1.2 / 20) / np.max(np.abs(mix))
sf.write(out_path, mix.astype(np.float32), SR, subtype="PCM_24")
print(f"mix: {meter.integrated_loudness(mix):.1f} LUFS, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS")
