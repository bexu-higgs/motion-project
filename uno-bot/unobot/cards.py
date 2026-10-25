"""UNO карталары: түстер, мәндер және 108 картадан тұратын десте."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Color(str, Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"


COLORS = (Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE)

NUMBERS = tuple(str(n) for n in range(10))
SKIP = "skip"
REVERSE = "reverse"
DRAW_TWO = "draw2"
WILD = "wild"
WILD_DRAW_FOUR = "wild4"

ACTIONS = (SKIP, REVERSE, DRAW_TWO)
WILDS = (WILD, WILD_DRAW_FOUR)
COLORED_VALUES = NUMBERS + ACTIONS


@dataclass(frozen=True)
class Card:
    """Бір карта. Wild карталардың түсі болмайды (color=None)."""

    color: Color | None
    value: str

    def __post_init__(self) -> None:
        if self.value in WILDS:
            if self.color is not None:
                raise ValueError("Wild картаның түсі болмайды")
        elif self.value in COLORED_VALUES:
            if self.color is None:
                raise ValueError("Түсті картаның түсі болуы керек")
        else:
            raise ValueError(f"Белгісіз карта мәні: {self.value}")

    @property
    def is_wild(self) -> bool:
        return self.value in WILDS

    @property
    def is_number(self) -> bool:
        return self.value in NUMBERS

    @property
    def key(self) -> str:
        """Стикерлер мен inline нәтижелерде қолданылатын қысқа кілт: red_5, blue_skip, wild4."""
        if self.color is None:
            return self.value
        return f"{self.color.value}_{self.value}"

    @property
    def sort_key(self) -> tuple[int, int]:
        color_rank = COLORS.index(self.color) if self.color else len(COLORS)
        value_rank = (COLORED_VALUES + WILDS).index(self.value)
        return color_rank, value_rank

    @classmethod
    def from_key(cls, key: str) -> Card:
        if key in WILDS:
            return cls(None, key)
        color, sep, value = key.partition("_")
        if not sep:
            raise ValueError(f"Қате карта кілті: {key}")
        return cls(Color(color), value)


def new_deck() -> list[Card]:
    """Ресми 108 карталық десте.

    Әр түсте: бір 0, 1–9 сандарынан екі-екіден, Skip, Reverse, Draw Two екі-екіден (25 карта).
    Оған қоса 4 Wild және 4 Wild Draw Four.
    """
    deck: list[Card] = []
    for color in COLORS:
        deck.append(Card(color, "0"))
        for value in NUMBERS[1:] + ACTIONS:
            deck.append(Card(color, value))
            deck.append(Card(color, value))
    for _ in range(4):
        deck.append(Card(None, WILD))
        deck.append(Card(None, WILD_DRAW_FOUR))
    return deck


# Барлық бірегей карта беттері (54): әр түстің 13 мәні + екі Wild.
FACE_KEYS: tuple[str, ...] = tuple(Card(color, value).key for color in COLORS for value in COLORED_VALUES) + WILDS

# Түс таңдалған Wild карталары (стикер ретінде ғана): wild_red, wild4_blue ...
COLORED_WILD_KEYS: tuple[str, ...] = tuple(f"{wild}_{color.value}" for wild in WILDS for color in COLORS)

OPTION_KEYS: tuple[str, ...] = ("option_draw", "option_pass", "option_uno")

DIM_PREFIX = "dim_"


def colored_wild_key(value: str, color: Color) -> str:
    return f"{value}_{color.value}"


def dim_key(key: str) -> str:
    """Ойнауға болмайтын (күңгірт) нұсқаның кілті."""
    return DIM_PREFIX + key
