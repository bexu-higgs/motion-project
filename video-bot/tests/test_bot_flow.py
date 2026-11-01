"""Telegram бөлігін желісіз тексеру: жалған бот пен жалған жүктеуші."""

import asyncio
import shutil
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from telegram import CallbackQuery, Chat, Message, MessageEntity, Update, User
from telegram.error import BadRequest

from videobot import bot as botmod
from videobot.config import Config
from videobot.downloader import DownloadFailed, Media, Probe, Result
from videobot.formats import Option

MB = 1024 * 1024
USER = User(id=7, first_name="Әлия", is_bot=False)
PRIVATE = Chat(id=7, type="private")
GROUP = Chat(id=-100500, type="supergroup", title="Топ")


class FakeBot:
    def __init__(self):
        self.calls = []
        self._id = 100

    def _next(self, **fields):
        self._id += 1
        return SimpleNamespace(message_id=self._id, **fields)

    def of(self, name):
        return [c for c in self.calls if c[0] == name]

    async def send_message(self, chat_id, text, **kwargs):
        self.calls.append(("send_message", chat_id, text, kwargs))
        return self._next()

    async def edit_message_text(self, text, chat_id=None, message_id=None, **kwargs):
        self.calls.append(("edit", chat_id, text, message_id))

    async def delete_message(self, chat_id, message_id, **kwargs):
        self.calls.append(("delete", chat_id, message_id))

    async def send_photo(self, chat_id, photo, **kwargs):
        if photo == "bad-thumb":
            raise BadRequest("Wrong file identifier/http url specified")
        self.calls.append(("send_photo", chat_id, photo, kwargs))
        return self._next()

    async def send_video(self, chat_id, video, **kwargs):
        data = video if isinstance(video, str) else video.read()
        self.calls.append(("send_video", chat_id, data, kwargs))
        return self._next(video=SimpleNamespace(file_id=f"vid-{self._id}"))

    async def send_audio(self, chat_id, audio, **kwargs):
        data = audio if isinstance(audio, str) else audio.read()
        self.calls.append(("send_audio", chat_id, data, kwargs))
        return self._next(audio=SimpleNamespace(file_id=f"aud-{self._id}"))

    async def send_document(self, chat_id, document, **kwargs):
        self.calls.append(("send_document", chat_id, document, kwargs))
        return self._next()

    async def send_media_group(self, chat_id, media, **kwargs):
        self.calls.append(("send_media_group", chat_id, [m.media.input_file_content for m in media], kwargs))
        return [self._next() for _ in media]

    async def send_chat_action(self, chat_id, action, **kwargs):
        self.calls.append(("action", chat_id, action))

    async def answer_callback_query(self, callback_query_id, text=None, show_alert=None, **kwargs):
        self.calls.append(("answer", text, bool(show_alert)))


PROBE = Probe(
    id="abc",
    title="Әдемі <ән>",
    url="https://www.youtube.com/watch?v=abc",
    uploader="Арна",
    duration=225,
    thumbnail="https://i.ytimg.com/vi/abc/maxresdefault.jpg",
    options=[
        Option("v2160", "video", "2160p", 2160, "315+140", 300 * MB),
        Option("v1080", "video", "1080p60", 1080, "299+140", 40 * MB),
        Option("v720", "video", "720p", 720, "136+140", 20 * MB),
        Option("mp3", "audio", "MP3", 0, "251", 5 * MB, "mp3"),
        Option("m4a", "audio", "M4A", 0, "140", 3 * MB, "m4a"),
    ],
)


class FakeDownloader:
    def __init__(self, tmp_path: Path):
        self.tmp_path = tmp_path
        self.downloads = []
        self.probes = []
        self.fail: DownloadFailed | None = None
        self.files = 1

    def probe(self, url):
        self.probes.append(url)
        if self.fail:
            raise self.fail
        return PROBE

    def download(self, url, want="best", progress=None):
        self.downloads.append((url, want))
        if self.fail:
            raise self.fail
        if progress:
            progress("download", 0.5)
            progress("process", None)
        directory = self.tmp_path / f"job{len(self.downloads)}"
        directory.mkdir()
        files = []
        for i in range(self.files):
            kind = "audio" if want in ("mp3", "m4a") else "video"
            path = directory / f"f{i}.{'mp3' if kind == 'audio' else 'mp4'}"
            path.write_bytes(b"data%d" % i)
            files.append(Media(path, kind, title="Видео атауы", duration=12, width=720, height=1280,
                               performer="Арна"))  # fmt: skip
        return Result(files=files, directory=directory)


