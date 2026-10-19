"""Топтық чат: ойын бөлмесі, чат баптаулары, әкімші құқықтары және модерация.

``lang`` — чат әкімшілері таңдаған тіл (оны ``EnsureUserMiddleware`` береді).
"""

from __future__ import annotations

import html
import logging

from aiogram import Bot, F, Router
from aiogram.enums import ContentType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command
from aiogram.types import CallbackQuery, ChatMemberAdministrator, ChatMemberUpdated, Message

from ...config import Settings
from ...controller import GameManager
from ...db.models import START_MODES, ChatSettings
from ...db.repo import Repo
from ...i18n import LANG_NAMES, LANGS, t
from .. import keyboards, texts
from ..common import GROUP_TYPES, AdminCache, bot_rights
from ..notifier import TelegramNotifier

log = logging.getLogger(__name__)

router = Router(name="group")
router.message.filter(F.chat.type.in_(GROUP_TYPES))
router.callback_query.filter(F.message.chat.type.in_(GROUP_TYPES))

# Ойыншы жазған мазмұн түрлері (қызметтік хабарламаларға тиіспейміз).
USER_CONTENT = frozenset({
    ContentType.TEXT, ContentType.PHOTO, ContentType.VIDEO, ContentType.ANIMATION,
    ContentType.STICKER, ContentType.VOICE, ContentType.VIDEO_NOTE, ContentType.AUDIO,
    ContentType.DOCUMENT, ContentType.POLL, ContentType.DICE, ContentType.LOCATION,
    ContentType.CONTACT, ContentType.VENUE,
})


async def is_manager(bot: Bot, settings: Settings, chat_id: int, user_id: int) -> bool:
    """Чат әкімшісі немесе бот әкімшісі (ADMIN_IDS)."""
    return user_id in settings.admin_ids or await AdminCache.shared.is_admin(bot, chat_id, user_id)


async def can_open_game(bot: Bot, settings: Settings, cfg: ChatSettings, chat_id: int, user_id: int) -> bool:
    """«Тек әкімшілер» режимінде ойынды тек әкімшілер ашып/бастай алады."""
    return cfg.start_mode != "admins" or await is_manager(bot, settings, chat_id, user_id)


@router.message(Command("start"))
async def group_start(message: Message, bot: Bot, repo: Repo, lang: str) -> None:
    rights = await bot_rights(bot, message.chat.id)
    await repo.upsert_chat(message.chat.id, message.chat.title or "", True, rights.is_admin)
    await message.answer(t(lang, "bot_promoted" if rights.ok else "bot_added"))


@router.message(Command("game", "newgame", "mafia"))
async def new_game(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, settings: Settings
) -> None:
    chat = message.chat
    rights = await bot_rights(bot, chat.id)
    await repo.upsert_chat(chat.id, chat.title or "", True, rights.is_admin)
    cfg = await repo.get_chat_settings(chat.id)
    if settings.require_admin_rights and not rights.ok:
        await message.reply(t(cfg.lang, "need_admin"))
        return
    if not await can_open_game(bot, settings, cfg, chat.id, message.from_user.id):
        await message.reply(t(cfg.lang, "group.admins_only"))
        return
    error = await manager.open_lobby(
        chat.id, chat.title or str(chat.id), message.from_user.id, cfg.lang, cfg.registration_seconds
    )
    if error:
        await message.reply(error)


@router.message(Command("startgame", "begin"))
async def start_game(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, settings: Settings, lang: str
) -> None:
    cfg = await repo.get_chat_settings(message.chat.id)
    if not await can_open_game(bot, settings, cfg, message.chat.id, message.from_user.id):
        await message.reply(t(lang, "group.admins_only"))
        return
    error = await manager.force_start(message.chat.id)
    if error:
        await message.reply(error)


