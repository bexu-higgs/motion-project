"""UNO ойынының ережелері (Telegram-ға тәуелсіз).

Ресми Mattel ережелері бойынша:
* 108 карта, әр ойыншыға 7 карта, 2–10 ойыншы.
* Түсі, саны немесе белгісі (Skip, Reverse, Draw Two) сәйкес келетін картамен жүруге болады,
  Wild пен Wild Draw Four кез келген уақытта жүріледі.
* Wild Draw Four тек қолыңда ағымдағы түстегі карта болмаса ғана заңды. Келесі ойыншы
  Challenge жасай алады: кінәлі болса — жүрген адам 4 карта алады, кінәсіз болса —
  Challenge жасаған адам 6 карта алып, кезегін өткізеді.
* Жүре алмасаң (немесе қаламасаң) бір карта аласың; ол жарамды болса, сол картамен ғана
  жүруге болады, әйтпесе пас бересің.
* Соңғының алдындағы картамен жүргенде UNO деу керек. Айтпасаң және келесі ойыншы
  жүргенше біреу ұстап алса — 2 карта аласың.
* Ойын бір рет ойналады: картасынан бірінші құтылған ойыншы — 1-орын, екінші — 2-орын т.с.с.
  Ойын бір ғана ойыншы қалғанша жалғасады, ол соңғы орынды алады.
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .cards import (
    COLORS,
    DRAW_TWO,
    REVERSE,
    SKIP,
    WILD,
    WILD_DRAW_FOUR,
    Card,
    Color,
    new_deck,
)

MIN_PLAYERS = 2
MAX_PLAYERS = 10
HAND_SIZE = 7
MAX_TIMEOUTS = 3


class Phase(str, Enum):
    LOBBY = "lobby"
    PLAYING = "playing"
    CHOOSE_COLOR = "choose_color"  # бастапқы карта Wild болса
    CHALLENGE = "challenge"  # Wild Draw Four-ға жауап күтілуде
    FINISHED = "finished"


class GameError(Exception):
    """Ережеге қайшы әрекет. code — texts.ERRORS ішіндегі кілт."""

    def __init__(self, code: str, **data: Any) -> None:
        super().__init__(code)
        self.code = code
        self.data = data


@dataclass
class Event:
    kind: str
    data: dict[str, Any] = field(default_factory=dict)

    def __getitem__(self, item: str) -> Any:
        return self.data[item]


def ev(kind: str, **data: Any) -> Event:
    return Event(kind, data)


@dataclass(eq=False)
class Player:
    user_id: int
    name: str
    hand: list[Card] = field(default_factory=list)
    said_uno: bool = False
    timeouts: int = 0

    def sorted_hand(self) -> list[Card]:
        return sorted(self.hand, key=lambda c: c.sort_key)


@dataclass
class PendingWildDrawFour:
    player_id: int
    legal: bool
    hand: list[Card]  # Challenge кезінде көрсетілетін қол
    previous_color: Color | None


@dataclass
class PendingColor:
    """Wild жүрілді, жүрген ойыншы түс таңдауын күтудеміз."""

    player_id: int
    card: Card
    legal: bool  # Wild Draw Four ережеге сай жүрілді ме
    hand: list[Card]  # жүрген сәттегі қол (Challenge үшін)
    previous_color: Color | None


class Game:
    def __init__(
        self,
        chat_id: int,
        host_id: int,
        rng: random.Random | None = None,
    ) -> None:
        self.chat_id = chat_id
        self.host_id = host_id
        self.rng = rng or random.Random()
        self.players: list[Player] = []
        self.phase = Phase.LOBBY
        self.deck: list[Card] = []
        self.discard: list[Card] = []
        self.current_color: Color | None = None
        self.direction = 1
        self.current_index = 0
        self.dealer_index = 0
        self.drawn_card: Card | None = None
        self.pending_wd4: PendingWildDrawFour | None = None
        self.pending_color: PendingColor | None = None
        self.uno_vulnerable_id: int | None = None
        # Inline нәтижелерін осы ойынға байлау үшін (алдыңғы ойынның ескі таңдауы өтпейді).
        self.game_id = self.rng.randrange(1, 10**9)
        self.version = 0  # кез келген өзгерісте артады
        self.turn_serial = 0  # кезек күйі өзгергенде артады (UNO айту/ұстау есепке алынбайды)
        self.winner: Player | None = None
        self.places: list[Player] = []  # картасынан құтылу реті: 1-орын, 2-орын …

    # ------------------------------------------------------------------ күй

    @property
    def started(self) -> bool:
        return self.phase is not Phase.LOBBY

    @property
    def running(self) -> bool:
        return self.phase in (Phase.PLAYING, Phase.CHOOSE_COLOR, Phase.CHALLENGE)

    @property
    def current_player(self) -> Player:
        return self.players[self.current_index]

    @property
    def dealer(self) -> Player:
        return self.players[self.dealer_index]

    @property
    def top_card(self) -> Card | None:
        return self.discard[-1] if self.discard else None

    def next_index(self, steps: int = 1, start: int | None = None) -> int:
        base = self.current_index if start is None else start
        return (base + self.direction * steps) % len(self.players)

    @property
    def next_player(self) -> Player:
        return self.players[self.next_index()]

    def get_player(self, user_id: int) -> Player | None:
        for player in self.players:
            if player.user_id == user_id:
                return player
        return None

    def require_player(self, user_id: int) -> Player:
        player = self.get_player(user_id)
        if player is None:
            raise GameError("not_in_game")
        return player

    def is_turn_of(self, user_id: int) -> bool:
        return self.running and self.current_player.user_id == user_id

    def can_play(self, card: Card) -> bool:
        if card.is_wild:
            return True
        if card.color == self.current_color:
            return True
        top = self.top_card
        return top is not None and not top.is_wild and card.value == top.value

    def playable_cards(self, player: Player) -> list[Card]:
        if self.phase is not Phase.PLAYING or player is not self.current_player:
            return []
        if self.drawn_card is not None:
            return [self.drawn_card] if self.can_play(self.drawn_card) else []
        return [card for card in player.hand if self.can_play(card)]

    def can_say_uno(self, player: Player) -> bool:
        if self.uno_vulnerable_id == player.user_id:
            return True
        return (
            self.phase is Phase.PLAYING
            and player is self.current_player
            and len(player.hand) == 2
            and not player.said_uno
            and bool(self.playable_cards(player))
        )

    def _touch(self, turn: bool = True) -> None:
        self.version += 1
        if turn:
            self.turn_serial += 1

    # --------------------------------------------------------------- лобби

    def add_player(self, user_id: int, name: str) -> Player:
        if self.started:
            raise GameError("already_started")
        if self.get_player(user_id):
            raise GameError("already_joined")
        if len(self.players) >= MAX_PLAYERS:
            raise GameError("game_full", max=MAX_PLAYERS)
        player = Player(user_id, name)
        self.players.append(player)
        self._touch()
        return player

    def start(self, user_id: int) -> list[Event]:
        if user_id != self.host_id:
            raise GameError("host_only")
        if self.started:
            raise GameError("already_started")
        if len(self.players) < MIN_PLAYERS:
            raise GameError("not_enough_players", min=MIN_PLAYERS)
        # Ресми ережеде алғашқы таратушыны карта суыру арқылы анықтайды — біз кездейсоқ таңдаймыз.
        self.dealer_index = self.rng.randrange(len(self.players))
        events = self._deal()
        self._touch()
        return events

    def _deal(self) -> list[Event]:
        self.deck = new_deck()
        self.rng.shuffle(self.deck)
        self.discard = []
        self.direction = 1
        self.drawn_card = None
        self.pending_wd4 = None
        self.pending_color = None
        self.uno_vulnerable_id = None
        for player in self.players:
            player.hand = []
            player.said_uno = False
        n = len(self.players)
        for _ in range(HAND_SIZE):
            for offset in range(1, n + 1):
                self.players[(self.dealer_index + offset) % n].hand.append(self.deck.pop())

        events = [ev("game_start", dealer=self.dealer)]
        top = self.deck.pop()
        while top.value == WILD_DRAW_FOUR:
            # Wild Draw Four бастапқы карта бола алмайды: дестеге қайтарып, араластырамыз.
            events.append(ev("start_wd4_returned"))
            self.deck.insert(0, top)
            self.rng.shuffle(self.deck)
            top = self.deck.pop()
        self.discard = [top]
        self.current_color = top.color
        self.phase = Phase.PLAYING
        events.append(ev("first_card", card=top))

        first = self.next_index(1, self.dealer_index)
        if top.value == SKIP:
            events.append(ev("skipped", player=self.players[first]))
            self.current_index = self.next_index(2, self.dealer_index)
        elif top.value == REVERSE:
            self.direction = -1
            self.current_index = self.dealer_index
            events.append(ev("start_reverse", player=self.dealer))
        elif top.value == DRAW_TWO:
            victim = self.players[first]
            self._draw(victim, 2, events)
            events.append(ev("penalty", player=victim, count=2, reason="draw2"))
            self.current_index = self.next_index(2, self.dealer_index)
        elif top.value == WILD:
            self.current_index = first
            self.phase = Phase.CHOOSE_COLOR
            events.append(ev("start_wild", player=self.players[first]))
        else:
            self.current_index = first
        return events

    # ---------------------------------------------------------- көмекшілер

    def _reshuffle(self, events: list[Event]) -> bool:
        if len(self.discard) <= 1:
            return False
        top = self.discard[-1]
        rest = self.discard[:-1]
        self.rng.shuffle(rest)
        self.deck = rest + self.deck
        self.discard = [top]
        events.append(ev("deck_reshuffled"))
        return True

    def _draw(self, player: Player, count: int, events: list[Event]) -> list[Card]:
        drawn = []
        for _ in range(count):
            if not self.deck and not self._reshuffle(events):
                events.append(ev("deck_empty"))
                break
            card = self.deck.pop()
            player.hand.append(card)
            drawn.append(card)
        return drawn

    def _advance(self, steps: int = 1) -> None:
        self.current_index = self.next_index(steps)
        self.drawn_card = None
        for player in self.players:
            if len(player.hand) != 1:
                player.said_uno = False

    def _close_uno_window(self) -> None:
        # Келесі ойыншы жүре бастаған соң UNO айтпағанды ұстауға болмайды.
        self.uno_vulnerable_id = None

    def _require_turn(self, user_id: int) -> Player:
        player = self.require_player(user_id)
        if self.phase is Phase.LOBBY:
            raise GameError("not_started")
        if self.phase is Phase.FINISHED:
            raise GameError("game_over")
        if player is not self.current_player:
            raise GameError("not_your_turn", player=self.current_player)
        if self.phase is Phase.CHALLENGE:
            raise GameError("decide_wd4")
        if self.phase is Phase.CHOOSE_COLOR:
            raise GameError("choose_color_first")
        return player

    # ------------------------------------------------------------- жүрістер

    def play_card(self, user_id: int, card_key: str, color: Color | None = None) -> list[Event]:
        player = self._require_turn(user_id)
        try:
            card = Card.from_key(card_key)
        except ValueError:
            raise GameError("unknown_card") from None
        if card not in player.hand:
            raise GameError("card_not_in_hand")
        if self.drawn_card is not None and card != self.drawn_card:
            raise GameError("only_drawn_card")
        if not self.can_play(card):
            raise GameError("cannot_play")

        self._close_uno_window()
        player.timeouts = 0
        events: list[Event] = []
        previous_color = self.current_color
        player.hand.remove(card)
        legal_wd4 = not any(c.color == previous_color for c in player.hand)
        self.discard.append(card)
        if not card.is_wild:
            self.current_color = card.color
        elif color is not None:
            self.current_color = color
        events.append(ev("played", player=player, card=card, color=self.current_color))

        if len(player.hand) == 1 and not player.said_uno:
            self.uno_vulnerable_id = player.user_id
            events.append(ev("uno_vulnerable", player=player))

        if card.is_wild and color is None:
            # Түсті топтағы батырмалар арқылы таңдайды; карта әсері сосын орындалады.
            self.pending_color = PendingColor(player.user_id, card, legal_wd4, player.sorted_hand(), previous_color)
            self.phase = Phase.CHOOSE_COLOR
            self._touch()
            return events

        events += self._apply_effect(player, card, legal_wd4, player.sorted_hand(), previous_color)
        events += self._retire_if_out(player)
        self._touch()
        return events

    def _apply_effect(
        self, player: Player, card: Card, legal_wd4: bool, hand: list[Card], previous_color: Color | None
    ) -> list[Event]:
        """Жүрілген картаның әсері және кезекті келесі ойыншыға беру."""
        events: list[Event] = []
        if card.value == SKIP:
            events.append(ev("skipped", player=self.next_player))
            self._advance(2)
        elif card.value == REVERSE:
            if len(self.players) == 2:
                # Екі ойыншыда Reverse Skip сияқты әрекет етеді.
                events.append(ev("reverse_as_skip", player=self.next_player))
                self._advance(2)
            else:
                self.direction *= -1
                events.append(ev("reversed", direction=self.direction))
                self._advance(1)
        elif card.value == DRAW_TWO:
            victim = self.next_player
            self._draw(victim, 2, events)
            events.append(ev("penalty", player=victim, count=2, reason="draw2"))
            self._advance(2)
        elif card.value == WILD_DRAW_FOUR:
            self.pending_wd4 = PendingWildDrawFour(
                player_id=player.user_id,
                legal=legal_wd4,
                hand=hand,
                previous_color=previous_color,
            )
            self._advance(1)
            self.phase = Phase.CHALLENGE
            events.append(ev("wd4_pending", player=player, target=self.current_player))
        else:
            self._advance(1)
        return events

    def draw(self, user_id: int) -> list[Event]:
        player = self._require_turn(user_id)
        if self.drawn_card is not None:
            raise GameError("already_drawn")
        self._close_uno_window()
        player.timeouts = 0
        events = self._draw_for_turn(player)
        self._touch()
        return events

    def _draw_for_turn(self, player: Player, auto_pass: bool = False) -> list[Event]:
        events: list[Event] = []
        drawn = self._draw(player, 1, events)
        if not drawn:
            events.append(ev("passed", player=player))
            self._advance(1)
            return events
        card = drawn[0]
        events.append(ev("drew", player=player, playable=self.can_play(card)))
        if auto_pass:
            events.append(ev("passed", player=player))
            self._advance(1)
        else:
            # Кезек өздігінен өтпейді: ойыншы алған картасымен жүреді (жарамды болса) не пас береді.
            self.drawn_card = card
        return events

    def pass_turn(self, user_id: int) -> list[Event]:
        player = self._require_turn(user_id)
        if self.drawn_card is None:
            raise GameError("draw_first")
        player.timeouts = 0
        self._advance(1)
        self._touch()
        return [ev("passed", player=player)]

    def choose_color(self, user_id: int, color: Color) -> list[Event]:
        player = self.require_player(user_id)
        if self.phase is not Phase.CHOOSE_COLOR:
            raise GameError("no_color_choice")
        if player is not self.current_player:
            raise GameError("not_your_color", player=self.current_player)
        player.timeouts = 0
        events = self._choose_color(player, color)
        self._touch()
        return events

    def _choose_color(self, player: Player, color: Color) -> list[Event]:
        self.current_color = color
        self.phase = Phase.PLAYING
        events = [ev("color_chosen", player=player, color=color)]
        pending = self.pending_color
        if pending is not None:
            self.pending_color = None
            events += self._apply_effect(player, pending.card, pending.legal, pending.hand, pending.previous_color)
            events += self._retire_if_out(player)
        return events

    def resolve_wd4(self, user_id: int, challenge: bool) -> list[Event]:
        """Wild Draw Four-ға жауап: challenge=True — Challenge, False — 4 карта алу."""
        player = self.require_player(user_id)
        if self.phase is not Phase.CHALLENGE:
            raise GameError("no_challenge")
        if player is not self.current_player:
            raise GameError("not_your_decision", player=self.current_player)
        player.timeouts = 0
        events = self._resolve_wd4(challenge)
        self._touch()
        return events

    def _resolve_wd4(self, challenge: bool) -> list[Event]:
        self._close_uno_window()
        target = self.current_player
        pending = self.pending_wd4
        assert pending is not None
        offender = self.get_player(pending.player_id)
        self.pending_wd4 = None
        self.phase = Phase.PLAYING
        events: list[Event] = []
        if not challenge:
            self._draw(target, 4, events)
            events.append(ev("penalty", player=target, count=4, reason="wd4"))
            self._advance(1)
        elif not pending.legal:
            events.append(
                ev(
                    "challenge",
                    challenger=target,
                    player=offender,
                    guilty=True,
                    hand=pending.hand,
                    color=pending.previous_color,
                )
            )
            if offender is not None:
                self._draw(offender, 4, events)
                events.append(ev("penalty", player=offender, count=4, reason="challenge_guilty"))
            # Challenge жасаған ойыншы кезегін әдеттегідей жалғастырады.
            self.drawn_card = None
        else:
            events.append(
                ev(
                    "challenge",
                    challenger=target,
                    player=offender,
                    guilty=False,
                    hand=pending.hand,
                    color=pending.previous_color,
                )
            )
            self._draw(target, 6, events)
            events.append(ev("penalty", player=target, count=6, reason="challenge_failed"))
            self._advance(1)
        return events

    # ----------------------------------------------------------------- UNO

    def press_uno(self, user_id: int) -> list[Event]:
        """«UNO!» батырмасы: иесі басса — UNO деді, басқа ойыншы басса — ұстап алды."""
        player = self.require_player(user_id)
        if self.uno_vulnerable_id is not None and self.uno_vulnerable_id != user_id:
            return self.catch_uno(user_id)
        return self.say_uno(player.user_id)

    def say_uno(self, user_id: int) -> list[Event]:
        player = self.require_player(user_id)
        if not self.can_say_uno(player):
            raise GameError("cannot_say_uno")
        player.said_uno = True
        if self.uno_vulnerable_id == user_id:
            self.uno_vulnerable_id = None
        self._touch(turn=False)
        return [ev("uno_said", player=player)]

    def catch_uno(self, catcher_id: int) -> list[Event]:
        catcher = self.require_player(catcher_id)
        if self.uno_vulnerable_id is None:
            raise GameError("nothing_to_catch")
        if self.uno_vulnerable_id == catcher_id:
            return self.say_uno(catcher_id)
        victim = self.require_player(self.uno_vulnerable_id)
        self.uno_vulnerable_id = None
        events = [ev("uno_caught", catcher=catcher, player=victim)]
        self._draw(victim, 2, events)
        events.append(ev("penalty", player=victim, count=2, reason="uno"))
        self._touch(turn=False)
        return events

    # ------------------------------------------------- уақыт және шығу

    def timeout(self) -> list[Event]:
        """Ойыншы уақытында жүрмеді: бот оның орнына ең қарапайым әрекетті жасайды."""
        if not self.running:
            return []
        player = self.current_player
        player.timeouts += 1
        events = [ev("timeout", player=player)]
        if self.phase is Phase.CHALLENGE:
            events += self._resolve_wd4(challenge=False)
        elif self.phase is Phase.CHOOSE_COLOR:
            colors = Counter(c.color for c in player.hand if c.color is not None)
            color = colors.most_common(1)[0][0] if colors else self.rng.choice(COLORS)
            events += self._choose_color(player, color)
        elif self.drawn_card is not None:
            events.append(ev("passed", player=player))
            self._advance(1)
        else:
            self._close_uno_window()
            events += self._draw_for_turn(player, auto_pass=True)
        if player.timeouts >= MAX_TIMEOUTS and self.get_player(player.user_id):
            events += self._remove(player, "timeout")
        self._touch()
        return events

    def remove_player(self, user_id: int, reason: str = "leave") -> list[Event]:
        player = self.require_player(user_id)
        events = self._remove(player, reason)
        self._touch()
        return events

    def _remove(self, player: Player, reason: str) -> list[Event]:
        idx = self.players.index(player)
        events = [ev("player_removed", player=player, reason=reason)]

        if not self.running:
            self.players.pop(idx)
            if player.user_id == self.host_id and self.players:
                self.host_id = self.players[0].user_id
                events.append(ev("host_changed", player=self.players[0]))
            return events

        was_current = idx == self.current_index
        # Карталары алу үйіндісінің астына қайтарылады.
        self.deck = player.hand + self.deck
        player.hand = []
        if self.uno_vulnerable_id == player.user_id:
            self.uno_vulnerable_id = None
        self.players.pop(idx)
        if player.user_id == self.host_id and self.players:
            self.host_id = self.players[0].user_id
            events.append(ev("host_changed", player=self.players[0]))

        if len(self.players) < MIN_PLAYERS:
            if self.places:
                events += self._end_game()
            else:
                self.phase = Phase.FINISHED
                self.winner = self.players[0] if self.players else None
                events.append(ev("game_aborted", winner=self.winner))
            return events

        n = len(self.players)
        if idx <= self.dealer_index:
            self.dealer_index = (self.dealer_index - 1) % n
        if idx < self.current_index:
            self.current_index -= 1
        elif was_current:
            self.current_index = idx % n if self.direction == 1 else (idx - 1) % n
            self.drawn_card = None
            if self.phase is Phase.CHALLENGE:
                # Challenge күтіп тұрған ойыншы шықты — айыппұл күшін жояды.
                self.pending_wd4 = None
                self.phase = Phase.PLAYING
            elif self.pending_color is not None:
                # Wild жүрген ойыншы түс таңдамай шықты — түсті кездейсоқ таңдаймыз.
                self.pending_color = None
                self.current_color = self.rng.choice(COLORS)
                self.phase = Phase.PLAYING
                events.append(ev("color_chosen", player=None, color=self.current_color))
            events.append(ev("turn_passed", player=self.current_player))
        return events

    # ------------------------------------------------------------- аяқталу

    def _retire_if_out(self, player: Player) -> list[Event]:
        """Картасынан құтылған ойыншы келесі орынды алып, кезектен шығады."""
        if player.hand or player not in self.players:
            return []
        idx = self.players.index(player)
        self.players.pop(idx)
        self.places.append(player)
        if self.uno_vulnerable_id == player.user_id:
            self.uno_vulnerable_id = None
        events = [ev("player_finished", player=player, place=len(self.places))]
        if len(self.players) == 1:
            return events + self._end_game()
        # Карта әсерінен кейін кезек басқа ойыншыда (кемінде 3 ойыншы қалған кезде ол өзіне оралмайды).
        if idx < self.current_index:
            self.current_index -= 1
        if idx <= self.dealer_index:
            self.dealer_index = (self.dealer_index - 1) % len(self.players)
        return events

    def _end_game(self) -> list[Event]:
        """Соңғы қалған ойыншы соңғы орынды алады — ойын аяқталды."""
        self.places += self.players
        self.uno_vulnerable_id = None
        self.pending_wd4 = None
        self.pending_color = None
        self.drawn_card = None
        self.phase = Phase.FINISHED
        self.winner = self.places[0]
        return [ev("game_end", places=list(self.places))]
