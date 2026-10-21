"""Кездейсоқ әрекеттермен толық ойындарды симуляциялау."""

import random

import pytest

from mafia_bot.game import balance
from mafia_bot.game.engine import AFK_NIGHTS, MAX_DAYS, ActionKind, Game, Phase, Player, assign_roles
from mafia_bot.game.roles import Faction, Role


def play_random_game(n: int, seed: int) -> Game:
    rng = random.Random(seed)
    ids = list(range(1000, 1000 + n))
    assignment = assign_roles(ids, [], rng, higgs_chance=0.5)
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
        actors = sorted(g.expected_actors())
        for uid in actors:
            if rng.random() < 0.3:
                continue  # AFK ойыншы
            opt = rng.choice(g.night_options(uid))
            if opt.kind is ActionKind.AWAKE:  # Балым жалеп кейде жеткілікті басады, кейде жоқ
                for _ in range(rng.choice((3, 10, 11))):
                    assert g.press_awake(uid)[0]
                continue
            target = rng.choice(opt.targets) if opt.needs_target else None
            assert g.submit_action(uid, opt.kind, target).ok
        idle = g.note_idle(actors)
        prompt = g.resolve_night()
        g.complete_night(rng.random() < 0.5 if prompt else None)
        for uid in idle:
            assert g.players[uid].idle_nights >= AFK_NIGHTS
            g.desert(uid, afk=True)
        if g.check_winner():
            return g
        g.start_vote()
        for p in g.alive():
            choices = g.vote_candidates(p.user_id) + [None]
            # Көңілдес барған ойыншы бұл күні дауыс бере алмайды.
            assert g.submit_vote(p.user_id, rng.choice(choices)).ok is (p.user_id not in g.silenced)
        assert g.vote_complete()
        g.resolve_vote()
        if g.phase is Phase.CONFIRM:
            for uid in g.confirm_voters():
                if rng.random() < 0.8:
                    assert g.submit_confirm(uid, rng.random() < 0.6).ok
            assert not g.submit_confirm(g.candidate, True).ok
            g.resolve_confirm()
        assert g.phase is Phase.DAY or g.result is not None
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
            if p.personal_win:
                continue  # Өзін-өзі өлтіруші / Пиро — өлімі арқылы жеңеді
            assert p.alive, "тек тірі қалғандар жеңеді"
            if p.role is Role.HIGGS:
                continue
            if res.winner in (Faction.TOWN, Faction.MAFIA):
                assert p.faction is res.winner
        # Тірі Higgs-Man әрдайым жеңеді; өлгендер (жеке жеңістен басқа) ешқашан жеңбейді.
        for p in g.players.values():
            if p.role is Role.HIGGS and p.alive and not p.deserted:
                assert p.user_id in res.winners
            if not p.alive and not p.personal_win:
                assert p.user_id not in res.winners
        # Бір ойыншы бір қалқанды ең көбі бір рет қолданады.
        for p in g.players.values():
            assert not (p.shield_used and not p.shield_available)
            assert not (p.bullet_used and not p.bullet_available)
            assert not (p.vote_shield_used and not p.vote_shield_available)
