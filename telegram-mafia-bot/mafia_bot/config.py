"""Орта айнымалыларынан баптаулар."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "иә"}


def _float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value else default


def _ids(name: str) -> frozenset[int]:
    raw = os.getenv(name, "")
    return frozenset(int(x) for x in raw.replace(" ", "").split(",") if x)


class StartupError(RuntimeError):
    """Іске қосу кезіндегі түсінікті қате (баптау, токен, желі, деректер базасы)."""


@dataclass(frozen=True)
class Settings:
    bot_token: str
    database_url: str
    admin_ids: frozenset[int] = field(default_factory=frozenset)
    # Әкімші емес, бірақ жеке чатта /getdiamonds арқылы өзіне алмаз ала алатын ойыншылар.
    getdiamonds_ids: frozenset[int] = field(default_factory=frozenset)
    registration_seconds: float = 120
    time_scale: float = 1.0
    mute_seconds: float = 120
    silence_night: bool = True
    mute_non_players: bool = True
    require_admin_rights: bool = True

    @classmethod
    def from_env(cls) -> Settings:
        try:
            from dotenv import load_dotenv
        except ImportError:  # pragma: no cover
            pass
        else:
            load_dotenv()
        token = os.getenv("BOT_TOKEN", "").strip()
        if not token:
            raise StartupError("BOT_TOKEN көрсетілмеген: .env файлына @BotFather берген токенді жазыңыз.")
        database_url = os.getenv("DATABASE_URL", "").strip()
        if not database_url:
            raise StartupError("DATABASE_URL көрсетілмеген: .env файлына PostgreSQL мекенжайын жазыңыз.")
        return cls(
            bot_token=token,
            database_url=database_url,
            admin_ids=_ids("ADMIN_IDS"),
            getdiamonds_ids=_ids("GETDIAMONDS_IDS"),
            registration_seconds=_float("REGISTRATION_SECONDS", 120),
            time_scale=_float("TIME_SCALE", 1.0),
            mute_seconds=_float("MUTE_SECONDS", 120),
            silence_night=_bool("SILENCE_NIGHT", True),
            mute_non_players=_bool("MUTE_NON_PLAYERS", True),
            require_admin_rights=_bool("REQUIRE_ADMIN_RIGHTS", True),
        )
