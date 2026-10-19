"""💎 Алмаз беру: ойыншылар арасындағы сыйлық (/give) және бот авторының /getdiamonds командасы.

``lang`` — топта чат тілі, жеке чатта пайдаланушы тілі (оны ``EnsureUserMiddleware`` береді).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from aiogram import Bot, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from ...config import Settings
from ...controller import GameManager
from ...db.repo import Repo
from ...economy import MAX_DIAMOND_GIFT, MAX_DIAMOND_GRANT, format_kzt
from ...game.engine import mention
from ...i18n import t
from ..common import AdminCache, full_name

log = logging.getLogger(__name__)

router = Router(name="diamonds")


@dataclass(frozen=True)
class GiveArgs:
    amount: int | None
    username: str | None


def parse_give(args: str | None) -> GiveArgs:
    """``/give 5``, ``/give @nick 5``, ``/give 5 @nick`` — сан мен @username-ді табу."""
    amount: int | None = None
    username: str | None = None
    for token in (args or "").split():
        if token.startswith("@") and len(token) > 1 and username is None:
            username = token[1:]
        elif token.isdigit() and amount is None:
            amount = int(token)
    return GiveArgs(amount, username)


@dataclass(frozen=True)
class Target:
    user_id: int
    name: str
    username: str | None
    is_bot: bool = False


async def _resolve_target(message: Message, args: GiveArgs, repo: Repo) -> Target | str | None:
    """Алушы: жауап берілген хабардың авторы, атымен белгіленген адам немесе @username.

    Табылмаса — ``None``, @username белгісіз болса — сол username.
    """
    reply = message.reply_to_message
    if reply is not None and reply.forum_topic_created is None and reply.from_user is not None:
        user = reply.from_user
        is_bot = user.is_bot or reply.sender_chat is not None
        return Target(user.id, full_name(user), user.username, is_bot)
    for entity in message.entities or ():
        if entity.type == "text_mention" and entity.user is not None:
            user = entity.user
            return Target(user.id, full_name(user), user.username, user.is_bot)
    if args.username:
        row = await repo.find_by_username(args.username)
        if row is None:
            return args.username
        return Target(row["user_id"], row["full_name"] or row["username"], row["username"])
    return None


@router.message(Command("give"))
async def give(
    message: Message, command: CommandObject, bot: Bot, repo: Repo, manager: GameManager,
    settings: Settings, lang: str,
) -> None:
    """Өз шотыңыздан басқа ойыншыға алмаз сыйлау."""
    sender = message.from_user
    if sender is None or sender.is_bot or message.sender_chat is not None:
        return
    if message.chat.type != ChatType.PRIVATE:
        # Ойын кезінде топ тәртібі сақталады: бөгделер, өлгендер және түнде барлығы жаза алмайды.
        async def is_admin() -> bool:
            return sender.id in settings.admin_ids or await AdminCache.shared.is_admin(
                bot, message.chat.id, sender.id
            )

        if await manager.moderate(message.chat.id, sender.id, message.message_id, message.text, is_admin):
            return
    args = parse_give(command.args)
    target = await _resolve_target(message, args, repo)
    if target is None or (args.amount is None and not command.args):
        await message.reply(t(lang, "give.usage"))
        return
    if isinstance(target, str):
        await message.reply(t(lang, "give.unknown", name=f"@{target}"))
        return
    if args.amount is None or not 1 <= args.amount <= MAX_DIAMOND_GIFT:
        await message.reply(t(lang, "give.bad_amount", max=format_kzt(MAX_DIAMOND_GIFT)))
        return
    if target.is_bot:
        await message.reply(t(lang, "give.bot"))
        return
    if target.user_id == sender.id:
        await message.reply(t(lang, "give.self"))
        return
    result = await repo.transfer_diamonds(
        sender.id, target.user_id, args.amount, target.username, target.name
    )
    if not result.ok:
        await message.reply(t(lang, "give.no_funds", balance=result.balance))
        return
    giver = mention(sender.id, full_name(sender))
    receiver = mention(target.user_id, target.name)
    text = t(lang, "give.ok", giver=giver, receiver=receiver, n=args.amount)
    if message.chat.type == ChatType.PRIVATE:
        text += "\n" + t(lang, "give.left", balance=result.balance)
    await message.reply(text)
    try:
        await bot.send_message(
            target.user_id,
            t(result.receiver_lang, "give.dm", giver=giver, n=args.amount, balance=result.receiver_balance),
        )
    except TelegramAPIError:
        pass  # алушы ботпен жеке чатты әлі бастамаған


@router.message(Command("getdiamonds"))
async def get_diamonds(message: Message, command: CommandObject, repo: Repo, settings: Settings) -> None:
    """Бот авторы (ADMIN_IDS) өзіне тегін алмаз алады: бір командада ең көбі 999 999."""
    user = message.from_user
    if user is None or user.id not in settings.admin_ids:
        return
    raw = (command.args or "").strip().replace(" ", "")
    if not raw.isdigit() or not 1 <= int(raw) <= MAX_DIAMOND_GRANT:
        await message.reply(f"Қолданылуы: /getdiamonds &lt;сан&gt; (1-ден {format_kzt(MAX_DIAMOND_GRANT)}-ға дейін)")
        return
    amount = int(raw)
    await repo.ensure_user(user.id, user.username, full_name(user))
    balance = await repo.grant(user.id, "diamonds", amount, "admin_self")
    log.info("Әкімші %s өзіне %s алмаз алды", user.id, amount)
    await message.reply(
        f"💎 Сізге <b>{format_kzt(amount)} алмаз</b> қосылды. Жаңа баланс: <b>{format_kzt(balance)} 💎</b>"
    )
