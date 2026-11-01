import pytest

from videobot.links import Platform, detect_platform, find_links


@pytest.mark.parametrize(
    "url, platform",
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", Platform.YOUTUBE),
        ("https://youtu.be/dQw4w9WgXcQ", Platform.YOUTUBE),
        ("https://m.youtube.com/shorts/abc123", Platform.YOUTUBE),
        ("https://music.youtube.com/watch?v=abc", Platform.YOUTUBE),
        ("https://www.tiktok.com/@user/video/7300000000000000000", Platform.TIKTOK),
        ("https://vm.tiktok.com/ZMabcdef/", Platform.TIKTOK),
        ("https://www.instagram.com/reel/C1abcDEF/", Platform.INSTAGRAM),
        ("https://www.facebook.com/watch?v=123", Platform.FACEBOOK),
        ("https://fb.watch/abcDEF/", Platform.FACEBOOK),
        ("https://www.threads.net/@user/post/C9abc", Platform.THREADS),
        ("https://www.threads.com/@user/post/C9abc", Platform.THREADS),
        ("https://example.com/video.mp4", None),
        ("https://notyoutube.com/watch", None),
    ],
)
def test_detect_platform(url, platform):
    assert detect_platform(url) == platform


def test_find_links_in_free_text():
    text = (
        "Мынаны қара: youtu.be/abc123, ал мынау https://www.instagram.com/reel/XyZ/?igsh=tracking123 "
        "және (https://vm.tiktok.com/ZMabc/). Басқа сайт: https://example.com"
    )
    links = find_links(text)
    assert [(link.platform, link.url) for link in links] == [
        (Platform.YOUTUBE, "https://youtu.be/abc123"),
        (Platform.INSTAGRAM, "https://www.instagram.com/reel/XyZ/"),  # бақылау параметрі алынды
        (Platform.TIKTOK, "https://vm.tiktok.com/ZMabc/"),
    ]


def test_find_links_keeps_youtube_and_facebook_query():
    links = find_links("https://www.youtube.com/watch?v=abc&t=10s https://www.facebook.com/watch?v=42")
    assert [link.url for link in links] == [
        "https://www.youtube.com/watch?v=abc&t=10s",
        "https://www.facebook.com/watch?v=42",
    ]


def test_find_links_deduplicates_and_limits():
    url = "https://www.tiktok.com/@a/video/1"
    assert len(find_links(f"{url} {url}?x=1 {url}")) == 1
    many = " ".join(f"https://youtu.be/v{i}" for i in range(6))
    assert len(find_links(many)) == 3


def test_hidden_text_links_are_used():
    links = find_links("мына видео", extra_urls=["https://www.threads.com/@u/post/ABC?xmt=1"])
    assert [link.url for link in links] == ["https://www.threads.com/@u/post/ABC"]
    assert links[0].name == "Threads"


def test_plain_text_has_no_links():
    assert find_links("Сәлем! Сағат 5.30-да кездесейік.") == []
