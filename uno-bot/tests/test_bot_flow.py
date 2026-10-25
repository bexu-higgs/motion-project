"""Telegram бөлігін желісіз тексеру: жалған бот арқылы толық ойын өткізу."""

import asyncio
import random
from datetime import datetime
from types import SimpleNamespace

import pytest
from telegram import (
    CallbackQuery,
    Chat,
    ChosenInlineResult,
    InlineQuery,
    InlineQueryResultArticle,
    InlineQueryResultCachedSticker,
    Message,
    Update,
    User,
)

from unobot import bot as botmod
from unobot.config import Config
from unobot.game import Phase
from unobot.manager import GameManager
from unobot.stickers import STICKER_SETS, StickerRegistry

CHAT_ID = -100123


class FakeBot:
    username = "uno_kz_bot"

    def __init__(self):
        self.sent = []
        self.edits = []
        self.stickers = []
        self.inline_answers = []
        self.callback_answers = []
        self._message_id = 100

    async def send_message(self, chat_id, text, **kwargs):
        self._message_id += 1
        self.sent.append(SimpleNamespace(chat_id=chat_id, text=text, markup=kwargs.get("reply_markup")))
        return SimpleNamespace(message_id=self._message_id)

    async def edit_message_text(self, text, chat_id=None, message_id=None, **kwargs):
        self.edits.append(SimpleNamespace(text=text, message_id=message_id, markup=kwargs.get("reply_markup")))

    async def edit_message_reply_markup(self, chat_id=None, message_id=None, reply_markup=None, **kwargs):
        self.edits.append(SimpleNamespace(text=None, message_id=message_id, markup=reply_markup))

    async def send_sticker(self, chat_id, sticker, **kwargs):
        self.stickers.append(sticker)

    async def get_chat_member(self, chat_id, user_id, **kwargs):
        return SimpleNamespace(status="member")

    async def answer_inline_query(self, inline_query_id, results, **kwargs):
        self.inline_answers.append(SimpleNamespace(results=list(results), button=kwargs.get("button")))

    async def answer_callback_query(self, callback_query_id, text=None, show_alert=None, **kwargs):
        self.callback_answers.append(SimpleNamespace(text=text, show_alert=show_alert))


def make_context(fake: FakeBot, registry: StickerRegistry, args=None):
    config = Config(token="x", admin_id=None, turn_timeout=0, stickers_file=registry.path, sticker_prefix="unokz")
    return SimpleNamespace(
        bot=fake,
        bot_data={"manager": GameManager(), "stickers": registry, "config": config},
        job_queue=None,
        args=args or [],
    )


USERS = [User(id=i, first_name=f"Ойыншы{i}", is_bot=False) for i in range(1, 5)]
CHAT = Chat(id=CHAT_ID, type="supergroup", title="UNO")


def command_update(fake, user, text):
    message = Message(message_id=1, date=datetime.now(), chat=CHAT, from_user=user, text=text)
    message.set_bot(fake)
    return Update(update_id=1, message=message)


def callback_update(fake, user, data):
    message = Message(message_id=5, date=datetime.now(), chat=CHAT, from_user=USERS[0], text="…")
    message.set_bot(fake)
    query = CallbackQuery(id="cb", from_user=user, chat_instance="ci", data=data, message=message)
    query.set_bot(fake)
    return Update(update_id=2, callback_query=query)


def inline_update(fake, user):
    query = InlineQuery(id="iq", from_user=user, query="", offset="")
    query.set_bot(fake)
    return Update(update_id=3, inline_query=query)


def chosen_update(user, result_id):
    return Update(update_id=4, chosen_inline_result=ChosenInlineResult(result_id=result_id, from_user=user, query=""))


def registry_with_stickers(tmp_path, filled: bool) -> StickerRegistry:
    registry = StickerRegistry(tmp_path / "stickers.json")
    if filled:
        registry.bot_username = FakeBot.username
        for keys in STICKER_SETS.values():
            for key in keys:
                registry.ids[key] = f"file-{key}"
    return registry


def choose_result(results, rng):
    ids = [r.id for r in results]
    plays = [i for i in ids if "|p|" in i]
    if plays and rng.random() < 0.9:
        return rng.choice(plays)
    for action in ("|s|", "|d|"):
        options = [i for i in ids if action in i]
        if options:
            return options[0]
    return None


@pytest.mark.parametrize("filled", [False, True])
@pytest.mark.parametrize("seed", range(4))
def test_full_game_through_telegram_layer(tmp_path, filled, seed):
    asyncio.run(_full_game(tmp_path, filled, seed))


