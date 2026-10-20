import random
from collections import Counter

import pytest

from mafia_bot.game import balance
from mafia_bot.game.engine import AFK_NIGHTS, AWAKE_PRESSES, Game, Phase, Player, RoleRequest, assign_roles
from mafia_bot.game.engine import ActionKind as A
from mafia_bot.game.roles import Faction, Role
from mafia_bot.game.roles import name as title  # ойын мәтіндерінде рөл атауы смайликсіз

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


def finish_vote(g, confirm=True):
    """Дауыстарды санап, үміткер болса 👍/👎 растауынан өткізу (әдепкіде бәрі 👍)."""
    first = g.resolve_vote()
    if g.phase is not Phase.CONFIRM:
        return first
    for uid in g.confirm_voters():
        assert g.submit_confirm(uid, confirm).ok
    return g.resolve_confirm()


# --- Рөл тарату ------------------------------------------------------------------------


@pytest.mark.parametrize("n", [4, 7, 14, 23, 37, 50])
def test_assign_roles_matches_composition(n):
    ids = list(range(100, 100 + n))
    a = assign_roles(ids, [], random.Random(n))
    assert set(a.roles) == set(ids)
    counts = Counter(a.roles.values())
    # Higgs-Man тұрғынның орнына шығады (кездейсоқ жалғыз рөл).
    counts[Role.CIVILIAN] += counts.pop(Role.HIGGS, 0)
    assert +counts == balance.composition(n)


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
    assert "Дәрігер біреуді құтқарып қалды" in report.public
    g.start_vote()
    finish_vote(g)
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


def test_don_is_the_shooter_even_when_mafia_votes_decide():
    # Дон бұғатталды, мафия Камикадзеге дауыс берді — Камикадзе мафия мүшесін емес, Донды алып кетеді.
    g = make_game([Role.DON, Role.MAFIA, Role.KAMIKAZE, Role.CIVILIAN, Role.HACKER,
                   Role.COMMISSIONER, Role.DOCTOR])
    report, _ = night(g, {1: (A.MAFIA_KILL, 4), 2: (A.MAFIA_KILL, 3), 5: (A.BLOCK, 1)})
    assert set(report.deaths) == {1, 3} and g.players[1].death_cause == "kamikaze"
    assert g.players[2].alive and g.players[2].role is Role.DON   # мафия мүшесі жаңа Дон болды


def test_beggar_sees_only_the_don_at_mafia_target():
    g = make_game([Role.DON, Role.MAFIA, Role.BEGGAR, Role.CIVILIAN, Role.COMMISSIONER, Role.DOCTOR,
                   Role.CIVILIAN])
    report, _ = night(g, {2: (A.MAFIA_KILL, 4), 3: (A.VISIT, 4)})   # Дон таңдамады, мафия шешті
    assert report.deaths == [4]
    text = private_for(report, 3)[0]
    assert "P1" in text and "P2" not in text


def test_new_don_is_a_random_mafioso():
    new_dons = set()
    for seed in range(20):
        g = make_game([Role.DON, Role.MAFIA, Role.MAFIA, Role.MAFIA, Role.COMMISSIONER, Role.DOCTOR,
                       Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN], seed=seed)
        g.desert(1)
        (don,) = g.with_role(Role.DON)
        new_dons.add(don.user_id)
    assert new_dons == {2, 3, 4}


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
    finish_vote(g)
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
    res = finish_vote(g)
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
    finish_vote(g)
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
    finish_vote(g)
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
    finish_vote(g)
    g.start_night()
    targets = g.night_options(2)[0].targets
    assert 2 not in targets  # өзін тек бір рет
    night(g, {2: (A.HEAL, 4)})
    g.start_vote()
    finish_vote(g)
    g.start_night()
    targets = g.night_options(2)[0].targets
    assert 4 not in targets  # қатарынан екі түн емес


def test_kamikaze_takes_don_even_if_healed():
    g = make_game([Role.DON, Role.KAMIKAZE, Role.DOCTOR, Role.COMMISSIONER, Role.MAFIA, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 1)})
    assert set(report.deaths) == {1, 2}
    assert g.players[1].death_cause == "kamikaze"
    assert g.players[5].role is Role.DON  # мафия мүшесі жаңа Дон болды


