"""Боттың барлық қазақша мәтіндері.

UNO, Wild, Wild Draw Four, Draw Two, Skip, Reverse, Challenge сияқты негізгі терминдер
түпнұсқа тілінде қалдырылған, қалғаны — қазақша.
"""

from __future__ import annotations

from html import escape

from .cards import DRAW_TWO, REVERSE, SKIP, WILD, WILD_DRAW_FOUR, Card, Color
from .game import MAX_PLAYERS, MAX_TIMEOUTS, Event, Game, GameError, Phase, Player

COLOR_EMOJI = {
    Color.RED: "🟥",
    Color.YELLOW: "🟨",
    Color.GREEN: "🟩",
    Color.BLUE: "🟦",
}
COLOR_NAME = {
    Color.RED: "Қызыл",
    Color.YELLOW: "Сары",
    Color.GREEN: "Жасыл",
    Color.BLUE: "Көк",
}
VALUE_NAME = {
    SKIP: "Skip",
    REVERSE: "Reverse",
    DRAW_TWO: "Draw Two (+2)",
    WILD: "Wild",
    WILD_DRAW_FOUR: "Wild Draw Four (+4)",
}
SHORT_VALUE_NAME = {SKIP: "Skip", REVERSE: "Reverse", DRAW_TWO: "+2", WILD: "Wild", WILD_DRAW_FOUR: "+4"}


def color_text(color: Color | None) -> str:
    if color is None:
        return "—"
    return f"{COLOR_EMOJI[color]} {COLOR_NAME[color]}"


def card_text(card: Card | None) -> str:
    if card is None:
        return "—"
    emoji = "🌈" if card.color is None else COLOR_EMOJI[card.color]
    return f"{emoji} {VALUE_NAME.get(card.value, card.value)}"


def card_short(card: Card) -> str:
    emoji = "🌈" if card.color is None else COLOR_EMOJI[card.color]
    return f"{emoji}{SHORT_VALUE_NAME.get(card.value, card.value)}"


def name(player: Player | None) -> str:
    if player is None:
        return "—"
    return f"<b>{escape(player.name)}</b>"


def mention(player: Player) -> str:
    return f'<a href="tg://user?id={player.user_id}">{escape(player.name)}</a>'


def mention_user(user) -> str:
    """Telegram User объектісі үшін сілтеме."""
    return f'<a href="tg://user?id={user.id}">{escape(user.full_name)}</a>'


def name_user(user) -> str:
    return f"<b>{escape(user.full_name)}</b>"


def direction_text(direction: int) -> str:
    return "сағат тілімен ↻" if direction == 1 else "сағат тіліне қарсы ↺"


def target_text(target: int) -> str:
    return "бір раунд" if target <= 0 else f"{target} ұпай"


# ------------------------------------------------------------------ батырмалар

BTN_JOIN = "➕ Қосылу"
BTN_LEAVE = "🚪 Шығу"
BTN_BEGIN = "▶️ Бастау"
BTN_TARGET = "🎯 Мақсат: {target}"
BTN_CARDS = "🃏 Карталарым"
BTN_UNO = "📢 UNO!"
BTN_CHALLENGE = "⚔️ Challenge"
BTN_ACCEPT = "✅ 4 карта алу"
BTN_NEW_GAME = "🔁 Жаңа ойын"

# ---------------------------------------------------------------- командалар

COMMANDS = [
    ("new", "Жаңа UNO ойынын құру"),
    ("join", "Ойынға қосылу"),
    ("leave", "Ойыннан шығу"),
    ("begin", "Ойынды бастау (ойын иесі)"),
    ("status", "Ойын жағдайы мен ұпайлар"),
    ("target", "Мақсат ұпайын өзгерту"),
    ("kick", "Ойыншыны шығару (ойын иесі)"),
    ("stop", "Ойынды тоқтату"),
    ("rules", "UNO ережелері"),
    ("help", "Көмек"),
]

