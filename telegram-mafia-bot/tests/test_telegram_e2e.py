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
from mafia_bot.game.roles import Role

DSN = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL көрсетілмеген")

BOT_ID = 4242
GROUP = -1009000
CHAT_ADMIN = 7  # топ иесі (бот әкімшісі емес)
TABLES = "giveaway_claims, giveaways, ledger, payments, role_purchases, game_players, games, chats, users"


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
            if method.user_id == CHAT_ADMIN:
                return t.ChatMemberOwner(user=user(CHAT_ADMIN), is_anonymous=False)
            return t.ChatMemberMember(user=user(method.user_id))
        if isinstance(method, m.GetChatAdministrators):
            return [t.ChatMemberOwner(user=user(CHAT_ADMIN), is_anonymous=False)]
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
            self.notifier, repo, registration_seconds=60, time_scale=0.004, lobby_edit_delay=0, confirm_edit_delay=0,
            rng_factory=lambda: random.Random(5),
        )
        self.dp = dispatcher(repo=repo, manager=self.manager, notifier=self.notifier, settings=settings)
        self.update_ids = itertools.count(1)
        self.msg_ids = itertools.count(1)

    async def text(self, from_id: int, chat_id: int, text: str, reply_to: t.Message | None = None):
        msg = t.Message(message_id=next(self.msg_ids), date=now(), chat=chat(chat_id),
                        from_user=user(from_id), text=text, reply_to_message=reply_to)
        await self.dp.feed_update(self.bot, t.Update(update_id=next(self.update_ids), message=msg))
        return msg

    async def click(self, from_id: int, message_id: int, data: str, chat_id: int | None = None):
        cb = t.CallbackQuery(
            id=str(next(self.update_ids)), from_user=user(from_id), chat_instance="ci", data=data,
            message=t.Message(message_id=message_id, date=now(), chat=chat(chat_id or from_id), text="prompt"),
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
    from mafia_bot.bot.common import AdminCache

    AdminCache.shared.clear()
    from mafia_bot.bot.handlers import diamonds

    diamonds.refresher.delay = 0  # тарату хабары бірден жаңарсын
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
            if call.chat_id < 0:
                # Топтағы 👍/👎 растау: әр тірі ойыншы кездейсоқ басады.
                confirm = [b for b in keyboard_buttons(call) if (b.callback_data or "").startswith("c:")]
                s = h.manager.sessions.get(call.chat_id)
                if confirm and s is not None and isinstance(call, m.SendMessage):
                    for uid in sorted(s.game.confirm_voters()):
                        await h.click(uid, 0, rng.choice(confirm).callback_data, chat_id=call.chat_id)
                continue
            if call.chat_id == 0:
                continue
            game_buttons = [b for b in keyboard_buttons(call)
                            if b.callback_data and b.callback_data[:2] in ("n:", "m:", "v:", "w:", "kz")]
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
    # Мәзір «артқа» батырмасымен жабылады және экранның жартысын алмайды (5 қатар).
    assert not welcome.reply_markup.is_persistent and welcome.reply_markup.resize_keyboard
    assert len(welcome.reply_markup.keyboard) == 5

    # Топта тіркелуді ашу.
    await h.text(1, GROUP, "/game")
    lobby_msg = next(c for c in tg.sent(GROUP) if "тіркелу ашық" in c.text)
    join_url = keyboard_buttons(lobby_msg)[0].url
    assert join_url.startswith("https://t.me/mafia_test_bot?start=join_")
    payload = join_url.split("start=")[1]

    for uid in range(1, 8):
        await h.text(uid, uid, f"/start {payload}")
        assert "тіркелдіңіз" in tg.sent(uid)[-1].text

    # «Барлығы» режимінде (әдепкі) бөгде адам да бастай алар еді — әкімші режимін қосамыз.
    await h.text(CHAT_ADMIN, GROUP, "/settingsmafiahiggs")
    settings_msg = tg.sent(GROUP)[-1]
    assert "Мафия баптаулары" in settings_msg.text
    datas = [b.callback_data for b in keyboard_buttons(settings_msg)]
    assert "cfg:start:admins" in datas and "cfg:lang:en" in datas and "cfg:reg:60" in datas
    await h.click(2, settings_msg.message_id if hasattr(settings_msg, "message_id") else 1,
                  "cfg:start:admins", chat_id=GROUP)
    denied = [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)][-1]
    assert denied.show_alert and "әкімшілері" in denied.text
    await h.click(CHAT_ADMIN, 1, "cfg:start:admins", chat_id=GROUP)
    assert (await h.repo.get_chat_settings(GROUP)).start_mode == "admins"
    await h.text(99, GROUP, "/startgame")
    assert "тек әкімшілер" in tg.sent(GROUP)[-1].text
    stop = asyncio.Event()
    player_task = asyncio.create_task(autoplay(h, random.Random(1), stop))
    await h.text(CHAT_ADMIN, GROUP, "/startgame")
    for _ in range(500):
        if GROUP in h.manager.sessions:
            break
        await asyncio.sleep(0.002)
    assert GROUP in h.manager.sessions
    s = h.manager.sessions[GROUP]

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
    # Ойын соңында әр ойыншыға профиль карточкасы (дерекқордан).
    for uid in range(1, 8):
        card = next(c.text for c in tg.sent(uid) if "🆔 ID:" in c.text)
        assert card.startswith(("Ойын аяқталды!", "Сіз жеңдіңіз!")) and f"<code>{uid}</code>" in card
    # 👍/👎 растау батырмалары топта басылды.
    group_text = "\n".join(c.text for c in tg.sent(GROUP))
    if "асылсын ба" in group_text:
        edits = [c.text for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == GROUP]
        assert any(t.startswith("Дауыс беру нәтижелері:") for t in edits)
        assert any(isinstance(c, m.AnswerCallbackQuery) and "Сіздің дауысыңыз" in (c.text or "") for c in tg.calls)
    # Өлгендердің шектеуі алынды.
    restricted = [c.user_id for c in tg.calls if isinstance(c, m.RestrictChatMember)
                  and c.permissions.can_send_messages is False]
    lifted = [c.user_id for c in tg.calls if isinstance(c, m.RestrictChatMember)
              and c.permissions.can_send_messages is True]
    assert set(restricted) <= set(lifted)  # ойын соңында үнсіздік алынады

    # Профиль статистиканы көрсетеді.
    await h.text(1, 1, "👤 Менің профилім")
    text = tg.sent(1)[-1].text
    assert "Ойындар: <b>1</b>" in text and "ID: <code>1</code>" in text


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
    assert "Қорғаныс</b> сатып алынды" in tg.sent(5)[-1].text

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
                   "🏆 Рейтинг", "❓ Көмек", "🎮 Ойынға қосылу", "🏠 Ойын бөлмесін ашу", "🌐 Тіл",
                   "/paysupport", "/terms", "/language", "кез келген мәтін"):
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
    await h.text(1, 1, "/grant 2 diamonds 5")
    assert "Жаңа баланс: 5" in h.tg.sent(1)[-1].text
    await h.text(3, 3, "/grant 2 diamonds 5")  # әкімші емес — жауап жоқ
    assert (await h.repo.get_user(2))["diamonds"] == 5


