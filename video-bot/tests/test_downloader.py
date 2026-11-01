"""Нақты yt-dlp ағыны: жалған экстрактор + жергілікті сервер (желі қажет емес)."""

import json
import subprocess

import pytest
from conftest import FakeIE

from videobot.downloader import Downloader, DownloadFailed, classify_error


def streams(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)["streams"]


def kinds(path):
    return sorted(s["codec_type"] for s in streams(path))


@pytest.fixture
def downloader(media_server, tmp_path):
    return Downloader(tmp_path / "dl", max_bytes=50 * 1024 * 1024, extractors=(FakeIE,))


def test_probe_lists_every_quality_and_audio(downloader):
    probe = downloader.probe("https://fake.test/yt1")
    assert probe.title == "Видео yt1"
    assert [o.label for o in probe.video_options] == ["720p", "360p"]
    assert probe.option("v720").format == "136+140"
    assert [o.key for o in probe.audio_options] == ["mp3", "m4a"]
    assert all(o.size for o in probe.video_options)


def test_download_selected_quality_merges_video_and_audio(downloader):
    progress = []
    result = downloader.download("https://fake.test/yt1", "v360", lambda stage, f: progress.append(stage))
    try:
        [media] = result.files
        assert media.kind == "video" and media.path.suffix == ".mp4"
        assert kinds(media.path) == ["audio", "video"]
        video = next(s for s in streams(media.path) if s["codec_type"] == "video")
        assert (video["width"], video["height"]) == (640, 360)
        assert media.option.key == "v360"
        assert (media.width, media.height, media.duration) == (640, 360, 2)  # Telegram-ға берілетін өлшемдер
        assert "download" in progress
    finally:
        result.cleanup()
    assert not result.directory.exists()


def test_download_mp3_with_cover(downloader):
    result = downloader.download("https://fake.test/yt1", "mp3")
    try:
        [media] = result.files
        assert media.kind == "audio" and media.path.suffix == ".mp3"
        assert "audio" in kinds(media.path)
        assert media.performer == "Автор"
        assert media.thumbnail is not None and media.thumbnail.stat().st_size < 200 * 1024
    finally:
        result.cleanup()


def test_download_m4a(downloader):
    result = downloader.download("https://fake.test/yt1", "m4a")
    try:
        [media] = result.files
        assert media.path.suffix == ".m4a" and "audio" in kinds(media.path)
    finally:
        result.cleanup()


def test_best_skips_watermarked_format(downloader):
    result = downloader.download("https://fake.test/tt1")
    try:
        [media] = result.files
        assert media.option.format == "play_addr-0"
        video = next(s for s in streams(media.path) if s["codec_type"] == "video")
        assert (video["width"], video["height"]) == (720, 1280)
    finally:
        result.cleanup()


def test_best_falls_back_to_lower_quality_when_too_big(media_server, tmp_path):
    root = FakeIE.root
    size_720 = (root / "v720.mp4").stat().st_size + (root / "a.m4a").stat().st_size
    size_360 = (root / "v360.mp4").stat().st_size + (root / "a.m4a").stat().st_size
    limit = (size_720 + size_360) // 2
    downloader = Downloader(tmp_path / "dl", max_bytes=limit, extractors=(FakeIE,))
    # Өлшемі белгісіз болса, алдымен 720p жүктеліп, шектен асқанда тоқтатылып, 360p таңдалады.
    result = downloader.download("https://fake.test/unknown-size")
    try:
        assert result.files[0].option.key == "v360"
    finally:
        result.cleanup()
    assert list((tmp_path / "dl").iterdir()) == []  # тоқтатылған жүктеудің қалдығы да өшірілді


def test_selected_quality_too_big_is_reported(media_server, tmp_path):
    downloader = Downloader(tmp_path / "dl", max_bytes=20_000, extractors=(FakeIE,))
    with pytest.raises(DownloadFailed) as info:
        downloader.download("https://fake.test/unknown-size", "v720")
    assert info.value.reason == "too_big"
    assert list((tmp_path / "dl").iterdir()) == []


def test_nothing_fits_by_estimate(media_server, tmp_path):
    downloader = Downloader(tmp_path / "dl", max_bytes=1000, extractors=(FakeIE,))
    with pytest.raises(DownloadFailed) as info:
        downloader.download("https://fake.test/yt1")
    assert info.value.reason == "too_big"


def test_carousel_downloads_every_video(downloader):
    result = downloader.download("https://fake.test/carousel")
    try:
        assert len(result.files) == 2
        assert all(m.path.is_file() for m in result.files)
    finally:
        result.cleanup()


def test_carousel_skips_photos(downloader):
    result = downloader.download("https://fake.test/mixed")
    try:
        assert [m.path.stem for m in result.files] == ["m2"]
    finally:
        result.cleanup()


def test_post_without_video(downloader, tmp_path):
    with pytest.raises(DownloadFailed) as info:
        downloader.download("https://fake.test/photo")
    assert info.value.reason == "no_video"
    assert list((tmp_path / "dl").iterdir()) == []


def test_no_lower_quality_left_is_too_big(media_server, tmp_path):
    downloader = Downloader(tmp_path / "dl", max_bytes=40_000, extractors=(FakeIE,))
    with pytest.raises(DownloadFailed) as info:  # 720p да, 360p да шектен асады (өлшемдері белгісіз)
        downloader.download("https://fake.test/unknown-size")
    assert info.value.reason == "too_big"


def test_errors_are_classified(downloader):
    with pytest.raises(DownloadFailed) as info:
        downloader.probe("https://fake.test/private")
    assert info.value.reason == "private"
    with pytest.raises(DownloadFailed) as info:
        downloader.probe("https://fake.test/live")
    assert info.value.reason == "live"
    with pytest.raises(DownloadFailed) as info:
        downloader.download("https://fake.test/live")
    assert info.value.reason == "live"


@pytest.mark.parametrize(
    "message, reason",
    [
        ("ERROR: [youtube] x: Sign in to confirm you're not a bot. Use --cookies", "bot_check"),
        ("ERROR: [youtube] x: Sign in to confirm your age.", "age"),
        ("ERROR: [youtube] x: Private video. Sign in if you've been granted access", "private"),
        ("ERROR: [Instagram] x: Requested content is not available, rate-limit reached or login required", "login"),
        ("ERROR: [youtube] x: Video unavailable", "unavailable"),
        ("ERROR: Unsupported URL: https://example.com", "unsupported"),
        ("ERROR: [TikTok] x: Unable to download webpage: timed out", "network"),
        ("ERROR: something strange", "failed"),
    ],
)
def test_classify_error(message, reason):
    assert classify_error(message) == reason
