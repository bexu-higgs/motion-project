"""«Монтажшы Студиясы» — браузерде ашылатын жергілікті интерфейс.

Тек стандарт кітапхана (http.server). Компьютерден шықпайды: 127.0.0.1 мекенжайында ғана тыңдайды.
"""

from __future__ import annotations

import json
import mimetypes
import os
import queue
import re
import shutil
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .. import config, ffmpeg
from ..agent.agent import AgentUnavailable, EditorAgent, api_key_configured
from ..autoedit import build, timeline_grid
from ..export.nle import export_all
from ..media import AUDIO_EXT, IMAGE_EXT, VIDEO_EXT, kind_of
from ..project import DEFAULT_SETTINGS, Project
from ..render.renderer import render, resolve_for
from ..styles import GRADES, PLATFORMS, STYLES
from ..timeline import Timeline

STATIC = Path(__file__).resolve().parent / "static"
FONTS = Path(__file__).resolve().parent.parent / "fonts"
ASPECTS = ["16:9", "9:16", "1:1", "4:5", "2.39:1"]


class Hub:
    """Студия күйі: ағымдағы жоба, фондық тапсырма, агент, SSE жазылушылары."""

    def __init__(self, workspace: Path, project_dir: Path | None = None):
        self.workspace = workspace
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.subscribers: list[queue.Queue] = []
        self.job: dict | None = None
        self.agent: EditorAgent | None = None
        self.agent_thread: threading.Thread | None = None
        self.project: Project | None = None
        if project_dir is not None:
            self.open_project(project_dir)
        else:
            existing = self.list_projects()
            self.open_project(self.workspace / (existing[0] if existing else "Менің_жобам"))

    # ------------------------------------------------------------------ оқиғалар
    def broadcast(self, ev: dict) -> None:
        ev.setdefault("t", time.time())
        data = json.dumps(ev, ensure_ascii=False)
        with self.lock:
            subs = list(self.subscribers)
        for q in subs:
            try:
                q.put_nowait(data)
            except queue.Full:
                pass

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=2000)
        with self.lock:
            self.subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self.lock:
            if q in self.subscribers:
                self.subscribers.remove(q)

    # ------------------------------------------------------------------ жобалар
    def list_projects(self) -> list[str]:
        return sorted(p.name for p in self.workspace.iterdir() if p.is_dir() and not p.name.startswith("."))

    def open_project(self, path: Path) -> None:
        with self.lock:
            if self.agent and self.agent.busy:
                raise RuntimeError("Агент жұмыс істеп жатыр — алдымен тоқтатыңыз.")
            self.project = Project.open(path)
            self.agent = None
        self.start_job("Талдау", self._scan_analyze)

    @property
    def p(self) -> Project:
        assert self.project is not None
        return self.project

    # ------------------------------------------------------------------ фондық тапсырмалар
    def start_job(self, name: str, fn) -> bool:
        with self.lock:
            if self.job and not self.job.get("done"):
                return False
            self.job = {"name": name, "stage": "", "value": 0.0, "done": False, "error": None}
        self.broadcast({"type": "job", **self.job})

        def runner() -> None:
            try:
                fn()
            except Exception as e:  # қате UI-да көрсетіледі
                traceback.print_exc()
                with self.lock:
                    self.job["error"] = str(e)
            finally:
                with self.lock:
                    self.job["done"] = True
                    self.job["value"] = 1.0
                    job = dict(self.job)
                self.broadcast({"type": "job", **job})
                self.broadcast({"type": "state"})

        threading.Thread(target=runner, daemon=True).start()
        return True

    def progress(self, stage: str, value: float) -> None:
        with self.lock:
            if self.job is None:
                return
            last = self.job.get("_last", -1.0)
            if stage == self.job.get("stage") and value - last < 0.02 and value < 1:
                return
            self.job.update(stage=stage, value=value, _last=value)
            job = {k: v for k, v in self.job.items() if not k.startswith("_")}
        self.broadcast({"type": "job", **job})

    def _scan_analyze(self) -> None:
        self.progress("Файлдар ізделуде", 0.02)
        self.p.scan()
        self.broadcast({"type": "state"})
        self.p.analyze(progress=lambda s, f: self.progress(s, f))

    # ------------------------------------------------------------------ агент
    def ensure_agent(self) -> EditorAgent:
        if self.agent is None:
            if not api_key_configured():
                raise AgentUnavailable("API кілті орнатылмаған. «Баптау» бөлімінде Anthropic API кілтін енгізіңіз.")
            self.agent = EditorAgent(self.p, emit=self._agent_event)
        return self.agent

    def _agent_event(self, ev: dict) -> None:
        ev = dict(ev)
        ev["agent"] = True
        self.broadcast(ev)
        if ev.get("type") in ("timeline", "render", "done"):
            self.broadcast({"type": "state"})

    def run_agent(self, message: str) -> None:
        agent = self.ensure_agent()
        if agent.busy:
            raise RuntimeError("Агент әлі жұмыс істеп жатыр.")

        def go() -> None:
            try:
                agent.run(message)
            except Exception as e:
                traceback.print_exc()
                self.broadcast({"type": "error", "agent": True, "text": f"{type(e).__name__}: {e}"})
                self.broadcast({"type": "done", "agent": True})

        self.agent_thread = threading.Thread(target=go, daemon=True)
        self.agent_thread.start()

    # ------------------------------------------------------------------ күй
    def state(self) -> dict:
        p = self.p
        media = []
        for m in p.media():
            a = p.analysis(m.id)
            d = m.to_dict()
            d["name"] = m.name
            d["analyzed"] = p.is_analyzed(m)
            d["thumb"] = f"/files/.montazh/thumbs/{m.id}.jpg" if p.thumb_path(m.id).exists() else None
            if a.audio:
                d["speech_ratio"] = a.audio.speech_ratio
                d["lufs"] = a.audio.lufs
                if m.kind == "audio":
                    d["wave"] = a.audio.waveform
                    d["wave_rate"] = a.audio.wave_rate
            if a.music:
                d["bpm"] = a.music.bpm
                d["music_conf"] = a.music.confidence
            if a.video and m.kind == "video":
                d["shots"] = len(a.video.shots)
            media.append(d)
        tl_data = None
        if p.timeline_path.exists():
            try:
                tl = Timeline.load(p.timeline_path)
                res = resolve_for(p, tl)
                beats, downs = timeline_grid(p, tl)
                music = []
                for a in tl.music:
                    try:
                        item = p.get(a.media)
                    except KeyError:
                        continue
                    an = p.analysis(item.id).audio
                    music.append({"media": a.media, "start": a.start, "segments": a.source_ranges(item.duration),
                                  "wave": an.waveform if an else [], "wave_rate": an.wave_rate if an else 10})
                tl_data = {
                    "total": res.total, "fps": res.fps, "warnings": res.warnings,
                    "clips": [{"i": pl.index + 1, "media": pl.clip.media, "start": pl.start, "dur": pl.duration,
                               "src_in": pl.clip.src_in, "src_out": pl.clip.src_out, "speed": pl.clip.speed,
                               "trans": pl.trans.type, "tdur": pl.trans.duration, "note": pl.clip.note,
                               "motion": pl.clip.motion, "audio": pl.clip.audio}
                              for pl in res.placed],
                    "titles": [t.__dict__ for t in tl.titles],
                    "music": music,
                    "voiceover": [a.__dict__ for a in tl.voiceover],
                    "beats": beats, "downbeats": downs,
                    "grade": tl.grade.__dict__, "audio": tl.audio.__dict__, "notes": tl.notes, "style": tl.style,
                }
            except Exception as e:  # бұзылған timeline.json UI-ды құлатпасын
                tl_data = {"error": str(e)}
        renders = {}
        for mode in ("preview", "final"):
            f = p.renders_dir / f"{mode}.mp4"
            if f.exists():
                renders[mode] = {"url": f"/files/renders/{mode}.mp4?v={int(f.stat().st_mtime)}",
                                 "size": f.stat().st_size, "mtime": f.stat().st_mtime}
        exports = sorted(x.name for x in p.exports_dir.iterdir()) if p.exports_dir.exists() else []
        chat = []
        cp = p.cache_dir / "chat.json"
        if cp.exists():
            try:
                chat = json.loads(cp.read_text("utf-8"))
            except (OSError, json.JSONDecodeError):
                chat = []
        W, H = p.output_size()
        with self.lock:
            job = {k: v for k, v in (self.job or {}).items() if not k.startswith("_")} or None
        return {
            "workspace": str(self.workspace),
            "projects": self.list_projects(),
            "project": {"name": p.root.name, "path": str(p.root)},
            "settings": p.settings,
            "output": {"width": W, "height": H, "fps": p.output_fps()},
            "media": media,
            "timeline": tl_data,
            "renders": renders,
            "exports": exports,
            "chat": chat,
            "job": job,
            "agent": {"available": api_key_configured(), "busy": bool(self.agent and self.agent.busy),
                      "model": (self.agent.model if self.agent else os.environ.get("MONTAZH_MODEL")
                                or "claude-opus-5-5"),
                      "usage": self.agent.usage if self.agent else None},
            "catalog": {
                "styles": [{"key": k, "name": s.name, "desc": s.description} for k, s in STYLES.items()],
                "grades": [{"key": k, "name": g["name"]} for k, g in GRADES.items()],
                "platforms": [{"key": k, **v} for k, v in PLATFORMS.items()],
                "aspects": ASPECTS,
                "music_fit": ["auto", "edit", "backtime", "fade", "loop"],
            },
            "ffmpeg": ffmpeg.which_all(),
        }


