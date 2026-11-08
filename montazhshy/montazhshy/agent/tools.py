"""Агенттің құралдары: жобаны көру, кадрларды «көру», таймлайн жазу, рендер және сапа бақылауы."""

from __future__ import annotations

import base64
import json
import time
from dataclasses import asdict
from typing import Any, Callable

from ..autoedit import build, snap_cuts, timeline_grid
from ..export.nle import export_all
from ..media import MediaItem
from ..musicfit import fit_music
from ..project import Project
from ..render import qc
from ..render.renderer import RenderResult, render, resolve_for
from ..script import parse
from ..styles import GRADES, PLATFORMS, STYLES
from ..timeline import (AUDIO_MODES, MOTIONS, REFRAMES, TITLE_STYLES, TRANSITIONS, AudioItem, Clip, Timeline,
                        Title, describe)

Emit = Callable[[dict], None]


class ToolError(Exception):
    pass


# ---------------------------------------------------------------------------
# JSON схемалары
# ---------------------------------------------------------------------------

_CLIP_SCHEMA = {
    "type": "object",
    "properties": {
        "media": {"type": "string", "description": "Media id, e.g. V3 or P1"},
        "src_in": {"type": "number"},
        "src_out": {"type": "number"},
        "speed": {"type": "number", "description": "0.25–4, 1 = normal, 0.5 = slow motion"},
        "transition": {"type": "object", "properties": {
            "type": {"type": "string", "enum": list(TRANSITIONS)}, "duration": {"type": "number"}},
            "description": "Transition INTO this clip"},
        "audio": {"type": "string", "enum": list(AUDIO_MODES)},
        "gain_db": {"type": "number"},
        "j_cut": {"type": "number", "description": "Seconds the clip's sound starts before its picture"},
        "l_cut": {"type": "number", "description": "Seconds the clip's sound continues after its picture"},
        "motion": {"type": "string", "enum": list(MOTIONS)},
        "motion_amount": {"type": "number", "description": "0.02–0.15"},
        "reframe": {"type": "string", "enum": list(REFRAMES)},
        "focus": {"type": "array", "items": {"type": "number"}, "description": "[x, y] 0..1 subject position"},
        "zoom": {"type": "number", "description": "≥1 punch-in"},
        "grade": {"type": "object", "description": "Per-clip correction: exposure -1..1, temperature -1..1, "
                  "saturation ×, contrast ×"},
        "note": {"type": "string"},
    },
    "required": ["media", "src_in", "src_out"],
}

_AUDIO_ITEM = {
    "type": "object",
    "properties": {
        "media": {"type": "string"}, "start": {"type": "number"}, "src_in": {"type": "number"},
        "duration": {"type": "number"},
        "segments": {"type": "array", "items": {"type": "array", "items": {"type": "number"}},
                     "description": "Music edit: source ranges played back to back"},
        "gain_db": {"type": "number"}, "fade_in": {"type": "number"}, "fade_out": {"type": "number"},
        "duck": {"type": "boolean"}, "note": {"type": "string"},
    },
    "required": ["media"],
}

_TITLE = {
    "type": "object",
    "properties": {
        "text": {"type": "string"}, "start": {"type": "number"}, "duration": {"type": "number"},
        "style": {"type": "string", "enum": list(TITLE_STYLES)}, "subtext": {"type": "string"},
        "size": {"type": "number"}, "position": {"type": "string", "enum": ["auto", "top", "center", "bottom"]},
    },
    "required": ["text", "start"],
}

