"""4–50 ойыншыға арналған автоматты рөл балансы және кезең уақыттары."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .roles import Role

MIN_PLAYERS = 4
MAX_PLAYERS = 50

# ⚛️ Higgs-Man — өте сирек рөл: осынша ойыншыдан бастап, әр ойында осы ықтималдықпен
# бір қарапайым тұрғынның орнына шығады.
HIGGS_MIN_PLAYERS = 8
HIGGS_CHANCE = 0.10

# Әр шек — сол ойыншылар санынан бастап қолданылатын рөлдер саны.
# Шектер жинақталады: жаңа шекте рөл қосылады немесе бұрынғы рөлдің саны өседі.
# Бос орындар қарапайым тұрғындармен толтырылады.
THRESHOLDS: tuple[tuple[int, dict[Role, int]], ...] = (
    (4, {Role.DON: 1, Role.COMMISSIONER: 1, Role.DOCTOR: 1}),
    (6, {Role.MAFIA: 1}),
    (8, {Role.MAFIA: 2, Role.SERGEANT: 1}),
    (10, {Role.HACKER: 1}),
    (12, {Role.MAFIA: 3}),
    (14, {Role.DEFENDER: 2}),
    (16, {Role.MAFIA: 4, Role.SERGEANT: 2}),
    (20, {Role.KILLER: 1, Role.BEGGAR: 1}),
    (24, {Role.MAFIA: 5, Role.SERGEANT: 3}),
    (28, {Role.MAFIA: 6, Role.KAMIKAZE: 1}),
    (32, {Role.KAMIKAZE: 2, Role.WITCH: 1, Role.SUICIDE: 1}),
    (36, {Role.MAFIA: 7, Role.KAMIKAZE: 3}),
    (40, {Role.PYRO: 1, Role.WOLF: 2}),
    (44, {Role.MAFIA: 8, Role.MANIAC: 1}),
    (48, {Role.WOLF: 3}),
)


def composition(players: int) -> Counter[Role]:
    """Ойыншылар санына сәйкес рөлдер жиынтығы (қосындысы әрдайым ``players``)."""
    if not MIN_PLAYERS <= players <= MAX_PLAYERS:
        raise ValueError(f"Ойыншылар саны {MIN_PLAYERS}–{MAX_PLAYERS} аралығында болуы керек")
    counts: dict[Role, int] = {}
    for threshold, roles in THRESHOLDS:
        if players >= threshold:
            counts.update(roles)
    special = sum(counts.values())
    if special > players:  # кесте дұрыс болса, бұл ешқашан болмайды
        raise AssertionError("Арнайы рөлдер ойыншылардан көп")
    result = Counter(counts)
    result[Role.CIVILIAN] = players - special
    return +result  # нөлдік мәндерді алып тастау


def role_available(role: Role, players: int) -> bool:
    return composition(players)[role] > 0


def min_players_for(role: Role) -> int:
    if role is Role.HIGGS:
        return HIGGS_MIN_PLAYERS
    for threshold, roles in THRESHOLDS:
        if roles.get(role, 0) > 0:
            return threshold
    return MIN_PLAYERS if role is Role.CIVILIAN else MAX_PLAYERS + 1


@dataclass(frozen=True)
class Timings:
    night: float
    day: float
    vote: float
    witch: float = 30


def timings(players: int, scale: float = 1.0) -> Timings:
    """Кезең ұзақтығы (секунд). Аз ойыншыда түн мен дауыс беру уақыты қысқарады."""
    if players <= 5:
        night, day, vote = 45, 45, 30
    elif players <= 12:
        night, day, vote = 60, 60, 45
    elif players <= 25:
        night, day, vote = 75, 90, 60
    else:
        night, day, vote = 90, 120, 60
    return Timings(night=night * scale, day=day * scale, vote=vote * scale, witch=30 * scale)
