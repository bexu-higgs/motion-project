import asyncio
import random

import pytest

from mafia_bot.controller import GameManager
from mafia_bot.db.models import Inventory
from mafia_bot.economy import win_reward
from mafia_bot.game import balance
from mafia_bot.game.engine import Phase, RoleRequest
from mafia_bot.game.roles import Role

from fakes import AutoPlayers, FakeNotifier, FakeStorage

CHAT = -1001


def make_manager(notifier=None, storage=None, **kw):
    notifier = notifier or FakeNotifier()
    storage = storage or FakeStorage()
    params = dict(registration_seconds=5, time_scale=0.002, lobby_edit_delay=0, confirm_edit_delay=0,
                  rng_factory=lambda: random.Random(7))
    params.update(kw)
    return GameManager(notifier, storage, **params), notifier, storage


async def wait_until(cond, timeout=10.0):
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    while not cond():
        if loop.time() > end:
            raise AssertionError("шарт орындалмады")
        await asyncio.sleep(0.005)


async def open_with_players(manager, n):
    assert await manager.open_lobby(CHAT, "Тест чат", owner_id=1) is None
    gid = next(iter(manager.lobby_by_game))
    for uid in range(1, n + 1):
        text = await manager.join(gid, uid, f"Ойыншы {uid}")
        assert "тіркелдіңіз" in text, text
    return gid


async def test_lobby_join_rules():
    manager, notifier, storage = make_manager()
    gid = await open_with_players(manager, 3)
    assert "тіркелгенсіз" in await manager.join(gid, 1, "Ойыншы 1")
    assert await manager.open_lobby(CHAT, "Тест чат", 1) is not None  # бір чатта бір ойын
    assert "кемінде 4" in await manager.force_start(CHAT)
    # Екінші чаттағы ойынға сол ойыншы қосыла алмайды.
    assert await manager.open_lobby(-2002, "Басқа чат", 9) is None
    other = next(g for g, lb in manager.lobby_by_game.items() if lb.chat_id == -2002)
    assert "басқа ойынға" in await manager.join(other, 1, "Ойыншы 1")
    assert "шықтыңыз" in await manager.leave(1)
    assert "тіркелдіңіз" in await manager.join(other, 1, "Ойыншы 1")
    await manager.abort(CHAT)
    await manager.abort(-2002)
    assert storage.games[gid] == "aborted"
    assert not manager.user_chat


async def test_lobby_limit_fifty_and_autostart():
    manager, notifier, storage = make_manager()
    gid = await open_with_players(manager, 50)
    assert "толы" in await manager.join(gid, 51, "Артық")
    await wait_until(lambda: CHAT in manager.sessions)
    assert len(manager.sessions[CHAT].game.players) == 50
    await manager.abort(CHAT)


async def test_lobby_cancels_without_enough_players():
    manager, notifier, storage = make_manager(registration_seconds=0.05)
    gid = await open_with_players(manager, 3)
    await wait_until(lambda: storage.games[gid] == "aborted")
    assert not manager.busy(CHAT) and not manager.user_chat
    assert any("жеткіліксіз" in m.text for m in notifier.to(CHAT))


@pytest.mark.parametrize("n,seed", [(4, 1), (6, 2), (9, 3), (14, 4), (21, 5), (33, 6), (50, 7)])
async def test_full_game_runs_to_the_end(n, seed):
    manager, notifier, storage = make_manager(rng_factory=lambda: random.Random(seed))
    players = AutoPlayers(manager, notifier, seed=seed)
    gid = await open_with_players(manager, n)
    assert await manager.force_start(CHAT) is None
    await wait_until(lambda: storage.games.get(gid) == "finished", timeout=60)
    await wait_until(lambda: CHAT not in manager.sessions)
    rows = storage.finalized[gid]
    assert len(rows) == n and storage.finalize_calls == 1
    winners = [r for r in rows if r.won]
    assert all(r.reward == win_reward(n) for r in winners)
    assert all(r.reward == 0 for r in rows if not r.won)
    assert not manager.user_chat and not notifier.restricted and not storage.restricted
    assert any("Ойын аяқталды" in m.text for m in notifier.to(CHAT))
    # Рөлдер тек жеке чатта айтылады: топқа «Сіздің рөліңіз» хабары жіберілмейді.
    assert not any("Сіздің рөліңіз" in m.text for m in notifier.to(CHAT))
    assert all(any("Сіздің рөліңіз" in m.text for m in notifier.to(uid)) for uid in range(1, n + 1))
    for t in players.tasks:
        t.cancel()


