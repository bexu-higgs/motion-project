"""Кәсіби бағдарламаларға экспорт.

  * FCP7 XML (xmeml v5) — Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro 7 ашады;
  * CMX3600 EDL — кез келген монтаж/түс бағдарламасы;
  * SRT — титрлер субтитр ретінде.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

from ..media import MediaItem
from ..project import Project
from ..render.renderer import resolve_for
from ..timeline import Timeline


def _rate(fps: float) -> tuple[int, bool]:
    for base in (24, 30, 60):
        if abs(fps - base * 1000 / 1001) < 0.01:
            return base, True
    return int(round(fps)), False


def _rate_xml(fps: float, ind: str) -> str:
    tb, ntsc = _rate(fps)
    return f"{ind}<rate><timebase>{tb}</timebase><ntsc>{'TRUE' if ntsc else 'FALSE'}</ntsc></rate>\n"


def _pathurl(p: Path) -> str:
    posix = p.resolve().as_posix()
    if not posix.startswith("/"):
        posix = "/" + posix  # Windows: /C:/...
    return "file://localhost" + quote(posix, safe="/:")


def tc(frames: int, fps: float) -> str:
    tb, _ = _rate(fps)
    f = frames % tb
    s = frames // tb
    return f"{s // 3600:02d}:{(s // 60) % 60:02d}:{s % 60:02d}:{f:02d}"


def export_xml(project: Project, tl: Timeline, out: Path, name: str = "Montazhshy") -> Path:
    fps = project.output_fps()
    W, H = project.output_size()
    res = resolve_for(project, tl, fps)
    media = {m.id: m for m in project.media()}
    files_done: set[str] = set()
    ind = "      "

    def file_xml(m: MediaItem) -> str:
        fid = f"file-{m.id}"
        if fid in files_done:
            return f'{ind}  <file id="{fid}"/>\n'
        files_done.add(fid)
        dur = int(round(m.duration * fps)) if m.duration else 1
        x = f'{ind}  <file id="{fid}">\n'
        x += f"{ind}    <name>{escape(m.name)}</name>\n"
        x += f"{ind}    <pathurl>{escape(_pathurl(project.abspath(m)))}</pathurl>\n"
        x += _rate_xml(fps, ind + "    ")
        x += f"{ind}    <duration>{dur}</duration>\n"
        x += f"{ind}    <media>\n"
        if m.is_visual:
            x += (f"{ind}      <video><samplecharacteristics><width>{m.width}</width><height>{m.height}</height>"
                  f"</samplecharacteristics></video>\n")
        if m.has_audio or m.kind == "audio":
            x += f"{ind}      <audio><channelcount>2</channelcount></audio>\n"
        x += f"{ind}    </media>\n{ind}  </file>\n"
        return x

    def clipitem(cid: str, m: MediaItem, start: int, end: int, src_in: int, note: str = "") -> str:
        dur = int(round(m.duration * fps)) if m.duration else max(end - start, 1) + src_in
        x = f'{ind}<clipitem id="{cid}">\n'
        x += f"{ind}  <name>{escape(m.name)}</name>\n"
        x += f"{ind}  <enabled>TRUE</enabled>\n"
        x += f"{ind}  <duration>{dur}</duration>\n"
        x += _rate_xml(fps, ind + "  ")
        x += f"{ind}  <start>{start}</start>\n{ind}  <end>{end}</end>\n"
        x += f"{ind}  <in>{src_in}</in>\n{ind}  <out>{src_in + (end - start)}</out>\n"
        x += file_xml(m)
        if note:
            x += f"{ind}  <comments><mastercomment1>{escape(note)}</mastercomment1></comments>\n"
        x += f"{ind}</clipitem>\n"
        return x

    # видео жолы: кесу нүктелері = ауысудың ортасы, ауысу тұтқалары (handles) арқылы
    placed = res.placed
    vtrack = ""
    atrack = ""
    for i, p in enumerate(placed):
        m = media[p.clip.media]
        t_in = int(round(p.trans.duration * fps))
        t_out = int(round(placed[i + 1].trans.duration * fps)) if i + 1 < len(placed) else 0
        start = p.start_frame + t_in // 2
        end = p.start_frame + p.frames - (t_out - t_out // 2) if t_out else p.start_frame + p.frames
        src_in = int(round(p.clip.src_in * fps)) + t_in // 2
        if m.kind == "image":
            src_in = 0
        note = p.clip.note
        if abs(p.clip.speed - 1) > 1e-3:
            note = (note + f" · жылдамдық {p.clip.speed * 100:.0f}%").strip(" ·")
        if i > 0 and t_in:
            vtrack += (f"{ind}<transitionitem>\n{ind}  <start>{start - t_in // 2}</start>"
                       f"<end>{start + (t_in - t_in // 2)}</end>\n"
                       f"{ind}  <alignment>center</alignment>\n" + _rate_xml(fps, ind + "  ") +
                       f"{ind}  <effect><name>Cross Dissolve</name><effectid>Cross Dissolve</effectid>"
                       f"<effectcategory>Dissolve</effectcategory><effecttype>transition</effecttype>"
                       f"<mediatype>video</mediatype></effect>\n{ind}</transitionitem>\n")
        vtrack += clipitem(f"clipitem-v{i + 1}", m, start, end, src_in, note)
        if m.has_audio and p.clip.audio != "mute" and m.kind == "video":
            atrack += clipitem(f"clipitem-a{i + 1}", m, start, end, src_in)
    mtrack = ""
    k = 0
    for a in tl.music:
        m = media.get(a.media)
        if m is None:
            continue
        pos = a.start
        for s0, s1 in a.source_ranges(m.duration):
            k += 1
            st = int(round(pos * fps))
            en = min(res.total_frames, int(round((pos + s1 - s0) * fps)))
            if en > st:
                mtrack += clipitem(f"clipitem-m{k}", m, st, en, int(round(s0 * fps)), "Музыка")
            pos += s1 - s0
    votrack = ""
    for j, a in enumerate(tl.voiceover + tl.sfx):
        m = media.get(a.media)
        if m is None:
            continue
        s0, s1 = a.source_ranges(m.duration)[0]
        st = int(round(a.start * fps))
        en = min(res.total_frames, int(round((a.start + s1 - s0) * fps)))
        if en > st:
            votrack += clipitem(f"clipitem-o{j + 1}", m, st, en, int(round(s0 * fps)))
    seq_rate = _rate_xml(fps, "    ")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5">\n'
           f'  <sequence id="sequence-1">\n    <name>{escape(name)}</name>\n'
           f"    <duration>{res.total_frames}</duration>\n" + seq_rate +
           "    <timecode>\n" + _rate_xml(fps, "      ") +
           "      <string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat>\n"
           "    </timecode>\n    <media>\n      <video>\n        <format><samplecharacteristics>\n" +
           _rate_xml(fps, "          ") +
           f"          <width>{W}</width><height>{H}</height><pixelaspectratio>square</pixelaspectratio>"
           "<fielddominance>none</fielddominance>\n        </samplecharacteristics></format>\n"
           f"        <track>\n{vtrack}        </track>\n      </video>\n      <audio>\n")
    for tr in (atrack, mtrack, votrack):
        if tr:
            xml += f"        <track>\n{tr}        </track>\n"
    xml += "      </audio>\n    </media>\n  </sequence>\n</xmeml>\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(xml, "utf-8")
    return out


def export_edl(project: Project, tl: Timeline, out: Path, name: str = "MONTAZHSHY") -> Path:
    fps = project.output_fps()
    res = resolve_for(project, tl, fps)
    media = {m.id: m for m in project.media()}
    lines = [f"TITLE: {name.upper()[:60]}", "FCM: NON-DROP FRAME", ""]
    ev = 0
    placed = res.placed
    for i, p in enumerate(placed):
        m = media[p.clip.media]
        t_in = int(round(p.trans.duration * fps))
        t_out = int(round(placed[i + 1].trans.duration * fps)) if i + 1 < len(placed) else 0
        rec_in = p.start_frame + t_in // 2
        rec_out = p.start_frame + p.frames - (t_out - t_out // 2) if t_out else p.start_frame + p.frames
        src_in = (int(round(p.clip.src_in * fps)) if m.kind != "image" else 0) + t_in // 2
        src_out = src_in + (rec_out - rec_in)
        reel = "AX"
        ev += 1
        if i > 0 and t_in:
            prev = placed[i - 1]
            pm = media[prev.clip.media]
            p_src = (int(round(prev.clip.src_in * fps)) if pm.kind != "image" else 0) + (rec_in - prev.start_frame)
            lines.append(f"{ev:03d}  {reel:<8} V     C        {tc(p_src, fps)} {tc(p_src, fps)} "
                         f"{tc(rec_in, fps)} {tc(rec_in, fps)}")
            lines.append(f"{ev:03d}  {reel:<8} V     D    {t_in:03d} {tc(src_in, fps)} {tc(src_out, fps)} "
                         f"{tc(rec_in, fps)} {tc(rec_out, fps)}")
            lines.append(f"* FROM CLIP NAME: {pm.name}")
            lines.append(f"* TO CLIP NAME: {m.name}")
        else:
            lines.append(f"{ev:03d}  {reel:<8} V     C        {tc(src_in, fps)} {tc(src_out, fps)} "
                         f"{tc(rec_in, fps)} {tc(rec_out, fps)}")
            lines.append(f"* FROM CLIP NAME: {m.name}")
        if p.clip.note:
            lines.append(f"* COMMENT: {p.clip.note}")
        lines.append("")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), "utf-8")
    return out


def _srt_tc(t: float) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def export_srt(tl: Timeline, out: Path) -> Path | None:
    items = sorted(tl.titles, key=lambda t: t.start)
    if not items:
        return None
    blocks = []
    for i, t in enumerate(items, 1):
        text = t.text + (f"\n{t.subtext}" if t.subtext else "")
        blocks.append(f"{i}\n{_srt_tc(t.start)} --> {_srt_tc(t.start + t.duration)}\n{text}\n")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(blocks), "utf-8")
    return out


def export_all(project: Project, tl: Timeline, name: str | None = None) -> dict[str, str]:
    name = name or project.settings.get("title") or project.root.name
    d = project.exports_dir
    out = {
        "xml": str(export_xml(project, tl, d / "montazh_premiere_resolve.xml", name)),
        "edl": str(export_edl(project, tl, d / "montazh.edl", name)),
        "timeline": str(project.timeline_path),
    }
    srt = export_srt(tl, d / "titrler.srt")
    if srt:
        out["srt"] = str(srt)
    return out