async def test_author_gets_free_diamonds(harness):
    h = harness
    tg = h.tg
    await h.text(1, 1, "/getdiamonds 1000000")  # шектен асады
    assert "Қолданылуы" in tg.sent(1)[-1].text
    await h.text(1, 1, "/getdiamonds 999999")
    assert "999 999 алмаз" in tg.sent(1)[-1].text
    await h.text(1, GROUP, "/getdiamonds 1")  # топта да жұмыс істейді
    assert (await h.repo.get_user(1))["diamonds"] == 1_000_000
    # Бот авторы емес (тіпті топ әкімшісі болса да) — ештеңе болмайды, жауап та жоқ.
    for uid in (3, CHAT_ADMIN):
        before = len(tg.sent())
        await h.text(uid, uid, "/getdiamonds 500")
        assert len(tg.sent()) == before
        assert (await h.repo.get_user(uid) or {"diamonds": 0})["diamonds"] == 0


async def test_players_gift_diamonds(harness):
    h = harness
    tg = h.tg
    await h.text(1, 1, "/getdiamonds 10")
    await h.text(5, 5, "/start")
    target_msg = await h.text(3, GROUP, "сәлем бәріне")

    # Хабарға жауап ретінде: 1-ойыншы 3-ойыншыға 3 алмаз береді.
    await h.text(1, GROUP, "/give 3", reply_to=target_msg)
    ok = tg.sent(GROUP)[-1]
    assert "сыйлады" in ok.text and "tg://user?id=1" in ok.text and "tg://user?id=3" in ok.text
    assert "Қалған" not in ok.text  # топта баланс жария етілмейді
    assert any("сізге <b>3 💎</b> сыйлады" in c.text for c in tg.sent(3))
    assert (await h.repo.get_user(1))["diamonds"] == 7
    assert (await h.repo.get_user(3))["diamonds"] == 3  # бұрын ботқа жазбаса да тіркелді

    # @username арқылы (ботқа белгілі ойыншы) және жеке чаттан.
    await h.text(1, 1, "/give @p5 2")
    assert "Қалған балансыңыз: <b>5 💎</b>" in tg.sent(1)[-1].text
    assert (await h.repo.get_user(5))["diamonds"] == 2

    # Қателер: белгісіз адам, жеткіліксіз алмаз, өзіне, ботқа, нөл, аргументсіз.
    await h.text(1, GROUP, "/give @nobody 1")
    assert "@nobody табылмады" in tg.sent(GROUP)[-1].text
    await h.text(1, GROUP, "/give 100", reply_to=target_msg)
    assert "жеткіліксіз" in tg.sent(GROUP)[-1].text
    own = await h.text(1, GROUP, "менің хабарым")
    await h.text(1, GROUP, "/give 1", reply_to=own)
    assert "Өзіңізге" in tg.sent(GROUP)[-1].text
    bot_msg = t.Message(message_id=1, date=now(), chat=chat(GROUP), text="бот",
                        from_user=t.User(id=BOT_ID, is_bot=True, first_name="Mafia"))
    await h.text(1, GROUP, "/give 1", reply_to=bot_msg)
    assert "Ботқа" in tg.sent(GROUP)[-1].text
    await h.text(1, GROUP, "/give 0", reply_to=target_msg)
    assert "1-ден 999 999-ға дейін" in tg.sent(GROUP)[-1].text
    await h.text(1, GROUP, "/give")
    assert "Алмаз сыйлау" in tg.sent(GROUP)[-1].text
    # Алмазы жоқ ойыншы бере алмайды.
    await h.text(4, GROUP, "/give 1", reply_to=target_msg)
    assert "жеткіліксіз" in tg.sent(GROUP)[-1].text
    assert (await h.repo.get_user(1))["diamonds"] == 5
    assert (await h.repo.get_user(3))["diamonds"] == 3