@router.message(Command("extend"))
async def extend(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, settings: Settings, lang: str
) -> None:
    if message.chat.id not in manager.lobbies:
        await message.reply(t(lang, "group.no_lobby"))
        return
    cfg = await repo.get_chat_settings(message.chat.id)
    if not await can_open_game(bot, settings, cfg, message.chat.id, message.from_user.id):
        await message.reply(t(lang, "group.admins_only"))
        return
    text = await manager.extend(message.chat.id)
    if text:
        await message.reply(text)


@router.message(Command("stop"))
async def stop(message: Message, bot: Bot, manager: GameManager, settings: Settings, lang: str) -> None:
    if not await is_manager(bot, settings, message.chat.id, message.from_user.id):
        await message.reply(t(lang, "group.stop_denied"))
        return
    if not await manager.abort(message.chat.id, t(lang, "game.stopped_admin")):
        await message.reply(t(lang, "group.no_game"))


@router.message(Command("leave"))
async def leave(message: Message, manager: GameManager, lang: str) -> None:
    if manager.user_chat.get(message.from_user.id) != message.chat.id:
        await message.reply(t(lang, "group.not_in_game"))
        return
    await message.reply(await manager.leave(message.from_user.id))


@router.callback_query(F.data.regexp(r"^c:\d+:\d+:[01]$"))
async def confirm_vote(callback: CallbackQuery, manager: GameManager) -> None:
    """👍/👎 — ең көп дауыс жинаған ойыншыны дарға асуды растау."""
    _, gid, day, yes = callback.data.split(":")
    ok, text = await manager.confirm_vote(callback.from_user.id, int(gid), int(day), yes == "1")
    await callback.answer(text, show_alert=not ok)


@router.message(Command("rules", "help"))
async def group_rules(message: Message, notifier: TelegramNotifier, lang: str) -> None:
    await message.reply(
        texts.rules_page("general", lang),
        reply_markup=keyboards.url_button(t(lang, "group.open_bot_btn"), notifier.start_link("menu")),
    )


# --- Чат баптаулары: /settingsmafia (бұрынғы атауы /settingsmafiahiggs да жұмыс істейді) ----------


def _settings_text(cfg: ChatSettings, chat_title: str, registration: int) -> str:
    lang = cfg.lang
    return "\n".join([
        t(lang, "settings.title", chat=html.escape(chat_title)),
        "",
        t(lang, "settings.reg", seconds=registration),
        t(lang, "settings.start", mode=t(lang, f"settings.start.{cfg.start_mode}")),
        t(lang, "settings.lang", lang=LANG_NAMES[lang]),
        "",
        t(lang, "settings.note"),
    ])


def _registration(cfg: ChatSettings, settings: Settings) -> int:
    return int(cfg.registration_seconds or settings.registration_seconds)


@router.message(Command("settingsmafia", "settingsmafiahiggs", "settings"))
async def chat_settings(message: Message, bot: Bot, repo: Repo, settings: Settings, lang: str) -> None:
    if not await is_manager(bot, settings, message.chat.id, message.from_user.id):
        await message.reply(t(lang, "settings.admins_only"))
        return
    cfg = await repo.get_chat_settings(message.chat.id)
    reg = _registration(cfg, settings)
    await message.answer(
        _settings_text(cfg, message.chat.title or "", reg), reply_markup=keyboards.chat_settings(cfg, reg)
    )


@router.callback_query(F.data.startswith("cfg:"))
async def chat_settings_cb(
    callback: CallbackQuery, bot: Bot, repo: Repo, settings: Settings, lang: str
) -> None:
    chat = callback.message.chat
    if not await is_manager(bot, settings, chat.id, callback.from_user.id):
        await callback.answer(t(lang, "settings.admins_only"), show_alert=True)
        return
    parts = callback.data.split(":")
    if parts[1] == "close":
        await callback.answer()
        try:
            await callback.message.edit_text(t(lang, "settings.closed"), reply_markup=None)
        except TelegramAPIError:
            pass
        return
    changes: dict[str, object] = {}
    if parts[1] == "reg" and parts[2].isdigit() and int(parts[2]) in keyboards.REGISTRATION_CHOICES:
        changes["registration_seconds"] = int(parts[2])
    elif parts[1] == "start" and parts[2] in START_MODES:
        changes["start_mode"] = parts[2]
    elif parts[1] == "lang" and parts[2] in LANGS:
        changes["lang"] = parts[2]
    if not changes:
        await callback.answer()
        return
    cfg = await repo.update_chat_settings(chat.id, chat.title or "", **changes)
    await callback.answer(t(cfg.lang, "settings.saved"))
    reg = _registration(cfg, settings)
    try:
        await callback.message.edit_text(
            _settings_text(cfg, chat.title or "", reg), reply_markup=keyboards.chat_settings(cfg, reg)
        )
    except TelegramAPIError:
        pass


