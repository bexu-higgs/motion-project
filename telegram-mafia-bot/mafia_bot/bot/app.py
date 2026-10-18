"""Ботты құрастыру және іске қосу."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware, Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import (
    BotCommand,
    BotCommandScopeAllGroupChats,
    BotCommandScopeAllPrivateChats,
    CallbackQuery,
    Message,
    TelegramObject,
)

from ..config import Settings
from ..controller import GameManager
from ..db.repo import Repo
from .common import full_name
from .handlers import game, group, payments, private
from .notifier import TelegramNotifier

log = logging.getLogger(__name__)


class EnsureUserMiddleware(BaseMiddleware):
    """Жеке чатта жазған әр пайдаланушыны базаға тіркеу (өзгеріс болғанда ғана)."""

    def __init__(self, cache_size: int = 20_000) -> None:
        self.cache: dict[int, tuple[str | None, str]] = {}
        self.cache_size = cache_size

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        chat = event.chat if isinstance(event, Message) else (
            event.message.chat if isinstance(event, CallbackQuery) and event.message else None
        )
        if user is not None and not user.is_bot and chat is not None and chat.type == "private":
            key = (user.username, full_name(user))
            if self.cache.get(user.id) != key:
                repo: Repo = data["repo"]
                await repo.ensure_user(user.id, *key)
                if len(self.cache) >= self.cache_size:
                    self.cache.clear()
                self.cache[user.id] = key
        return await handler(event, data)


PRIVATE_COMMANDS = [
    BotCommand(command="start", description="Басты мәзір"),
    BotCommand(command="profile", description="Менің профилім"),
    BotCommand(command="shop", description="Дүкен"),
    BotCommand(command="daily", description="Күнделікті сыйлық"),
    BotCommand(command="rating", description="Рейтинг"),
    BotCommand(command="rules", description="Ережелер"),
    BotCommand(command="help", description="Көмек"),
    BotCommand(command="paysupport", description="Төлем бойынша көмек"),
    BotCommand(command="terms", description="Шарттар"),
]
GROUP_COMMANDS = [
    BotCommand(command="game", description="Жаңа ойынға тіркелуді ашу"),
    BotCommand(command="startgame", description="Ойынды бірден бастау"),
    BotCommand(command="extend", description="Тіркелуді 30 секундқа ұзарту"),
    BotCommand(command="leave", description="Ойыннан шығу"),
    BotCommand(command="stop", description="Ойынды тоқтату (әкімші)"),
    BotCommand(command="rules", description="Ережелер"),
]


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
    repo = await Repo.connect(settings.database_url)
    me = await bot.get_me()
    notifier = TelegramNotifier(bot, me.username)
    manager = GameManager(
        notifier,
        repo,
        registration_seconds=settings.registration_seconds,
        time_scale=settings.time_scale,
        restrict_dead=settings.restrict_dead,
        silence_night=settings.silence_night,
        mute_non_players=settings.mute_non_players,
    )

    dp = build_dispatcher(repo, manager, notifier, settings)

    await manager.recover_stale()
    await bot.set_my_commands(PRIVATE_COMMANDS, scope=BotCommandScopeAllPrivateChats())
    await bot.set_my_commands(GROUP_COMMANDS, scope=BotCommandScopeAllGroupChats())
    log.info("Бот іске қосылды: @%s", me.username)
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await manager.shutdown()
        await repo.close()
        await bot.session.close()
