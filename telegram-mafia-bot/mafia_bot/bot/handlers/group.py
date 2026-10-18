"""Топтық чат: ойын бөлмесі, әкімші құқықтары, түнгі тыныштық және өлгендердің хабарламалары."""

from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.enums import ContentType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command
from aiogram.types import ChatMemberAdministrator, ChatMemberUpdated, Message

from ...config import Settings
from ...controller import GameManager
from ...db.repo import Repo
from .. import keyboards, texts
from ..common import GROUP_TYPES, bot_rights, is_chat_admin
from ..notifier import TelegramNotifier

log = logging.getLogger(__name__)

router = Router(name="group")
router.message.filter(F.chat.type.in_(GROUP_TYPES))

# Ойыншы жазған мазмұн түрлері (қызметтік хабарламаларға тиіспейміз).
USER_CONTENT = frozenset({
    ContentType.TEXT, ContentType.PHOTO, ContentType.VIDEO, ContentType.ANIMATION,
    ContentType.STICKER, ContentType.VOICE, ContentType.VIDEO_NOTE, ContentType.AUDIO,
    ContentType.DOCUMENT, ContentType.POLL, ContentType.DICE, ContentType.LOCATION,
    ContentType.CONTACT, ContentType.VENUE,
})


async def _can_manage(bot: Bot, settings: Settings, chat_id: int, user_id: int) -> bool:
    return user_id in settings.admin_ids or await is_chat_admin(bot, chat_id, user_id)


@router.message(Command("start"))
async def group_start(message: Message, bot: Bot, repo: Repo) -> None:
    rights = await bot_rights(bot, message.chat.id)
    await repo.upsert_chat(message.chat.id, message.chat.title or "", True, rights.is_admin)
    await message.answer(texts.BOT_PROMOTED if rights.ok else texts.BOT_ADDED)


@router.message(Command("game", "newgame", "mafia"))
async def new_game(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, settings: Settings
) -> None:
    chat = message.chat
    rights = await bot_rights(bot, chat.id)
    await repo.upsert_chat(chat.id, chat.title or "", True, rights.is_admin)
    if settings.require_admin_rights and not rights.ok:
        await message.reply(texts.NEED_ADMIN)
        return
    error = await manager.open_lobby(chat.id, chat.title or str(chat.id), message.from_user.id)
    if error:
        await message.reply(error)


@router.message(Command("startgame", "begin"))
async def start_game(message: Message, bot: Bot, manager: GameManager, settings: Settings) -> None:
    lobby = manager.lobbies.get(message.chat.id)
    uid = message.from_user.id
    if lobby is not None and lobby.owner_id != uid and not await _can_manage(bot, settings, message.chat.id, uid):
        await message.reply("Ойынды тіркелуді ашқан адам не әкімші ғана бастай алады.")
        return
    error = await manager.force_start(message.chat.id)
    if error:
        await message.reply(error)


@router.message(Command("extend"))
async def extend(message: Message, bot: Bot, manager: GameManager, settings: Settings) -> None:
    lobby = manager.lobbies.get(message.chat.id)
    uid = message.from_user.id
    if lobby is None:
        await message.reply("Ашық тіркелу жоқ.")
        return
    if lobby.owner_id != uid and not await _can_manage(bot, settings, message.chat.id, uid):
        await message.reply("Тіркелуді ашқан адам не әкімші ғана ұзарта алады.")
        return
    text = await manager.extend(message.chat.id)
    if text:
        await message.reply(text)


@router.message(Command("stop"))
async def stop(message: Message, bot: Bot, manager: GameManager, settings: Settings) -> None:
    if not await _can_manage(bot, settings, message.chat.id, message.from_user.id):
        await message.reply("Ойынды тек топ әкімшілері тоқтата алады.")
        return
    if not await manager.abort(message.chat.id, "🛑 Ойынды әкімші тоқтатты."):
        await message.reply("Бұл чатта ойын жоқ.")


@router.message(Command("leave"))
async def leave(message: Message, manager: GameManager) -> None:
    if manager.user_chat.get(message.from_user.id) != message.chat.id:
        await message.reply("Сіз бұл чаттағы ойынға қатыспайсыз.")
        return
    await message.reply(await manager.leave(message.from_user.id))


@router.message(Command("rules", "help"))
async def group_rules(message: Message, notifier: TelegramNotifier) -> None:
    await message.reply(
        texts.rules_page("general"),
        reply_markup=keyboards.url_button("🤖 Ботты ашу", notifier.start_link("menu")),
    )


@router.message(F.left_chat_member)
async def member_left(message: Message, manager: GameManager) -> None:
    user = message.left_chat_member
    if user and manager.user_chat.get(user.id) == message.chat.id:
        await manager.leave(user.id)


@router.message(F.migrate_to_chat_id)
async def migrated(message: Message, manager: GameManager, repo: Repo) -> None:
    # Топ супертопқа айналғанда ескі чаттағы ойын жалғаса алмайды.
    await manager.abort(message.chat.id, "⚠️ Топ супертопқа айналды, ойынды қайта бастаңыз: /game")
    await repo.upsert_chat(message.chat.id, message.chat.title or "", False, False)


@router.message(F.content_type.in_(USER_CONTENT))
async def moderate(message: Message, manager: GameManager) -> None:
    """Ойын кезінде өлген ойыншылардың және түнде барлығының хабарламасын өшіру."""
    user = message.from_user
    if user is None or user.is_bot or message.sender_chat is not None:
        return
    if manager.should_delete(message.chat.id, user.id):
        try:
            await message.delete()
        except TelegramAPIError as e:  # құқық жоқ болса — жай ғана өткізіп жібереміз
            log.debug("Хабарламаны өшіру мүмкін болмады: %s", e)


# --- Боттың топтағы мәртебесі -------------------------------------------------------------------

membership = Router(name="membership")


@membership.my_chat_member(F.chat.type.in_(GROUP_TYPES))
async def bot_membership(event: ChatMemberUpdated, bot: Bot, repo: Repo, manager: GameManager) -> None:
    chat = event.chat
    new = event.new_chat_member
    old = event.old_chat_member
    if new.status in ("left", "kicked"):
        await repo.upsert_chat(chat.id, chat.title or "", False, False)
        await manager.abort(chat.id, "Бот топтан шығарылды.")
        return
    is_admin = isinstance(new, ChatMemberAdministrator)
    await repo.upsert_chat(chat.id, chat.title or "", True, is_admin)
    was_in_chat = old.status not in ("left", "kicked")
    if is_admin and new.can_delete_messages and new.can_restrict_members:
        if not isinstance(old, ChatMemberAdministrator):
            await bot.send_message(chat.id, texts.BOT_PROMOTED)
    elif not was_in_chat:
        await bot.send_message(chat.id, texts.BOT_ADDED)
    elif isinstance(old, ChatMemberAdministrator) or is_admin:
        await bot.send_message(chat.id, texts.NEED_ADMIN)
