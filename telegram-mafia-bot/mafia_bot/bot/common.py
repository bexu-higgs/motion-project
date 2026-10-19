"""Хэндлерлерге ортақ көмекші функциялар."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import ClassVar

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import ChatMemberAdministrator, ChatMemberOwner, User

GROUP_TYPES = frozenset({"group", "supergroup"})
MEMBER_STATUSES = frozenset({"creator", "administrator", "member", "restricted"})


@dataclass(frozen=True)
class BotRights:
    is_admin: bool
    can_delete: bool
    can_restrict: bool

    @property
    def ok(self) -> bool:
        return self.is_admin and self.can_delete and self.can_restrict


async def bot_rights(bot: Bot, chat_id: int) -> BotRights:
    try:
        me = await bot.get_chat_member(chat_id, bot.id)
    except TelegramAPIError:
        return BotRights(False, False, False)
    if isinstance(me, ChatMemberAdministrator):
        return BotRights(True, bool(me.can_delete_messages), bool(me.can_restrict_members))
    return BotRights(False, False, False)


async def is_chat_admin(bot: Bot, chat_id: int, user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(chat_id, user_id)
    except TelegramAPIError:
        return False
    return isinstance(member, (ChatMemberAdministrator, ChatMemberOwner))


async def is_chat_member(bot: Bot, chat_id: int, user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(chat_id, user_id)
    except TelegramAPIError:
        return False
    if member.status == "restricted":
        return bool(getattr(member, "is_member", True))
    return member.status in MEMBER_STATUSES


class AdminCache:
    """Чат әкімшілерінің тізімі (әр хабар сайын Telegram-нан сұрамау үшін қысқа уақытқа сақталады)."""

    shared: ClassVar[AdminCache]

    def __init__(self, ttl: float = 60) -> None:
        self.ttl = ttl
        self._data: dict[int, tuple[float, frozenset[int]]] = {}

    async def is_admin(self, bot: Bot, chat_id: int, user_id: int) -> bool:
        now = time.monotonic()
        entry = self._data.get(chat_id)
        if entry is None or entry[0] < now:
            try:
                admins = await bot.get_chat_administrators(chat_id)
            except TelegramAPIError:
                return await is_chat_admin(bot, chat_id, user_id)
            entry = (now + self.ttl, frozenset(a.user.id for a in admins))
            self._data[chat_id] = entry
        return user_id in entry[1]

    def forget(self, chat_id: int) -> None:
        self._data.pop(chat_id, None)

    def clear(self) -> None:
        self._data.clear()


AdminCache.shared = AdminCache()


def full_name(user: User) -> str:
    return user.full_name or user.username or str(user.id)
