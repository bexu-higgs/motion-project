"""Жеке чат: басты мәзір, профиль, дүкен, рөл таңдау, ережелер, рейтинг, сыйлық."""

from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, User

from ...config import Settings
from ...controller import GameManager
from ...db.repo import Repo
from ...economy import ROLE_QUEUE_LIMIT, SHOP, Item, format_timedelta
from ...game.roles import PURCHASABLE_ROLES, Role, title
from .. import keyboards, texts
from ..common import bot_rights, full_name, is_chat_member
from ..notifier import TelegramNotifier

router = Router(name="private")
router.message.filter(F.chat.type == ChatType.PRIVATE)
router.callback_query.filter(F.message.chat.type == ChatType.PRIVATE)


# --- /start ------------------------------------------------------------------------------------


async def _join(bot: Bot, manager: GameManager, game_id: int, user: User) -> str:
    lobby = manager.lobby_by_game.get(game_id)
    if lobby is not None and not await is_chat_member(bot, lobby.chat_id, user.id):
        return "❌ Бұл ойынға тек сол топтың мүшелері қосыла алады."
    return await manager.join(game_id, user.id, full_name(user), user.username)


@router.message(CommandStart(deep_link=True, magic=F.args.regexp(r"^join_\d+$")))
async def start_join(message: Message, command: CommandObject, bot: Bot, manager: GameManager) -> None:
    text = await _join(bot, manager, int(command.args.split("_", 1)[1]), message.from_user)
    await message.answer(text, reply_markup=keyboards.main_menu())


@router.message(CommandStart())
async def start(message: Message) -> None:
    await message.answer(texts.WELCOME, reply_markup=keyboards.main_menu())


@router.message(Command("help"))
@router.message(F.text == texts.BTN_HELP)
async def help_(message: Message) -> None:
    await message.answer(texts.HELP, reply_markup=keyboards.main_menu())


@router.message(Command("paysupport"))
async def pay_support(message: Message) -> None:
    await message.answer(texts.PAY_SUPPORT)


@router.message(Command("terms"))
async def terms(message: Message) -> None:
    await message.answer(texts.TERMS)


# --- Ойынға қосылу және бөлме ашу ----------------------------------------------------------------


