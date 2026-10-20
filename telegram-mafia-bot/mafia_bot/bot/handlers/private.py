"""Жеке чат: басты мәзір, профиль, дүкен, рөл таңдау, ережелер, рейтинг, сыйлық, тіл.

``lang`` — пайдаланушы таңдаған тіл (оны ``EnsureUserMiddleware`` береді).
"""

from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, User

from ...config import Settings
from ...controller import GameManager
from ...db.repo import Repo
from ...economy import ROLE_QUEUE_LIMIT, SHOP, Item, role_price
from ...game.roles import Role, purchasable_roles, title
from ...i18n import LANGS, t, variants
from .. import keyboards, texts
from ..common import bot_rights, full_name, is_chat_member
from ..notifier import TelegramNotifier

router = Router(name="private")
router.message.filter(F.chat.type == ChatType.PRIVATE)
router.callback_query.filter(F.message.chat.type == ChatType.PRIVATE)


def button(key: str):
    """Мәзір батырмасын кез келген тілде тану."""
    return F.text.in_(variants(key))


# --- /start ------------------------------------------------------------------------------------


async def _join(bot: Bot, manager: GameManager, game_id: int, user: User, lang: str) -> str:
    lobby = manager.lobby_by_game.get(game_id)
    if lobby is not None and not await is_chat_member(bot, lobby.chat_id, user.id):
        return t(lobby.lang, "join.not_member")
    return await manager.join(game_id, user.id, full_name(user), user.username)


@router.message(CommandStart(deep_link=True, magic=F.args.regexp(r"^join_\d+$")))
async def start_join(
    message: Message, command: CommandObject, bot: Bot, manager: GameManager, lang: str
) -> None:
    text = await _join(bot, manager, int(command.args.split("_", 1)[1]), message.from_user, lang)
    await message.answer(text, reply_markup=keyboards.main_menu(lang))


@router.message(CommandStart(deep_link=True, magic=F.args == "menu"))
async def start_menu(message: Message, manager: GameManager, lang: str) -> None:
    """Ескі «Ботқа өту» сілтемесі (?start=menu): ойын кезінде сәлемдесу хабарын қайта жібермейміз."""
    if manager.in_game(message.from_user.id):
        return
    await message.answer(t(lang, "welcome"), reply_markup=keyboards.main_menu(lang))


@router.message(CommandStart())
async def start(message: Message, lang: str) -> None:
    await message.answer(t(lang, "welcome"), reply_markup=keyboards.main_menu(lang))


@router.message(Command("help"))
@router.message(button("btn.help"))
async def help_(message: Message, lang: str) -> None:
    await message.answer(t(lang, "help"), reply_markup=keyboards.main_menu(lang))


@router.message(Command("paysupport"))
async def pay_support(message: Message, lang: str) -> None:
    await message.answer(t(lang, "pay_support"))


@router.message(Command("terms"))
async def terms(message: Message, lang: str) -> None:
    await message.answer(t(lang, "terms"))


# --- Тіл ---------------------------------------------------------------------------------------


@router.message(Command("language", "lang"))
@router.message(button("btn.lang"))
async def language(message: Message, lang: str) -> None:
    await message.answer(t(lang, "lang.choose"), reply_markup=keyboards.user_languages(lang))


@router.callback_query(F.data.startswith("ulang:"))
async def language_set(callback: CallbackQuery, repo: Repo, ensure_user_cache: dict) -> None:
    lang = callback.data.split(":", 1)[1]
    if lang not in LANGS:
        await callback.answer()
        return
    await repo.set_user_lang(callback.from_user.id, lang)
    ensure_user_cache.pop(callback.from_user.id, None)
    await callback.answer()
    try:
        await callback.message.edit_reply_markup(reply_markup=keyboards.user_languages(lang))
    except TelegramAPIError:
        pass
    await callback.message.answer(t(lang, "lang.set"), reply_markup=keyboards.main_menu(lang))


# --- Ойынға қосылу және бөлме ашу ----------------------------------------------------------------


@router.message(button("btn.join"))
async def show_lobbies(
    message: Message, bot: Bot, manager: GameManager, notifier: TelegramNotifier, lang: str
) -> None:
    uid = message.from_user.id
    rows = []
    for lobby in manager.open_lobbies()[:30]:
        if await is_chat_member(bot, lobby.chat_id, uid):
            rows.append([InlineKeyboardButton(
                text=f"🎲 {lobby.chat_title[:40]} ({len(lobby.players)}/50)",
                callback_data=f"jn:{lobby.game_id}",
            )])
    if not rows:
        await message.answer(
            t(lang, "join.none"),
            reply_markup=keyboards.url_button(t(lang, "room.add_btn"), notifier.startgroup_link()),
        )
        return
    await message.answer(t(lang, "join.list"), reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data.regexp(r"^jn:\d+$"))