WELCOME_PRIVATE = (
    "Сәлем! Мен — <b>UNO</b> ойынын жүргізетін ботпын 🃏\n\n"
    "Мені топқа қосыңыз да, /new командасымен жаңа ойын құрыңыз. "
    "Ойынды мен өзім басқарамын: карта таратамын, кезекті бақылаймын, ережелердің бұзылмауын қадағалаймын.\n\n"
    "📖 Ережелер: /rules\n❓ Көмек: /help"
)

WELCOME_GROUP = (
    "Сәлем! Мен — <b>UNO</b> ойынын жүргізетін ботпын 🃏\n\n"
    "Ойын бастау үшін /new деп жазыңыз. Ережелер: /rules, көмек: /help"
)

HELP = (
    "🃏 <b>UNO боты — көмек</b>\n\n"
    "<b>Командалар:</b>\n"
    "/new — жаңа ойын құру\n"
    "/join — ойынға қосылу\n"
    "/leave — ойыннан шығу\n"
    "/begin — ойынды бастау (ойын иесі)\n"
    "/target 500 — мақсат ұпайын өзгерту (0 — бір раунд)\n"
    "/status — ойын жағдайы мен ұпайлар\n"
    "/kick — ойыншыны шығару (оның хабарламасына жауап ретінде, ойын иесі)\n"
    "/stop — ойынды тоқтату (ойын иесі немесе топ әкімшісі)\n"
    "/rules — UNO ережелері\n"
    "/help — осы көмек\n\n"
    "<b>Қалай жүремін?</b>\n"
    "Кезегіңіз келгенде «🃏 Карталарым» батырмасын басыңыз немесе чатқа "
    "<code>@{bot} </code> деп жазыңыз. Ашылған стикерлердің ішінен картаны таңдаңыз:\n"
    "• жарқын карталармен жүруге болады, сұр карталармен — болмайды;\n"
    "• Wild карталары төрт түсте көрсетіледі — қалаған түсті таңдаңыз;\n"
    "• «КАРТА АЛУ» — алу үйіндісінен бір карта алу, «ӨТКІЗУ» — кезекті өткізу;\n"
    "• «UNO!» — соңғының алдындағы картамен жүрер алдында UNO деу."
)