def test_kamikaze_ignores_heal_and_wins_when_mafia_shoots():
    g = make_game([Role.DON, Role.KAMIKAZE, Role.DOCTOR, Role.COMMISSIONER, Role.MAFIA, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 2)})
    assert set(report.deaths) == {1, 2}  # Дәрігер Камикадзені құтқара алмайды
    assert "Камикадзе өзімен бірге" in report.public and title(Role.DON) in report.public
    assert g.players[2].personal_win


def test_kamikaze_loses_when_commissioner_shoots():
    g = make_game([Role.DON, Role.KAMIKAZE, Role.DOCTOR, Role.COMMISSIONER, Role.MAFIA, Role.CIVILIAN])
    night(g, {})
    g.start_vote()
    finish_vote(g)
    g.end_cycle()
    g.start_night()
    report, _ = night(g, {4: (A.SHOOT, 2)})
    assert set(report.deaths) == {2, 4}
    assert not g.players[2].personal_win


def lynch_kamikaze(roles):
    g = make_game(roles)
    kamikaze = next(p.user_id for p in g.players.values() if p.role is Role.KAMIKAZE)
    to_vote(g)
    for voter in g.alive_ids():
        if voter != kamikaze:
            assert g.submit_vote(voter, kamikaze).ok
    res = finish_vote(g)
    assert res.deaths == [kamikaze] and g.kamikaze_pending == kamikaze
    return g, kamikaze


KAMIKAZE_GAME = [Role.DON, Role.MAFIA, Role.KAMIKAZE, Role.KAMIKAZE, Role.COMMISSIONER, Role.DOCTOR,
                 Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN]


def test_lynched_kamikaze_takes_the_don_and_wins():
    g, kamikaze = lynch_kamikaze(KAMIKAZE_GAME)
    targets = g.kamikaze_targets()
    assert 1 in targets and all(g.players[t].role is not Role.KAMIKAZE for t in targets)
    report = g.kamikaze_take(1)
    assert report.deaths == [1] and not g.players[1].alive
    assert report.public == f"Камикадзе өзімен бірге {g.players[1].mention} - {title(Role.DON)} алып кетті."
    assert g.players[kamikaze].personal_win and g.kamikaze_pending is None
    assert g.players[2].role is Role.DON  # жаңа Дон


def test_lynched_kamikaze_loses_if_he_takes_the_town():
    g, kamikaze = lynch_kamikaze(KAMIKAZE_GAME)
    report = g.kamikaze_take(5)
    assert report.deaths == [5] and g.players[5].role is Role.COMMISSIONER
    assert not g.players[kamikaze].personal_win


def test_lynched_kamikaze_timeout_and_bad_target():
    g, kamikaze = lynch_kamikaze(KAMIKAZE_GAME)
    other = next(p.user_id for p in g.alive() if p.role is Role.KAMIKAZE)
    assert g.kamikaze_take(other) is None and g.kamikaze_pending == kamikaze  # басқа Камикадзені алуға болмайды
    report = g.kamikaze_take(None)
    assert report.deaths == [] and "ешкімді" in report.public
    assert g.kamikaze_pending is None and g.kamikaze_take(1) is None


def pyro_bombs(g, pyro, targets):
    for _i, t in enumerate(targets):
        night(g, {pyro: (A.BOMB, t)})
        g.start_vote()
        finish_vote(g)
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
    finish_vote(g)
    g.start_night()
    report, prompt = night(g, {1: (A.MAFIA_KILL, 2)})
    assert prompt is None and report.deaths == [2]


def test_witch_decides_on_commissioner_shot():
    g = make_game([Role.DON, Role.WITCH, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    night(g, {})
    g.start_vote()
    finish_vote(g)
    g.start_night()
    report, prompt = night(g, {4: (A.SHOOT, 2)}, witch_punish=True)
    assert prompt.attackers == [4] and report.deaths == [4]


def test_wolf_conversions():
    roles = [Role.DON, Role.WOLF, Role.WOLF, Role.COMMISSIONER, Role.DOCTOR, Role.MANIAC,
             Role.WOLF, Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    night(g, {})
    g.start_vote()
    finish_vote(g)
    g.start_night()
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 4: (A.SHOOT, 3), 6: (A.MANIAC_KILL, 7)})
    assert g.players[2].alive and g.players[2].role is Role.MAFIA
    assert g.players[2].faction is Faction.MAFIA
    assert g.players[3].alive and g.players[3].role is Role.SERGEANT
    assert not g.players[7].alive
    assert report.deaths == [7]
    assert any("мафияға қосылды" in t for t in private_for(report, 1))
    assert "Қасқыр адам мафияға айналды" in report.public
    assert "Қасқыр адам сержантқа айналды" in report.public


def test_doctor_learns_whether_the_heal_mattered():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 4), 2: (A.HEAL, 4)})
    assert report.deaths == []
    name = g.players[4].mention
    assert private_for(report, 2) == [f"{name} түнде емделді! Қонақтары: {title(Role.DON)}"]
    g.start_vote()
    finish_vote(g)
    g.end_cycle()
    g.start_night()
    report, _ = night(g, {2: (A.HEAL, 5)})
    assert private_for(report, 2) == [f"{g.players[5].mention} емдеуді қажет етпеді."]


