"""aiogram хэндлерлерінің end-to-end тесті: Telegram API жалған сессиямен ауыстырылған.

Нақты PostgreSQL керек (TEST_DATABASE_URL).
"""

import asyncio
import itertools
import os
import random
from datetime import UTC, datetime

import pytest
from aiogram import Bot
from aiogram import methods as m
from aiogram import types as t
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession

from mafia_bot.config import Settings
from mafia_bot.economy import PACKAGES_BY_ID

DSN = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL көрсетілмеген")

BOT_ID = 4242
GROUP = -1009000
TABLES = "ledger, payments, role_purchases, game_players, games, chats, users"


def now():
    return datetime.now(UTC)


def user(uid: int) -> t.User:
    return t.User(id=uid, is_bot=False, first_name=f"Ойыншы{uid}", username=f"p{uid}")


def chat(chat_id: int) -> t.Chat:
    if chat_id > 0:
        return t.Chat(id=chat_id, type="private", first_name=f"Ойыншы{chat_id}")
    return t.Chat(id=chat_id, type="supergroup", title="Мафия тобы")


def bot_admin() -> t.ChatMemberAdministrator:
    return t.ChatMemberAdministrator(
        user=t.User(id=BOT_ID, is_bot=True, first_name="Mafia"),
        can_be_edited=False, is_anonymous=False, can_manage_chat=True,
        can_delete_messages=True, can_manage_video_chats=True,
        can_restrict_members=True, can_promote_members=False, can_change_info=False,
        can_invite_users=True, can_post_stories=False, can_edit_stories=False,
        can_delete_stories=False, can_send_welcome_messages=False,
    )


