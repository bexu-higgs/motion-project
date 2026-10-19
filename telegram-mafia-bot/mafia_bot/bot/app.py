"""Ботты құрастыру және іске қосу."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

import asyncpg
from aiogram import BaseMiddleware, Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramNetworkError, TelegramUnauthorizedError
from aiogram.types import (
    BotCommand,
    BotCommandScopeAllGroupChats,
    BotCommandScopeAllPrivateChats,
    CallbackQuery,
    Message,
    TelegramObject,
)

from .. import i18n
from ..config import Settings, StartupError
from ..controller import GameManager
from ..db.repo import Repo
from .common import full_name
from .handlers import game, group, payments, private
from .notifier import TelegramNotifier

log = logging.getLogger(__name__)


class EnsureUserMiddleware(BaseMiddleware):
    """Жеке чатта жазған әр пайдаланушыны базаға тіркейді және хэндлерге ``lang`` береді.

    Жеке чатта — пайдаланушы таңдаған тіл, топта — чат баптауларындағы тіл.
    """

    def __init__(self, cache_size: int = 20_000) -> None:
        self.cache: dict[int, tuple[tuple[str | None, str], str]] = {}
        self.cache_size = cache_size

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        repo: Repo = data["repo"]
        user = getattr(event, "from_user", None)
        chat = event.chat if isinstance(event, Message) else (
            event.message.chat if isinstance(event, CallbackQuery) and event.message else None
        )
        lang = i18n.DEFAULT_LANG
        if chat is not None and chat.type == "private":
            if user is not None and not user.is_bot:
                key = (user.username, full_name(user))
                cached = self.cache.get(user.id)
                if cached is not None and cached[0] == key:
                    lang = cached[1]
                else:
                    lang = await repo.ensure_user(user.id, *key)
                    if len(self.cache) >= self.cache_size:
                        self.cache.clear()
                    self.cache[user.id] = (key, lang)
        elif chat is not None:
            lang = (await repo.get_chat_settings(chat.id)).lang
        data["lang"] = i18n.norm(lang)
        data["ensure_user_cache"] = self.cache
        return await handler(event, data)


PRIVATE_COMMANDS = ("start", "profile", "shop", "daily", "rating", "rules", "language", "help", "paysupport", "terms")
GROUP_COMMANDS = ("game", "startgame", "extend", "leave", "stop", "settingsmafiahiggs", "rules")


async def set_commands(bot: Bot) -> None:
    """Командалар тізімі әр тілде (әдепкісі — қазақша)."""
    for lang in (None, *i18n.LANGS):
        code = i18n.norm(lang)
        private = [BotCommand(command=c, description=i18n.t(code, f"cmd.{c}")) for c in PRIVATE_COMMANDS]
        group = [BotCommand(command=c, description=i18n.t(code, f"cmd.{c}")) for c in GROUP_COMMANDS]
        await bot.set_my_commands(private, scope=BotCommandScopeAllPrivateChats(), language_code=lang)
        await bot.set_my_commands(group, scope=BotCommandScopeAllGroupChats(), language_code=lang)


def build_dispatcher(
    repo: Repo, manager: GameManager, notifier: TelegramNotifier, settings: Settings
) -> Dispatcher:
    """Диспетчер құру. Роутерлер модуль деңгейінде, сондықтан бір процесте бір рет шақырылады."""
    dp = Dispatcher(repo=repo, manager=manager, notifier=notifier, settings=settings)
    ensure_user = EnsureUserMiddleware()
    dp.message.outer_middleware(ensure_user)
    dp.callback_query.outer_middleware(ensure_user)
    dp.include_routers(
        payments.router,     # төлем хабарламалары бірінші өңделеді
        private.router,
        game.router,
        group.router,
        group.membership,
        game.fallback,       # ең соңында: жеке чаттағы еркін мәтін
    )
    return dp


async def run(settings: Settings) -> None:
    bot = Bot(settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        try:
            me = await bot.get_me()
        except TelegramUnauthorizedError as e:
            raise StartupError(
                "BOT_TOKEN қате: @BotFather берген токенді .env файлына толық көшіріңіз."
            ) from e
        except TelegramNetworkError as e:
            raise StartupError(f"Telegram серверіне қосылу мүмкін болмады: {e.message}") from e
        try:
            repo = await Repo.connect(settings.database_url)
        except (OSError, TimeoutError, asyncpg.PostgresError) as e:
            raise StartupError(f"PostgreSQL-ге қосылу мүмкін болмады (DATABASE_URL тексеріңіз): {e}") from e

        notifier = TelegramNotifier(bot, me.username)
        manager = GameManager(
            notifier,
            repo,
            registration_seconds=settings.registration_seconds,
            time_scale=settings.time_scale,
            mute_seconds=settings.mute_seconds,
            silence_night=settings.silence_night,
            mute_non_players=settings.mute_non_players,
        )
        dp = build_dispatcher(repo, manager, notifier, settings)
        try:
            await manager.recover_stale()
            await set_commands(bot)
            log.info("Бот іске қосылды: @%s", me.username)
            await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
        finally:
            await manager.shutdown()
            await repo.close()
    finally:
        await bot.session.close()