async def test_user_language_switch(harness):
    h = harness
    tg = h.tg
    await h.text(3, 3, "/start")
    await h.text(3, 3, "/language")
    langs = [b.callback_data for b in keyboard_buttons(tg.sent(3)[-1])]
    assert langs == ["ulang:kk", "ulang:en", "ulang:ru", "ulang:uz", "ulang:ky", "ulang:tr"]
    await h.click(3, 1, "ulang:en")
    reply = tg.sent(3)[-1]
    assert "Language changed" in reply.text
    labels = [b.text for row in reply.reply_markup.keyboard for b in row]
    assert "👤 My profile" in labels
    await h.text(3, 3, "👤 My profile")
    assert "Player profile" in tg.sent(3)[-1].text
    # Басқа тілдегі батырма да танылады
    await h.text(3, 3, "👤 Менің профилім")
    assert "Player profile" in tg.sent(3)[-1].text
    await h.click(3, 1, "ulang:ru")
    await h.text(3, 3, "/daily")
    assert "Бонус" in tg.sent(3)[-1].text


async def test_chat_language_and_registration_time(harness):
    h = harness
    tg = h.tg
    await h.text(CHAT_ADMIN, GROUP, "/settingsmafiahiggs")
    await h.click(CHAT_ADMIN, 1, "cfg:lang:tr", chat_id=GROUP)
    await h.click(CHAT_ADMIN, 1, "cfg:reg:30", chat_id=GROUP)
    edit = [c for c in tg.calls if isinstance(c, m.EditMessageText)][-1]
    assert "Mafya ayarları" in edit.text and "30 sn" in edit.text
    cfg = await h.repo.get_chat_settings(GROUP)
    assert cfg.lang == "tr" and cfg.registration_seconds == 30
    await h.text(4, GROUP, "/game")
    lobby = next(c for c in tg.sent(GROUP) if "mafya oyunu kaydı açık" in c.text)
    assert "başlamasına 30 saniye" in lobby.text or "başlamasına 29 saniye" in lobby.text
    await h.text(4, GROUP, "/stop")
    assert "yöneticileri" in tg.sent(GROUP)[-1].text  # әкімші емес — тоқтата алмайды
    await h.text(CHAT_ADMIN, GROUP, "/stop")
    assert not h.manager.busy(GROUP)