def test_beggar_sees_visitors():
    roles = [Role.DON, Role.BEGGAR, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN]
    g = make_game(roles)
    report, _ = night(g, {1: (A.MAFIA_KILL, 5), 3: (A.HEAL, 5), 2: (A.VISIT, 5), 4: (A.CHECK, 6)})
    text = private_for(report, 2)[0]
    assert "P1" in text and "P3" in text and "P4" not in text


def test_targets_learn_about_night_actions_privately():
    roles = [Role.DON, Role.BEGGAR, Role.DOCTOR, Role.COMMISSIONER, Role.HACKER, Role.CIVILIAN,
             Role.CIVILIAN, Role.PYRO]
    g = make_game(roles)
    report, _ = night(g, {
        1: (A.MAFIA_KILL, 6),    # мафия 6-ға шабуылдады, бірақ Дәрігер құтқарды
        3: (A.HEAL, 6),
        4: (A.CHECK, 7),         # Комиссар 7-ні тексерді
        2: (A.VISIT, 4),         # Қайыршы Комиссарға барды
        5: (A.BLOCK, 7),         # Хакер әрекеті жоқ 7-ні бұғаттады
        8: (A.BOMB, 2),          # Пиро Қайыршыға бомба қойды
    })
    assert report.deaths == []
    assert any("Дәрігер" in t and "құтқарып" in t for t in private_for(report, 6))
    assert any("Комиссар" in t and "тексерді" in t for t in private_for(report, 7))
    assert any("Хакер" in t and "телефоныңызды бұзды" in t for t in private_for(report, 7))
    assert any("Қайыршы" in t and "бөтелке" in t for t in private_for(report, 4))
    assert any("Пиро" in t and "бомба" in t for t in private_for(report, 2))
    # Хабарда кім екені емес, тек рөлі айтылады; топқа ештеңе жарияланбайды.
    for uid in (2, 4, 6, 7):
        assert all("tg://user" not in t for t in private_for(report, uid) if "түнде" in t)
    assert "тексерді" not in report.public and "бомба қойды" not in report.public


def test_only_effective_actions_reach_alive_targets():
    g = make_game([Role.DON, Role.DOCTOR, Role.HACKER, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 5), 2: (A.HEAL, 6), 3: (A.BLOCK, 2), 4: (A.CHECK, 5)})
    assert report.deaths == [5]
    assert private_for(report, 6) == []                 # бұғатталған Дәрігердің емі болмады
    assert any("әрекетіңіз орындалмады" in t for t in private_for(report, 2))
    assert not any("тексерді" in t for t in private_for(report, 5))  # өлгенге хабар жоқ
    healed = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    report, _ = night(healed, {2: (A.HEAL, 4)})
    assert any("емдеп кетті" in t for t in private_for(report, 4))


def test_player_numbers_never_change():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    assert [p.number for p in g.ordered()] == [1, 2, 3, 4, 5]
    report, _ = night(g, {1: (A.MAFIA_KILL, 2)})
    assert "2. " + g.players[2].mention in report.public    # қаза тапқандар тізімінде
    alive = g.alive_list_text().splitlines()
    assert [line.split(".")[0] for line in alive] == ["1", "3", "4", "5"]
    g.desert(4)
    assert [line.split(".")[0] for line in g.alive_list_text().splitlines()] == ["1", "3", "5"]


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
    res = finish_vote(g)
    assert res.deaths == [1] and title(Role.DON) in res.public
    assert g.check_winner().winner is Faction.TOWN


