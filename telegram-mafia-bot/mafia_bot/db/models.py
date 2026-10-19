"""Деректер қабатының қарапайым модельдері (asyncpg-ге тәуелсіз)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Inventory:
    shields: int = 0
    fake_docs: int = 0
    vote_shields: int = 0
    piercing_bullets: int = 0


@dataclass(frozen=True)
class FinalRow:
    """Ойын соңындағы бір ойыншының нәтижесі."""

    user_id: int
    final_role: str
    alive: bool
    won: bool
    reward: int
    deserted: bool = False
    used_shield: bool = False
    used_vote_shield: bool = False
    used_bullet: bool = False
    used_fake_doc: bool = False
    purchase_id: int | None = None


@dataclass(frozen=True)
class PurchaseResult:
    ok: bool
    reason: str = ""          # "funds" | "limit" | "unknown"
    balance: int = 0
    count: int = 0


@dataclass(frozen=True)
class TransferResult:
    """Ойыншыдан ойыншыға алмаз беру нәтижесі."""

    ok: bool
    balance: int = 0                 # берушінің қалған балансы
    receiver_balance: int = 0
    receiver_lang: str = "kk"


START_MODES = ("all", "admins")  # ойынды кім ашып/бастай алады


@dataclass(frozen=True)
class ChatSettings:
    """Чат әкімшілері /settingsmafiahiggs арқылы өзгертетін баптаулар."""

    lang: str = "kk"
    registration_seconds: int | None = None   # None — бот әдепкісі (REGISTRATION_SECONDS)
    start_mode: str = "all"                     # "all" — кез келген адам, "admins" — тек әкімшілер
