import random
from collections import Counter

import pytest

from unobot import game as game_module
from unobot.cards import (
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
from unobot.game import Game, GameError, Phase

R, Y, G, B = Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE


def c(key: str) -> Card:
    return Card.from_key(key)


class NoShuffle(random.Random):
    """Араластырмайтын, таратушы ретінде әрқашан бірінші ойыншыны таңдайтын генератор."""

    def shuffle(self, x, *args, **kwargs):
        return None

    def randrange(self, *args, **kwargs):
        return 0


def make_game(n: int = 3) -> Game:
    game = Game(chat_id=1, host_id=1, rng=NoShuffle())
    for uid in range(1, n + 1):
        game.add_player(uid, f"P{uid}")
    return game


def arrange(game: Game, hands, top: str, current: int = 0, color: Color | None = None, deck=None):
    """Ойынды қолмен берілген күйге келтіру."""
    if not game.started:
        game.start(game.host_id)
    for player, hand in zip(game.players, hands, strict=True):
        player.hand = [c(k) for k in hand]
        player.said_uno = False
    game.discard = [c(top)]
    game.current_color = color if color is not None else c(top).color
    game.current_index = current
    game.direction = 1
    game.phase = Phase.PLAYING
    game.drawn_card = None
    game.pending_wd4 = None
    game.uno_vulnerable_id = None
    if deck is not None:
        game.deck = [c(k) for k in deck]
    return game


def kinds(events):
    return [e.kind for e in events]


def total_cards(game: Game) -> int:
    return len(game.deck) + len(game.discard) + sum(len(p.hand) for p in game.players)


# ------------------------------------------------------------------ десте


def test_deck_has_108_official_cards():
    deck = new_deck()
    assert len(deck) == 108
    counts = Counter(card.key for card in deck)
    for color in COLORS:
        assert counts[f"{color.value}_0"] == 1
        for value in [str(n) for n in range(1, 10)] + [SKIP, REVERSE, DRAW_TWO]:
            assert counts[f"{color.value}_{value}"] == 2
    assert counts[WILD] == 4
    assert counts[WILD_DRAW_FOUR] == 4


# ---------------------------------------------------------------- бастау


def test_needs_two_players_and_host():
    game = make_game(1)
    with pytest.raises(GameError) as err:
        game.start(1)
    assert err.value.code == "not_enough_players"
    game.add_player(2, "P2")
    with pytest.raises(GameError) as err:
        game.start(2)
    assert err.value.code == "host_only"


def test_max_ten_players():
    game = make_game(10)
    with pytest.raises(GameError) as err:
        game.add_player(11, "P11")
    assert err.value.code == "game_full"


def deck_with_first(monkeypatch, first_cards: list[str]):
    """Тарату біткен соң ашылатын карталарды белгілеу (pop() соңынан алады)."""

    def fake_deck():
        deck = new_deck()
        for key in first_cards:
            deck.remove(c(key))
        filler, dealt = deck[: len(deck) - 21], deck[len(deck) - 21 :]
        return filler + [c(k) for k in reversed(first_cards)] + dealt

    monkeypatch.setattr(game_module, "new_deck", fake_deck)


def test_start_deals_seven_and_left_of_dealer_starts(monkeypatch):
    deck_with_first(monkeypatch, ["red_5"])
    game = make_game(3)
    events = game.start(1)
    assert all(len(p.hand) == 7 for p in game.players)
    assert game.top_card == c("red_5")
    assert game.dealer_index == 0
    assert game.current_index == 1
    assert kinds(events)[:2] == ["game_start", "first_card"]
    assert total_cards(game) == 108


def test_start_wild_draw_four_is_returned(monkeypatch):
    deck_with_first(monkeypatch, ["wild4", "blue_3"])
    game = make_game(3)
    events = game.start(1)
    assert "start_wd4_returned" in kinds(events)
    assert game.top_card == c("blue_3")
    assert total_cards(game) == 108


def test_start_skip_skips_first_player(monkeypatch):
    deck_with_first(monkeypatch, ["green_skip"])
    game = make_game(3)
    game.start(1)
    assert game.current_index == 2


def test_start_reverse_dealer_plays_first(monkeypatch):
    deck_with_first(monkeypatch, ["green_reverse"])
    game = make_game(3)
    game.start(1)
    assert game.current_index == 0
    assert game.direction == -1
    assert game.next_index() == 2


def test_start_draw_two(monkeypatch):
    deck_with_first(monkeypatch, ["yellow_draw2"])
    game = make_game(3)
    game.start(1)
    assert len(game.players[1].hand) == 9
    assert game.current_index == 2


def test_start_wild_first_player_chooses_color(monkeypatch):
    deck_with_first(monkeypatch, ["wild"])
    game = make_game(3)
    game.start(1)
    assert game.phase is Phase.CHOOSE_COLOR
    assert game.current_index == 1
    with pytest.raises(GameError):
        game.choose_color(1, R)
    with pytest.raises(GameError) as err:
        game.draw(2)
    assert err.value.code == "choose_color_first"
    game.choose_color(2, B)
    assert game.current_color is B
    assert game.phase is Phase.PLAYING
    assert game.current_index == 1  # таңдаған ойыншы өзі жүреді


# ---------------------------------------------------------------- жүрістер


def test_match_by_color_number_and_symbol():
    game = make_game(3)
    arrange(game, [["red_9", "blue_5", "green_skip", "yellow_2"], ["red_1"], ["red_2"]], top="red_5")
    assert game.can_play(c("red_9"))
    assert game.can_play(c("blue_5"))
    assert not game.can_play(c("green_skip"))
    assert not game.can_play(c("yellow_2"))
    game.discard.append(c("blue_skip"))
    game.current_color = B
    assert game.can_play(c("green_skip"))


def test_cannot_play_unmatched_card_or_out_of_turn():
    game = make_game(3)
    arrange(game, [["yellow_2", "red_3"], ["red_1"], ["red_2"]], top="red_5")
    with pytest.raises(GameError) as err:
        game.play_card(1, "yellow_2")
    assert err.value.code == "cannot_play"
    with pytest.raises(GameError) as err:
        game.play_card(2, "red_1")
    assert err.value.code == "not_your_turn"
    with pytest.raises(GameError) as err:
        game.play_card(1, "blue_9")
    assert err.value.code == "card_not_in_hand"


def test_number_card_passes_turn():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "red_3")
    assert game.current_index == 1
    assert game.top_card == c("red_3")


