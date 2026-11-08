"""FFmpeg / FFprobe-ты шақыратын жұқа қабат.

Барлық ауыр жұмысты (декодтау, сүзгілер, кодтау) FFmpeg істейді. Бұл модуль:
  * бинарларды табады (PATH, MONTAZH_FFMPEG / MONTAZH_FFPROBE айнымалылары);
  * командаларды іске қосып, прогресті оқиды;
  * PCM дыбысты және кадрларды numpy массиві ретінде қайтарады.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Callable, Iterable, Sequence

import numpy as np

ProgressFn = Callable[[float], None]

_CREATE_FLAGS = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW


class FFmpegError(RuntimeError):
    """FFmpeg командасы сәтсіз аяқталды."""

    def __init__(self, message: str, stderr: str = "", cmd: Sequence[str] = ()):
        super().__init__(message)
        self.stderr = stderr
        self.cmd = list(cmd)

    def __str__(self) -> str:  # pragma: no cover - тек хабар үшін
        tail = "\n".join(self.stderr.strip().splitlines()[-12:])
        return f"{self.args[0]}\n{tail}" if tail else self.args[0]


class FFmpegMissing(FFmpegError):
    pass


@lru_cache(maxsize=None)
def ffmpeg_bin() -> str:
    found = os.environ.get("MONTAZH_FFMPEG") or shutil.which("ffmpeg")
    if not found:
        raise FFmpegMissing(
            "FFmpeg табылмады. Орнатыңыз: Windows — `winget install Gyan.FFmpeg`, "
            "macOS — `brew install ffmpeg`, Ubuntu — `sudo apt install ffmpeg`."
        )
    return found


@lru_cache(maxsize=None)
def ffprobe_bin() -> str:
    explicit = os.environ.get("MONTAZH_FFPROBE")
    if explicit:
        return explicit
    found = shutil.which("ffprobe")
    if not found:
        sibling = Path(ffmpeg_bin()).with_name("ffprobe" + (".exe" if sys.platform == "win32" else ""))
        if sibling.exists():
            return str(sibling)
        raise FFmpegMissing("FFprobe табылмады (әдетте FFmpeg-пен бірге орнатылады).")
    return found


@lru_cache(maxsize=None)
def version() -> tuple[int, int]:
    out = subprocess.run([ffmpeg_bin(), "-version"], capture_output=True, text=True,
                         creationflags=_CREATE_FLAGS).stdout
    m = re.search(r"ffmpeg version n?(\d+)\.(\d+)", out)
    if not m:  # git сборкалары: "ffmpeg version N-112233-g..." — жаңа деп есептейміз
        return (99, 0)
    return int(m.group(1)), int(m.group(2))


def run(args: Sequence[str], *, duration: float | None = None, progress: ProgressFn | None = None,
        cwd: str | Path | None = None) -> None:
    """FFmpeg-ті іске қосу. ``duration`` берілсе, прогресс 0..1 аралығында хабарланады."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-nostdin", "-y", "-loglevel", "error"]
    if progress and duration:
        cmd += ["-progress", "pipe:1", "-nostats"]
    cmd += [str(a) for a in args]
    if progress and duration:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                encoding="utf-8", errors="replace", cwd=cwd, creationflags=_CREATE_FLAGS)
        assert proc.stdout is not None
        stderr_chunks: list[str] = []
        import threading

        def _drain() -> None:
            assert proc.stderr is not None
            for line in proc.stderr:
                stderr_chunks.append(line)

        t = threading.Thread(target=_drain, daemon=True)
        t.start()
        for line in proc.stdout:
            if line.startswith("out_time_us=") or line.startswith("out_time_ms="):
                try:
                    us = int(line.split("=", 1)[1])
                except ValueError:
                    continue
                progress(max(0.0, min(1.0, us / 1e6 / duration)))
        proc.wait()
        t.join(timeout=2)
        if proc.returncode != 0:
            raise FFmpegError("FFmpeg қатемен аяқталды", "".join(stderr_chunks), cmd)
        progress(1.0)
        return
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=cwd,
                         creationflags=_CREATE_FLAGS)
    if res.returncode != 0:
        raise FFmpegError("FFmpeg қатемен аяқталды", res.stderr, cmd)


def run_capture(args: Sequence[str]) -> tuple[bytes, str]:
    """FFmpeg-ті іске қосып, stdout (байт) пен stderr (мәтін) қайтару."""
    cmd = [ffmpeg_bin(), "-hide_banner", "-nostdin", *map(str, args)]
    res = subprocess.run(cmd, capture_output=True, creationflags=_CREATE_FLAGS)
    stderr = res.stderr.decode("utf-8", "replace")
    if res.returncode != 0:
        raise FFmpegError("FFmpeg қатемен аяқталды", stderr, cmd)
    return res.stdout, stderr


