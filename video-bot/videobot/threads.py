"""Threads (threads.com / threads.net) үшін yt-dlp экстракторы — yt-dlp-та әзірге жоқ.

Жазбаның беті ішіндегі JSON-нан (Instagram-ға ұқсас «video_versions» өрістері) видеоларды алады,
табылмаса — жазбаның /embed бетіндегі <video> тегтерінен.
"""

from __future__ import annotations

import html
import json
import re
from collections.abc import Iterator

from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError, float_or_none, int_or_none, url_or_none

SCRIPT_JSON_RE = re.compile(r"<script[^>]+type=[\"']application/json[\"'][^>]*>(.*?)</script>", re.DOTALL)
VIDEO_SRC_RE = re.compile(r"<(?:video|source)\b[^>]*?\ssrc=[\"']([^\"']+)[\"']", re.IGNORECASE)


def iter_json_blobs(webpage: str) -> Iterator[object]:
    for match in SCRIPT_JSON_RE.finditer(webpage):
        try:
            yield json.loads(match.group(1))
        except ValueError:
            continue


def iter_posts(obj: object, code: str) -> Iterator[dict]:
    """JSON ішінен коды `code` болатын жазбаларды (media объектілерін) табу."""
    stack = [obj]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if node.get("code") == code and any(
                k in node for k in ("video_versions", "carousel_media", "image_versions2")
            ):
                yield node
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)


def find_post(webpage: str, code: str) -> dict | None:
    best = None
    for blob in iter_json_blobs(webpage):
        for post in iter_posts(blob, code):
            if post.get("video_versions") or post.get("carousel_media"):
                return post
            best = best or post
    return best


def video_formats(media: dict) -> list[dict]:
    formats, seen = [], set()
    for version in media.get("video_versions") or []:
        url = url_or_none((version or {}).get("url"))
        if not url or url in seen:
            continue
        seen.add(url)
        formats.append(
            {
                "url": url,
                "format_id": str(version.get("id") or version.get("type") or len(formats)),
                "width": int_or_none(version.get("width")) or int_or_none(media.get("original_width")),
                "height": int_or_none(version.get("height")) or int_or_none(media.get("original_height")),
                "ext": "mp4",
            }
        )
    return formats


def post_entries(post: dict) -> list[dict]:
    """Жазбадағы видеолар: карусель болса — әр видео бөлек."""
    items = post.get("carousel_media") or [post]
    code = str(post.get("code") or post.get("pk") or "threads")
    entries = []
    for index, media in enumerate(items, start=1):
        formats = video_formats(media or {})
        if not formats:
            continue
        thumbs = ((media.get("image_versions2") or {}).get("candidates")) or []
        entries.append(
            {
                "id": f"{code}_{index}" if len(items) > 1 else code,
                "formats": formats,
                "duration": float_or_none(media.get("video_duration")),
                "thumbnail": url_or_none(thumbs[0].get("url")) if thumbs else None,
                "dash_manifest": media.get("video_dash_manifest"),
            }
        )
    return entries


def embed_video_urls(webpage: str) -> list[str]:
    urls = []
    for src in VIDEO_SRC_RE.findall(webpage):
        url = url_or_none(html.unescape(src))
        if url and url not in urls:
            urls.append(url)
    return urls


class ThreadsIE(InfoExtractor):
    IE_NAME = "threads"
    _VALID_URL = r"https?://(?:www\.)?threads\.(?:net|com)/(?:@(?P<user>[^/?#]+)/)?(?:post|t)/(?P<id>[^/?#&]+)"

    def _real_extract(self, url):
        user, code = self._match_valid_url(url).group("user", "id")
        page_url = f"https://www.threads.com/@{user}/post/{code}" if user else f"https://www.threads.com/t/{code}"
        webpage = self._download_webpage(page_url, code, note="Threads жазбасы жүктелуде", fatal=False) or ""
        post = find_post(webpage, code)
        entries = post_entries(post) if post else []

        if not entries:
            embed = self._download_webpage(f"{page_url}/embed", code, note="Embed беті жүктелуде", fatal=False) or ""
            entries = [
                {"id": f"{code}_{i}", "formats": [{"url": u, "format_id": "embed", "ext": "mp4"}]}
                for i, u in enumerate(embed_video_urls(embed), start=1)
            ]
        if not entries:
            raise ExtractorError("No video formats found in this Threads post", expected=True)

        caption = ((post or {}).get("caption") or {}).get("text") if post else None
        username = ((post or {}).get("user") or {}).get("username") or user
        title = (caption or "").strip().split("\n")[0][:100] or (f"Threads @{username}" if username else "Threads")
        common = {
            "title": title,
            "description": caption,
            "uploader": username,
            "channel": username,
            "timestamp": int_or_none((post or {}).get("taken_at")),
            "webpage_url": page_url,
        }
        results = []
        for entry in entries:
            dash = entry.pop("dash_manifest", None)
            if dash:
                try:
                    entry["formats"].extend(self._parse_mpd_formats(self._parse_xml(dash, entry["id"]), mpd_id="dash"))
                except Exception:  # noqa: BLE001 — DASH болмаса да, тікелей сілтемелер жетеді
                    pass
            results.append({**common, **entry})

        if len(results) == 1:
            return {**results[0], "id": code}
        return self.playlist_result(results, code, title)