_TIMELINE = {
    "type": "object",
    "properties": {
        "clips": {"type": "array", "items": _CLIP_SCHEMA},
        "music": {"type": "array", "items": _AUDIO_ITEM},
        "voiceover": {"type": "array", "items": _AUDIO_ITEM},
        "sfx": {"type": "array", "items": _AUDIO_ITEM},
        "titles": {"type": "array", "items": _TITLE},
        "grade": {"type": "object", "properties": {
            "preset": {"type": "string", "enum": list(GRADES)}, "intensity": {"type": "number"},
            "auto_match": {"type": "boolean"}, "letterbox": {"type": "number"}, "grain": {"type": "number"},
            "vignette": {"type": "number"}, "sharpen": {"type": "number"}}},
        "audio": {"type": "object", "properties": {
            "target_lufs": {"type": "number"}, "true_peak": {"type": "number"},
            "dialog_enhance": {"type": "boolean"}, "denoise": {"type": "string", "enum": ["off", "light", "strong"]},
            "duck_db": {"type": "number"}, "ambience_db": {"type": "number"}}},
        "fade_in": {"type": "number"}, "fade_out": {"type": "number"}, "notes": {"type": "string"},
    },
    "required": ["clips"],
}

TOOLS: list[dict] = [
    {
        "name": "project_overview",
        "description": "Refresh the project overview: settings, media list with analysis (shots with "
                       "sharpness/motion/brightness, speech segments, loudness), music analysis (BPM, bars, "
                       "sections, drops), parsed script and the current timeline summary.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "view_media",
        "description": "Look at footage/photos: returns one contact-sheet image per item (frames with "
                       "timecodes) plus its shot list. Use start/end to zoom into a range for exact in/out "
                       "points. Up to 6 items per call.",
        "input_schema": {"type": "object", "properties": {
            "items": {"type": "array", "maxItems": 6, "items": {"type": "object", "properties": {
                "media": {"type": "string"}, "start": {"type": "number"}, "end": {"type": "number"},
                "frames": {"type": "integer", "description": "4–16, default 8"}},
                "required": ["media"]}}},
            "required": ["items"]},
    },
    {
        "name": "music_grid",
        "description": "Beat/bar grid of a music file (source time) or of the current timeline "
                       "(timeline=true): beats, downbeats, sections with energy, drops.",
        "input_schema": {"type": "object", "properties": {
            "media": {"type": "string"}, "timeline": {"type": "boolean"},
            "start": {"type": "number"}, "end": {"type": "number"}}},
    },
    {
        "name": "auto_draft",
        "description": "Create a beat-accurate draft timeline with the built-in auto-editor (script order, "
                       "best windows, style transitions, music fit, titles, grade). Replaces the current "
                       "timeline. Returns the timeline table.",
        "input_schema": {"type": "object", "properties": {
            "style": {"type": "string", "enum": list(STYLES)},
            "target_duration": {"type": "number", "description": "Seconds; 0 = automatic"},
            "music": {"type": "string", "description": "Music media id, or empty for none"},
            "music_fit": {"type": "string", "enum": ["auto", "edit", "backtime", "fade", "loop"]},
            "title": {"type": "string"}}},
    },
    {
        "name": "set_timeline",
        "description": "Replace the whole timeline (EDL). Validated, frame-quantized and saved; returns "
                       "the timeline table with timeline positions, beat alignment and warnings.",
        "input_schema": {"type": "object", "properties": {"timeline": _TIMELINE}, "required": ["timeline"]},
    },
    {
        "name": "edit_timeline",
        "description": "Apply edit operations to the current timeline (cheaper than set_timeline). Ops: "
                       "update_clip {index, fields}, insert_clip {index, clip}, delete_clip {index}, "
                       "move_clip {from, to}, set {path, value} (e.g. path 'grade.preset'), add_title {title}, "
                       "update_title {index, fields}, remove_title {index}, set_audio {track: music|voiceover|sfx, "
                       "items}. Indexes are 1-based as in the table.",
        "input_schema": {"type": "object", "properties": {
            "ops": {"type": "array", "items": {"type": "object", "properties": {
                "op": {"type": "string", "enum": ["update_clip", "insert_clip", "delete_clip", "move_clip", "set",
                                                  "add_title", "update_title", "remove_title", "set_audio"]},
                "index": {"type": "integer"}, "from": {"type": "integer"}, "to": {"type": "integer"},
                "fields": {"type": "object"}, "clip": _CLIP_SCHEMA, "title": _TITLE,
                "path": {"type": "string"}, "value": {},
                "track": {"type": "string", "enum": ["music", "voiceover", "sfx"]},
                "items": {"type": "array", "items": _AUDIO_ITEM}},
                "required": ["op"]}}},
            "required": ["ops"]},
    },
    {
        "name": "fit_music",
        "description": "Fit a music file to a target length with a professional strategy (edit = remove bars "
                       "in the middle on downbeats, backtime = natural ending on the last frame, fade, loop). "
                       "Sets it as the timeline's music and returns the timeline beat grid.",
        "input_schema": {"type": "object", "properties": {
            "media": {"type": "string"}, "target_duration": {"type": "number"},
            "strategy": {"type": "string", "enum": ["auto", "edit", "backtime", "fade", "loop"]},
            "gain_db": {"type": "number"}},
            "required": ["media", "target_duration"]},
    },
    {
        "name": "snap_to_beats",
        "description": "Move every cut of the current timeline to the nearest beat/bar of the timeline music "
                       "(adjusts out points, frame-accurate).",
        "input_schema": {"type": "object", "properties": {
            "unit": {"type": "string", "enum": ["beat", "bar", "half"]},
            "max_shift": {"type": "number", "description": "Seconds, default 0.35"}}},
    },
    {
        "name": "render_preview",
        "description": "Render a fast low-resolution preview of the current timeline. Returns the QC contact "
                       "sheet (middle frame of every clip, numbered) and the audio report (LUFS, true peak, "
                       "ducking).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "inspect_preview",
        "description": "Frames from the last preview at given timeline times (seconds), e.g. around "
                       "transitions, titles or the drop.",
        "input_schema": {"type": "object", "properties": {
            "times": {"type": "array", "items": {"type": "number"}, "maxItems": 16}},
            "required": ["times"]},
    },
    {
        "name": "render_final",
        "description": "Render the final full-quality video and export Premiere/DaVinci XML, EDL, SRT "
                       "(and stems if requested).",
        "input_schema": {"type": "object", "properties": {"stems": {"type": "boolean"}}},
    },
]


