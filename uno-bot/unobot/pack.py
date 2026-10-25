"""Дайын Telegram стикер пакын (әдепкі: UnoWarStickers) карталарға сәйкестендіру.

Telegram пактағы стикердің қай карта екенін айтпайды, сондықтан сәйкестік
unobot/packs/<пак>.json файлында сақталады:

    {
      "pack": "UnoWarStickers",
      "stickers": {
        "1": "red_0",          пактағы реттік нөмір (1-ден басталады) → карта кілті
        "AgADxxxx": "wild4"    немесе стикердің file_unique_id-і (пак реті өзгерсе де бұзылмайды)
      }
    }

Карта кілттері: red_0 … red_9, red_skip, red_reverse, red_draw2 (yellow_, green_, blue_ үшін де),
wild, wild4, түсі таңдалған wild_red … wild4_blue, сұр нұсқалар grey_<кілт>,
option_draw, option_pass, option_uno. Пакта жоқ стикерлердің орнына боттың өз стикерлері шығады.

Тексеру: ботқа жеке чатта /pack (ADMIN_ID) немесе `python -m unobot.pack` —
әр стикердің нөмірі мен тағайындалған картасы жазылған сурет жасалады.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path

from telegram import Bot, Sticker, StickerSet
from telegram.error import TelegramError

from .cards import COLORED_WILD_KEYS, FACE_KEYS, OPTION_KEYS, grey_key
from .stickers import ALL_KEYS, StickerRegistry, _call

log = logging.getLogger(__name__)

PACKS_DIR = Path(__file__).resolve().parent / "packs"
DOWNLOAD_CONCURRENCY = 8


@dataclass
class PackMapping:
    pack: str
    stickers: dict[str, str]  # "<реттік нөмір>" немесе "<file_unique_id>" → карта кілті
    path: Path


def mapping_path(pack: str, override: Path | None = None) -> Path:
    return override if override is not None else PACKS_DIR / f"{pack}.json"


def load_mapping(pack: str, path: Path | None = None) -> PackMapping:
    path = mapping_path(pack, path)
    if not path.exists():
        return PackMapping(pack, {}, path)
    data = json.loads(path.read_text(encoding="utf-8"))
    stickers = {str(ref): str(key) for ref, key in data.get("stickers", {}).items() if key}
    return PackMapping(pack, stickers, path)


@dataclass
class PackReport:
    name: str
    title: str
    total: int
    mapping_path: Path
    ids: dict[str, str] = field(default_factory=dict)  # карта кілті → file_id
    assigned: dict[int, str] = field(default_factory=dict)  # реттік нөмір → карта кілті
    warnings: list[str] = field(default_factory=list)

    def covered(self, keys) -> int:
        return sum(1 for key in keys if key in self.ids)

    @property
    def missing_faces(self) -> list[str]:
        return [key for key in FACE_KEYS if key not in self.ids]


def apply_mapping(sticker_set: StickerSet, mapping: PackMapping) -> PackReport:
    stickers = list(sticker_set.stickers)
    by_unique_id = {s.file_unique_id: i for i, s in enumerate(stickers, 1)}
    report = PackReport(sticker_set.name, sticker_set.title, len(stickers), mapping.path)
    for ref, key in mapping.stickers.items():
        if key not in ALL_KEYS:
            report.warnings.append(f"Белгісіз карта кілті: {key} ({ref})")
            continue
        if ref.isdigit():
            index = int(ref)
            if not 1 <= index <= len(stickers):
                report.warnings.append(f"Пакта {index}-стикер жоқ ({key})")
                continue
        else:
            index = by_unique_id.get(ref)
            if index is None:
                report.warnings.append(f"Пакта мұндай стикер жоқ: {ref} ({key})")
                continue
        if key in report.ids:
            report.warnings.append(f"{key} бірнеше рет тағайындалған — біріншісі алынды")
            continue
        report.ids[key] = stickers[index - 1].file_id
        report.assigned[index] = key
    return report


async def fetch_pack(bot: Bot, name: str) -> StickerSet:
    return await _call(bot.get_sticker_set, name)


async def load_pack(
    bot: Bot, registry: StickerRegistry, pack: str, map_path: Path | None = None
) -> tuple[StickerSet, PackReport]:
    """Пакты Telegram-нан алып, сәйкестендіру бойынша тізілімге қосу."""
    sticker_set = await fetch_pack(bot, pack)
    report = apply_mapping(sticker_set, load_mapping(pack, map_path))
    registry.pack_ids = report.ids
    for warning in report.warnings:
        log.warning("%s: %s", pack, warning)
    return sticker_set, report


def summary(report: PackReport) -> str:
    grey_keys = [grey_key(k) for k in FACE_KEYS]
    lines = [
        f"📦 Пак: {report.title} ({report.name}) — {report.total} стикер",
        f"🃏 Карта беттері: {report.covered(FACE_KEYS)}/{len(FACE_KEYS)}",
        f"⬜ Сұр нұсқалар: {report.covered(grey_keys)}/{len(grey_keys)}",
        f"🌈 Түсі таңдалған Wild: {report.covered(COLORED_WILD_KEYS)}/{len(COLORED_WILD_KEYS)}",
        f"⚙️ Батырма стикерлері: {report.covered(OPTION_KEYS)}/{len(OPTION_KEYS)}",
    ]
    if not report.ids:
        lines += [
            "",
            f"Сәйкестендіру файлы бос: {report.mapping_path.name}. Суреттегі нөмірлер бойынша "
            "қай стикер қай карта екенін жазыңыз.",
        ]
    elif len(report.ids) < len(ALL_KEYS):
        lines += ["", "Пакта жоқ стикерлердің орнына боттың өз стикерлері көрсетіледі."]
    if report.warnings:
        lines += ["", "⚠️ Ескертулер:"] + [f"• {w}" for w in report.warnings[:15]]
    return "\n".join(lines)


# ------------------------------------------------------------- алдын ала көрініс


async def _sticker_image(bot: Bot, sticker: Sticker, semaphore: asyncio.Semaphore):
    from PIL import Image

    if sticker.is_animated or sticker.is_video:
        # TGS/WebM-ді Pillow аша алмайды — шағын суретін (thumbnail) аламыз.
        file_id = sticker.thumbnail.file_id if sticker.thumbnail else None
    else:
        file_id = sticker.file_id
    if file_id is None:
        return None
    async with semaphore:
        try:
            file = await bot.get_file(file_id)
            data = await file.download_as_bytearray()
            image = Image.open(BytesIO(bytes(data)))
            image.load()
            return image.convert("RGBA")
        except (TelegramError, OSError) as exc:
            log.warning("Стикер суреті жүктелмеді: %s (%s)", sticker.file_unique_id, exc)
            return None


async def render_preview(bot: Bot, sticker_set: StickerSet, report: PackReport, columns: int = 8) -> bytes:
    """Әр стикердің реттік нөмірі мен тағайындалған картасы жазылған жиынтық сурет."""
    from PIL import Image, ImageDraw

    from .images import label_font

    stickers = list(sticker_set.stickers)
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    images = await asyncio.gather(*(_sticker_image(bot, s, semaphore) for s in stickers))

    cell, label_h, gap = 150, 46, 10
    rows = max(1, math.ceil(len(stickers) / columns))
    width = columns * (cell + gap) + gap
    height = rows * (cell + label_h + gap) + gap
    sheet = Image.new("RGB", (width, height), (245, 246, 248))
    draw = ImageDraw.Draw(sheet)
    number_font, key_font = label_font(22), label_font(17)
    for i, image in enumerate(images, 1):
        x = gap + (i - 1) % columns * (cell + gap)
        y = gap + (i - 1) // columns * (cell + label_h + gap)
        draw.rounded_rectangle((x, y, x + cell, y + cell + label_h), radius=10, fill=(255, 255, 255))
        if image is not None:
            image.thumbnail((cell - 12, cell - 12))
            sheet.paste(image, (x + (cell - image.width) // 2, y + (cell - image.height) // 2), image)
        else:
            draw.text((x + cell / 2, y + cell / 2), "?", font=number_font, fill=(150, 150, 150), anchor="mm")
        key = report.assigned.get(i)
        draw.text((x + 8, y + cell + 2), f"#{i}", font=number_font, fill=(30, 30, 30))
        draw.text(
            (x + 8, y + cell + 25),
            key or "—",
            font=key_font,
            fill=(20, 130, 60) if key else (160, 160, 160),
        )
    out = BytesIO()
    sheet.save(out, format="PNG", optimize=True)
    return out.getvalue()


def sticker_list(sticker_set: StickerSet, report: PackReport) -> list[dict]:
    return [
        {
            "index": i,
            "emoji": s.emoji,
            "file_unique_id": s.file_unique_id,
            "type": "animated" if s.is_animated else "video" if s.is_video else "static",
            "key": report.assigned.get(i),
        }
        for i, s in enumerate(sticker_set.stickers, 1)
    ]


async def _main() -> None:
    from .config import ROOT, load_config

    parser = argparse.ArgumentParser(description="Дайын стикер пагын тексеру")
    parser.add_argument("--pack", help="Пак атауы (әдепкі: STICKER_PACK)")
    args = parser.parse_args()
    config = load_config()
    pack = args.pack or config.sticker_pack
    if not pack:
        raise SystemExit("Пак атауын --pack немесе STICKER_PACK арқылы көрсетіңіз")
    registry = StickerRegistry(config.stickers_file)
    out_dir = ROOT / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    async with Bot(config.token) as bot:
        sticker_set, report = await load_pack(bot, registry, pack, config.sticker_map)
        preview = await render_preview(bot, sticker_set, report)
    (out_dir / f"{pack}_preview.png").write_bytes(preview)
    (out_dir / f"{pack}_list.json").write_text(
        json.dumps(sticker_list(sticker_set, report), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(summary(report))
    print(f"\nСурет: {out_dir / f'{pack}_preview.png'}\nТізім: {out_dir / f'{pack}_list.json'}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_main())