@router.message(F.text == texts.BTN_JOIN)
async def show_lobbies(message: Message, bot: Bot, manager: GameManager, notifier: TelegramNotifier) -> None:
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
            "Қазір сіз мүше топтарда ашық тіркелу жоқ.\nТопта /game жазып, жаңа ойын ашыңыз.",
            reply_markup=keyboards.url_button("➕ Ботты топқа қосу", notifier.startgroup_link()),
        )
        return
    await message.answer("🎮 Ашық ойындар:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(F.data.regexp(r"^jn:\d+$"))
async def join_cb(callback: CallbackQuery, bot: Bot, manager: GameManager) -> None:
    text = await _join(bot, manager, int(callback.data[3:]), callback.from_user)
    await callback.answer()
    await callback.message.answer(text)


@router.message(F.text == texts.BTN_ROOM)
async def show_rooms(
    message: Message, bot: Bot, repo: Repo, manager: GameManager, notifier: TelegramNotifier
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
    rows.append([InlineKeyboardButton(text="➕ Ботты жаңа топқа қосу", url=notifier.startgroup_link())])
    await message.answer(
        "🏠 <b>Ойын бөлмесін ашу</b>\n\n"
        "Ойын топтық чатта өтеді. Мені топқа қосып, әкімші етіңіз де, сол топта /game жазыңыз "
        "немесе төменнен бот бар топты таңдаңыз.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.regexp(r"^ol:-?\d+$"))
async def open_room_cb(
    callback: CallbackQuery, bot: Bot, manager: GameManager, settings: Settings
) -> None:
    chat_id = int(callback.data[3:])
    uid = callback.from_user.id
    if not await is_chat_member(bot, chat_id, uid):
        await callback.answer("Сіз бұл топтың мүшесі емессіз.", show_alert=True)
        return
    if settings.require_admin_rights and not (await bot_rights(bot, chat_id)).ok:
        await callback.answer("Ботта бұл топта әкімші құқықтары жоқ.", show_alert=True)
        return
    try:
        chat_title = (await bot.get_chat(chat_id)).title or str(chat_id)
    except TelegramAPIError:
        chat_title = str(chat_id)
    error = await manager.open_lobby(chat_id, chat_title, uid)
    if error:
        await callback.answer(error, show_alert=True)
        return
    await callback.answer("✅ Тіркелу ашылды!")
    await callback.message.answer(f"✅ «{chat_title}» тобында тіркелу ашылды.")


# --- Профиль -------------------------------------------------------------------------------------


@router.message(Command("profile"))
@router.message(F.text == texts.BTN_PROFILE)
async def profile(message: Message, repo: Repo) -> None:
    uid = message.from_user.id
    user = await repo.get_user(uid)
    if user is None:
        await message.answer(texts.WELCOME, reply_markup=keyboards.main_menu())
        return
    text = texts.profile_text(
        user, await repo.recent_games(uid), await repo.role_queue(uid), await repo.user_rank(uid)
    )
    await message.answer(text, reply_markup=keyboards.main_menu())


# --- Дүкен ---------------------------------------------------------------------------------------


@router.message(Command("shop"))
@router.message(F.text == texts.BTN_SHOP)
async def shop(message: Message, repo: Repo) -> None:
    user = await repo.get_user(message.from_user.id)
    await message.answer(texts.shop_text(user), reply_markup=keyboards.shop())


@router.callback_query(F.data.startswith("buy:"))
async def buy(callback: CallbackQuery, repo: Repo) -> None:
    try:
        item = Item(callback.data[4:])
    except ValueError:
        await callback.answer("Белгісіз зат.", show_alert=True)
        return
    result = await repo.buy_item(callback.from_user.id, item)
    shop_item = SHOP[item]
    if not result.ok:
        currency = "₸" if shop_item.currency == "tenge" else "💎"
        await callback.answer(
            f"Қаражат жеткіліксіз: {shop_item.price_label} керек, сізде {result.balance} {currency}.",
            show_alert=True,
        )
        return
    await callback.answer("✅ Сатып алынды!")
    await callback.message.answer(texts.purchase_ok(item, result.balance, result.count))


# --- Алмаз ---------------------------------------------------------------------------------------


@router.message(F.text == texts.BTN_DIAMONDS)
async def diamonds(message: Message) -> None:
    await message.answer(texts.diamonds_text(), reply_markup=keyboards.diamond_packages())


@router.callback_query(F.data == "dia")
async def diamonds_cb(callback: CallbackQuery) -> None:
    await callback.answer()
    await callback.message.answer(texts.diamonds_text(), reply_markup=keyboards.diamond_packages())


# --- Рөл таңдау ----------------------------------------------------------------------------------


@router.message(F.text == texts.BTN_ROLE)
async def role_menu(message: Message, repo: Repo) -> None:
    queue = await repo.role_queue(message.from_user.id)
    await message.answer(texts.role_pick_text(queue), reply_markup=keyboards.role_pick())


@router.callback_query(F.data.startswith("rp:"))
async def role_buy(callback: CallbackQuery, repo: Repo) -> None:
    try:
        role = Role(callback.data[3:])
    except ValueError:
        role = None
    if role not in PURCHASABLE_ROLES:
        await callback.answer("Бұл рөлді сатып алуға болмайды.", show_alert=True)
        return
    result = await repo.queue_role(callback.from_user.id, role)
    if not result.ok:
        reason = {
            "funds": f"Алмаз жеткіліксіз (сізде {result.balance} 💎). «💎 Алмаз сатып алу» бөлімін ашыңыз.",
            "limit": f"Кезекте ең көбі {ROLE_QUEUE_LIMIT} рөл тұра алады.",
        }.get(result.reason, "Сатып алу мүмкін болмады.")
        await callback.answer(reason, show_alert=True)
        return
    await callback.answer("✅ Рөл кезекке қойылды!")
    position = "келесі ойынға" if result.count == 1 else f"кезекте {result.count}-орында"
    await callback.message.answer(
        f"✅ {title(role)} рөлі {position} сақталды. Қалған баланс: {result.balance} 💎"
    )


@router.callback_query(F.data == "rq")
async def role_queue(callback: CallbackQuery, repo: Repo) -> None:
    queue = await repo.role_queue(callback.from_user.id)
    await callback.answer()
    if not queue:
        await callback.message.answer("📋 Кезегіңіз бос. Келесі ойынға рөл таңдалмаған.")
        return
    lines = [f"{i}. {title(Role(q['role']))}" for i, q in enumerate(queue, 1)]
    await callback.message.answer(
        "📋 <b>Рөлдер кезегі</b> (бірінші — келесі ойынға):\n" + "\n".join(lines),
        reply_markup=keyboards.role_queue(queue),
    )


@router.callback_query(F.data.regexp(r"^rr:\d+$"))
async def role_refund(callback: CallbackQuery, repo: Repo, manager: GameManager) -> None:
    if manager.in_game(callback.from_user.id):
        await callback.answer("Ойын не тіркелу кезінде рөлді қайтаруға болмайды.", show_alert=True)
        return
    refunded = await repo.refund_role(callback.from_user.id, int(callback.data[3:]))
    if refunded is None:
        await callback.answer("Бұл таңдау әлдеқашан қолданылған не қайтарылған.", show_alert=True)
        return
    await callback.answer(f"💎 {refunded} алмаз қайтарылды.", show_alert=True)
    try:
        await callback.message.edit_reply_markup(reply_markup=None)
    except TelegramAPIError:
        pass


# --- Ережелер, рейтинг, сыйлық ----------------------------------------------------------------------


@router.message(Command("rules"))
@router.message(F.text == texts.BTN_RULES)
async def rules(message: Message) -> None:
    await message.answer(texts.rules_page("general"), reply_markup=keyboards.rules())


@router.callback_query(F.data.startswith("rules:"))
async def rules_cb(callback: CallbackQuery) -> None:
    page = callback.data.split(":", 1)[1]
    await callback.answer()
    try:
        await callback.message.edit_text(texts.rules_page(page), reply_markup=keyboards.rules())
    except TelegramAPIError:
        pass  # бет өзгермеген болса


@router.message(Command("rating"))
@router.message(F.text == texts.BTN_RATING)
async def rating(message: Message, repo: Repo) -> None:
    top = await repo.top_players(10)
    rank = await repo.user_rank(message.from_user.id)
    await message.answer(texts.rating_text(top, rank))


@router.message(Command("daily"))
@router.message(F.text == texts.BTN_DAILY)
async def daily(message: Message, repo: Repo) -> None:
    result = await repo.claim_daily(message.from_user.id)
    if not result.ok:
        if result.wait is None:
            await message.answer(texts.WELCOME, reply_markup=keyboards.main_menu())
            return
        await message.answer(
            f"⏳ Бүгінгі сыйлықты алдыңыз. Келесі сыйлыққа дейін: {format_timedelta(result.wait)}."
        )
        return
    user = await repo.get_user(message.from_user.id)
    await message.answer(texts.daily_text(result.day, result.reward, user["tenge"] if user else None))