async def test_settings_only_for_admins(harness):
    h = harness
    await h.text(5, GROUP, "/settingsmafiahiggs")
    assert "әкімшілері" in h.tg.sent(GROUP)[-1].text


async def test_group_moderation(harness):
    h = harness
    tg = h.tg
    h.manager.time_scale = 50  # түн ұзақ болсын — ешкім әрекет жасамайды
    await h.text(CHAT_ADMIN, GROUP, "/game")
    payload = keyboard_buttons(next(c for c in tg.sent(GROUP) if "тіркелу ашық" in c.text))[0].url.split("start=")[1]
    for uid in range(1, 6):
        await h.text(uid, uid, f"/start {payload}")
    await h.text(CHAT_ADMIN, GROUP, "/startgame")
    for _ in range(500):
        if GROUP in h.manager.sessions:
            break
        await asyncio.sleep(0.002)
    s = h.manager.sessions[GROUP]
    assert s.game.phase.value == "night"
    # «Ботқа өту» / «Дауыс беру» батырмасы — жай сілтеме: START пен сәлемдесу хабары шықпайды.
    bot_urls = {b.url for c in tg.sent(GROUP) for b in keyboard_buttons(c) if b.url and "join_" not in b.url}
    assert bot_urls == {"https://t.me/mafia_test_bot"}
    before = sum("қош келдіңіз" in c.text for c in tg.sent(2))
    await h.text(2, 2, "/start menu")   # ескі хабарлардағы сілтеме — ойын кезінде үндемейміз
    assert sum("қош келдіңіз" in c.text for c in tg.sent(2)) == before
    await h.text(99, 99, "/start menu")  # ойында жоқ адамға — әдеттегі мәзір
    assert "қош келдіңіз" in tg.sent(99)[-1].text

    def deleted(msg):
        return any(isinstance(c, m.DeleteMessage) and c.message_id == msg.message_id for c in tg.calls)

    def mutes(uid):
        return [c for c in tg.calls if isinstance(c, m.RestrictChatMember) and c.user_id == uid
                and c.permissions.can_send_messages is False]

    # Түнде тірі ойыншы: хабары өшіріледі, үнсіз етілмейді.
    assert deleted(await h.text(2, GROUP, "мен тұрғынмын!")) and not mutes(2)
    # Ойынға қатыспайтын адам: өшіріледі және 2 минутқа үнсіз етіледі.
    assert deleted(await h.text(99, GROUP, "мен көрермен"))
    (mute,) = mutes(99)
    assert 100 <= (mute.until_date - now()).total_seconds() <= 125
    # Әкімші «!» белгісімен — өшірілмейді; белгісіз — өшіріледі (бірақ әкімші шектелмейді).
    assert not deleted(await h.text(CHAT_ADMIN, GROUP, "!ереже: түнде үндемейміз"))
    assert deleted(await h.text(CHAT_ADMIN, GROUP, "белгісіз хабар")) and not mutes(CHAT_ADMIN)
    # Түнде /give те топқа жазылмайды: хабар өшіріледі, алмаз берілмейді.
    assert deleted(await h.text(2, GROUP, "/give @p3 1")) and not tg.sent(GROUP)[-1].text.startswith("💎")
    # /leave: ойыншы шығады, рөлі топта ашылады.
    await h.text(4, GROUP, "/leave")
    assert "ойыннан шықты. Ол " in tg.sent(GROUP)[-2].text + tg.sent(GROUP)[-1].text
    # Өлген (ойыннан шыққан) ойыншы — өшіріліп, үнсіз етіледі.
    assert deleted(await h.text(4, GROUP, "мен әлі осындамын")) and mutes(4)
    # Ойын тоқтағанда үнсіздік алынады.
    await h.text(CHAT_ADMIN, GROUP, "/stop")
    lifted = {c.user_id for c in tg.calls if isinstance(c, m.RestrictChatMember)
              and c.permissions.can_send_messages is True}
    assert {99, 4} <= lifted


