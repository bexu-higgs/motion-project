"""Хабарламадан сілтемелерді табу және платформаны анықтау."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlsplit, urlunsplit


class Platform(str, Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    THREADS = "threads"


PLATFORM_HOSTS: dict[Platform, tuple[str, ...]] = {
    Platform.YOUTUBE: ("youtube.com", "youtu.be", "youtube-nocookie.com"),
    Platform.TIKTOK: ("tiktok.com",),
    Platform.INSTAGRAM: ("instagram.com", "instagr.am", "ig.me"),
    Platform.FACEBOOK: ("facebook.com", "fb.watch", "fb.com", "fb.gg"),
    Platform.THREADS: ("threads.net", "threads.com"),
}

PLATFORM_NAMES = {
    Platform.YOUTUBE: "YouTube",
    Platform.TIKTOK: "TikTok",
    Platform.INSTAGRAM: "Instagram",
    Platform.FACEBOOK: "Facebook",
    Platform.THREADS: "Threads",
}

# Бұл платформалардың сілтемесіндегі «?…» бөлігі — тек бақылау параметрлері (igsh, is_from_webapp…).
STRIP_QUERY = {Platform.TIKTOK, Platform.INSTAGRAM, Platform.THREADS}

# Сілтеме http(s):// арқылы басталуы да, басталмауы да мүмкін (мысалы, «youtu.be/abc»).
URL_RE = re.compile(r"(?:https?://)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:/[^\s<>\"'«»]*)?", re.IGNORECASE)
TRAILING = ".,!?;:)]}>\"'»…"


@dataclass(frozen=True)
class Link:
    url: str
    platform: Platform

    @property
    def name(self) -> str:
        return PLATFORM_NAMES[self.platform]


def detect_platform(url: str) -> Platform | None:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return None
    for platform, hosts in PLATFORM_HOSTS.items():
        if any(host == h or host.endswith("." + h) for h in hosts):
            return platform
    return None


def normalize(url: str) -> str:
    url = url.rstrip(TRAILING)
    if not re.match(r"https?://", url, re.IGNORECASE):
        url = "https://" + url
    return url


def clean(url: str, platform: Platform) -> str:
    if platform not in STRIP_QUERY:
        return url
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def find_links(text: str | None, extra_urls: list[str] | None = None, limit: int = 3) -> list[Link]:
    """Мәтіндегі (және Telegram «text_link» сілтемелеріндегі) қолдау көрсетілетін сілтемелер."""
    candidates = list(extra_urls or []) + URL_RE.findall(text or "")
    links: list[Link] = []
    seen: set[str] = set()
    for raw in candidates:
        url = normalize(raw)
        platform = detect_platform(url)
        if platform is None:
            continue
        url = clean(url, platform)
        if url in seen:
            continue
        seen.add(url)
        links.append(Link(url, platform))
        if len(links) >= limit:
            break
    return links


def has_any_url(text: str | None) -> bool:
    return bool(text and URL_RE.search(text) and "." in text)
