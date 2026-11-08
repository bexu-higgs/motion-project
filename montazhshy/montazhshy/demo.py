"""Демо және тесттерге арналған синтетикалық медиа: ырғақты музыка, сөйлеу тәрізді дыбыс, видео.

`montazhshy demo` командасы осы функциялармен шағын жоба жасайды — агентті материалсыз-ақ сынап көруге болады.
"""

from __future__ import annotations

import subprocess
import wave
from pathlib import Path

import numpy as np

from .ffmpeg import ffmpeg_bin


def drum_track(bpm: float = 120.0, seconds: float = 30.0, sr: int = 22050, quiet_bars: int = 4,
               offset: float = 0.25, seed: int = 0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(сигнал, бит уақыттары, такт басы уақыттары). Алғашқы ``quiet_bars`` такт тыныш."""
    rng = np.random.default_rng(seed)
    n = int(seconds * sr)
    y = np.zeros(n, dtype=np.float32)
    period = 60.0 / bpm
    beats = np.arange(offset, seconds - 0.2, period)
    t_k = np.arange(int(0.25 * sr)) / sr
    kick = np.sin(2 * np.pi * (50 + 80 * np.exp(-t_k * 30)) * t_k) * np.exp(-t_k * 12)
    t_s = np.arange(int(0.15 * sr)) / sr
    snare = rng.standard_normal(len(t_s)) * np.exp(-t_s * 25) * 0.5
    t_h = np.arange(int(0.04 * sr)) / sr
    hat = rng.standard_normal(len(t_h)) * np.exp(-t_h * 90) * 0.15
    t_b = np.arange(int(period * 4 * sr * 0.9)) / sr

    def add(sig: np.ndarray, at: float, gain: float) -> None:
        i = int(at * sr)
        j = min(n, i + len(sig))
        if i < n:
            y[i:j] += gain * sig[: j - i]

    for k, b in enumerate(beats):
        bar = k // 4
        loud = 0.35 if bar < quiet_bars else 1.0
        add(kick, b, (1.0 if k % 4 == 0 else 0.75) * loud)
        if k % 4 in (1, 3):
            add(snare, b, 0.8 * loud)
        add(hat, b, 1.0)
        add(hat, b + period / 2, 0.7)
        if k % 4 == 0:
            note = 55.0 * (2 ** ((bar % 4) * 3 / 12))
            bass = np.sin(2 * np.pi * note * t_b) * np.exp(-t_b * 1.5) * 0.25 * loud
            add(bass, b, 1.0)
            if bar >= quiet_bars:
                chord = sum(np.sin(2 * np.pi * note * 4 * r * t_b) for r in (1, 1.26, 1.5)) * 0.04
                add(chord * np.exp(-t_b * 0.8), b, 1.0)
    y /= max(1e-6, np.abs(y).max()) / 0.9
    return y, beats, beats[::4]


def speech_like(seconds: float = 6.0, sr: int = 16000, seed: int = 1) -> np.ndarray:
    """Буындарға ұқсас амплитудалық модуляциясы бар гармоникалық дыбыс + үзілістер."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * sr)) / sr
    f0 = 140 + 20 * np.sin(2 * np.pi * 0.7 * t)
    phase = 2 * np.pi * np.cumsum(f0) / sr
    voice = sum(np.sin(k * phase) / k for k in range(1, 12))
    syll = 0.5 * (1 + np.sin(2 * np.pi * 4.5 * t)) ** 2
    gate = np.ones_like(t)
    for a, b in ((1.8, 2.4), (4.0, 4.6)):
        gate[(t > a) & (t < b)] = 0
    y = voice * syll * gate * 0.2 + rng.standard_normal(len(t)) * 0.002
    return y.astype(np.float32)


def write_wav(path: Path, y: np.ndarray, sr: int) -> Path:
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return path


def make_video(path: Path, *, seconds: float = 4.0, size: str = "640x360", rate: str = "25",
               source: str = "testsrc2", tone: float | None = 440.0, color: str | None = None) -> Path:
    """FFmpeg lavfi көздерінен тест видео жасау."""
    vsrc = f"color=c={color}:size={size}:rate={rate}" if color else f"{source}=size={size}:rate={rate}"
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", vsrc]
    if tone:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency={tone}:sample_rate=48000"]
    cmd += ["-t", str(seconds), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
    cmd += ["-c:a", "aac", "-shortest"] if tone else ["-an"]
    cmd.append(str(path))
    subprocess.run(cmd, check=True)
    return path


def make_two_shot_video(path: Path, seconds_each: float = 2.0) -> Path:
    """Ортасында монтаж кесіндісі бар видео (қызыл → көк)."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y",
           "-f", "lavfi", "-i", f"testsrc2=size=320x180:rate=25:duration={seconds_each}",
           "-f", "lavfi", "-i", f"mandelbrot=size=320x180:rate=25,trim=duration={seconds_each}",
           "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]",
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(cmd, check=True)
    return path


DEMO_SCRIPT = """# Таң мен түн арасы
1. Таң атады. Аспан түсін өзгертеді. [01_tan.mp4]
Титр: Бір күннің хикаясы

2. Қала оянады — тіршілік, қозғалыс, ырғақ. [02_kala.mp4]

3. Ой мен арман — шексіз әлем. [03_arman.mp4]

4. Түн. Жұлдыздар мен тыныштық. [04_tun.mp4] [05_foto.jpg]
"""


def _lavfi(path: Path, src: str, seconds: float, vf: str = "") -> Path:
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", src, "-t", str(seconds)]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(cmd, check=True)
    return path


def create_demo_project(root: Path) -> Path:
    """Сынақ жобасы: 4 видео, 1 фото, 124 BPM музыка және сценарий."""
    from PIL import Image

    root.mkdir(parents=True, exist_ok=True)
    _lavfi(root / "01_tan.mp4", "gradients=s=1280x720:c0=0x0b1d51:c1=0xff9a3c:c2=0xffd36b:n=3:speed=0.015:r=25", 9,
           "noise=alls=6:allf=t")
    _lavfi(root / "02_kala.mp4", "life=s=320x180:mold=10:r=25:ratio=0.12:death_color=#101420:life_color=#38d3ff", 9,
           "scale=1280:720:flags=neighbor")
    _lavfi(root / "03_arman.mp4", "mandelbrot=s=1280x720:r=25:start_scale=2.5:end_scale=0.4", 9)
    _lavfi(root / "04_tun.mp4", "cellauto=s=320x180:rule=18:r=25:random_fill_ratio=0.02", 8,
           "scale=1280:720:flags=bicubic,colorchannelmixer=rr=0.3:gg=0.4:bb=1.0")
    w, h = 1600, 1000
    yy = np.linspace(0, 1, h)[:, None]
    xx = np.linspace(0, 1, w)[None, :]
    img = np.stack([20 + 60 * yy + 0 * xx, 20 + 30 * yy + 10 * xx, 60 + 120 * (1 - yy) + 0 * xx], axis=-1)
    rng = np.random.default_rng(3)
    stars = rng.random((h, w)) > 0.9985
    img[stars] = 255
    Image.fromarray(np.clip(img, 0, 255).astype("uint8")).save(root / "05_foto.jpg", quality=92)
    (root / "music").mkdir(exist_ok=True)
    y, _, _ = drum_track(124, 75, quiet_bars=8, offset=0.12)
    write_wav(root / "music" / "beat_124.wav", y, 44100 // 2)
    (root / "scenariy.txt").write_text(DEMO_SCRIPT, "utf-8")
    return root
