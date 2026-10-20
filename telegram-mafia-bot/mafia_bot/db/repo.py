"""PostgreSQL репозиторийі (asyncpg).

Валютаға қатысты барлық өзгерістер бір транзакцияда және шартты UPDATE арқылы
орындалады, сондықтан баланс ешқашан теріс болмайды, ал сыйақы мен төлем қайталанбайды.
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any

import asyncpg

from ..economy import (
    DIAMOND_TO_TENGE,
    PACKAGES_BY_ID,
    ROLE_QUEUE_LIMIT,
    SHOP,
    DailyResult,
    Item,
    compute_daily,
    role_price,
)
from ..game.engine import RoleRequest
from ..game.roles import Role, purchasable_roles
from .models import (
    ChatSettings,
    ClaimResult,
    FinalRow,
    GiveawayView,
    Inventory,
    PurchaseResult,
    ResetResult,
    TransferResult,
)

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class Repo:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool
        self._chat_settings: dict[int, ChatSettings] = {}  # бір процесс — қарапайым кэш

    @classmethod
    async def connect(cls, dsn: str) -> Repo:
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
        repo = cls(pool)
        await repo.init_schema()
        return repo

    async def close(self) -> None:
        await self.pool.close()

    async def init_schema(self) -> None:
        async with self.pool.acquire() as conn:
            # Бірнеше процесс бір уақытта іске қосылса, сұлба екі рет құрылмасын.
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(724001)")
                await conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))

    # --- Пайдаланушылар ----------------------------------------------------------

    async def ensure_user(self, user_id: int, username: str | None, full_name: str) -> str:
        """Пайдаланушыны тіркеу/жаңарту. Оның таңдаған тілін қайтарады."""
        return await self.pool.fetchval(
            """
            INSERT INTO users (user_id, username, full_name) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE
                SET username = EXCLUDED.username, full_name = EXCLUDED.full_name
            RETURNING lang
            """,
            user_id, username, full_name,
        )

    async def find_by_username(self, username: str) -> asyncpg.Record | None:
        """@username бойынша ботқа белгілі пайдаланушы (бірмәнді болса ғана)."""
        rows = await self.pool.fetch(
            "SELECT user_id, username, full_name FROM users WHERE lower(username) = lower($1) LIMIT 2",
            username.lstrip("@"),
        )
        return rows[0] if len(rows) == 1 else None

    async def set_user_lang(self, user_id: int, lang: str) -> None:
        await self.pool.execute("UPDATE users SET lang = $2 WHERE user_id = $1", user_id, lang)

    async def get_user(self, user_id: int) -> asyncpg.Record | None:
        return await self.pool.fetchrow("SELECT * FROM users WHERE user_id = $1", user_id)

    async def recent_games(self, user_id: int, limit: int = 5) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            """
            SELECT gp.game_id, gp.role, gp.final_role, gp.won, gp.reward, g.players_count,
                   g.finished_at
            FROM game_players gp JOIN games g USING (game_id)
            WHERE gp.user_id = $1 AND g.status = 'finished'
            ORDER BY g.finished_at DESC
            LIMIT $2
            """,
            user_id, limit,
        )

    async def top_players(self, limit: int = 10) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            """
            SELECT user_id, username, full_name, games_played, wins, losses
            FROM users WHERE games_played > 0
            ORDER BY wins DESC, (wins::float / games_played) DESC, games_played DESC, user_id
            LIMIT $1
            """,
            limit,
        )

    async def weekly_top(self, chat_id: int, limit: int = 10, days: int = 7) -> list[asyncpg.Record]:
        """Осы чаттың соңғы ``days`` күндегі аяқталған ойындары бойынша үздік ойыншылар."""
        return await self.pool.fetch(
            """
            SELECT gp.user_id, u.username, u.full_name,
                   count(*) AS games,
                   count(*) FILTER (WHERE gp.won) AS wins,
                   coalesce(sum(gp.reward), 0) AS earned
            FROM game_players gp
            JOIN games g USING (game_id)
            JOIN users u USING (user_id)
            WHERE g.chat_id = $1 AND g.status = 'finished'
              AND g.finished_at >= now() - make_interval(days => $3)
            GROUP BY gp.user_id, u.username, u.full_name
            ORDER BY wins DESC, earned DESC, games DESC, gp.user_id
            LIMIT $2
            """,
            chat_id, limit, days,
        )

    async def user_rank(self, user_id: int) -> int | None:
        row = await self.pool.fetchrow(
            """
            SELECT rank FROM (
                SELECT user_id, RANK() OVER (
                    ORDER BY wins DESC, (wins::float / games_played) DESC, games_played DESC
                ) AS rank
                FROM users WHERE games_played > 0
            ) r WHERE user_id = $1
            """,
            user_id,
        )
        return row["rank"] if row else None

    # --- Дүкен ---------------------------------------------------------------------

    async def buy_item(self, user_id: int, item: Item) -> PurchaseResult:
        shop_item = SHOP[item]
        currency = "tenge" if shop_item.currency == "tenge" else "diamonds"
        column = item.value  # Item мәндері — бекітілген баған атаулары
        async with self.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                f"""
                UPDATE users SET {currency} = {currency} - $2, {column} = {column} + 1
                WHERE user_id = $1 AND {currency} >= $2
                RETURNING {currency} AS balance, {column} AS count
                """,
                user_id, shop_item.price,
            )
            if row is None:
                bal = await conn.fetchval(f"SELECT {currency} FROM users WHERE user_id = $1", user_id)
                return PurchaseResult(False, "funds", balance=bal or 0)
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason) VALUES ($1, $2, $3, $4)",
                user_id, currency, -shop_item.price, f"buy:{item.value}",
            )
            return PurchaseResult(True, balance=row["balance"], count=row["count"])

    async def claim_daily(self, user_id: int) -> DailyResult:
        async with self.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "SELECT last_daily_at, daily_streak, now() AS now FROM users "
                "WHERE user_id = $1 FOR UPDATE",
                user_id,
            )
            if row is None:
                return DailyResult(ok=False)
            result = compute_daily(row["last_daily_at"], row["daily_streak"], row["now"])
            if not result.ok:
                return result
            await conn.execute(
                "UPDATE users SET tenge = tenge + $2, daily_streak = $3, last_daily_at = $4 "
                "WHERE user_id = $1",
                user_id, result.reward, result.day, row["now"],
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'tenge', $2, 'daily', $3)",
                user_id, result.reward, row["now"].isoformat(),
            )
            return result

    # --- Рөл сатып алу ---------------------------------------------------------------

    async def queue_role(self, user_id: int, role: Role, *, admin: bool = False) -> PurchaseResult:
        """Рөлді келесі ойынға сатып алу. ``admin`` — бот әкімшісі (Higgs-Man-ды тек ол ала алады)."""
        if role not in purchasable_roles(admin):
            return PurchaseResult(False, "unknown")
        price = role_price(role)
        async with self.pool.acquire() as conn, conn.transaction():
            user = await conn.fetchrow(
                "SELECT diamonds FROM users WHERE user_id = $1 FOR UPDATE", user_id
            )
            if user is None:
                return PurchaseResult(False, "unknown")
            queued = await conn.fetchval(
                "SELECT count(*) FROM role_purchases WHERE user_id = $1 AND status = 'queued'",
                user_id,
            )
            if queued >= ROLE_QUEUE_LIMIT:
                return PurchaseResult(False, "limit", balance=user["diamonds"], count=queued)
            if user["diamonds"] < price:
                return PurchaseResult(False, "funds", balance=user["diamonds"], count=queued)
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds - $2 WHERE user_id = $1 RETURNING diamonds",
                user_id, price,
            )
            purchase_id = await conn.fetchval(
                "INSERT INTO role_purchases (user_id, role, price) VALUES ($1, $2, $3) "
                "RETURNING purchase_id",
                user_id, role.value, price,
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'role_pick', $3)",
                user_id, -price, str(purchase_id),
            )
            return PurchaseResult(True, balance=balance, count=queued + 1)

    async def role_queue(self, user_id: int) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT purchase_id, role, price, created_at FROM role_purchases "
            "WHERE user_id = $1 AND status = 'queued' ORDER BY purchase_id",
            user_id,
        )

    async def refund_role(self, user_id: int, purchase_id: int) -> int | None:
        """Кезектегі рөлді болдырмау. Қайтарылған алмаз санын қайтарады."""
        async with self.pool.acquire() as conn, conn.transaction():
            price = await conn.fetchval(
                "UPDATE role_purchases SET status = 'refunded', updated_at = now() "
                "WHERE purchase_id = $1 AND user_id = $2 AND status = 'queued' RETURNING price",
                purchase_id, user_id,
            )
            if price is None:
                return None
            await conn.execute(
                "UPDATE users SET diamonds = diamonds + $2 WHERE user_id = $1", user_id, price
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'role_refund', $3)",
                user_id, price, str(purchase_id),
            )
            return price

    async def queue_heads(self, user_ids: list[int]) -> list[RoleRequest]:
        """Әр ойыншының кезектегі бірінші рөлі, сатып алу ретімен."""
        rows = await self.pool.fetch(
            """
            SELECT DISTINCT ON (user_id) purchase_id, user_id, role
            FROM role_purchases
            WHERE user_id = ANY($1::bigint[]) AND status = 'queued'
            ORDER BY user_id, purchase_id
            """,
            user_ids,
        )
        rows = sorted(rows, key=lambda r: r["purchase_id"])
        return [RoleRequest(r["user_id"], Role(r["role"]), r["purchase_id"]) for r in rows]

    async def inventories(self, user_ids: list[int]) -> dict[int, Inventory]:
        rows = await self.pool.fetch(
            "SELECT user_id, shields, fake_docs, vote_shields, piercing_bullets FROM users "
            "WHERE user_id = ANY($1::bigint[])",
            user_ids,
        )
        return {
            r["user_id"]: Inventory(
                r["shields"], r["fake_docs"], r["vote_shields"], r["piercing_bullets"]
            )
            for r in rows
        }

    # --- Ойындар -----------------------------------------------------------------------

    async def create_game(self, chat_id: int) -> int:
        return await self.pool.fetchval(
            "INSERT INTO games (chat_id) VALUES ($1) RETURNING game_id", chat_id
        )

    async def start_game(self, game_id: int, players: list[tuple[int, str]]) -> None:
        async with self.pool.acquire() as conn, conn.transaction():
            await conn.execute(
                "UPDATE games SET status = 'running', started_at = now(), players_count = $2 "
                "WHERE game_id = $1 AND status = 'lobby'",
                game_id, len(players),
            )
            await conn.executemany(
                "INSERT INTO game_players (game_id, user_id, role) VALUES ($1, $2, $3)",
                [(game_id, uid, role) for uid, role in players],
            )

    async def abort_game(self, game_id: int) -> list[int]:
        """Ойынды тоқтату. Шектеуі әлі алынбаған ойыншылар тізімін қайтарады."""
        async with self.pool.acquire() as conn, conn.transaction():
            await conn.execute(
                "UPDATE games SET status = 'aborted', finished_at = now() "
                "WHERE game_id = $1 AND status IN ('lobby', 'running')",
                game_id,
            )
            rows = await conn.fetch(
                "UPDATE game_players SET restricted = FALSE "
                "WHERE game_id = $1 AND restricted RETURNING user_id",
                game_id,
            )
            return [r["user_id"] for r in rows]

    async def profiles(self, user_ids: list[int]) -> dict[int, dict[str, Any]]:
        """Ойын соңындағы карточка: баланс, заттар, кезектегі келесі рөл, жеңістер."""
        rows = await self.pool.fetch(
            """
            SELECT u.user_id, u.username, u.full_name, u.tenge, u.diamonds, u.shields, u.vote_shields,
                   u.piercing_bullets, u.fake_docs, u.wins, u.games_played,
                   (SELECT rp.role FROM role_purchases rp
                     WHERE rp.user_id = u.user_id AND rp.status = 'queued'
                     ORDER BY rp.purchase_id LIMIT 1) AS next_role
            FROM users u WHERE u.user_id = ANY($1::bigint[])
            """,
            user_ids,
        )
        return {r["user_id"]: dict(r) for r in rows}

    async def stale_games(self) -> list[dict[str, Any]]:
        """Бот тоқтаған кезде аяқталмай қалған ойындар (қайта іске қосылғанда тазалау үшін)."""
        games = await self.pool.fetch(
            "SELECT g.game_id, g.chat_id, g.status, coalesce(c.lang, 'kk') AS lang "
            "FROM games g LEFT JOIN chats c USING (chat_id) WHERE g.status IN ('lobby', 'running')"
        )
        result = []
        for g in games:
            restricted = await self.pool.fetch(
                "SELECT user_id FROM game_players WHERE game_id = $1 AND restricted",
                g["game_id"],
            )
            result.append(
                {
                    "game_id": g["game_id"],
                    "chat_id": g["chat_id"],
                    "status": g["status"],
                    "lang": g["lang"],
                    "restricted": [r["user_id"] for r in restricted],
                }
            )
        return result

    async def finalize_game(
        self, game_id: int, winner: str | None, days: int, rows: list[FinalRow]
    ) -> bool:
        """Ойын нәтижесін бір транзакцияда сақтау.

        Ойын тек ``running`` күйінде болса ғана аяқталады — сондықтан бұл функцияны
        қайта шақыру сыйақыны екінші рет бермейді.
        """
        async with self.pool.acquire() as conn, conn.transaction():
            updated = await conn.fetchval(
                "UPDATE games SET status = 'finished', finished_at = now(), winner = $2, days = $3 "
                "WHERE game_id = $1 AND status = 'running' RETURNING game_id",
                game_id, winner, days,
            )
            if updated is None:
                return False
            for r in rows:
                await conn.execute(
                    "UPDATE game_players SET final_role = $3, alive = $4, won = $5, reward = $6, "
                    "deserted = $7 WHERE game_id = $1 AND user_id = $2",
                    game_id, r.user_id, r.final_role, r.alive, r.won, r.reward, r.deserted,
                )
                reward = r.reward
                if reward > 0:
                    credited = await conn.fetchval(
                        "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                        "VALUES ($1, 'tenge', $2, 'game_reward', $3) "
                        "ON CONFLICT DO NOTHING RETURNING entry_id",
                        r.user_id, reward, str(game_id),
                    )
                    if credited is None:
                        reward = 0
                await conn.execute(
                    """
                    UPDATE users SET
                        games_played = games_played + 1,
                        wins = wins + $2::int,
                        losses = losses + (1 - $2::int),
                        tenge = tenge + $3,
                        shields = GREATEST(shields - $4::int, 0),
                        vote_shields = GREATEST(vote_shields - $5::int, 0),
                        piercing_bullets = GREATEST(piercing_bullets - $6::int, 0),
                        fake_docs = GREATEST(fake_docs - $7::int, 0)
                    WHERE user_id = $1
                    """,
                    r.user_id, int(r.won), reward, int(r.used_shield), int(r.used_vote_shield),
                    int(r.used_bullet), int(r.used_fake_doc),
                )
                if r.purchase_id is not None:
                    await conn.execute(
                        "UPDATE role_purchases SET status = 'used', game_id = $2, updated_at = now() "
                        "WHERE purchase_id = $1 AND status = 'queued'",
                        r.purchase_id, game_id,
                    )
            return True

    # --- Чаттар ---------------------------------------------------------------------------

    async def upsert_chat(self, chat_id: int, title: str, active: bool, is_admin: bool) -> None:
        await self.pool.execute(
            """
            INSERT INTO chats (chat_id, title, active, is_admin) VALUES ($1, $2, $3, $4)
            ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title, active = EXCLUDED.active,
                is_admin = EXCLUDED.is_admin, updated_at = now()
            """,
            chat_id, title, active, is_admin,
        )

    async def get_chat_settings(self, chat_id: int) -> ChatSettings:
        cached = self._chat_settings.get(chat_id)
        if cached is not None:
            return cached
        row = await self.pool.fetchrow(
            "SELECT lang, registration_seconds, start_mode FROM chats WHERE chat_id = $1", chat_id
        )
        cfg = ChatSettings(row["lang"], row["registration_seconds"], row["start_mode"]) if row else ChatSettings()
        self._chat_settings[chat_id] = cfg
        return cfg

    async def update_chat_settings(self, chat_id: int, title: str, **changes: object) -> ChatSettings:
        """Чат баптауларын өзгерту (``lang``, ``registration_seconds``, ``start_mode``)."""
        cfg = replace(await self.get_chat_settings(chat_id), **changes)
        await self.pool.execute(
            """
            INSERT INTO chats (chat_id, title, lang, registration_seconds, start_mode)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (chat_id) DO UPDATE SET lang = EXCLUDED.lang,
                registration_seconds = EXCLUDED.registration_seconds,
                start_mode = EXCLUDED.start_mode, updated_at = now()
            """,
            chat_id, title, cfg.lang, cfg.registration_seconds, cfg.start_mode,
        )
        self._chat_settings[chat_id] = cfg
        return cfg

    async def active_chats(self) -> list[asyncpg.Record]:
        return await self.pool.fetch(
            "SELECT chat_id, title, is_admin FROM chats WHERE active ORDER BY updated_at DESC"
        )

    # --- Төлемдер -------------------------------------------------------------------------

    async def record_payment(
        self,
        user_id: int,
        telegram_charge_id: str,
        provider_charge_id: str | None,
        package_id: str,
        currency: str,
        total_amount: int,
    ) -> int | None:
        """Расталған төлемді тіркеп, алмаз қосу. Қайталанған төлемде ``None`` қайтарады."""
        package = PACKAGES_BY_ID[package_id]
        async with self.pool.acquire() as conn, conn.transaction():
            payment_id = await conn.fetchval(
                """
                INSERT INTO payments (telegram_payment_charge_id, provider_payment_charge_id,
                    user_id, package_id, diamonds, currency, total_amount)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (telegram_payment_charge_id) DO NOTHING
                RETURNING payment_id
                """,
                telegram_charge_id, provider_charge_id, user_id, package_id,
                package.diamonds, currency, total_amount,
            )
            if payment_id is None:
                return None
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds + $2 WHERE user_id = $1 RETURNING diamonds",
                user_id, package.diamonds,
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'payment', $3)",
                user_id, package.diamonds, telegram_charge_id,
            )
            return balance

    async def get_payment(self, telegram_charge_id: str) -> asyncpg.Record | None:
        return await self.pool.fetchrow(
            "SELECT * FROM payments WHERE telegram_payment_charge_id = $1", telegram_charge_id
        )

    async def mark_refunded(self, telegram_charge_id: str) -> asyncpg.Record | None:
        """Төлемді қайтарылған деп белгілеп, алмазды (қалғанынша) шегеру."""
        async with self.pool.acquire() as conn, conn.transaction():
            payment = await conn.fetchrow(
                "UPDATE payments SET status = 'refunded', refunded_at = now() "
                "WHERE telegram_payment_charge_id = $1 AND status = 'paid' RETURNING *",
                telegram_charge_id,
            )
            if payment is None:
                return None
            current = await conn.fetchval(
                "SELECT diamonds FROM users WHERE user_id = $1 FOR UPDATE", payment["user_id"]
            )
            taken = min(current or 0, payment["diamonds"])
            await conn.execute(
                "UPDATE users SET diamonds = diamonds - $2 WHERE user_id = $1",
                payment["user_id"], taken,
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'refund', $3)",
                payment["user_id"], -taken, telegram_charge_id,
            )
            return payment

    async def transfer_diamonds(
        self, sender: int, receiver: int, amount: int, receiver_username: str | None, receiver_name: str
    ) -> TransferResult:
        """Бір ойыншыдан екіншісіне алмаз беру — бір транзакцияда, баланс теріс болмайды."""
        if amount <= 0 or sender == receiver:
            raise ValueError("amount must be positive and users must differ")
        async with self.pool.acquire() as conn, conn.transaction():
            # Алушы ботқа әлі жазбаған болуы мүмкін — оны тіркейміз.
            await conn.execute(
                "INSERT INTO users (user_id, username, full_name) VALUES ($1, $2, $3) "
                "ON CONFLICT (user_id) DO NOTHING",
                receiver, receiver_username, receiver_name,
            )
            # Екі жол бірдей ретпен құлыпталады: қарсы бағыттағы сыйлықтар бір-бірін бөгемейді.
            await conn.execute(
                "SELECT 1 FROM users WHERE user_id = ANY($1::bigint[]) ORDER BY user_id FOR UPDATE",
                [sender, receiver],
            )
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds - $2 WHERE user_id = $1 AND diamonds >= $2 "
                "RETURNING diamonds",
                sender, amount,
            )
            if balance is None:
                current = await conn.fetchval("SELECT diamonds FROM users WHERE user_id = $1", sender)
                return TransferResult(False, balance=current or 0)
            row = await conn.fetchrow(
                "UPDATE users SET diamonds = diamonds + $2 WHERE user_id = $1 RETURNING diamonds, lang",
                receiver, amount,
            )
            await conn.executemany(
                "INSERT INTO ledger (user_id, currency, delta, reason) VALUES ($1, 'diamonds', $2, $3)",
                [(sender, -amount, f"gift_to:{receiver}"), (receiver, amount, f"gift_from:{sender}")],
            )
            return TransferResult(True, balance=balance, receiver_balance=row["diamonds"],
                                  receiver_lang=row["lang"])

    # --- 🎁 Алмаз тарату --------------------------------------------------------------------

    async def create_giveaway(self, chat_id: int, giver_id: int, amount: int) -> tuple[int | None, int]:
        """Берушінің шотынан ``amount`` алмазды тоқтатып, тарату ашу.

        ``(giveaway_id, баланс)`` қайтарады; алмаз жетпесе ``giveaway_id`` — ``None``.
        """
        if amount <= 0:
            raise ValueError("amount must be positive")
        async with self.pool.acquire() as conn, conn.transaction():
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds - $2 WHERE user_id = $1 AND diamonds >= $2 "
                "RETURNING diamonds",
                giver_id, amount,
            )
            if balance is None:
                current = await conn.fetchval("SELECT diamonds FROM users WHERE user_id = $1", giver_id)
                return None, current or 0
            giveaway_id = await conn.fetchval(
                "INSERT INTO giveaways (chat_id, giver_id, total, remaining) VALUES ($1, $2, $3, $3) "
                "RETURNING giveaway_id",
                chat_id, giver_id, amount,
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'giveaway', $3)",
                giver_id, -amount, str(giveaway_id),
            )
            return giveaway_id, balance

    async def set_giveaway_message(self, giveaway_id: int, message_id: int) -> None:
        await self.pool.execute(
            "UPDATE giveaways SET message_id = $2 WHERE giveaway_id = $1", giveaway_id, message_id
        )

    async def claim_giveaway(
        self, giveaway_id: int, user_id: int, username: str | None, full_name: str
    ) -> ClaimResult:
        """Таратудан 1 алмаз алу. Әр адам бір рет; берушінің өзі ала алмайды."""
        async with self.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "SELECT giver_id, remaining, status FROM giveaways WHERE giveaway_id = $1 FOR UPDATE",
                giveaway_id,
            )
            if row is None or row["status"] != "open" or row["remaining"] <= 0:
                return ClaimResult("gone")
            if row["giver_id"] == user_id:
                return ClaimResult("own")
            await conn.execute(
                "INSERT INTO users (user_id, username, full_name) VALUES ($1, $2, $3) "
                "ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, "
                "full_name = EXCLUDED.full_name",
                user_id, username, full_name,
            )
            claimed = await conn.fetchval(
                "INSERT INTO giveaway_claims (giveaway_id, user_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING RETURNING user_id",
                giveaway_id, user_id,
            )
            if claimed is None:
                return ClaimResult("again")
            await conn.execute(
                "UPDATE giveaways SET remaining = remaining - 1, "
                "status = CASE WHEN remaining = 1 THEN 'done' ELSE status END, "
                "closed_at = CASE WHEN remaining = 1 THEN now() ELSE closed_at END "
                "WHERE giveaway_id = $1",
                giveaway_id,
            )
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds + 1 WHERE user_id = $1 RETURNING diamonds", user_id
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', 1, 'giveaway_claim', $2)",
                user_id, str(giveaway_id),
            )
            return ClaimResult("ok", balance=balance)

    async def giveaway_view(self, giveaway_id: int) -> GiveawayView | None:
        row = await self.pool.fetchrow(
            "SELECT g.*, u.full_name, u.username FROM giveaways g JOIN users u ON u.user_id = g.giver_id "
            "WHERE g.giveaway_id = $1",
            giveaway_id,
        )
        if row is None:
            return None
        claimers = await self.pool.fetch(
            "SELECT c.user_id, u.full_name, u.username FROM giveaway_claims c "
            "JOIN users u USING (user_id) WHERE c.giveaway_id = $1 ORDER BY c.claimed_at, c.user_id",
            giveaway_id,
        )
        return GiveawayView(
            giveaway_id=row["giveaway_id"],
            chat_id=row["chat_id"],
            message_id=row["message_id"],
            giver_id=row["giver_id"],
            giver_name=row["full_name"] or row["username"] or str(row["giver_id"]),
            total=row["total"],
            remaining=row["remaining"],
            status=row["status"],
            claimers=tuple((c["user_id"], c["full_name"] or c["username"] or str(c["user_id"]))
                           for c in claimers),
        )

    async def expire_giveaways(self, older_than_seconds: float) -> list[int]:
        """Мерзімі өткен таратуларды жабып, алынбаған алмазды иесіне қайтару. ID-лерін қайтарады."""
        async with self.pool.acquire() as conn, conn.transaction():
            rows = await conn.fetch(
                "UPDATE giveaways SET status = 'expired', closed_at = now() "
                "WHERE status = 'open' AND created_at < now() - make_interval(secs => $1) "
                "RETURNING giveaway_id, giver_id, remaining",
                float(older_than_seconds),
            )
            for r in rows:
                if r["remaining"] > 0:
                    await conn.execute(
                        "UPDATE users SET diamonds = diamonds + $2 WHERE user_id = $1",
                        r["giver_id"], r["remaining"],
                    )
                    await conn.execute(
                        "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                        "VALUES ($1, 'diamonds', $2, 'giveaway_refund', $3)",
                        r["giver_id"], r["remaining"], str(r["giveaway_id"]),
                    )
            return [r["giveaway_id"] for r in rows]

    # --- 💱 Айырбас және алмазды нөлдеу ---------------------------------------------------------

    async def exchange_diamonds(self, user_id: int, amount: int) -> tuple[bool, int, int]:
        """``amount`` алмазды ₸-ге айырбастау (1 💎 = ``DIAMOND_TO_TENGE`` ₸).

        ``(ok, алмаз қалдығы, ₸ балансы)`` қайтарады; алмаз жетпесе баланс өзгермейді.
        """
        if amount <= 0:
            raise ValueError("amount must be positive")
        tenge = amount * DIAMOND_TO_TENGE
        async with self.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "UPDATE users SET diamonds = diamonds - $2, tenge = tenge + $3 "
                "WHERE user_id = $1 AND diamonds >= $2 RETURNING diamonds, tenge",
                user_id, amount, tenge,
            )
            if row is None:
                current = await conn.fetchrow("SELECT diamonds, tenge FROM users WHERE user_id = $1", user_id)
                return False, current["diamonds"] if current else 0, current["tenge"] if current else 0
            await conn.executemany(
                "INSERT INTO ledger (user_id, currency, delta, reason) VALUES ($1, $2, $3, 'exchange')",
                [(user_id, "diamonds", -amount), (user_id, "tenge", tenge)],
            )
            return True, row["diamonds"], row["tenge"]

    async def diamond_totals(self) -> tuple[int, int]:
        """(алмазы бар ойыншылар саны, барлық алмаз) — /reloaddm растауы үшін."""
        row = await self.pool.fetchrow(
            "SELECT count(*) AS users, coalesce(sum(diamonds), 0) AS total FROM users WHERE diamonds > 0"
        )
        open_giveaways = await self.pool.fetchval(
            "SELECT coalesce(sum(remaining), 0) FROM giveaways WHERE status = 'open'"
        )
        return row["users"], row["total"] + open_giveaways

    async def reset_all_diamonds(self, admin_id: int) -> ResetResult:
        """Барлық ойыншының (әкімшінің де) алмазын 0-ге түсіру.

        Ашық таратулар да жабылады — оларда тоқтатылған алмаз ешкімге берілмейді.
        Әр ойыншының жойылған алмазы ``ledger`` журналына жазылады.
        """
        async with self.pool.acquire() as conn, conn.transaction():
            rows = await conn.fetch(
                """
                WITH old AS (
                    SELECT user_id, diamonds FROM users WHERE diamonds > 0 FOR UPDATE
                ), cleared AS (
                    UPDATE users u SET diamonds = 0 FROM old WHERE u.user_id = old.user_id
                    RETURNING u.user_id
                )
                INSERT INTO ledger (user_id, currency, delta, reason, ref)
                SELECT old.user_id, 'diamonds', -old.diamonds, 'admin_reset',
                       $1::text || ':' || now()::text
                FROM old JOIN cleared USING (user_id)
                RETURNING delta
                """,
                str(admin_id),
            )
            giveaways = await conn.fetch(
                "UPDATE giveaways SET status = 'cancelled', closed_at = now() WHERE status = 'open' "
                "RETURNING giveaway_id, remaining",
            )
            total = -sum(r["delta"] for r in rows) + sum(g["remaining"] for g in giveaways)
            return ResetResult(
                users=len(rows), diamonds=total, giveaways=tuple(g["giveaway_id"] for g in giveaways)
            )

    async def grant(self, user_id: int, currency: str, amount: int, reason: str) -> int | None:
        if currency not in ("tenge", "diamonds"):
            raise ValueError(currency)
        async with self.pool.acquire() as conn, conn.transaction():
            balance = await conn.fetchval(
                f"UPDATE users SET {currency} = GREATEST({currency} + $2, 0) WHERE user_id = $1 "
                f"RETURNING {currency}",
                user_id, amount,
            )
            if balance is None:
                return None
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason) VALUES ($1, $2, $3, $4)",
                user_id, currency, amount, reason,
            )
            return balance

