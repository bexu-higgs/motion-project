import asyncio
import json
from datetime import datetime
from io import BytesIO
from types import SimpleNamespace

from PIL import Image
from telegram import Chat, Message, PhotoSize, Sticker, StickerSet, Update, User

from unobot import bot as botmod
from unobot.cards import Card, Color
from unobot.config import ASSETS_DIR, Config
from unobot.manager import GameManager
from unobot.pack import PACKS_DIR, PackMapping, apply_mapping, load_mapping, load_pack, render_preview, summary
from unobot.stickers import ALL_KEYS, StickerRegistry


def make_sticker(i: int, kind: str = "static") -> Sticker:
    thumb = PhotoSize(file_id=f"thumb-{i}", file_unique_id=f"tu-{i}", width=128, height=128)
    return Sticker(
        file_id=f"file-{i}",
        file_unique_id=f"uniq-{i}",
        width=512,
        height=512,
        is_animated=kind == "animated",
        is_video=kind == "video",
        type="regular",
        emoji="🃏",
        thumbnail=thumb,
    )


def make_set(n: int = 6, kinds=None) -> StickerSet:
    kinds = kinds or ["static"] * n
    return StickerSet(
        name="UnoWarStickers",
        title="Uno War",
        stickers=[make_sticker(i, k) for i, k in enumerate(kinds, 1)],
        sticker_type="regular",
    )


def test_apply_mapping_by_index_and_unique_id(tmp_path):
    mapping = PackMapping(
        "UnoWarStickers",
        {
            "1": "red_0",
            "uniq-2": "wild4",
            "3": "not_a_card",
            "99": "blue_5",
            "uniq-x": "green_5",
            "4": "red_0",
            "5": "grey_red_0",
        },
        tmp_path / "m.json",
    )
    report = apply_mapping(make_set(), mapping)
    assert report.ids == {"red_0": "file-1", "wild4": "file-2", "grey_red_0": "file-5"}
    assert report.assigned == {1: "red_0", 2: "wild4", 5: "grey_red_0"}
    assert len(report.warnings) == 4
    text = summary(report)
    assert "Карта беттері: 2/54" in text
    assert "Сұр нұсқалар: 1/54" in text


def test_registry_prefers_pack_stickers(tmp_path):
    registry = StickerRegistry(tmp_path / "stickers.json")
    registry.ids = {"red_5": "own-red5", "grey_red_5": "own-grey"}
    registry.pack_ids = {"red_5": "pack-red5"}
    card = Card(Color.RED, "5")
    assert registry.card(card) == "pack-red5"
    assert registry.grey(card) == "own-grey"  # пакта жоқ — боттың өз стикері
    assert "red_5" not in registry.missing()
    assert "blue_5" in registry.missing()


def test_missing_mapping_file_is_empty(tmp_path):
    mapping = load_mapping("NoSuchPack", tmp_path / "none.json")
    assert mapping.stickers == {}


def test_shipped_mapping_files_are_valid():
    for path in PACKS_DIR.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["pack"] == path.stem
        for ref, key in data["stickers"].items():
            assert ref.isdigit() or ref
            assert key in ALL_KEYS, (path.name, ref, key)


class FakeFile:
    def __init__(self, data: bytes):
        self.data = data

    async def download_as_bytearray(self):
        return bytearray(self.data)


def webp_bytes(key: str) -> bytes:
    out = BytesIO()
    Image.open(ASSETS_DIR / f"{key}.png").save(out, format="WEBP")
    return out.getvalue()


class FakePackBot:
    username = "uno_kz_bot"

    def __init__(self, sticker_set: StickerSet):
        self.sticker_set = sticker_set
        self.requested = []
        self.documents = []
        self.texts = []

    async def get_sticker_set(self, name, **kwargs):
        assert name == self.sticker_set.name
        return self.sticker_set

    async def get_file(self, file_id, **kwargs):
        self.requested.append(file_id)
        if file_id == "file-3":
            return FakeFile(b"not an image")
        return FakeFile(webp_bytes("blue_7"))

    async def send_document(self, chat_id, document, filename=None, caption=None, **kwargs):
        self.documents.append(SimpleNamespace(data=document, filename=filename, caption=caption))

    async def send_message(self, chat_id, text, **kwargs):
        self.texts.append(text)
        return SimpleNamespace(message_id=1)


def test_render_preview_uses_thumbnails_for_animated(tmp_path):
    sticker_set = make_set(5, ["static", "animated", "static", "video", "static"])
    bot = FakePackBot(sticker_set)
    report = apply_mapping(sticker_set, PackMapping("UnoWarStickers", {"1": "blue_7"}, tmp_path / "m.json"))
    png = asyncio.run(render_preview(bot, sticker_set, report, columns=3))
    image = Image.open(BytesIO(png))
    assert image.format == "PNG"
    assert image.width == 3 * 160 + 10
    assert set(bot.requested) == {"file-1", "thumb-2", "file-3", "thumb-4", "file-5"}


def test_load_pack_fills_registry(tmp_path):
    mapping_file = tmp_path / "UnoWarStickers.json"
    mapping_file.write_text(json.dumps({"pack": "UnoWarStickers", "stickers": {"2": "green_skip"}}), encoding="utf-8")
    registry = StickerRegistry(tmp_path / "stickers.json")
    bot = FakePackBot(make_set())
    _, report = asyncio.run(load_pack(bot, registry, "UnoWarStickers", mapping_file))
    assert registry.card(Card(Color.GREEN, "skip")) == "file-2"
    assert report.total == 6


def test_pack_command_admin_only_and_sends_preview(tmp_path):
    asyncio.run(_pack_command(tmp_path))


async def _pack_command(tmp_path):
    bot = FakePackBot(make_set(3))
    registry = StickerRegistry(tmp_path / "stickers.json")
    config = Config(
        token="x",
        admin_id=7,
        turn_timeout=0,
        stickers_file=registry.path,
        sticker_prefix="unokz",
        sticker_pack="UnoWarStickers",
        sticker_map=tmp_path / "missing.json",
    )
    context = SimpleNamespace(
        bot=bot, bot_data={"manager": GameManager(), "stickers": registry, "config": config}, args=[]
    )

    def update_from(user_id):
        user = User(id=user_id, first_name="Әкімші", is_bot=False)
        message = Message(
            message_id=1, date=datetime.now(), chat=Chat(id=user_id, type="private"), from_user=user, text="/pack"
        )
        message.set_bot(bot)
        return Update(update_id=1, message=message)

    await botmod.cmd_pack(update_from(8), context)
    assert not bot.documents
    assert "ADMIN_ID" in bot.texts[-1]

    await botmod.cmd_pack(update_from(7), context)
    assert bot.documents[-1].filename == "UnoWarStickers_preview.png"
    assert "Сәйкестендіру файлы бос" in bot.texts[-1]