async def test_diamond_giveaway_first_three_get_one(harness):
    from mafia_bot.bot.handlers import diamonds

    h = harness
    tg = h.tg
    await h.text(1, 1, "/getdiamonds 5")
    await h.text(1, GROUP, "/give 3")
    msg = tg.sent(GROUP)[-1]
    assert "<b>3 алмазын</b> таратты" in msg.text and "tg://user?id=1" in msg.text
    (button,) = keyboard_buttons(msg)
    assert button.text == "🎁 Сыйлықты ашу" and button.callback_data.startswith("ga:")
    assert (await h.repo.get_user(1))["diamonds"] == 2  # 3 алмаз таратуға тоқтатылды

    def last_answer():
        return [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)][-1].text

    await h.click(1, 0, button.callback_data, chat_id=GROUP)
    assert "Өз сыйлығыңызды" in last_answer()
    for uid in (2, 3, 4):
        await h.click(uid, 0, button.callback_data, chat_id=GROUP)
        assert "Сіз 1 💎 алдыңыз" in last_answer()
    await h.click(5, 0, button.callback_data, chat_id=GROUP)
    assert "таусылды" in last_answer()
    await diamonds.refresher.wait_idle()
    final = [c for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == GROUP][-1]
    assert "түгел алынды" in final.text and final.reply_markup is None
    assert all(f"tg://user?id={uid}" in final.text for uid in (2, 3, 4))
    assert [(await h.repo.get_user(uid))["diamonds"] for uid in (2, 3, 4)] == [1, 1, 1]
    assert await h.repo.get_user(5) is None  # кешіккен адамға ештеңе берілмеді

    # Алмаз жетпесе — тарату ашылмайды; жеке чатта алушысыз /give — нұсқаулық.
    await h.text(1, GROUP, "/give 3")
    assert "жеткіліксіз" in tg.sent(GROUP)[-1].text
    await h.text(1, 1, "/give 2")
    assert "Алмаз сыйлау" in tg.sent(1)[-1].text
    assert (await h.repo.get_user(1))["diamonds"] == 2

    # Мерзімі біткен тарату: алынбаған алмаз иесіне қайтады, хабар жаңарады.
    await h.text(1, GROUP, "/give 2")
    await h.repo.pool.execute("UPDATE giveaways SET created_at = now() - interval '2 hours' WHERE status = 'open'")
    sweeper = asyncio.create_task(diamonds.giveaway_sweeper(h.bot, h.repo, interval=0.01))
    for _ in range(200):
        if (await h.repo.get_user(1))["diamonds"] == 2:
            break
        await asyncio.sleep(0.01)
    sweeper.cancel()
    assert (await h.repo.get_user(1))["diamonds"] == 2
    expired = [c for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == GROUP][-1]
    assert "мерзімі бітті" in expired.text and expired.reply_markup is None


