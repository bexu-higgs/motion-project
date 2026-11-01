import json

import pytest
import yt_dlp

from videobot.threads import ThreadsIE, embed_video_urls, find_post, post_entries


def media(code, url, w=720, h=1280, **extra):
    return {"code": code, "pk": "3456", "media_type": 2, "original_width": w, "original_height": h,
            "video_versions": [{"type": 101, "url": url}, {"type": 102, "url": url}],
            "image_versions2": {"candidates": [{"url": "https://cdn.test/thumb.jpg"}]},
            "caption": {"text": "Жазба мәтіні\nекінші жол"}, "user": {"username": "author"},
            "taken_at": 1700000000, **extra}  # fmt: skip


def page(*blobs):
    scripts = "".join(f'<script type="application/json" data-sjs>{json.dumps(b)}</script>' for b in blobs)
    return f'<html><body><script type="application/json">{{broken</script>{scripts}</body></html>'


def test_find_post_ignores_replies_with_other_codes():
    reply = media("REPLY", "https://cdn.test/reply.mp4")
    main = media("ABC", "https://cdn.test/main.mp4")
    html = page({"require": [[{"thread_items": [{"post": reply}]}]]}, {"data": {"posts": [{"post": main}]}})
    post = find_post(html, "ABC")
    entries = post_entries(post)
    assert [e["formats"][0]["url"] for e in entries] == ["https://cdn.test/main.mp4"]
    assert len(entries[0]["formats"]) == 1  # бірдей сілтемелер қайталанбайды
    assert entries[0]["formats"][0]["height"] == 1280


def test_carousel_videos_become_entries():
    post = {"code": "CAR", "carousel_media": [
        media("x", "https://cdn.test/1.mp4"),
        {"image_versions2": {"candidates": [{"url": "https://cdn.test/photo.jpg"}]}},  # сурет — өткізіледі
        media("y", "https://cdn.test/2.mp4"),
    ]}  # fmt: skip
    entries = post_entries(post)
    assert [e["id"] for e in entries] == ["CAR_1", "CAR_3"]


def test_embed_fallback_parser():
    html = '<div><video class="x" src="https://cdn.test/a.mp4?x=1&amp;y=2"></video><source src="https://cdn.test/a.mp4?x=1&amp;y=2"></div>'
    assert embed_video_urls(html) == ["https://cdn.test/a.mp4?x=1&y=2"]


@pytest.mark.parametrize(
    "url, ok",
    [
        ("https://www.threads.net/@user/post/C9abcDEF", True),
        ("https://www.threads.com/@user.name/post/C9abcDEF?xmt=1", True),
        ("https://threads.com/t/C9abcDEF", True),
        ("https://www.threads.com/@user", False),
    ],
)
def test_valid_url(url, ok):
    assert ThreadsIE.suitable(url) is ok


def _extract(monkeypatch, pages):
    requested = []

    def fake_download(self, url, video_id, *args, **kwargs):
        requested.append(url)
        return pages.get(url, "")

    monkeypatch.setattr(ThreadsIE, "_download_webpage", fake_download)
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        ydl.add_info_extractor(ThreadsIE())
        info = ydl.extract_info("https://www.threads.net/@author/post/ABC", download=False, ie_key="Threads")
    return info, requested


def test_extractor_reads_post_page(monkeypatch):
    html = page({"x": media("ABC", "https://cdn.test/main.mp4")})
    info, requested = _extract(monkeypatch, {"https://www.threads.com/@author/post/ABC": html})
    assert requested == ["https://www.threads.com/@author/post/ABC"]
    assert info["id"] == "ABC"
    assert info["title"] == "Жазба мәтіні"
    assert info["uploader"] == "author"
    assert info["url"] == "https://cdn.test/main.mp4"


def test_extractor_falls_back_to_embed(monkeypatch):
    embed = '<video src="https://cdn.test/embed.mp4"></video>'
    info, requested = _extract(monkeypatch, {"https://www.threads.com/@author/post/ABC/embed": embed})
    assert requested[-1].endswith("/embed")
    assert info["url"] == "https://cdn.test/embed.mp4"


def test_extractor_reports_no_video(monkeypatch):
    with pytest.raises(yt_dlp.utils.DownloadError, match="No video formats"):
        _extract(monkeypatch, {})