async def join_cb(callback: CallbackQuery, bot: Bot, manager: GameManager, lang: str) -> None:
    text = await _join(bot, manager, int(callback.data[3:]), callback.from_user, lang)
    await callback.answer()
    await callback.message.answer(text)


@router.message(button("btn.room"))
async def show_rooms(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, notifier: TelegramNotifier, lang: str
) -> None:
    uid = message.from_user.id
    rows = []
    for chat in (await repo.active_chats())[:25]:
        if manager.busy(chat["chat_id"]):
            continue
        if await is_chat_member(bot, chat["chat_id"], uid):
            rows.append([InlineKeyboardButton(
                text=f"🏠 {chat['title'][:40] or chat['chat_id']}", callback_data=f"ol:{chat['chat_id']}"
            )])
    rows.append([InlineKeyboardButton(text=t(lang, "room.add_new_btn"), url=notifier.startgroup_link())])
    await message.answer(t(lang, "room.text"), reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data.regexp(r"^ol:-?\d+$"))
async def open_room_cb(
    callback: CallbackQuery, bot: Bot, repo: Repo, manager: GameManager, settings: Settings, lang: str
) -> None:
    from .group import can_open_game  # циклдік импорттың алдын алу

    chat_id = int(callback.data[3:])
    uid = callback.from_user.id
    if not await is_chat_member(bot, chat_id, uid):
        await callback.answer(t(lang, "room.not_member"), show_alert=True)
        return
    if settings.require_admin_rights and not (await bot_rights(bot, chat_id)).ok:
        await callback.answer(t(lang, "room.no_rights"), show_alert=True)
        return
    cfg = await repo.get_chat_settings(chat_id)
    if not await can_open_game(bot, settings, cfg, chat_id, uid):
        await callback.answer(t(cfg.lang, "group.admins_only"), show_alert=True)
        return
    try:
        chat_title = (await bot.get_chat(chat_id)).title or str(chat_id)
    except TelegramAPIError:
        chat_title = str(chat_id)
    error = await manager.open_lobby(chat_id, chat_title, uid, cfg.lang, cfg.registration_seconds)
    if error:
        await callback.answer(error, show_alert=True)
        return
    await callback.answer(t(lang, "room.opened_alert"))
    await callback.message.answer(t(lang, "room.opened", chat=chat_title))


# --- Профиль -------------------------------------------------------------------------------------


@router.message(Command("profile"))
@router.message(button("btn.profile"))
async def profile(message: Message, repo: Repo, lang: str) -> None:
    uid = message.from_user.id
    user = await repo.get_user(uid)
    if user is None:
        await message.answer(t(lang, "welcome"), reply_markup=keyboards.main_menu(lang))
        return
    text = texts.profile_text(
        user, await repo.recent_games(uid), await repo.role_queue(uid), await repo.user_rank(uid), lang
    )
    await message.answer(text, reply_markup=keyboards.main_menu(lang))


# --- Дүкен ---------------------------------------------------------------------------------------


@router.message(Command("shop"))
@router.message(button("btn.shop"))
async def shop(message: Message, repo: Repo, lang: str) -> None:
    user = await repo.get_user(message.from_user.id)
    await message.answer(texts.shop_text(user, lang), reply_markup=keyboards.shop(lang))


@router.callback_query(F.data.startswith("buy:"))
async def buy(callback: CallbackQuery, repo: Repo, lang: str) -> None:
    try:
        item = Item(callback.data[4:])
    except ValueError:
        await callback.answer(t(lang, "shop.unknown"), show_alert=True)
        return
    result = await repo.buy_item(callback.from_user.id, item)
    shop_item = SHOP[item]
    if not result.ok:
        currency = "₸" if shop_item.currency == "tenge" else "💎"
        await callback.answer(
            t(lang, "shop.no_funds", price=shop_item.price_label, balance=result.balance, currency=currency),
            show_alert=True,
        )
        return
    await callback.answer(t(lang, "shop.ok_alert"))
    await callback.message.answer(texts.purchase_ok(item, result.balance, result.count, lang))


# --- Алмаз ---------------------------------------------------------------------------------------


@router.message(button("btn.diamonds"))
async def diamonds(message: Message, lang: str) -> None:
    await message.answer(texts.diamonds_text(lang), reply_markup=keyboards.diamond_packages())


