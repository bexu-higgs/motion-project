"""Терминалдағы баптау шебері: python -m unobot.setup

Бот токенін сұрайды, inline режимін тексереді, әкімшінің Telegram ID-ін /start арқылы
өзі анықтайды, .env файлын жазады, стикерлерді жүктейді және ботты іске қосады.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from collections.abc import Callable
from pathlib import Path

from telegram import Bot, User
from telegram.error import InvalidToken, TelegramError

from .config import ROOT
from .stickers import StickerRegistry, upload_sticker_sets

ENV_PATH = ROOT / ".env"
DEFAULT_TIMEOUT = 90
YES = {"и", "иә", "ия", "y", "yes", "да", "д"}

ENV_COMMENTS = {
    "BOT_TOKEN": "# @BotFather берген токен",
    "ADMIN_ID": "# Бот әкімшісінің Telegram ID-і (стикер жинақтары осы адамның атына жасалады)",
    "TURN_TIMEOUT": "# Жүріске берілетін уақыт (секунд). 0 — шектеусіз.",
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


async def wait_for_private_message(bot: Bot, poll_timeout: int = 25) -> User:
    """Ботқа жеке чатта жазған бірінші адамды күту (бұрынғы хабарламалар еленбейді)."""
    await bot.delete_webhook(drop_pending_updates=True)
    offset = None
    while True:
        updates = await bot.get_updates(offset=offset, timeout=poll_timeout, allowed_updates=["message"])
        for update in updates:
            offset = update.update_id + 1
            message = update.message
            if message and message.chat.type == "private" and message.from_user and not message.from_user.is_bot:
                await bot.get_updates(offset=offset, timeout=0)  # хабарламаны оқылды деп белгілеу
                return message.from_user


class Wizard:
    def __init__(
        self,
        ask: Callable[[str], str] = input,
        out: Callable[[str], None] = print,
        make_bot: Callable[[str], Bot] = Bot,
        env_path: Path = ENV_PATH,
    ) -> None:
        self.ask = ask
        self.out = out
        self.make_bot = make_bot
        self.env_path = env_path

    async def run(self) -> bool:
        """Баптауды жүргізеді. Ботты бірден іске қосу керек болса, True қайтарады."""
        self.out(bold("\n🃏 UNO ботын баптау\n"))
        env = read_env(self.env_path)
        bot = await self.token_step(env.get("BOT_TOKEN"))
        try:
            await self.inline_step(bot)
            admin_id = await self.admin_step(bot, env.get("ADMIN_ID"))
            timeout = self.timeout_step(env.get("TURN_TIMEOUT"))
            env.update(BOT_TOKEN=bot.token, ADMIN_ID=str(admin_id), TURN_TIMEOUT=str(timeout))
            write_env(self.env_path, env)
            self.out(f"✅ Баптаулар сақталды: {self.env_path}\n")
            await self.stickers_step(bot, admin_id, env)
        finally:
            await bot.shutdown()
        self.out(bold("\n🎉 Бот дайын!"))
        self.out(
            f"Ботты топқа қосып (@{bot.username}), әкімші етіңіз (тіркелу хабарламасын бекітуі үшін)\n"
            "және /new деп жазыңыз. Бот жұмыс істеуі үшін терминал ашық тұруы керек."
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

    async def inline_step(self, bot: Bot) -> None:
        self.out(bold("2-қадам. Inline режимі"))
        me = await bot.get_me()
        while not me.supports_inline_queries:
            self.out(
                "⚠️ Inline режимі өшік — онсыз ойыншылар карталарын көре алмайды.\n"
                f"   @BotFather → /setinline → @{bot.username} → «Карта таңдаңыз…» деп жазыңыз."
            )
            self.ask("Дайын болса, Enter басыңыз…")
            me = await bot.get_me()
        self.out("✅ Inline режимі қосулы.")
        self.out(
            f"Енді @BotFather → /setinlinefeedback → @{bot.username} → Enabled таңдаңыз.\n"
            "   Онсыз бот ойыншы қай картаны таңдағанын білмейді (мұны бот өзі тексере алмайды)."
        )
        self.ask("Дайын болса, Enter басыңыз…")
        self.out("")

    async def admin_step(self, bot: Bot, existing: str | None) -> int:
        self.out(bold("3-қадам. Әкімші"))
        if existing and existing.isdigit():
            if is_yes(self.ask(f"Бұрынғы әкімші ID: {existing}. Соны қалдыру керек пе? [И/ж]: ")):
                self.out("")
                return int(existing)
        self.out(f"Telegram-да @{bot.username} ботын ашып, қазір /start деп жазыңыз.")
        self.out("Күтілуде… (тоқтату: Ctrl+C)")
        user = await wait_for_private_message(bot)
        try:
            await bot.send_message(user.id, "✅ Сіз UNO ботының әкімшісі ретінде тіркелдіңіз. Терминалға оралыңыз.")
        except TelegramError:
            pass
        self.out(f"✅ Әкімші: {user.full_name} (ID {user.id})\n")
        return user.id

    def timeout_step(self, existing: str | None) -> int:
        self.out(bold("4-қадам. Жүріс уақыты"))
        default = existing if existing and existing.isdigit() else str(DEFAULT_TIMEOUT)
        while True:
            answer = self.ask(f"Бір жүріске неше секунд беріледі? [Enter — {default}, 0 — шектеусіз]: ").strip()
            answer = answer or default
            if answer.isdigit():
                return int(answer)
            self.out("Тек сан жазыңыз.")

    async def stickers_step(self, bot: Bot, admin_id: int, env: dict[str, str]) -> None:
        self.out(bold("5-қадам. Карта стикерлері"))
        stickers_file = Path(env.get("STICKERS_FILE") or ROOT / "data" / "stickers.json")
        if not stickers_file.is_absolute():
            stickers_file = ROOT / stickers_file
        registry = StickerRegistry(stickers_file)
        registry.bind(bot.username)
        if not registry.missing():
            self.out("✅ Стикерлер бұрыннан жүктелген.")
            return
        self.out("119 стикер Telegram-ға жүктелуде — бұл 2–5 минутқа созылуы мүмкін…")
        try:
            await upload_sticker_sets(bot, admin_id, registry, env.get("STICKER_PREFIX") or "unokz")
        except Exception as exc:  # noqa: BLE001 — қатені көрсетіп, баптауды жалғастырамыз
            self.out(
                f"⚠️ Стикерлер жүктелмеді: {exc}\n"
                "   Бот іске қосылғанда қайта тырысады, не ботқа жеке чатта /setup_stickers жіберіңіз."
            )
            return
        self.out(f"✅ {len(registry.ids)} стикер дайын.")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="   %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
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
