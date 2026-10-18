"""Ойын контроллері: лобби, кезеңдер, таймерлер және хабарламалар.

Контроллер Telegram API-ді тікелей қолданбайды — ол ``Notifier`` арқылы хабар жібереді,
ал деректерді ``Storage`` арқылы сақтайды. Сондықтан оны толығымен тестілеуге болады.
"""

from __future__ import annotations

import asyncio
import html
import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from .db.models import FinalRow, Inventory
from .economy import win_reward
from .game import balance
from .game.engine import (
    ACTION_LABELS,
    ActionKind,
    Game,
    GameResult,
    Phase,
    Player,
    RoleRequest,
    WitchPrompt,
    assign_roles,
)
from .game.roles import FAKE_DOC_ROLES, Role, title

log = logging.getLogger(__name__)


# --- Сыртқы тәуелділіктер интерфейстері -----------------------------------------------


@dataclass(frozen=True)
class Button:
    text: str
    data: str | None = None
    url: str | None = None


Keyboard = list[list[Button]]


class Notifier(Protocol):
    async def send(self, chat_id: int, text: str, keyboard: Keyboard | None = None) -> int | None:
        """Хабарлама жіберу. Сәтсіз болса ``None`` қайтарады."""

    async def edit(
        self, chat_id: int, message_id: int, text: str, keyboard: Keyboard | None = None
    ) -> None: ...

    async def restrict(self, chat_id: int, user_id: int) -> bool: ...

    async def unrestrict(self, chat_id: int, user_id: int) -> None: ...

    async def pin(self, chat_id: int, message_id: int) -> None: ...

    async def unpin(self, chat_id: int, message_id: int) -> None: ...

    def start_link(self, payload: str) -> str: ...


class Storage(Protocol):
    async def ensure_user(self, user_id: int, username: str | None, full_name: str) -> None: ...

    async def create_game(self, chat_id: int) -> int: ...

    async def start_game(self, game_id: int, players: list[tuple[int, str]]) -> None: ...

    async def abort_game(self, game_id: int) -> list[int]: ...

    async def set_restricted(self, game_id: int, user_id: int, restricted: bool) -> None: ...

    async def finalize_game(
        self, game_id: int, winner: str | None, days: int, rows: list[FinalRow]
    ) -> bool: ...

    async def inventories(self, user_ids: list[int]) -> dict[int, Inventory]: ...

    async def queue_heads(self, user_ids: list[int]) -> list[RoleRequest]: ...

    async def stale_games(self) -> list[dict]: ...


# --- Күй ------------------------------------------------------------------------------


@dataclass
class Lobby:
    game_id: int
    chat_id: int
    chat_title: str
    owner_id: int
    deadline: float
    players: dict[int, str] = field(default_factory=dict)
    message_id: int | None = None
    started: bool = False
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    task: asyncio.Task | None = None
    update_task: asyncio.Task | None = None
    dirty: bool = False
    reminded: bool = False


@dataclass
class Session:
    game: Game
    chat_id: int
    timings: balance.Timings
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    prompts: dict[int, int] = field(default_factory=dict)   # user_id -> message_id
    restricted: set[int] = field(default_factory=set)
    witch_event: asyncio.Event = field(default_factory=asyncio.Event)
    witch_choice: bool | None = None
    witch_id: int | None = None
    last_words: dict[int, float] = field(default_factory=dict)  # user_id -> мерзімі
    task: asyncio.Task | None = None
    finished: bool = False

    @property
    def game_id(self) -> int:
        return self.game.game_id


def short(name: str, limit: int = 28) -> str:
    name = " ".join(name.split())
    return name if len(name) <= limit else name[: limit - 1] + "…"


