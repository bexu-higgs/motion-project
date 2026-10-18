"""Контроллердің ``Notifier`` интерфейсінің aiogram арқылы іске асырылуы."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import TypeVar

from aiogram import Bot
from aiogram.exceptions import (
    TelegramAPIError,
    TelegramBadRequest,
    TelegramForbiddenError,
    TelegramRetryAfter,
)
from aiogram.types import ChatPermissions

from ..controller import Keyboard
from .keyboards import inline

log = logging.getLogger(__name__)
T = TypeVar("T")

MUTED = ChatPermissions(
    can_send_messages=False,
    can_send_audios=False,
    can_send_documents=False,
    can_send_photos=False,
    can_send_videos=False,
    can_send_video_notes=False,
    can_send_voice_notes=False,
    can_send_polls=False,
    can_send_other_messages=False,
    can_add_web_page_previews=False,
)
# Барлық рұқсаттарды True ету — Telegram-да шектеуді алудың ресми тәсілі
# (қатысушы чаттың әдепкі рұқсаттарына қайтады).
UNMUTED = ChatPermissions(
    can_send_messages=True,
    can_send_audios=True,
    can_send_documents=True,
    can_send_photos=True,
    can_send_videos=True,
    can_send_video_notes=True,
    can_send_voice_notes=True,
    can_send_polls=True,
    can_send_other_messages=True,
    can_add_web_page_previews=True,
    can_change_info=True,
    can_invite_users=True,
    can_pin_messages=True,
    can_manage_topics=True,
)
# Бот күтпеген жерден тоқтаса да, шектеу мәңгі қалмасын.
RESTRICTION_SAFETY = timedelta(hours=6)


class TelegramNotifier:
    def __init__(self, bot: Bot, username: str) -> None:
        self.bot = bot
        self.username = username

    def start_link(self, payload: str) -> str:
        return f"https://t.me/{self.username}?start={payload}"

    def startgroup_link(self) -> str:
        return (
            f"https://t.me/{self.username}?startgroup=mafia"
            "&admin=delete_messages+restrict_members+pin_messages"
        )

    async def _retry(self, call: Callable[[], Awaitable[T]], attempts: int = 3) -> T:
        for attempt in range(attempts):
            try:
                return await call()
            except TelegramRetryAfter as e:
                if attempt == attempts - 1:
                    raise
                await asyncio.sleep(e.retry_after + 0.5)
        raise AssertionError("unreachable")

    async def send(self, chat_id: int, text: str, keyboard: Keyboard | None = None) -> int | None:
        try:
            msg = await self._retry(
                lambda: self.bot.send_message(
                    chat_id, text, reply_markup=inline(keyboard), disable_web_page_preview=True
                )
            )
            return msg.message_id
        except (TelegramForbiddenError, TelegramBadRequest) as e:
            log.info("Хабарлама жіберілмеді (%s): %s", chat_id, e.message)
        except TelegramAPIError:
            log.exception("Хабарлама жіберу қатесі (%s)", chat_id)
        return None

    async def edit(
        self, chat_id: int, message_id: int, text: str, keyboard: Keyboard | None = None
    ) -> None:
        try:
            await self._retry(
                lambda: self.bot.edit_message_text(
                    text=text, chat_id=chat_id, message_id=message_id,
                    reply_markup=inline(keyboard), disable_web_page_preview=True,
                )
            )
        except TelegramBadRequest as e:
            if "not modified" not in e.message:
                log.info("Хабарлама өзгертілмеді (%s/%s): %s", chat_id, message_id, e.message)
        except TelegramAPIError:
            log.exception("Хабарламаны өзгерту қатесі")

    async def restrict(self, chat_id: int, user_id: int) -> bool:
        try:
            member = await self.bot.get_chat_member(chat_id, user_id)
            if member.status != "member":  # әкімшілерді және басқа шектеулерді өзгертпейміз
                return False
            await self._retry(
                lambda: self.bot.restrict_chat_member(
                    chat_id, user_id, permissions=MUTED, use_independent_chat_permissions=True,
                    until_date=datetime.now(UTC) + RESTRICTION_SAFETY,
                )
            )
            return True
        except TelegramAPIError as e:
            log.info("Ойыншыны шектеу мүмкін болмады (%s/%s): %s", chat_id, user_id, e)
            return False

    async def unrestrict(self, chat_id: int, user_id: int) -> None:
        try:
            await self._retry(
                lambda: self.bot.restrict_chat_member(
                    chat_id, user_id, permissions=UNMUTED, use_independent_chat_permissions=True
                )
            )
        except TelegramAPIError as e:
            log.info("Шектеуді алу мүмкін болмады (%s/%s): %s", chat_id, user_id, e)

    async def pin(self, chat_id: int, message_id: int) -> None:
        try:
            await self.bot.pin_chat_message(chat_id, message_id, disable_notification=True)
        except TelegramAPIError:
            pass

    async def unpin(self, chat_id: int, message_id: int) -> None:
        try:
            await self.bot.unpin_chat_message(chat_id, message_id=message_id)
        except TelegramAPIError:
            pass

    async def delete(self, chat_id: int, message_id: int) -> None:
        try:
            await self.bot.delete_message(chat_id, message_id)
        except TelegramAPIError:
            pass