async def test_top_mafia_and_settings_alias(harness):
    from mafia_bot.db.models import FinalRow

    h = harness
    tg = h.tg
    await h.text(5, GROUP, "/topmafia")
    assert "тек чат әкімшілеріне" in tg.sent(GROUP)[-1].text
    await h.text(CHAT_ADMIN, GROUP, "/topmafia")
    assert "Апта үздіктері" in tg.sent(GROUP)[-1].text and "ойын болған жоқ" in tg.sent(GROUP)[-1].text
    for uid in range(1, 5):
        await h.repo.ensure_user(uid, f"p{uid}", f"Ойыншы{uid}")
    gid = await h.repo.create_game(GROUP)
    await h.repo.start_game(gid, [(u, "civilian") for u in range(1, 5)])
    await h.repo.finalize_game(gid, "town", 2, [FinalRow(u, "civilian", True, u == 3, 20 * (u == 3)) for u in range(1, 5)])
    await h.text(CHAT_ADMIN, GROUP, "/topmafia")
    text = tg.sent(GROUP)[-1].text
    assert text.index("@p3") < text.index("@p1") and "🥇 @p3 — <b>1</b> жеңіс" in text
    await h.text(CHAT_ADMIN, GROUP, "/settingsmafia")
    assert "Мафия баптаулары" in tg.sent(GROUP)[-1].text


async def test_reloaddm_resets_all_diamonds_after_confirmation(harness):
    h = harness
    tg = h.tg
    await h.text(1, 1, "/getdiamonds 50")
    for uid in (2, 3):
        await h.text(uid, uid, "/start")
        await h.repo.grant(uid, "diamonds", 10, "test")
    await h.text(1, GROUP, "/give 5")                # ашық тарату (5 💎 тоқтатылған)
    giveaway_msg = tg.sent(GROUP)[-1]

    before = len(tg.sent())
    await h.text(2, 2, "/reloaddm")                  # бот авторы емес — жауап жоқ
    await h.text(CHAT_ADMIN, GROUP, "/reloaddm")     # топ әкімшісі де бот авторы емес
    assert len(tg.sent()) == before

    await h.text(1, 1, "/reloaddm")
    ask = tg.sent(1)[-1]
    assert "0-ге" in ask.text and "70 💎" in ask.text
    assert [b.callback_data for b in keyboard_buttons(ask)] == ["rdm:yes", "rdm:no"]

    def last_answer():
        return [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)][-1]

    await h.click(2, 0, "rdm:yes")                   # бөтен адам батырманы басса
    assert last_answer().show_alert and "бот авторына" in last_answer().text
    await h.click(1, 0, "rdm:no")
    assert (await h.repo.get_user(2))["diamonds"] == 10
    await h.click(1, 0, "rdm:yes")
    assert [(await h.repo.get_user(uid))["diamonds"] for uid in (1, 2, 3)] == [0, 0, 0]
    done = [c for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == 1][-1]
    assert "0-ге түсірілді" in done.text and "3 ойыншыдан барлығы 70 💎" in done.text
    closed = [c for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == GROUP][-1]
    assert "нөлдеді" in closed.text and closed.reply_markup is None
    await h.click(2, giveaway_msg.message_id if hasattr(giveaway_msg, "message_id") else 0,
                  keyboard_buttons(giveaway_msg)[0].callback_data, chat_id=GROUP)
    assert "таусылды" in last_answer().text and (await h.repo.get_user(2))["diamonds"] == 0


