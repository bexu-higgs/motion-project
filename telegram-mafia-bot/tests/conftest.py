from __future__ import annotations

import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mafia_bot.game.engine import Game, Player  # noqa: E402
from mafia_bot.game.roles import Role  # noqa: E402


def make_game(roles: list[Role], seed: int = 0, start: bool = True) -> Game:
    """Рөлдері алдын ала белгіленген ойын (ойыншы ID = 1, 2, 3...)."""
    roles = list(roles) + [Role.CIVILIAN] * max(0, 4 - len(roles))
    players = [
        Player(user_id=i + 1, name=f"P{i + 1}", order=i, role=r, initial_role=r)
        for i, r in enumerate(roles)
    ]
    game = Game(1, -100, players, rng=random.Random(seed))
    if start:
        game.start_night()
    return game


@pytest.fixture
def game_factory():
    return make_game