def test_tie_means_no_lynch():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    to_vote(g)
    g.submit_vote(1, 2)
    g.submit_vote(2, 1)
    res = finish_vote(g)
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
    res = finish_vote(g)
    assert g.players[4].alive and g.players[4].vote_shield_used and "аман қалды" in res.public
    g.end_cycle()
    g.start_night()
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    finish_vote(g)
    assert not g.players[4].alive


def test_suicide_wins_when_lynched_and_keeps_vote_shield():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SUICIDE, Role.CIVILIAN])
    g.players[4].vote_shield_available = True
    to_vote(g)
    for voter in (1, 2, 3, 5):
        g.submit_vote(voter, 4)
    finish_vote(g)
    assert not g.players[4].alive and g.players[4].personal_win
    assert not g.players[4].vote_shield_used


# --- 👍/👎 растау -------------------------------------------------------------------------


def to_confirm(g, target, voters):
    to_vote(g)
    for voter in voters:
        assert g.submit_vote(voter, target).ok
    report = g.resolve_vote()
    assert g.phase is Phase.CONFIRM and g.candidate == target
    assert report.public == "" and report.deaths == []   # үміткер растау хабарында аталады
    assert "дарға асылсын ба" in g.confirm_text(30) and "30 секунд" in g.confirm_text(30)
    return report


def test_lynch_needs_more_likes_than_dislikes():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    to_confirm(g, 1, (2, 3, 4, 5))
    assert g.confirm_voters() == {2, 3, 4, 5}
    assert not g.submit_confirm(1, False).ok          # үміткер өзіне дауыс бермейді
    assert not g.submit_confirm(99, True).ok          # ойыншы емес
    for uid, yes in ((2, True), (3, True), (4, False)):
        assert g.submit_confirm(uid, yes).ok
    assert not g.confirm_complete()
    assert g.submit_confirm(5, False).ok
    assert g.confirm_complete() and g.confirm_counts() == (2, 2)
    res = g.resolve_confirm()
    assert g.players[1].alive and res.deaths == [] and "аман қалды" in res.public
    assert g.phase is Phase.DAY and g.candidate is None


def test_confirmed_lynch_and_change_of_mind():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    to_confirm(g, 1, (2, 3, 4, 5))
    for uid in (2, 3, 4):
        g.submit_confirm(uid, True)
    g.submit_confirm(5, True)
    g.submit_confirm(5, False)  # пікірін өзгертті
    assert g.confirm_counts() == (3, 1)
    assert "3 👍  |  1 👎" in g.confirm_closed_text()
    res = g.resolve_confirm()
    assert res.deaths == [1] and "күндізгі жиналыста дарға асылды" in res.public
    assert "Ол Дон болды" in res.public
    assert g.check_winner().winner is Faction.TOWN


def test_nobody_presses_means_no_lynch():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    to_confirm(g, 4, (1, 2, 3))
    res = g.resolve_confirm()
    assert g.players[4].alive and "аман қалды" in res.public


def test_candidate_leaving_ends_confirmation():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    to_confirm(g, 4, (1, 2, 3, 5))
    g.submit_confirm(2, True)
    g.desert(3)                                # дауыс берген ойыншы шықты — дауысы есептелмейді
    assert g.confirm_counts() == (1, 0)
    g.desert(4)
    assert g.confirm_complete()
    res = g.resolve_confirm()
    assert res.deaths == [] and "ойыннан шықты. Бүгін ешкім асылмайды" in res.public


# --- Балым жалеп -----------------------------------------------------------------------------


def test_sleepless_dies_unless_pressing_ten_times():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SLEEPLESS, Role.CIVILIAN])
    assert [o.kind for o in g.night_options(4)] == [A.AWAKE]       # «Өткізу» жоқ
    assert 4 in g.expected_actors()
    assert not g.submit_action(4, A.AWAKE).ok                      # тек press_awake арқылы
    assert not g.press_awake(5)[0]                                 # тұрғын баса алмайды
    for i in range(1, AWAKE_PRESSES):
        ok, text, done = g.press_awake(4)
        assert ok and not done and f"{i}/{AWAKE_PRESSES}" in text
    assert 4 not in g.actions and not g.night_complete()
    report, _ = night(g, {2: (A.HEAL, 4)})                         # Дәрігер де құтқармайды
    assert report.deaths == [4] and g.players[4].death_cause == "sleepless"
    assert "Балым жалеп (мафиялар өлтірді)" in report.public
    assert "\nБалым жалепті мафиялар дұрыс сормағаны үшін өлтірді\n" in report.public
    assert any("мафиялар өлтірді" in t for t in private_for(report, 4))


