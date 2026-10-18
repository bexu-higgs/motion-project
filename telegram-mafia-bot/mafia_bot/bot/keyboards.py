"""Telegram пернетақталары."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from ..controller import Keyboard
from ..economy import DIAMOND_PACKAGES, SHOP, format_kzt
from ..game.roles import PURCHASABLE_ROLES, Role, title
from . import texts


def main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t) for t in row] for row in texts.MENU_ROWS],
        resize_keyboard=True,
        is_persistent=True,
    )


def inline(keyboard: Keyboard | None) -> InlineKeyboardMarkup | None:
    if not keyboard:
        return None
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=b.text, callback_data=b.data, url=b.url) for b in row]
            for row in keyboard
        ]
    )


def shop() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"{i.emoji} {i.name} — {i.price_label}", callback_data=f"buy:{i.item.value}")]
        for i in SHOP.values()
    ]
    rows.append([InlineKeyboardButton(text=texts.BTN_DIAMONDS, callback_data="dia")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def diamond_packages() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(
            text=f"{format_kzt(p.diamonds)} 💎 — {format_kzt(p.price_kzt)} ₸ · {p.stars} ⭐",
            callback_data=f"pkg:{p.id}",
        )]
        for p in DIAMOND_PACKAGES
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def role_pick() -> InlineKeyboardMarkup:
    buttons = [
        InlineKeyboardButton(text=title(r), callback_data=f"rp:{r.value}") for r in PURCHASABLE_ROLES
    ]
    rows = [buttons[i:i + 2] for i in range(0, len(buttons), 2)]
    rows.append([InlineKeyboardButton(text="📋 Менің кезегім", callback_data="rq")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def role_queue(queue) -> InlineKeyboardMarkup | None:
    rows = [
        [InlineKeyboardButton(
            text=f"❌ {title(Role(q['role']))} — 💎 қайтару", callback_data=f"rr:{q['purchase_id']}"
        )]
        for q in queue
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


def rules() -> InlineKeyboardMarkup:
    buttons = [InlineKeyboardButton(text=v, callback_data=f"rules:{k}") for k, v in texts.RULE_PAGES.items()]
    return InlineKeyboardMarkup(inline_keyboard=[buttons[:3], buttons[3:]])


def url_button(text: str, url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=text, url=url)]])