RULES = (
    "📖 <b>UNO ережелері</b>\n\n"
    "<b>Мақсат.</b> Қолыңыздағы барлық картадан бірінші құтылу. Раунд жеңімпазы қарсыластарының "
    "қолында қалған карталардың ұпайын алады. Белгіленген ұпайды (әдетте 500) бірінші жинаған ойыншы жеңеді.\n\n"
    "<b>Десте — 108 карта.</b>\n"
    "• 4 түс: 🟥 Қызыл, 🟨 Сары, 🟩 Жасыл, 🟦 Көк\n"
    "• Әр түсте бір 0 және 1–9 сандары екі-екіден\n"
    "• Әр түсте екі-екіден Skip, Reverse, Draw Two (+2)\n"
    "• 4 Wild және 4 Wild Draw Four (+4)\n\n"
    "<b>Ойынның басталуы.</b> Әр ойыншыға 7 карта таратылады, алу үйіндісінен бір карта ашылады. "
    "Таратушының сол жағындағы ойыншы бірінші жүреді, ойын сағат тілімен жүреді. Бірінші карта:\n"
    "• Wild Draw Four болса — дестеге қайтарылып, басқа карта ашылады;\n"
    "• Skip болса — бірінші ойыншы кезегін өткізеді;\n"
    "• Reverse болса — таратушы бірінші жүреді, бағыт сағат тіліне қарсы;\n"
    "• Draw Two болса — бірінші ойыншы 2 карта алып, кезегін өткізеді;\n"
    "• Wild болса — бірінші ойыншы бастапқы түсті таңдайды.\n\n"
    "<b>Жүріс.</b> Үстіңгі картаға түсі, саны немесе белгісі бойынша сәйкес келетін картамен жүресіз. "
    "Wild пен Wild Draw Four кез келген картаның үстіне жүріледі. Жүре алмасаңыз (немесе қаламасаңыз) "
    "алу үйіндісінен 1 карта аласыз: ол жарамды болса, дәл сол картамен жүре аласыз, әйтпесе кезек "
    "келесі ойыншыға өтеді. Алу үйіндісі таусылса, тасталған карталар (үстіңгісінен басқасы) араластырылып, "
    "жаңа үйінді жасалады.\n\n"
    "<b>Арнайы карталар.</b>\n"
    "⛔ Skip — келесі ойыншы кезегін өткізеді.\n"
    "🔄 Reverse — ойын бағыты өзгереді (екі ойыншыда Skip сияқты).\n"
    "➕ Draw Two — келесі ойыншы 2 карта алып, кезегін өткізеді.\n"
    "🌈 Wild — келесі түсті өзіңіз таңдайсыз.\n"
    "🌈 Wild Draw Four — түсті таңдайсыз, келесі ойыншы 4 карта алып, кезегін өткізеді. "
    "Бұл картаны тек қолыңызда ағымдағы түстегі карта болмағанда ғана жүруге болады.\n"
    "Draw Two мен Wild Draw Four-ды бір-бірінің үстіне қосуға болмайды.\n\n"
    "<b>Challenge.</b> Wild Draw Four алған ойыншы ол ережеге қайшы жүрілді деп күдіктенсе, Challenge "
    "жасай алады — жүрген ойыншының қолы тексеріледі (оны тек Challenge жасаған адам көреді):\n"
    "• кінәлі болса — 4 картаны өзі алады, ал Challenge жасаған ойыншы әдеттегідей жүреді;\n"
    "• кінәсіз болса — Challenge жасаған ойыншы 6 карта алып, кезегін өткізеді.\n\n"
    "<b>UNO!</b> Соңғының алдындағы картамен жүргенде «UNO!» деу керек. Айтпасаңыз және келесі ойыншы "
    "жүргенше басқа біреу «📢 UNO!» батырмасын сізден бұрын басып үлгерсе — айып ретінде 2 карта аласыз.\n\n"
    "<b>Ұпай есебі.</b>\n"
    "• Сан карталары — өз мәні\n"
    "• Skip, Reverse, Draw Two — 20 ұпай\n"
    "• Wild, Wild Draw Four — 50 ұпай\n"
    "Соңғы карта Draw Two немесе Wild Draw Four болса, келесі ойыншы карталарды бәрібір алады "
    "және олар да есептеледі. Әр раундтан кейін таратушы сол жаққа ауысады."
)

# ------------------------------------------------------------------- қателер

