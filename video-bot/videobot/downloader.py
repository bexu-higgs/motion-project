"""yt-dlp арқылы талдау және жүктеу.

Бұл модульдің функциялары блоктайды — бот оларды asyncio.to_thread арқылы шақырады.
Формат таңдауды yt-dlp-ға өз функциямызбен береміз (formats.select), сондықтан сайт бір рет қана
ашылады, ал сапа Telegram шегіне (50 МБ не 2000 МБ) сыятындай таңдалады.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import sysconfig
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import yt_dlp
from yt_dlp.utils import DownloadCancelled
from yt_dlp.utils import DownloadError as YtdlpError

from . import formats as fmt
from .formats import Option
from .threads import ThreadsIE

log = logging.getLogger(__name__)

MAX_ENTRIES = 10  # бір жазбадағы (карусельдегі) ең көп видео
MAX_ATTEMPTS = 3  # «ең жақсы сапа» шекке сыймаса, төменірек сапамен қайталау саны
VIDEO_REMUX = "mov>mp4/mkv>mp4/webm>mp4/flv>mp4"

# yt-dlp қатесінің мәтіні → себеп коды (texts.ERRORS кілттері). Рет маңызды.
ERROR_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("bot_check", ("not a bot", "confirm you’re not a bot")),
    ("age", ("confirm your age", "age-restricted", "age restricted", "inappropriate for some users")),
    ("private", ("private video", "video is private", "this account is private", "private account")),
    ("live", ("live event will begin", "premieres in", "this live event", "is_upcoming")),
    (
        "login",
        (
            "login required",
            "log in",
            "sign in",
            "--cookies",
            "rate-limit reached",
            "requested content is not available",
            "you need to log in",
        ),
    ),
    ("geo", ("available in your country", "geo restrict", "geo-restrict", "from your location")),
    ("unsupported", ("unsupported url",)),
    ("no_video", ("no video formats", "no video could be found", "there is no video", "no media found")),
    (
        "unavailable",
        (
            "video unavailable",
            "not available",
            "has been removed",
            "does not exist",
            "http error 404",
            "not found",
            "deleted",
            "unavailable",
        ),
    ),
    (
        "network",
        (
            "timed out",
            "timeout",
            "unable to download webpage",
            "connection",
            "network",
            "getaddrinfo",
            "name or service not known",
            "temporary failure",
        ),
    ),
]


def classify_error(message: str) -> str:
    text = (message or "").lower().replace("'", "’")
    for reason, needles in ERROR_PATTERNS:
        if any(needle.replace("'", "’") in text for needle in needles):
            return reason
    return "failed"


class DownloadFailed(Exception):
    """Пайдаланушыға түсіндірілетін қате: reason — texts.ERRORS кілті."""

    def __init__(self, reason: str, detail: str = "", size: int | None = None):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason
        self.detail = detail
        self.size = size


class _TooLarge(DownloadCancelled):
    """Жүктеуді тоқтату: файл шекке сыймайды (yt-dlp DownloadCancelled-ты ұстамай, сыртқа шығарады)."""

    def __init__(self, size: int | None, quality: int | None):
        super().__init__(f"file is too large: {size}")
        self.size = size
        self.quality = quality


# ------------------------------------------------------------------ құралдар


def ffmpeg_path() -> str | None:
    """Жүйедегі ffmpeg, болмаса imageio-ffmpeg пакетіндегі ffmpeg."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001 — пакет жоқ немесе бұл платформаға ffmpeg келмеген
        return None


def js_runtime() -> str | None:
    """YouTube үшін керек JavaScript ортасы (deno / node / bun)."""
    suffix = sysconfig.get_config_var("EXE") or ""
    for name in ("deno", "node", "bun"):
        if shutil.which(name) or (Path(sysconfig.get_path("scripts")) / f"{name}{suffix}").exists():
            return name
    return None


# ------------------------------------------------------------------ нәтижелер


@dataclass
class Probe:
    """YouTube видеосының қысқаша мәліметі және қолжетімді нұсқалары."""

    id: str
    title: str
    url: str
    uploader: str | None = None
    duration: int | None = None
    thumbnail: str | None = None
    options: list[Option] = field(default_factory=list)

    @property
    def video_options(self) -> list[Option]:
        return [o for o in self.options if o.kind == "video"]

    @property
    def audio_options(self) -> list[Option]:
        return [o for o in self.options if o.kind == "audio"]

    def option(self, key: str) -> Option | None:
        return next((o for o in self.options if o.key == key), None)


