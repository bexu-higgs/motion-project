"""Баптаулар: орта айнымалылары немесе .env файлы."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "assets" / "cards"


@dataclass
class Config:
    token: str
    admin_id: int | None
    turn_timeout: int
    stickers_file: Path
    sticker_prefix: str


def load_env_file(path: Path) -> None:
    """Қарапайым .env оқу: KEY=VALUE жолдары (бар айнымалылар өзгертілмейді)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_config() -> Config:
    load_env_file(ROOT / ".env")
    token = os.environ.get("BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("BOT_TOKEN орнатылмаған. .env.example файлын .env деп көшіріп, токенді жазыңыз.")
    admin = os.environ.get("ADMIN_ID", "").strip()
    stickers_file = Path(os.environ.get("STICKERS_FILE", ROOT / "data" / "stickers.json"))
    if not stickers_file.is_absolute():
        stickers_file = ROOT / stickers_file
    return Config(
        token=token,
        admin_id=int(admin) if admin else None,
        turn_timeout=int(os.environ.get("TURN_TIMEOUT", "90")),
        stickers_file=stickers_file,
        sticker_prefix=os.environ.get("STICKER_PREFIX", "unokz").strip() or "unokz",
    )
