"""Алмаз сатып алу (Telegram Stars) және әкімші командалары."""

from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, LabeledPrice, Message, PreCheckoutQuery

from ...config import Settings
from ...db.repo import Repo
from ...economy import PACKAGES_BY_ID, DiamondPackage, format_kzt
from ..common import full_name

log = logging.getLogger(__name__)

router = Router(name="payments")
STARS = "XTR"
PAYLOAD_PREFIX = "dia:"


def package_from_payload(payload: str) -> DiamondPackage | None:
    if not payload.startswith(PAYLOAD_PREFIX):
        return None
    return PACKAGES_BY_ID.get(payload[len(PAYLOAD_PREFIX):])


@router.callback_query(F.data.startswith("pkg:"), F.message.chat.type == ChatType.PRIVATE)
async def send_invoice(callback: CallbackQuery, bot: Bot) -> None:
    package = PACKAGES_BY_ID.get(callback.data[4:])
    if package is None:
        await callback.answer("Белгісіз пакет.", show_alert=True)
        return
    await callback.answer()
    await bot.send_invoice(
        chat_id=callback.from_user.id,
        title=f"{format_kzt(package.diamonds)} 💎 алмаз",
        description=(
            f"Мафия ботындағы {format_kzt(package.diamonds)} алмаз "
            f"(≈ {format_kzt(package.price_kzt)} ₸). Төлем расталғаннан кейін бірден балансқа қосылады."
        ),
        payload=f"{PAYLOAD_PREFIX}{package.id}",
        currency=STARS,
        prices=[LabeledPrice(label=f"{package.diamonds} алмаз", amount=package.stars)],
    )


@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery) -> None:
    package = package_from_payload(query.invoice_payload)
    if package is None or query.currency != STARS or query.total_amount != package.stars:
        await query.answer(ok=False, error_message="Бұл пакет енді қолжетімсіз. Мәзірден қайта таңдаңыз.")
        return
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(message: Message, repo: Repo) -> None:
    payment = message.successful_payment
    package = package_from_payload(payment.invoice_payload)
    if package is None:
        log.error("Белгісіз төлем payload: %s", payment.invoice_payload)
        await message.answer("⚠️ Төлем қабылданды, бірақ пакет табылмады. /paysupport арқылы хабарласыңыз.")
        return
    user = message.from_user
    await repo.ensure_user(user.id, user.username, full_name(user))
    balance = await repo.record_payment(
        user_id=user.id,
        telegram_charge_id=payment.telegram_payment_charge_id,
        provider_charge_id=payment.provider_payment_charge_id,
        package_id=package.id,
        currency=payment.currency,
        total_amount=payment.total_amount,
    )
    if balance is None:
        await message.answer("ℹ️ Бұл төлем бұрын тіркелген, алмаз балансқа қосылып қойған.")
        return
    await message.answer(
        f"✅ Төлем расталды! +{format_kzt(package.diamonds)} 💎\nАлмаз балансыңыз: {balance} 💎"
    )


# --- Әкімші командалары -------------------------------------------------------------------------


def _is_bot_admin(message: Message, settings: Settings) -> bool:
    return message.from_user is not None and message.from_user.id in settings.admin_ids


@router.message(Command("refund"), F.chat.type == ChatType.PRIVATE)
async def refund(message: Message, command: CommandObject, bot: Bot, repo: Repo, settings: Settings) -> None:
    if not _is_bot_admin(message, settings):
        return
    charge_id = (command.args or "").strip()
    payment = await repo.get_payment(charge_id) if charge_id else None
    if payment is None or payment["status"] != "paid":
        await message.answer("Қолданылуы: /refund <telegram_payment_charge_id> (төлем табылмады не қайтарылған)")
        return
    try:
        await bot.refund_star_payment(payment["user_id"], charge_id)
    except TelegramAPIError as e:
        await message.answer(f"Telegram қайтаруды қабылдамады: {e.message}")
        return
    await repo.mark_refunded(charge_id)
    await message.answer(f"✅ Төлем қайтарылды, пайдаланушы {payment['user_id']}.")


@router.message(Command("give"), F.chat.type == ChatType.PRIVATE)
async def give(message: Message, command: CommandObject, repo: Repo, settings: Settings) -> None:
    if not _is_bot_admin(message, settings):
        return
    parts = (command.args or "").split()
    if len(parts) != 3 or parts[1] not in ("tenge", "diamonds") or not parts[0].lstrip("-").isdigit():
        await message.answer("Қолданылуы: /give <user_id> <tenge|diamonds> <сан>")
        return
    try:
        amount = int(parts[2])
    except ValueError:
        await message.answer("Сан дұрыс емес.")
        return
    balance = await repo.grant(int(parts[0]), parts[1], amount, f"admin:{message.from_user.id}")
    if balance is None:
        await message.answer("Пайдаланушы табылмады (ол ботты /start арқылы іске қосуы керек).")
        return
    await message.answer(f"✅ Жаңа баланс: {balance}")
