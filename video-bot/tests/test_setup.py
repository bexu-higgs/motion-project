import asyncio

from telegram.error import InvalidToken

from videobot.setup import Wizard, is_yes, read_env, write_env


class FakeSetupBot:
    def __init__(self, token):
        self.token = token
        self.username = "video_kz_bot"

    async def initialize(self):
        if self.token == "bad":
            raise InvalidToken()

    async def shutdown(self):
        pass


def make_wizard(tmp_path, answers, ffmpeg="/usr/bin/ffmpeg", js="deno"):
    answers = iter(answers)
    output = []
    wizard = Wizard(
        ask=lambda prompt: next(answers),
        out=output.append,
        make_bot=FakeSetupBot,
        env_path=tmp_path / ".env",
        find_ffmpeg=lambda: ffmpeg,
        find_js=lambda: js,
    )
    return wizard, output


def test_full_setup_writes_env(tmp_path):
    cookies = tmp_path / "cookies.txt"
    cookies.write_text("# Netscape HTTP Cookie File\n")
    wizard, output = make_wizard(tmp_path, ["bad", "123:good", str(tmp_path / "missing.txt"), str(cookies), "ж"])
    start_now = asyncio.run(wizard.run())
    assert start_now is False
    env = read_env(tmp_path / ".env")
    assert env == {"BOT_TOKEN": "123:good", "COOKIES_FILE": str(cookies), "MAX_FILE_MB": "50"}
    text = "\n".join(output)
    assert "Токен қате" in text and "Файл табылмады" in text and "@video_kz_bot" in text


def test_rerun_keeps_previous_answers_and_reports_missing_tools(tmp_path):
    write_env(tmp_path / ".env", {"BOT_TOKEN": "1:old", "COOKIES_FILE": "", "MAX_FILE_MB": "2000",
                                  "BOT_API_URL": "http://localhost:8081"})  # fmt: skip
    wizard, output = make_wizard(tmp_path, ["", "", ""], ffmpeg=None, js=None)
    assert asyncio.run(wizard.run()) is True
    env = read_env(tmp_path / ".env")
    assert env["BOT_TOKEN"] == "1:old" and env["MAX_FILE_MB"] == "2000"
    assert env["BOT_API_URL"] == "http://localhost:8081"
    text = "\n".join(output)
    assert "ffmpeg табылмады" in text and "deno табылмады" in text


def test_is_yes():
    assert is_yes("") and is_yes("иә") and is_yes("Y")
    assert not is_yes("ж") and not is_yes("жоқ")
