"""Кездейсоқ әрекеттермен толық ойындарды симуляциялау."""

import random

import pytest

from mafia_bot.game import balance
from mafia_bot.game.engine import MAX_DAYS, Game, Phase, Player, assign_roles
from mafia_bot.game.roles import Faction


def play_random_game(n: int, seed: int) -> Game:
    rng = random.Random(seed)
    ids = list(range(1000, 1000 + n))
    assignment = assign_roles(ids, [], rng)
    players = []
    for order, uid in enumerate(ids):
        role = assignment.roles[uid]
        p = Player(uid, f"U{uid}", order, role=role, initial_role=role)
        p.shield_available = rng.random() < 0.2
        p.vote_shield_available = rng.random() < 0.1
        p.bullet_available = rng.random() < 0.2
        p.fake_doc = rng.random() < 0.2
        players.append(p)
    g = Game(seed, -1, players, rng=rng)
    for _ in range(MAX_DAYS + 2):
        g.start_night()
        assert g.phase is Phase.NIGHT
        for uid in list(g.expected_actors()):
            if rng.random() < 0.1:
                continue  # AFK ойыншы
            opt = rng.choice(g.night_options(uid))
            target = rng.choice(opt.targets) if opt.needs_target else None
            assert g.submit_action(uid, opt.kind, target).ok
        prompt = g.resolve_night()
        g.complete_night(rng.random() < 0.5 if prompt else None)
        if g.check_winner():
            return g
        g.start_vote()
        for p in g.alive():
            choices = g.vote_candidates(p.user_id) + [None]
            assert g.submit_vote(p.user_id, rng.choice(choices)).ok
        g.resolve_vote()
        if rng.random() < 0.02 and g.alive():
            g.desert(rng.choice(g.alive()).user_id)
        g.end_cycle()
        if g.check_winner():
            return g
    raise AssertionError("ойын аяқталмады")


@pytest.mark.parametrize("n", range(balance.MIN_PLAYERS, balance.MAX_PLAYERS + 1))
def test_random_games_terminate(n):
    for seed in range(6):
        g = play_random_game(n, seed * 100 + n)
        res = g.result
        assert res is not None and g.phase is Phase.ENDED
        assert res.winners <= set(g.players)
        for uid in res.winners:
            p = g.players[uid]
            assert not p.deserted
            if res.winner in (Faction.TOWN, Faction.MAFIA) and not p.personal_win:
                assert p.faction is res.winner
        # Бір ойыншы бір қалқанды ең көбі бір рет қолданады.
        for p in g.players.values():
            assert not (p.shield_used and not p.shield_available)
            assert not (p.bullet_used and not p.bullet_available)
            assert not (p.vote_shield_used and not p.vote_shield_available)