class GameManager:
    def __init__(
        self,
        notifier: Notifier,
        storage: Storage,
        *,
        registration_seconds: float = 120,
        time_scale: float = 1.0,
        restrict_dead: bool = True,
        silence_night: bool = True,
        mute_non_players: bool = False,
        rng_factory: Callable[[], random.Random] = random.SystemRandom,
        lobby_edit_delay: float = 1.5,
    ) -> None:
        self.notifier = notifier
        self.storage = storage
        self.registration_seconds = registration_seconds
        self.time_scale = time_scale
        self.restrict_dead = restrict_dead
        self.silence_night = silence_night
        self.mute_non_players = mute_non_players
        self.rng_factory = rng_factory
        self.lobby_edit_delay = lobby_edit_delay
        self.lobbies: dict[int, Lobby] = {}          # chat_id -> Lobby
        self.lobby_by_game: dict[int, Lobby] = {}    # game_id -> Lobby
        self.sessions: dict[int, Session] = {}       # chat_id -> Session
        self.user_chat: dict[int, int] = {}          # user_id -> chat_id (лобби не ойын)
        self._background: set[asyncio.Task] = set()

    def _spawn(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self._background.add(task)
        task.add_done_callback(self._background.discard)
        return task

    # --- Сұраулар ----------------------------------------------------------------------

    def busy(self, chat_id: int) -> bool:
        return chat_id in self.lobbies or chat_id in self.sessions

    def session_for_user(self, user_id: int) -> Session | None:
        chat_id = self.user_chat.get(user_id)
        return self.sessions.get(chat_id) if chat_id is not None else None

    def in_game(self, user_id: int) -> bool:
        return user_id in self.user_chat

    def open_lobbies(self) -> list[Lobby]:
        return [lb for lb in self.lobbies.values() if not lb.started]

    def should_delete(self, chat_id: int, user_id: int) -> bool:
        """Топтағы хабарламаны өшіру керек пе (өлгендер мен түнгі тыныштық)."""
        s = self.sessions.get(chat_id)
        if s is None or s.finished or s.game.result is not None:
            return False
        p = s.game.player(user_id)
        if p is None:
            return self.mute_non_players
        if not p.alive:
            return True
        return self.silence_night and s.game.phase is Phase.NIGHT

    # --- Лобби ----------------------------------------------------------------------------

    async def open_lobby(self, chat_id: int, chat_title: str, owner_id: int) -> str | None:
        if self.busy(chat_id):
            return "Бұл чатта ойын немесе тіркелу жүріп жатыр."
        game_id = await self.storage.create_game(chat_id)
        if self.busy(chat_id):  # await кезінде басқа сұрау үлгеріп кетсе
            await self.storage.abort_game(game_id)
            return "Бұл чатта ойын немесе тіркелу жүріп жатыр."
        lobby = Lobby(
            game_id=game_id,
            chat_id=chat_id,
            chat_title=chat_title,
            owner_id=owner_id,
            deadline=time.monotonic() + self.registration_seconds,
        )
        self.lobbies[chat_id] = lobby
        self.lobby_by_game[game_id] = lobby
        lobby.message_id = await self.notifier.send(
            chat_id, self._lobby_text(lobby), self._lobby_keyboard(lobby)
        )
        if lobby.message_id is not None:
            await self.notifier.pin(chat_id, lobby.message_id)
        lobby.task = asyncio.create_task(self._lobby_timer(lobby))
        return None

    def _lobby_text(self, lobby: Lobby) -> str:
        left = max(0, int(lobby.deadline - time.monotonic()))
        names = [
            f"{i}. <a href=\"tg://user?id={uid}\">{html.escape(name)}</a>"
            for i, (uid, name) in enumerate(lobby.players.items(), 1)
        ]
        return (
            "🎲 <b>Мафия ойынына тіркелу ашық!</b>\n\n"
            f"⏳ Тіркелу аяқталуына ≈ {left} сек\n"
            f"👥 Тіркелгендер ({len(lobby.players)}/{balance.MAX_PLAYERS}):\n"
            + ("\n".join(names) if names else "— әзірге ешкім жоқ —")
            + f"\n\nОйын бастау үшін кемінде {balance.MIN_PLAYERS} ойыншы керек.\n"
            "Рөлдер мен түнгі әрекеттер ботпен жеке чатта болады."
        )

    def _lobby_keyboard(self, lobby: Lobby) -> Keyboard:
        return [[Button("🎮 Ойынға қосылу", url=self.notifier.start_link(f"join_{lobby.game_id}"))]]

    def _schedule_lobby_update(self, lobby: Lobby) -> None:
        """Лобби хабарын жаңарту. Көп адам қатар тіркелсе, өзгерістер бір өңдеуге жиналады."""
        if lobby.message_id is None or lobby.started:
            return
        lobby.dirty = True
        if lobby.update_task and not lobby.update_task.done():
            return

        async def update() -> None:
            while True:
                await asyncio.sleep(self.lobby_edit_delay)
                if lobby.started:
                    return
                lobby.dirty = False
                await self.notifier.edit(
                    lobby.chat_id, lobby.message_id, self._lobby_text(lobby), self._lobby_keyboard(lobby)
                )
                if not lobby.dirty:
                    return

        lobby.update_task = self._spawn(update())

    async def join(self, game_id: int, user_id: int, name: str, username: str | None = None) -> str:
        lobby = self.lobby_by_game.get(game_id)
        if lobby is None or lobby.started:
            return "❌ Бұл ойынға тіркелу жабық."
        if user_id in lobby.players:
            return f"✅ Сіз «{html.escape(lobby.chat_title)}» чатындағы ойынға тіркелгенсіз."
        if self.in_game(user_id):
            return "❌ Сіз басқа ойынға тіркелгенсіз немесе ойнап жатырсыз."
        if len(lobby.players) >= balance.MAX_PLAYERS:
            return f"❌ Бөлме толы ({balance.MAX_PLAYERS} ойыншы)."
        await self.storage.ensure_user(user_id, username, name)
        if lobby.started or user_id in lobby.players or self.in_game(user_id):
            return "❌ Тіркелу мүмкін болмады, қайталап көріңіз."
        if len(lobby.players) >= balance.MAX_PLAYERS:
            return f"❌ Бөлме толы ({balance.MAX_PLAYERS} ойыншы)."
        lobby.players[user_id] = name
        self.user_chat[user_id] = lobby.chat_id
        self._schedule_lobby_update(lobby)
        if len(lobby.players) >= balance.MAX_PLAYERS:
            lobby.wake.set()  # бөлме толды — бірден бастаймыз
        return (
            f"✅ Сіз «{html.escape(lobby.chat_title)}» чатындағы ойынға тіркелдіңіз! "
            f"({len(lobby.players)}/{balance.MAX_PLAYERS})\nРөліңіз осында келеді."
        )

    async def leave(self, user_id: int) -> str:
        chat_id = self.user_chat.get(user_id)
        if chat_id is None:
            return "Сіз ешбір ойында жоқсыз."
        lobby = self.lobbies.get(chat_id)
        if lobby is not None and not lobby.started and user_id in lobby.players:
            del lobby.players[user_id]
            self.user_chat.pop(user_id, None)
            self._schedule_lobby_update(lobby)
            return "👋 Сіз тіркелуден шықтыңыз."
        s = self.sessions.get(chat_id)
        if s is not None and not s.finished:
            report = s.game.desert(user_id)
            if report is None:
                return "Сіз бұл ойында тірі ойыншы емессіз."
            await self.notifier.send(chat_id, report.public)
            await self._deliver(report.private)
            await self._after_deaths(s, report.deaths, last_words=False)
            if s.game.check_winner() is not None:
                s.witch_event.set()  # Сиқыршының шешімін күтпеу
            s.wake.set()
            return "🏃 Сіз ойыннан шықтыңыз. Бұл ойын жеңіліс болып есептеледі."
        return "Сіз ешбір ойында жоқсыз."

    async def extend(self, chat_id: int, seconds: float = 30) -> str | None:
        lobby = self.lobbies.get(chat_id)
        if lobby is None or lobby.started:
            return None
        lobby.deadline += seconds
        lobby.reminded = False
        self._schedule_lobby_update(lobby)
        return f"⏳ Тіркелу {int(seconds)} секундқа ұзартылды."

    async def force_start(self, chat_id: int) -> str | None:
        lobby = self.lobbies.get(chat_id)
        if lobby is None or lobby.started:
            return "Ашық тіркелу жоқ. Жаңа ойын үшін /game жазыңыз."
        if len(lobby.players) < balance.MIN_PLAYERS:
            return (
                f"Ойын бастау үшін кемінде {balance.MIN_PLAYERS} ойыншы керек "
                f"(қазір {len(lobby.players)})."
            )
        lobby.deadline = time.monotonic()
        lobby.wake.set()
        return None

    async def _lobby_timer(self, lobby: Lobby) -> None:
        remind_at = 30
        try:
            while True:
                lobby.wake.clear()
                if lobby.started or len(lobby.players) >= balance.MAX_PLAYERS:
                    break
                left = lobby.deadline - time.monotonic()
                if left <= 0:
                    break
                if not lobby.reminded and left <= remind_at + 0.5 and self.registration_seconds > 45:
                    lobby.reminded = True
                    await self.notifier.send(
                        lobby.chat_id, f"⏳ Тіркелудің аяқталуына {remind_at} секунд қалды!"
                    )
                wait = left - remind_at if not lobby.reminded and left > remind_at + 0.5 else left
                try:
                    await asyncio.wait_for(lobby.wake.wait(), timeout=max(wait, 0.01))
                except TimeoutError:
                    pass
            if lobby.started:
                return
            if len(lobby.players) >= balance.MIN_PLAYERS:
                await self._start_game(lobby)
            else:
                await self._cancel_lobby(
                    lobby,
                    f"😔 Ойыншылар жеткіліксіз ({len(lobby.players)}/{balance.MIN_PLAYERS}). "
                    "Тіркелу жабылды. Қайта бастау үшін /game жазыңыз.",
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Лобби таймерінде қате")
            if lobby.chat_id in self.lobbies:
                await self._cancel_lobby(lobby, "⚠️ Ойынды бастау кезінде қате шықты. Тіркелу жабылды.")

    def _drop_lobby(self, lobby: Lobby) -> None:
        lobby.started = True
        self.lobbies.pop(lobby.chat_id, None)
        self.lobby_by_game.pop(lobby.game_id, None)
        if lobby.update_task and not lobby.update_task.done():
            lobby.update_task.cancel()
        if lobby.message_id is not None:
            self._spawn(self.notifier.unpin(lobby.chat_id, lobby.message_id))

    async def _cancel_lobby(self, lobby: Lobby, text: str) -> None:
        self._drop_lobby(lobby)
        for uid in lobby.players:
            if self.user_chat.get(uid) == lobby.chat_id:
                self.user_chat.pop(uid, None)
        await self.storage.abort_game(lobby.game_id)
        if lobby.message_id is not None:
            await self.notifier.edit(lobby.chat_id, lobby.message_id, "🚫 Тіркелу жабылды.")
        await self.notifier.send(lobby.chat_id, text)

    # --- Ойынды бастау ----------------------------------------------------------------------

    async def _start_game(self, lobby: Lobby) -> None:
        # Лобби сессия тіркелгенше сөздікте қалады — сол чатта жаңа ойын ашылып кетпесін.
        lobby.started = True
        user_ids = list(lobby.players)
        inventories = await self.storage.inventories(user_ids)
        requests = await self.storage.queue_heads(user_ids)
        rng = self.rng_factory()
        assignment = assign_roles(user_ids, requests, rng)
        purchases = {r.user_id: r.purchase_id for r in assignment.fulfilled}
        players: list[Player] = []
        for order, uid in enumerate(user_ids):
            role = assignment.roles[uid]
            inv = inventories.get(uid)
            p = Player(uid, lobby.players[uid], order, role=role, initial_role=role)
            if inv is not None:
                p.shield_available = inv.shields > 0
                p.vote_shield_available = inv.vote_shields > 0
                p.bullet_available = inv.piercing_bullets > 0
                if role in FAKE_DOC_ROLES and inv.fake_docs > 0:
                    p.fake_doc = p.fake_doc_activated = True
            p.purchase_id = purchases.get(uid)
            players.append(p)
        game = Game(lobby.game_id, lobby.chat_id, players, rng=rng)
        await self.storage.start_game(game.game_id, [(p.user_id, p.role.value) for p in players])
        session = Session(game=game, chat_id=lobby.chat_id,
                          timings=balance.timings(len(players), self.time_scale))
        self.sessions[lobby.chat_id] = session
        self._drop_lobby(lobby)
        if lobby.message_id is not None:
            await self.notifier.edit(
                lobby.chat_id, lobby.message_id,
                f"✅ Тіркелу аяқталды: {len(players)} ойыншы. Ойын басталды!",
            )
        failed: list[Player] = []
        for p in game.ordered():
            text = game.role_intro(p.user_id)
            if p.purchase_id is not None:
                text = "💎 Сатып алған рөліңіз берілді!\n\n" + text
            if await self.notifier.send(p.user_id, text) is None:
                failed.append(p)
        for req in assignment.unfulfilled:
            await self.notifier.send(
                req.user_id,
                f"🎭 Сіз таңдаған {title(req.role)} рөлі бұл ойында берілмеді "
                f"({len(players)} ойыншы үшін қолжетімсіз немесе басқа ойыншы бұрын сатып алған).\n"
                "Таңдауыңыз келесі ойынға сақталды. Қаласаңыз, алмазды қайтара аласыз.",
                [[Button("💎 Алмазды қайтару", data=f"rr:{req.purchase_id}")]],
            )
        comp = balance.composition(len(players))
        roles_line = ", ".join(
            f"{title(r)}{' ×' + str(c) if c > 1 else ''}" for r, c in comp.items()
        )
        text = (
            f"🎭 <b>Ойын басталды!</b> Ойыншылар: {len(players)}\n"
            "Рөлдер әр ойыншыға жеке чатта жіберілді.\n\n"
            f"Рөлдер құрамы: {roles_line}"
        )
        if failed:
            text += (
                "\n\n⚠️ Бот мына ойыншыларға жеке хабарлама жібере алмады — ботты ашып "
                "/start басыңыз: " + ", ".join(p.mention for p in failed)
            )
        await self.notifier.send(lobby.chat_id, text, self._bot_button())
        if not session.finished:  # хабарламалар жіберілгенше ойын тоқтатылмаса
            session.task = asyncio.create_task(self._run(session))

    def _bot_button(self) -> Keyboard:
        return [[Button("🤖 Ботқа өту", url=self.notifier.start_link("menu"))]]

    # --- Ойын циклі ----------------------------------------------------------------------------

    async def _run(self, s: Session) -> None:
        try:
            while not s.finished:
                await self._night(s)
                if await self._maybe_finish(s):
                    return
                await self._day(s)
                if await self._maybe_finish(s):
                    return
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Ойын циклінде қате (game_id=%s)", s.game_id)
            await self.abort(s.chat_id, "⚠️ Ойында күтпеген қате шықты, ойын тоқтатылды.")

    async def _wait(self, s: Session, timeout: float, done: Callable[[], bool]) -> None:
        def finished() -> bool:
            return s.game.result is not None or done()

        async def until_done() -> None:
            while not finished():
                s.wake.clear()
                if finished():
                    return
                await s.wake.wait()

        try:
            await asyncio.wait_for(until_done(), timeout=timeout)
        except TimeoutError:
            pass

    async def _night(self, s: Session) -> None:
        g = s.game
        await self.notifier.send(s.chat_id, g.start_night(), self._bot_button())
        s.prompts = {}
        for uid in sorted(g.expected_actors(), key=lambda u: g.players[u].order):
            await self._send_night_prompt(s, uid)
        await self._wait(s, s.timings.night, g.night_complete)
        await self._close_prompts(s, "⌛ Түн аяқталды.")
        if g.result is not None:
            return
        witch = g.resolve_night()
        choice = await self._ask_witch(s, witch) if witch is not None else None
        report = g.complete_night(choice)
        await self.notifier.send(s.chat_id, report.public)
        await self._deliver(report.private)
        await self._after_deaths(s, report.deaths, last_words=True)

    async def _day(self, s: Session) -> None:
        g = s.game
        await self.notifier.send(s.chat_id, g.day_text())
        await self._wait(s, s.timings.day, lambda: False)
        if g.result is not None:
            return
        await self.notifier.send(s.chat_id, g.start_vote(), self._bot_button())
        s.prompts = {}
        for p in g.alive():
            await self._send_vote_prompt(s, p.user_id)
        await self._wait(s, s.timings.vote, g.vote_complete)
        await self._close_prompts(s, "⌛ Дауыс беру аяқталды.")
        if g.result is not None:
            return
        report = g.resolve_vote()
        await self.notifier.send(s.chat_id, report.public)
        await self._deliver(report.private)
        await self._after_deaths(s, report.deaths, last_words=True)
        g.end_cycle()

    async def _maybe_finish(self, s: Session) -> bool:
        result = s.game.check_winner()
        if result is None:
            return False
        await self._finish(s, result)
        return True

    # --- Жеке хабарламалар ---------------------------------------------------------------------

    async def _deliver(self, notes: list[tuple[int, str]]) -> None:
        for uid, text in notes:
            await self.notifier.send(uid, text)

    def _night_keyboard(self, s: Session, user_id: int, mode: ActionKind | None = None) -> Keyboard:
        g = s.game
        options = g.night_options(user_id)
        gid, day = s.game_id, g.day
        targeted = [o for o in options if o.needs_target]
        plain = [o for o in options if not o.needs_target]
        rows: Keyboard = []
        if mode is None and len(targeted) > 1:
            rows = [[Button(o.label, data=f"m:{gid}:{day}:{o.kind.value}")] for o in targeted]
        else:
            chosen = next((o for o in targeted if o.kind is mode), targeted[0] if targeted else None)
            if chosen is not None:
                for t in chosen.targets:
                    rows.append([Button(short(g.players[t].name),
                                        data=f"n:{gid}:{day}:{chosen.kind.value}:{t}")])
            if mode is not None and len(targeted) > 1:
                rows.append([Button("⬅️ Артқа", data=f"m:{gid}:{day}:back")])
        for o in plain:
            rows.append([Button(o.label, data=f"n:{gid}:{day}:{o.kind.value}:0")])
        return rows

    async def _send_night_prompt(self, s: Session, user_id: int) -> None:
        mid = await self.notifier.send(
            user_id, s.game.night_prompt(user_id), self._night_keyboard(s, user_id)
        )
        if mid is not None:
            s.prompts[user_id] = mid

    async def _send_vote_prompt(self, s: Session, user_id: int) -> None:
        g = s.game
        rows = [
            [Button(short(g.players[t].name), data=f"v:{s.game_id}:{g.day}:{t}")]
            for t in g.vote_candidates(user_id)
        ]
        rows.append([Button("🤐 Қалыс қалу", data=f"v:{s.game_id}:{g.day}:0")])
        mid = await self.notifier.send(
            user_id, f"🗳 <b>{g.day}-күн.</b> Кімді дарға асу керек деп ойлайсыз?", rows
        )
        if mid is not None:
            s.prompts[user_id] = mid

    async def _close_prompts(self, s: Session, text: str) -> None:
        prompts, s.prompts = s.prompts, {}
        for uid, mid in prompts.items():
            await self.notifier.edit(uid, mid, text)

    async def _ask_witch(self, s: Session, prompt: WitchPrompt) -> bool:
        s.witch_choice = None
        s.witch_id = prompt.witch_id
        s.witch_event.clear()
        gid, day = s.game_id, s.game.day
        mid = await self.notifier.send(
            prompt.witch_id,
            s.game.witch_prompt_text(prompt),
            [[Button("⚔️ Жазалау", data=f"w:{gid}:{day}:1"),
              Button("🕊 Кешіру", data=f"w:{gid}:{day}:0")]],
        )
        if mid is not None:
            try:
                await asyncio.wait_for(s.witch_event.wait(), timeout=s.timings.witch)
            except TimeoutError:
                await self.notifier.edit(prompt.witch_id, mid, "⌛ Уақыт бітті — сіз кешірдіңіз.")
        s.witch_id = None
        return bool(s.witch_choice)

    async def _after_deaths(self, s: Session, deaths: list[int], last_words: bool) -> None:
        for uid in deaths:
            if last_words and s.game.result is None:
                s.last_words[uid] = time.monotonic() + s.timings.day + s.timings.vote
                await self.notifier.send(
                    uid, "💬 Соңғы сөзіңізді жазыңыз — ол ортақ чатқа жіберіледі (бір хабарлама)."
                )
            if self.restrict_dead and await self.notifier.restrict(s.chat_id, uid):
                s.restricted.add(uid)
                await self.storage.set_restricted(s.game_id, uid, True)

    # --- Ойыншы әрекеттері (callback-тер) ------------------------------------------------------

    def _session_by_game(self, game_id: int) -> Session | None:
        return next((s for s in self.sessions.values() if s.game_id == game_id), None)

    async def choose_mode(self, user_id: int, game_id: int, day: int, kind: str) -> tuple[str, Keyboard | None]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day or s.game.phase is not Phase.NIGHT or user_id in s.game.actions:
            return "⌛ Бұл таңдау ескірген.", None
        mode = None if kind == "back" else ActionKind(kind)
        text = s.game.night_prompt(user_id)
        if mode is not None:
            text += f"\n\n{ACTION_LABELS[mode]}: ойыншыны таңдаңыз."
        return text, self._night_keyboard(s, user_id, mode)

    async def night_action(
        self, user_id: int, game_id: int, day: int, kind: str, target: int
    ) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day:
            return False, "⌛ Бұл таңдау ескірген."
        try:
            action = ActionKind(kind)
        except ValueError:
            return False, "Белгісіз әрекет."
        g = s.game
        result = g.submit_action(user_id, action, target or None)
        if not result.ok:
            return False, result.message
        s.prompts.pop(user_id, None)
        actor = g.players[user_id]
        if action is ActionKind.MAFIA_KILL:
            label = "Дон" if actor.role is Role.DON else "Мафия"
            note = f"🗳 {label} {actor.mention}: {g.players[target].mention}"
            for mate in g.team_of(user_id):
                await self.notifier.send(mate.user_id, note)
        elif action is ActionKind.PROTECT:
            for mate in g.team_of(user_id):
                await self.notifier.send(
                    mate.user_id, f"🛡 Бас қорғаушы бүгін {g.players[target].mention} қорғауды таңдады."
                )
        s.wake.set()
        return True, result.message

    async def vote(self, user_id: int, game_id: int, day: int, target: int) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day:
            return False, "⌛ Бұл дауыс беру ескірген."
        result = s.game.submit_vote(user_id, target or None)
        if result.ok:
            s.prompts.pop(user_id, None)
            s.wake.set()
        return result.ok, result.message

    async def witch_decision(self, user_id: int, game_id: int, day: int, punish: bool) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day or s.witch_id != user_id or s.witch_event.is_set():
            return False, "⌛ Бұл шешім ескірген."
        s.witch_choice = punish
        s.witch_event.set()
        return True, ("⚔️ Шабуылдаушы жазаланады." if punish else "🕊 Сіз кешірдіңіз.")

    async def private_text(self, user_id: int, text: str) -> bool:
        """Ойын кезіндегі жеке хабарлама: соңғы сөз немесе команда ішіндегі чат."""
        s = self.session_for_user(user_id)
        if s is None or s.finished:
            return False
        g = s.game
        p = g.player(user_id)
        if p is None:
            return False
        body = html.escape(text[:1000])
        deadline = s.last_words.pop(user_id, None)
        if deadline is not None and deadline >= time.monotonic() and not p.alive:
            await self.notifier.send(s.chat_id, f"💬 {p.mention} соңғы сөзі:\n<i>{body}</i>")
            await self.notifier.send(user_id, "✅ Соңғы сөзіңіз жіберілді.")
            return True
        mates = g.team_of(user_id)
        if not mates:
            return False
        for mate in mates:
            await self.notifier.send(mate.user_id, f"💬 {title(p.role)} {p.mention}:\n{body}")
        return True

    # --- Аяқтау және тоқтату ----------------------------------------------------------------------

    async def _finish(self, s: Session, result: GameResult) -> None:
        if s.finished:
            return
        s.finished = True
        g = s.game
        reward = win_reward(g.size)
        rewards = {uid: reward for uid in result.winners}
        rows = [
            FinalRow(
                user_id=p.user_id,
                final_role=p.role.value,
                alive=p.alive,
                won=p.user_id in result.winners,
                reward=rewards.get(p.user_id, 0),
                deserted=p.deserted,
                used_shield=p.shield_used,
                used_vote_shield=p.vote_shield_used,
                used_bullet=p.bullet_used,
                used_fake_doc=p.fake_doc_activated,
                purchase_id=p.purchase_id,
            )
            for p in g.ordered()
        ]
        try:
            saved = await self.storage.finalize_game(
                g.game_id, result.winner.value if result.winner else None, g.day, rows
            )
        except Exception:
            log.exception("Ойын нәтижесін сақтау мүмкін болмады (game_id=%s)", g.game_id)
            saved = False
        if not saved:
            rewards = {}
        await self.notifier.send(s.chat_id, g.final_text(rewards))
        await self._release(s)
        for p in g.ordered():
            if p.user_id in result.winners:
                bonus = f" +{rewards[p.user_id]} ₸" if p.user_id in rewards else ""
                await self.notifier.send(p.user_id, f"🏆 Ойын аяқталды — сіз жеңдіңіз!{bonus}")
            else:
                await self.notifier.send(p.user_id, "🏁 Ойын аяқталды. Бұл жолы жеңіліс... Келесі жолы сәттілік!")

    async def _release(self, s: Session) -> None:
        for uid in list(s.restricted):
            await self.notifier.unrestrict(s.chat_id, uid)
            await self.storage.set_restricted(s.game_id, uid, False)
        s.restricted.clear()
        self.sessions.pop(s.chat_id, None)
        for uid in s.game.players:
            if self.user_chat.get(uid) == s.chat_id:
                self.user_chat.pop(uid, None)

    async def abort(self, chat_id: int, text: str = "🛑 Ойын тоқтатылды.") -> bool:
        lobby = self.lobbies.get(chat_id)
        if lobby is not None:
            if lobby.task and lobby.task is not asyncio.current_task():
                lobby.task.cancel()
            await self._cancel_lobby(lobby, text)
            return True
        s = self.sessions.get(chat_id)
        if s is None or s.finished:
            return False
        s.finished = True
        if s.task and s.task is not asyncio.current_task():
            s.task.cancel()
        await self._close_prompts(s, "🛑 Ойын тоқтатылды.")
        await self.storage.abort_game(s.game_id)
        await self._release(s)
        await self.notifier.send(chat_id, text)
        return True

    async def shutdown(self) -> None:
        for chat_id in list(self.lobbies) + list(self.sessions):
            try:
                await self.abort(chat_id, "⚠️ Бот тоқтатылды, ойын тоқтатылды.")
            except Exception:  # pragma: no cover
                log.exception("Ойынды тоқтату кезінде қате")

    async def recover_stale(self) -> None:
        """Бот қайта іске қосылғанда аяқталмай қалған ойындарды тоқтатып, шектеулерді алу."""
        for g in await self.storage.stale_games():
            restricted = await self.storage.abort_game(g["game_id"])
            for uid in restricted:
                await self.notifier.unrestrict(g["chat_id"], uid)
            if g["status"] == "running":
                await self.notifier.send(
                    g["chat_id"], "⚠️ Бот қайта іске қосылды, алдыңғы ойын тоқтатылды. Жаңа ойын: /game"
                )