def test_sleepless_survives_after_enough_presses():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SLEEPLESS, Role.CIVILIAN, Role.CIVILIAN])
    for _ in range(AWAKE_PRESSES - 1):
        g.press_awake(4)
    ok, text, done = g.press_awake(4)
    assert ok and done and "аман қалдыңыз" in text
    for uid, (kind, target) in {1: (A.SKIP, None), 2: (A.SKIP, None), 3: (A.CHECK, 5)}.items():
        g.submit_action(uid, kind, target)
    assert g.night_complete()                                      # түн ерте аяқтала алады
    report, _ = night(g, {})
    assert report.deaths == [] and g.players[4].alive and g.note_idle([4]) == []
    g.start_vote()
    finish_vote(g)
    g.end_cycle()
    g.start_night()
    assert g.awake == {}                                           # санақ әр түнде нөлден
    report, _ = night(g, {})
    assert report.deaths == [4]


def test_balym_killed_by_mafia_first_gets_no_extra_line():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.SLEEPLESS, Role.CIVILIAN])
    report, _ = night(g, {1: (A.MAFIA_KILL, 4)})
    assert report.deaths == [4] and g.players[4].death_cause == "mafia"
    assert "сормағаны" not in report.public


def test_balym_is_in_every_game_from_seven_players():
    for n in range(4, 51):
        for seed in (1, 2):
            a = assign_roles(list(range(1, n + 1)), [], random.Random(seed), higgs_chance=1)
            assert Counter(a.roles.values())[Role.SLEEPLESS] == (1 if n >= 7 else 0), n


def test_sleepless_cannot_be_bought():
    seven = list(range(1, 8))
    bought = assign_roles(seven, [RoleRequest(1, Role.SLEEPLESS, 5)], random.Random(1))
    assert [r.purchase_id for r in bought.unfulfilled] == [5]
    assert Counter(bought.roles.values())[Role.SLEEPLESS] == 1
    assert g_faction(Role.SLEEPLESS) is Faction.TOWN


def g_faction(role):
    from mafia_bot.game.roles import faction_of

    return faction_of(role)


# --- AFK ------------------------------------------------------------------------------------


def test_afk_after_three_idle_nights_and_any_button_resets():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])

    def idle_night(actions):
        actors = sorted(g.expected_actors())
        for uid, (kind, target) in actions.items():
            assert g.submit_action(uid, kind, target).ok
        idle = g.note_idle(actors)
        g.resolve_night()
        g.complete_night()
        g.start_vote()
        finish_vote(g)
        g.end_cycle()
        g.start_night()
        return idle

    assert idle_night({1: (A.SKIP, None)}) == []
    assert g.players[2].idle_nights == 1 and g.players[3].idle_nights == 1
    assert idle_night({1: (A.SKIP, None), 3: (A.SKIP, None)}) == []  # «Өткізу» де әрекет
    assert g.players[3].idle_nights == 0 and g.players[1].idle_nights == 0
    assert idle_night({1: (A.SKIP, None)}) == [2]
    assert g.players[2].idle_nights == AFK_NIGHTS
    report = g.desert(2, afk=True)
    p = g.players[2]
    assert not p.alive and p.deserted and p.death_cause == "afk"
    assert "3 түн" in report.public and title(Role.DOCTOR) in report.public
    assert g.night_options(4) == [] and 4 not in g.expected_actors()  # тұрғындар AFK болмайды


def test_leave_reveals_role_publicly():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    report = g.desert(3)
    assert "ойыннан шықты" in report.public and title(Role.COMMISSIONER) in report.public
    assert g.players[3].death_cause == "desert"


# --- Жеңіс шарттары --------------------------------------------------------------------------


def test_mafia_wins_on_parity():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    night(g, {1: (A.MAFIA_KILL, 3)})
    assert g.check_winner() is None
    g.start_vote()
    g.submit_vote(1, 4)
    g.submit_vote(2, 4)
    g.submit_vote(4, 1)
    finish_vote(g)
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


def test_only_alive_town_members_win():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    night(g, {1: (A.MAFIA_KILL, 4)})
    g.desert(1)
    res = g.check_winner()
    assert res.winner is Faction.TOWN
    assert res.winners == {2, 3, 5}  # түнде өлген 4-ойыншы жеңбейді