_SAFE = re.compile(r"[^\w.\- ()\[\]әғқңөұүһіӘҒҚҢӨҰҮҺІ]+", re.UNICODE)


def safe_name(name: str) -> str:
    name = Path(name.replace("\\", "/")).name
    name = _SAFE.sub("_", name).strip(" .")
    return name[:120] or "file"


def make_handler(hub: Hub):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):  # тыныш
            pass

        # -------------------------------------------------------------- көмекшілер
        def _json(self, data, code: int = 200) -> None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _err(self, msg: str, code: int = 400) -> None:
            self._json({"error": msg}, code)

        def _body(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0:
                return {}
            raw = self.rfile.read(n)
            try:
                return json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return {}

        def _file(self, path: Path) -> None:
            if not path.exists() or not path.is_file():
                self.send_error(404)
                return
            size = path.stat().st_size
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            rng = self.headers.get("Range")
            start, end = 0, size - 1
            code = 200
            if rng:
                m = re.match(r"bytes=(\d*)-(\d*)", rng)
                if m:
                    if m.group(1):
                        start = int(m.group(1))
                        end = int(m.group(2)) if m.group(2) else size - 1
                    elif m.group(2):
                        start = max(0, size - int(m.group(2)))
                    end = min(end, size - 1)
                    code = 206
            if start > end or start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            length = end - start + 1
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(length))
            self.send_header("Cache-Control", "no-cache")
            if code == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            with path.open("rb") as f:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        return
                    left -= len(chunk)

        # -------------------------------------------------------------- GET
        def do_GET(self):  # noqa: N802
            url = urlparse(self.path)
            path = unquote(url.path)
            if path in ("/", "/index.html"):
                return self._file(STATIC / "index.html")
            if path.startswith("/static/"):
                f = (STATIC / path[len("/static/"):]).resolve()
                if STATIC.resolve() in f.parents:
                    return self._file(f)
                return self.send_error(404)
            if path.startswith("/fonts/"):
                f = (FONTS / Path(path).name).resolve()
                return self._file(f)
            if path.startswith("/files/"):
                root = hub.p.root.resolve()
                f = (root / path[len("/files/"):]).resolve()
                if root in f.parents:
                    return self._file(f)
                return self.send_error(403)
            if path == "/api/state":
                try:
                    return self._json(hub.state())
                except Exception as e:
                    traceback.print_exc()
                    return self._err(str(e), 500)
            if path == "/api/events":
                return self._sse()
            if path == "/api/timeline":
                tp = hub.p.timeline_path
                return self._json(json.loads(tp.read_text("utf-8")) if tp.exists() else None)
            self.send_error(404)

        def _sse(self) -> None:
            q = hub.subscribe()
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            try:
                self.wfile.write(b": ok\n\n")
                self.wfile.flush()
                while True:
                    try:
                        data = q.get(timeout=15)
                        self.wfile.write(f"data: {data}\n\n".encode("utf-8"))
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                hub.unsubscribe(q)
                self.close_connection = True

        # -------------------------------------------------------------- PUT (жүктеу)
        def do_PUT(self):  # noqa: N802
            url = urlparse(self.path)
            if url.path != "/api/upload":
                return self.send_error(404)
            qs = parse_qs(url.query)
            name = safe_name(qs.get("name", ["file"])[0])
            ext = Path(name).suffix.lower()
            if ext not in VIDEO_EXT | IMAGE_EXT | AUDIO_EXT and ext not in (".txt", ".md"):
                return self._err(f"Бұл файл түрі қолдау таппайды: {ext or name}")
            n = int(self.headers.get("Content-Length") or 0)
            root = hub.p.root
            if ext in (".txt", ".md"):
                text = self.rfile.read(n).decode("utf-8", errors="replace")
                hub.p.update_settings(script=text.strip())
                hub.broadcast({"type": "state"})
                return self._json({"ok": True, "script": True})
            sub = ""
            if kind_of(Path(name)) == "audio":
                sub = qs.get("folder", ["music"])[0]
                sub = sub if sub in ("music", "voiceover", "sfx") else "music"
            dest_dir = root / sub if sub else root
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / name
            k = 1
            while dest.exists():
                dest = dest_dir / f"{Path(name).stem}_{k}{Path(name).suffix}"
                k += 1
            tmp = dest.with_suffix(dest.suffix + ".part")
            left = n
            with tmp.open("wb") as f:
                while left > 0:
                    chunk = self.rfile.read(min(1 << 20, left))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
            if left > 0:
                tmp.unlink(missing_ok=True)
                return self._err("Файл толық жүктелмеді")
            tmp.replace(dest)
            return self._json({"ok": True, "path": dest.relative_to(root).as_posix()})

        # -------------------------------------------------------------- POST
        def do_POST(self):  # noqa: N802
            path = urlparse(self.path).path
            b = self._body()
            try:
                if path == "/api/scan":
                    ok = hub.start_job("Талдау", hub._scan_analyze)
                    return self._json({"ok": ok})
                if path == "/api/project":
                    name = safe_name(b.get("name") or "")
                    if not name:
                        return self._err("Жоба атауы бос")
                    hub.open_project(hub.workspace / name)
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
                if path == "/api/settings":
                    allowed = {k: b[k] for k in b if k in DEFAULT_SETTINGS}
                    if "target_duration" in allowed:
                        allowed["target_duration"] = float(allowed["target_duration"] or 0)
                    hub.p.update_settings(**allowed)
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
                if path == "/api/media/role":
                    hub.p.set_role(b["id"], b["role"])
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
                if path == "/api/media/remove":
                    m = hub.p.get(b["id"])
                    trash = hub.p.cache_dir / "trash"
                    trash.mkdir(parents=True, exist_ok=True)
                    src = hub.p.abspath(m)
                    if src.exists():
                        shutil.move(str(src), str(trash / src.name))
                    hub.start_job("Талдау", hub._scan_analyze)
                    return self._json({"ok": True})
                if path == "/api/auto":
                    def job() -> None:
                        hub.progress("Автомонтаж", 0.05)
                        tl, info = build(hub.p, style=b.get("style") or None)
                        tl.save(hub.p.timeline_path)
                        hub.broadcast({"type": "state"})
                        render(hub.p, tl, mode="preview", progress=hub.progress)
                    ok = hub.start_job("Автомонтаж", job)
                    return self._json({"ok": ok})
                if path == "/api/render":
                    mode = "final" if b.get("mode") == "final" else "preview"
                    stems = bool(b.get("stems"))

                    def job() -> None:
                        if not hub.p.timeline_path.exists():
                            raise RuntimeError("Алдымен монтаж жасаңыз (таймлайн жоқ).")
                        tl = Timeline.load(hub.p.timeline_path)
                        render(hub.p, tl, mode=mode, stems=stems, progress=hub.progress)
                        if mode == "final":
                            export_all(hub.p, tl)
                    ok = hub.start_job("Финал рендер" if mode == "final" else "Рендер", job)
                    return self._json({"ok": ok})
                if path == "/api/export":
                    if not hub.p.timeline_path.exists():
                        return self._err("Таймлайн жоқ")
                    out = export_all(hub.p, Timeline.load(hub.p.timeline_path))
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True, "files": out})
                if path == "/api/agent":
                    msg = (b.get("message") or "").strip()
                    if not msg:
                        return self._err("Хабар бос")
                    hub.run_agent(msg)
                    return self._json({"ok": True})
                if path == "/api/agent/stop":
                    if hub.agent:
                        hub.agent.stop()
                    return self._json({"ok": True})
                if path == "/api/agent/reset":
                    if hub.agent and hub.agent.busy:
                        return self._err("Агент жұмыс істеп жатыр")
                    hub.agent = None
                    cp = hub.p.cache_dir / "chat.json"
                    cp.unlink(missing_ok=True)
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
                if path == "/api/key":
                    key = (b.get("key") or "").strip()
                    if not key.startswith("sk-ant-"):
                        return self._err("Кілт «sk-ant-» деп басталуы керек")
                    vals = {"ANTHROPIC_API_KEY": key}
                    if b.get("model"):
                        vals["MONTAZH_MODEL"] = str(b["model"])
                    config.save_env(vals)
                    hub.agent = None
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
                if path == "/api/timeline":
                    tl = Timeline.from_dict(b)
                    tl.save(hub.p.timeline_path)
                    hub.broadcast({"type": "state"})
                    return self._json({"ok": True})
            except (AgentUnavailable, RuntimeError, KeyError, ValueError) as e:
                return self._err(str(e))
            except Exception as e:
                traceback.print_exc()
                return self._err(f"{type(e).__name__}: {e}", 500)
            self.send_error(404)

    return Handler


def serve(project_dir: Path | None = None, *, port: int = 8765, open_browser: bool = True,
          workspace: Path | None = None) -> None:
    ws = workspace or (project_dir.parent if project_dir else config.workspace())
    hub = Hub(ws, project_dir)
    srv = None
    for p in range(port, port + 20):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", p), make_handler(hub))
            port = p
            break
        except OSError:
            continue
    if srv is None:
        raise SystemExit("Бос порт табылмады")
    srv.daemon_threads = True
    url = f"http://127.0.0.1:{port}/"
    print(f"\n🎬 Монтажшы Студиясы: {url}\n   Жоба: {hub.p.root}\n   Тоқтату: Ctrl+C\n")
    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nСау болыңыз! 👋")
    finally:
        srv.server_close()
