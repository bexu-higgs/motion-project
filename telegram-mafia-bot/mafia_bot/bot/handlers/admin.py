"""Бот әкімшісінің (ADMIN_IDS) ойын баптаулары — тек ботпен жеке чатта.

/sleeplesson — 💋 Балым жалеп рөлін қосу, /sleeplessoff — өшіру (оның орнына тұрғын шығады).
Баптау дерекқорда сақталады және келесі ойыннан бастап қолданылады.

/message <хат> — ``GETDIAMONDS_IDS`` тізіміндегі адамға бот арқылы «ADMIN: хат» болып жетеді.
"""

from __future__ import annotations

import html
import logging

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from ...config import Settings
from ...controller import GameManager
from ...db.repo import Repo
from ...game import balance
from ...game.roles import Role

log = logging.getLogger(__name__)

router = Router(name="admin")
router.message.filter(F.chat.type == ChatType.PRIVATE)

SLEEPLESS_FLAG = "sleepless"


@router.message(Command("sleeplesson", "sleeplessoff"))
async def toggle_sleepless(message: Message, repo: Repo, manager: GameManager, settings: Settings) -> None:
    user = message.from_user
    if user is None or user.id not in settings.admin_ids:
        return  # әкімші емес — жауап та жоқ
    enabled = message.text.split()[0].split("@")[0].lower() == "/sleeplesson"
    await repo.set_flag(SLEEPLESS_FLAG, enabled)
    manager.sleepless_enabled = enabled
    log.info("Әкімші %s Балым жалеп рөлін %s", user.id, "қосты" if enabled else "өшірді")
    if enabled:
        text = (f"💋 <b>Балым жалеп</b> рөлі қосылды: {balance.min_players_for(Role.SLEEPLESS)}+ ойыншыда "
                "әр ойында шығады.\nӨшіру: /sleeplessoff")
    else:
        text = "💋 <b>Балым жалеп</b> рөлі өшірілді: оның орнына тұрғын шығады.\nҚайта қосу: /sleeplesson"
    await message.answer(text + "\n<i>Жүріп жатқан ойындарға әсер етпейді — келесі ойыннан бастап.</i>")


@router.message(Command("message"))
async def message_to_grantee(message: Message, command: CommandObject, bot: Bot, settings: Settings) -> None:
    """Бот әкімшісі /getdiamonds рұқсаты бар адамға (GETDIAMONDS_IDS) бот арқылы хат жазады.

    ``/message <хат>`` — тізімдегі барлық адамға, ``/message <ID> <хат>`` — тек біреуіне.
    """
    user = message.from_user
    if user is None or user.id not in settings.admin_ids:
        return  # әкімші емес — жауап та жоқ
    recipients = sorted(settings.getdiamonds_ids)
    if not recipients:
        await message.answer("GETDIAMONDS_IDS тізімі бос: алдымен .env файлына адамның ID-ін жазыңыз.")
        return
    body = (command.args or "").strip()
    parts = body.split(maxsplit=1)
    if len(parts) == 2 and parts[0].isdigit():  # бірінші сөз тізімдегі ID болса — тек соған
        if int(parts[0]) in recipients:
            recipients, body = [int(parts[0])], parts[1]
        elif len(parts[0]) >= 5:  # ID-ге ұқсайды, бірақ тізімде жоқ
            await message.answer(f"ID {parts[0]} GETDIAMONDS_IDS тізімінде жоқ.")
            return
    if not body:
        usage = "Қолданылуы: /message &lt;хат&gt;"
        if len(recipients) > 1:
            usage += "\nТек біреуіне: /message &lt;ID&gt; &lt;хат&gt;"
        await message.answer(usage)
        return
    sent, failed = [], []
    for uid in recipients:
        try:
            await bot.send_message(uid, f"ADMIN: {html.escape(body)}")
        except TelegramAPIError as e:
            log.warning("Әкімшінің хаты %s-ге жетпеді: %s", uid, e)
            failed.append(uid)
        else:
            sent.append(uid)
    lines = []
    if sent:
        lines.append("✅ Хат жіберілді: " + ", ".join(f"<code>{uid}</code>" for uid in sent))
    if failed:
        lines.append("❌ Жетпеді: " + ", ".join(f"<code>{uid}</code>" for uid in failed)
                     + "\n<i>Ол ботпен жеке чатты бастамаған (START баспаған) немесе ботты бұғаттаған.</i>")
    await message.answer("\n".join(lines))
