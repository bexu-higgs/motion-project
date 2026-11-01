"""Telegram бөлігі: сілтемелерді қабылдау, YouTube сапа мәзірі, жүктеу прогресі және файл жіберу."""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from collections import Counter, OrderedDict
from contextlib import ExitStack
from dataclasses import dataclass

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaVideo,
    LinkPreviewOptions,
    Message,
    MessageEntity,
    Update,
)
from telegram.constants import ChatAction, ChatType, ParseMode
from telegram.error import BadRequest, TelegramError
from telegram.ext import (
    AIORateLimiter,
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from . import texts
from .config import Config, load_config
from .downloader import Downloader, DownloadFailed, Media, Probe, Result, ffmpeg_path, js_runtime
from .formats import Option
from .links import Link, Platform, find_links, has_any_url

log = logging.getLogger(__name__)

REQUEST_TTL = 6 * 3600  # YouTube мәзірі осынша секунд жарамды
MAX_REQUESTS = 1000
MAX_CACHE = 2000
PER_USER_JOBS = 2  # бір адамның қатар жүретін жүктеулері
PROGRESS_INTERVAL = 3.0  # прогресс хабарламасын жиі өзгертпеу үшін (секунд)
NO_PREVIEW = LinkPreviewOptions(is_disabled=True)


# ------------------------------------------------------------------ күй


@dataclass
class MenuRequest:
    probe: Probe
    link: Link
    created: float


@dataclass(frozen=True)
class CachedFile:
    """Бұрын жіберілген файл: қайта сұралса, Telegram-ға қайта жүктелмейді."""

    kind: str  # "video" | "audio" | "document"
    file_id: str
    title: str


@dataclass(frozen=True)
class Target:
    """Жауап қайда жіберіледі: чат, қай хабарламаға жауап, форумдағы тақырып."""

    chat_id: int
    reply_to: int | None = None
    thread_id: int | None = None

    def kwargs(self) -> dict:
        extra: dict = {}
        if self.reply_to:
            extra.update(reply_to_message_id=self.reply_to, allow_sending_without_reply=True)
        if self.thread_id:
            extra["message_thread_id"] = self.thread_id
        return extra


class State:
    def __init__(self, config: Config, downloader: Downloader):
        self.config = config
        self.downloader = downloader
        self.semaphore = asyncio.Semaphore(config.max_parallel)
        self.probe_semaphore = asyncio.Semaphore(config.max_parallel * 2)
        self.requests: OrderedDict[str, MenuRequest] = OrderedDict()
        self.active: set[tuple] = set()
        self.user_jobs: Counter[int] = Counter()
        self.file_cache: OrderedDict[tuple[str, str], CachedFile] = OrderedDict()

    @property
    def limit(self) -> str:
        return texts.limit_text(self.config.max_file_mb)

    def add_request(self, probe: Probe, link: Link) -> str:
        request_id = secrets.token_hex(4)
        self.requests[request_id] = MenuRequest(probe, link, time.monotonic())
        while len(self.requests) > MAX_REQUESTS:
            self.requests.popitem(last=False)
        return request_id

    def get_request(self, request_id: str) -> MenuRequest | None:
        request = self.requests.get(request_id)
        if request is None or time.monotonic() - request.created > REQUEST_TTL:
            self.requests.pop(request_id, None)
            return None
        return request

    def remember(self, key: tuple[str, str], cached: CachedFile) -> None:
        self.file_cache[key] = cached
        self.file_cache.move_to_end(key)
        while len(self.file_cache) > MAX_CACHE:
            self.file_cache.popitem(last=False)


def state_of(context: ContextTypes.DEFAULT_TYPE) -> State:
    return context.bot_data["state"]


def error_text(reason: str, limit: str) -> str:
    return texts.ERRORS.get(reason, texts.ERRORS["failed"]).format(limit=limit)


# ------------------------------------------------------------------ прогресс хабарламасы


class StatusMessage:
    """«Жүктелуде… 45%» хабарламасы: Telegram шектеуіне ұрынбас үшін сирек өзгертіледі."""

    def __init__(self, bot, chat_id: int, message_id: int, text: str):
        self.bot = bot
        self.chat_id = chat_id
        self.message_id = message_id
        self.text = text
        self.last_edit = 0.0
        self.progress_done = False  # жүктеу біткен соң кешіккен прогресс жаңартулары еленбейді
        self._lock = asyncio.Lock()

    async def set(self, text: str, force: bool = False, progress: bool = False) -> None:
        async with self._lock:  # өзгертулер ретімен жүреді: соңғы мәтін соңғы болып қалады
            now = time.monotonic()
            if progress and self.progress_done:
                return
            if text == self.text or (not force and now - self.last_edit < PROGRESS_INTERVAL):
                return
            self.text, self.last_edit = text, now
            try:
                await self.bot.edit_message_text(
                    text, chat_id=self.chat_id, message_id=self.message_id, parse_mode=ParseMode.HTML
                )
            except TelegramError as exc:  # «message is not modified» т.с.с. — маңызды емес
                log.debug("status edit failed: %s", exc)

    async def finish(self, text: str) -> None:
        self.progress_done = True
        await self.set(text, force=True)

    async def delete(self) -> None:
        try:
            await self.bot.delete_message(self.chat_id, self.message_id)
        except TelegramError:
            pass

    def thread_callback(self, loop: asyncio.AbstractEventLoop, label: str | None):
        """yt-dlp ағынынан шақырылатын функция (басқа thread)."""
        last = {"time": 0.0, "stage": ""}

        def callback(stage: str, fraction: float | None) -> None:
            now = time.monotonic()
            if stage == last["stage"] and now - last["time"] < PROGRESS_INTERVAL:
                return
            last.update(time=now, stage=stage)
            text = texts.progress_text(stage, fraction, label)
            asyncio.run_coroutine_threadsafe(self.set(text, force=True, progress=True), loop)

        return callback


# ------------------------------------------------------------------ командалар


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(texts.START, parse_mode=ParseMode.HTML, link_preview_options=NO_PREVIEW)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = texts.HELP.format(limit=state_of(context).limit)
    await update.effective_message.reply_text(text, parse_mode=ParseMode.HTML, link_preview_options=NO_PREVIEW)


# ------------------------------------------------------------------ хабарламалар


def entity_urls(message: Message) -> list[str]:
    """Мәтінге жасырылған сілтемелер (text_link)."""
    urls = []
    if message.text:
        urls += [e.url for e in message.parse_entities([MessageEntity.TEXT_LINK]) if e.url]
    if message.caption:
        urls += [e.url for e in message.parse_caption_entities([MessageEntity.TEXT_LINK]) if e.url]
    return urls


def target_of(message: Message) -> Target:
    thread_id = message.message_thread_id if getattr(message, "is_topic_message", False) else None
    return Target(message.chat_id, message.message_id, thread_id)


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None:
        return
    text = message.text or message.caption or ""
    links = find_links(text, entity_urls(message))
    private = update.effective_chat is not None and update.effective_chat.type == ChatType.PRIVATE
    if not links:
        if private:
            await message.reply_text(texts.UNSUPPORTED_LINK if has_any_url(text) else texts.NO_LINK)
        return
    user_id = update.effective_user.id if update.effective_user else message.chat_id
    for link in links:
        if link.platform == Platform.YOUTUBE:
            await send_menu(context, target_of(message), link)
        else:
            await run_job(context, target_of(message), user_id, link.url, "best", None, link.name)


# ------------------------------------------------------------------ YouTube мәзірі


def menu_keyboard(request_id: str, probe: Probe, max_bytes: int) -> InlineKeyboardMarkup:
    def button(option: Option) -> InlineKeyboardButton:
        label = texts.option_button(option.label, option.kind, option.size, option.fits(max_bytes))
        return InlineKeyboardButton(label, callback_data=f"d:{request_id}:{option.key}")

    videos = [button(o) for o in probe.video_options]
    rows = [videos[i : i + 2] for i in range(0, len(videos), 2)]
    if probe.audio_options:
        rows.append([button(o) for o in probe.audio_options])
    return InlineKeyboardMarkup(rows)


async def send_menu(context: ContextTypes.DEFAULT_TYPE, target: Target, link: Link) -> None:
    state = state_of(context)
    bot = context.bot
    status = await bot.send_message(target.chat_id, texts.CHECKING, **target.kwargs())
    try:
        async with state.probe_semaphore:
            probe = await asyncio.to_thread(state.downloader.probe, link.url)
    except DownloadFailed as exc:
        log.info("probe %s: %s", link.url, exc)
        await bot.edit_message_text(
            error_text(exc.reason, state.limit), chat_id=target.chat_id, message_id=status.message_id
        )
        return
    except Exception:
        log.exception("probe failed: %s", link.url)
        await bot.edit_message_text(
            error_text("failed", state.limit), chat_id=target.chat_id, message_id=status.message_id
        )
        return

    request_id = state.add_request(probe, link)
    max_bytes = state.config.max_bytes
    any_too_big = any(not o.fits(max_bytes) for o in probe.options)
    caption = texts.menu_caption(probe.title, probe.uploader, probe.duration, any_too_big, state.limit)
    keyboard = menu_keyboard(request_id, probe, max_bytes)
    sent = False
    if probe.thumbnail:
        try:
            await bot.send_photo(
                target.chat_id,
                probe.thumbnail,
                caption=caption,
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
                **target.kwargs(),
            )
            sent = True
        except TelegramError as exc:
            log.info("thumbnail rejected (%s), sending text menu", exc)
    if not sent:
        await bot.send_message(
            target.chat_id,
            caption,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
            link_preview_options=NO_PREVIEW,
            **target.kwargs(),
        )
    try:
        await bot.delete_message(target.chat_id, status.message_id)
    except TelegramError:
        pass


async def on_choice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    state = state_of(context)
    try:
        _, request_id, key = query.data.split(":", 2)
    except ValueError:
        await query.answer()
        return
    request = state.get_request(request_id)
    option = request.probe.option(key) if request else None
    if request is None or option is None:
        await query.answer(texts.EXPIRED, show_alert=True)
        return
    if not option.fits(state.config.max_bytes):
        await query.answer(texts.OPTION_TOO_BIG.format(limit=state.limit), show_alert=True)
        return
    message = query.message
    user_id = query.from_user.id
    chat_id = message.chat_id if message else user_id
    if (chat_id, request.probe.url, key) in state.active:
        await query.answer(texts.ALREADY_RUNNING)
        return
    if state.user_jobs[user_id] >= PER_USER_JOBS:
        await query.answer(texts.BUSY, show_alert=True)
        return
    await query.answer(texts.STARTED)
    target = target_of(message) if message else Target(chat_id)
    await run_job(context, target, user_id, request.probe.url, key, option.label or None, request.link.name)


# ------------------------------------------------------------------ жүктеу және жіберу


async def run_job(
    context: ContextTypes.DEFAULT_TYPE,
    target: Target,
    user_id: int,
    url: str,
    want: str,
    label: str | None,
    platform_name: str,
) -> None:
    state = state_of(context)
    bot = context.bot
    cache_key = (url, want)
    caption_source = (url, platform_name)

    cached = state.file_cache.get(cache_key)
    if cached and await send_cached(bot, target, cached, caption_source):
        return

    job_key = (target.chat_id, url, want)
    if job_key in state.active:
        return
    if state.user_jobs[user_id] >= PER_USER_JOBS:
        await bot.send_message(target.chat_id, texts.BUSY, **target.kwargs())
        return
    state.active.add(job_key)
    state.user_jobs[user_id] += 1
    try:
        await download_and_send(context, target, url, want, label, cache_key, caption_source)
    finally:
        state.active.discard(job_key)
        state.user_jobs[user_id] -= 1
        if state.user_jobs[user_id] <= 0:
            del state.user_jobs[user_id]


async def download_and_send(
    context: ContextTypes.DEFAULT_TYPE,
    target: Target,
    url: str,
    want: str,
    label: str | None,
    cache_key: tuple[str, str],
    caption_source: tuple[str, str],
) -> None:
    state = state_of(context)
    bot = context.bot
    first_text = texts.progress_text("queued" if state.semaphore.locked() else "download", None, label)
    status_message = await bot.send_message(target.chat_id, first_text, **target.kwargs())
    status = StatusMessage(bot, target.chat_id, status_message.message_id, first_text)
    try:
        async with state.semaphore:
            await status.set(texts.progress_text("download", None, label), force=True)
            callback = status.thread_callback(asyncio.get_running_loop(), label)
            result = await asyncio.to_thread(state.downloader.download, url, want, callback)
        try:
            await status.finish(texts.UPLOADING)
            await send_result(bot, state, target, result, cache_key, caption_source)
        finally:
            result.cleanup()
        await status.delete()
    except DownloadFailed as exc:
        log.info("download %s [%s]: %s", url, want, exc)
        await status.finish(error_text(exc.reason, state.limit))
    except TelegramError as exc:
        log.warning("upload %s [%s] failed: %s", url, want, exc)
        reason = "too_big" if "too large" in str(exc).lower() else "upload"
        await status.finish(error_text(reason, state.limit))
    except Exception:
        log.exception("download %s [%s] failed", url, want)
        await status.finish(error_text("failed", state.limit))


async def send_cached(bot, target: Target, cached: CachedFile, caption_source: tuple[str, str]) -> bool:
    caption = texts.media_caption(cached.title, *caption_source)
    send = {"video": bot.send_video, "audio": bot.send_audio, "document": bot.send_document}[cached.kind]
    try:
        await send(target.chat_id, cached.file_id, caption=caption, parse_mode=ParseMode.HTML, **target.kwargs())
    except TelegramError as exc:
        log.info("cached file_id failed (%s), downloading again", exc)
        return False
    return True


def _file_input(media_path, local_mode: bool, stack: ExitStack):
    """Жеке Bot API серверінде файл жолымен жіберіледі (жадқа оқылмайды), әйтпесе — жүктеледі."""
    return media_path if local_mode else stack.enter_context(open(media_path, "rb"))


async def send_result(
    bot, state: State, target: Target, result: Result, cache_key: tuple[str, str], caption_source: tuple[str, str]
) -> None:
    local = bool(state.config.bot_api_url)
    files = result.files
    caption = texts.media_caption(files[0].title, *caption_source)
    await _chat_action(bot, target, ChatAction.UPLOAD_DOCUMENT if files[0].kind == "audio" else ChatAction.UPLOAD_VIDEO)

    if len(files) > 1 and all(m.kind == "video" for m in files):
        try:
            await send_album(bot, target, files, caption, local)
        except TelegramError as exc:
            log.info("album failed (%s), sending one by one", exc)
            for index, media in enumerate(files):
                await send_one(bot, target, media, caption if index == 0 else None, local)
    else:
        message = await send_one(bot, target, files[0], caption, local)
        kind, file_id = sent_file(message)
        if file_id:
            state.remember(cache_key, CachedFile(kind, file_id, files[0].title))
    if result.skipped_large:
        await bot.send_message(
            target.chat_id, texts.SKIPPED_LARGE.format(count=result.skipped_large, limit=state.limit), **target.kwargs()
        )


async def send_one(bot, target: Target, media: Media, caption: str | None, local: bool) -> Message:
    with ExitStack() as stack:
        file = _file_input(media.path, local, stack)
        common = dict(caption=caption, parse_mode=ParseMode.HTML, **target.kwargs())
        if media.kind == "audio":
            thumb = _file_input(media.thumbnail, local, stack) if media.thumbnail else None
            return await bot.send_audio(
                target.chat_id,
                file,
                duration=media.duration,
                performer=media.performer,
                title=texts.shorten(media.title, 64) or None,
                thumbnail=thumb,
                filename=_filename(media),
                **common,
            )
        return await bot.send_video(
            target.chat_id,
            file,
            duration=media.duration,
            width=media.width,
            height=media.height,
            supports_streaming=True,
            filename=_filename(media),
            **common,
        )


async def send_album(bot, target: Target, files: list[Media], caption: str, local: bool) -> None:
    with ExitStack() as stack:
        items = [
            InputMediaVideo(
                _file_input(m.path, local, stack),
                caption=caption if i == 0 else None,
                parse_mode=ParseMode.HTML,
                width=m.width,
                height=m.height,
                duration=m.duration,
                supports_streaming=True,
            )
            for i, m in enumerate(files[:10])
        ]
        await bot.send_media_group(target.chat_id, items, **target.kwargs())


def sent_file(message: Message | None) -> tuple[str, str | None]:
    for kind in ("video", "audio", "document"):
        attachment = getattr(message, kind, None) if message else None
        if attachment is not None:
            return kind, attachment.file_id
    return "video", None


def _filename(media: Media) -> str:
    stem = "".join(ch for ch in texts.shorten(media.title, 60) if ch not in '\\/:*?"<>|').strip() or "video"
    return f"{stem}{media.path.suffix}"


async def _chat_action(bot, target: Target, action: str) -> None:
    try:
        await bot.send_chat_action(target.chat_id, action, message_thread_id=target.thread_id)
    except TelegramError:
        pass


# ------------------------------------------------------------------ іске қосу


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    if isinstance(context.error, BadRequest) and "not modified" in str(context.error):
        return
    log.error("unhandled error", exc_info=context.error)


async def post_init(app: Application) -> None:
    try:
        await app.bot.set_my_commands([BotCommand(c, d) for c, d in texts.BOT_COMMANDS])
    except TelegramError as exc:
        log.warning("set_my_commands failed: %s", exc)


def build_application(config: Config, downloader: Downloader | None = None) -> Application:
    builder = (
        Application.builder()
        .token(config.token)
        .concurrent_updates(True)
        .rate_limiter(AIORateLimiter(max_retries=2))
        .connect_timeout(30)
        .read_timeout(120)
        .write_timeout(600)
        .media_write_timeout(1800)
        .pool_timeout(60)
        .post_init(post_init)
    )
    if config.bot_api_url:
        builder = (
            builder.base_url(f"{config.bot_api_url}/bot")
            .base_file_url(f"{config.bot_api_url}/file/bot")
            .local_mode(True)
        )
    app = builder.build()
    downloader = downloader or Downloader(
        config.download_dir, config.max_bytes, cookies_file=config.cookies_file, proxy=config.proxy
    )
    app.bot_data["state"] = State(config, downloader)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CallbackQueryHandler(on_choice, pattern=r"^d:"))
    app.add_handler(MessageHandler((filters.TEXT & ~filters.COMMAND) | filters.CAPTION, on_message))
    app.add_error_handler(on_error)
    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", force=True)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    config = load_config()
    app = build_application(config)
    state: State = app.bot_data["state"]
    state.downloader.clean_work_dir()
    if not ffmpeg_path():
        log.warning("ffmpeg табылмады — YouTube-тың жоғары сапалары мен MP3 жұмыс істемейді")
    if not js_runtime():
        log.warning("deno/node табылмады — YouTube-та кейбір сапалар көрінбеуі мүмкін (pip install deno)")
    if config.cookies_file and not config.cookies_file.exists():
        log.warning("COOKIES_FILE табылмады: %s", config.cookies_file)
    log.info("Видео боты іске қосылды (файл шегі: %s)", state.limit)
    app.run_polling(allowed_updates=[Update.MESSAGE, Update.CALLBACK_QUERY])