class FakeTelegram(BaseSession):
    """Bot API-дің жалған нұсқасы: сұрауларды жазып алып, ақылға қонымды жауап береді."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list = []
        self.ids = itertools.count(10_000)
        self.bot_is_admin = True

    async def make_request(self, bot, method, timeout=None):
        self.calls.append(method)
        if isinstance(method, m.GetMe):
            return t.User(id=BOT_ID, is_bot=True, first_name="Mafia", username="mafia_test_bot")
        if isinstance(method, (m.SendMessage, m.SendInvoice)):
            return t.Message(message_id=next(self.ids), date=now(), chat=chat(method.chat_id),
                             text=getattr(method, "text", None) or method.title)
        if isinstance(method, m.GetChatMember):
            if method.user_id == BOT_ID and self.bot_is_admin:
                return bot_admin()
            return t.ChatMemberMember(user=user(method.user_id))
        return True

    async def close(self):
        pass

    async def stream_content(self, *args, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def sent(self, chat_id=None, kind=m.SendMessage):
        return [c for c in self.calls if isinstance(c, kind) and (chat_id is None or c.chat_id == chat_id)]


_DISPATCHER = None


def dispatcher(**deps):
    """aiogram роутерлері бір диспетчерге ғана қосылады — оны бір рет құрып, тәуелділікті жаңартамыз."""
    global _DISPATCHER
    from mafia_bot.bot.app import EnsureUserMiddleware, build_dispatcher

    if _DISPATCHER is None:
        _DISPATCHER = build_dispatcher(**deps)
    _DISPATCHER.workflow_data.update(deps)
    for mw in _DISPATCHER.message.outer_middleware:
        if isinstance(mw, EnsureUserMiddleware):
            mw.cache.clear()  # әр тест бос базадан басталады
    return _DISPATCHER


class Harness:
    def __init__(self, repo, settings):
        from mafia_bot.bot.notifier import TelegramNotifier
        from mafia_bot.controller import GameManager

        self.tg = FakeTelegram()
        self.bot = Bot("4242:TEST", session=self.tg, default=DefaultBotProperties(parse_mode="HTML"))
        self.repo = repo
        self.notifier = TelegramNotifier(self.bot, "mafia_test_bot")
        self.manager = GameManager(
            self.notifier, repo, registration_seconds=60, time_scale=0.004, lobby_edit_delay=0,
            rng_factory=lambda: random.Random(5),
        )
        self.dp = dispatcher(repo=repo, manager=self.manager, notifier=self.notifier, settings=settings)
        self.update_ids = itertools.count(1)
        self.msg_ids = itertools.count(1)

    async def text(self, from_id: int, chat_id: int, text: str):
        msg = t.Message(message_id=next(self.msg_ids), date=now(), chat=chat(chat_id),
                        from_user=user(from_id), text=text)
        await self.dp.feed_update(self.bot, t.Update(update_id=next(self.update_ids), message=msg))
        return msg

    async def click(self, from_id: int, message_id: int, data: str):
        cb = t.CallbackQuery(
            id=str(next(self.update_ids)), from_user=user(from_id), chat_instance="ci", data=data,
            message=t.Message(message_id=message_id, date=now(), chat=chat(from_id), text="prompt"),
        )
        await self.dp.feed_update(self.bot, t.Update(update_id=next(self.update_ids), callback_query=cb))

    async def raw(self, **update):
        await self.dp.feed_update(self.bot, t.Update(update_id=next(self.update_ids), **update))


@pytest.fixture
async def harness():
    import asyncpg

    from mafia_bot.db.repo import Repo

    conn = await asyncpg.connect(DSN)
    await conn.execute(f"DROP TABLE IF EXISTS {TABLES} CASCADE")
    await conn.close()
    repo = await Repo.connect(DSN)
    settings = Settings(bot_token="x", database_url=DSN, admin_ids=frozenset({1}))
    h = Harness(repo, settings)
    yield h
    await h.manager.shutdown()
    await repo.close()


def keyboard_buttons(call):
    markup = getattr(call, "reply_markup", None)
    if not isinstance(markup, t.InlineKeyboardMarkup):
        return []
    return [b for row in markup.inline_keyboard for b in row]


async def autoplay(h: Harness, rng: random.Random, stop: asyncio.Event):
    """Жеке чатқа келген ойын батырмаларын кездейсоқ басу."""
    seen = 0
    while not stop.is_set():
        calls = h.tg.calls[seen:]
        seen += len(calls)
        for call in calls:
            if not isinstance(call, (m.SendMessage, m.EditMessageText)) or not isinstance(call.chat_id, int):
                continue
            if call.chat_id <= 0:
                continue
            game_buttons = [b for b in keyboard_buttons(call)
                            if b.callback_data and b.callback_data[:2] in ("n:", "m:", "v:", "w:")]
            if game_buttons:
                mid = call.message_id if isinstance(call, m.EditMessageText) else 0
                await h.click(call.chat_id, mid, rng.choice(game_buttons).callback_data)
        await asyncio.sleep(0.002)


async def test_full_game_through_telegram_handlers(harness):
    h = harness
    tg = h.tg
    # Бот топқа әкімші болып қосылды.
    await h.raw(my_chat_member=t.ChatMemberUpdated(
        chat=chat(GROUP), from_user=user(1), date=now(),
        old_chat_member=t.ChatMemberLeft(user=t.User(id=BOT_ID, is_bot=True, first_name="Mafia")),
        new_chat_member=bot_admin(),
    ))
    assert any("Рахмет" in c.text for c in tg.sent(GROUP))

    # Жеке чатта /start — басты мәзір.
    await h.text(1, 1, "/start")
    welcome = tg.sent(1)[-1]
    assert "қош келдіңіз" in welcome.text
    assert isinstance(welcome.reply_markup, t.ReplyKeyboardMarkup)

    # Топта тіркелуді ашу.
    await h.text(1, GROUP, "/game")
    lobby_msg = next(c for c in tg.sent(GROUP) if "тіркелу ашық" in c.text)
    join_url = keyboard_buttons(lobby_msg)[0].url
    assert join_url.startswith("https://t.me/mafia_test_bot?start=join_")
    payload = join_url.split("start=")[1]

    for uid in range(1, 8):
        await h.text(uid, uid, f"/start {payload}")
        assert "тіркелдіңіз" in tg.sent(uid)[-1].text

    # Бөгде адам ойынды бастай алмайды; ашқан адам бастай алады.
    await h.text(99, GROUP, "/startgame")
    assert "бастай алады" in tg.sent(GROUP)[-1].text
    stop = asyncio.Event()
    player_task = asyncio.create_task(autoplay(h, random.Random(1), stop))
    await h.text(1, GROUP, "/startgame")
    for _ in range(500):
        if GROUP in h.manager.sessions:
            break
        await asyncio.sleep(0.002)
    assert GROUP in h.manager.sessions
    s = h.manager.sessions[GROUP]

    # Түнде топқа жазылған хабарлама өшіріледі.
    if s.game.phase.value == "night":
        msg = await h.text(2, GROUP, "мен тұрғынмын!")
        assert any(isinstance(c, m.DeleteMessage) and c.message_id == msg.message_id for c in tg.calls)

    gid = s.game_id
    for _ in range(3000):
        if await h.repo.pool.fetchval("SELECT status FROM games WHERE game_id = $1", gid) == "finished":
            break
        await asyncio.sleep(0.01)
    for _ in range(500):
        if GROUP not in h.manager.sessions:
            break
        await asyncio.sleep(0.01)
    stop.set()
    await player_task
    assert await h.repo.pool.fetchval("SELECT status FROM games WHERE game_id = $1", gid) == "finished"
    # Рөлдер тек жеке чатта.
    assert all("Сіздің рөліңіз" not in c.text for c in tg.sent(GROUP))
    assert all(any("Сіздің рөліңіз" in c.text for c in tg.sent(uid)) for uid in range(1, 8))
    assert any("Ойын аяқталды" in c.text for c in tg.sent(GROUP))
    # Өлгендердің шектеуі алынды.
    restricted = [c.user_id for c in tg.calls if isinstance(c, m.RestrictChatMember)
                  and c.permissions.can_send_messages is False]
    lifted = [c.user_id for c in tg.calls if isinstance(c, m.RestrictChatMember)
              and c.permissions.can_send_messages is True]
    assert sorted(restricted) == sorted(lifted)

    # Профиль статистиканы көрсетеді.
    await h.text(1, 1, "👤 Менің профилім")
    text = tg.sent(1)[-1].text
    assert "Ойындар: 1" in text and "ID: <code>1</code>" in text


async def test_shop_daily_roles_and_payments(harness):
    h = harness
    tg = h.tg
    await h.text(5, 5, "/start")

    # Күнделікті сыйлық бір рет қана.
    await h.text(5, 5, "🎁 Күнделікті сыйлық")
    assert "+10 ₸" in tg.sent(5)[-1].text
    await h.text(5, 5, "🎁 Күнделікті сыйлық")
    assert "Келесі сыйлыққа дейін" in tg.sent(5)[-1].text

    # Ақша жетпесе — ескерту, жетсе — сатып алу.
    await h.click(5, 1, "buy:shields")
    answer = [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)][-1]
    assert answer.show_alert and "жеткіліксіз" in answer.text
    await h.repo.grant(5, "tenge", 200, "test")
    await h.click(5, 1, "buy:shields")
    assert "Қорғаныс сатып алынды" in tg.sent(5)[-1].text

    # Алмаз сатып алу: шот → pre_checkout → сәтті төлем (екі рет келсе де бір рет қосылады).
    await h.click(5, 1, "pkg:d40")
    invoice = tg.sent(5, m.SendInvoice)[-1]
    assert invoice.currency == "XTR" and invoice.prices[0].amount == PACKAGES_BY_ID["d40"].stars
    await h.raw(pre_checkout_query=t.PreCheckoutQuery(
        id="pcq1", from_user=user(5), currency="XTR", total_amount=invoice.prices[0].amount,
        invoice_payload=invoice.payload,
    ))
    pcq = [c for c in tg.calls if isinstance(c, m.AnswerPreCheckoutQuery)][-1]
    assert pcq.ok
    await h.raw(pre_checkout_query=t.PreCheckoutQuery(
        id="pcq2", from_user=user(5), currency="XTR", total_amount=1, invoice_payload=invoice.payload,
    ))
    assert not [c for c in tg.calls if isinstance(c, m.AnswerPreCheckoutQuery)][-1].ok
    for _ in range(2):
        await h.raw(message=t.Message(
            message_id=next(h.msg_ids), date=now(), chat=chat(5), from_user=user(5),
            successful_payment=t.SuccessfulPayment(
                currency="XTR", total_amount=invoice.prices[0].amount, invoice_payload=invoice.payload,
                telegram_payment_charge_id="tg-charge-77", provider_payment_charge_id="p-77",
            ),
        ))
    assert (await h.repo.get_user(5))["diamonds"] == 40
    assert "бұрын тіркелген" in tg.sent(5)[-1].text

    # Рөл сатып алу және қайтару.
    await h.click(5, 1, "rp:don")
    assert "сақталды" in tg.sent(5)[-1].text
    queue = await h.repo.role_queue(5)
    await h.click(5, 1, f"rr:{queue[0]['purchase_id']}")
    assert (await h.repo.get_user(5))["diamonds"] == 40

    # Мәзірдің басқа бөлімдері қатесіз жауап береді.
    for button in ("🛍 Дүкен", "💎 Алмаз сатып алу", "🎭 Рөл таңдау", "📜 Ережелер",
                   "🏆 Рейтинг", "❓ Көмек", "🎮 Ойынға қосылу", "🏠 Ойын бөлмесін ашу",
                   "/paysupport", "/terms", "кез келген мәтін"):
        before = len(tg.sent(5))
        await h.text(5, 5, button)
        assert len(tg.sent(5)) == before + 1, button
    for page in ("general", "roles", "night", "items", "balance"):
        await h.click(5, 1, f"rules:{page}")
    edits = [c for c in tg.calls if isinstance(c, m.EditMessageText)]
    assert len(edits) >= 5


async def test_group_requires_admin_rights(harness):
    h = harness
    h.tg.bot_is_admin = False
    await h.text(1, GROUP, "/game")
    assert "әкімші құқықтары керек" in h.tg.sent(GROUP)[-1].text
    assert not h.manager.busy(GROUP)


async def test_admin_commands(harness):
    h = harness
    await h.text(2, 2, "/start")
    await h.text(1, 1, "/give 2 diamonds 5")
    assert "Жаңа баланс: 5" in h.tg.sent(1)[-1].text
    await h.text(3, 3, "/give 2 diamonds 5")  # әкімші емес — жауап жоқ
    assert (await h.repo.get_user(2))["diamonds"] == 5