def probe(path: str | Path) -> dict:
    cmd = [ffprobe_bin(), "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                         creationflags=_CREATE_FLAGS)
    if res.returncode != 0:
        raise FFmpegError(f"Файлды оқу мүмкін болмады: {Path(path).name}", res.stderr, cmd)
    return json.loads(res.stdout or "{}")


def read_pcm(path: str | Path, sr: int = 22050, *, start: float | None = None, duration: float | None = None,
             mono: bool = True) -> np.ndarray:
    """Дыбысты float32 PCM ретінде оқу (моно: shape (n,), стерео: (n, 2))."""
    args: list[str] = []
    if start:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if duration:
        args += ["-t", f"{duration:.3f}"]
    args += ["-vn", "-ac", "1" if mono else "2", "-ar", str(sr), "-f", "f32le", "-"]
    data, _ = run_capture(args)
    pcm = np.frombuffer(data, dtype="<f4").astype(np.float32)
    return pcm if mono else pcm.reshape(-1, 2)


@dataclass
class FrameBatch:
    times: np.ndarray  # секунд
    frames: np.ndarray  # (n, h, w) gray немесе (n, h, w, 3) rgb, uint8


def read_frames(path: str | Path, *, fps: float, width: int, gray: bool = True,
                start: float | None = None, duration: float | None = None, max_frames: int | None = None
                ) -> FrameBatch:
    """Видеодан тұрақты жиілікпен кішірейтілген кадрларды оқу."""
    info = probe(path)
    vstream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    if vstream is None:
        raise FFmpegError(f"Видео ағыны жоқ: {Path(path).name}")
    w0, h0 = int(vstream["width"]), int(vstream["height"])
    rot = _rotation(vstream)
    if rot in (90, 270):
        w0, h0 = h0, w0
    height = max(2, int(round(width * h0 / max(1, w0) / 2)) * 2)
    args: list[str] = []
    if start:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if duration:
        args += ["-t", f"{duration:.3f}"]
    vf = f"fps={fps},scale={width}:{height}:flags=area"
    args += ["-an", "-vf", vf, "-pix_fmt", "gray" if gray else "rgb24"]
    if max_frames:
        args += ["-frames:v", str(max_frames)]
    args += ["-f", "rawvideo", "-"]
    data, _ = run_capture(args)
    ch = 1 if gray else 3
    frame_size = width * height * ch
    n = len(data) // frame_size
    arr = np.frombuffer(data[: n * frame_size], dtype=np.uint8)
    arr = arr.reshape((n, height, width) if gray else (n, height, width, 3))
    times = (start or 0.0) + np.arange(n) / fps
    return FrameBatch(times=times, frames=arr)


def grab_frame(path: str | Path, t: float, width: int, *, is_image: bool = False) -> np.ndarray:
    """Бір кадрды RGB (h, w, 3) ретінде алу."""
    args: list[str] = []
    if not is_image:
        args += ["-ss", f"{max(0.0, t):.3f}"]
    args += ["-i", str(path), "-frames:v", "1", "-vf", f"scale={width}:-2:flags=bicubic",
             "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    data, stderr = run_capture(args)
    if not data:
        raise FFmpegError(f"Кадр алынбады: {Path(path).name} @ {t:.2f}s", stderr)
    # биіктікті байт санынан табамыз
    h = len(data) // (width * 3)
    return np.frombuffer(data[: h * width * 3], dtype=np.uint8).reshape(h, width, 3)


def _rotation(stream: dict) -> int:
    rot = 0
    tags = stream.get("tags") or {}
    if "rotate" in tags:
        try:
            rot = int(tags["rotate"])
        except ValueError:
            rot = 0
    for sd in stream.get("side_data_list") or []:
        if "rotation" in sd:
            try:
                rot = int(sd["rotation"])
            except (TypeError, ValueError):
                pass
    return abs(rot) % 360


def filter_script_args(script: str | Path) -> list[str]:
    """Ұзын графты файлдан оқыту (Windows-тағы 8191 таңба шегінен қорғайды)."""
    if version() >= (7, 0):
        return ["-/filter_complex", str(script)]
    return ["-filter_complex_script", str(script)]


def escape_filter_path(path: str | Path) -> str:
    """Сүзгі ішіндегі файл жолын экрандау (Windows дискі, қос нүкте, тырнақша)."""
    s = str(Path(path).resolve()).replace("\\", "/")
    return s.replace(":", r"\:").replace("'", r"\'")


def escape_text(text: str) -> str:
    """drawtext мәтінін экрандау."""
    return (text.replace("\\", "\\\\").replace(":", r"\:").replace("'", "’")
            .replace("%", r"\%").replace(",", r"\,"))


def which_all() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for name, fn in (("ffmpeg", ffmpeg_bin), ("ffprobe", ffprobe_bin)):
        try:
            out[name] = fn()
        except FFmpegMissing:
            out[name] = None
    return out


def chunks(seq: Sequence, n: int) -> Iterable[Sequence]:
    for i in range(0, len(seq), n):
        yield seq[i : i + n]