async def test_items_and_purchases_are_applied():
    storage = FakeStorage(
        inventory={1: Inventory(shields=2, fake_docs=1, vote_shields=1, piercing_bullets=1)},
        requests=[RoleRequest(1, Role.DON, 55), RoleRequest(2, Role.MANIAC, 56)],
    )
    manager, notifier, _ = make_manager(storage=storage, time_scale=50)
    await open_with_players(manager, 5)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    g = manager.sessions[CHAT].game
    p1 = g.players[1]
    assert p1.role is Role.DON and p1.purchase_id == 55
    assert p1.shield_available and p1.vote_shield_available and p1.bullet_available
    assert p1.fake_doc and p1.fake_doc_activated
    assert g.players[2].role is not Role.MANIAC
    refund_offer = [m for m in notifier.to(2) if m.keyboard and m.keyboard[0][0].data == "rr:56"]
    assert refund_offer
    await manager.abort(CHAT)
    assert storage.finalize_calls == 0  # тоқтатылған ойын ештеңе жұмсамайды


async def test_moderation_rules():
    manager, notifier, storage = make_manager(time_scale=50)
    await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    s = manager.sessions[CHAT]
    assert s.game.phase is Phase.NIGHT

    async def no() -> bool:
        return False

    async def yes() -> bool:
        return True

    # Түнде тірі ойыншының хабары өшіріледі, бірақ ол үнсіз етілмейді.
    assert await manager.moderate(CHAT, 1, 101, "сәлем", no)
    assert (CHAT, 101) in notifier.deleted and (CHAT, 1) not in notifier.restricted
    # Ойынға қатыспайтын адам — өшіріліп, 2 минутқа үнсіз етіледі.
    assert await manager.moderate(CHAT, 999, 102, "мен де ойнаймын", no)
    assert notifier.restricted[(CHAT, 999)] == 120
    # Әкімші «!» белгісімен жазса — өшірілмейді; белгісіз жазса — өшіріледі, бірақ шектелмейді.
    assert not await manager.moderate(CHAT, 998, 103, "! ереже еске салу", yes)
    assert await manager.moderate(CHAT, 998, 104, "белгісіз", yes)
    assert (CHAT, 998) not in notifier.restricted
    # Күндіз тірі ойыншы еркін жаза алады.
    s.game.phase = Phase.DAY
    assert not await manager.moderate(CHAT, 1, 105, "мен тұрғынмын", no)
    # Өлген ойыншы — өшіріліп, үнсіз етіледі; қайта шектеу жіберілмейді.
    await manager.leave(2)
    assert await manager.moderate(CHAT, 2, 106, "мен өлмедім!", no)
    assert notifier.restricted[(CHAT, 2)] == 120
    notifier.restricted.clear()
    assert await manager.moderate(CHAT, 2, 107, "тағы", no)
    assert (CHAT, 2) not in notifier.restricted  # әлі үнсіз — қайта шектемейміз
    await manager.abort(CHAT)
    assert (CHAT, 2) in notifier.unrestricted and (CHAT, 999) in notifier.unrestricted
    # Ойын жоқ кезде ештеңе өшірілмейді.
    assert not await manager.moderate(CHAT, 999, 108, "ойын бітті", no)


async def test_no_mute_when_disabled():
    manager, notifier, storage = make_manager(time_scale=50, mute_seconds=0, mute_non_players=False)
    await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)

    async def no() -> bool:
        return False

    manager.sessions[CHAT].game.phase = Phase.DAY
    assert not await manager.moderate(CHAT, 999, 1, "сәлем", no)
    await manager.leave(1)
    assert await manager.moderate(CHAT, 1, 2, "сәлем", no)
    assert not notifier.restricted
    await manager.abort(CHAT)


