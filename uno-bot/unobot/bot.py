"""Telegram бөлігі: командалар, батырмалар, inline жүрістер және кезек таймері."""

from __future__ import annotations

import asyncio
import logging

from telegram import (
    BotCommand,
    ChatMember,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InlineQueryResultsButton,
    LinkPreviewOptions,
    Update,
    User,
)
from telegram.constants import ChatType, ParseMode
from telegram.error import TelegramError
from telegram.ext import (
    AIORateLimiter,
    Application,
    CallbackQueryHandler,
    ChatMemberHandler,
    ChosenInlineResultHandler,
    CommandHandler,
    ContextTypes,
    InlineQueryHandler,
)

from . import texts
from .cards import COLORS, Color
from .config import Config, load_config
from .game import Event, Game, GameError, Phase
from .inline import MAX_RESULTS, build_results, parse_play_arg, parse_result_id
from .manager import GameManager, Session
from .stickers import StickerRegistry, set_links, upload_sticker_sets

log = logging.getLogger(__name__)

MAX_MESSAGE = 4000
NO_PREVIEW = LinkPreviewOptions(is_disabled=True)


# ------------------------------------------------------------------ көмекшілер


def manager_of(context: ContextTypes.DEFAULT_TYPE) -> GameManager:
    return context.bot_data["manager"]


def stickers_of(context: ContextTypes.DEFAULT_TYPE) -> StickerRegistry:
    return context.bot_data["stickers"]


def config_of(context: ContextTypes.DEFAULT_TYPE) -> Config:
    return context.bot_data["config"]


def display_name(user: User) -> str:
    return (user.full_name or user.username or str(user.id))[:32]


def is_group(update: Update) -> bool:
    chat = update.effective_chat
    return chat is not None and chat.type in (ChatType.GROUP, ChatType.SUPERGROUP)


async def is_chat_admin(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int) -> bool:
    try:
        member = await context.bot.get_chat_member(chat_id, user_id)
    except TelegramError:
        return False
    return member.status in (ChatMember.ADMINISTRATOR, ChatMember.OWNER)


def split_text(text: str, limit: int = MAX_MESSAGE) -> list[str]:
    chunks, current = [], ""
    for line in text.split("\n"):
        if current and len(current) + len(line) + 1 > limit:
            chunks.append(current)
            current = ""
        current = f"{current}\n{line}" if current else line
    if current:
        chunks.append(current)
    return chunks


async def send(context: ContextTypes.DEFAULT_TYPE, chat_id: int, text: str, markup=None) -> int | None:
    message_id = None
    chunks = split_text(text)
    for i, chunk in enumerate(chunks):
        message = await context.bot.send_message(
            chat_id,
            chunk,
            parse_mode=ParseMode.HTML,
            reply_markup=markup if i == len(chunks) - 1 else None,
            link_preview_options=NO_PREVIEW,
        )
        message_id = message.message_id
    return message_id


# ------------------------------------------------------------------ пернетақта


def lobby_keyboard(game: Game) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(texts.BTN_JOIN, callback_data="lobby:join"),
                InlineKeyboardButton(texts.BTN_LEAVE, callback_data="lobby:leave"),
            ],
            [InlineKeyboardButton(texts.BTN_BEGIN, callback_data="lobby:begin")],
        ]
    )


def turn_keyboard(game: Game) -> InlineKeyboardMarkup:
    cards_button = InlineKeyboardButton(texts.BTN_CARDS, switch_inline_query_current_chat="")
    rows: list[list[InlineKeyboardButton]] = []
    if game.phase is Phase.CHALLENGE:
        rows.append(
            [
                InlineKeyboardButton(texts.BTN_CHALLENGE, callback_data="wd4:challenge"),
                InlineKeyboardButton(texts.BTN_ACCEPT, callback_data="wd4:accept"),
            ]
        )
    elif game.phase is Phase.CHOOSE_COLOR:
        buttons = [InlineKeyboardButton(texts.color_text(c), callback_data=f"color:{c.value}") for c in COLORS]
        rows += [buttons[:2], buttons[2:]]
    rows.append([cards_button])
    if game.uno_vulnerable_id is not None:
        rows.append([InlineKeyboardButton(texts.BTN_UNO, callback_data="uno")])
    return InlineKeyboardMarkup(rows)


