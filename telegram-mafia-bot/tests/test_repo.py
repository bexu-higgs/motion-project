"""PostgreSQL репозиторийінің тесттері.

Іске қосу үшін бос тест базасы керек:
    TEST_DATABASE_URL=postgresql://user:pass@localhost/mafia_test pytest
"""

import asyncio
import os
import random

import pytest

from mafia_bot.economy import DAILY_REWARDS, PACKAGES_BY_ID, Item, win_reward
from mafia_bot.game.roles import Role

DSN = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL көрсетілмеген")

TABLES = "giveaway_claims, giveaways, ledger, payments, role_purchases, game_players, games, chats, users"


@pytest.fixture
async def repo():
    import asyncpg

    from mafia_bot.db.repo import Repo

    conn = await asyncpg.connect(DSN)
    await conn.execute(f"DROP TABLE IF EXISTS {TABLES} CASCADE")
    await conn.close()
    r = await Repo.connect(DSN)
    yield r
    await r.close()


async def add_user(repo, uid, tenge=0, diamonds=0):
    await repo.ensure_user(uid, f"user{uid}", f"Ойыншы {uid}")
    if tenge:
        await repo.grant(uid, "tenge", tenge, "test")
    if diamonds:
        await repo.grant(uid, "diamonds", diamonds, "test")


async def test_schema_is_idempotent(repo):
    await repo.init_schema()
    await repo.init_schema()


async def test_ensure_user_updates_name(repo):
    assert await repo.ensure_user(1, None, "Әли") == "kk"
    await repo.ensure_user(1, "ali", "Әли Б")
    user = await repo.get_user(1)
    assert user["username"] == "ali" and user["full_name"] == "Әли Б" and user["tenge"] == 0


async def test_buy_item_with_tenge(repo):
    await add_user(repo, 1, tenge=150)
    r = await repo.buy_item(1, Item.SHIELD)
    assert r.ok and r.balance == 50 and r.count == 1
    r = await repo.buy_item(1, Item.SHIELD)
    assert not r.ok and r.reason == "funds" and r.balance == 50
    r = await repo.buy_item(1, Item.FAKE_DOC)
    assert not r.ok


async def test_buy_premium_with_diamonds(repo):
    await add_user(repo, 1, diamonds=2)
    assert (await repo.buy_item(1, Item.VOTE_SHIELD)).ok
    assert (await repo.buy_item(1, Item.PIERCING_BULLET)).ok
    assert not (await repo.buy_item(1, Item.PIERCING_BULLET)).ok
    user = await repo.get_user(1)
    assert user["diamonds"] == 0 and user["vote_shields"] == 1 and user["piercing_bullets"] == 1


async def test_concurrent_purchases_never_overspend(repo):
    await add_user(repo, 1, tenge=350)
    results = await asyncio.gather(*(repo.buy_item(1, Item.SHIELD) for _ in range(10)))
    assert sum(r.ok for r in results) == 3
    user = await repo.get_user(1)
    assert user["tenge"] == 50 and user["shields"] == 3


async def test_daily_reward_cycle(repo):
    await add_user(repo, 1)
    first = await repo.claim_daily(1)
    assert first.ok and first.reward == DAILY_REWARDS[0]
    again = await repo.claim_daily(1)
    assert not again.ok and again.wait is not None
    # Бір тәулік өтті.
    await repo.pool.execute("UPDATE users SET last_daily_at = last_daily_at - interval '25 hours'")
    second = await repo.claim_daily(1)
    assert second.ok and second.day == 2 and second.reward == DAILY_REWARDS[1]
    # Екі тәуліктен көп үзіліс — цикл басынан.
    await repo.pool.execute("UPDATE users SET last_daily_at = last_daily_at - interval '49 hours'")
    third = await repo.claim_daily(1)
    assert third.ok and third.day == 1
    user = await repo.get_user(1)
    assert user["tenge"] == DAILY_REWARDS[0] + DAILY_REWARDS[1] + DAILY_REWARDS[0]


async def test_daily_cannot_be_claimed_twice_concurrently(repo):
    await add_user(repo, 1)
    results = await asyncio.gather(*(repo.claim_daily(1) for _ in range(5)))
    assert sum(r.ok for r in results) == 1
    assert (await repo.get_user(1))["tenge"] == DAILY_REWARDS[0]