ERRORS = {
    "not_in_game": "Сіз бұл ойынға қатыспайсыз.",
    "already_started": "Ойын басталып кеткен.",
    "already_joined": "Сіз ойынға қосылып қойғансыз.",
    "game_full": "Ойын толы ({max} ойыншы).",
    "host_only": "Бұны тек ойын иесі жасай алады.",
    "admin_only": "Бұны тек ойын иесі немесе топ әкімшісі жасай алады.",
    "bad_target": "Мақсат ұпайы қате. Мысалы: /target 500 (0 — бір раунд).",
    "not_enough_players": "Ойынды бастау үшін кемінде {min} ойыншы керек.",
    "not_started": "Ойын әлі басталған жоқ.",
    "game_over": "Ойын аяқталды.",
    "not_your_turn": "Қазір сіздің кезегіңіз емес. Кезек: {player}.",
    "decide_wd4": "Алдымен Wild Draw Four бойынша шешім қабылдаңыз: Challenge немесе 4 карта алу.",
    "choose_color_first": "Алдымен бастапқы түсті таңдаңыз.",
    "unknown_card": "Белгісіз карта.",
    "card_not_in_hand": "Бұл карта қолыңызда жоқ.",
    "only_drawn_card": "Карта алғаннан кейін тек сол алған картаңызбен жүруге болады.",
    "cannot_play": "Бұл картамен жүруге болмайды: түсі, саны немесе белгісі сәйкес келмейді.",
    "need_color": "Wild картасы үшін түс таңдау керек.",
    "already_drawn": "Сіз бұл кезекте карта алып қойдыңыз. Алған картаңызбен жүріңіз немесе өткізіңіз.",
    "draw_first": "Өткізу үшін алдымен бір карта алу керек.",
    "no_color_choice": "Қазір түс таңдау қажет емес.",
    "no_challenge": "Қазір Challenge жасауға болмайды.",
    "not_your_decision": "Бұл шешімді {player} қабылдайды.",
    "cannot_say_uno": "UNO соңғының алдындағы картамен жүрерде ғана айтылады.",
    "nothing_to_catch": "Ұстайтын ешкім жоқ — кеш қалдыңыз.",
    "in_other_game": "Сіз басқа чаттағы ойынға қатысып жатырсыз. Алдымен сол ойыннан шығыңыз (/leave).",
    "no_game": "Бұл чатта ойын жоқ. Жаңа ойын құру: /new",
    "game_exists": "Бұл чатта ойын бар. Қосылу: /join",
    "stale": "Бұл әрекет ескірген — ойын жағдайы өзгерді. Карталарыңызды қайта ашыңыз.",
    "group_only": "Ойынды топта ойнау керек. Мені топқа қосып, сол жерде /new деп жазыңыз.",
    "kick_reply": "Шығарылатын ойыншының хабарламасына жауап ретінде /kick деп жазыңыз.",
}


def error_text(error: GameError | str, **data) -> str:
    """Қате мәтіні (HTML-сіз — alert-терде де қолданылады)."""
    if isinstance(error, GameError):
        code, data = error.code, {**error.data, **data}
    else:
        code = error
    data = {k: (v.name if isinstance(v, Player) else v) for k, v in data.items()}
    return ERRORS.get(code, code).format(**data)


# --------------------------------------------------------------------- лобби


def lobby_text(game: Game) -> str:
    host = game.get_player(game.host_id)
    lines = [
        "🃏 <b>Жаңа UNO ойыны!</b>",
        f"👑 Ойын иесі: {name(host)}",
        f"🎯 Мақсат: {target_text(game.target_score)}",
        "",
        f"👥 Ойыншылар ({len(game.players)}/{MAX_PLAYERS}):",
    ]
    lines += [f"{i}. {name(p)}" for i, p in enumerate(game.players, 1)]
    lines += [
        "",
        "Қосылу үшін «➕ Қосылу» батырмасын басыңыз (немесе /join).",
        "Ойын иесі «▶️ Бастау» батырмасын басады — кемінде 2 ойыншы керек.",
    ]
    return "\n".join(lines)


def lobby_closed_text(game: Game) -> str:
    names = ", ".join(name(p) for p in game.players)
    return f"🃏 <b>UNO ойыны басталды!</b>\n👥 Ойыншылар: {names}\n🎯 Мақсат: {target_text(game.target_score)}"


# ---------------------------------------------------------------- оқиғалар

PENALTY_TEXT = {
    "draw2": "➕ {player} 2 карта алып, кезегін өткізеді.",
    "wd4": "➕ {player} 4 карта алып, кезегін өткізеді.",
    "challenge_failed": "➕ {player} 6 карта алып, кезегін өткізеді.",
    "challenge_guilty": "➕ {player} айып ретінде 4 карта алады.",
    "uno": "➕ {player} айып ретінде 2 карта алады.",
    "final": "➕ {player} соңғы карта бойынша {count} карта алады — олар да ұпайға есептеледі.",
}

REMOVED_TEXT = {
    "leave": "🚪 {player} ойыннан шықты.",
    "kicked": "🚫 {player} ойыннан шығарылды.",
    "timeout": "😴 {player} " + str(MAX_TIMEOUTS) + " рет қатарынан жүрмегені үшін ойыннан шығарылды.",
}