async def test_votes_and_actions_are_announced_one_by_one():
    manager, notifier, storage = make_manager(rng_factory=lambda: random.Random(3))
    AutoPlayers(manager, notifier, seed=3)
    gid = await open_with_players(manager, 8)
    await manager.force_start(CHAT)
    await wait_until(lambda: storage.games.get(gid) == "finished", timeout=60)
    group = [m.text for m in notifier.to(CHAT)]
    casts = [t for t in group if "өз дауысын" in t or "қалыс қалды" in t]
    assert casts, "әр дауыс жеке хабар болуы керек"
    assert all(t.count("tg://user") <= 2 for t in casts)
    assert any("тергеу жүргізуде" in t or "тапаншасын көтерді" in t for t in group)
    assert any("Дон" in t and "белгіледі" in t for t in group)
    # Әр дауыс өз дауыс беру кезеңінің ішінде, әр түнгі әрекет өз түнінің ішінде шығады.
    phase = None
    for text in group:
        if "-түн</b>" in text:
            phase = "night"
        elif "Таң атты" in text or "Дауыс беру нәтижесі" in text or "Ойын аяқталды" in text:
            phase = None
        elif "Дауыс беру басталды" in text:
            phase = "vote"
        elif "өз дауысын" in text or "қалыс қалды" in text:
            assert phase == "vote", text
        elif "<i>" in text and text.count("\n") == 0 and "…" not in text and "..." in text:
            assert phase == "night", text


async def test_higgs_reward_is_doubled_and_dead_winners_get_nothing():
    manager, notifier, storage = make_manager(higgs_chance=1, rng_factory=lambda: random.Random(4))
    AutoPlayers(manager, notifier, seed=4)
    gid = await open_with_players(manager, 11)  # 10 ойыншыда тұрғын жоқ — Higgs шықпайды
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    roles = dict(storage.started[gid])
    higgs = next(uid for uid, role in roles.items() if role == "higgs")
    await wait_until(lambda: storage.games.get(gid) == "finished", timeout=60)
    rows = {r.user_id: r for r in storage.finalized[gid]}
    base = win_reward(11)
    for r in rows.values():
        if r.won and not r.alive:
            assert r.final_role in ("suicide", "pyro")
        if r.won:
            assert r.reward == (base * 2 if r.user_id == higgs else base)
        else:
            assert r.reward == 0
    assert rows[higgs].won == rows[higgs].alive


async def test_english_game():
    manager, notifier, storage = make_manager(rng_factory=lambda: random.Random(9))
    AutoPlayers(manager, notifier, seed=9)
    assert await manager.open_lobby(CHAT, "Test chat", 1, lang="en") is None
    gid = next(iter(manager.lobby_by_game))
    for uid in range(1, 6):
        assert "You joined" in await manager.join(gid, uid, f"Player {uid}")
    assert "Registration for Mafia is open" in notifier.to(CHAT)[0].text
    await manager.force_start(CHAT)
    await wait_until(lambda: storage.games.get(gid) == "finished", timeout=60)
    group = "\n".join(m.text for m in notifier.to(CHAT))
    assert "Night 1" in group and "Game over" in group
    assert "Your role" in next(m.text for m in notifier.to(1) if "role" in m.text.lower())


async def test_registration_time_from_chat_settings():
    manager, notifier, storage = make_manager(registration_seconds=60)
    assert await manager.open_lobby(CHAT, "Чат", 1, registration_seconds=0.05) is None
    gid = next(iter(manager.lobby_by_game))
    await wait_until(lambda: storage.games[gid] == "aborted", timeout=5)


async def test_unreachable_player_is_reported():
    notifier = FakeNotifier(unreachable={3})
    manager, notifier, storage = make_manager(notifier=notifier, time_scale=50)
    await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    start_msg = next(m for m in notifier.to(CHAT) if "Ойын басталды" in m.text)
    assert "жеке хабарлама жібере алмады" in start_msg.text
    await manager.abort(CHAT)


async def test_team_chat_relay_and_last_words():
    manager, notifier, storage = make_manager(time_scale=50)
    await open_with_players(manager, 6)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    g = manager.sessions[CHAT].game
    don = g.with_role(Role.DON)[0].user_id
    mafia = g.with_role(Role.MAFIA)[0].user_id
    doctor = g.with_role(Role.DOCTOR)[0].user_id
    assert await manager.private_text(don, "<b>салем</b>")
    assert any("&lt;b&gt;салем" in m.text for m in notifier.to(mafia))
    assert not await manager.private_text(doctor, "сәлем")  # дәрігердің командасы жоқ
    await manager.abort(CHAT)