async def test_role_queue_purchase_limit_and_refund(repo):
    await add_user(repo, 1, diamonds=10)
    assert not (await repo.queue_role(1, Role.CIVILIAN)).ok
    for role in (Role.DON, Role.DOCTOR, Role.KILLER, Role.MANIAC, Role.WITCH):
        assert (await repo.queue_role(1, role)).ok
    limited = await repo.queue_role(1, Role.PYRO)
    assert not limited.ok and limited.reason == "limit"
    queue = await repo.role_queue(1)
    assert [q["role"] for q in queue] == ["don", "doctor", "killer", "maniac", "witch"]
    # Дон, Киллер, Қанішер — 2 💎, Дәрігер мен Сиқыршы — 1 💎: барлығы 8 💎.
    assert (await repo.get_user(1))["diamonds"] == 2
    assert [q["price"] for q in queue] == [2, 1, 2, 2, 1]
    assert await repo.refund_role(1, queue[0]["purchase_id"]) == 2  # төленген баға қайтарылады
    assert await repo.refund_role(1, queue[0]["purchase_id"]) is None
    assert await repo.refund_role(2, queue[1]["purchase_id"]) is None  # бөтен адамның сатып алуы
    assert (await repo.get_user(1))["diamonds"] == 4


async def test_role_purchase_needs_diamonds(repo):
    await add_user(repo, 1)
    r = await repo.queue_role(1, Role.DON)
    assert not r.ok and r.reason == "funds"


async def test_premium_role_costs_two_diamonds(repo):
    await add_user(repo, 1, diamonds=1)
    r = await repo.queue_role(1, Role.PYRO)
    assert not r.ok and r.reason == "funds" and r.balance == 1
    assert (await repo.queue_role(1, Role.WOLF)).ok
    assert not (await repo.queue_role(1, Role.HIGGS)).ok
    assert (await repo.get_user(1))["diamonds"] == 0


async def test_profiles_for_end_of_game_card(repo):
    await add_user(repo, 1, diamonds=5)
    await add_user(repo, 2)
    await repo.queue_role(1, Role.DOCTOR)
    await repo.queue_role(1, Role.DON)
    assert not (await repo.queue_role(1, Role.SLEEPLESS)).ok  # Балым жалеп сатылмайды
    cards = await repo.profiles([1, 2, 3])
    assert set(cards) == {1, 2}
    assert cards[1]["next_role"] == "doctor" and cards[1]["diamonds"] == 2
    assert cards[2]["next_role"] is None and cards[2]["wins"] == 0 and cards[2]["games_played"] == 0


async def test_queue_heads_in_purchase_order(repo):
    for uid in (1, 2, 3):
        await add_user(repo, uid, diamonds=5)
    await repo.queue_role(2, Role.DON)
    await repo.queue_role(1, Role.DON)
    await repo.queue_role(2, Role.DOCTOR)
    heads = await repo.queue_heads([1, 2, 3])
    assert [(h.user_id, h.role) for h in heads] == [(2, Role.DON), (1, Role.DON)]


async def test_game_finalization_is_idempotent(repo):
    from mafia_bot.db.models import FinalRow

    for uid in range(1, 5):
        await add_user(repo, uid, diamonds=2)
    await repo.pool.execute("UPDATE users SET shields = 1, fake_docs = 1 WHERE user_id = 1")
    await repo.queue_role(1, Role.DON)
    purchase = (await repo.role_queue(1))[0]["purchase_id"]
    gid = await repo.create_game(-100)
    await repo.start_game(gid, [(1, "don"), (2, "doctor"), (3, "commissioner"), (4, "civilian")])
    reward = win_reward(4)
    rows = [
        FinalRow(1, "don", True, True, reward, used_shield=True, used_fake_doc=True, purchase_id=purchase),
        FinalRow(2, "doctor", False, False, 0),
        FinalRow(3, "commissioner", False, False, 0),
        FinalRow(4, "civilian", True, False, 0, deserted=True),
    ]
    assert await repo.finalize_game(gid, "mafia", 3, rows)
    assert not await repo.finalize_game(gid, "mafia", 3, rows)  # қайталау ештеңе бермейді
    u1 = await repo.get_user(1)
    assert u1["tenge"] == reward and u1["wins"] == 1 and u1["games_played"] == 1
    assert u1["shields"] == 0 and u1["fake_docs"] == 0
    assert await repo.role_queue(1) == []
    u2 = await repo.get_user(2)
    assert u2["losses"] == 1 and u2["tenge"] == 0
    recent = await repo.recent_games(1)
    assert len(recent) == 1 and recent[0]["won"] and recent[0]["players_count"] == 4
    top = await repo.top_players()
    assert top[0]["user_id"] == 1
    assert await repo.user_rank(1) == 1
    assert await repo.user_rank(99) is None