def event_text(event: Event, game: Game) -> str | None:
    k, d = event.kind, event.data
    if k == "round_start":
        return f"🎲 <b>{d['round']}-раунд басталды!</b> Таратушы: {name(d['dealer'])}. Әр ойыншыға 7 карта таратылды."
    if k == "start_wd4_returned":
        return "↩️ Wild Draw Four бірінші карта бола алмайды — ол дестеге қайтарылып, карталар араластырылды."
    if k == "first_card":
        return f"🃏 Бірінші карта: {card_text(d['card'])}"
    if k == "start_reverse":
        return f"🔄 Reverse: таратушы {name(d['player'])} бірінші жүреді, бағыт — сағат тіліне қарсы."
    if k == "start_wild":
        return f"🌈 Wild: {name(d['player'])} бастапқы түсті таңдайды."
    if k == "skipped":
        return f"⛔ {name(d['player'])} кезегін өткізіп жібереді."
    if k == "played":
        text = f"🃏 {name(d['player'])} жүрді: {card_text(d['card'])}"
        if d["card"].is_wild:
            text += f" → жаңа түс: {color_text(d['color'])}"
        return text
    if k == "uno_vulnerable":
        p = name(d["player"])
        return (
            f"⚠️ {p} қолында 1 карта қалды, бірақ UNO демеді! «📢 UNO!» батырмасын кім бірінші басады? "
            f"{p} үлгерсе — құтылады, басқа ойыншы үлгерсе — {p} 2 карта алады."
        )
    if k == "reversed":
        return f"🔄 Бағыт өзгерді: енді {direction_text(d['direction'])}."
    if k == "reverse_as_skip":
        return f"🔄 Екі ойыншыда Reverse Skip сияқты: {name(d['player'])} кезегін өткізеді."
    if k == "penalty":
        return PENALTY_TEXT[d["reason"]].format(player=name(d["player"]), count=d["count"])
    if k == "drew":
        return f"🃏 {name(d['player'])} бір карта алды."
    if k == "passed":
        return f"⏭ {name(d['player'])} кезегін өткізді."
    if k == "color_chosen":
        return f"🎨 {name(d['player'])} түсті таңдады: {color_text(d['color'])}."
    if k == "wd4_pending":
        return None  # шешім сұрағы кезек хабарламасында (turn_text) көрсетіледі
    if k == "challenge":
        challenger, player = name(d["challenger"]), name(d["player"])
        if d["guilty"]:
            return (
                f"⚔️ {challenger} Challenge жасады — <b>сәтті!</b> {player} қолында "
                f"{color_text(d['color'])} түсті карта бар еді, Wild Draw Four ережеге қайшы жүрілді. "
                f"Кезек {challenger} ойыншысында қалады."
            )
        return f"⚔️ {challenger} Challenge жасады — <b>сәтсіз!</b> {player} ережені бұзған жоқ."
    if k == "uno_said":
        return f"📢 {name(d['player'])}: «UNO!»"
    if k == "uno_caught":
        return f"🚨 {name(d['catcher'])} ұстап алды: {name(d['player'])} уақытында UNO демеді!"
    if k == "deck_reshuffled":
        return "♻️ Алу үйіндісі таусылды — тасталған карталар араластырылып, жаңа үйінді жасалды."
    if k == "deck_empty":
        return "🈳 Алуға карта қалмады."
    if k == "timeout":
        return f"⏰ {name(d['player'])} уақытында жүрмеді — бот оның орнына әрекет жасады."
    if k == "player_removed":
        return REMOVED_TEXT[d["reason"]].format(player=name(d["player"]))
    if k == "host_changed":
        return f"👑 Жаңа ойын иесі: {name(d['player'])}."
    if k == "turn_passed":
        return None
    if k == "game_aborted":
        text = "🛑 Ойыншылар саны жеткіліксіз — ойын аяқталды."
        if d["winner"] is not None:
            text += f"\n🏆 Жеңімпаз: {name(d['winner'])}"
        return text
    if k == "round_end":
        return round_end_text(event, game)
    if k == "game_end":
        winner = d["winner"]
        return (
            f"🎉🏆 <b>{escape(winner.name)} ойынды жеңді!</b> Жиналған ұпай: {winner.score}. Құттықтаймыз!\n"
            "Жаңа ойын бастау: /new"
        )
    return None


