"""Көптілді мәтіндер. Негізгі тіл — қазақша; басқа тілде кілт жоқ болса, қазақшасы қолданылады."""

from __future__ import annotations

from functools import cache

from . import en, kk, ky, ru, tr, uz

DEFAULT_LANG = "kk"
LANGS: tuple[str, ...] = ("kk", "en", "ru", "uz", "ky", "tr")
LANG_NAMES: dict[str, str] = {
    "kk": "🇰🇿 Қазақша",
    "en": "🇬🇧 English",
    "ru": "🇷🇺 Русский",
    "uz": "🇺🇿 O‘zbekcha",
    "ky": "🇰🇬 Кыргызча",
    "tr": "🇹🇷 Türkçe",
}
CATALOGS: dict[str, dict[str, str]] = {
    "kk": kk.MESSAGES,
    "en": en.MESSAGES,
    "ru": ru.MESSAGES,
    "uz": uz.MESSAGES,
    "ky": ky.MESSAGES,
    "tr": tr.MESSAGES,
}


def norm(lang: str | None) -> str:
    return lang if lang in CATALOGS else DEFAULT_LANG


def t(lang: str | None, key: str, /, **params: object) -> str:
    """Мәтінді аудару. ``params`` мәтіндегі ``{атау}`` орындарына қойылады."""
    catalog = CATALOGS.get(lang or DEFAULT_LANG, CATALOGS[DEFAULT_LANG])
    text = catalog.get(key)
    if text is None:
        text = CATALOGS[DEFAULT_LANG][key]
    return text.format(**params) if params else text


@cache
def variants(key: str) -> frozenset[str]:
    """Бір кілттің барлық тілдегі нұсқалары (мәзір батырмаларын тану үшін)."""
    return frozenset(t(lang, key) for lang in LANGS)
