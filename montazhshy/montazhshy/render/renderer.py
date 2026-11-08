"""Рендер оркестрі: аралық файлдар (кэшпен) → дыбыс миксі → жинау және кодтау."""

from __future__ import annotations

import hashlib
import json
import shutil
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from .. import ffmpeg
from ..media import MediaItem
from ..project import Project
from ..timeline import Placed, Resolved, Timeline, resolve
from . import audio as audio_mod
from .video import ShotLook, assembly_graph, clip_graph

ProgressFn = Callable[[str, float], None]

PREVIEW_MAX = 640


class RenderError(RuntimeError):
    pass


@dataclass
class RenderResult:
    path: Path
    mode: str
    duration: float
    width: int
    height: int
    fps: float
    elapsed: float
    audio: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    cuts: list[float] = field(default_factory=list)
    stems: Path | None = None

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d["path"] = str(self.path)
        d["stems"] = str(self.stems) if self.stems else None
        return d


def _hash(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:20]


def output_dims(project: Project, mode: str) -> tuple[int, int]:
    W, H = project.output_size()
    if mode == "preview":
        k = PREVIEW_MAX / max(W, H)
        if k < 1:
            W = max(2, int(round(W * k / 2)) * 2)
            H = max(2, int(round(H * k / 2)) * 2)
    return W, H


def shot_look(project: Project, p: Placed) -> ShotLook | None:
    a = project.analysis(p.clip.media).video
    if a is None or not a.shots:
        return None
    lo, hi = p.clip.src_in, p.clip.src_out
    acc_w = 0.0
    br = 0.0
    col = [0.0, 0.0, 0.0]
    for s in a.shots:
        w = max(0.0, min(hi, s.end) - max(lo, s.start)) if a.duration else 1.0
        if w <= 0:
            continue
        acc_w += w
        br += s.brightness * w
        for i in range(3):
            col[i] += s.color[i] * w
    if acc_w <= 0:
        return None
    return ShotLook(br / acc_w, (col[0] / acc_w, col[1] / acc_w, col[2] / acc_w))


def resolve_for(project: Project, tl: Timeline, fps: float | None = None) -> Resolved:
    fps = fps or project.output_fps()
    media = {m.id: m for m in project.media()}
    durations = {k: m.duration for k, m in media.items() if m.kind == "video"}
    stills = {k for k, m in media.items() if m.kind == "image"}
    return resolve(tl, fps, durations, stills)


