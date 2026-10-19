"""Валюта, бағалар, сыйақылар — Telegram-ға тәуелсіз таза логика."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

from .i18n import t

# --- Жеңіс сыйақысы (₸) -------------------------------------------------------

# Кестедегі тірек нүктелер: ойыншылар саны -> ₸.
REWARD_POINTS: tuple[tuple[int, int], ...] = (
    (4, 20), (10, 30), (20, 40), (30, 50), (40, 60), (50, 70),
)


def win_reward(players: int) -> int:
    """Жеңіс сыйақысы. Кестедегі нүктелер дәл сақталады, аралық сандар сызықтық есептеледі."""
    pts = REWARD_POINTS
    if players <= pts[0][0]:
        return pts[0][1]
    if players >= pts[-1][0]:
        return pts[-1][1]
    for (n1, r1), (n2, r2) in zip(pts, pts[1:], strict=False):
        if n1 <= players <= n2:
            value = r1 + (players - n1) * (r2 - r1) / (n2 - n1)
            return int(value + 0.5)
    raise AssertionError("unreachable")


# ⚛️ Higgs-Man жеңсе, сыйақысы екі есе (100%-ға көп).
HIGGS_REWARD_MULTIPLIER = 2


# --- ₸ және 💎 заттар ---------------------------------------------------------


class Item(StrEnum):
    SHIELD = "shields"                 # 🛡 Қорғаныс — түнгі өлімнен бір рет
    FAKE_DOC = "fake_docs"             # 📄 Жалған құжат — Комиссардың бірінші тексеруі
    VOTE_SHIELD = "vote_shields"       # ⚖️ Дауыс беруден қорғаныс
    PIERCING_BULLET = "piercing_bullets"  # 💥 Қорғанысты тесіп өтетін оқ


@dataclass(frozen=True)
class ShopItem:
    item: Item
    emoji: str
    price: int
    currency: str  # "tenge" | "diamonds"

    @property
    def price_label(self) -> str:
        return f"{self.price} ₸" if self.currency == "tenge" else f"{self.price} 💎"

    def name(self, lang: str | None = None) -> str:
        return t(lang, f"item.{self.item.value}.name")

    def description(self, lang: str | None = None) -> str:
        return t(lang, f"item.{self.item.value}.desc")


SHOP: dict[Item, ShopItem] = {
    Item.SHIELD: ShopItem(Item.SHIELD, "🛡", 100, "tenge"),
    Item.FAKE_DOC: ShopItem(Item.FAKE_DOC, "📄", 160, "tenge"),
    Item.VOTE_SHIELD: ShopItem(Item.VOTE_SHIELD, "⚖️", 1, "diamonds"),
    Item.PIERCING_BULLET: ShopItem(Item.PIERCING_BULLET, "💥", 1, "diamonds"),
}

ROLE_PICK_PRICE = 1          # 💎 — келесі ойынға рөл таңдау
ROLE_QUEUE_LIMIT = 5         # бір ойыншының кезектегі рөлдерінің ең көп саны


# --- 💎 Алмаз пакеттері ---------------------------------------------------------


@dataclass(frozen=True)
class DiamondPackage:
    id: str
    diamonds: int
    price_kzt: int     # ұсынылатын баға (₸)
    stars: int         # Telegram Stars (XTR) бойынша нақты төлем

    @property
    def per_diamond_kzt(self) -> float:
        return self.price_kzt / self.diamonds


# Telegram-дағы цифрлық тауарлар тек Telegram Stars (XTR) арқылы сатылады.
# ``stars`` мәндері ₸ бағасына шамамен сәйкес келетіндей таңдалған (≈ 10 ₸ = 1 ⭐),
# оларды кез келген уақытта өзгертуге болады.
DIAMOND_PACKAGES: tuple[DiamondPackage, ...] = (
    DiamondPackage("d10", 10, 99, 10),
    DiamondPackage("d40", 40, 299, 30),
    DiamondPackage("d80", 80, 499, 50),
    DiamondPackage("d150", 150, 799, 80),
    DiamondPackage("d300", 300, 1399, 140),
    DiamondPackage("d600", 600, 2499, 250),
    DiamondPackage("d1500", 1500, 4999, 500),
    DiamondPackage("d3500", 3500, 9999, 1000),
)
PACKAGES_BY_ID = {p.id: p for p in DIAMOND_PACKAGES}


def format_kzt(value: float) -> str:
    """1399 -> '1 399', 9.9 -> '9,90'."""
    if float(value).is_integer():
        return f"{int(value):,}".replace(",", " ")
    return f"{value:.2f}".replace(".", ",")


# --- 🎁 Күнделікті сыйлық -------------------------------------------------------

DAILY_REWARDS: tuple[int, ...] = (10, 15, 20, 25, 30, 35, 50)
DAILY_COOLDOWN = timedelta(hours=24)
DAILY_STREAK_RESET = timedelta(hours=48)


@dataclass(frozen=True)
class DailyResult:
    ok: bool
    day: int = 0                 # циклдегі күн (1..7)
    reward: int = 0
    wait: timedelta | None = None


def compute_daily(last_claim: datetime | None, streak: int, now: datetime) -> DailyResult:
    """Сыйлықты алуға бола ма және қанша ₸ беріледі.

    ``streak`` — соңғы алынған күннің циклдегі нөмірі (0 — ешқашан алынбаған).
    48 сағаттан көп үзіліс болса, цикл 1-күннен басталады.
    """
    if last_claim is not None:
        elapsed = now - last_claim
        if elapsed < DAILY_COOLDOWN:
            return DailyResult(ok=False, wait=DAILY_COOLDOWN - elapsed)
        if elapsed >= DAILY_STREAK_RESET:
            streak = 0
    day = streak % len(DAILY_REWARDS) + 1
    return DailyResult(ok=True, day=day, reward=DAILY_REWARDS[day - 1])

