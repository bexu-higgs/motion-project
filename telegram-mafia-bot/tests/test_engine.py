import random
from collections import Counter

import pytest

from mafia_bot.game import balance
from mafia_bot.game.engine import ActionKind as A
from mafia_bot.game.engine import Phase, RoleRequest, assign_roles
from mafia_bot.game.roles import Faction, Role, title

from conftest import make_game


def night(game, actions, witch_punish=None):
    """Түнгі әрекеттерді енгізіп, түнді аяқтау."""
    for uid, (kind, target) in actions.items():
        res = game.submit_action(uid, kind, target)
        assert res.ok, (uid, kind, target, res.message)
    prompt = game.resolve_night()
    report = game.complete_night(witch_punish if prompt else None)
    return report, prompt


def private_for(report, uid):
    return [text for u, text in report.private if u == uid]


# --- Рөл тарату ------------------------------------------------------------------------


@pytest.mark.parametrize("n", [4, 7, 14, 23, 37, 50])
def test_assign_roles_matches_composition(n):
    ids = list(range(100, 100 + n))
    a = assign_roles(ids, [], random.Random(n))
    assert set(a.roles) == set(ids)
    assert Counter(a.roles.values()) == balance.composition(n)


def test_purchased_role_is_honoured_in_purchase_order():
    ids = [1, 2, 3, 4, 5, 6]
    reqs = [RoleRequest(3, Role.DON, 10), RoleRequest(5, Role.DON, 11), RoleRequest(2, Role.MAFIA, 12)]
    a = assign_roles(ids, reqs, random.Random(1))
    assert a.roles[3] is Role.DON
    assert a.roles[2] is Role.MAFIA
    assert a.roles[5] is not Role.DON
    assert [r.purchase_id for r in a.fulfilled] == [10, 12]
    assert [r.purchase_id for r in a.unfulfilled] == [11]


def test_unavailable_purchased_role_is_not_given():
    a = assign_roles([1, 2, 3, 4], [RoleRequest(1, Role.MANIAC, 7)], random.Random(0))
    assert a.roles[1] is not Role.MANIAC
    assert a.unfulfilled and not a.fulfilled
    assert Counter(a.roles.values()) == balance.composition(4)


def test_one_request_per_player():
    reqs = [RoleRequest(1, Role.DON, 1), RoleRequest(1, Role.DOCTOR, 2)]
    a = assign_roles([1, 2, 3, 4], reqs, random.Random(0))
    assert a.roles[1] is Role.DON
    assert len(a.fulfilled) == 1 and not a.unfulfilled


def test_assign_rejects_duplicates():
    with pytest.raises(ValueError):
        assign_roles([1, 1, 2, 3], [], random.Random(0))


def test_one_head_defender():
    g = make_game([Role.DON, Role.DEFENDER, Role.DEFENDER, Role.COMMISSIONER, Role.DOCTOR])
    assert sum(p.head_defender for p in g.players.values()) == 1


# --- Түн ---------------------------------------------------------------------------------


def test_mafia_kill_and_doctor_heal():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 4), 2: (A.HEAL, 4), 3: (A.CHECK, 1)})
    assert g.players[4].alive and report.deaths == []
    assert "Дәрігер біреудің өмірін сақтап қалды" in report.public
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, _ = night(g, {1: (A.MAFIA_KILL, 4), 2: (A.HEAL, 3), 3: (A.CHECK, 2)})
    assert report.deaths == [4] and not g.players[4].alive
    assert "Тұрғын" in report.public  # рөл ашылады