def test_wild_then_player_chooses_color():
    game = make_game(3)
    arrange(game, [["wild", "blue_1", "red_1"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "wild")
    assert game.phase is Phase.CHOOSE_COLOR
    assert game.current_index == 0  # түсті жүрген ойыншы таңдайды
    with pytest.raises(GameError) as err:
        game.choose_color(2, G)
    assert err.value.code == "not_your_color"
    with pytest.raises(GameError) as err:
        game.play_card(1, "blue_1")
    assert err.value.code == "choose_color_first"
    events = game.choose_color(1, G)
    assert kinds(events) == ["color_chosen"]
    assert game.phase is Phase.PLAYING
    assert game.current_color is G
    assert game.current_index == 1
    assert game.can_play(c("green_4"))
    assert not game.can_play(c("red_4"))


def test_wild_with_color_in_one_step():
    game = make_game(3)
    arrange(game, [["wild", "blue_1", "red_1"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "wild", G)
    assert game.current_color is G
    assert game.current_index == 1


def test_wild_draw_four_color_then_challenge():
    game = make_game(3)
    arrange(game, [["wild4", "red_1", "blue_2"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 6)
    game.play_card(1, "wild4")
    assert game.phase is Phase.CHOOSE_COLOR
    assert len(game.players[1].hand) == 1  # түс таңдалғанша айыппұл жоқ
    events = game.choose_color(1, B)
    assert kinds(events) == ["color_chosen", "wd4_pending"]
    assert game.phase is Phase.CHALLENGE
    assert game.current_index == 1
    events = game.resolve_wd4(2, challenge=True)
    challenge = next(e for e in events if e.kind == "challenge")
    assert challenge["guilty"] is True  # қолында қызыл карта бар еді
    assert challenge["hand"] == [c("red_1"), c("blue_2")]
    assert game.current_color is B


def test_wild_as_last_card_player_still_chooses_color():
    game = make_game(3)
    arrange(game, [["wild4"], ["red_1", "red_2"], ["red_3", "red_4"]], top="red_5", deck=["green_9"] * 6)
    game.players[0].said_uno = True
    game.play_card(1, "wild4")
    assert game.phase is Phase.CHOOSE_COLOR
    events = game.choose_color(1, B)
    assert kinds(events) == ["color_chosen", "wd4_pending", "player_finished"]
    assert [p.user_id for p in game.places] == [1]
    assert game.phase is Phase.CHALLENGE
    assert game.current_player.user_id == 2
    # Соңғы карта болғандықтан Wild Draw Four әрқашан заңды
    game.resolve_wd4(2, challenge=True)
    assert len(game.players[0].hand) == 8
    assert game.current_player.user_id == 3


def test_timeout_while_choosing_color_applies_card():
    game = make_game(3)
    arrange(game, [["wild", "blue_1", "blue_2"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "wild")
    events = game.timeout()
    assert "color_chosen" in kinds(events)
    assert game.current_color is B  # қолындағы ең көп түс
    assert game.current_index == 1


def test_player_leaves_while_choosing_color():
    game = make_game(3)
    arrange(game, [["wild", "blue_1", "blue_2"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "wild")
    events = game.remove_player(1)
    assert "color_chosen" in kinds(events)
    assert game.phase is Phase.PLAYING
    assert game.current_color is not None
    assert game.current_player.user_id == 2


def test_skip():
    game = make_game(3)
    arrange(game, [["red_skip", "blue_1"], ["red_1"], ["red_2"]], top="red_5")
    events = game.play_card(1, "red_skip")
    assert "skipped" in kinds(events)
    assert game.current_index == 2


def test_reverse_three_players():
    game = make_game(3)
    arrange(game, [["red_reverse", "blue_1"], ["red_1"], ["red_2"]], top="red_5")
    game.play_card(1, "red_reverse")
    assert game.direction == -1
    assert game.current_index == 2


def test_reverse_two_players_acts_as_skip():
    game = make_game(2)
    arrange(game, [["red_reverse", "blue_1"], ["red_1"]], top="red_5")
    events = game.play_card(1, "red_reverse")
    assert "reverse_as_skip" in kinds(events)
    assert game.current_index == 0


def test_draw_two_next_draws_and_loses_turn():
    game = make_game(3)
    arrange(game, [["red_draw2", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["blue_7"] * 5)
    game.play_card(1, "red_draw2")
    assert len(game.players[1].hand) == 3
    assert game.current_index == 2


def test_draw_two_cannot_be_stacked_on_draw_two_effect():
    game = make_game(3)
    arrange(game, [["red_draw2", "blue_1"], ["green_draw2"], ["red_2"]], top="red_5", deck=["blue_7"] * 5)
    game.play_card(1, "red_draw2")
    # Келесі ойыншы өз Draw Two-ын салып құтыла алмайды — кезегі өтіп кетті.
    with pytest.raises(GameError):
        game.play_card(2, "green_draw2")


def test_draw_playable_card_then_play_only_it():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9", "red_8"])
    events = game.draw(1)
    assert kinds(events) == ["drew"]
    assert game.drawn_card == c("red_8")
    with pytest.raises(GameError) as err:
        game.play_card(1, "red_3")
    assert err.value.code == "only_drawn_card"
    with pytest.raises(GameError) as err:
        game.draw(1)
    assert err.value.code == "already_drawn"
    game.play_card(1, "red_8")
    assert game.current_index == 1


def test_draw_playable_card_and_pass():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["red_8"])
    with pytest.raises(GameError) as err:
        game.pass_turn(1)
    assert err.value.code == "draw_first"
    game.draw(1)
    game.pass_turn(1)
    assert game.current_index == 1
    assert c("red_8") in game.players[0].hand


def test_draw_unplayable_card_passes_automatically():
    game = make_game(3)
    arrange(game, [["blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"])
    events = game.draw(1)
    assert kinds(events) == ["drew", "passed"]
    assert game.current_index == 1


def test_draw_allowed_even_with_playable_cards():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"])
    game.draw(1)
    assert game.current_index == 1


def test_reshuffle_discard_when_deck_empty():
    game = make_game(3)
    arrange(game, [["blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=[])
    game.discard = [c("green_1"), c("green_2"), c("red_5")]
    events = game.draw(1)
    assert "deck_reshuffled" in kinds(events)
    assert game.discard == [c("red_5")]
    assert len(game.players[0].hand) == 2


# ------------------------------------------------------ Wild Draw Four


def test_wd4_accept():
    game = make_game(3)
    arrange(game, [["wild4", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 6)
    events = game.play_card(1, "wild4", B)
    assert kinds(events)[-1] == "wd4_pending"
    assert game.phase is Phase.CHALLENGE
    assert game.current_index == 1
    with pytest.raises(GameError) as err:
        game.draw(2)
    assert err.value.code == "decide_wd4"
    with pytest.raises(GameError):
        game.resolve_wd4(3, challenge=False)
    game.resolve_wd4(2, challenge=False)
    assert len(game.players[1].hand) == 5
    assert game.current_index == 2
    assert game.current_color is B


def test_wd4_challenge_guilty():
    game = make_game(3)
    # Қолында қызыл карта бар — Wild Draw Four ережеге қайшы.
    arrange(game, [["wild4", "red_1", "blue_2"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 6)
    game.play_card(1, "wild4", B)
    events = game.resolve_wd4(2, challenge=True)
    challenge = next(e for e in events if e.kind == "challenge")
    assert challenge["guilty"] is True
    assert challenge["hand"] == [c("red_1"), c("blue_2")]
    assert len(game.players[0].hand) == 6
    assert len(game.players[1].hand) == 1
    assert game.current_index == 1  # Challenge жасаған ойыншы жүреді
    assert game.phase is Phase.PLAYING
    assert game.current_color is B


def test_wd4_challenge_innocent():
    game = make_game(3)
    # Қызыл карта жоқ — тек басқа түстер (сәйкес сан болса да заңды).
    arrange(game, [["wild4", "blue_5", "green_2"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 6)
    game.play_card(1, "wild4", Y)
    events = game.resolve_wd4(2, challenge=True)
    assert next(e for e in events if e.kind == "challenge")["guilty"] is False
    assert len(game.players[1].hand) == 7
    assert game.current_index == 2


def test_wd4_legality_uses_chosen_wild_color():
    game = make_game(3)
    # Үстінде Wild, таңдалған түс — жасыл. Қолдағы қызыл карта есепке алынбайды.
    arrange(game, [["wild4", "red_5", "red_2"], ["red_1"], ["red_2"]], top="wild", color=G, deck=["blue_9"] * 6)
    game.play_card(1, "wild4", R)
    events = game.resolve_wd4(2, challenge=True)
    assert next(e for e in events if e.kind == "challenge")["guilty"] is False


# ------------------------------------------------------------------- UNO


def test_say_uno_before_playing_is_safe():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5")
    game.say_uno(1)
    events = game.play_card(1, "red_3")
    assert "uno_vulnerable" not in kinds(events)
    assert game.uno_vulnerable_id is None


def test_cannot_say_uno_with_many_cards():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1", "green_2"], ["red_1"], ["red_2"]], top="red_5")
    with pytest.raises(GameError) as err:
        game.say_uno(1)
    assert err.value.code == "cannot_say_uno"


def test_forgot_uno_caught_draws_two():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1", "red_9"], ["red_2"]], top="red_5", deck=["green_9"] * 4)
    events = game.play_card(1, "red_3")
    assert "uno_vulnerable" in kinds(events)
    events = game.press_uno(3)
    assert "uno_caught" in kinds(events)
    assert len(game.players[0].hand) == 3
    assert game.uno_vulnerable_id is None


def test_forgot_uno_but_said_it_first():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1", "red_9"], ["red_2"]], top="red_5")
    game.play_card(1, "red_3")
    events = game.press_uno(1)
    assert kinds(events) == ["uno_said"]
    with pytest.raises(GameError) as err:
        game.press_uno(3)
    assert err.value.code in ("nothing_to_catch", "cannot_say_uno")
    assert len(game.players[0].hand) == 1


def test_uno_window_closes_when_next_player_acts():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1", "red_9", "red_8"], ["red_2"]], top="red_5")
    game.play_card(1, "red_3")
    game.play_card(2, "red_1")
    with pytest.raises(GameError) as err:
        game.catch_uno(3)
    assert err.value.code == "nothing_to_catch"
    assert len(game.players[0].hand) == 1


# ------------------------------------------------------------- орындар


def test_first_out_takes_first_place_and_game_continues():
    game = make_game(3)
    arrange(game, [["red_3"], ["blue_7", "wild"], ["yellow_4", "wild4"]], top="red_5")
    game.players[0].said_uno = True
    events = game.play_card(1, "red_3")
    finished = next(e for e in events if e.kind == "player_finished")
    assert finished["place"] == 1
    assert game.running
    assert [p.user_id for p in game.players] == [2, 3]
    assert game.current_player.user_id == 2


def test_game_continues_until_one_player_left():
    game = make_game(3)
    arrange(game, [["red_3"], ["red_7"], ["yellow_4", "green_4"]], top="red_5")
    for player in game.players:
        player.said_uno = True
    game.play_card(1, "red_3")  # 1-орын
    assert game.running
    assert game.current_player.user_id == 2
    events = game.play_card(2, "red_7")  # 2-орын, 3-ойыншы жалғыз қалды
    assert kinds(events)[-2:] == ["player_finished", "game_end"]
    assert game.phase is Phase.FINISHED
    assert [p.user_id for p in game.places] == [1, 2, 3]
    assert game.winner.user_id == 1


def test_two_players_last_card_ends_game():
    game = make_game(2)
    arrange(game, [["red_3"], ["wild", "wild4"]], top="red_5")
    game.players[0].said_uno = True
    events = game.play_card(1, "red_3")
    assert kinds(events)[-2:] == ["player_finished", "game_end"]
    assert [p.user_id for p in events[-1]["places"]] == [1, 2]
    assert game.phase is Phase.FINISHED


def test_last_card_skip_still_skips():
    game = make_game(4)
    arrange(game, [["red_skip"], ["red_1", "red_2"], ["red_3", "red_4"], ["red_6", "red_7"]], top="red_5")
    game.players[0].said_uno = True
    events = game.play_card(1, "red_skip")
    assert kinds(events) == ["played", "skipped", "player_finished"]
    assert game.current_player.user_id == 3
    assert [p.user_id for p in game.players] == [2, 3, 4]


def test_leave_after_someone_finished_ends_with_places():
    game = make_game(3)
    arrange(game, [["red_3"], ["blue_7", "wild"], ["yellow_4", "wild4"]], top="red_5")
    game.players[0].said_uno = True
    game.play_card(1, "red_3")
    events = game.remove_player(3)
    assert kinds(events)[-1] == "game_end"
    assert [p.user_id for p in game.places] == [1, 2]


# ------------------------------------------------------ шығу және уақыт


def test_current_player_leaves_turn_passes():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5", current=1)
    game.remove_player(2)
    assert [p.user_id for p in game.players] == [1, 3]
    assert game.current_player.user_id == 3
    assert total_cards(game) == len(game.deck) + len(game.discard) + 3


def test_leave_until_one_player_aborts():
    game = make_game(2)
    arrange(game, [["red_3"], ["red_1"]], top="red_5")
    events = game.remove_player(2)
    assert "game_aborted" in kinds(events)
    assert game.phase is Phase.FINISHED


def test_lobby_host_leaves_host_changes():
    game = make_game(3)
    game.remove_player(1)
    assert game.host_id == 2


def test_timeout_draws_and_passes():
    game = make_game(3)
    arrange(game, [["red_3", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["red_9"])
    events = game.timeout()
    assert kinds(events)[:3] == ["timeout", "drew", "passed"]
    assert game.current_index == 1


def test_timeout_accepts_wd4():
    game = make_game(3)
    arrange(game, [["wild4", "blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 6)
    game.play_card(1, "wild4", B)
    game.timeout()
    assert len(game.players[1].hand) == 5
    assert game.current_index == 2


def test_three_timeouts_remove_player():
    game = make_game(3)
    arrange(game, [["blue_1"], ["red_1"], ["red_2"]], top="red_5", deck=["green_9"] * 10)
    game.players[0].timeouts = 2
    events = game.timeout()
    assert "player_removed" in kinds(events)
    assert game.get_player(1) is None


# --------------------------------------------------------- симуляция


def random_move(game: Game, rng: random.Random):
    player = game.current_player
    if rng.random() < 0.05:
        try:
            game.press_uno(rng.choice(game.players).user_id)
        except GameError:
            pass
    if game.phase is Phase.CHOOSE_COLOR:
        return game.choose_color(player.user_id, rng.choice(COLORS))
    if game.phase is Phase.CHALLENGE:
        return game.resolve_wd4(player.user_id, rng.random() < 0.5)
    if len(player.hand) == 2 and rng.random() < 0.7 and game.can_say_uno(player):
        game.say_uno(player.user_id)
    playable = game.playable_cards(player)
    if playable and rng.random() < 0.9:
        card = rng.choice(playable)
        color = rng.choice(COLORS) if card.is_wild and rng.random() < 0.3 else None  # әйтпесе батырмамен
        return game.play_card(player.user_id, card.key, color)
    if game.drawn_card is not None:
        return game.pass_turn(player.user_id)
    if rng.random() < 0.02:
        return game.timeout()
    return game.draw(player.user_id)


@pytest.mark.parametrize("seed", range(60))
def test_random_games_keep_invariants(seed):
    from unobot import texts

    rng = random.Random(seed)
    n = 2 + seed % 9
    game = Game(chat_id=1, host_id=1, rng=random.Random(seed))
    for uid in range(1, n + 1):
        game.add_player(uid, f"P{uid}")
    events = game.start(1)
    texts.events_text(events, game)
    for _ in range(20000):
        if game.phase is Phase.FINISHED:
            break
        events = random_move(game, rng)
        texts.events_text(events, game)
        if game.running:
            texts.turn_text(game)
            assert total_cards(game) == 108
            assert game.current_color is not None or game.phase is Phase.CHOOSE_COLOR
    assert game.phase is Phase.FINISHED
    assert game.winner is not None