async def _full_game(tmp_path, filled, seed):
    rng = random.Random(seed)
    fake = FakeBot()
    registry = registry_with_stickers(tmp_path, filled)
    context = make_context(fake, registry)
    players = USERS[: 2 + seed % 3]

    await botmod.cmd_new(command_update(fake, players[0], "/new"), context)
    assert "Жаңа UNO ойыны" in fake.sent[-1].text
    session = context.bot_data["manager"].get(CHAT_ID)
    session.game.rng = random.Random(seed)
    session.game.target_score = 0  # бір раунд — тест жылдам өтсін

    for user in players[1:]:
        await botmod.on_callback(callback_update(fake, user, "lobby:join"), context)
    assert len(session.game.players) == len(players)

    # Ойын иесі емес адам бастай алмайды
    await botmod.on_callback(callback_update(fake, players[1], "lobby:begin"), context)
    assert fake.callback_answers[-1].show_alert
    assert not session.game.started

    await botmod.on_callback(callback_update(fake, players[0], "lobby:begin"), context)
    game = session.game
    assert game.started
    assert any("1-раунд басталды" in m.text for m in fake.sent)
    if filled:
        assert fake.stickers, "бірінші картаның стикері жіберілуі керек"

    for _ in range(3000):
        if game.phase is Phase.FINISHED:
            break
        current = next(u for u in players if u.id == game.current_player.user_id)
        if game.phase is Phase.CHOOSE_COLOR:
            await botmod.on_callback(callback_update(fake, current, "color:green"), context)
            continue
        if game.phase is Phase.CHALLENGE:
            data = "wd4:challenge" if rng.random() < 0.5 else "wd4:accept"
            await botmod.on_callback(callback_update(fake, current, data), context)
            if data == "wd4:challenge":
                assert fake.callback_answers[-1].show_alert  # қол тек Challenge жасаған адамға көрсетіледі
            continue
        await botmod.on_inline_query(inline_update(fake, current), context)
        answer = fake.inline_answers[-1]
        expected_type = InlineQueryResultCachedSticker if filled else InlineQueryResultArticle
        assert all(isinstance(r, expected_type) for r in answer.results)
        assert answer.button is not None
        result_id = choose_result(answer.results, rng)
        assert result_id is not None
        if "|u|" in " ".join(r.id for r in answer.results) and rng.random() < 0.5:
            uno_id = next(r.id for r in answer.results if "|u|" in r.id)
            await botmod.on_chosen_result(chosen_update(current, uno_id), context)
        await botmod.on_chosen_result(chosen_update(current, result_id), context)
        if game.uno_vulnerable_id is not None and rng.random() < 0.5:
            catcher = rng.choice(players)
            await botmod.on_callback(callback_update(fake, catcher, "uno"), context)

    assert game.phase is Phase.FINISHED
    assert context.bot_data["manager"].get(CHAT_ID) is None
    assert "ойынды жеңді" in fake.sent[-1].text


def test_not_in_game_inline_and_wrong_turn(tmp_path):
    asyncio.run(_not_in_game(tmp_path))


async def _not_in_game(tmp_path):
    fake = FakeBot()
    context = make_context(fake, registry_with_stickers(tmp_path, True))
    await botmod.on_inline_query(inline_update(fake, USERS[3]), context)
    results = fake.inline_answers[-1].results
    assert len(results) == 1 and results[0].id == "nogame"

    await botmod.cmd_new(command_update(fake, USERS[0], "/new"), context)
    await botmod.cmd_join(command_update(fake, USERS[1], "/join"), context)
    session = context.bot_data["manager"].get(CHAT_ID)
    session.game.rng = random.Random(1)
    await botmod.cmd_begin(command_update(fake, USERS[0], "/begin"), context)
    game = session.game
    waiting = next(u for u in USERS[:2] if u.id != game.current_player.user_id)

    await botmod.on_inline_query(inline_update(fake, waiting), context)
    results = fake.inline_answers[-1].results
    # Кезегі емес ойыншыға барлық карта сұр болып көрсетіледі
    assert results and all("|x|" in r.id for r in results)
    assert all(r.sticker_file_id.startswith("file-grey_") for r in results)

    await botmod.on_chosen_result(chosen_update(waiting, f"{game.round_number}|d|"), context)
    assert "кезегіңіз емес" in fake.sent[-1].text

    await botmod.cmd_stop(command_update(fake, USERS[1], "/stop"), context)
    assert "ойын иесі немесе топ әкімшісі" in fake.sent[-1].text
    await botmod.cmd_stop(command_update(fake, USERS[0], "/stop"), context)
    assert context.bot_data["manager"].get(CHAT_ID) is None


def test_user_cannot_join_two_games(tmp_path):
    asyncio.run(_two_games(tmp_path))


async def _two_games(tmp_path):
    fake = FakeBot()
    context = make_context(fake, registry_with_stickers(tmp_path, False))
    await botmod.cmd_new(command_update(fake, USERS[0], "/new"), context)
    other_chat = Chat(id=-200, type="group", title="Басқа")
    message = Message(message_id=1, date=datetime.now(), chat=other_chat, from_user=USERS[0], text="/new")
    message.set_bot(fake)
    await botmod.cmd_new(Update(update_id=9, message=message), context)
    assert "басқа чаттағы ойынға" in fake.sent[-1].text


def test_turn_timeout_job(tmp_path):
    asyncio.run(_turn_timeout(tmp_path))


async def _turn_timeout(tmp_path):
    fake = FakeBot()
    context = make_context(fake, registry_with_stickers(tmp_path, False))
    await botmod.cmd_new(command_update(fake, USERS[0], "/new"), context)
    await botmod.cmd_join(command_update(fake, USERS[1], "/join"), context)
    session = context.bot_data["manager"].get(CHAT_ID)
    session.game.rng = random.Random(5)
    await botmod.cmd_begin(command_update(fake, USERS[0], "/begin"), context)
    game = session.game
    if game.phase is Phase.CHOOSE_COLOR:
        await botmod.on_callback(callback_update(fake, USERS[game.current_index], "color:red"), context)
    sleeper = game.current_player
    stale_token = (id(game), game.turn_serial - 1)

    context.job = SimpleNamespace(chat_id=CHAT_ID, data=stale_token)
    await botmod.on_turn_timeout(context)
    assert game.current_player is sleeper  # ескі таймер еленбейді

    context.job = SimpleNamespace(chat_id=CHAT_ID, data=(id(game), game.turn_serial))
    await botmod.on_turn_timeout(context)
    assert game.current_player is not sleeper
    assert sleeper.timeouts == 1
    assert any("уақытында жүрмеді" in m.text for m in fake.sent)