async def test_aborted_game_keeps_purchases_and_releases_restrictions(repo):
    for uid in range(1, 5):
        await add_user(repo, uid, diamonds=2)
    await repo.queue_role(1, Role.DON)
    gid = await repo.create_game(-100)
    await repo.start_game(gid, [(1, "don"), (2, "doctor"), (3, "commissioner"), (4, "civilian")])
    # Ескі нұсқадан қалған шектеу белгісі (қайта іске қосылғанда алынуы керек).
    await repo.pool.execute("UPDATE game_players SET restricted = TRUE WHERE game_id = $1 AND user_id = 2", gid)
    stale = await repo.stale_games()
    assert stale == [{"game_id": gid, "chat_id": -100, "status": "running", "lang": "kk", "restricted": [2]}]
    assert await repo.abort_game(gid) == [2]
    assert await repo.stale_games() == []
    assert len(await repo.role_queue(1)) == 1
    assert not await repo.finalize_game(gid, None, 1, [])


async def test_payment_is_credited_once(repo):
    await add_user(repo, 1)
    pkg = PACKAGES_BY_ID["d40"]
    args = dict(user_id=1, telegram_charge_id="charge-1", provider_charge_id=None,
                package_id="d40", currency="XTR", total_amount=pkg.stars)
    results = await asyncio.gather(*(repo.record_payment(**args) for _ in range(5)))
    assert sorted(r for r in results if r is not None) == [40]
    assert results.count(None) == 4
    assert (await repo.get_user(1))["diamonds"] == 40
    assert await repo.record_payment(**args) is None


async def test_refund_removes_diamonds(repo):
    await add_user(repo, 1)
    await repo.record_payment(1, "charge-2", None, "d10", "XTR", 10)
    await repo.queue_role(1, Role.DON)  # 2 алмаз жұмсалды
    payment = await repo.mark_refunded("charge-2")
    assert payment["user_id"] == 1
    assert (await repo.get_user(1))["diamonds"] == 0
    assert await repo.mark_refunded("charge-2") is None


async def test_diamond_gift_is_atomic(repo):
    await add_user(repo, 1, diamonds=5)
    await add_user(repo, 2, diamonds=5)
    # Алушы ботқа әлі жазбаған — ол тіркеледі.
    r = await repo.transfer_diamonds(1, 3, 2, "p3", "Ойыншы 3")
    assert r.ok and r.balance == 3 and r.receiver_balance == 2 and r.receiver_lang == "kk"
    assert (await repo.get_user(3))["full_name"] == "Ойыншы 3"
    # Баланстан көп беруге болмайды, баланс өзгермейді.
    r = await repo.transfer_diamonds(1, 2, 4, None, "")
    assert not r.ok and r.balance == 3
    # Бір уақытта көп сыйлық: жалпы сома баланстан аспайды, қарсы бағыттағылар бөгелмейді.
    results = await asyncio.gather(
        *(repo.transfer_diamonds(1, 2, 1, None, "") for _ in range(6)),
        *(repo.transfer_diamonds(2, 1, 1, None, "") for _ in range(6)),
    )
    users = {uid: (await repo.get_user(uid))["diamonds"] for uid in (1, 2, 3)}
    assert sum(users.values()) == 10 and all(v >= 0 for v in users.values())
    assert sum(r.ok for r in results) >= 6
    ledger = await repo.pool.fetchval("SELECT coalesce(sum(delta), 0) FROM ledger WHERE reason LIKE 'gift_%'")
    assert ledger == 0
    with pytest.raises(ValueError):
        await repo.transfer_diamonds(1, 1, 1, None, "")


async def test_find_by_username(repo):
    await repo.ensure_user(1, "Ali_K", "Әли")
    assert (await repo.find_by_username("@ali_k"))["user_id"] == 1
    assert await repo.find_by_username("nobody") is None