def new_game_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton(texts.BTN_NEW_GAME, callback_data="newgame")]])


# ------------------------------------------------------- ойын барысын жариялау


async def post_lobby(context: ContextTypes.DEFAULT_TYPE, session: Session) -> None:
    """Тіркелу хабарламасын жіберіп, топта бірден бекіту (pin)."""
    game = session.game
    session.lobby_message_id = await send(context, game.chat_id, texts.lobby_text(game), lobby_keyboard(game))
    try:
        await context.bot.pin_chat_message(game.chat_id, session.lobby_message_id, disable_notification=True)
    except TelegramError as exc:
        # Бекіту үшін бот әкімші болып, «Хабарламаларды бекіту» құқығы болуы керек.
        log.info("Тіркелу хабарламасы бекітілмеді (%s): %s", game.chat_id, exc)
        hinted: set[int] = context.bot_data.setdefault("pin_hint_chats", set())
        if game.chat_id not in hinted:
            hinted.add(game.chat_id)
            await send(context, game.chat_id, texts.PIN_HINT)


async def unpin_lobby(context: ContextTypes.DEFAULT_TYPE, session: Session) -> None:
    if session.lobby_message_id is None:
        return
    try:
        await context.bot.unpin_chat_message(session.game.chat_id, message_id=session.lobby_message_id)
    except TelegramError:
        pass


async def refresh_lobby(context: ContextTypes.DEFAULT_TYPE, session: Session) -> None:
    game = session.game
    if session.lobby_message_id is None:
        await post_lobby(context, session)
        return
    try:
        await context.bot.edit_message_text(
            texts.lobby_text(game),
            chat_id=game.chat_id,
            message_id=session.lobby_message_id,
            parse_mode=ParseMode.HTML,
            reply_markup=lobby_keyboard(game),
        )
    except TelegramError as exc:
        if "not modified" not in str(exc).lower():
            await post_lobby(context, session)


async def send_status(context: ContextTypes.DEFAULT_TYPE, session: Session, body: str = "") -> None:
    game = session.game
    text = f"{body}\n{texts.turn_prompt(game)}" if body else texts.turn_prompt(game)
    old = session.status_message_id
    session.status_message_id = await send(context, game.chat_id, text, turn_keyboard(game))
    if old is not None:
        try:
            await context.bot.edit_message_reply_markup(game.chat_id, old, reply_markup=None)
        except TelegramError:
            pass


async def update_status_keyboard(context: ContextTypes.DEFAULT_TYPE, session: Session) -> None:
    if session.status_message_id is None:
        return
    try:
        await context.bot.edit_message_reply_markup(
            session.game.chat_id, session.status_message_id, reply_markup=turn_keyboard(session.game)
        )
    except TelegramError:
        pass


async def send_card_sticker(context: ContextTypes.DEFAULT_TYPE, chat_id: int, card) -> None:
    sticker_id = stickers_of(context).card(card)
    if sticker_id:
        try:
            await context.bot.send_sticker(chat_id, sticker_id)
            return
        except TelegramError:
            log.warning("Стикер жіберілмеді: %s", card.key)
    await send(context, chat_id, f"🃏 {texts.card_text(card)}")


async def announce(context: ContextTypes.DEFAULT_TYPE, session: Session, events: list[Event]) -> None:
    """Оқиғаларды чатқа жазып, келесі кезекті көрсету."""
    game = session.game
    chat_id = game.chat_id
    manager_of(context).sync(session)

    start = next((i for i, e in enumerate(events) if e.kind == "game_start"), None)
    body_events = events
    if start is not None:
        # «Ойын басталды!» хабарламасы, сосын бірінші картаның стикері.
        cut = next(i for i, e in enumerate(events) if e.kind == "first_card") + 1
        await send(context, chat_id, texts.events_text(events[:cut], game))
        await send_card_sticker(context, chat_id, events[cut - 1]["card"])
        body_events = events[cut:]
    body = texts.events_text(body_events, game)

    if game.running:
        if game.drawn_card is not None and not body:
            # Ойыншы карта алды және сол картамен жүре алады — кезек ауысқан жоқ, жаңа хабарлама керек емес.
            schedule_turn_timer(context, session)
            return
        await send_status(context, session, body)
        schedule_turn_timer(context, session)
        return

    cancel_turn_timer(context, chat_id)
    await unpin_lobby(context, session)
    if session.status_message_id is not None:
        try:
            await context.bot.edit_message_reply_markup(chat_id, session.status_message_id, reply_markup=None)
        except TelegramError:
            pass
    await send(context, chat_id, body or texts.status_text(game), new_game_keyboard())


