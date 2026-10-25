"""Карта стикерлері: Telegram стикер жинақтарын жасау және file_id тізілімі.

Telegram-да әр стикердің file_id-і тек сол ботқа жарамды, сондықтан бот өз стикер
жинақтарын өзі жасайды (`/setup_stickers` немесе `python -m unobot.stickers`) және
file_id-лерді data/stickers.json файлына сақтайды.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from pathlib import Path

from telegram import Bot, InputSticker
from telegram.error import BadRequest, NetworkError, RetryAfter, TimedOut

from .cards import COLORED_WILD_KEYS, FACE_KEYS, OPTION_KEYS, Card, Color, colored_wild_key, grey_key
from .config import ASSETS_DIR

log = logging.getLogger(__name__)

# Бір жинақта ең көбі 120 статикалық стикер болады, сондықтан екі жинаққа бөлеміз.
STICKER_SETS: dict[str, tuple[str, ...]] = {
    "cards": FACE_KEYS + COLORED_WILD_KEYS + OPTION_KEYS,
    "grey": tuple(grey_key(k) for k in FACE_KEYS),
}
SET_TITLES = {
    "cards": "UNO қазақша — карталар",
    "grey": "UNO қазақша — сұр карталар",
}
OPTION_EMOJI = {"option_draw": "🃏", "option_pass": "⏭", "option_uno": "📢"}
COLOR_EMOJI = {"red": "🟥", "yellow": "🟨", "green": "🟩", "blue": "🟦"}


def sticker_emoji(key: str) -> str:
    key = key.removeprefix("grey_")
    if key in OPTION_EMOJI:
        return OPTION_EMOJI[key]
    for color, emoji in COLOR_EMOJI.items():
        if key.startswith(color + "_") or key.endswith("_" + color):
            return emoji
    return "🌈"


def set_name(kind: str, bot_username: str, prefix: str = "unokz") -> str:
    return f"{prefix}_{kind}_by_{bot_username}"


ALL_KEYS: frozenset[str] = frozenset(key for keys in STICKER_SETS.values() for key in keys)


class StickerRegistry:
    """Карта кілті → стикер file_id.

    Алдымен дайын пактағы (STICKER_PACK, мысалы UnoWarStickers) стикер ізделеді,
    ол жоқ болса — боттың өз жинақтарындағысы.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.bot_username: str | None = None
        self.ids: dict[str, str] = {}  # боттың өз жинақтары (data/stickers.json)
        self.pack_ids: dict[str, str] = {}  # дайын пак — әр іске қосылғанда Telegram-нан жүктеледі
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            log.warning("Стикер файлын оқу мүмкін болмады: %s", self.path)
            return
        self.bot_username = data.get("bot")
        self.ids = dict(data.get("stickers", {}))

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"bot": self.bot_username, "stickers": self.ids}
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def bind(self, bot_username: str) -> None:
        """file_id басқа боттан қалса, оларды пайдалануға болмайды."""
        if self.bot_username and self.bot_username.lower() != bot_username.lower():
            log.warning("stickers.json басқа ботқа (%s) тиесілі — еленбейді", self.bot_username)
            self.ids = {}
        self.bot_username = bot_username

    def missing(self) -> list[str]:
        """Ешбір жерде стикері жоқ кілттер."""
        return [
            key for keys in STICKER_SETS.values() for key in keys if key not in self.pack_ids and key not in self.ids
        ]

    def get(self, key: str) -> str | None:
        return self.pack_ids.get(key) or self.ids.get(key)

    def card(self, card: Card) -> str | None:
        return self.get(card.key)

    def grey(self, card: Card) -> str | None:
        return self.get(grey_key(card.key))

    def colored_wild(self, value: str, color: Color) -> str | None:
        return self.get(colored_wild_key(value, color))

    def option(self, key: str) -> str | None:
        return self.get(key)


def _input_sticker(key: str) -> InputSticker:
    path = ASSETS_DIR / f"{key}.png"
    if not path.exists():
        raise FileNotFoundError(f"{path} жоқ. Алдымен `python -m unobot.images` іске қосыңыз.")
    return InputSticker(sticker=path.read_bytes(), emoji_list=[sticker_emoji(key)], format="static")


def _seconds(value) -> float:
    return value.total_seconds() if hasattr(value, "total_seconds") else float(value)