@router.callback_query(F.data == "dia")
async def diamonds_cb(callback: CallbackQuery, lang: str) -> None:
    await callback.answer()
    await callback.message.answer(texts.diamonds_text(lang), reply_markup=keyboards.diamond_packages())


# --- Рөл таңдау ----------------------------------------------------------------------------------


@router.message(button("btn.role"))
async def role_menu(message: Message, repo: Repo, settings: Settings, lang: str) -> None:
    queue = await repo.role_queue(message.from_user.id)
    admin = message.from_user.id in settings.admin_ids
    await message.answer(texts.role_pick_text(queue, lang, admin), reply_markup=keyboards.role_pick(lang, admin))


@router.callback_query(F.data.startswith("rp:"))
async def role_buy(callback: CallbackQuery, repo: Repo, settings: Settings, lang: str) -> None:
    try:
        role = Role(callback.data[3:])
    except ValueError:
        role = None
    admin = callback.from_user.id in settings.admin_ids
    if role not in purchasable_roles(admin):
        await callback.answer(t(lang, "rp.not_buyable"), show_alert=True)
        return
    result = await repo.queue_role(callback.from_user.id, role, admin=admin)
    if not result.ok:
        reason = {
            "funds": t(lang, "rp.no_funds", price=role_price(role), balance=result.balance),
            "limit": t(lang, "rp.limit", limit=ROLE_QUEUE_LIMIT),
        }.get(result.reason, t(lang, "rp.failed"))
        await callback.answer(reason, show_alert=True)
        return
    await callback.answer(t(lang, "rp.ok_alert"))
    position = t(lang, "rp.next_game") if result.count == 1 else t(lang, "rp.position", n=result.count)
    await callback.message.answer(
        t(lang, "rp.saved", role=title(role, lang), position=position, balance=result.balance)
    )


@router.callback_query(F.data == "rq")
async def role_queue(callback: CallbackQuery, repo: Repo, lang: str) -> None:
    queue = await repo.role_queue(callback.from_user.id)
    await callback.answer()
    if not queue:
        await callback.message.answer(t(lang, "rq.empty"))
        return
    lines = [f"{i}. {title(Role(q['role']), lang)}" for i, q in enumerate(queue, 1)]
    await callback.message.answer(
        t(lang, "rq.title") + "\n" + "\n".join(lines), reply_markup=keyboards.role_queue(queue, lang)
    )


@router.callback_query(F.data.regexp(r"^rr:\d+$"))
async def role_refund(callback: CallbackQuery, repo: Repo, manager: GameManager, lang: str) -> None:
    if manager.in_game(callback.from_user.id):
        await callback.answer(t(lang, "rr.in_game"), show_alert=True)
        return
    refunded = await repo.refund_role(callback.from_user.id, int(callback.data[3:]))
    if refunded is None:
        await callback.answer(t(lang, "rr.gone"), show_alert=True)
        return
    await callback.answer(t(lang, "rr.done", n=refunded), show_alert=True)
    try:
        await callback.message.edit_reply_markup(reply_markup=None)
    except TelegramAPIError:
        pass


# --- Ережелер, рейтинг, сыйлық ----------------------------------------------------------------------


@router.message(Command("rules"))
@router.message(button("btn.rules"))
async def rules(message: Message, lang: str) -> None:
    await message.answer(texts.rules_page("general", lang), reply_markup=keyboards.rules(lang))


@router.callback_query(F.data.startswith("rules:"))
async def rules_cb(callback: CallbackQuery, lang: str) -> None:
    page = callback.data.split(":", 1)[1]
    await callback.answer()
    try:
        await callback.message.edit_text(texts.rules_page(page, lang), reply_markup=keyboards.rules(lang))
    except TelegramAPIError:
        pass  # бет өзгермеген болса


@router.message(Command("rating"))
@router.message(button("btn.rating"))
async def rating(message: Message, repo: Repo, lang: str) -> None:
    top = await repo.top_players(10)
    rank = await repo.user_rank(message.from_user.id)
    await message.answer(texts.rating_text(top, rank, lang))


@router.message(Command("daily"))
@router.message(button("btn.daily"))
async def daily(message: Message, repo: Repo, lang: str) -> None:
    result = await repo.claim_daily(message.from_user.id)
    if not result.ok:
        if result.wait is None:
            await message.answer(t(lang, "welcome"), reply_markup=keyboards.main_menu(lang))
            return
        await message.answer(t(lang, "daily.wait", time=texts.format_timedelta(result.wait, lang)))
        return
    user = await repo.get_user(message.from_user.id)
    await message.answer(texts.daily_text(result.day, result.reward, user["tenge"] if user else None, lang))
