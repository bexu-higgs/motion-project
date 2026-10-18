import asyncio
import random

import pytest

from mafia_bot.controller import GameManager
from mafia_bot.db.models import Inventory
from mafia_bot.economy import win_reward
from mafia_bot.game.engine import Phase, RoleRequest
from mafia_bot.game.roles import Role

from fakes import AutoPlayers, FakeNotifier, FakeStorage

CHAT = -1001


def make_manager(notifier=None, storage=None, **kw):
    notifier = notifier or FakeNotifier()
    storage = storage or FakeStorage()
    params = dict(registration_seconds=5, time_scale=0.002, lobby_edit_delay=0,
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
    assert manager.should_delete(CHAT, 1)          # түнде бәрі үндемейді
    assert not manager.should_delete(CHAT, 999)    # бөгде адамдарға тиіспейміз (әдепкі)
    await manager.leave(2)
    assert manager.should_delete(CHAT, 2)          # өлген ойыншы
    assert (CHAT, 2) in notifier.restricted
    await manager.abort(CHAT)
    assert (CHAT, 2) not in notifier.restricted    # ойын соңында шектеу алынады


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
    civ = g.with_role(Role.CIVILIAN)[0].user_id
    assert await manager.private_text(don, "<b>салем</b>")
    assert any("&lt;b&gt;салем" in m.text for m in notifier.to(mafia))
    assert not await manager.private_text(civ, "сәлем")  # тұрғынның командасы жоқ
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
