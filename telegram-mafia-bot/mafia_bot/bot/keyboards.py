"""Telegram пернетақталары."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from ..controller import Keyboard
from ..db.models import START_MODES, ChatSettings
from ..economy import DIAMOND_PACKAGES, DIAMOND_TO_TENGE, SHOP, format_kzt, role_price
from ..game.roles import Role, purchasable_roles, title
from ..i18n import LANG_NAMES, LANGS, t
from . import texts

REGISTRATION_CHOICES = (30, 60, 90, 120, 180, 300)


def main_menu(lang: str) -> ReplyKeyboardMarkup:
    # Тұрақты (is_persistent) емес: телефонның «артқа» батырмасымен жабылады, ал чаттағы
    # мәзір белгішесімен қайта ашылады.
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=label) for label in row] for row in texts.menu_rows(lang)],
        resize_keyboard=True,
        is_persistent=False,
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


def _button(text: str, data: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(text=text, callback_data=data)


def shop(lang: str) -> InlineKeyboardMarkup:
    rows = [
        [_button(f"{i.emoji} {i.name(lang)} — {i.price_label}", f"buy:{i.item.value}")]
        for i in SHOP.values()
    ]
    rows.append([_button(t(lang, "btn.diamonds"), "dia")])
    rows.append([_button(t(lang, "ex.shop_btn", rate=DIAMOND_TO_TENGE), "ex")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def diamond_packages() -> InlineKeyboardMarkup:
    rows = [
        [_button(f"{format_kzt(p.diamonds)} 💎 — {format_kzt(p.price_kzt)} ₸ · {p.stars} ⭐", f"pkg:{p.id}")]
        for p in DIAMOND_PACKAGES
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def role_pick(lang: str, admin: bool = False) -> InlineKeyboardMarkup:
    buttons = [
        _button(f"{title(r, lang)} · {role_price(r)} 💎", f"rp:{r.value}") for r in purchasable_roles(admin)
    ]
    rows = [buttons[i:i + 2] for i in range(0, len(buttons), 2)]
    rows.append([_button(t(lang, "rq.button"), "rq")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def role_queue(queue, lang: str) -> InlineKeyboardMarkup | None:
    rows = [
        [_button(t(lang, "rq.refund_btn", role=title(Role(q["role"]), lang)), f"rr:{q['purchase_id']}")]
        for q in queue
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


def rules(lang: str) -> InlineKeyboardMarkup:
    buttons = [_button(t(lang, f"rules.tab.{page}"), f"rules:{page}") for page in texts.RULE_PAGES]
    return InlineKeyboardMarkup(inline_keyboard=[buttons[:3], buttons[3:]])


def languages(prefix: str, current: str) -> list[list[InlineKeyboardButton]]:
    buttons = [
        _button(("✅ " if code == current else "") + LANG_NAMES[code], f"{prefix}{code}") for code in LANGS
    ]
    return [buttons[i:i + 2] for i in range(0, len(buttons), 2)]


def user_languages(current: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=languages("ulang:", current))


def chat_settings(cfg: ChatSettings, registration_seconds: int) -> InlineKeyboardMarkup:
    lang = cfg.lang
    reg = [
        _button(("✅ " if s == registration_seconds else "") + t(lang, "settings.sec", n=s), f"cfg:reg:{s}")
        for s in REGISTRATION_CHOICES
    ]
    start = [
        _button(("✅ " if m == cfg.start_mode else "") + t(lang, f"settings.start.{m}"), f"cfg:start:{m}")
        for m in START_MODES
    ]
    rows = [reg[:3], reg[3:], start, *languages("cfg:lang:", lang)]
    rows.append([_button(t(lang, "settings.close_btn"), "cfg:close")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def url_button(text: str, url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=text, url=url)]])