def _img_block(jpeg: bytes) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                        "data": base64.standard_b64encode(jpeg).decode("ascii")}}


def _r(v: float, n: int = 2) -> float:
    return round(float(v), n)


# ---------------------------------------------------------------------------
# құралдар жиыны
# ---------------------------------------------------------------------------

class ToolBox:
    def __init__(self, project: Project, emit: Emit | None = None):
        self.project = project
        self.emit = emit or (lambda e: None)
        self.tl: Timeline | None = Timeline.load(project.timeline_path) if project.timeline_path.exists() else None
        self.last_preview: RenderResult | None = None
        self.last_final: RenderResult | None = None

    # ------------------------------------------------------------------ шолу
    def overview(self) -> dict[str, Any]:
        p = self.project
        st = p.settings
        W, H = p.output_size()
        media = []
        for m in p.media():
            a = p.analysis(m.id)
            d: dict[str, Any] = {"id": m.id, "file": m.path, "kind": m.kind, "role": m.role}
            if m.kind != "image":
                d["duration"] = _r(m.duration)
            if m.is_visual:
                d["size"] = f"{m.width}x{m.height}"
                if m.fps:
                    d["fps"] = m.fps
            if a.video and m.kind == "video":
                d["shots"] = [
                    {"start": _r(s.start), "end": _r(s.end), "sharp": _r(s.sharpness), "motion": _r(s.motion),
                     "bright": _r(s.brightness), "best": [_r(s.best[0]), _r(s.best[1])]}
                    for s in a.video.shots[:40]]
                if len(a.video.shots) > 40:
                    d["shots_note"] = f"{len(a.video.shots)} shots total, first 40 shown"
            elif a.video and m.kind == "image":
                d["sharp"] = _r(a.video.shots[0].sharpness)
            if a.audio:
                d["audio"] = {"lufs": a.audio.lufs, "speech_ratio": a.audio.speech_ratio,
                              "speech": [[_r(x), _r(y)] for x, y in a.audio.speech[:20]]}
            elif m.kind == "video":
                d["audio"] = None
            if a.music:
                mu = a.music
                d["music"] = {"bpm": mu.bpm, "confidence": mu.confidence, "bars": len(mu.downbeats),
                              "first_downbeat": mu.downbeats[0] if mu.downbeats else None,
                              "sections": [{"start": s.start, "end": s.end, "energy": s.energy, "label": s.label}
                                           for s in mu.sections],
                              "drops": mu.drops}
            media.append(d)
        script = parse(st.get("script", ""))
        out: dict[str, Any] = {
            "output": {"width": W, "height": H, "fps": p.output_fps(), "aspect": st.get("aspect")},
            "settings": {k: st.get(k) for k in ("style", "grade", "platform", "music_fit", "target_duration",
                                                "title", "language")},
            "styles": {k: v.name for k, v in STYLES.items()},
            "platform_loudness": PLATFORMS.get(st.get("platform") or "youtube"),
            "media": media,
            "script": {"title": script.title, "scenes": [
                {"n": s.index, "text": s.text, "refs": s.refs, "titles": s.titles, "voiceover": s.voiceover}
                for s in script.scenes]} if not script.empty else None,
            "script_raw": st.get("script") or None,
        }
        if self.tl is not None and self.tl.clips:
            out["current_timeline"] = self.table()
        return out

    # ------------------------------------------------------------------ таймлайн кестесі
    def table(self) -> str:
        if self.tl is None or not self.tl.clips:
            return "(timeline is empty)"
        res = resolve_for(self.project, self.tl)
        beats, _ = timeline_grid(self.project, self.tl)
        d = describe(res, beats)
        lines = [f"TOTAL {d['total_seconds']}s · {d['clips']} clips · avg shot {d['avg_shot']}s"
                 + (f" · cuts on beat {d['cuts_on_beat']}" if "cuts_on_beat" in d else "")]
        lines.append(" #  media  src_in→src_out  speed  start   dur   transition_in   motion     audio     note")
        for p in res.placed:
            c = p.clip
            tr = c.transition.type if p.index else "—"
            if tr not in ("cut", "—"):
                tr = f"{tr} {p.trans.duration:.2f}"
            extra = []
            if c.reframe != "auto":
                extra.append(f"reframe={c.reframe}")
            if c.j_cut:
                extra.append(f"J{c.j_cut}")
            if c.l_cut:
                extra.append(f"L{c.l_cut}")
            lines.append(f"{p.index + 1:>2}  {c.media:<5} {c.src_in:7.2f}→{c.src_out:<7.2f} {c.speed:4.2f}  "
                         f"{p.start:6.2f} {p.duration:5.2f}  {tr:<14}  {c.motion:<9}  {c.audio:<8}  "
                         f"{c.note} {' '.join(extra)}".rstrip())
        tl = self.tl
        if tl.titles:
            lines.append("titles: " + "; ".join(f"[{i + 1}] «{t.text}» {t.style} @{t.start:.2f}+{t.duration:.1f}"
                                                for i, t in enumerate(tl.titles)))
        for name, group in (("music", tl.music), ("voiceover", tl.voiceover), ("sfx", tl.sfx)):
            if group:
                lines.append(f"{name}: " + "; ".join(
                    f"{a.media} @{a.start:.2f}" + (f" segments={a.segments}" if a.segments else
                                                     f" in={a.src_in:.2f}" + (f" dur={a.duration:.2f}" if a.duration else ""))
                    + (f" gain={a.gain_db}" if a.gain_db else "") for a in group))
        g = tl.grade
        lines.append(f"grade: {g.preset} ×{g.intensity} auto_match={g.auto_match} letterbox={g.letterbox} "
                     f"grain={g.grain} vignette={g.vignette} · fade_in={tl.fade_in} fade_out={tl.fade_out}")
        a = tl.audio
        lines.append(f"audio: target {a.target_lufs} LUFS / {a.true_peak} dBTP · duck {a.duck_db} dB · "
                     f"dialog_enhance={a.dialog_enhance} denoise={a.denoise}")
        if d["warnings"]:
            lines.append("warnings: " + " | ".join(d["warnings"]))
        if d.get("off_beat_cuts"):
            lines.append("off-beat cuts: " + ", ".join(d["off_beat_cuts"]))
        return "\n".join(lines)

    def _save(self) -> None:
        assert self.tl is not None
        self.tl.save(self.project.timeline_path)
        self.emit({"type": "timeline"})

    # ------------------------------------------------------------------ диспетчер
    def call(self, name: str, args: dict) -> list[dict] | str:
        fn = getattr(self, f"t_{name}", None)
        if fn is None:
            raise ToolError(f"Unknown tool: {name}")
        return fn(**(args or {}))

    # ------------------------------------------------------------------ құралдар
    def t_project_overview(self) -> str:
        return json.dumps(self.overview(), ensure_ascii=False)

    def t_view_media(self, items: list[dict]) -> list[dict]:
        if not items:
            raise ToolError("items is empty")
        blocks: list[dict] = []
        for it in items[:6]:
            ref = str(it.get("media", ""))
            try:
                m = self.project.find(ref)
            except KeyError:
                blocks.append({"type": "text", "text": f"{ref}: not found"})
                continue
            if not m.is_visual:
                blocks.append({"type": "text", "text": f"{m.id}: is audio ({m.role}); use music_grid/overview"})
                continue
            a = self.project.analysis(m.id).video
            path = self.project.abspath(m)
            if m.kind == "image":
                img = qc.contact_sheet(path, [0.0], labels=[m.id], cols=1, tile_w=900, is_image=True,
                                       title=f"{m.id} · {m.name} · {m.width}x{m.height}")
                blocks.append({"type": "text", "text": f"{m.id} {m.name}: photo {m.width}x{m.height}"})
                blocks.append(_img_block(qc.to_jpeg_bytes(img)))
                continue
            start = max(0.0, float(it.get("start") or 0.0))
            end = min(m.duration, float(it.get("end") or m.duration))
            if end <= start:
                start, end = 0.0, m.duration
            n = int(max(4, min(16, it.get("frames") or 8)))
            times = qc.sample_times(start, end, n)
            cuts = [s.start for s in (a.shots if a else [])[1:]]
            marks = []
            prev = start
            for t in times:
                marks.append("CUT" if any(prev < c <= t for c in cuts) else "")
                prev = t
            cols = 4 if m.width >= m.height else 6
            img = qc.contact_sheet(path, times, cols=cols, tile_w=300 if cols == 4 else 200, marks=marks,
                                   title=f"{m.id} · {m.name} · {start:.2f}–{end:.2f}s of {m.duration:.2f}s")
            shots = ""
            if a:
                shots = "; ".join(f"{s.start:.2f}–{s.end:.2f} (sharp {s.sharpness:.2f}, motion {s.motion:.2f})"
                                  for s in a.shots if s.end > start and s.start < end)
            blocks.append({"type": "text", "text": f"{m.id} {m.name} [{start:.2f}–{end:.2f}] shots: {shots}"})
            blocks.append(_img_block(qc.to_jpeg_bytes(img)))
        return blocks

    def t_music_grid(self, media: str | None = None, timeline: bool = False, start: float = 0.0,
                     end: float | None = None) -> str:
        if timeline:
            if self.tl is None:
                raise ToolError("No timeline yet")
            beats, downs = timeline_grid(self.project, self.tl)
            if not beats:
                return "Timeline has no analysed music."
            res = resolve_for(self.project, self.tl)
            return json.dumps({"timeline_total": round(res.total, 3), "beats": beats, "downbeats": downs},
                              ensure_ascii=False)
        if not media:
            ms = self.project.media("music")
            if not ms:
                raise ToolError("No music in the project")
            media = ms[0].id
        m = self.project.find(media)
        mu = self.project.analysis(m.id).music
        if mu is None:
            raise ToolError(f"{m.id} has no music analysis")
        end = end if end is not None else mu.duration
        return json.dumps({
            "media": m.id, "bpm": mu.bpm, "confidence": mu.confidence, "duration": mu.duration,
            "beats": [b for b in mu.beats if start <= b <= end],
            "downbeats": [b for b in mu.downbeats if start <= b <= end],
            "sections": [asdict(s) for s in mu.sections], "drops": mu.drops,
        }, ensure_ascii=False)

    def t_auto_draft(self, style: str | None = None, target_duration: float | None = None,
                     music: str | None = None, music_fit: str | None = None, title: str | None = None) -> str:
        tl, info = build(self.project, style=style, target=target_duration or None, title=title,
                         music_id=music or None, music_fit=music_fit, use_music=music != "")
        self.tl = tl
        self._save()
        return "Draft created: " + json.dumps(info, ensure_ascii=False) + "\n" + self.table()

    def _validate(self, tl: Timeline) -> None:
        ids = {m.id for m in self.project.media()}
        if not tl.clips:
            raise ToolError("Timeline must contain at least one clip")
        for i, c in enumerate(tl.clips, 1):
            if c.media not in ids:
                raise ToolError(f"clip #{i}: unknown media '{c.media}'")
            if c.transition.type not in TRANSITIONS:
                raise ToolError(f"clip #{i}: unknown transition '{c.transition.type}'")
            if c.motion not in MOTIONS:
                raise ToolError(f"clip #{i}: unknown motion '{c.motion}'")
            if c.reframe not in REFRAMES:
                raise ToolError(f"clip #{i}: unknown reframe '{c.reframe}'")
            if c.audio not in AUDIO_MODES:
                raise ToolError(f"clip #{i}: unknown audio mode '{c.audio}'")
        for group in (tl.music, tl.voiceover, tl.sfx):
            for a in group:
                if a.media not in ids:
                    raise ToolError(f"unknown audio media '{a.media}'")
        if tl.grade.preset not in GRADES:
            raise ToolError(f"unknown grade preset '{tl.grade.preset}'")

    def t_set_timeline(self, timeline: dict) -> str:
        if not isinstance(timeline, dict):
            raise ToolError("timeline must be an object")
        tl = Timeline.from_dict(timeline)
        if self.tl is not None and "style" not in timeline:
            tl.style = self.tl.style
        self._validate(tl)
        self.tl = tl
        self._save()
        return self.table()

    def t_edit_timeline(self, ops: list[dict]) -> str:
        if self.tl is None:
            raise ToolError("No timeline yet — use auto_draft or set_timeline first")
        tl = Timeline.from_dict(self.tl.to_dict())  # көшірме: қате болса, ескісі сақталады
        n_ok = 0
        for k, op in enumerate(ops, 1):
            kind = op.get("op")
            try:
                if kind == "update_clip":
                    i = int(op["index"]) - 1
                    cur = asdict(tl.clips[i])
                    cur.update(op.get("fields") or {})
                    tl.clips[i] = Clip.from_dict(cur)
                elif kind == "insert_clip":
                    i = int(op.get("index", len(tl.clips) + 1)) - 1
                    tl.clips.insert(max(0, min(len(tl.clips), i)), Clip.from_dict(op["clip"]))
                elif kind == "delete_clip":
                    del tl.clips[int(op["index"]) - 1]
                elif kind == "move_clip":
                    c = tl.clips.pop(int(op["from"]) - 1)
                    tl.clips.insert(max(0, min(len(tl.clips), int(op["to"]) - 1)), c)
                elif kind == "set":
                    path = str(op["path"]).split(".")
                    obj: Any = tl
                    for part in path[:-1]:
                        obj = getattr(obj, part)
                    if not hasattr(obj, path[-1]):
                        raise ToolError(f"unknown field {op['path']}")
                    setattr(obj, path[-1], op.get("value"))
                elif kind == "add_title":
                    tl.titles.append(Title.from_dict(op["title"]))
                elif kind == "update_title":
                    i = int(op["index"]) - 1
                    cur = asdict(tl.titles[i])
                    cur.update(op.get("fields") or {})
                    tl.titles[i] = Title.from_dict(cur)
                elif kind == "remove_title":
                    del tl.titles[int(op["index"]) - 1]
                elif kind == "set_audio":
                    track = op.get("track")
                    if track not in ("music", "voiceover", "sfx"):
                        raise ToolError("track must be music|voiceover|sfx")
                    setattr(tl, track, [AudioItem.from_dict(a) for a in op.get("items") or []])
                else:
                    raise ToolError(f"unknown op '{kind}'")
                n_ok += 1
            except (IndexError, KeyError, TypeError, ValueError) as e:
                raise ToolError(f"op #{k} ({kind}) failed: {e!r}. No changes applied.") from None
        self._validate(tl)
        self.tl = tl
        self._save()
        return f"Applied {n_ok} ops.\n" + self.table()

    def t_fit_music(self, media: str, target_duration: float, strategy: str = "auto", gain_db: float = 0.0) -> str:
        m = self.project.find(media)
        mu = self.project.analysis(m.id).music
        if mu is None:
            raise ToolError(f"{m.id} has no music analysis")
        fit = fit_music(mu, float(target_duration), strategy or "auto")
        item = AudioItem(m.id, 0.0, segments=fit.segments, fade_in=fit.fade_in, fade_out=max(0.3, fit.fade_out),
                         gain_db=gain_db, note=f"music fit: {fit.strategy}")
        if self.tl is None:
            self.tl = Timeline()
        self.tl.music = [item]
        if self.tl.clips:
            self._save()
        return json.dumps({
            "strategy": fit.strategy, "segments": fit.segments, "music_length": fit.length,
            "joins": fit.joins, "timeline_beats": fit.beats, "timeline_downbeats": fit.downbeats,
            "timeline_sections": fit.sections, "timeline_drops": fit.drops,
            "hint": "Make the picture end at music_length; land cuts on timeline_beats/downbeats.",
        }, ensure_ascii=False)

    def t_snap_to_beats(self, unit: str = "beat", max_shift: float = 0.35) -> str:
        if self.tl is None:
            raise ToolError("No timeline yet")
        r = snap_cuts(self.project, self.tl, unit or "beat", float(max_shift or 0.35))
        self._save()
        return json.dumps(r, ensure_ascii=False) + "\n" + self.table()

    def _progress(self, stage: str, frac: float) -> None:
        last = getattr(self, "_last_prog", ("", -1.0))
        if stage == last[0] and frac - last[1] < 0.02 and frac < 1.0:
            return
        self._last_prog = (stage, frac)
        self.emit({"type": "progress", "stage": stage, "value": round(frac, 3)})

    def t_render_preview(self) -> list[dict]:
        if self.tl is None or not self.tl.clips:
            raise ToolError("No timeline to render")
        r = render(self.project, self.tl, mode="preview", progress=self._progress)
        self.last_preview = r
        self.emit({"type": "render", "mode": "preview", "path": r.path.relative_to(self.project.root).as_posix(),
                   "t": time.time()})
        res = resolve_for(self.project, self.tl)
        placed = res.placed
        if len(placed) > 24:
            step = len(placed) / 24
            placed = [placed[int(i * step)] for i in range(24)]
        times = [round(p.start + p.duration / 2, 2) for p in placed]
        labels = [f"#{p.index + 1} {qc.timecode(t)}" for p, t in zip(placed, times)]
        W, H = r.width, r.height
        cols = 6 if W >= H else 8
        img = qc.contact_sheet(r.path, times, labels=labels, cols=cols, tile_w=260 if W >= H else 150,
                               title=f"PREVIEW QC · {r.duration:.2f}s · {len(res.placed)} clips")
        a = r.audio
        tgt = self.tl.audio.target_lufs
        report = {
            "duration": r.duration, "size": f"{W}x{H}", "render_seconds": r.elapsed,
            "loudness": {"integrated_lufs": a.get("integrated_lufs"), "target_lufs": tgt,
                         "true_peak_dbtp": a.get("true_peak"), "lra": a.get("lra")},
            "dialog_clips": a.get("dialog_clips"), "ambience_clips": a.get("ambience_clips"),
            "music_ducked_seconds": a.get("ducked_seconds"), "warnings": r.warnings,
        }
        return [{"type": "text", "text": json.dumps(report, ensure_ascii=False)},
                _img_block(qc.to_jpeg_bytes(img))]

    def t_inspect_preview(self, times: list[float]) -> list[dict]:
        if self.last_preview is None or not self.last_preview.path.exists():
            raise ToolError("Render a preview first")
        times = [max(0.0, min(self.last_preview.duration - 0.02, float(t))) for t in times[:16]]
        W, H = self.last_preview.width, self.last_preview.height
        img = qc.contact_sheet(self.last_preview.path, times, cols=4 if W >= H else 6,
                               tile_w=320 if W >= H else 180, title="PREVIEW · inspect")
        return [_img_block(qc.to_jpeg_bytes(img))]

    def t_render_final(self, stems: bool = False) -> str:
        if self.tl is None or not self.tl.clips:
            raise ToolError("No timeline to render")
        r = render(self.project, self.tl, mode="final", stems=bool(stems), progress=self._progress)
        self.last_final = r
        exports = export_all(self.project, self.tl)
        rel = r.path.relative_to(self.project.root).as_posix()
        self.emit({"type": "render", "mode": "final", "path": rel, "t": time.time()})
        return json.dumps({"video": str(r.path), "duration": r.duration, "size": f"{r.width}x{r.height}",
                           "fps": r.fps, "audio": r.audio, "exports": exports,
                           "stems": str(r.stems) if r.stems else None, "render_seconds": r.elapsed},
                          ensure_ascii=False)