def render(project: Project, tl: Timeline, *, mode: str = "preview", out: Path | None = None,
           stems: bool = False, progress: ProgressFn | None = None, workers: int = 2) -> RenderResult:
    t0 = time.time()
    mode = "final" if mode == "final" else "preview"
    fps = project.output_fps()
    W, H = output_dims(project, mode)
    media: dict[str, MediaItem] = {m.id: m for m in project.media()}
    res = resolve_for(project, tl, fps)
    if not res.placed:
        raise RenderError("Таймлайнда бірде-бір кадр жоқ.")
    cache = project.cache_dir / "render"
    cache.mkdir(parents=True, exist_ok=True)
    out = out or project.renders_dir / ("final.mp4" if mode == "final" else "preview.mp4")
    out.parent.mkdir(parents=True, exist_ok=True)

    def report(stage: str, frac: float) -> None:
        if progress:
            progress(stage, max(0.0, min(1.0, frac)))

    # ---- 1) аралық видео файлдар
    looks = [shot_look(project, p) for p in res.placed]
    lums = [lk.brightness for lk in looks if lk is not None]
    target_luma = min(0.52, max(0.38, statistics.median(lums))) if lums else 0.45
    enc = (["-c:v", "libx264", "-preset", "ultrafast", "-crf", "28"] if mode == "preview"
           else ["-c:v", "libx264", "-preset", "fast", "-crf", "12"])
    jobs: list[tuple[Placed, Path, str]] = []
    inter: list[Path] = []
    for p, look in zip(res.placed, looks):
        item = media[p.clip.media]
        graph = clip_graph(p, item, W, H, fps, tl.grade, look, target_luma, sharpen=mode == "final")
        if item.kind == "image":
            lim = 2 * max(W, H)
            graph = graph.replace("[0:v]", f"[0:v]scale=w='if(gt(iw,{lim}),{lim},iw)':h=-2,", 1)
        key = _hash("v", item.path, item.size, item.mtime, p.clip.src_in, p.frames, graph, enc, mode)
        path = cache / f"v_{key}.mp4"
        inter.append(path)
        if not path.exists():
            jobs.append((p, path, graph))
    done = 0

    def encode(job: tuple[Placed, Path, str]) -> None:
        nonlocal done
        p, path, graph = job
        item = media[p.clip.media]
        src = project.abspath(item)
        script = path.with_suffix(".graph.txt")
        script.write_text(graph, "utf-8")
        need = p.duration * p.clip.speed + 0.5
        if item.kind == "image":
            ins = ["-loop", "1", "-framerate", f"{fps:g}", "-t", f"{p.duration + 0.5:.4f}", "-i", str(src)]
        else:
            ins = ["-ss", f"{p.clip.src_in:.4f}", "-t", f"{need:.4f}", "-i", str(src)]
        tmp = path.with_suffix(".tmp.mp4")
        try:
            ffmpeg.run(ins + ffmpeg.filter_script_args(script) + ["-map", "[v]", "-an", *enc,
                                                                  "-pix_fmt", "yuv420p", str(tmp)])
            tmp.replace(path)
        finally:
            script.unlink(missing_ok=True)
            tmp.unlink(missing_ok=True)
        done += 1
        report(f"Кадрлар рендері {done}/{len(jobs)}", 0.05 + 0.55 * done / max(1, len(jobs)))

    report("Кадрлар дайындалуда", 0.02)
    if jobs:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            for f in [ex.submit(encode, j) for j in jobs]:
                f.result()

    # ---- 2) дыбыс
    report("Дыбыс миксі", 0.62)
    speech: dict[str, list[list[float]]] = {}
    lufs: dict[str, float | None] = {}
    for mid in media:
        a = project.analysis(mid).audio
        if a is not None:
            speech[mid] = a.speech
            lufs[mid] = a.lufs
    mix_in = audio_mod.MixInputs(
        resolved=res, media=media, paths={k: project.abspath(m) for k, m in media.items()}, speech=speech,
        lufs=lufs, music=tl.music, voiceover=tl.voiceover, sfx=tl.sfx, master=tl.audio, cache=cache)
    wav = cache / f"mix_{mode}.wav"
    stems_dir = (project.exports_dir / "stems") if stems else None
    arep = audio_mod.mix(mix_in, wav, stems_dir=stems_dir,
                         progress=lambda f: report("Дыбыс миксі", 0.62 + 0.13 * f))

    # ---- 3) жинау
    report("Жинау және кодтау", 0.76)
    # титр тұратын аймақтың нақты жарықтығы (аралық файлдан бір кадр) → мәтін түсін автоматты таңдау
    title_lumas = [title_luma(t, res.placed, inter) for t in tl.titles]
    graph = assembly_graph(res.placed, res.total, W, H, tl.grade, tl.titles, tl.fade_in, tl.fade_out,
                           cache / "titles", audio_input=len(inter), title_lumas=title_lumas)
    script = cache / f"assembly_{mode}.txt"
    script.write_text(graph, "utf-8")
    ins: list[str] = []
    for path in inter:
        ins += ["-i", str(path)]
    ins += ["-i", str(wav)]
    if mode == "final":
        cap = max(8, int(W * H * fps / 1e6 * 0.4))  # Мбит/с: түйіршік (grain) битрейтті шексіз өсірмесін
        venc = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-profile:v", "high",
                "-maxrate", f"{cap}M", "-bufsize", f"{cap * 2}M",
                "-c:a", "aac", "-b:a", "320k"]
    else:
        venc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "aac", "-b:a", "160k"]
    tmp = out.with_suffix(".tmp.mp4")
    ffmpeg.run(ins + ffmpeg.filter_script_args(script) + [
        "-map", "[vout]", "-map", f"{len(inter)}:a", *venc, "-pix_fmt", "yuv420p", "-r", f"{fps:g}",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-ar", "48000", "-t", f"{res.total:.4f}", "-movflags", "+faststart", str(tmp)],
        duration=res.total, progress=lambda f: report("Жинау және кодтау", 0.76 + 0.23 * f))
    tmp.replace(out)
    report("Дайын", 1.0)
    _prune_cache(cache, keep=set(inter))
    return RenderResult(
        path=out, mode=mode, duration=round(res.total, 3), width=W, height=H, fps=fps,
        elapsed=round(time.time() - t0, 1), audio=arep.to_dict(), warnings=res.warnings,
        cuts=[round(p.cut_point, 3) for p in res.placed[1:]], stems=stems_dir)


def title_luma(t, placed: list[Placed], inter: list[Path]) -> float:
    if t.style in ("lower_third", "subtitle"):
        return 0.3  # оларда қараңғы фон-қорап бар
    mid = t.start + t.duration / 2
    for p, path in zip(placed, inter):
        if p.start <= mid < p.end:
            try:
                rgb = ffmpeg.grab_frame(path, max(0.0, mid - p.start), 160)
            except ffmpeg.FFmpegError:
                return 0.3
            h, w = rgb.shape[:2]
            cy = 0.8 if t.position == "bottom" else 0.2 if t.position == "top" else 0.5
            region = rgb[int(h * (cy - 0.09)):int(h * (cy + 0.09)), int(w * 0.25):int(w * 0.75)]
            region = region.astype("float32") / 255.0
            luma = 0.299 * region[..., 0] + 0.587 * region[..., 1] + 0.114 * region[..., 2]
            # оқылу ең жарық бөліктерге байланысты — орташа емес, 70-перцентиль
            return float(np.percentile(luma, 70))
    return 0.3


def _prune_cache(cache: Path, keep: set[Path], max_bytes: int = 6 * 1024**3) -> None:
    """Кэш тым үлкейсе, ескі аралық файлдарды өшіру."""
    files = [f for f in cache.glob("v_*.mp4")] + [f for f in cache.glob("a_*.f32")]
    total = sum(f.stat().st_size for f in files)
    if total <= max_bytes:
        return
    for f in sorted(files, key=lambda f: f.stat().st_atime):
        if f in keep:
            continue
        total -= f.stat().st_size
        f.unlink(missing_ok=True)
        meta = f.with_suffix(".json")
        meta.unlink(missing_ok=True)
        if total <= max_bytes * 0.7:
            break


def clear_cache(project: Project) -> None:
    shutil.rmtree(project.cache_dir / "render", ignore_errors=True)