def round_end_text(event: Event, game: Game) -> str:
    d = event.data
    winner = d["winner"]
    lines = [
        f"🏁 {name(winner)} барлық картасынан құтылып, <b>{d['round']}-раундты</b> жеңді!",
        f"Қарсыластардың карталарынан <b>+{d['points']}</b> ұпай алды.",
    ]
    hands = d["hands"]
    if hands:
        lines += ["", "🂠 Қолда қалған карталар:"]
        for player in game.players:
            if player.user_id in hands:
                cards = hands[player.user_id]
                total = sum(c.points for c in cards)
                shown = " ".join(card_short(c) for c in cards) or "—"
                lines.append(f"• {name(player)}: {shown} ({total} ұпай)")
    lines += ["", scoreboard(game)]
    return "\n".join(lines)


def scoreboard(game: Game) -> str:
    medals = {0: "🥇", 1: "🥈", 2: "🥉"}
    lines = [f"📊 <b>Ұпайлар</b> (мақсат: {target_text(game.target_score)}):"]
    for i, player in enumerate(game.standings()):
        lines.append(f"{medals.get(i, f'{i + 1}.')} {name(player)} — {player.score}")
    return "\n".join(lines)


def events_text(events: list[Event], game: Game) -> str:
    parts = [event_text(e, game) for e in events]
    return "\n".join(p for p in parts if p)


# ----------------------------------------------------------------- жағдай


def turn_order(game: Game) -> list[Player]:
    n = len(game.players)
    return [game.players[game.next_index(i)] for i in range(n)]


def order_line(game: Game) -> str:
    return " → ".join(f"{escape(p.name)} · {len(p.hand)}" for p in turn_order(game))


def turn_text(game: Game) -> str:
    """Кезек кімде екенін көрсететін хабарлама."""
    player = game.current_player
    top = game.top_card
    top_line = f"🃏 Үстіңгі карта: {card_text(top)}"
    if top is not None and top.is_wild and game.current_color is not None:
        top_line += f" · түс: {color_text(game.current_color)}"
    if game.phase is Phase.CHOOSE_COLOR:
        head = f"🎨 {mention(player)}, бастапқы түсті таңдаңыз:"
    elif game.phase is Phase.CHALLENGE:
        head = (
            f"🌈 {mention(player)}, шешім қабылдаңыз: Wild Draw Four ережеге сай жүрілді ме?\n"
            "⚔️ Challenge жасайсыз ба, әлде ✅ 4 карта аласыз ба?"
        )
    elif game.drawn_card is not None:
        head = f"👉 {mention(player)} алған картасымен жүре алады немесе «ӨТКІЗУ» стикерін таңдайды."
    else:
        head = f"👉 Кезек: {mention(player)} · {len(player.hand)} карта"
    return "\n".join([head, top_line, f"🔁 Кезек тәртібі ({direction_text(game.direction)}):", order_line(game)])


def status_text(game: Game) -> str:
    if not game.started:
        return lobby_text(game)
    if game.phase is Phase.FINISHED:
        return "🏁 Ойын аяқталды.\n\n" + scoreboard(game)
    return f"🎲 <b>{game.round_number}-раунд</b>\n" + turn_text(game) + "\n\n" + scoreboard(game)


def plain_status(game: Game) -> str:
    """Inline сұр карталарды таңдағанда чатқа жіберілетін қысқа мәтін (HTML-сіз)."""
    if not game.running:
        return "🃏 UNO ойыны әлі басталған жоқ."
    top = game.top_card
    lines = [
        f"ℹ️ UNO · {game.round_number}-раунд",
        f"Кезек: {game.current_player.name}",
        f"Үстіңгі карта: {card_text(top)}",
    ]
    if top is not None and top.is_wild and game.current_color is not None:
        lines.append(f"Түс: {color_text(game.current_color)}")
    lines.append("Ойыншылар: " + " → ".join(f"{p.name} · {len(p.hand)}" for p in turn_order(game)))
    return "\n".join(lines)


