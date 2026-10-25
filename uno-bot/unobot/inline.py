"""Inline режимі: ойыншының қолындағы карталарды стикер ретінде көрсету.

Нәтиже id форматы: "<ойын id>|<әрекет>|<аргумент>"
  p — картамен жүру (red_5, wild4), d — карта алу, s — өткізу,
  u — UNO деу, x — ойнауға болмайтын (күңгірт) карта: тек ойын жағдайы жіберіледі.
"""

from __future__ import annotations

from telegram import (
    InlineQueryResult,
    InlineQueryResultArticle,
    InlineQueryResultCachedSticker,
    InputTextMessageContent,
)

from . import texts
from .cards import Card, Color
from .game import Game, Phase, Player
from .stickers import StickerRegistry

MAX_RESULTS = 50


def result_id(game: Game, action: str, arg: str = "") -> str:
    return f"{game.game_id}|{action}|{arg}"


def parse_result_id(value: str) -> tuple[int, str, str] | None:
    parts = value.split("|", 2)
    if len(parts) != 3 or not parts[0].isdigit():
        return None
    return int(parts[0]), parts[1], parts[2]


def _sticker_or_article(
    rid: str,
    sticker_id: str | None,
    title: str,
    description: str,
    message: str,
    content: InputTextMessageContent | None = None,
) -> InlineQueryResult:
    if sticker_id:
        return InlineQueryResultCachedSticker(rid, sticker_id, input_message_content=content)
    # Стикерлер әлі жүктелмесе — мәтіндік нұсқа
    return InlineQueryResultArticle(
        rid,
        title=title,
        description=description,
        input_message_content=content or InputTextMessageContent(message),
    )


def _unique(cards: list[Card]) -> list[Card]:
    seen: set[str] = set()
    result = []
    for card in sorted(cards, key=lambda c: c.sort_key):
        if card.key not in seen:
            seen.add(card.key)
            result.append(card)
    return result


def _header(game: Game, player: Player) -> str:
    top = texts.card_short(game.top_card) if game.top_card else "—"
    if game.top_card is not None and game.top_card.is_wild and game.current_color is not None:
        top += f" ({texts.COLOR_EMOJI[game.current_color]})"
    if game.current_player is not player:
        return texts.INLINE_WAIT.format(player=game.current_player.name[:20], top=top)
    if game.phase is Phase.CHALLENGE:
        return texts.INLINE_DECIDE
    if game.phase is Phase.CHOOSE_COLOR:
        return texts.INLINE_CHOOSE_COLOR
    if game.drawn_card is not None:
        return texts.INLINE_DRAWN if game.can_play(game.drawn_card) else texts.INLINE_DRAWN_PASS
    return texts.INLINE_YOUR_TURN.format(top=top)


def build_results(
    game: Game | None,
    player: Player | None,
    stickers: StickerRegistry,
) -> tuple[list[InlineQueryResult], str | None]:
    """Inline нәтижелері және тізімнің үстіндегі тақырып мәтіні."""
    if game is None or player is None:
        return [
            InlineQueryResultArticle(
                "nogame",
                title=texts.INLINE_NOT_IN_GAME_TITLE,
                description=texts.INLINE_NOT_IN_GAME_DESC,
                input_message_content=InputTextMessageContent(texts.INLINE_NOT_IN_GAME_MSG),
            )
        ], None
    if not game.running:
        return [
            InlineQueryResultArticle(
                "lobby",
                title=texts.INLINE_LOBBY,
                description=texts.INLINE_NOT_IN_GAME_DESC,
                input_message_content=InputTextMessageContent(texts.plain_status(game)),
            )
        ], texts.INLINE_LOBBY

    results: list[InlineQueryResult] = []
    status = InputTextMessageContent(texts.plain_status(game))
    playable = _unique(game.playable_cards(player))

    if game.phase is Phase.PLAYING and game.current_player is player:
        if game.drawn_card is None:
            results.append(
                _sticker_or_article(
                    result_id(game, "d"),
                    stickers.option("btn_draw"),
                    "🃏 " + texts.INLINE_DRAW_TITLE,
                    "Алу үйіндісінен бір карта алу",
                    "🃏 " + texts.INLINE_DRAW_TITLE,
                )
            )
        else:
            results.append(
                _sticker_or_article(
                    result_id(game, "s"),
                    stickers.option("btn_pass"),
                    "⏭ " + texts.INLINE_PASS_TITLE,
                    "Кезекті келесі ойыншыға беру",
                    "⏭ " + texts.INLINE_PASS_TITLE,
                )
            )
        if game.can_say_uno(player):
            results.append(
                _sticker_or_article(
                    result_id(game, "u"),
                    stickers.option("btn_uno"),
                    "📢 " + texts.INLINE_UNO_TITLE,
                    "Соңғының алдындағы картамен жүрер алдында басыңыз",
                    "📢 UNO!",
                )
            )

    for card in playable:
        # Wild пен Wild Draw Four бір рет көрсетіледі; түсті жүрген соң топтағы батырмамен таңдайды.
        results.append(
            _sticker_or_article(
                result_id(game, "p", card.key),
                stickers.card(card),
                texts.card_text(card),
                "Жүрген соң түс таңдайсыз" if card.is_wild else "Осы картамен жүру",
                texts.card_text(card),
            )
        )

    playable_keys = {c.key for c in playable}
    for card in _unique(player.hand):
        if card.key in playable_keys:
            continue
        results.append(
            _sticker_or_article(
                result_id(game, "x", card.key),
                stickers.dim(card),
                "🚫 " + texts.card_text(card),
                "Бұл картамен қазір жүруге болмайды",
                texts.plain_status(game),
                content=status,
            )
        )
    return results, _header(game, player)


def parse_play_arg(arg: str) -> tuple[str, Color | None]:
    key, _, color = arg.partition(":")
    return key, Color(color) if color else None
