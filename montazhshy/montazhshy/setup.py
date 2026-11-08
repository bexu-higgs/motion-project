"""Терминалдағы баптау шебері: FFmpeg тексеру, Anthropic API кілті, жұмыс қалтасы, демо жоба."""

from __future__ import annotations

import getpass
import os
import shutil
import subprocess
import sys
from pathlib import Path

from . import config, ffmpeg


def _ask(q: str, default: str = "") -> str:
    try:
        ans = input(f"{q}{f' [{default}]' if default else ''}: ").strip()
    except EOFError:
        ans = ""
    return ans or default


def _yes(q: str, default: bool = True) -> bool:
    ans = _ask(q + (" (И/ж)" if default else " (и/Ж)")).lower()
    if not ans:
        return default
    return ans[0] in ("и", "y", "д", "i")


def check_ffmpeg() -> bool:
    ffmpeg.ffmpeg_bin.cache_clear()
    ffmpeg.ffprobe_bin.cache_clear()
    found = ffmpeg.which_all()
    if found["ffmpeg"] and found["ffprobe"]:
        ffmpeg.version.cache_clear()
        v = ffmpeg.version()
        ok = v >= (5, 1)
        print(f"✅ FFmpeg {v[0]}.{v[1]}: {found['ffmpeg']}" + ("" if ok else "  ⚠ 5.1 не одан жаңасы ұсынылады"))
        return True
    print("❌ FFmpeg табылмады.")
    if sys.platform == "win32":
        print("   Орнату: winget install --id Gyan.FFmpeg -e   (кейін терминалды қайта ашыңыз)")
        if shutil.which("winget") and _yes("   Қазір winget арқылы орнатайын ба?"):
            subprocess.run(["winget", "install", "--id", "Gyan.FFmpeg", "-e"], check=False)
            print("   Терминалды жауып, қайта ашыңыз да, `montazhshy setup` командасын қайталаңыз.")
    elif sys.platform == "darwin":
        print("   Орнату: brew install ffmpeg")
    else:
        print("   Орнату: sudo apt install ffmpeg   (немесе дистрибутивіңіздің пакет менеджері)")
    return False


def setup_key() -> None:
    have = bool(os.environ.get("ANTHROPIC_API_KEY"))
    print("\n🔑 ЖИ агентіне Anthropic API кілті керек (console.anthropic.com → API Keys).")
    print("   Кілтсіз де жұмыс істейді: «Автомонтаж» режимі (ЖИ-сыз) қолжетімді.")
    if have and not _yes("   Кілт бұрыннан бар. Ауыстырасыз ба?", False):
        return
    key = getpass.getpass("   API кілті (sk-ant-…, бос қалдыруға болады): ").strip()
    if not key:
        return
    if not key.startswith("sk-ant-"):
        print("   ⚠ Кілт «sk-ant-» деп басталуы керек. Сақталмады.")
        return
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=key)
        m = client.models.retrieve("claude-opus-5-5")
        print(f"   ✅ Кілт жарамды. Модель: {m.display_name}")
    except Exception as e:  # желі болмауы мүмкін — бәрібір сақтаймыз
        print(f"   ⚠ Кілтті тексеру мүмкін болмады ({type(e).__name__}). Бәрібір сақтаймын.")
    path = config.save_env({"ANTHROPIC_API_KEY": key})
    print(f"   Сақталды: {path}")


def wizard() -> None:
    config.load_env()
    print("\n🎬 Монтажшы — баптау шебері\n")
    ok = check_ffmpeg()
    setup_key()
    ws = Path(_ask("\n📁 Жобалар қалтасы", str(config.workspace()))).expanduser()
    ws.mkdir(parents=True, exist_ok=True)
    if str(ws) != str(config.DEFAULT_WORKSPACE):
        config.save_env({"MONTAZH_WORKSPACE": str(ws)})
    if ok and _yes("\n🧪 Сынақ (демо) жобасын жасайын ба?"):
        from .demo import create_demo_project

        root = create_demo_project(ws / "Демо_жоба")
        print(f"   ✅ {root}")
    print("\nДайын! Іске қосу:")
    print("   Студия (браузер):  montazhshy studio   немесе start.sh / start.bat")
    print("   Терминалда ЖИ:     montazhshy agent <қалта> \"тапсырма\"")
    print("   ЖИ-сыз:            montazhshy auto <қалта> --style cinematic --final\n")
    if ok and _yes("Студияны қазір ашайын ба?"):
        from .studio.server import serve

        serve(None, workspace=ws)