def test_dead_mafia_members_lose_even_if_mafia_wins():
    g = make_game([Role.DON, Role.MAFIA, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    to_vote(g)
    for voter in (1, 3, 4, 5, 6):
        g.submit_vote(voter, 2)
    finish_vote(g)  # мафия мүшесі дарға асылды
    g.desert(5)
    g.desert(6)
    assert g.check_winner() is None  # Дон 1 vs 2 бейбіт — ойын жалғасады
    g.desert(4)
    res = g.check_winner()
    assert res.winner is Faction.MAFIA and res.winners == {1}


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
        finish_vote(g)
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
    finish_vote(g)
    g.desert(1)
    res = g.check_winner()
    assert res.winner is Faction.TOWN and 4 in res.winners


def test_role_intro_lists_team_and_items():
    g = make_game([Role.DON, Role.MAFIA, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN, Role.CIVILIAN])
    g.players[1].shield_available = True
    text = g.role_intro(1)
    assert "Дон" in text and "P2" in text and "Қорғаныс" in text
    assert "P3" not in g.role_intro(2).split("командаңыз")[-1]


# --- ⚛️ Higgs-Man ----------------------------------------------------------------------------


def higgs_game():
    return make_game([Role.DON, Role.HIGGS, Role.DOCTOR, Role.COMMISSIONER, Role.KILLER,
                      Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN])


def next_night(g):
    g.start_vote()
    finish_vote(g)
    g.end_cycle()
    g.start_night()


def test_higgs_survives_three_shots_and_dies_on_fourth():
    g = higgs_game()
    assert g.players[2].higgs_armor == 3 and g.players[2].higgs_vote_save
    report, _ = night(g, {1: (A.MAFIA_KILL, 2), 5: (A.KILLER_KILL, 2)})
    assert report.deaths == [] and g.players[2].higgs_armor == 1
    assert sum("Higgs" in t for t in private_for(report, 2)) == 2
    assert "Higgs өрісі" not in report.public  # ешкімге жарияланбайды
    next_night(g)
    report, _ = night(g, {1: (A.MAFIA_KILL, 2)})
    assert report.deaths == [] and g.players[2].higgs_armor == 0
    next_night(g)
    report, _ = night(g, {5: (A.KILLER_KILL, 2)})
    assert report.deaths == [2]


def test_doctor_heal_keeps_higgs_armor():
    g = higgs_game()
    night(g, {1: (A.MAFIA_KILL, 2), 3: (A.HEAL, 2)})
    assert g.players[2].higgs_armor == 3


def test_higgs_survives_only_first_lynch():
    g = higgs_game()
    for _ in range(2):
        to_vote(g)
        for voter in (1, 3, 4, 5, 6, 7, 8):
            g.submit_vote(voter, 2)
        res = finish_vote(g)
        g.end_cycle()
        if g.players[2].alive:
            assert "аман қалды" in res.public and not g.players[2].higgs_vote_save
        g.start_night()
    assert not g.players[2].alive


def test_higgs_wins_with_any_side_if_alive():
    g = higgs_game()
    for uid in (3, 4, 6, 7, 8):
        g.desert(uid)
    res = g.check_winner()  # Дон+Киллер (2) vs Higgs (1) — мафия жеңді
    assert res.winner is Faction.MAFIA and res.winners == {1, 2, 5}

    g = higgs_game()
    for uid in (1, 5):
        g.desert(uid)
    res = g.check_winner()
    assert res.winner is Faction.TOWN and 2 in res.winners


def test_dead_higgs_loses():
    g = higgs_game()
    g.desert(2)
    for uid in (1, 5):
        g.desert(uid)
    assert 2 not in g.check_winner().winners


def test_higgs_appears_rarely():
    ids = list(range(1, 14))
    always = assign_roles(ids, [], random.Random(1), higgs_chance=1)
    assert Counter(always.roles.values())[Role.HIGGS] == 1
    assert sum(always.roles[u] is Role.CIVILIAN for u in ids) == balance.composition(13)[Role.CIVILIAN] - 1
    no_civilians = assign_roles(list(range(1, 11)), [], random.Random(1), higgs_chance=1)
    assert Role.HIGGS not in no_civilians.roles.values()  # тұрғын жоқ болса, Higgs та шықпайды
    never = assign_roles(ids, [], random.Random(1), higgs_chance=0)
    assert Role.HIGGS not in never.roles.values()
    small = assign_roles(list(range(1, 8)), [], random.Random(1), higgs_chance=1)
    assert Role.HIGGS not in small.roles.values()  # 8-ден аз ойыншыда шықпайды


@pytest.mark.parametrize("n,slot", [(4, Role.CIVILIAN), (8, Role.BEGGAR), (13, Role.CIVILIAN), (16, Role.BEGGAR)])
def test_bought_higgs_takes_a_civilian_or_beggar_slot(n, slot):
    ids = list(range(1, n + 1))
    a = assign_roles(ids, [RoleRequest(3, Role.HIGGS, 9)], random.Random(n), higgs_chance=0)
    assert a.roles[3] is Role.HIGGS and [r.purchase_id for r in a.fulfilled] == [9]
    counts = Counter(a.roles.values())
    expected = balance.composition(n)
    expected[slot] -= 1
    expected[Role.HIGGS] += 1
    assert counts == +expected


def test_only_one_higgs_per_game():
    ids = list(range(1, 14))
    reqs = [RoleRequest(1, Role.HIGGS, 1), RoleRequest(2, Role.HIGGS, 2)]
    for chance in (0, 1):  # кездейсоқ Higgs шықса, сатып алған адам сол орынды алады
        a = assign_roles(ids, reqs, random.Random(1), higgs_chance=chance)
        assert a.roles[1] is Role.HIGGS and a.roles[2] is not Role.HIGGS
        assert Counter(a.roles.values())[Role.HIGGS] == 1
        assert [r.purchase_id for r in a.unfulfilled] == [2]
    # Бір орын да жоқ (Қайыршыны басқа ойыншы сатып алды, тұрғын жоқ) — кезекте қалады.
    taken = assign_roles(list(range(1, 9)), [RoleRequest(5, Role.BEGGAR, 3), RoleRequest(1, Role.HIGGS, 4)],
                         random.Random(1), higgs_chance=0)
    assert taken.roles[5] is Role.BEGGAR and Role.HIGGS not in taken.roles.values()
    assert [r.purchase_id for r in taken.unfulfilled] == [4]


def test_higgs_shown_to_commissioner():
    g = higgs_game()
    report, _ = night(g, {4: (A.CHECK, 2)})
    assert any("Higgs-Man" in t for t in private_for(report, 4))


# --- Ортақ чатқа шығатын хабарлар -------------------------------------------------------------


def test_action_announcements_hide_targets():
    g = make_game([Role.DON, Role.MAFIA, Role.DOCTOR, Role.COMMISSIONER, Role.HACKER, Role.CIVILIAN])
    don = g.action_announcement(1, A.MAFIA_KILL)
    mafia = g.action_announcement(2, A.MAFIA_KILL)
    assert "Дон" in don and "Мафия мүшесі" in mafia and don != mafia
    assert "тергеу" in g.action_announcement(4, A.CHECK)
    assert "тапаншасын" in g.action_announcement(4, A.SHOOT)
    assert g.action_announcement(3, A.SKIP) is None
    for kind in (A.HEAL, A.BLOCK, A.KILLER_KILL, A.MANIAC_KILL, A.PROTECT, A.VISIT, A.BOMB, A.DETONATE):
        text = g.action_announcement(3, kind)
        assert text and "P" not in text  # ойыншы аты айтылмайды


def test_vote_announcement_per_voter():
    g = make_game([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN])
    to_vote(g)
    g.submit_vote(1, 2)
    g.submit_vote(3, None)
    assert "P1" in g.vote_announcement(1) and "P2" in g.vote_announcement(1)
    assert "дауыс берді" in g.vote_announcement(1)
    assert "қалыс" in g.vote_announcement(3)


@pytest.mark.parametrize("lang,word", [("en", "Night"), ("ru", "Ночь"), ("tr", "gece"),
                                       ("uz", "kecha"), ("ky", "түн"), ("kk", "түн")])
def test_game_texts_follow_language(lang, word):
    players = [Player(i, f"P{i}", i, role=r, initial_role=r)
               for i, r in enumerate([Role.DON, Role.DOCTOR, Role.COMMISSIONER, Role.CIVILIAN], 1)]
    g = Game(1, -1, players, rng=random.Random(0), lang=lang)
    assert word in g.start_night()
    assert g.t("role.don") in g.role_intro(1)