def hand_text(cards: list[Card]) -> str:
    return " ".join(card_short(c) for c in cards) or "—"


def challenge_reveal(player_name: str, cards: list[Card]) -> str:
    text = f"{player_name} карталары: {hand_text(cards)}"
    return text if len(text) <= 200 else text[:197] + "…"


def private_status(game: Game, player: Player) -> str:
    lines = [plain_status(game), "", f"🂠 Сіздің карталарыңыз ({len(player.hand)}):", hand_text(player.sorted_hand())]
    return escape("\n".join(lines))


# ---------------------------------------------------------- inline мәтіндері

INLINE_YOUR_TURN = "✅ Сіздің кезегіңіз · үстіңгі: {top}"
INLINE_DRAWN = "Алған картаңызбен жүріңіз немесе өткізіңіз"
INLINE_WAIT = "⏳ Кезек: {player} · үстіңгі: {top}"
INLINE_DECIDE = "Топтағы батырмамен шешім қабылдаңыз (Challenge / +4)"
INLINE_CHOOSE_COLOR = "Топтағы батырмамен бастапқы түсті таңдаңыз"
INLINE_LOBBY = "Ойын әлі басталған жоқ"
INLINE_NOT_IN_GAME_TITLE = "Сіз ойында емессіз"
INLINE_NOT_IN_GAME_DESC = "Топта /new немесе /join деп жазып, ойынға қосылыңыз"
INLINE_NOT_IN_GAME_MSG = "🃏 UNO ойнайық! Жаңа ойын: /new, қосылу: /join"
INLINE_DRAW_TITLE = "Карта алу"
INLINE_PASS_TITLE = "Өткізу"
INLINE_UNO_TITLE = "UNO!"

# ---------------------------------------------------------------- басқалар

GAME_CREATED_IN_OTHER = "Бұл чатта ойын құрылып қойған."
GAME_STOPPED = "🛑 Ойынды {who} тоқтатты.\n\n{scores}"
GAME_STOPPED_LOBBY = "🛑 Ойын тоқтатылды."
JOINED = "{player} ойынға қосылды!"
JOINED_ALERT = "Сіз ойынға қосылдыңыз!"
LEFT_ALERT = "Сіз ойыннан шықтыңыз."
TARGET_SET = "🎯 Мақсат өзгерді: {target}."
STARTED_ALERT = "Ойын басталды!"
STALE = ERRORS["stale"]
TURN_REMINDER = "⏳ {player}, кезегіңіз! {seconds} секунд қалды."
NOT_GROUP_CMD = ERRORS["group_only"]
DONE = "✅"
STICKERS_START = "Стикерлер жүктелуде… Бұл бірнеше минутқа созылуы мүмкін."
STICKERS_DONE = "✅ Стикерлер дайын: {count} стикер.\n{links}"
STICKERS_FAIL = "❌ Стикерлерді жүктеу сәтсіз аяқталды: {error}"
STICKERS_ADMIN_ONLY = "Бұл команда тек бот әкімшісіне (ADMIN_ID) арналған."
PACK_DISABLED = "Дайын стикер пагы қосылмаған (STICKER_PACK бос)."
PACK_LOADING = "📦 {pack} пагы жүктелуде…"
PACK_FAIL = "❌ {pack} пагын жүктеу сәтсіз аяқталды: {error}"
PACK_PREVIEW_CAPTION = (
    "Әр стикердің астында оның пактағы нөмірі (#) мен тағайындалған картасы жазылған. "
    "«—» — әзірге ешбір картаға тағайындалмаған."
)
PRIVATE_NO_GAME = "Сіз қазір ешбір ойында емессіз. Мені топқа қосып, /new деп жазыңыз."