async def reply_error(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user: User, error: GameError | str) -> None:
    await send(context, chat_id, f"{texts.mention_user(user)}: {texts.error_text(error)}")


# --------------------------------------------------------------- таймерлер


def _timer_names(chat_id: int) -> tuple[str, str]:
    return f"turn:{chat_id}", f"remind:{chat_id}"


def cancel_turn_timer(context: ContextTypes.DEFAULT_TYPE, chat_id: int) -> None:
    if context.job_queue is None:
        return
    for name in _timer_names(chat_id):
        for job in context.job_queue.get_jobs_by_name(name):
            job.schedule_removal()


def schedule_turn_timer(context: ContextTypes.DEFAULT_TYPE, session: Session) -> None:
    timeout = config_of(context).turn_timeout
    if context.job_queue is None or timeout <= 0:
        return
    chat_id = session.game.chat_id
    cancel_turn_timer(context, chat_id)
    token = (id(session.game), session.game.turn_serial)
    turn_name, remind_name = _timer_names(chat_id)
    context.job_queue.run_once(on_turn_timeout, timeout, chat_id=chat_id, name=turn_name, data=token)
    if timeout > 45:
        context.job_queue.run_once(on_turn_reminder, timeout - 30, chat_id=chat_id, name=remind_name, data=token)


def _session_for_job(context: ContextTypes.DEFAULT_TYPE) -> Session | None:
    job = context.job
    session = manager_of(context).get(job.chat_id)
    if session is None or not session.game.running:
        return None
    if (id(session.game), session.game.turn_serial) != job.data:
        return None
    return session


async def on_turn_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    session = _session_for_job(context)
    if session is None:
        return
    text = texts.TURN_REMINDER.format(player=texts.mention(session.game.current_player), seconds=30)
    await send(context, session.game.chat_id, text)


async def on_turn_timeout(context: ContextTypes.DEFAULT_TYPE) -> None:
    session = _session_for_job(context)
    if session is None:
        return
    events = session.game.timeout()
    await announce(context, session, events)


# ---------------------------------------------------------------- командалар


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if is_group(update):
        session = manager_of(context).get(update.effective_chat.id)
        if session and not session.game.started:
            await do_begin(update, context)
            return
        await update.effective_message.reply_html(texts.WELCOME_GROUP)
        return
    if context.args and context.args[0] == "status":
        session = manager_of(context).for_user(update.effective_user.id)
        if session and session.game.started:
            player = session.game.get_player(update.effective_user.id)
            await update.effective_message.reply_html(texts.private_status(session.game, player))
        else:
            await update.effective_message.reply_html(texts.PRIVATE_NO_GAME)
        return
    await update.effective_message.reply_html(texts.WELCOME_PRIVATE)


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_html(texts.HELP.format(bot=context.bot.username))


