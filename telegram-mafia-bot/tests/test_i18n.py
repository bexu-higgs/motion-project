"""Аудармалардың толықтығы мен дұрыстығы."""

import re
import string
from pathlib import Path

import pytest

from mafia_bot.i18n import CATALOGS, DEFAULT_LANG, LANGS, t, variants

BASE = CATALOGS[DEFAULT_LANG]
ROOT = Path(__file__).resolve().parents[1] / "mafia_bot"
TAG = re.compile(r"</?(b|i|u|s|code|blockquote)>")


def placeholders(text: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(text) if name}


def test_all_languages_registered():
    assert set(LANGS) == set(CATALOGS) == {"kk", "en", "ru", "uz", "ky", "tr"}
    assert LANGS[0] == DEFAULT_LANG == "kk"


@pytest.mark.parametrize("lang", [lang for lang in LANGS if lang != DEFAULT_LANG])
def test_language_has_every_key(lang):
    catalog = CATALOGS[lang]
    assert set(catalog) == set(BASE), {
        "missing": sorted(set(BASE) - set(catalog)),
        "extra": sorted(set(catalog) - set(BASE)),
    }


@pytest.mark.parametrize("lang", LANGS)
def test_placeholders_match_kazakh(lang):
    for key, text in CATALOGS[lang].items():
        assert placeholders(text) == placeholders(BASE[key]), (lang, key)


@pytest.mark.parametrize("lang", LANGS)
def test_html_tags_are_balanced(lang):
    for key, text in CATALOGS[lang].items():
        stack = []
        for m in TAG.finditer(text):
            tag = m.group(1)
            if m.group(0).startswith("</"):
                assert stack and stack.pop() == tag, (lang, key)
            else:
                stack.append(tag)
        assert not stack, (lang, key)


@pytest.mark.parametrize("lang", LANGS)
def test_every_text_formats(lang):
    for key, text in CATALOGS[lang].items():
        params = {name: "X" for name in placeholders(text)}
        assert t(lang, key, **params)


def test_menu_buttons_are_unique_per_language():
    keys = [k for k in BASE if k.startswith("btn.")]
    for lang in LANGS:
        labels = [t(lang, k) for k in keys]
        assert len(labels) == len(set(labels)), lang
    assert "👤 My profile" in variants("btn.profile")
    assert "👤 Менің профилім" in variants("btn.profile")


def test_unknown_language_falls_back_to_kazakh():
    assert t("xx", "btn.help") == BASE["btn.help"]
    assert t(None, "btn.help") == BASE["btn.help"]


def test_code_uses_only_existing_keys():
    prefixes = "|".join(sorted({k.split(".")[0] for k in BASE if "." in k}))
    pattern = re.compile(r'["\']((?:' + prefixes + r')\.[a-z_.]+)["\']')
    used = set()
    for path in ROOT.rglob("*.py"):
        if "i18n" not in path.parts:
            used |= {m.group(1) for m in pattern.finditer(path.read_text(encoding="utf-8"))}
    missing = sorted(k for k in used if k not in BASE and not k.endswith("."))
    assert not missing