async def test_giveaway_first_n_claim_one_each(repo):
    await add_user(repo, 1, diamonds=5)
    gid, balance = await repo.create_giveaway(-100, 1, 3)
    assert gid and balance == 2
    assert await repo.create_giveaway(-100, 1, 3) == (None, 2)  # алмаз жетпейді
    assert (await repo.claim_giveaway(gid, 1, "p1", "Иесі")).status == "own"
    # 10 адам бір мезгілде басады — тек алғашқы 3-еуі алады.
    results = await asyncio.gather(*(repo.claim_giveaway(gid, uid, f"p{uid}", f"О{uid}") for uid in range(2, 12)))
    assert sorted(r.status for r in results) == ["gone"] * 7 + ["ok"] * 3
    winners = [uid for uid, r in zip(range(2, 12), results, strict=True) if r.status == "ok"]
    assert [(await repo.get_user(uid))["diamonds"] for uid in winners] == [1, 1, 1]
    assert (await repo.claim_giveaway(gid, winners[0], None, "")).status == "gone"
    view = await repo.giveaway_view(gid)
    assert view.status == "done" and view.remaining == 0 and {u for u, _ in view.claimers} == set(winners)
    assert (await repo.get_user(1))["diamonds"] == 2
    assert await repo.expire_giveaways(0) == []  # аяқталған тарату қайтарылмайды


async def test_giveaway_claim_once_and_expiry_refund(repo):
    await add_user(repo, 1, diamonds=4)
    gid, _ = await repo.create_giveaway(-100, 1, 4)
    await repo.set_giveaway_message(gid, 777)
    assert (await repo.claim_giveaway(gid, 2, "p2", "Бека")).status == "ok"
    assert (await repo.claim_giveaway(gid, 2, "p2", "Бека")).status == "again"
    assert await repo.expire_giveaways(3600) == []  # әлі мерзімі бітпеген
    assert await repo.expire_giveaways(0) == [gid]
    view = await repo.giveaway_view(gid)
    assert view.status == "expired" and view.remaining == 3 and view.message_id == 777
    assert (await repo.get_user(1))["diamonds"] == 3   # алынбаған 3 алмаз қайтты
    assert (await repo.claim_giveaway(gid, 3, None, "Арман")).status == "gone"
    total = await repo.pool.fetchval("SELECT sum(diamonds) FROM users")
    assert total == 4


async def test_weekly_top_is_per_chat_and_recent(repo):
    from mafia_bot.db.models import FinalRow

    for uid in range(1, 5):
        await add_user(repo, uid)

    async def finished_game(chat_id, winners, days_ago=0):
        gid = await repo.create_game(chat_id)
        await repo.start_game(gid, [(u, "civilian") for u in range(1, 5)])
        rows = [FinalRow(u, "civilian", True, u in winners, 20 if u in winners else 0) for u in range(1, 5)]
        await repo.finalize_game(gid, "town", 2, rows)
        await repo.pool.execute(
            "UPDATE games SET finished_at = now() - make_interval(days => $2) WHERE game_id = $1", gid, days_ago
        )

    await finished_game(-1, {1, 2})
    await finished_game(-1, {2})
    await finished_game(-1, {3}, days_ago=8)   # бір аптадан ескі
    await finished_game(-2, {4})               # басқа чат
    top = await repo.weekly_top(-1)
    assert [(r["user_id"], r["wins"], r["games"], r["earned"]) for r in top][:2] == [(2, 2, 2, 40), (1, 1, 2, 20)]
    assert {r["user_id"] for r in top} == {1, 2, 3, 4} and all(r["games"] == 2 for r in top)
    assert await repo.weekly_top(-3) == []


async def test_exchange_diamonds_for_tenge(repo):
    await add_user(repo, 1, tenge=10, diamonds=3)
    assert await repo.exchange_diamonds(1, 2) == (True, 1, 510)   # 1 💎 = 250 ₸
    assert await repo.exchange_diamonds(1, 2) == (False, 1, 510)  # жетпейді — ештеңе өзгермейді
    assert await repo.exchange_diamonds(99, 1) == (False, 0, 0)
    rows = await repo.pool.fetch("SELECT currency, delta FROM ledger WHERE reason = 'exchange' ORDER BY entry_id")
    assert [(r["currency"], r["delta"]) for r in rows] == [("diamonds", -2), ("tenge", 500)]


