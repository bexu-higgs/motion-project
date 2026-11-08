"""Монтажшы — командалық жол.

    montazhshy                         Студияны ашу (браузерде)
    montazhshy studio [қалта]          Студияны белгілі жобамен ашу
    montazhshy agent  қалта "тапсырма" ЖИ агентімен монтаж (терминалда)
    montazhshy auto   қалта            ЖИ-сыз автомонтаж + рендер
    montazhshy analyze қалта           Тек талдау (кесінділер, бит, сөйлеу)
    montazhshy render qалта [--final]  timeline.json-ды рендерлеу
    montazhshy export қалта            Premiere/DaVinci XML, EDL, SRT
    montazhshy demo   [қалта]          Сынақ жобасын жасау
    montazhshy setup                   Баптау шебері (FFmpeg, API кілті)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import config, ffmpeg

C = {"dim": "\033[2m", "b": "\033[1m", "g": "\033[32m", "r": "\033[31m", "y": "\033[33m", "c": "\033[36m",
     "x": "\033[0m"}
if not sys.stdout.isatty():
    C = {k: "" for k in C}


def _enable_utf8() -> None:
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass
    if sys.platform == "win32":
        import os

        os.system("")  # Windows терминалында ANSI түстерін қосу


_last_bar = {"stage": "", "frac": -1.0}


def bar(stage: str, frac: float, width: int = 28) -> None:
    if not sys.stdout.isatty():  # журналға жазғанда әр 10% сайын ғана
        if stage == _last_bar["stage"] and frac - _last_bar["frac"] < 0.1 and frac < 1:
            return
        _last_bar.update(stage=stage, frac=frac)
        print(f"  {frac * 100:5.1f}%  {stage}")
        return
    n = int(frac * width)
    sys.stdout.write(f"\r  {C['c']}{'█' * n}{'░' * (width - n)}{C['x']} {frac * 100:5.1f}%  {stage[:48]:<48}")
    sys.stdout.flush()
    if frac >= 1:
        sys.stdout.write("\n")


def open_project(folder: str | None, apply: dict | None = None):
    from .project import Project

    root = Path(folder or ".").expanduser()
    if not root.exists():
        raise SystemExit(f"Қалта табылмады: {root}")
    p = Project.open(root)
    if apply:
        p.update_settings(**{k: v for k, v in apply.items() if v is not None})
    items = p.scan()
    print(f"{C['b']}📁 {p.root}{C['x']} — {len(items)} файл")
    p.analyze(progress=lambda s, f: bar(s, f))
    return p


def _settings_from(args) -> dict:
    d = {}
    for k in ("style", "aspect", "platform", "title", "grade", "music_fit"):
        v = getattr(args, k, None)
        if v:
            d[k] = v
    if getattr(args, "duration", None):
        d["target_duration"] = float(args.duration)
    if getattr(args, "script", None):
        sp = Path(args.script)
        d["script"] = sp.read_text("utf-8") if sp.exists() else args.script
    return d


def cmd_auto(args) -> None:
    from .autoedit import build
    from .export.nle import export_all
    from .render.renderer import render

    p = open_project(args.folder, _settings_from(args))
    tl, info = build(p)
    tl.save(p.timeline_path)
    print(f"{C['g']}✂️  {tl.notes}{C['x']}")
    mode = "final" if args.final else "preview"
    r = render(p, tl, mode=mode, stems=args.stems, progress=bar)
    a = r.audio
    print(f"{C['g']}✅ {r.path}{C['x']}  ({r.duration:.1f} с, {r.width}×{r.height}, "
          f"{a.get('integrated_lufs')} LUFS, шың {a.get('true_peak')} dBTP, {r.elapsed:.0f} с)")
    if mode == "final":
        for k, v in export_all(p, tl).items():
            print(f"   📄 {k}: {v}")


def cmd_analyze(args) -> None:
    p = open_project(args.folder)
    for m in p.media():
        a = p.analysis(m.id)
        extra = []
        if a.video and m.kind == "video":
            extra.append(f"{len(a.video.shots)} кесінді")
        if a.audio:
            extra.append(f"{a.audio.lufs} LUFS" if a.audio.lufs is not None else "тыныш")
            if a.audio.speech_ratio > 0.2:
                extra.append(f"сөйлеу {a.audio.speech_ratio * 100:.0f}%")
        if a.music:
            extra.append(f"{a.music.bpm:.1f} BPM, {len(a.music.downbeats)} такт, "
                         f"бөлімдер: {', '.join(s.label for s in a.music.sections)}")
        print(f"  {C['y']}{m.id:<4}{C['x']} {m.path:<40} {m.role:<10} {', '.join(extra)}")


def cmd_render(args) -> None:
    from .export.nle import export_all
    from .render.renderer import render
    from .timeline import Timeline

    p = open_project(args.folder)
    if not p.timeline_path.exists():
        raise SystemExit("timeline.json жоқ — алдымен `auto` не `agent` командасын іске қосыңыз.")
    tl = Timeline.load(p.timeline_path)
    r = render(p, tl, mode="final" if args.final else "preview", stems=args.stems, progress=bar)
    print(f"{C['g']}✅ {r.path}{C['x']}  {json.dumps(r.audio, ensure_ascii=False)}")
    if args.final:
        export_all(p, tl)


def cmd_export(args) -> None:
    from .export.nle import export_all
    from .timeline import Timeline

    p = open_project(args.folder)
    if not p.timeline_path.exists():
        raise SystemExit("timeline.json жоқ.")
    for k, v in export_all(p, Timeline.load(p.timeline_path)).items():
        print(f"  📄 {k}: {v}")


def cmd_agent(args) -> None:
    from .agent.agent import EditorAgent, api_key_configured

    if not api_key_configured():
        raise SystemExit("ANTHROPIC_API_KEY орнатылмаған. `montazhshy setup` іске қосыңыз немесе `auto` командасын "
                         "қолданыңыз (ЖИ-сыз).")
    p = open_project(args.folder, _settings_from(args))
    state = {"think": False, "text": False}

    def on(ev: dict) -> None:
        t = ev.get("type")
        if t == "thinking_delta":
            if not state["think"]:
                sys.stdout.write(f"\n{C['dim']}💭 ")
                state["think"] = True
            sys.stdout.write(ev["text"])
            sys.stdout.flush()
        elif t == "text_delta":
            if state["think"]:
                sys.stdout.write(C["x"] + "\n")
                state["think"] = False
            if not state["text"]:
                sys.stdout.write(f"\n{C['b']}🎬 ")
                state["text"] = True
            sys.stdout.write(ev["text"])
            sys.stdout.flush()
        elif t == "tool":
            if state["think"] or state["text"]:
                sys.stdout.write(C["x"] + "\n")
            state.update(think=False, text=False)
            detail = f" {C['dim']}{ev.get('detail')}{C['x']}" if ev.get("detail") else ""
            print(f"  {C['c']}▸ {ev['label']}{C['x']}{detail}")
        elif t == "progress":
            bar(ev.get("stage", ""), ev.get("value", 0))
        elif t == "tool_done":
            mark = f"{C['g']}✓{C['x']}" if ev.get("ok") else f"{C['r']}✗ {ev.get('summary', '')}{C['x']}"
            print(f"    {mark} {C['dim']}{ev.get('seconds', 0)} с{C['x']}")
        elif t == "error":
            print(f"\n{C['r']}⚠ {ev['text']}{C['x']}")
        elif t == "done":
            if state["think"] or state["text"]:
                sys.stdout.write(C["x"] + "\n")
            state.update(think=False, text=False)
            u = ev.get("usage") or {}
            print(f"{C['dim']}— токендер: кіріс {u.get('input', 0):,}, шығыс {u.get('output', 0):,}, "
                  f"кэштен {u.get('cache_read', 0):,}{C['x']}")

    agent = EditorAgent(p, model=args.model, effort=args.effort, emit=on)
    request = args.request or "Сценарий бойынша кәсіби монтаж жаса."
    while True:
        t0 = time.time()
        try:
            agent.run(request)
        except KeyboardInterrupt:
            agent.stop()
            print("\nТоқтатылды.")
        print(f"{C['dim']}({time.time() - t0:.0f} с){C['x']}")
        if args.once:
            break
        try:
            request = input(f"\n{C['b']}Түзету керек пе? (бос жол — шығу) › {C['x']}").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not request:
            break


def cmd_studio(args) -> None:
    from .studio.server import serve

    folder = Path(args.folder).expanduser().resolve() if args.folder else None
    serve(folder, port=args.port, open_browser=not args.no_browser)


def cmd_demo(args) -> None:
    from .demo import create_demo_project

    root = Path(args.folder or (config.workspace() / "Демо_жоба")).expanduser()
    print(f"Демо жоба жасалуда: {root}")
    create_demo_project(root)
    print(f"{C['g']}✅ Дайын.{C['x']} Енді:\n   montazhshy auto \"{root}\"\n   montazhshy studio \"{root}\"")


def cmd_setup(args) -> None:
    from .setup import wizard

    wizard()


def main(argv: list[str] | None = None) -> None:
    _enable_utf8()
    config.load_env()
    ap = argparse.ArgumentParser(prog="montazhshy", description="Монтажшы — кәсіби видеомонтаж ЖИ агенті")
    sub = ap.add_subparsers(dest="cmd")

    def common(sp, folder_required: bool = True):
        if folder_required:
            sp.add_argument("folder", help="жоба қалтасы (видео, фото, музыка)")
        sp.add_argument("--style", choices=["cinematic", "dynamic", "documentary", "wedding", "trailer", "vlog"])
        sp.add_argument("--aspect", choices=["16:9", "9:16", "1:1", "4:5", "2.39:1"])
        sp.add_argument("--platform", choices=["youtube", "instagram", "tiktok", "tv", "cinema", "podcast"])
        sp.add_argument("--duration", type=float, help="мақсатты ұзақтық, секунд")
        sp.add_argument("--script", help="сценарий файлы немесе мәтіні")
        sp.add_argument("--title", help="фильм атауы (титр)")
        sp.add_argument("--grade", help="түс пресеті (cinematic, warm, cool, moody, vibrant, bw, vintage, wedding)")
        sp.add_argument("--music-fit", dest="music_fit", choices=["auto", "edit", "backtime", "fade", "loop"])

    s = sub.add_parser("studio", help="браузердегі студия")
    s.add_argument("folder", nargs="?")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--no-browser", action="store_true")
    s.set_defaults(fn=cmd_studio)

    s = sub.add_parser("agent", help="ЖИ агентімен монтаж")
    common(s)
    s.add_argument("request", nargs="?", help="тапсырма (мысалы: «45 секундтық той видеосын жаса»)")
    s.add_argument("--model", help="Claude моделі (әдепкі: claude-opus-5-5)")
    s.add_argument("--effort", choices=["low", "medium", "high", "xhigh", "max"])
    s.add_argument("--once", action="store_true", help="түзету сұрамай аяқтау")
    s.set_defaults(fn=cmd_agent)

    s = sub.add_parser("auto", help="ЖИ-сыз автомонтаж")
    common(s)
    s.add_argument("--final", action="store_true", help="толық сапада рендерлеу + экспорт")
    s.add_argument("--stems", action="store_true", help="диалог/музыка/эффект стемдері")
    s.set_defaults(fn=cmd_auto)

    s = sub.add_parser("analyze", help="тек талдау")
    s.add_argument("folder")
    s.set_defaults(fn=cmd_analyze)

    s = sub.add_parser("render", help="timeline.json рендері")
    s.add_argument("folder")
    s.add_argument("--final", action="store_true")
    s.add_argument("--stems", action="store_true")
    s.set_defaults(fn=cmd_render)

    s = sub.add_parser("export", help="Premiere/DaVinci XML, EDL, SRT")
    s.add_argument("folder")
    s.set_defaults(fn=cmd_export)

    s = sub.add_parser("demo", help="сынақ жобасын жасау")
    s.add_argument("folder", nargs="?")
    s.set_defaults(fn=cmd_demo)

    s = sub.add_parser("setup", help="баптау шебері")
    s.set_defaults(fn=cmd_setup)

    args = ap.parse_args(argv)
    if not getattr(args, "fn", None):
        args = ap.parse_args(["studio", *(argv or [])])
    try:
        ffmpeg.ffmpeg_bin()
        ffmpeg.ffprobe_bin()
    except ffmpeg.FFmpegMissing as e:
        if args.cmd != "setup":
            raise SystemExit(f"❌ {e}\n   Немесе: montazhshy setup") from None
    try:
        args.fn(args)
    except ffmpeg.FFmpegError as e:
        raise SystemExit(f"{C['r']}❌ {e}{C['x']}") from None
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