def test_don_choice_beats_mafia_votes():
    g = make_game([Role.DON, Role.MAFIA, Role.CIVILIAN, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    report, _ = night(g, {1: (A.MAFIA_KILL, 3), 2: (A.MAFIA_KILL, 4)})
    assert report.deaths == [3]


def test_mafia_votes_decide_when_don_blocked():
    g = make_game([Role.DON, Role.MAFIA, Role.CIVILIAN, Role.CIVILIAN, Role.HACKER,
                   Role.COMMISSIONER, Role.DOCTOR])
    report, _ = night(g, {1: (A.MAFIA_KILL, 3), 2: (A.MAFIA_KILL, 4), 5: (A.BLOCK, 1)})
    assert report.deaths == [4]
    assert any("хакер" in t for t in private_for(report, 1))


def test_don_skip_means_no_kill():
    g = make_game([Role.DON, Role.MAFIA, Role.CIVILIAN, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    report, _ = night(g, {1: (A.SKIP, None), 2: (A.MAFIA_KILL, 4)})
    assert report.deaths == []


def test_hacker_blocks_doctor():
    g = make_game([Role.DON, Role.DOCTOR, Role.HACKER, Role.CIVILIAN, Role.COMMISSIONER])
    report, _ = night(g, {1: (A.MAFIA_KILL, 4), 2: (A.HEAL, 4), 3: (A.BLOCK, 2)})
    assert report.deaths == [4]


def test_mafia_cannot_target_team():
    g = make_game([Role.DON, Role.MAFIA, Role.KILLER, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    for uid in (1, 2, 3):
        targets = {t for o in g.night_options(uid) for t in o.targets}
        assert targets.isdisjoint({1, 2, 3})
    assert not g.submit_action(1, A.MAFIA_KILL, 2).ok


def test_commissioner_check_and_no_shot_first_night():
    g = make_game([Role.DON, Role.COMMISSIONER, Role.SERGEANT, Role.DOCTOR, Role.CIVILIAN])
    kinds = {o.kind for o in g.night_options(2)}
    assert A.SHOOT not in kinds and A.CHECK in kinds
    assert not g.submit_action(2, A.SHOOT, 1).ok
    report, _ = night(g, {2: (A.CHECK, 1)})
    assert any(title(Role.DON) in t for t in private_for(report, 2))
    assert any(title(Role.DON) in t for t in private_for(report, 3))  # сержант та біледі
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    assert A.SHOOT in {o.kind for o in g.night_options(2)}
    report, _ = night(g, {2: (A.SHOOT, 1)})
    assert report.deaths == [1]


def test_defender_cover_hides_mafia_and_saves_from_lynch():
    roles = [Role.DON, Role.DEFENDER, Role.DEFENDER, Role.COMMISSIONER, Role.DOCTOR,
             Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    head = next(p.user_id for p in g.players.values() if p.head_defender)
    other = 5 - head
    assert g.night_options(other) == []  # екінші қорғаушы нысана таңдамайды
    report, _ = night(g, {head: (A.PROTECT, 1), 4: (A.CHECK, 1)})
    assert any(title(Role.CIVILIAN) in t for t in private_for(report, 4))
    g.start_vote()
    for voter in (2, 3, 4, 5, 6, 7):
        assert g.submit_vote(voter, 1).ok
    res = g.resolve_vote()
    assert g.players[1].alive and "аман қалды" in res.public


def test_defender_cover_does_nothing_for_town():
    g = make_game([Role.DON, Role.DEFENDER, Role.DEFENDER, Role.COMMISSIONER, Role.DOCTOR,
                   Role.CIVILIAN, Role.CIVILIAN])
    head = next(p.user_id for p in g.players.values() if p.head_defender)
    report, _ = night(g, {head: (A.PROTECT, 6), 4: (A.CHECK, 5 - head)})
    assert g.defender_cover is None
    assert any(title(Role.DEFENDER) in t for t in private_for(report, 4))


def test_fake_document_only_first_check():
    g = make_game([Role.DON, Role.COMMISSIONER, Role.DOCTOR, Role.CIVILIAN])
    g.players[1].fake_doc = True
    report, _ = night(g, {2: (A.CHECK, 1)})
    assert any(title(Role.CIVILIAN) in t for t in private_for(report, 2))
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, _ = night(g, {2: (A.CHECK, 1)})
    assert any(title(Role.DON) in t for t in private_for(report, 2))


def test_shield_blocks_only_first_attack():
    g = make_game([Role.DON, Role.KILLER, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER,
                   Role.CIVILIAN])
    g.players[3].shield_available = True
    report, _ = night(g, {1: (A.MAFIA_KILL, 3), 2: (A.KILLER_KILL, 3)})
    assert report.deaths == [3]
    assert g.players[3].shield_used


def test_shield_saves_and_is_secret():
    g = make_game([Role.DON, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    g.players[2].shield_available = True
    report, _ = night(g, {1: (A.MAFIA_KILL, 2)})
    assert report.deaths == [] and g.players[2].shield_used
    assert any("қорғанысыңыз" in t for t in private_for(report, 2))
    assert "қорғаныс" not in report.public.lower()


def test_doctor_heal_does_not_consume_shield():
    g = make_game([Role.DON, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    g.players[2].shield_available = True
    night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 2)})
    assert not g.players[2].shield_used


def test_piercing_bullet_breaks_shield_and_is_spent_once():
    g = make_game([Role.DON, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    g.players[1].bullet_available = True
    g.players[2].shield_available = True
    report, _ = night(g, {1: (A.MAFIA_KILL, 5)})
    assert report.deaths == [5] and not g.players[1].bullet_used  # қалқан жоқ — оқ сақталады
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, _ = night(g, {1: (A.MAFIA_KILL, 2)})
    assert report.deaths == [2] and g.players[1].bullet_used


def test_piercing_bullet_does_not_beat_doctor():
    g = make_game([Role.DON, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER])
    g.players[1].bullet_available = True
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 2)})
    assert report.deaths == [] and not g.players[1].bullet_used


def test_doctor_restrictions():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    night(g, {2: (A.HEAL, 2)})
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    targets = g.night_options(2)[0].targets
    assert 2 not in targets  # өзін тек бір рет
    night(g, {2: (A.HEAL, 4)})
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    targets = g.night_options(2)[0].targets
    assert 4 not in targets  # қатарынан екі түн емес


def test_kamikaze_takes_don_even_if_healed():
    g = make_game([Role.DON, Role.KAMIKAZE, Role.DOCTOR, Role.COMMISSIONER, Role.MAFIA, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 1)})
    assert set(report.deaths) == {1, 2}
    assert g.players[1].death_cause == "kamikaze"
    assert g.players[5].role is Role.DON  # мафия мүшесі жаңа Дон болды


def test_kamikaze_healed_no_counter():
    g = make_game([Role.DON, Role.KAMIKAZE, Role.DOCTOR, Role.COMMISSIONER])
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 2)})
    assert report.deaths == []


def pyro_bombs(g, pyro, targets):
    for _i, t in enumerate(targets):
        night(g, {pyro: (A.BOMB, t)})
        g.start_vote()
        g.resolve_vote()
        g.end_cycle()
        g.start_night()


def test_pyro_wins_when_all_bombed_die_and_kamikaze_has_no_counter():
    g = make_game([Role.PYRO, Role.KAMIKAZE, Role.WITCH, Role.CIVILIAN, Role.DOCTOR, Role.DON,
                   Role.COMMISSIONER, Role.CIVILIAN])
    assert A.DETONATE not in {o.kind for o in g.night_options(1)}
    pyro_bombs(g, 1, [2, 3, 4])
    assert A.DETONATE in {o.kind for o in g.night_options(1)}
    report, prompt = night(g, {1: (A.DETONATE, None)})
    assert prompt is None  # Сиқыршының сиқыры бомбаға қарсы жұмыс істемейді
    assert set(report.deaths) == {1, 2, 3, 4}
    assert g.players[1].personal_win
    assert g.players[1].death_cause == "pyro_self"


def test_pyro_loses_if_doctor_saves_target():
    g = make_game([Role.PYRO, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.DOCTOR, Role.DON,
                   Role.COMMISSIONER])
    pyro_bombs(g, 1, [2, 3, 4])
    report, _ = night(g, {1: (A.DETONATE, None), 5: (A.HEAL, 3)})
    assert set(report.deaths) == {1, 2, 4}
    assert not g.players[1].personal_win


def test_shield_does_not_stop_bomb():
    g = make_game([Role.PYRO, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.DOCTOR, Role.DON,
                   Role.COMMISSIONER])
    pyro_bombs(g, 1, [2, 3, 4])
    g.players[2].shield_available = True
    report, _ = night(g, {1: (A.DETONATE, None)})
    assert 2 in report.deaths and not g.players[2].shield_used


def test_witch_punishes_attacker():
    g = make_game([Role.DON, Role.WITCH, Role.DOCTOR, Role.COMMISSIONER, Role.MAFIA, Role.CIVILIAN])
    g.submit_action(1, A.MAFIA_KILL, 2)
    prompt = g.resolve_night()
    assert prompt is not None and prompt.witch_id == 2 and prompt.attackers == [1]
    report = g.complete_night(True)
    assert report.deaths == [1] and g.players[2].alive
    assert g.players[1].death_cause == "witch"


def test_witch_forgives_and_magic_is_once():
    g = make_game([Role.DON, Role.WITCH, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    report, prompt = night(g, {1: (A.MAFIA_KILL, 2)}, witch_punish=False)
    assert prompt is not None and report.deaths == []
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, prompt = night(g, {1: (A.MAFIA_KILL, 2)})
    assert prompt is None and report.deaths == [2]


def test_witch_decides_on_commissioner_shot():
    g = make_game([Role.DON, Role.WITCH, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    night(g, {})
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, prompt = night(g, {4: (A.SHOOT, 2)}, witch_punish=True)
    assert prompt.attackers == [4] and report.deaths == [4]


def test_wolf_conversions():
    roles = [Role.DON, Role.WOLF, Role.WOLF, Role.COMMISSIONER, Role.DOCTOR, Role.MANIAC,
             Role.WOLF, Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    night(g, {})
    g.start_vote()
    g.resolve_vote()
    g.start_night()
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 4: (A.SHOOT, 3), 6: (A.MANIAC_KILL, 7)})
    assert g.players[2].alive and g.players[2].role is Role.MAFIA
    assert g.players[2].faction is Faction.MAFIA
    assert g.players[3].alive and g.players[3].role is Role.SERGEANT
    assert not g.players[7].alive
    assert report.deaths == [7]
    assert any("мафияға қосылды" in t for t in private_for(report, 1))


def test_beggar_sees_visitors():
    roles = [Role.DON, Role.BEGGAR, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    report, _ = night(g, {1: (A.MAFIA_KILL, 5), 3: (A.HEAL, 5), 2: (A.VISIT, 5), 4: (A.CHECK, 6)})
    text = private_for(report, 2)[0]
    assert "P1" in text and "P3" in text and "P4" not in text


def test_promotions():
    roles = [Role.DON, Role.MAFIA, Role.COMMISSIONER, Role.SERGEANT, Role.DEFENDER, Role.DEFENDER,
             Role.DOCTOR, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    head = next(p.user_id for p in g.players.values() if p.head_defender)
    second = 11 - head
    g.desert(1)
    g.desert(3)
    g.desert(head)
    assert g.players[2].role is Role.DON
    assert g.players[4].role is Role.COMMISSIONER
    assert g.players[second].head_defender


def test_maniac_and_killer_attack():
    roles = [Role.DON, Role.KILLER, Role.MANIAC, Role.DOCTOR, Role.COMMISSIONER] + [Role.CIVILIAN] * 3
    g = make_game(roles)
    report, _ = night(g, {1: (A.MAFIA_KILL, 6), 2: (A.KILLER_KILL, 7), 3: (A.MANIAC_KILL, 8)})
    assert report.deaths == [6, 7, 8]


def test_submit_validation():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    assert not g.submit_action(4, A.MAFIA_KILL, 2).ok  # рөлі жоқ
    assert not g.submit_action(1, A.MAFIA_KILL, 1).ok  # өзін
    assert not g.submit_action(1, A.MAFIA_KILL, 99).ok
    assert g.submit_action(1, A.MAFIA_KILL, 2).ok
    assert not g.submit_action(1, A.MAFIA_KILL, 3).ok  # екінші рет
    assert not g.night_complete()
    g.submit_action(2, A.SKIP)
    g.submit_action(3, A.CHECK, 1)
    assert g.night_complete()


# --- Күн -----------------------------------------------------------------------------------


def to_vote(g):
    night(g, {})
    g.start_vote()


def test_plurality_lynch_reveals_role():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    to_vote(g)
    for voter, target in {2: 1, 3: 1, 4: 1, 1: 4, 5: None}.items():
        assert g.submit_vote(voter, target).ok
    assert g.vote_complete()
    res = g.resolve_vote()
    assert res.deaths == [1] and title(Role.DON) in res.public
    assert g.check_winner().winner is Faction.TOWN


def test_tie_means_no_lynch():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    to_vote(g)
    g.submit_vote(1, 2)
    g.submit_vote(2, 1)
    res = g.resolve_vote()
    assert res.deaths == [] and "тең" in res.public


def test_vote_validation():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    assert not g.submit_vote(1, 2).ok  # әлі түн
    to_vote(g)
    assert not g.submit_vote(1, 1).ok
    assert g.submit_vote(1, 2).ok
    assert not g.submit_vote(1, 3).ok


def test_vote_shield_saves_once():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    g.players[4].vote_shield_available = True
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    res = g.resolve_vote()
    assert g.players[4].alive and g.players[4].vote_shield_used and "аман қалды" in res.public
    g.end_cycle()
    g.start_night()
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    g.resolve_vote()
    assert not g.players[4].alive


def test_suicide_wins_when_lynched_and_keeps_vote_shield():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SUICIDE, Role.CIVILIAN])
    g.players[4].vote_shield_available = True
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    g.resolve_vote()
    assert not g.players[4].alive and g.players[4].personal_win
    assert not g.players[4].vote_shield_used


# --- Жеңіс шарттары --------------------------------------------------------------------------


def test_mafia_wins_on_parity():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    night(g, {1: (A.MAFIA_KILL, 3)})
    assert g.check_winner() is None
    g.start_vote()
    g.submit_vote(1, 4)
    g.submit_vote(2, 4)
    g.submit_vote(4, 1)
    g.resolve_vote()
    res = g.check_winner()
    assert res.winner is Faction.MAFIA and res.winners == {1}
    assert g.phase is Phase.ENDED


def test_defenders_win_with_mafia_but_do_not_count_for_parity():
    roles = [Role.DON, Role.DEFENDER, Role.DEFENDER, Role.CIVILIAN, Role.DOCTOR, Role.COMMISSIONER]
    g = make_game(roles)
    assert g.check_winner() is None
    for uid in (4, 5):
        g.desert(uid)
    res = g.check_winner()  # Дон 1 vs Комиссар 1 (қорғаушылар есептелмейді)
    assert res.winner is Faction.MAFIA and res.winners == {1, 2, 3}


def test_town_wins_and_dead_town_members_win_too():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    night(g, {1: (A.MAFIA_KILL, 4)})
    g.desert(1)
    res = g.check_winner()
    assert res.winner is Faction.TOWN
    assert res.winners == {2, 3, 4, 5}


def test_deserter_never_wins():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    g.desert(5)
    g.desert(1)
    assert 5 not in g.check_winner().winners


def test_maniac_wins_last_two():
    g = make_game([Role.DON, Role.MANIAC, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    for uid in (3, 4, 5):
        g.desert(uid)
    res = g.check_winner()
    assert res.winner is Faction.INDEPENDENT and res.winners == {2}


def test_maniac_blocks_mafia_parity():
    g = make_game([Role.DON, Role.MAFIA, Role.MANIAC, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    for uid in (4, 5):
        g.desert(uid)
    assert g.check_winner() is None  # 2 мафия vs 2, бірақ Қанішер тірі


def test_draw_after_quiet_cycles():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    for _ in range(3):
        to_vote(g)
        g.resolve_vote()
        g.end_cycle()
        if g.check_winner():
            break
        g.start_night()
    res = g.check_winner()
    assert res is not None and res.winner is None and res.winners == frozenset()


def test_personal_win_is_added_to_faction_win():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SUICIDE, Role.CIVILIAN])
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    g.resolve_vote()
    g.desert(1)
    res = g.check_winner()
    assert res.winner is Faction.TOWN and 4 in res.winners


def test_role_intro_lists_team_and_items():
    g = make_game([Role.DON, Role.MAFIA, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    g.players[1].shield_available = True
    text = g.role_intro(1)
    assert "Дон" in text and "P2" in text and "Қорғаныс" in text
    assert "P3" not in g.role_intro(2).split("командаңыз")[-1]
