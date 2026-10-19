from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest

from mafia_bot import economy
from mafia_bot.game import balance
from mafia_bot.game.roles import Role


@pytest.mark.parametrize("n", range(balance.MIN_PLAYERS, balance.MAX_PLAYERS + 1))
def test_composition_sums_to_player_count(n):
    comp = balance.composition(n)
    assert sum(comp.values()) == n
    assert all(v > 0 for v in comp.values())
    assert comp[Role.DON] == 1
    assert comp[Role.COMMISSIONER] == 1
    assert comp[Role.DOCTOR] == 1


def test_four_players_exact():
    assert balance.composition(4) == Counter(
        {Role.DON: 1, Role.COMMISSIONER: 1, Role.DOCTOR: 1, Role.CIVILIAN: 1}
    )


def test_fifty_players_matches_spec():
    expected = {
        Role.DON: 1, Role.MAFIA: 8, Role.KILLER: 1, Role.DEFENDER: 2, Role.COMMISSIONER: 1,
        Role.SERGEANT: 3, Role.DOCTOR: 1, Role.HACKER: 1, Role.BEGGAR: 1, Role.KAMIKAZE: 3,
        Role.SUICIDE: 1, Role.WITCH: 1, Role.PYRO: 1, Role.WOLF: 3, Role.MANIAC: 1,
        Role.CIVILIAN: 21,
    }
    assert balance.composition(50) == Counter(expected)


@pytest.mark.parametrize(
    "n,mafia",
    [(4, 0), (5, 0), (6, 1), (7, 1), (8, 1), (9, 1), (10, 2), (11, 2), (12, 3), (15, 3), (16, 4), (23, 4),
     (24, 5), (28, 6), (35, 6), (36, 7), (43, 7), (44, 8), (50, 8)],
)
def test_mafia_counts_follow_table(n, mafia):
    assert balance.composition(n)[Role.MAFIA] == mafia


def test_special_roles_never_decrease():
    prev = balance.composition(4)
    for n in range(5, 51):
        cur = balance.composition(n)
        for role in Role:
            if role is not Role.CIVILIAN:
                assert cur[role] >= prev[role], (n, role)
        prev = cur


@pytest.mark.parametrize("n", [3, 51, 0])
def test_composition_rejects_bad_sizes(n):
    with pytest.raises(ValueError):
        balance.composition(n)


def test_min_players_for():
    assert balance.min_players_for(Role.DON) == 4
    assert balance.min_players_for(Role.SERGEANT) == 10
    assert balance.min_players_for(Role.MANIAC) == 44
    assert balance.role_available(Role.HACKER, 6)
    assert not balance.role_available(Role.HACKER, 5)


@pytest.mark.parametrize(
    "role,first", [(Role.HACKER, 6), (Role.BEGGAR, 6), (Role.WOLF, 8), (Role.KAMIKAZE, 8)]
)
def test_requested_role_thresholds(role, first):
    assert balance.min_players_for(role) == first
    assert balance.composition(first)[role] == 1
    assert balance.composition(first - 1)[role] == 0


def test_role_prices():
    for role in (Role.DON, Role.KAMIKAZE, Role.MANIAC, Role.PYRO, Role.KILLER):
        assert economy.role_price(role) == 2
    for role in (Role.MAFIA, Role.DOCTOR, Role.COMMISSIONER, Role.WOLF, Role.WITCH, Role.HACKER):
        assert economy.role_price(role) == 1


def test_small_games_are_faster():
    small, big = balance.timings(4), balance.timings(30)
    assert small.night < big.night and small.vote < big.vote


@pytest.mark.parametrize("n,reward", [(4, 20), (10, 30), (20, 40), (30, 50), (40, 60), (50, 70)])
def test_win_reward_table(n, reward):
    assert economy.win_reward(n) == reward


def test_win_reward_monotonic_and_integer():
    values = [economy.win_reward(n) for n in range(4, 51)]
    assert values == sorted(values)
    assert all(isinstance(v, int) for v in values)
    assert economy.win_reward(7) == 25


def test_diamond_packages_get_cheaper():
    per = [p.per_diamond_kzt for p in economy.DIAMOND_PACKAGES]
    assert per == sorted(per, reverse=True)
    assert economy.format_kzt(1399) == "1 399"
    assert economy.format_kzt(9.9) == "9,90"


NOW = datetime(2026, 1, 10, 12, 0, tzinfo=UTC)


def test_daily_first_claim():
    r = economy.compute_daily(None, 0, NOW)
    assert r.ok and r.day == 1 and r.reward == 10


def test_daily_cooldown():
    r = economy.compute_daily(NOW - timedelta(hours=23), 1, NOW)
    assert not r.ok and r.wait == timedelta(hours=1)


def test_daily_streak_and_cycle():
    rewards = []
    streak, last = 0, None
    now = NOW
    for _ in range(9):
        r = economy.compute_daily(last, streak, now)
        assert r.ok
        rewards.append(r.reward)
        streak, last = r.day, now
        now += timedelta(hours=25)
    assert rewards == [10, 15, 20, 25, 30, 35, 50, 10, 15]


def test_daily_streak_resets_after_48h():
    r = economy.compute_daily(NOW - timedelta(hours=49), 5, NOW)
    assert r.ok and r.day == 1
