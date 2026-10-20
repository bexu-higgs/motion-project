"""Рөлдер мен фракциялар. Атаулар мен сипаттамалар ``mafia_bot.i18n`` каталогында."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from ..i18n import DEFAULT_LANG, t


class Faction(StrEnum):
    TOWN = "town"            # Бейбіт тұрғындар
    MAFIA = "mafia"          # Мафия фракциясы (Дон, мафия, Киллер, Қорғаушылар)
    INDEPENDENT = "solo"     # Жеке жеңіс шарты бар кейіпкерлер


class Role(StrEnum):
    # Мәндер деректер базасында сақталады — оларды өзгертпеңіз.
    CIVILIAN = "civilian"
    DON = "don"
    MAFIA = "mafia"
    KILLER = "killer"
    DEFENDER = "defender"
    COMMISSIONER = "commissioner"
    SERGEANT = "sergeant"
    DOCTOR = "doctor"
    HACKER = "hacker"
    BEGGAR = "beggar"
    KAMIKAZE = "kamikaze"
    SUICIDE = "suicide"
    WITCH = "witch"
    PYRO = "pyro"
    WOLF = "wolf"
    MANIAC = "maniac"
    HIGGS = "higgs"
    SLEEPLESS = "sleepless"


@dataclass(frozen=True)
class RoleInfo:
    role: Role
    emoji: str
    faction: Faction


ROLE_INFO: dict[Role, RoleInfo] = {
    r.role: r
    for r in (
        RoleInfo(Role.CIVILIAN, "👨", Faction.TOWN),
        RoleInfo(Role.DON, "🤵", Faction.MAFIA),
        RoleInfo(Role.MAFIA, "🕴", Faction.MAFIA),
        RoleInfo(Role.KILLER, "🔪", Faction.MAFIA),
        RoleInfo(Role.DEFENDER, "🛡", Faction.MAFIA),
        RoleInfo(Role.COMMISSIONER, "🕵️", Faction.TOWN),
        RoleInfo(Role.SERGEANT, "👮", Faction.TOWN),
        RoleInfo(Role.DOCTOR, "👨‍⚕️", Faction.TOWN),
        RoleInfo(Role.HACKER, "💻", Faction.TOWN),
        RoleInfo(Role.BEGGAR, "🍾", Faction.TOWN),
        RoleInfo(Role.KAMIKAZE, "💣", Faction.TOWN),
        RoleInfo(Role.SUICIDE, "🤡", Faction.INDEPENDENT),
        RoleInfo(Role.WITCH, "🧙‍♀️", Faction.TOWN),
        RoleInfo(Role.PYRO, "🔥", Faction.INDEPENDENT),
        RoleInfo(Role.WOLF, "🐺", Faction.TOWN),
        RoleInfo(Role.MANIAC, "🪓", Faction.INDEPENDENT),
        RoleInfo(Role.HIGGS, "⚛️", Faction.INDEPENDENT),
        RoleInfo(Role.SLEEPLESS, "💋", Faction.TOWN),   # Балым жалеп (мәні DB-да сақталады)
    )
}

# Мафияның «қарулы» мүшелері — жеңіс теңдігін есептегенде есепке алынады.
MAFIA_POWER_ROLES = frozenset({Role.DON, Role.MAFIA, Role.KILLER})
# Бір-бірін танитын мафия мүшелері.
MAFIA_TEAM_ROLES = MAFIA_POWER_ROLES
# Жалған құжатты қолдана алатын рөлдер.
FAKE_DOC_ROLES = frozenset({Role.DON, Role.MAFIA, Role.PYRO, Role.MANIAC})
# Қорғаушылардың жасыру әсері жұмыс істейтін рөлдер.
DEFENDER_COVER_ROLES = frozenset({Role.DON, Role.MAFIA})
# Сатып алуға болмайтын рөлдер: сирек Higgs-Man және әр ойында міндетті Балым жалеп.
NOT_FOR_SALE = frozenset({Role.CIVILIAN, Role.HIGGS, Role.SLEEPLESS})
# Сатып алуға болатын рөлдер.
PURCHASABLE_ROLES = tuple(r for r in Role if r not in NOT_FOR_SALE)
# Камикадзе осылардың бірін өзімен бірге алып кетсе — жеңеді.
KAMIKAZE_PREY = frozenset({Role.DON, Role.MAFIA, Role.KILLER, Role.DEFENDER, Role.MANIAC, Role.PYRO})


def info(role: Role) -> RoleInfo:
    return ROLE_INFO[role]


def name(role: Role, lang: str = DEFAULT_LANG) -> str:
    return t(lang, f"role.{role.value}")


def title(role: Role, lang: str = DEFAULT_LANG) -> str:
    return f"{ROLE_INFO[role].emoji} {name(role, lang)}"


def description(role: Role, lang: str = DEFAULT_LANG) -> str:
    return t(lang, f"role.{role.value}.desc")


def faction_of(role: Role) -> Faction:
    return ROLE_INFO[role].faction


def faction_title(faction: Faction, lang: str = DEFAULT_LANG) -> str:
    return t(lang, f"faction.{faction.value}")
