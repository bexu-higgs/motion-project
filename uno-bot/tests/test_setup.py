import asyncio
import json
from types import SimpleNamespace

from telegram.error import InvalidToken
from test_stickers import FakeStickerBot

from unobot import setup as wizard_module
from unobot.setup import Wizard, is_yes, read_env, write_env


class FakeSetupBot(FakeStickerBot):
    """Баптау шеберіне арналған жалған бот (стикер жүктеуді FakeStickerBot береді)."""

    def __init__(self, token: str, inline_after: int = 1):
        super().__init__()
        self.token = token
        self.username = "uno_kz_bot"
        self.inline_checks = 0
        self.inline_after = inline_after
        self.sent = []
        self.dropped = False
        self.update_calls = 0

    async def initialize(self):
        if self.token == "bad":
            raise InvalidToken()

    async def shutdown(self):
        pass

    async def get_me(self):
        self.inline_checks += 1
        return SimpleNamespace(username=self.username, supports_inline_queries=self.inline_checks > self.inline_after)

    async def delete_webhook(self, drop_pending_updates=False, **kwargs):
        self.dropped = drop_pending_updates

    async def get_updates(self, offset=None, timeout=None, allowed_updates=None, **kwargs):
        self.update_calls += 1
        if self.update_calls == 1:
            return ()  # әзірге ешкім жазбады
        if self.update_calls == 2:
            group = SimpleNamespace(
                update_id=10,
                message=SimpleNamespace(
                    chat=SimpleNamespace(type="group"),
                    from_user=SimpleNamespace(id=5, full_name="Басқа", is_bot=False),
                ),
            )
            private = SimpleNamespace(
                update_id=11,
                message=SimpleNamespace(
                    chat=SimpleNamespace(type="private"),
                    from_user=SimpleNamespace(id=42, full_name="Аза", is_bot=False),
                ),
            )
            return (group, private)
        return ()

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


def scripted(answers):
    answers = list(answers)
    asked = []

    def ask(prompt):
        asked.append(prompt)
        return answers.pop(0)

    return ask, asked


def test_is_yes():
    assert is_yes("")
    assert is_yes("иә")
    assert is_yes("Y")
    assert not is_yes("жоқ")
    assert not is_yes("", default=False)


def test_env_roundtrip(tmp_path):
    path = tmp_path / ".env"
    write_env(path, {"BOT_TOKEN": "1:abc", "ADMIN_ID": "42", "TURN_TIMEOUT": "60", "STICKER_PREFIX": "unokz"})
    assert read_env(path) == {"BOT_TOKEN": "1:abc", "ADMIN_ID": "42", "TURN_TIMEOUT": "60", "STICKER_PREFIX": "unokz"}
    assert "# @BotFather" in path.read_text(encoding="utf-8")


def test_full_wizard(tmp_path, monkeypatch):
    monkeypatch.setattr(wizard_module, "ROOT", tmp_path)
    monkeypatch.setattr("unobot.stickers.asyncio.sleep", _no_sleep)
    bots = []

    def make_bot(token):
        bots.append(FakeSetupBot(token))
        return bots[-1]

    ask, asked = scripted(
        [
            "bad",  # қате токен
            "123:good",  # дұрыс токен
            "",  # /setinline қосылды → Enter
            "",  # /setinlinefeedback → Enter
            "abc",  # жүріс уақыты: сан емес
            "60",
            "",  # ботты қазір іске қосу → иә
        ]
    )
    output = []
    env_path = tmp_path / ".env"
    wizard = Wizard(ask=ask, out=output.append, make_bot=make_bot, env_path=env_path)
    start_now = asyncio.run(wizard.run())

    assert start_now is True
    bot = bots[-1]
    assert bot.dropped  # бұрынғы хабарламалар еленбейді
    assert bot.sent == [(42, "✅ Сіз UNO ботының әкімшісі ретінде тіркелдіңіз. Терминалға оралыңыз.")]
    assert read_env(env_path) == {"BOT_TOKEN": "123:good", "ADMIN_ID": "42", "TURN_TIMEOUT": "60"}
    text = "\n".join(output)
    assert "❌ Токен қате" in text
    assert "Inline режимі өшік" in text
    assert "Әкімші: Аза (ID 42)" in text
    assert "119 стикер дайын" in text
    assert (tmp_path / "data" / "stickers.json").exists()


def test_wizard_keeps_existing_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(wizard_module, "ROOT", tmp_path)
    env_path = tmp_path / ".env"
    write_env(env_path, {"BOT_TOKEN": "123:old", "ADMIN_ID": "7", "TURN_TIMEOUT": "45"})
    bots = []

    def make_bot(token):
        bots.append(FakeSetupBot(token, inline_after=0))
        return bots[-1]

    # Стикерлер бұрыннан жүктелген деп көрсетеміз
    stickers = tmp_path / "data" / "stickers.json"
    stickers.parent.mkdir()
    from unobot.stickers import STICKER_SETS

    keys = [key for keys in STICKER_SETS.values() for key in keys]
    stickers.write_text(json.dumps({"bot": "uno_kz_bot", "stickers": {k: "id" for k in keys}}), encoding="utf-8")
    ask, _ = scripted(["", "", "", "", "ж"])
    output = []
    start_now = asyncio.run(Wizard(ask=ask, out=output.append, make_bot=make_bot, env_path=env_path).run())
    assert start_now is False
    assert bots[-1].token == "123:old"
    assert bots[-1].update_calls == 0  # /start күтілмеді — бұрынғы әкімші қалды
    assert read_env(env_path) == {"BOT_TOKEN": "123:old", "ADMIN_ID": "7", "TURN_TIMEOUT": "45"}
    assert "Стикерлер бұрыннан жүктелген" in "\n".join(output)


async def _no_sleep(*args, **kwargs):
    return None
