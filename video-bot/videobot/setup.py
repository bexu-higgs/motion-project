"""Терминалдағы баптау шебері: python -m videobot.setup

Бот токенін сұрап тексереді, қажет болса cookies.txt файлын қосады, ffmpeg пен JavaScript
ортасының бар-жоғын тексереді, .env файлын жазады және ботты іске қосады.
"""

from __future__ import annotations

import asyncio
import sys
from collections.abc import Callable
from pathlib import Path

from telegram import Bot
from telegram.error import InvalidToken, TelegramError

from .config import ROOT, resolve_path
from .downloader import ffmpeg_path, js_runtime

ENV_PATH = ROOT / ".env"
YES = {"и", "иә", "ия", "y", "yes", "да", "д"}
SKIP = {"-", "жоқ", "no", "n", "ж"}

ENV_COMMENTS = {
    "BOT_TOKEN": "# @BotFather берген токен",
    "COOKIES_FILE": "# YouTube/Instagram cookies файлы (Netscape форматы). Бос болса — қолданылмайды.",
    "MAX_FILE_MB": "# Жіберілетін файлдың ең үлкен өлшемі (МБ). Бұлттағы Bot API шегі — 50.",
    "BOT_API_URL": "# Жеке Bot API сервері (мысалы, http://localhost:8081) — 2000 МБ-қа дейін жіберу үшін",
}


def bold(text: str) -> str:
    return f"\033[1m{text}\033[0m" if sys.stdout.isatty() else text


def is_yes(answer: str, default: bool = True) -> bool:
    answer = answer.strip().lower()
    return default if not answer else answer in YES


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def write_env(path: Path, values: dict[str, str]) -> None:
    lines = []
    for key, value in values.items():
        if key in ENV_COMMENTS:
            lines.append(ENV_COMMENTS[key])
        lines += [f"{key}={value}", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


class Wizard:
    def __init__(
        self,
        ask: Callable[[str], str] = input,
        out: Callable[[str], None] = print,
        make_bot: Callable[[str], Bot] = Bot,
        env_path: Path = ENV_PATH,
        find_ffmpeg: Callable[[], str | None] = ffmpeg_path,
        find_js: Callable[[], str | None] = js_runtime,
    ) -> None:
        self.ask = ask
        self.out = out
        self.make_bot = make_bot
        self.env_path = env_path
        self.find_ffmpeg = find_ffmpeg
        self.find_js = find_js

    async def run(self) -> bool:
        """Баптауды жүргізеді. Ботты бірден іске қосу керек болса, True қайтарады."""
        self.out(bold("\n🎬 Видео жүктеуші ботты баптау\n"))
        env = read_env(self.env_path)
        bot = await self.token_step(env.get("BOT_TOKEN"))
        try:
            cookies = self.cookies_step(env.get("COOKIES_FILE"))
            self.tools_step()
            env.update(BOT_TOKEN=bot.token, COOKIES_FILE=cookies)
            env.setdefault("MAX_FILE_MB", "50")
            write_env(self.env_path, env)
            self.out(f"✅ Баптаулар сақталды: {self.env_path}\n")
        finally:
            await bot.shutdown()
        self.out(bold("🎉 Бот дайын!"))
        self.out(
            f"Telegram-да @{bot.username} ботын ашып, видеоның сілтемесін жіберіңіз.\n"
            "Бот жұмыс істеуі үшін терминал ашық тұруы керек."
        )
        return is_yes(self.ask("\nБотты қазір іске қосу керек пе? [И/ж]: "))

    async def token_step(self, existing: str | None) -> Bot:
        self.out(bold("1-қадам. Бот токені"))
        self.out("Telegram-да @BotFather ботына /newbot деп жазып, жаңа бот жасаңыз — ол токен береді.")
        while True:
            hint = " [Enter — бұрынғысын қалдыру]" if existing else ""
            token = self.ask(f"Токенді қойыңыз{hint}: ").strip() or (existing or "")
            if not token:
                continue
            bot = self.make_bot(token)
            try:
                await bot.initialize()
            except InvalidToken:
                self.out("❌ Токен қате. BotFather берген токенді толық көшіріп қойыңыз.")
                existing = None
                continue
            except TelegramError as exc:
                self.out(f"❌ Telegram-ға қосылу мүмкін болмады: {exc}. Интернетті тексеріп, қайталаңыз.")
                continue
            self.out(f"✅ Бот табылды: @{bot.username}\n")
            return bot

    def cookies_step(self, existing: str | None) -> str:
        self.out(bold("2-қадам. Cookies файлы (міндетті емес)"))
        self.out(
            "YouTube кейде серверді «бот» деп бөгейді, ал Instagram кейбір видеоларды тек аккаунтқа\n"
            "кірген адамға көрсетеді. Сонда браузерден экспортталған cookies.txt файлы көмектеседі\n"
            "(README-де қалай алу керегі жазылған). Қазір жоқ болса — Enter басыңыз, кейін қосуға болады."
        )
        while True:
            hint = f"Enter — бұрынғысы ({existing}), «-» — алып тастау" if existing else "Enter — өткізу"
            answer = self.ask(f"cookies.txt файлының жолы [{hint}]: ").strip().strip('"').strip("'")
            if not answer:
                answer = existing or ""
            if not answer or answer.lower() in SKIP:
                self.out("ℹ️ Cookies қолданылмайды.\n")
                return ""
            path = resolve_path(answer)
            if path.is_file():
                self.out(f"✅ Cookies файлы: {path}\n")
                return str(path)
            self.out(f"❌ Файл табылмады: {path}")
            existing = None

    def tools_step(self) -> None:
        self.out(bold("3-қадам. Қосымша құралдар"))
        ffmpeg = self.find_ffmpeg()
        if ffmpeg:
            self.out(f"✅ ffmpeg: {ffmpeg}")
        else:
            self.out(
                "⚠️ ffmpeg табылмады — YouTube-тың 720p-ден жоғары сапалары мен MP3 жұмыс істемейді.\n"
                "   Ubuntu/Debian: sudo apt install ffmpeg   macOS: brew install ffmpeg"
            )
        runtime = self.find_js()
        if runtime:
            self.out(f"✅ JavaScript ортасы: {runtime} (YouTube үшін)")
        else:
            self.out(
                "⚠️ deno табылмады — YouTube-та кейбір сапалар көрінбеуі мүмкін.\n"
                "   Орнату: .venv/bin/python -m pip install deno"
            )
        self.out("")


def main() -> None:
    try:
        start_now = asyncio.run(Wizard().run())
    except (KeyboardInterrupt, EOFError):
        print("\nБаптау тоқтатылды.")
        sys.exit(1)
    if start_now:
        from .bot import main as run_bot

        run_bot()
    else:
        print("Кейін іске қосу үшін: ./start.sh  (Windows: start.bat)")


if __name__ == "__main__":
    main()
