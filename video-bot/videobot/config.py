"""Баптаулар: орта айнымалылары немесе .env файлы."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MB = 1024 * 1024
CLOUD_LIMIT_MB = 50  # Telegram-ның бұлттағы Bot API шегі
LOCAL_LIMIT_MB = 2000  # жеке (local) Bot API сервері арқылы


@dataclass
class Config:
    token: str
    max_file_mb: int = CLOUD_LIMIT_MB
    bot_api_url: str | None = None
    cookies_file: Path | None = None
    proxy: str | None = None
    download_dir: Path = ROOT / "downloads"
    max_parallel: int = 3

    @property
    def max_bytes(self) -> int:
        return self.max_file_mb * MB


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


def resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else ROOT / path


def load_config() -> Config:
    load_env_file(ROOT / ".env")
    token = os.environ.get("BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("BOT_TOKEN орнатылмаған. Баптау шеберін іске қосыңыз: python -m videobot.setup")
    api_url = os.environ.get("BOT_API_URL", "").strip().rstrip("/") or None
    default_limit = LOCAL_LIMIT_MB if api_url else CLOUD_LIMIT_MB
    limit = os.environ.get("MAX_FILE_MB", "").strip()
    cookies = os.environ.get("COOKIES_FILE", "").strip()
    return Config(
        token=token,
        max_file_mb=int(limit) if limit.isdigit() and int(limit) > 0 else default_limit,
        bot_api_url=api_url,
        cookies_file=resolve_path(cookies) if cookies else None,
        proxy=os.environ.get("PROXY", "").strip() or None,
        download_dir=resolve_path(os.environ.get("DOWNLOAD_DIR", "").strip() or "downloads"),
        max_parallel=max(1, int(os.environ.get("MAX_PARALLEL", "3").strip() or 3)),
    )