def make_context(fake, downloader, **config):
    cfg = Config(token="x", **config)
    return SimpleNamespace(bot=fake, bot_data={"state": botmod.State(cfg, downloader)})


def message_update(fake, text, chat=PRIVATE, entities=None):
    message = Message(message_id=1, date=datetime.now(), chat=chat, from_user=USER, text=text, entities=entities)
    message.set_bot(fake)
    return Update(update_id=1, message=message)


def callback_update(fake, data, message_id=55):
    message = Message(message_id=message_id, date=datetime.now(), chat=PRIVATE, from_user=USER, text="мәзір")
    message.set_bot(fake)
    query = CallbackQuery(id="cb", from_user=USER, chat_instance="ci", data=data, message=message)
    query.set_bot(fake)
    return Update(update_id=2, callback_query=query)


@pytest.fixture
def setup(tmp_path):
    fake = FakeBot()
    downloader = FakeDownloader(tmp_path)
    return fake, downloader, make_context(fake, downloader)


def run(coro):
    return asyncio.run(coro)


def menu_buttons(call):
    return [b for row in call[3]["reply_markup"].inline_keyboard for b in row]


def test_youtube_link_shows_quality_menu(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "қара: https://youtu.be/abc"), context))
    assert downloader.probes == ["https://youtu.be/abc"]
    assert downloader.downloads == []  # YouTube бірден жүктелмейді — сапа сұралады
    [photo] = fake.of("send_photo")
    caption = photo[3]["caption"]
    assert "Әдемі &lt;ән&gt;" in caption and "⏱ 3:45" in caption and "Арна" in caption
    assert "🚫" in caption  # 2160p шекке сыймайды деген түсіндірме
    labels = [b.text for b in menu_buttons(photo)]
    assert labels == [
        "🚫 2160p · 300 МБ",
        "🎬 1080p60 · 40 МБ",
        "🎬 720p · 20 МБ",
        "🎧 MP3 · 5,0 МБ",
        "🎧 M4A · 3,0 МБ",
    ]
    assert fake.of("delete"), "«тексерілуде» хабарламасы өшірілуі керек"


def test_quality_button_downloads_and_sends_video(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "https://youtu.be/abc"), context))
    button = next(b for b in menu_buttons(fake.of("send_photo")[0]) if "720p" in b.text)
    run(botmod.on_choice(callback_update(fake, button.callback_data), context))
    assert downloader.downloads == [(PROBE.url, "v720")]
    [video] = fake.of("send_video")
    assert video[2] == b"data0"
    kwargs = video[3]
    assert kwargs["supports_streaming"] and (kwargs["width"], kwargs["height"]) == (720, 1280)
    assert kwargs["reply_to_message_id"] == 55
    assert "youtube.com/watch?v=abc" in kwargs["caption"]
    assert ("answer", "⏳ Жүктеу басталды", False) in fake.calls
    assert not list(downloader.tmp_path.glob("job*")), "уақытша файлдар өшірілуі керек"
    assert context.bot_data["state"].user_jobs == {}


def test_audio_button_sends_audio_and_cache_is_reused(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "https://youtu.be/abc"), context))
    mp3 = next(b for b in menu_buttons(fake.of("send_photo")[0]) if "MP3" in b.text)
    run(botmod.on_choice(callback_update(fake, mp3.callback_data), context))
    [audio] = fake.of("send_audio")
    assert audio[3]["performer"] == "Арна" and audio[3]["filename"].endswith(".mp3")
    cached = context.bot_data["state"].file_cache[(PROBE.url, "mp3")]
    run(botmod.on_choice(callback_update(fake, mp3.callback_data), context))
    assert len(downloader.downloads) == 1, "екінші рет file_id арқылы жіберіледі"
    assert fake.of("send_audio")[-1][2] == cached.file_id


def test_too_big_quality_is_refused_with_alert(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "https://youtu.be/abc"), context))
    big = next(b for b in menu_buttons(fake.of("send_photo")[0]) if "2160p" in b.text)
    run(botmod.on_choice(callback_update(fake, big.callback_data), context))
    assert downloader.downloads == []
    assert fake.calls[-1][0] == "answer" and fake.calls[-1][2] is True
    assert "50 МБ" in fake.calls[-1][1]


def test_expired_menu(setup):
    fake, downloader, context = setup
    run(botmod.on_choice(callback_update(fake, "d:deadbeef:v720"), context))
    assert fake.calls[-1] == ("answer", botmod.texts.EXPIRED, True)


