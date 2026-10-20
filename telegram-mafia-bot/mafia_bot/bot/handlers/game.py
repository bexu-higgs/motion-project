"""Ойын ішіндегі батырмалар (түнгі әрекет, дауыс беру, Сиқыршы) және команда чаты."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.types import CallbackQuery, Message

from ...controller import GameManager
from ...i18n import t
from .. import keyboards

router = Router(name="game")
router.callback_query.filter(F.message.chat.type == ChatType.PRIVATE)


async def _finish_prompt(callback: CallbackQuery, ok: bool, text: str) -> None:
    if not ok:
        await callback.answer(text[:200], show_alert=True)
        return
    await callback.answer()
    try:
        await callback.message.edit_text(f"{callback.message.html_text}\n\n{text}", reply_markup=None)
    except TelegramAPIError:
        await callback.message.answer(text)


@router.callback_query(F.data.regexp(r"^n:\d+:\d+:[a-z]{2}:\d+$"))
async def night_action(callback: CallbackQuery, manager: GameManager) -> None:
    _, gid, day, kind, target = callback.data.split(":")
    ok, text = await manager.night_action(callback.from_user.id, int(gid), int(day), kind, int(target))
    await _finish_prompt(callback, ok, text)


@router.callback_query(F.data.regexp(r"^m:\d+:\d+:([a-z]{2}|back)$"))
async def night_mode(callback: CallbackQuery, manager: GameManager) -> None:
    _, gid, day, kind = callback.data.split(":")
    text, keyboard = await manager.choose_mode(callback.from_user.id, int(gid), int(day), kind)
    if keyboard is None:
        await callback.answer(text, show_alert=True)
        return
    await callback.answer()
    try:
        await callback.message.edit_text(text, reply_markup=keyboards.inline(keyboard))
    except TelegramAPIError:
        pass


@router.callback_query(F.data.regexp(r"^aw:\d+:\d+$"))
async def stay_awake(callback: CallbackQuery, manager: GameManager) -> None:
    """Балым жалеп: батырма бірнеше рет басылады, санағы хабарламада емес, жалқы ескертуде көрінеді."""
    _, gid, day = callback.data.split(":")
    ok, text, done = await manager.stay_awake(callback.from_user.id, int(gid), int(day))
    if not ok or not done:
        await callback.answer(text[:200], show_alert=not ok)
        return
    await _finish_prompt(callback, True, text)


@router.callback_query(F.data.regexp(r"^v:\d+:\d+:\d+$"))
async def vote(callback: CallbackQuery, manager: GameManager) -> None:
    _, gid, day, target = callback.data.split(":")
    ok, text = await manager.vote(callback.from_user.id, int(gid), int(day), int(target))
    await _finish_prompt(callback, ok, text)


@router.callback_query(F.data.regexp(r"^w:\d+:\d+:[01]$"))
async def witch(callback: CallbackQuery, manager: GameManager) -> None:
    _, gid, day, punish = callback.data.split(":")
    ok, text = await manager.witch_decision(callback.from_user.id, int(gid), int(day), punish == "1")
    await _finish_prompt(callback, ok, text)


@router.callback_query(F.data.regexp(r"^kz:\d+:\d+:\d+$"))
async def kamikaze(callback: CallbackQuery, manager: GameManager) -> None:
    """Дарға асылған Камикадзе кімді өзімен бірге алып кететінін таңдады."""
    _, gid, day, target = callback.data.split(":")
    ok, text = await manager.kamikaze_choose(callback.from_user.id, int(gid), int(day), int(target))
    await _finish_prompt(callback, ok, text)


# Ең соңында тіркеледі: жеке чаттағы кез келген басқа мәтін.
fallback = Router(name="private_fallback")
fallback.message.filter(F.chat.type == ChatType.PRIVATE)


@fallback.message(F.text & ~F.text.startswith("/"))
async def private_text(message: Message, manager: GameManager, lang: str) -> None:
    if await manager.private_text(message.from_user.id, message.text):
        return
    await message.answer(t(lang, "menu_hint"), reply_markup=keyboards.main_menu(lang))