def summarize_input(name: str, args: dict) -> str:
    """UI үшін құрал шақыруының қысқа сипаттамасы."""
    if name == "view_media":
        return ", ".join(str(i.get("media")) + (f" [{i.get('start')}–{i.get('end')}]" if i.get("start") is not None
                                               else "") for i in args.get("items", []))
    if name == "edit_timeline":
        return f"{len(args.get('ops', []))} өзгеріс"
    if name == "set_timeline":
        return f"{len((args.get('timeline') or {}).get('clips', []))} кадр"
    if name == "auto_draft":
        return " ".join(f"{k}={v}" for k, v in args.items() if v not in (None, ""))
    if name in ("fit_music", "snap_to_beats", "inspect_preview", "music_grid"):
        return json.dumps(args, ensure_ascii=False)[:120]
    return ""


TOOL_LABELS = {
    "project_overview": "Жобаны шолу",
    "view_media": "Кадрларды қарау",
    "music_grid": "Музыка ырғағы",
    "auto_draft": "Алғашқы нұсқа",
    "set_timeline": "Таймлайн жазу",
    "edit_timeline": "Монтажды түзету",
    "fit_music": "Музыканы ұзақтыққа келтіру",
    "snap_to_beats": "Кесулерді битке қою",
    "render_preview": "Алдын ала көру рендері",
    "inspect_preview": "Рендерді тексеру",
    "render_final": "Финал рендер және экспорт",
}

__all__ = ["TOOLS", "ToolBox", "ToolError", "summarize_input", "TOOL_LABELS", "MediaItem"]