def test_tiktok_link_downloads_best_immediately(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "https://vm.tiktok.com/ZMabc/"), context))
    assert downloader.probes == []
    assert downloader.downloads == [("https://vm.tiktok.com/ZMabc/", "best")]
    [video] = fake.of("send_video")
    assert "TikTok" in video[3]["caption"]
    edits = [c[2] for c in fake.of("edit")]
    assert any("50%" in e for e in edits) and botmod.texts.UPLOADING in edits


def test_instagram_carousel_is_sent_as_album(setup):
    fake, downloader, context = setup
    downloader.files = 3
    run(botmod.on_message(message_update(fake, "https://www.instagram.com/p/XYZ/"), context))
    [album] = fake.of("send_media_group")
    assert album[2] == [b"data0", b"data1", b"data2"]


def test_hidden_link_in_text_entity(setup):
    fake, downloader, context = setup
    entity = MessageEntity(type=MessageEntity.TEXT_LINK, offset=0, length=4, url="https://www.threads.com/@a/post/B1")
    run(botmod.on_message(message_update(fake, "мына", entities=[entity]), context))
    assert downloader.downloads == [("https://www.threads.com/@a/post/B1", "best")]


@pytest.mark.parametrize(
    "reason, expected",
    [("private", "жабық"), ("too_big", "50 МБ-тан"), ("bot_check", "cookies"), ("weird", "мүмкін болмады")],
)
def test_download_errors_are_explained(setup, reason, expected):
    fake, downloader, context = setup
    downloader.fail = DownloadFailed(reason)
    run(botmod.on_message(message_update(fake, "https://fb.watch/abc/"), context))
    assert expected in fake.of("edit")[-1][2]
    assert not fake.of("send_video")


def test_probe_error_is_explained(setup):
    fake, downloader, context = setup
    downloader.fail = DownloadFailed("playlist")
    run(botmod.on_message(message_update(fake, "https://www.youtube.com/playlist?list=PL1"), context))
    assert "плейлист" in fake.of("edit")[-1][2]
    assert not fake.of("send_photo")


def test_text_menu_when_thumbnail_rejected(setup, monkeypatch):
    fake, downloader, context = setup
    monkeypatch.setattr(PROBE, "thumbnail", "bad-thumb")
    run(botmod.on_message(message_update(fake, "https://youtu.be/abc"), context))
    menu = [c for c in fake.of("send_message") if c[3].get("reply_markup")]
    assert menu and "Сапасын таңдаңыз" in menu[0][2]


def test_private_chat_without_link_gets_hint_group_is_silent(setup):
    fake, downloader, context = setup
    run(botmod.on_message(message_update(fake, "сәлем"), context))
    run(botmod.on_message(message_update(fake, "https://example.com/v.mp4"), context))
    run(botmod.on_message(message_update(fake, "сәлем", chat=GROUP), context))
    texts_sent = [c[2] for c in fake.of("send_message")]
    assert texts_sent == [botmod.texts.NO_LINK, botmod.texts.UNSUPPORTED_LINK]


def test_local_bot_api_sends_file_path(setup, tmp_path):
    fake, downloader, _ = setup
    context = make_context(fake, downloader, bot_api_url="http://localhost:8081", max_file_mb=2000)
    sent = []

    async def send_video(chat_id, video, **kwargs):
        sent.append(video)
        return SimpleNamespace(message_id=1, video=SimpleNamespace(file_id="v"))

    fake.send_video = send_video
    run(botmod.on_message(message_update(fake, "https://www.tiktok.com/@a/video/1"), context))
    assert isinstance(sent[0], Path)  # жеке серверге файл жолы беріледі (жадқа оқылмайды)


def test_parallel_jobs_per_user_are_limited(setup):
    fake, downloader, context = setup
    state = context.bot_data["state"]
    state.user_jobs[USER.id] = botmod.PER_USER_JOBS
    run(botmod.on_message(message_update(fake, "https://vm.tiktok.com/ZMabc/"), context))
    assert downloader.downloads == []
    assert fake.of("send_message")[-1][2] == botmod.texts.BUSY


def test_help_mentions_limit(setup):
    fake, downloader, context = setup
    run(botmod.help_command(message_update(fake, "/help"), context))
    assert "50 МБ" in fake.of("send_message")[-1][2]


def test_cleanup_after_failed_upload(setup):
    fake, downloader, context = setup

    async def broken(*args, **kwargs):
        raise BadRequest("Request Entity Too Large")

    fake.send_video = broken
    run(botmod.on_message(message_update(fake, "https://vm.tiktok.com/ZMabc/"), context))
    assert "50 МБ" in fake.of("edit")[-1][2]
    assert not [p for p in downloader.tmp_path.glob("job*") if p.exists()]
    shutil.rmtree(downloader.tmp_path, ignore_errors=True)