async def test_desertion_can_end_game():
    manager, notifier, storage = make_manager(time_scale=50)
    gid = await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    g = manager.sessions[CHAT].game
    don = g.with_role(Role.DON)[0].user_id
    assert "шықтыңыз" in await manager.leave(don)
    await wait_until(lambda: storage.games[gid] == "finished")
    rows = {r.user_id: r for r in storage.finalized[gid]}
    assert rows[don].deserted and not rows[don].won
    assert all(r.won for uid, r in rows.items() if uid != don)


async def test_stale_callbacks_are_rejected():
    manager, notifier, storage = make_manager(time_scale=50)
    gid = await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    ok, msg = await manager.night_action(1, gid, 99, "mk", 2)
    assert not ok and "ескірген" in msg
    ok, msg = await manager.vote(1, gid, 1, 2)
    assert not ok
    await manager.abort(CHAT)


async def test_recover_stale_games():
    manager, notifier, storage = make_manager()
    gid = await storage.create_game(CHAT)
    await manager.recover_stale()
    assert storage.games[gid] == "aborted"


async def test_lynch_needs_group_confirmation():
    manager, notifier, storage = make_manager(time_scale=50)
    gid = await open_with_players(manager, 6)
    await manager.force_start(CHAT)
    await wait_until(lambda: CHAT in manager.sessions)
    s = manager.sessions[CHAT]
    g = s.game
    s.timings = balance.Timings(night=1, day=0.01, vote=5, witch=0.01, confirm=5)
    for uid in list(g.expected_actors()):
        assert (await manager.night_action(uid, gid, 1, "sk", 0))[0]
    await wait_until(lambda: g.phase is Phase.VOTE)
    target = g.with_role(Role.DOCTOR)[0].user_id
    for p in g.alive():
        await manager.vote(p.user_id, gid, 1, target if p.user_id != target else g.with_role(Role.DON)[0].user_id)
    def confirm_messages():
        return [m for m in notifier.to(CHAT) if m.keyboard and (m.keyboard[0][0].data or "").startswith("c:")]

    await wait_until(lambda: confirm_messages())
    (ask,) = confirm_messages()
    assert [b.text for b in ask.keyboard[0]] == ["👍 0", "👎 0"]
    assert not (await manager.confirm_vote(target, gid, 1, True))[0]   # үміткер
    assert not (await manager.confirm_vote(999, gid, 1, True))[0]      # бөгде адам
    assert not (await manager.confirm_vote(1, gid, 2, True))[0]        # ескі батырма
    voters = sorted(g.confirm_voters())
    assert (await manager.confirm_vote(voters[0], gid, 1, False))[0]
    await wait_until(lambda: any(e[1] == ask.message_id for e in notifier.edits))  # санағы жаңарды
    for uid in voters[1:]:
        assert (await manager.confirm_vote(uid, gid, 1, True))[0]
    await wait_until(lambda: g.phase is not Phase.CONFIRM)
    await wait_until(lambda: any("Растау нәтижесі" in m.text for m in notifier.to(CHAT)))
    assert not g.players[target].alive and g.players[target].death_cause == "lynch"
    assert any("Растау аяқталды" in text and "👍 <b>4</b>" in text for _, mid, text in notifier.edits)
    await manager.abort(CHAT)


async def test_afk_players_are_removed_after_three_nights():
    manager, notifier, storage = make_manager(rng_factory=lambda: random.Random(2))
    AutoPlayers(manager, notifier, seed=2, idle={1, 2, 3, 4})  # ешкім ештеңе баспайды
    gid = await open_with_players(manager, 4)
    await manager.force_start(CHAT)
    await wait_until(lambda: storage.games.get(gid) == "finished", timeout=30)
    rows = {r.user_id: r for r in storage.finalized[gid]}
    roles = dict(storage.started[gid])
    civilian = next(uid for uid, role in roles.items() if role == "civilian")
    group = "\n".join(m.text for m in notifier.to(CHAT))
    kicked = [uid for uid, r in rows.items() if r.deserted]
    # 3-түннен кейін AFK ойыншылар шығарылады (жеңімпаз анықталса — қалғандары қажет емес).
    assert len(kicked) >= 2 and civilian not in kicked  # тұрғынның түнгі әрекеті жоқ — AFK саналмайды
    assert group.count("әрекет жасамағаны үшін ойыннан шығарылды") == len(kicked)
    assert "Ойын <b>3</b> күнге созылды" in group
    for uid in kicked:
        assert not rows[uid].won and not rows[uid].alive
        assert any("ойыннан шығарылдыңыз" in m.text for m in notifier.to(uid))

