"""Бот әкімшісінің (ADMIN_IDS) ойын баптаулары — тек ботпен жеке чатта.

/sleeplesson — 💋 Балым жалеп рөлін қосу, /sleeplessoff — өшіру (оның орнына тұрғын шығады).
Баптау дерекқорда сақталады және келесі ойыннан бастап қолданылады.
"""

from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.enums import ChatType
from aiogram.filters import Command
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