@dataclass
class Media:
    path: Path
    kind: str  # "video" | "audio"
    title: str = ""
    duration: int | None = None
    width: int | None = None
    height: int | None = None
    performer: str | None = None
    thumbnail: Path | None = None
    option: Option | None = None

    @property
    def size(self) -> int:
        return self.path.stat().st_size


@dataclass
class Result:
    files: list[Media]
    directory: Path
    skipped_large: int = 0  # карусельде шекке сыймай қалған видеолар

    def cleanup(self) -> None:
        shutil.rmtree(self.directory, ignore_errors=True)


ProgressCallback = Callable[[str, float | None], None]  # (кезең: "download" | "process", үлес 0..1)


class _Logger:
    def debug(self, msg: str) -> None:
        if not msg.startswith("[debug] "):
            log.debug(msg)

    def info(self, msg: str) -> None:
        log.debug(msg)

    def warning(self, msg: str) -> None:
        log.info(msg)

    def error(self, msg: str) -> None:
        log.warning(msg)


class _Progress:
    """yt-dlp прогресін жинайды және файл шектен асса, жүктеуді тоқтатады."""

    def __init__(self, limit: int, callback: ProgressCallback | None):
        self.limit = limit
        self.callback = callback
        self.option: Option | None = None
        self.done: dict[str, int] = {}

    def start(self, option: Option) -> None:
        self.option = option
        self.done = {}

    def hook(self, d: dict) -> None:
        name = str(d.get("filename") or d.get("tmpfilename") or "?")
        got = int(d.get("downloaded_bytes") or 0)
        if d.get("status") == "finished":
            self.done[name] = int(d.get("total_bytes") or got or self.done.get(name, 0))
            return
        if d.get("status") != "downloading":
            return
        self.done[name] = got
        others = sum(v for k, v in self.done.items() if k != name)
        exact_total = d.get("total_bytes")
        expected_now = others + max(got, int(exact_total or 0))
        if expected_now > self.limit:
            raise _TooLarge(expected_now, self.option.quality if self.option else None)
        expected = self.option.size if self.option and self.option.size else None
        total = exact_total or d.get("total_bytes_estimate")
        if expected:
            fraction = (others + got) / expected
        elif total:
            fraction = got / total
        else:
            fraction = None
        self.report("download", None if fraction is None else min(fraction, 0.99))

    def pp_hook(self, d: dict) -> None:
        if d.get("status") == "started" and d.get("postprocessor") in ("Merger", "ExtractAudio", "VideoRemuxer"):
            self.report("process", None)

    def report(self, stage: str, fraction: float | None) -> None:
        if self.callback is None:
            return
        try:
            self.callback(stage, fraction)
        except Exception:  # noqa: BLE001 — прогресті көрсету жүктеуді бұзбауы керек
            log.debug("progress callback failed", exc_info=True)


def _is_live(info: dict) -> bool:
    return bool(info.get("is_live")) or info.get("live_status") in ("is_live", "is_upcoming")


def _match_filter(info: dict, *, incomplete: bool = False) -> str | None:
    """yt-dlp жүктемей өткізіп жіберетін жазбалар: тікелей эфир және видеосы жоқ элемент."""
    if _is_live(info):
        return "live stream"
    if not incomplete and not info.get("url") and not info.get("requested_formats"):
        return "no media"  # карусельдегі сурет: таңдалатын формат жоқ
    return None


def pick_thumbnail(info: dict) -> str | None:
    """Telegram сілтеме арқылы JPEG-ті сенімді қабылдайды — webp-тен гөрі соны таңдаймыз."""
    thumbs = [t for t in info.get("thumbnails") or [] if t.get("url")]
    jpgs = [t for t in thumbs if t["url"].split("?")[0].lower().endswith((".jpg", ".jpeg"))]
    best = max(jpgs, key=lambda t: (t.get("preference") or 0, t.get("width") or 0), default=None)
    return best["url"] if best else info.get("thumbnail")


# ------------------------------------------------------------------ жүктеуші