async def test_reset_all_diamonds(repo):
    for uid, dia in ((1, 5), (2, 0), (3, 12)):
        await add_user(repo, uid, tenge=7, diamonds=dia)
    gid, _ = await repo.create_giveaway(-100, 3, 4)   # 4 💎 таратуда тұр
    assert (await repo.claim_giveaway(gid, 2, None, "Бека")).status == "ok"
    assert await repo.diamond_totals() == (3, 5 + 8 + 1 + 3)
    result = await repo.reset_all_diamonds(admin_id=1)
    assert result.users == 3 and result.diamonds == 5 + 8 + 1 + 3 and result.giveaways == (gid,)
    users = [await repo.get_user(uid) for uid in (1, 2, 3)]
    assert [u["diamonds"] for u in users] == [0, 0, 0] and [u["tenge"] for u in users] == [7, 7, 7]
    assert (await repo.giveaway_view(gid)).status == "cancelled"
    assert (await repo.claim_giveaway(gid, 1, None, "Айжан")).status == "gone"
    assert await repo.expire_giveaways(0) == []      # жабылған тарату қайтарылмайды
    assert (await repo.get_user(3))["diamonds"] == 0
    logged = await repo.pool.fetchval("SELECT -sum(delta) FROM ledger WHERE reason = 'admin_reset'")
    assert logged == 14
    again = await repo.reset_all_diamonds(admin_id=1)
    assert again.users == 0 and again.diamonds == 0


async def test_chats(repo):
    await repo.upsert_chat(-1, "Топ", True, False)
    await repo.upsert_chat(-1, "Топ 2", True, True)
    await repo.upsert_chat(-2, "Ескі", False, False)
    chats = await repo.active_chats()
    assert [(c["chat_id"], c["title"], c["is_admin"]) for c in chats] == [(-1, "Топ 2", True)]


async def test_full_game_with_real_database(repo):
    """Контроллер + нақты PostgreSQL: толық ойын соңында сыйақы бір рет беріледі."""
    from mafia_bot.controller import GameManager

    from fakes import AutoPlayers, FakeNotifier

    notifier = FakeNotifier()
    manager = GameManager(notifier, repo, registration_seconds=5, time_scale=0.002,
                          lobby_edit_delay=0, confirm_edit_delay=0, rng_factory=lambda: random.Random(3))
    AutoPlayers(manager, notifier, seed=3)
    await repo.ensure_user(1, None, "Ойыншы 1")
    await repo.grant(1, "diamonds", 1, "test")
    await repo.queue_role(1, Role.COMMISSIONER)
    assert await manager.open_lobby(-500, "Топ", 1) is None
    gid = next(iter(manager.lobby_by_game))
    for uid in range(1, 9):
        assert "тіркелдіңіз" in await manager.join(gid, uid, f"Ойыншы {uid}")
    await manager.force_start(-500)
    for _ in range(4000):
        if await repo.pool.fetchval("SELECT status FROM games WHERE game_id = $1", gid) == "finished":
            break
        await asyncio.sleep(0.01)
    status = await repo.pool.fetchval("SELECT status FROM games WHERE game_id = $1", gid)
    assert status == "finished"
    rows = await repo.pool.fetch("SELECT * FROM game_players WHERE game_id = $1", gid)
    assert len(rows) == 8
    assert next(r for r in rows if r["user_id"] == 1)["role"] == "commissioner"
    winners = [r for r in rows if r["won"]]
    total = await repo.pool.fetchval("SELECT coalesce(sum(tenge), 0) FROM users")
    assert total == len(winners) * win_reward(8)
    assert await repo.role_queue(1) == []


async def test_user_language(repo):
    await repo.ensure_user(1, None, "A")
    await repo.set_user_lang(1, "ru")
    assert await repo.ensure_user(1, None, "A") == "ru"
    assert (await repo.get_user(1))["lang"] == "ru"


async def test_chat_settings_defaults_update_and_cache(repo):
    cfg = await repo.get_chat_settings(-7)
    assert (cfg.lang, cfg.registration_seconds, cfg.start_mode) == ("kk", None, "all")
    cfg = await repo.update_chat_settings(-7, "Топ", lang="en")
    cfg = await repo.update_chat_settings(-7, "Топ", registration_seconds=60, start_mode="admins")
    assert (cfg.lang, cfg.registration_seconds, cfg.start_mode) == ("en", 60, "admins")
    # upsert_chat баптауларды өшірмейді
    await repo.upsert_chat(-7, "Жаңа атау", True, True)
    repo._chat_settings.clear()
    cfg = await repo.get_chat_settings(-7)
    assert (cfg.lang, cfg.registration_seconds, cfg.start_mode) == ("en", 60, "admins")
    assert (await repo.active_chats())[0]["title"] == "Жаңа атау"