# --- Апта үздіктері: /topmafia ---------------------------------------------------------------------


@router.message(Command("topmafia"))
async def top_mafia(message: Message, bot: Bot, repo: Repo, settings: Settings, lang: str) -> None:
    """Осы чаттағы соңғы 7 күннің үздік ойыншылары (тек чат әкімшілеріне)."""
    if not await is_manager(bot, settings, message.chat.id, message.from_user.id):
        await message.reply(t(lang, "top.admins_only"))
        return
    top = await repo.weekly_top(message.chat.id)
    await message.answer(texts.weekly_top_text(top, message.chat.title or "", lang))


# --- Қызметтік оқиғалар және модерация ---------------------------------------------------------


@router.message(F.left_chat_member)
async def member_left(message: Message, manager: GameManager) -> None:
    user = message.left_chat_member
    if user and manager.user_chat.get(user.id) == message.chat.id:
        await manager.leave(user.id)


@router.message(F.migrate_to_chat_id)
async def migrated(message: Message, manager: GameManager, repo: Repo, lang: str) -> None:
    # Топ супертопқа айналғанда ескі чаттағы ойын жалғаса алмайды.
    await manager.abort(message.chat.id, t(lang, "game.migrated"))
    await repo.upsert_chat(message.chat.id, message.chat.title or "", False, False)


@router.message(F.content_type.in_(USER_CONTENT))
async def moderate(message: Message, bot: Bot, manager: GameManager, settings: Settings) -> None:
    """Ойын кезінде: бөгделер мен өлгендердің хабарын өшіріп, 2 минутқа үнсіз ету;
    түнде барлық ойыншының хабарын өшіру. Әкімші «!» белгісімен жазса — өшірілмейді."""
    user = message.from_user
    if user is None or user.is_bot or message.sender_chat is not None:
        return
    chat_id = message.chat.id

    async def is_admin() -> bool:
        return await is_manager(bot, settings, chat_id, user.id)

    await manager.moderate(chat_id, user.id, message.message_id, message.text or message.caption, is_admin)


# --- Боттың топтағы мәртебесі -------------------------------------------------------------------

membership = Router(name="membership")


@membership.my_chat_member(F.chat.type.in_(GROUP_TYPES))
async def bot_membership(event: ChatMemberUpdated, bot: Bot, repo: Repo, manager: GameManager) -> None:
    chat = event.chat
    new = event.new_chat_member
    old = event.old_chat_member
    lang = (await repo.get_chat_settings(chat.id)).lang
    if new.status in ("left", "kicked"):
        await repo.upsert_chat(chat.id, chat.title or "", False, False)
        await manager.abort(chat.id, t(lang, "game.removed"))
        return
    is_admin = isinstance(new, ChatMemberAdministrator)
    await repo.upsert_chat(chat.id, chat.title or "", True, is_admin)
    AdminCache.shared.forget(chat.id)
    was_in_chat = old.status not in ("left", "kicked")
    if is_admin and new.can_delete_messages and new.can_restrict_members:
        if not isinstance(old, ChatMemberAdministrator):
            await bot.send_message(chat.id, t(lang, "bot_promoted"))
    elif not was_in_chat:
        await bot.send_message(chat.id, t(lang, "bot_added"))
    elif isinstance(old, ChatMemberAdministrator) or is_admin:
        await bot.send_message(chat.id, t(lang, "need_admin"))
