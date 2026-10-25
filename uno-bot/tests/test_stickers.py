import asyncio
from types import SimpleNamespace

from PIL import Image
from telegram.error import BadRequest, TimedOut

from unobot import stickers as stickers_module
from unobot.cards import Card, Color
from unobot.config import ASSETS_DIR
from unobot.stickers import STICKER_SETS, StickerRegistry, sticker_emoji, upload_sticker_sets


def test_every_sticker_image_exists_and_fits_telegram_limits():
    for keys in STICKER_SETS.values():
        assert len(keys) <= 120  # статикалық жинақтың шегі
        for key in keys:
            path = ASSETS_DIR / f"{key}.png"
            assert path.exists(), key
            assert path.stat().st_size < 512 * 1024
            with Image.open(path) as img:
                assert img.format == "PNG"
                assert max(img.size) == 512


def test_sticker_emoji():
    assert sticker_emoji("red_5") == "🟥"
    assert sticker_emoji("dim_blue_skip") == "🟦"
    assert sticker_emoji("wild4_green") == "🟩"
    assert sticker_emoji("wild") == "🌈"
    assert sticker_emoji("option_uno") == "📢"


class FakeStickerBot:
    def __init__(self, fail_once_at: int | None = None):
        self.sets: dict[str, list[str]] = {}
        self.fail_once_at = fail_once_at

    async def get_me(self):
        return SimpleNamespace(username="uno_kz_bot")

    async def get_sticker_set(self, name, **kwargs):
        if name not in self.sets:
            raise BadRequest("Stickerset_invalid")
        stickers = [SimpleNamespace(file_id=f"{name}:{i}:{emoji}") for i, emoji in enumerate(self.sets[name])]
        return SimpleNamespace(stickers=stickers)

    async def create_new_sticker_set(self, user_id, name, title, stickers, **kwargs):
        assert name.endswith("_by_uno_kz_bot")
        self.sets[name] = [s.emoji_list[0] for s in stickers]

    async def add_sticker_to_set(self, user_id, name, sticker, **kwargs):
        self.sets[name].append(sticker.emoji_list[0])
        total = sum(len(v) for v in self.sets.values())
        if self.fail_once_at is not None and total == self.fail_once_at:
            self.fail_once_at = None
            raise TimedOut()  # сұраныс өтті, бірақ жауап келмеді


def test_upload_creates_sets_and_maps_file_ids(tmp_path, monkeypatch):
    monkeypatch.setattr(stickers_module.asyncio, "sleep", _no_sleep)
    bot = FakeStickerBot(fail_once_at=30)
    registry = StickerRegistry(tmp_path / "stickers.json")
    names = asyncio.run(upload_sticker_sets(bot, 42, registry))
    assert set(names) == {"cards", "dim"}
    assert not registry.missing()
    for kind, keys in STICKER_SETS.items():
        assert len(bot.sets[names[kind]]) == len(keys)  # TimedOut кезінде қайталанбады
    assert registry.card(Card(Color.RED, "5")).endswith(":🟥")
    assert registry.colored_wild("wild4", Color.BLUE).endswith(":🟦")

    reloaded = StickerRegistry(tmp_path / "stickers.json")
    assert reloaded.ids == registry.ids
    reloaded.bind("another_bot")
    assert reloaded.ids == {}


async def _no_sleep(*args, **kwargs):
    return None


def test_upgrade_from_grey_set_uploads_only_dim_cards(tmp_path, monkeypatch):
    monkeypatch.setattr(stickers_module.asyncio, "sleep", _no_sleep)
    bot = FakeStickerBot()
    cards_set = "unokz_cards_by_uno_kz_bot"
    bot.sets[cards_set] = [sticker_emoji(k) for k in STICKER_SETS["cards"]]  # бұрын жүктелген
    registry = StickerRegistry(tmp_path / "stickers.json")
    registry.bot_username = "uno_kz_bot"
    registry.ids = {"grey_red_5": "old-grey"}
    assert len(registry.missing()) == len(STICKER_SETS["cards"]) + len(STICKER_SETS["dim"])
    asyncio.run(upload_sticker_sets(bot, 42, registry))
    assert len(bot.sets[cards_set]) == len(STICKER_SETS["cards"])  # қайта жүктелмеді
    assert len(bot.sets["unokz_dim_by_uno_kz_bot"]) == len(STICKER_SETS["dim"])
    assert not registry.missing()
    assert "grey_red_5" not in registry.ids