class Downloader:
    def __init__(
        self,
        work_dir: Path,
        max_bytes: int,
        cookies_file: Path | None = None,
        proxy: str | None = None,
        extractors: tuple[type, ...] = (ThreadsIE,),
        extra_params: dict | None = None,
    ):
        self.work_dir = Path(work_dir)
        self.max_bytes = max_bytes
        self.cookies_file = cookies_file
        self.proxy = proxy
        self.extractors = extractors
        self.extra_params = extra_params or {}
        self.ffmpeg = ffmpeg_path()
        # Жүйелік ffmpeg-ті yt-dlp өзі табады; тек imageio-ffmpeg жолын беру керек.
        self.ffmpeg_location = None if shutil.which("ffmpeg") else self.ffmpeg

    # -------------------------------------------------------------- yt-dlp баптаулары

    def clean_work_dir(self) -> None:
        if self.work_dir.exists():
            for child in self.work_dir.iterdir():
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def _params(self, **extra) -> dict:
        params: dict = {
            "quiet": True,
            "noprogress": True,
            "noplaylist": True,
            "logger": _Logger(),
            "socket_timeout": 30,
            "retries": 3,
            "fragment_retries": 3,
            "extractor_retries": 2,
            "concurrent_fragment_downloads": 4,
            "playlist_items": f"1:{MAX_ENTRIES}",
            "merge_output_format": "mp4",
            "overwrites": True,
            "js_runtimes": {"deno": {}, "node": {}, "bun": {}},
            "match_filter": _match_filter,
        }
        if self.cookies_file and Path(self.cookies_file).exists():
            params["cookiefile"] = str(self.cookies_file)
        if self.proxy:
            params["proxy"] = self.proxy
        if self.ffmpeg_location:
            params["ffmpeg_location"] = self.ffmpeg_location
        params.update(self.extra_params)
        params.update(extra)
        return params

    def _ydl(self, params: dict) -> yt_dlp.YoutubeDL:
        ydl = yt_dlp.YoutubeDL(params)
        for extractor in self.extractors:
            ydl.add_info_extractor(extractor())
        return ydl

    def _ie_key(self, url: str) -> str | None:
        """Өз экстракторларымыз yt-dlp-тың Generic экстракторынан кейін тіркеледі — оларды тікелей атаймыз."""
        for extractor in self.extractors:
            if extractor.suitable(url):
                return extractor.ie_key()
        return None

    def _extract(self, ydl: yt_dlp.YoutubeDL, url: str, download: bool) -> dict:
        try:
            info = ydl.extract_info(url, download=download, ie_key=self._ie_key(url))
        except _TooLarge:
            raise
        except YtdlpError as exc:
            cause = exc.exc_info[1] if exc.exc_info else None
            if isinstance(cause, _TooLarge):
                raise cause from exc
            raise DownloadFailed(classify_error(str(exc)), str(exc)) from exc
        if not info:
            raise DownloadFailed("failed", "yt-dlp returned nothing")
        return info

    # -------------------------------------------------------------- талдау (YouTube)

    def probe(self, url: str) -> Probe:
        """Видеоны жүктемей, оның барлық сапаларын анықтау."""
        with self._ydl(self._params()) as ydl:
            info = self._extract(ydl, url, download=False)
        if info.get("_type") in ("playlist", "multi_video") or info.get("entries") is not None:
            raise DownloadFailed("playlist")
        if _is_live(info):
            raise DownloadFailed("live")
        formats = info.get("formats") or []
        duration = info.get("duration")
        options = fmt.all_options(formats, duration)
        if not options:
            raise DownloadFailed("no_video")
        return Probe(
            id=str(info.get("id") or ""),
            title=info.get("title") or "",
            url=info.get("webpage_url") or url,
            uploader=info.get("channel") or info.get("uploader"),
            duration=int(duration) if duration else None,
            thumbnail=pick_thumbnail(info),
            options=options,
        )

    # -------------------------------------------------------------- жүктеу

    def download(self, url: str, want: str = "best", progress: ProgressCallback | None = None) -> Result:
        """want: "best" (шекке сыятын ең жақсы сапа), "v720" т.с.с. немесе "mp3" / "m4a"."""
        below: int | None = None
        for _ in range(MAX_ATTEMPTS):
            job_dir = self.work_dir / uuid.uuid4().hex[:12]
            job_dir.mkdir(parents=True, exist_ok=True)
            try:
                return self._download_once(url, want, below, job_dir, progress)
            except _TooLarge as exc:
                shutil.rmtree(job_dir, ignore_errors=True)
                if want != "best" or not exc.quality:
                    raise DownloadFailed("too_big", size=exc.size) from None
                below = exc.quality
                log.info("%s: %sp шекке сыймады, төменірек сапа таңдалады", url, exc.quality)
            except BaseException:
                shutil.rmtree(job_dir, ignore_errors=True)
                raise
        raise DownloadFailed("too_big")

    def _postprocessors(self, want: str) -> tuple[list[dict], dict]:
        if want == "mp3":
            pps = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": str(fmt.MP3_KBPS)}]
        elif want == "m4a":
            pps = [{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}]
        else:
            return [{"key": "FFmpegVideoRemuxer", "preferedformat": VIDEO_REMUX}], {}
        pps += [
            {"key": "FFmpegMetadata", "add_metadata": True},
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
        ]
        return pps, {"writethumbnail": True}

    def _download_once(
        self, url: str, want: str, below: int | None, job_dir: Path, progress: ProgressCallback | None
    ) -> Result:
        state = _Progress(self.max_bytes, progress)
        postprocessors, extra = self._postprocessors(want)
        ydl_ref: list[yt_dlp.YoutubeDL] = []

        def selector(ctx: dict):
            try:
                option = fmt.select(list(ctx["formats"]), want, self.max_bytes, below)
            except fmt.NothingFits as exc:
                if exc.empty:  # видеосы жоқ жазба (мысалы, карусельдегі сурет) — жай өткізіп жібереміз
                    return
                raise _TooLarge(exc.smallest, None) from None
            state.start(option)
            yield from ydl_ref[0].build_format_selector(option.format)(ctx)

        params = self._params(
            format=selector,
            outtmpl=str(job_dir / "%(id).80B.%(ext)s"),
            # Карусельдегі суреттер (видеосы жоқ элементтер) бүкіл жазбаны құлатпауы үшін
            ignore_no_formats_error=True,
            progress_hooks=[state.hook],
            postprocessor_hooks=[state.pp_hook],
            postprocessors=postprocessors,
            **extra,
        )
        with self._ydl(params) as ydl:
            ydl_ref.append(ydl)
            info = self._extract(ydl, url, download=True)

        is_playlist = info.get("_type") in ("playlist", "multi_video")
        entries = [e for e in (info.get("entries") or []) if e] if is_playlist else [info]
        result = Result(files=[], directory=job_dir)
        for entry in entries:
            if _is_live(entry):
                raise DownloadFailed("live")
            for media in self._collect(entry, want, state.option):
                if media.size > self.max_bytes:
                    if not is_playlist:
                        raise _TooLarge(media.size, media.option.quality if media.option else None)
                    result.skipped_large += 1
                    continue
                result.files.append(media)
        if not result.files:
            if result.skipped_large:
                raise _TooLarge(None, None)
            raise DownloadFailed("no_video")
        return result

    def _collect(self, entry: dict, want: str, option: Option | None) -> list[Media]:
        kind = "audio" if want in ("mp3", "m4a") else "video"
        files = []
        for download in entry.get("requested_downloads") or []:
            path = Path(download.get("filepath") or download.get("filename") or "")
            if not path.is_file():
                continue
            duration = entry.get("duration")
            files.append(
                Media(
                    path=path,
                    kind=kind,
                    title=entry.get("title") or "",
                    duration=int(duration) if duration else None,
                    width=download.get("width") or entry.get("width"),
                    height=download.get("height") or entry.get("height"),
                    performer=entry.get("artist") or entry.get("channel") or entry.get("uploader"),
                    thumbnail=self._audio_thumbnail(entry, path) if kind == "audio" else None,
                    option=option,
                )
            )
        return files

    def _audio_thumbnail(self, entry: dict, media_path: Path) -> Path | None:
        """Telegram аудио мұқабасы: JPEG, 320×320-дан аспайды."""
        source = next((Path(t["filepath"]) for t in reversed(entry.get("thumbnails") or []) if t.get("filepath")), None)
        if source is None or not source.is_file() or not self.ffmpeg:
            return None
        target = media_path.with_name(media_path.stem + ".cover.jpg")
        command = [
            self.ffmpeg, "-y", "-loglevel", "error", "-i", str(source),
            "-vf", "scale=320:320:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "4", str(target),
        ]  # fmt: skip
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=30)
        except (OSError, subprocess.SubprocessError):
            return None
        return target if target.is_file() and target.stat().st_size <= 200 * 1024 else None
