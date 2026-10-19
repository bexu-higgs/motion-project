"""💎 Алмаз беру: ойыншылар арасындағы сыйлық (/give), 🎁 тарату және бот авторының /getdiamonds командасы.

``lang`` — топта чат тілі, жеке чатта пайдаланушы тілі (оны ``EnsureUserMiddleware`` береді).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, User

from ...config import Settings
from ...controller import GameManager
from ...db.models import GiveawayView
from ...db.repo import Repo
from ...economy import GIVEAWAY_TTL_SECONDS, MAX_DIAMOND_GIFT, MAX_DIAMOND_GRANT, format_kzt
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
    if isinstance(target, str):
        await message.reply(t(lang, "give.unknown", name=f"@{target}"))
        return
    if args.amount is None:
        await message.reply(t(lang, "give.usage"))
        return
    if not 1 <= args.amount <= MAX_DIAMOND_GIFT:
        await message.reply(t(lang, "give.bad_amount", max=format_kzt(MAX_DIAMOND_GIFT)))
        return
    if target is None:
        # Топта алушысыз «/give 3» — 🎁 тарату: алғашқы 3 адам 1 💎-ден алады.
        if message.chat.type == ChatType.PRIVATE:
            await message.reply(t(lang, "give.usage"))
        else:
            await _start_giveaway(message, bot, repo, sender, args.amount, lang)
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


# --- 🎁 Алмаз тарату ---------------------------------------------------------------------------


def giveaway_text(v: GiveawayView, lang: str) -> str:
    giver = mention(v.giver_id, v.giver_name)
    if v.status == "expired":
        head = t(lang, "giveaway.expired", giver=giver, n=v.total, left=v.remaining)
    elif v.status == "done":
        head = t(lang, "giveaway.done", giver=giver, n=v.total)
    else:
        head = t(lang, "giveaway.open", giver=giver, n=v.total, left=v.remaining)
    lines = [head]
    if v.claimers:
        shown = [mention(uid, name) for uid, name in v.claimers[:30]]
        more = len(v.claimers) - len(shown)
        names = ", ".join(shown) + (f" +{more}" if more else "")
        lines += ["", t(lang, "giveaway.claimers", count=len(v.claimers), names=names)]
    return "\n".join(lines)


def giveaway_keyboard(v: GiveawayView, lang: str) -> InlineKeyboardMarkup | None:
    if v.status != "open":
        return None
    button = InlineKeyboardButton(text=t(lang, "giveaway.btn"), callback_data=f"ga:{v.giveaway_id}")
    return InlineKeyboardMarkup(inline_keyboard=[[button]])


async def _start_giveaway(message: Message, bot: Bot, repo: Repo, sender: User, amount: int, lang: str) -> None:
    giveaway_id, balance = await repo.create_giveaway(message.chat.id, sender.id, amount)
    if giveaway_id is None:
        await message.reply(t(lang, "give.no_funds", balance=balance))
        return
    view = await repo.giveaway_view(giveaway_id)
    # Хабар жіберілмей қалса, алмаз мерзімі біткенде иесіне қайтарылады.
    sent = await message.answer(giveaway_text(view, lang), reply_markup=giveaway_keyboard(view, lang))
    await repo.set_giveaway_message(giveaway_id, sent.message_id)


async def refresh_giveaway(bot: Bot, repo: Repo, giveaway_id: int) -> None:
    """Тарату хабарын базадағы күйге сай жаңарту."""
    v = await repo.giveaway_view(giveaway_id)
    if v is None or v.message_id is None:
        return
    lang = (await repo.get_chat_settings(v.chat_id)).lang
    try:
        await bot.edit_message_text(
            giveaway_text(v, lang), chat_id=v.chat_id, message_id=v.message_id,
            reply_markup=giveaway_keyboard(v, lang),
        )
    except TelegramAPIError:
        pass  # хабар өзгермеген не өшірілген


class GiveawayRefresher:
    """🎁 хабарын жаңарту. Қатар басылғандар бір өңдеуге жиналады (топта минутына ≈20 хабар шегі)."""

    def __init__(self, delay: float = 1.5) -> None:
        self.delay = delay
        self._tasks: dict[int, asyncio.Task] = {}
        self._dirty: set[int] = set()

    def schedule(self, bot: Bot, repo: Repo, giveaway_id: int) -> None:
        self._dirty.add(giveaway_id)
        task = self._tasks.get(giveaway_id)
        if task is None or task.done():
            self._tasks[giveaway_id] = asyncio.create_task(self._run(bot, repo, giveaway_id))

    async def _run(self, bot: Bot, repo: Repo, giveaway_id: int) -> None:
        try:
            while giveaway_id in self._dirty:
                await asyncio.sleep(self.delay)
                self._dirty.discard(giveaway_id)
                await refresh_giveaway(bot, repo, giveaway_id)
        except Exception:
            log.exception("Тарату хабарын жаңарту мүмкін болмады (giveaway_id=%s)", giveaway_id)
        finally:
            self._tasks.pop(giveaway_id, None)

    async def wait_idle(self) -> None:
        """Тесттер үшін: жоспарланған барлық жаңартулардың аяқталуын күту."""
        while self._tasks:
            await asyncio.gather(*list(self._tasks.values()), return_exceptions=True)


refresher = GiveawayRefresher()


@router.callback_query(F.data.regexp(r"^ga:\d+$"))
async def claim_giveaway(callback: CallbackQuery, bot: Bot, repo: Repo, lang: str) -> None:
    """«🎁 Сыйлықты ашу»: алғашқы басқандар 1 💎-ден алады."""
    user = callback.from_user
    giveaway_id = int(callback.data[3:])
    result = await repo.claim_giveaway(giveaway_id, user.id, user.username, full_name(user))
    if result.status == "ok":
        await callback.answer(t(lang, "giveaway.ok", balance=result.balance), show_alert=True)
    else:
        await callback.answer(t(lang, f"giveaway.{result.status}"), show_alert=True)
    if result.status in ("ok", "gone"):
        refresher.schedule(bot, repo, giveaway_id)


async def giveaway_sweeper(bot: Bot, repo: Repo, interval: float = 60) -> None:
    """Мерзімі өткен таратуларды жабу: алынбаған алмаз иесіне қайтарылады."""
    while True:
        try:
            for giveaway_id in await repo.expire_giveaways(GIVEAWAY_TTL_SECONDS):
                await refresh_giveaway(bot, repo, giveaway_id)
        except Exception:
            log.exception("Мерзімі өткен таратуларды жабу мүмкін болмады")
        await asyncio.sleep(interval)

