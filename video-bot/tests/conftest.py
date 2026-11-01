"""Желісіз тесттерге ортақ құралдар: ffmpeg жасаған шағын медиа файлдар және жергілікті HTTP сервер."""

from __future__ import annotations

import functools
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError

HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None

MEDIA_COMMANDS = {
    "v720.mp4": "-f lavfi -i testsrc=size=1280x720:rate=30 -t 2 -c:v libx264 -pix_fmt yuv420p -an",
    "v360.mp4": "-f lavfi -i testsrc=size=640x360:rate=30 -t 2 -c:v libx264 -pix_fmt yuv420p -an",
    "a.m4a": "-f lavfi -i sine=frequency=440 -t 2 -c:a aac -b:a 128k",
    "prog.mp4": "-f lavfi -i testsrc=size=720x1280:rate=30 -f lavfi -i sine=frequency=300 -t 2 "
    "-c:v libx264 -pix_fmt yuv420p -c:a aac -shortest",
    "wm.mp4": "-f lavfi -i testsrc2=size=720x1280:rate=30 -f lavfi -i sine=frequency=500 -t 2 "
    "-c:v libx264 -pix_fmt yuv420p -c:a aac -shortest",
    "thumb.jpg": "-f lavfi -i testsrc=size=640x360 -frames:v 1",
}


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def media_server(tmp_path_factory):
    """Медиа файлдарды http://127.0.0.1:<port>/ арқылы беретін сервер."""
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg/ffprobe орнатылмаған")
    root = tmp_path_factory.mktemp("media")
    for name, args in MEDIA_COMMANDS.items():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args.split(), str(root / name)], check=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    FakeIE.base = base
    FakeIE.root = root
    yield base
    server.shutdown()


class FakeIE(InfoExtractor):
    """Сайттарға ұқсас форматтар қайтаратын жалған экстрактор (YouTube, TikTok, карусель…)."""

    IE_NAME = "fake"
    _VALID_URL = r"https?://fake\.test/(?P<id>[\w-]+)"
    base = ""
    root = Path()

    def _f(self, name: str, **fields) -> dict:
        return {"url": f"{self.base}/{name}", "filesize": (self.root / name).stat().st_size, **fields}

    def _video(self, video_id: str) -> dict:
        return {"id": video_id, "title": f"Видео {video_id}", "duration": 2, "uploader": "Автор"}

    def _youtube(self, video_id: str) -> dict:
        return {
            **self._video(video_id),
            "thumbnail": f"{self.base}/thumb.jpg",
            "formats": [
                {"format_id": "sb0", "url": f"{self.base}/thumb.jpg", "ext": "mhtml", "protocol": "mhtml",
                 "format_note": "storyboard", "vcodec": "none", "acodec": "none"},
                self._f("a.m4a", format_id="140", ext="m4a", vcodec="none", acodec="mp4a.40.2", abr=128),
                self._f("v360.mp4", format_id="134", ext="mp4", vcodec="avc1.4d401e", acodec="none",
                        width=640, height=360, fps=30, format_note="360p"),
                self._f("v720.mp4", format_id="136", ext="mp4", vcodec="avc1.4d401f", acodec="none",
                        width=1280, height=720, fps=30, format_note="720p"),
            ],
        }  # fmt: skip

    def _tiktok(self, video_id: str) -> dict:
        return {
            **self._video(video_id),
            "formats": [
                # Су белгісі бар нұсқа үлкенірек әрі «жақсырақ» болып көрінеді — бірақ таңдалмауы керек.
                self._f("wm.mp4", format_id="download", ext="mp4", vcodec="h264", acodec="aac",
                        width=1080, height=1920, format_note="watermarked", preference=-2),
                self._f("prog.mp4", format_id="play_addr-0", ext="mp4", vcodec="h264", acodec="aac",
                        width=720, height=1280, format_note="Direct video"),
            ],
        }  # fmt: skip

    def _real_extract(self, url):
        video_id = self._match_id(url)
        if video_id == "private":
            raise ExtractorError("Private video. Sign in if you've been granted access", expected=True)
        if video_id == "live":
            return {**self._youtube(video_id), "is_live": True, "live_status": "is_live"}
        if video_id == "mixed":  # Instagram карусель: сурет + видео
            photo = {"id": "m1", "title": "Сурет", "formats": []}
            return self.playlist_result([photo, {**self._tiktok("m2"), "id": "m2"}], "mixed", "Аралас")
        if video_id == "photo":  # TikTok слайдшоу: тек әуен
            return {**self._video(video_id), "formats": [self._f("a.m4a", format_id="music", ext="m4a",
                                                                  vcodec="none", acodec="aac")]}  # fmt: skip
        if video_id == "carousel":
            entries = [{**self._tiktok(f"c{i}"), "id": f"c{i}"} for i in (1, 2)]
            return self.playlist_result(entries, "carousel", "Карусель")
        if video_id.startswith("tt"):
            return self._tiktok(video_id)
        if video_id == "unknown-size":
            info = self._youtube(video_id)
            for f in info["formats"]:
                f.pop("filesize", None)
            return info
        return self._youtube(video_id)