async def test_exchange_diamonds_for_tenge(harness):
    h = harness
    tg = h.tg
    await h.text(4, 4, "/start")
    await h.repo.grant(4, "diamonds", 7, "test")
    await h.text(4, 4, "/exchange 2")
    assert "<b>2 💎</b> → <b>500 ₸</b>" in tg.sent(4)[-1].text
    user = await h.repo.get_user(4)
    assert (user["diamonds"], user["tenge"]) == (5, 500)

    # Дүкендегі батырма → айырбас мәзірі → 1 💎.
    await h.text(4, 4, "🛍 Дүкен")
    shop = tg.sent(4)[-1]
    assert "1 💎 = 250 ₸" in shop.text and "ex" in [b.callback_data for b in keyboard_buttons(shop)]
    await h.click(4, 1, "ex")
    menu = tg.sent(4)[-1]
    assert [b.callback_data for b in keyboard_buttons(menu)] == ["ex:1", "ex:5"]
    await h.click(4, 1, "ex:1")
    user = await h.repo.get_user(4)
    assert (user["diamonds"], user["tenge"]) == (4, 750)
    await h.click(4, 1, "ex:5")                      # 4 алмаз ғана бар
    answer = [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)][-1]
    assert answer.show_alert and "жеткіліксіз" in answer.text
    await h.text(4, 4, "/exchange abc")
    assert "Қолданылуы" in tg.sent(4)[-1].text
    await h.text(4, 4, "/exchange")
    assert "Бағам: <b>1 💎 = 250 ₸</b>" in tg.sent(4)[-1].text
    assert (await h.repo.get_user(4))["diamonds"] == 4


async def test_sleepless_presses_through_telegram(harness):
    h = harness
    tg = h.tg
    h.manager.time_scale = 50
    h.manager.higgs_chance = 0
    await h.text(CHAT_ADMIN, GROUP, "/game")
    payload = keyboard_buttons(next(c for c in tg.sent(GROUP) if "тіркелу ашық" in c.text))[0].url.split("start=")[1]
    for uid in range(1, 8):
        await h.text(uid, uid, f"/start {payload}")
    await h.text(CHAT_ADMIN, GROUP, "/startgame")
    for _ in range(500):
        if GROUP in h.manager.sessions and h.manager.sessions[GROUP].prompts:
            break
        await asyncio.sleep(0.002)
    s = h.manager.sessions[GROUP]
    uid = s.game.with_role(Role.SLEEPLESS)[0].user_id
    prompt = next(c for c in tg.sent(uid) if keyboard_buttons(c))
    (button,) = keyboard_buttons(prompt)
    assert button.text == "Сору" and button.callback_data.startswith("aw:")

    def answers():
        return [c for c in tg.calls if isinstance(c, m.AnswerCallbackQuery)]

    await h.click(uid, 1, button.callback_data)
    assert answers()[-1].text == "Басылды: 1/10" and not answers()[-1].show_alert
    for _ in range(9):
        await h.click(uid, 1, button.callback_data)
    edit = [c for c in tg.calls if isinstance(c, m.EditMessageText) and c.chat_id == uid][-1]
    assert "аман қалдыңыз" in edit.text and edit.reply_markup is None
    assert s.game.awake[uid] == 10


async def test_group_commands_are_deleted_after_running(harness):
    h = harness
    tg = h.tg

    def deleted(msg):
        return any(isinstance(c, m.DeleteMessage) and c.chat_id == GROUP and c.message_id == msg.message_id
                   for c in tg.calls)

    game = await h.text(CHAT_ADMIN, GROUP, "/game")
    assert any("тіркелу ашық" in c.text for c in tg.sent(GROUP)) and deleted(game)
    for text in ("/extend", "/settingsmafia@mafia_test_bot", "/topmafia", "/rules", "/stop"):
        msg = await h.text(CHAT_ADMIN, GROUP, text)
        assert deleted(msg), text
    denied = await h.text(5, GROUP, "/settingsmafia")       # әкімші емес: жауап беріліп, команда өшіріледі
    answer = tg.sent(GROUP)[-1]
    assert "әкімшілері" in answer.text and deleted(denied)
    # Команда өшірілетіндіктен жауап reply емес, ал кімге арналғаны атымен көрсетіледі.
    assert answer.reply_parameters is None and answer.text.startswith('<a href="tg://user?id=5">')
    # Басқа боттың командасы, бөтен «/» хабар және қарапайым хабар өшірілмейді.
    for text in ("/game@other_bot", "/weather", "сәлем"):
        assert not deleted(await h.text(5, GROUP, text)), text
    # Жеке чатта команда өшірілмейді.
    private = await h.text(5, 5, "/start")
    assert not any(isinstance(c, m.DeleteMessage) and c.chat_id == 5 for c in tg.calls) and private