def _is_transient(exc: Exception) -> bool:
    # BadRequest те NetworkError-дан туындайды, бірақ оны қайталаудың мәні жоқ.
    return isinstance(exc, (TimedOut, NetworkError)) and not isinstance(exc, BadRequest)


async def _call(func, *args, idempotent: bool = True, **kwargs):
    """Telegram шектеулерін (flood control) ескеріп шақыру.

    idempotent=False болса, желі қатесінде қайталамаймыз: сұраныс өтіп кетуі мүмкін.
    """
    for attempt in range(8):
        try:
            return await func(*args, read_timeout=60, write_timeout=60, **kwargs)
        except RetryAfter as exc:
            delay = _seconds(exc.retry_after) + 1
            log.info("Telegram шектеуі: %.0f секунд күтеміз", delay)
            await asyncio.sleep(delay)
        except NetworkError as exc:
            if not idempotent or not _is_transient(exc) or attempt == 7:
                raise
            await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError("Telegram жауап бермеді")


async def _sticker_count(bot: Bot, name: str) -> int | None:
    try:
        sticker_set = await _call(bot.get_sticker_set, name)
    except BadRequest:
        return None
    return len(sticker_set.stickers)


async def upload_sticker_sets(
    bot: Bot,
    owner_id: int,
    registry: StickerRegistry,
    prefix: str = "unokz",
) -> dict[str, str]:
    """Стикер жинақтарын жасап (немесе толықтырып), file_id-лерді тізілімге жазады.

    owner_id — жинақ иесі болатын Telegram қолданушысы; ол ботқа алдын ала /start жазуы керек.
    """
    me = await bot.get_me()
    registry.bind(me.username)
    names: dict[str, str] = {}
    for kind, keys in STICKER_SETS.items():
        name = set_name(kind, me.username, prefix)
        names[kind] = name
        count = await _sticker_count(bot, name)
        if count is None:
            log.info("%s жинағы жасалуда", name)
            try:
                await _call(
                    bot.create_new_sticker_set,
                    user_id=owner_id,
                    name=name,
                    title=SET_TITLES[kind],
                    stickers=[_input_sticker(keys[0])],
                    idempotent=False,
                )
            except NetworkError as exc:
                if not _is_transient(exc):
                    raise
            count = await _sticker_count(bot, name)
            if count is None:
                raise RuntimeError(f"{name} жинағы жасалмады")
        if count > len(keys):
            raise RuntimeError(f"{name} жинағында артық стикерлер бар ({count} > {len(keys)}). Оны жойып, қайталаңыз.")
        failures = 0
        while count < len(keys):
            try:
                await _call(
                    bot.add_sticker_to_set,
                    user_id=owner_id,
                    name=name,
                    sticker=_input_sticker(keys[count]),
                    idempotent=False,
                )
            except NetworkError as exc:
                failures += 1
                if not _is_transient(exc) or failures > 10:
                    raise
                # Сұраныс өтіп кетуі мүмкін — нақты санын қайта тексереміз.
                await asyncio.sleep(3)
                count = await _sticker_count(bot, name) or count
                continue
            count += 1
            if count % 10 == 0:
                log.info("%s: %d/%d", name, count, len(keys))
        sticker_set = await _call(bot.get_sticker_set, name)
        if len(sticker_set.stickers) != len(keys):
            raise RuntimeError(f"{name}: стикерлер саны сәйкес емес")
        for key, sticker in zip(keys, sticker_set.stickers, strict=True):
            registry.ids[key] = sticker.file_id
    registry.save()
    return names


def set_links(names: dict[str, str]) -> str:
    return "\n".join(f"https://t.me/addstickers/{name}" for name in names.values())


async def _main() -> None:
    from .config import load_config

    parser = argparse.ArgumentParser(description="UNO стикер жинақтарын жасау")
    parser.add_argument("--owner", type=int, help="Жинақ иесінің Telegram ID-і (әдепкі: ADMIN_ID)")
    args = parser.parse_args()
    config = load_config()
    owner = args.owner or config.admin_id
    if not owner:
        raise SystemExit("--owner немесе ADMIN_ID көрсетіңіз")
    registry = StickerRegistry(config.stickers_file)
    async with Bot(config.token) as bot:
        names = await upload_sticker_sets(bot, owner, registry, config.sticker_prefix)
    print(f"Дайын! {len(registry.ids)} стикер сақталды: {config.stickers_file}")
    print(set_links(names))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_main())
