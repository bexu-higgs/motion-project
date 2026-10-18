"""PostgreSQL репозиторийі (asyncpg).

Валютаға қатысты барлық өзгерістер бір транзакцияда және шартты UPDATE арқылы
орындалады, сондықтан баланс ешқашан теріс болмайды, ал сыйақы мен төлем қайталанбайды.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import asyncpg

from ..economy import (
    PACKAGES_BY_ID,
    ROLE_PICK_PRICE,
    ROLE_QUEUE_LIMIT,
    SHOP,
    DailyResult,
    Item,
    compute_daily,
)
from ..game.engine import RoleRequest
from ..game.roles import Role
from .models import FinalRow, Inventory, PurchaseResult

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class Repo:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

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

    async def ensure_user(self, user_id: int, username: str | None, full_name: str) -> None:
        await self.pool.execute(
            """
            INSERT INTO users (user_id, username, full_name) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE
                SET username = EXCLUDED.username, full_name = EXCLUDED.full_name
            """,
            user_id, username, full_name,
        )

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

    async def queue_role(self, user_id: int, role: Role) -> PurchaseResult:
        if role is Role.CIVILIAN:
            return PurchaseResult(False, "unknown")
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
            if user["diamonds"] < ROLE_PICK_PRICE:
                return PurchaseResult(False, "funds", balance=user["diamonds"], count=queued)
            balance = await conn.fetchval(
                "UPDATE users SET diamonds = diamonds - $2 WHERE user_id = $1 RETURNING diamonds",
                user_id, ROLE_PICK_PRICE,
            )
            purchase_id = await conn.fetchval(
                "INSERT INTO role_purchases (user_id, role, price) VALUES ($1, $2, $3) "
                "RETURNING purchase_id",
                user_id, role.value, ROLE_PICK_PRICE,
            )
            await conn.execute(
                "INSERT INTO ledger (user_id, currency, delta, reason, ref) "
                "VALUES ($1, 'diamonds', $2, 'role_pick', $3)",
                user_id, -ROLE_PICK_PRICE, str(purchase_id),
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

    async def set_restricted(self, game_id: int, user_id: int, restricted: bool) -> None:
        await self.pool.execute(
            "UPDATE game_players SET restricted = $3 WHERE game_id = $1 AND user_id = $2",
            game_id, user_id, restricted,
        )

    async def stale_games(self) -> list[dict[str, Any]]:
        """Бот тоқтаған кезде аяқталмай қалған ойындар (қайта іске қосылғанда тазалау үшін)."""
        games = await self.pool.fetch(
            "SELECT game_id, chat_id, status FROM games WHERE status IN ('lobby', 'running')"
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

