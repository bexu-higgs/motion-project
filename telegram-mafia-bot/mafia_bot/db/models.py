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


@dataclass(frozen=True)
class GiveawayView:
    """🎁 Тарату хабарын салу үшін қажет мәлімет."""

    giveaway_id: int
    chat_id: int
    message_id: int | None
    giver_id: int
    giver_name: str
    total: int
    remaining: int
    status: str                                   # "open" | "done" | "expired" | "cancelled"
    claimers: tuple[tuple[int, str], ...] = ()    # (user_id, аты) — алу ретімен


@dataclass(frozen=True)
class ClaimResult:
    status: str        # "ok" | "own" | "again" | "gone"
    balance: int = 0   # алушының жаңа балансы


@dataclass(frozen=True)
class ResetResult:
    """/reloaddm нәтижесі."""

    users: int                       # алмазы нөлденген ойыншылар саны
    diamonds: int                    # жойылған алмаздың жалпы саны
    giveaways: tuple[int, ...] = ()  # жабылған ашық таратулар


START_MODES = ("all", "admins")  # ойынды кім ашып/бастай алады


@dataclass(frozen=True)
class ChatSettings:
    """Чат әкімшілері /settingsmafia арқылы өзгертетін баптаулар."""

    lang: str = "kk"
    registration_seconds: int | None = None   # None — бот әдепкісі (REGISTRATION_SECONDS)
    start_mode: str = "all"                     # "all" — кез келген адам, "admins" — тек әкімшілер
