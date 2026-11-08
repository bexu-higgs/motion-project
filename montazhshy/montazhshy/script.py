"""Сценарийді талдау: сахналарға бөлу, файл сілтемелері, титрлер.

Қолдау көрсетілетін пішім (бәрі міндетті емес)::

    # Фильмнің атауы
    1. Таң. Таулар оянады. [01_tau.mp4]
    Титр: Алматы, 2026

    2. Қала тіршілігі — көшелер, адамдар, көліктер. @V2 @V3
    Диктор: «Бұл қала ешқашан ұйықтамайды...»

    3. Түн. Шамдар жанады.

Сахналар бос жолмен немесе нөмірмен (1. / 1) / Сахна 1 / Scene 1 / САХНА) бөлінеді.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_SCENE_HEAD = re.compile(r"^\s*(?:(?:сахна|sahna|scene|кадр|эпизод|бөлім)\s*№?\s*\d+[.:)]?|\d{1,3}\s*[.)]\s+)",
                         re.IGNORECASE)
_TITLE = re.compile(r"^\s*(?:титр|title|жазу|надпись)\s*[:：]\s*(.+)$", re.IGNORECASE)
_VO = re.compile(r"^\s*(?:диктор|voice[- ]?over|vo|дауыс|закадр\w*)\s*[:：]\s*(.+)$", re.IGNORECASE)
_REF = re.compile(r"\[([^\]]+)\]|@([A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі0-9_.\-]+)")


@dataclass
class Scene:
    index: int
    text: str
    refs: list[str] = field(default_factory=list)
    titles: list[str] = field(default_factory=list)
    voiceover: list[str] = field(default_factory=list)

    @property
    def words(self) -> list[str]:
        return tokenize(self.text)


@dataclass
class Script:
    title: str = ""
    scenes: list[Scene] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.scenes


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІіЁё]{3,}", text.lower())
    return [stem(w) for w in words if w not in _STOP]


_TR = str.maketrans({
    "а": "a", "ә": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e", "ё": "e", "ж": "j",
    "з": "z", "и": "i", "й": "i", "к": "k", "қ": "k", "л": "l", "м": "m", "н": "n", "ң": "n", "о": "o",
    "ө": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ұ": "u", "ү": "u", "ф": "f", "х": "h",
    "һ": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "", "ы": "y", "і": "i", "ь": "", "э": "e",
    "ю": "iu", "я": "ia", "q": "k", "w": "u", "x": "h",
})


def latin_key(w: str) -> str:
    """Кирилл/латын жазуын бір кілтке келтіру: «Қала» == «kala» == «qala»."""
    s = w.lower().replace("zh", "j").replace("sh", "s").translate(_TR).replace("sh", "s")
    s = s.replace("ch", "c").replace("ia", "a").replace("iu", "u")
    return s[:4] if len(s) > 4 else s


def stem(w: str) -> str:
    # қазақ/орыс жалғауларын қарапайым кесу: түбірдің алғашқы 5 әрпі жеткілікті
    return w[:5] if len(w) > 5 else w


_STOP = {"және", "мен", "пен", "бен", "бұл", "сол", "осы", "оның", "менің", "біз", "сіз", "олар", "үшін",
         "дейін", "кейін", "бар", "жоқ", "the", "and", "with", "for", "this", "that", "что", "как", "это",
         "или", "его", "она", "они", "все", "кадр", "сахна", "scene", "shot"}


def parse(text: str) -> Script:
    text = (text or "").replace("\r\n", "\n").strip()
    if not text:
        return Script()
    lines = text.split("\n")
    title = ""
    if lines and lines[0].lstrip().startswith("#"):
        title = lines[0].lstrip("# ").strip()
        lines = lines[1:]
    else:
        m = re.match(r"^\s*(?:атауы|тақырыбы|title)\s*[:：]\s*(.+)$", lines[0], re.IGNORECASE) if lines else None
        if m:
            title = m.group(1).strip()
            lines = lines[1:]
    blocks: list[list[str]] = []
    cur: list[str] = []
    numbered = any(_SCENE_HEAD.match(ln) for ln in lines)
    for ln in lines:
        if not ln.strip():
            if cur and not numbered:
                blocks.append(cur)
                cur = []
            continue
        if numbered and _SCENE_HEAD.match(ln) and cur:
            blocks.append(cur)
            cur = []
        cur.append(ln)
    if cur:
        blocks.append(cur)
    scenes: list[Scene] = []
    for i, b in enumerate(blocks):
        sc = Scene(index=i + 1, text="")
        body = []
        for ln in b:
            mt = _TITLE.match(ln)
            mv = _VO.match(ln)
            if mt:
                sc.titles.append(mt.group(1).strip().strip("«»\"'"))
                continue
            if mv:
                sc.voiceover.append(mv.group(1).strip().strip("«»\"'"))
                continue
            for r1, r2 in _REF.findall(ln):
                sc.refs.append((r1 or r2).strip())
            body.append(_SCENE_HEAD.sub("", _REF.sub("", ln)).strip())
        sc.text = " ".join(x for x in body if x)
        scenes.append(sc)
    return Script(title=title, scenes=scenes)