async def cmd_rules(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_html(texts.RULES)


async def cmd_new(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    await create_game(context, update.effective_chat.id, update.effective_user)


async def create_game(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user: User) -> None:
    manager = manager_of(context)
    try:
        session = manager.create(chat_id, user.id, display_name(user))
    except GameError as exc:
        await reply_error(context, chat_id, user, exc)
        return
    await refresh_lobby(context, session)


async def cmd_join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    chat_id, user = update.effective_chat.id, update.effective_user
    error = await do_join(context, chat_id, user)
    if error:
        await reply_error(context, chat_id, user, error)


async def do_join(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user: User) -> GameError | str | None:
    manager = manager_of(context)
    session = manager.get(chat_id)
    if session is None:
        return "no_game"
    try:
        manager.join(session, user.id, display_name(user))
    except GameError as exc:
        return exc
    await refresh_lobby(context, session)
    return None


async def cmd_leave(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    chat_id, user = update.effective_chat.id, update.effective_user
    error = await do_leave(context, chat_id, user.id)
    if error:
        await reply_error(context, chat_id, user, error)


async def do_leave(
    context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int, reason: str = "leave"
) -> GameError | str | None:
    manager = manager_of(context)
    session = manager.get(chat_id)
    if session is None:
        return "no_game"
    game = session.game
    try:
        events = game.remove_player(user_id, reason)
    except GameError as exc:
        return exc
    if not game.started:
        manager.sync(session)
        if not game.players:
            await unpin_lobby(context, session)
            await close_lobby(context, session, texts.GAME_STOPPED_LOBBY)
        else:
            await refresh_lobby(context, session)
            if reason == "kicked":
                await send(context, chat_id, texts.events_text(events, game))
        return None
    await announce(context, session, events)
    return None


async def close_lobby(context: ContextTypes.DEFAULT_TYPE, session: Session, text: str) -> None:
    if session.lobby_message_id is None:
        await send(context, session.game.chat_id, text)
        return
    try:
        await context.bot.edit_message_text(
            text, chat_id=session.game.chat_id, message_id=session.lobby_message_id, parse_mode=ParseMode.HTML
        )
    except TelegramError:
        await send(context, session.game.chat_id, text)


async def cmd_begin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    await do_begin(update, context)


async def do_begin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id, user = update.effective_chat.id, update.effective_user
    error = await begin_game(context, chat_id, user.id)
    if error:
        await reply_error(context, chat_id, user, error)


async def begin_game(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int) -> GameError | str | None:
    session = manager_of(context).get(chat_id)
    if session is None:
        return "no_game"
    try:
        events = session.game.start(user_id)
    except GameError as exc:
        return exc
    await close_lobby(context, session, texts.lobby_closed_text(session.game))
    await announce(context, session, events)
    return None


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    session = manager_of(context).get(update.effective_chat.id)
    if session is None:
        await update.effective_message.reply_html(texts.error_text("no_game"))
        return
    game = session.game
    markup = turn_keyboard(game) if game.running else (lobby_keyboard(game) if not game.started else None)
    await send(context, game.chat_id, texts.status_text(game), markup)


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    chat_id, user = update.effective_chat.id, update.effective_user
    manager = manager_of(context)
    session = manager.get(chat_id)
    if session is None:
        await reply_error(context, chat_id, user, "no_game")
        return
    game = session.game
    if user.id != game.host_id and not await is_chat_admin(context, chat_id, user.id):
        await reply_error(context, chat_id, user, "admin_only")
        return
    cancel_turn_timer(context, chat_id)
    manager.delete(chat_id)
    await unpin_lobby(context, session)
    if not game.started:
        await close_lobby(context, session, texts.GAME_STOPPED_LOBBY)
        return
    if session.status_message_id is not None:
        try:
            await context.bot.edit_message_reply_markup(chat_id, session.status_message_id, reply_markup=None)
        except TelegramError:
            pass
    text = texts.GAME_STOPPED.format(who=texts.name_user(user))
    await send(context, chat_id, text, new_game_keyboard())


async def cmd_kick(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_group(update):
        await update.effective_message.reply_html(texts.NOT_GROUP_CMD)
        return
    chat_id, user = update.effective_chat.id, update.effective_user
    message = update.effective_message
    session = manager_of(context).get(chat_id)
    if session is None:
        await reply_error(context, chat_id, user, "no_game")
        return
    if user.id != session.game.host_id and not await is_chat_admin(context, chat_id, user.id):
        await reply_error(context, chat_id, user, "admin_only")
        return
    target = message.reply_to_message.from_user if message.reply_to_message else None
    if target is None or target.is_bot:
        await reply_error(context, chat_id, user, "kick_reply")
        return
    error = await do_leave(context, chat_id, target.id, reason="kicked")
    if error:
        await reply_error(context, chat_id, user, error)


async def cmd_setup_stickers(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    config = config_of(context)
    user = update.effective_user
    if config.admin_id is None or user.id != config.admin_id:
        await update.effective_message.reply_html(texts.STICKERS_ADMIN_ONLY)
        return
    await update.effective_message.reply_html(texts.STICKERS_START)
    try:
        names = await upload_sticker_sets(context.bot, user.id, stickers_of(context), config.sticker_prefix)
    except Exception as exc:  # noqa: BLE001 — қатені әкімшіге көрсетеміз
        log.exception("Стикерлерді жүктеу сәтсіз")
        await update.effective_message.reply_text(texts.STICKERS_FAIL.format(error=exc))
        return
    await update.effective_message.reply_text(
        texts.STICKERS_DONE.format(count=len(stickers_of(context).ids), links=set_links(names))
    )


# ------------------------------------------------------------------ батырмалар


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    data = query.data or ""
    chat_id = query.message.chat.id if query.message else None
    user = query.from_user
    if chat_id is None:
        await query.answer()
        return

    if data == "newgame":
        await query.answer()
        await create_game(context, chat_id, user)
        return

    session = manager_of(context).get(chat_id)
    if session is None:
        await query.answer(texts.error_text("no_game"), show_alert=True)
        return
    game = session.game

    if data.startswith("lobby:"):
        await on_lobby_button(context, query, session, data.split(":", 1)[1])
        return

    try:
        if data == "uno":
            events = game.press_uno(user.id)
            await query.answer(texts.DONE)
            await send(context, chat_id, texts.events_text(events, game))
            await update_status_keyboard(context, session)
            return
        if data.startswith("color:"):
            events = game.choose_color(user.id, Color(data.split(":", 1)[1]))
            await query.answer(texts.DONE)
            await announce(context, session, events)
            return
        if data.startswith("wd4:"):
            challenge = data == "wd4:challenge"
            pending = game.pending_wd4
            events = game.resolve_wd4(user.id, challenge)
            if challenge and pending is not None:
                offender = next((e["player"] for e in events if e.kind == "challenge"), None)
                offender_name = offender.name if offender else "—"
                await query.answer(texts.challenge_reveal(offender_name, pending.hand), show_alert=True)
            else:
                await query.answer(texts.DONE)
            await announce(context, session, events)
            return
    except GameError as exc:
        await query.answer(texts.error_text(exc), show_alert=True)
        return
    except ValueError:
        await query.answer()
        return
    await query.answer()


async def on_lobby_button(context: ContextTypes.DEFAULT_TYPE, query, session: Session, action: str) -> None:
    game = session.game
    chat_id, user = game.chat_id, query.from_user
    if action == "join":
        error = await do_join(context, chat_id, user)
        await query.answer(texts.error_text(error) if error else texts.JOINED_ALERT, show_alert=bool(error))
    elif action == "leave":
        error = await do_leave(context, chat_id, user.id)
        await query.answer(texts.error_text(error) if error else texts.LEFT_ALERT, show_alert=bool(error))
    elif action == "begin":
        error = await begin_game(context, chat_id, user.id)
        await query.answer(texts.error_text(error) if error else texts.STARTED_ALERT, show_alert=bool(error))
    else:
        await query.answer()


# ----------------------------------------------------------------- inline


async def on_inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.inline_query
    session = manager_of(context).for_user(query.from_user.id)
    game = session.game if session else None
    player = game.get_player(query.from_user.id) if game else None
    results, header = build_results(game, player, stickers_of(context))
    offset = int(query.offset) if query.offset.isdigit() else 0
    page = results[offset : offset + MAX_RESULTS]
    next_offset = str(offset + MAX_RESULTS) if offset + MAX_RESULTS < len(results) else ""
    button = InlineQueryResultsButton(header[:64], start_parameter="status") if header else None
    await query.answer(page, cache_time=0, is_personal=True, next_offset=next_offset, button=button)


async def on_chosen_result(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chosen = update.chosen_inline_result
    user = chosen.from_user
    session = manager_of(context).for_user(user.id)
    parsed = parse_result_id(chosen.result_id)
    if session is None or parsed is None:
        return
    game_id, action, arg = parsed
    game = session.game
    if action == "x":
        return
    if game_id != game.game_id:
        await reply_error(context, game.chat_id, user, "stale")
        return
    try:
        if action == "p":
            card_key, color = parse_play_arg(arg)
            events = game.play_card(user.id, card_key, color)
        elif action == "d":
            events = game.draw(user.id)
        elif action == "s":
            events = game.pass_turn(user.id)
        elif action == "u":
            # Чатта ойыншының «UNO!» стикері көрініп тұр — бот қосымша жазбайды.
            game.say_uno(user.id)
            await update_status_keyboard(context, session)
            return
        else:
            return
    except GameError as exc:
        await reply_error(context, game.chat_id, user, exc)
        return
    except ValueError:
        await reply_error(context, game.chat_id, user, "unknown_card")
        return
    await announce(context, session, events)


# --------------------------------------------------------- топқа қосылғанда


async def on_my_chat_member(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    change = update.my_chat_member
    if change is None or change.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        return
    was_member = change.old_chat_member.status in (ChatMember.MEMBER, ChatMember.ADMINISTRATOR, ChatMember.OWNER)
    is_member = change.new_chat_member.status in (ChatMember.MEMBER, ChatMember.ADMINISTRATOR)
    if is_member and not was_member:
        await send(context, change.chat.id, texts.WELCOME_GROUP)
    elif not is_member and was_member:
        cancel_turn_timer(context, change.chat.id)
        manager_of(context).delete(change.chat.id)


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.error("Өңделмеген қате", exc_info=context.error)


# ------------------------------------------------------------------- іске қосу


async def _auto_setup_stickers(app: Application) -> None:
    config: Config = app.bot_data["config"]
    registry: StickerRegistry = app.bot_data["stickers"]
    try:
        names = await upload_sticker_sets(app.bot, config.admin_id, registry, config.sticker_prefix)
        log.info("Стикерлер дайын (%d):\n%s", len(registry.ids), set_links(names))
    except Exception:  # noqa: BLE001
        log.exception(
            "Стикерлерді автоматты жүктеу сәтсіз. ADMIN_ID иесі ботқа жеке чатта /start, "
            "содан кейін /setup_stickers деп жазсын."
        )


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([BotCommand(cmd, desc) for cmd, desc in texts.COMMANDS])
    registry: StickerRegistry = app.bot_data["stickers"]
    registry.bind(app.bot.username)
    missing = registry.missing()
    config: Config = app.bot_data["config"]
    if not missing:
        log.info("Стикерлер жүктелген (%d)", len(registry.ids))
    elif config.admin_id:
        log.info("%d стикер жоқ — автоматты жүктеу басталды", len(missing))
        app.bot_data["sticker_task"] = asyncio.get_running_loop().create_task(_auto_setup_stickers(app))
    else:
        log.warning(
            "Стикерлер жүктелмеген: карталар мәтін түрінде көрсетіледі. ADMIN_ID орнатып, /setup_stickers жіберіңіз."
        )


def build_application(config: Config) -> Application:
    # Telegram топқа минутына ~20 хабарлама шектеуін қояды — сұраныстарды кезекке қоямыз.
    app = (
        Application.builder()
        .token(config.token)
        .rate_limiter(AIORateLimiter(max_retries=3))
        .post_init(post_init)
        .build()
    )
    app.bot_data["config"] = config
    app.bot_data["manager"] = GameManager()
    app.bot_data["stickers"] = StickerRegistry(config.stickers_file)

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("rules", cmd_rules))
    app.add_handler(CommandHandler("new", cmd_new))
    app.add_handler(CommandHandler("join", cmd_join))
    app.add_handler(CommandHandler("leave", cmd_leave))
    app.add_handler(CommandHandler("begin", cmd_begin))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(CommandHandler("kick", cmd_kick))
    app.add_handler(CommandHandler("setup_stickers", cmd_setup_stickers))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(InlineQueryHandler(on_inline_query))
    app.add_handler(ChosenInlineResultHandler(on_chosen_result))
    app.add_handler(ChatMemberHandler(on_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER))
    app.add_error_handler(on_error)
    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", force=True)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    config = load_config()
    app = build_application(config)
    log.info("UNO боты іске қосылды")
    app.run_polling(allowed_updates=Update.ALL_TYPES)
