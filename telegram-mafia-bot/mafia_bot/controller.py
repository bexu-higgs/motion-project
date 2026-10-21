"""Ойын контроллері: лобби, кезеңдер, таймерлер, хабарламалар және топ модерациясы.

Контроллер Telegram API-ді тікелей қолданбайды — ол ``Notifier`` арқылы хабар жібереді,
ал деректерді ``Storage`` арқылы сақтайды. Сондықтан оны толығымен тестілеуге болады.
"""

from __future__ import annotations

import asyncio
import html
import logging
import random
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

from . import i18n
from .db.models import FinalRow, Inventory
from .economy import HIGGS_REWARD_MULTIPLIER, win_reward
from .game import balance
from .game.engine import (
    AFK_NIGHTS,
    ActionKind,
    Game,
    GameResult,
    Phase,
    Player,
    Report,
    RoleRequest,
    WitchPrompt,
    assign_roles,
)
from .game.roles import FAKE_DOC_ROLES, Role

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

    async def delete(self, chat_id: int, message_id: int) -> None: ...

    async def restrict(self, chat_id: int, user_id: int, seconds: float) -> bool: ...

    async def unrestrict(self, chat_id: int, user_id: int) -> None: ...

    async def pin(self, chat_id: int, message_id: int) -> None: ...

    async def unpin(self, chat_id: int, message_id: int) -> None: ...

    def start_link(self, payload: str) -> str: ...

    def chat_link(self) -> str:
        """Ботпен жеке чатқа жай сілтеме (/start жіберілмейді)."""


class Storage(Protocol):
    async def ensure_user(self, user_id: int, username: str | None, full_name: str) -> str: ...

    async def create_game(self, chat_id: int) -> int: ...

    async def start_game(self, game_id: int, players: list[tuple[int, str]]) -> None: ...

    async def abort_game(self, game_id: int) -> list[int]: ...

    async def finalize_game(
        self, game_id: int, winner: str | None, days: int, rows: list[FinalRow]
    ) -> bool: ...

    async def inventories(self, user_ids: list[int]) -> dict[int, Inventory]: ...

    async def queue_heads(self, user_ids: list[int]) -> list[RoleRequest]: ...

    async def stale_games(self) -> list[dict]: ...

    # Ойын соңындағы карточка: баланс, заттар, келесі рөл, жеңістер.
    async def profiles(self, user_ids: list[int]) -> dict[int, dict]: ...


# --- Күй ------------------------------------------------------------------------------


@dataclass
class Lobby:
    game_id: int
    chat_id: int
    chat_title: str
    owner_id: int
    deadline: float
    lang: str = i18n.DEFAULT_LANG
    players: dict[int, str] = field(default_factory=dict)
    message_id: int | None = None
    started: bool = False
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    task: asyncio.Task | None = None
    update_task: asyncio.Task | None = None
    dirty: bool = False
    reminded: bool = False

    def t(self, key: str, /, **params: object) -> str:
        return i18n.t(self.lang, key, **params)


@dataclass
class Session:
    game: Game
    chat_id: int
    timings: balance.Timings
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    prompts: dict[int, int] = field(default_factory=dict)   # user_id -> message_id
    muted: dict[int, float] = field(default_factory=dict)   # user_id -> үнсіздік мерзімі
    witch_event: asyncio.Event = field(default_factory=asyncio.Event)
    witch_choice: bool | None = None
    witch_id: int | None = None
    kamikaze_event: asyncio.Event = field(default_factory=asyncio.Event)
    kamikaze_choice: int | None = None
    last_words: dict[int, float] = field(default_factory=dict)  # user_id -> мерзімі
    # 👍/👎 растау хабары (топта) және оның батырмаларын жаңарту.
    confirm_mid: int | None = None
    confirm_task: asyncio.Task | None = None
    confirm_dirty: bool = False
    task: asyncio.Task | None = None
    finished: bool = False
    started_at: float = field(default_factory=time.monotonic)

    @property
    def game_id(self) -> int:
        return self.game.game_id

    def t(self, key: str, /, **params: object) -> str:
        return self.game.t(key, **params)


def short(name: str, limit: int = 28) -> str:
    name = " ".join(name.split())
    return name if len(name) <= limit else name[: limit - 1] + "…"


def target_button_text(p: Player) -> str:
    """Батырмадағы ойыншы: тұрақты реттік нөмірімен (мысалы, «3. Арман»)."""
    return f"{p.number}. {short(p.name)}"


class GameManager:
    def __init__(
        self,
        notifier: Notifier,
        storage: Storage,
        *,
        registration_seconds: float = 120,
        time_scale: float = 1.0,
        mute_seconds: float = 120,
        silence_night: bool = True,
        mute_non_players: bool = True,
        higgs_chance: float = balance.HIGGS_CHANCE,
        rng_factory: Callable[[], random.Random] = random.SystemRandom,
        lobby_edit_delay: float = 1.5,
        confirm_edit_delay: float = 3.0,
    ) -> None:
        self.notifier = notifier
        self.storage = storage
        self.registration_seconds = registration_seconds
        self.time_scale = time_scale
        self.mute_seconds = mute_seconds
        self.silence_night = silence_night
        self.mute_non_players = mute_non_players
        self.higgs_chance = higgs_chance
        self.rng_factory = rng_factory
        self.lobby_edit_delay = lobby_edit_delay
        # 👍/👎 санағын жаңарту жиілігі: топта минутына ≈20 хабар/өңдеу шегі бар.
        self.confirm_edit_delay = confirm_edit_delay
        self.lobbies: dict[int, Lobby] = {}          # chat_id -> Lobby
        self.lobby_by_game: dict[int, Lobby] = {}    # game_id -> Lobby
        self.sessions: dict[int, Session] = {}       # chat_id -> Session
        self.user_chat: dict[int, int] = {}          # user_id -> chat_id (лобби не ойын)
        self._background: set[asyncio.Task] = set()
        # Топқа хабарлар ретімен шығуы үшін әр чаттың өз кезегі (asyncio.Lock — FIFO).
        self._chat_locks: dict[int, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._announcements: dict[int, set[asyncio.Task]] = defaultdict(set)

    def _spawn(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self._background.add(task)
        task.add_done_callback(self._background.discard)
        return task

    async def _send_ordered(self, chat_id: int, text: str, keyboard: Keyboard | None = None) -> int | None:
        async with self._chat_locks[chat_id]:
            return await self.notifier.send(chat_id, text, keyboard)

    async def _say(self, chat_id: int, text: str, keyboard: Keyboard | None = None) -> int | None:
        """Топқа хабар жіберу. Алдымен кезектегі әрекет/дауыс хабарлары шығады —
        сондықтан, мысалы, таңғы хабар түнгі әрекеттер туралы хабарлардан кейін келеді."""
        pending = self._announcements.get(chat_id)
        if pending:
            await asyncio.gather(*list(pending), return_exceptions=True)
        return await self._send_ordered(chat_id, text, keyboard)

    def _announce(self, chat_id: int, text: str | None) -> None:
        """Түнгі әрекет не дауыс туралы хабарды кезекке қою (батырма жауабын кідіртпейді)."""
        if not text:
            return
        task = self._spawn(self._send_ordered(chat_id, text))
        pending = self._announcements[chat_id]
        pending.add(task)
        task.add_done_callback(pending.discard)

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

    # --- Топ модерациясы ------------------------------------------------------------------

    def _verdict(self, chat_id: int, user_id: int) -> tuple[bool, bool]:
        """(өшіру керек пе, үнсіз ету керек пе) — әкімшілікті есепке алмай."""
        s = self.sessions.get(chat_id)
        if s is None or s.finished or s.game.result is not None:
            return False, False
        p = s.game.player(user_id)
        if p is None:
            return self.mute_non_players, self.mute_non_players
        if not p.alive:
            return True, True
        return self.silence_night and s.game.phase is Phase.NIGHT, False

    async def moderate(
        self,
        chat_id: int,
        user_id: int,
        message_id: int,
        text: str | None,
        is_admin: Callable[[], Awaitable[bool]],
    ) -> bool:
        """Ойын кезіндегі хабарламаны тексеру. Өшірілсе ``True`` қайтарады.

        Ойынға қатыспайтындар мен өлгендердің хабары өшіріліп, олар ``mute_seconds``
        секундқа үнсіз етіледі. Түнде тірі ойыншылардың хабары да өшіріледі.
        Әкімші хабарын ``!`` белгісімен бастаса, ол өшірілмейді.
        """
        delete, mute = self._verdict(chat_id, user_id)
        if not delete:
            return False
        if await is_admin():
            if (text or "").lstrip().startswith("!"):
                return False
            mute = False  # Telegram әкімшілерді шектей алмайды
        await self.notifier.delete(chat_id, message_id)
        s = self.sessions.get(chat_id)
        if mute and s is not None and self.mute_seconds > 0:
            now = time.monotonic()
            if s.muted.get(user_id, 0) <= now and await self.notifier.restrict(
                chat_id, user_id, self.mute_seconds
            ):
                s.muted[user_id] = now + self.mute_seconds
        return True

    # --- Лобби ----------------------------------------------------------------------------

    async def open_lobby(
        self,
        chat_id: int,
        chat_title: str,
        owner_id: int,
        lang: str = i18n.DEFAULT_LANG,
        registration_seconds: float | None = None,
    ) -> str | None:
        lang = i18n.norm(lang)
        if self.busy(chat_id):
            return i18n.t(lang, "lobby.busy")
        game_id = await self.storage.create_game(chat_id)
        if self.busy(chat_id):  # await кезінде басқа сұрау үлгеріп кетсе
            await self.storage.abort_game(game_id)
            return i18n.t(lang, "lobby.busy")
        seconds = registration_seconds or self.registration_seconds
        lobby = Lobby(
            game_id=game_id,
            chat_id=chat_id,
            chat_title=chat_title,
            owner_id=owner_id,
            deadline=time.monotonic() + seconds,
            lang=lang,
            reminded=seconds <= 45,  # қысқа тіркелуде «30 секунд қалды» ескертуі керек емес
        )
        self.lobbies[chat_id] = lobby
        self.lobby_by_game[game_id] = lobby
        lobby.message_id = await self._say(chat_id, self._lobby_text(lobby), self._lobby_keyboard(lobby))
        if lobby.message_id is not None:
            await self.notifier.pin(chat_id, lobby.message_id)
        lobby.task = asyncio.create_task(self._lobby_timer(lobby))
        return None

    def _lobby_text(self, lobby: Lobby) -> str:
        left = max(0, int(lobby.deadline - time.monotonic()))
        names = ", ".join(
            f"<a href=\"tg://user?id={uid}\">{html.escape(name)}</a>" for uid, name in lobby.players.items()
        )
        return "\n".join([
            lobby.t("lobby.title", chat=html.escape(lobby.chat_title)),
            lobby.t("lobby.players", names=names or "—"),
            lobby.t("lobby.count", count=len(lobby.players)),
            lobby.t("lobby.time", seconds=left),
        ])

    def _lobby_keyboard(self, lobby: Lobby) -> Keyboard:
        url = self.notifier.start_link(f"join_{lobby.game_id}")
        return [[Button(lobby.t("lobby.join_btn"), url=url)]]

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
            return i18n.t(None, "lobby.closed_join")
        chat = html.escape(lobby.chat_title)
        if user_id in lobby.players:
            return lobby.t("lobby.already_joined", chat=chat)
        if self.in_game(user_id):
            return lobby.t("lobby.other_game")
        if len(lobby.players) >= balance.MAX_PLAYERS:
            return lobby.t("lobby.full", max=balance.MAX_PLAYERS)
        await self.storage.ensure_user(user_id, username, name)
        if lobby.started or user_id in lobby.players or self.in_game(user_id):
            return lobby.t("lobby.retry")
        if len(lobby.players) >= balance.MAX_PLAYERS:
            return lobby.t("lobby.full", max=balance.MAX_PLAYERS)
        lobby.players[user_id] = name
        self.user_chat[user_id] = lobby.chat_id
        self._schedule_lobby_update(lobby)
        if len(lobby.players) >= balance.MAX_PLAYERS:
            lobby.wake.set()  # бөлме толды — бірден бастаймыз
        return lobby.t("lobby.joined", chat=chat, count=len(lobby.players), max=balance.MAX_PLAYERS)

    async def leave(self, user_id: int) -> str:
        chat_id = self.user_chat.get(user_id)
        if chat_id is None:
            return i18n.t(None, "lobby.not_in_game")
        lobby = self.lobbies.get(chat_id)
        if lobby is not None and not lobby.started and user_id in lobby.players:
            del lobby.players[user_id]
            self.user_chat.pop(user_id, None)
            self._schedule_lobby_update(lobby)
            return lobby.t("lobby.left")
        s = self.sessions.get(chat_id)
        if s is not None and not s.finished:
            if not await self._remove_player(s, user_id, afk=False):
                return s.t("lobby.not_alive")
            return s.t("lobby.deserted")
        return i18n.t(None, "lobby.not_in_game")

    async def _remove_player(self, s: Session, user_id: int, afk: bool) -> bool:
        """Ойыншыны ойыннан шығарып (рөлін ашып), ойын циклін оятады."""
        report = s.game.desert(user_id, afk=afk)
        if report is None:
            return False
        await self._say(s.chat_id, report.public)
        if afk:
            await self.notifier.send(user_id, s.t("afk.dm", nights=AFK_NIGHTS))
        await self._deliver(report.private)
        if s.game.check_winner() is not None:
            s.witch_event.set()  # Сиқыршы мен Камикадзенің шешімін күтпеу
            s.kamikaze_event.set()
        s.wake.set()
        return True

    def lobby_lang(self, chat_id: int) -> str:
        lobby = self.lobbies.get(chat_id)
        if lobby is not None:
            return lobby.lang
        s = self.sessions.get(chat_id)
        return s.game.lang if s is not None else i18n.DEFAULT_LANG

    async def extend(self, chat_id: int, seconds: float = 30) -> str | None:
        lobby = self.lobbies.get(chat_id)
        if lobby is None or lobby.started:
            return None
        lobby.deadline += seconds
        lobby.reminded = lobby.deadline - time.monotonic() <= 45
        self._schedule_lobby_update(lobby)
        return lobby.t("lobby.extended", seconds=int(seconds))

    async def force_start(self, chat_id: int) -> str | None:
        lobby = self.lobbies.get(chat_id)
        if lobby is None or lobby.started:
            return i18n.t(self.lobby_lang(chat_id), "lobby.no_open")
        if len(lobby.players) < balance.MIN_PLAYERS:
            return lobby.t("lobby.need_min", min=balance.MIN_PLAYERS, count=len(lobby.players))
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
                if not lobby.reminded and left <= remind_at + 0.5:
                    lobby.reminded = True
                    await self._say(lobby.chat_id, lobby.t("lobby.reminder", seconds=remind_at))
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
                    lobby, lobby.t("lobby.not_enough", count=len(lobby.players), min=balance.MIN_PLAYERS)
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Лобби таймерінде қате")
            if lobby.chat_id in self.lobbies:
                await self._cancel_lobby(lobby, lobby.t("lobby.error"))

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
            await self.notifier.edit(lobby.chat_id, lobby.message_id, lobby.t("lobby.closed"))
        await self._say(lobby.chat_id, text)

    # --- Ойынды бастау ----------------------------------------------------------------------

    async def _start_game(self, lobby: Lobby) -> None:
        # Лобби сессия тіркелгенше сөздікте қалады — сол чатта жаңа ойын ашылып кетпесін.
        lobby.started = True
        user_ids = list(lobby.players)
        inventories = await self.storage.inventories(user_ids)
        requests = await self.storage.queue_heads(user_ids)
        rng = self.rng_factory()
        assignment = assign_roles(user_ids, requests, rng, higgs_chance=self.higgs_chance)
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
        game = Game(lobby.game_id, lobby.chat_id, players, rng=rng, lang=lobby.lang)
        await self.storage.start_game(game.game_id, [(p.user_id, p.role.value) for p in players])
        session = Session(game=game, chat_id=lobby.chat_id,
                          timings=balance.timings(len(players), self.time_scale))
        self.sessions[lobby.chat_id] = session
        self._drop_lobby(lobby)
        if lobby.message_id is not None:
            await self.notifier.edit(lobby.chat_id, lobby.message_id, lobby.t("lobby.done", count=len(players)))
        failed: list[Player] = []
        for p in game.ordered():
            text = game.role_intro(p.user_id)
            if p.purchase_id is not None:
                text = game.t("game.purchased_role") + "\n\n" + text
            if await self.notifier.send(p.user_id, text) is None:
                failed.append(p)
        for req in assignment.unfulfilled:
            await self.notifier.send(
                req.user_id,
                game.t("game.unfulfilled", role=game.title(req.role), count=len(players)),
                [[Button(game.t("game.refund_btn"), data=f"rr:{req.purchase_id}")]],
            )
        if any(p.role is Role.HIGGS for p in players):  # сирек рөл — бірінші болып ерекше хабар
            await self._say(lobby.chat_id, game.t("game.higgs_arrived"))
        lines = [game.t("game.started", count=len(players))]
        if failed:
            lines += ["", game.t("game.dm_failed", names=", ".join(p.mention for p in failed))]
        await self._say(lobby.chat_id, "\n".join(lines), self._bot_button(game.lang))
        # Түнгі әрекеттерден бұрын: «Тірі ойыншылар» тізімі, астында — ойындағы рөлдер.
        await self._say(lobby.chat_id, "\n".join(game.alive_block()))
        if not session.finished:  # хабарламалар жіберілгенше ойын тоқтатылмаса
            session.task = asyncio.create_task(self._run(session))

    def _bot_button(self, lang: str, key: str = "game.bot_btn") -> Keyboard:
        # Жай сілтеме: жеке чат ашылады, «START» батырмасы мен сәлемдесу хабары шықпайды.
        return [[Button(i18n.t(lang, key), url=self.notifier.chat_link())]]

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
            await self.abort(s.chat_id, s.t("game.error"))

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
        await self._say(s.chat_id, g.start_night(), self._bot_button(g.lang))
        s.prompts = {}
        actors = sorted(g.expected_actors(), key=lambda u: g.players[u].order)
        for uid in actors:
            await self._send_night_prompt(s, uid)
        await self._wait(s, s.timings.night, g.night_complete)
        await self._close_prompts(s, s.t("game.night_over"))
        if g.result is not None:
            return
        idle = g.note_idle(actors)
        witch = g.resolve_night()
        choice = await self._ask_witch(s, witch) if witch is not None else None
        report = g.complete_night(choice)
        text = report.public
        if g.check_winner() is None:  # ойын жалғасса — таңғы хабарда талқылау уақыты да айтылады
            text += "\n\n" + g.day_text(int(s.timings.day))
        await self._say(s.chat_id, text)
        await self._deliver(report.private)
        await self._after_deaths(s, report.deaths, last_words=True)
        # Қатарынан AFK_NIGHTS түн әрекетсіз қалғандар ойыннан шығарылады.
        for uid in idle:
            if g.result is not None:
                break
            await self._remove_player(s, uid, afk=True)

    async def _day(self, s: Session) -> None:
        g = s.game
        await self._wait(s, s.timings.day, lambda: False)
        if g.result is not None:
            return
        await self._say(s.chat_id, g.start_vote(int(s.timings.vote)), self._bot_button(g.lang, "game.vote_btn"))
        s.prompts = {}
        for p in g.alive():
            await self._send_vote_prompt(s, p.user_id)
        await self._wait(s, s.timings.vote, g.vote_complete)
        await self._close_prompts(s, s.t("game.vote_over"))
        if g.result is not None:
            return
        report = g.resolve_vote()
        if report.public:
            await self._say(s.chat_id, report.public)
        if g.phase is Phase.CONFIRM:
            confirmed = await self._confirm(s)
            if confirmed is None:  # растау кезінде ойын аяқталды
                return
            report = confirmed
            await self._say(s.chat_id, report.public)
        await self._deliver(report.private)
        deaths = list(report.deaths)
        if g.kamikaze_pending is not None:  # дарға асылған Камикадзе біреуді алып кетеді
            taken = await self._ask_kamikaze(s)
            if taken is not None:
                await self._say(s.chat_id, taken.public)
                await self._deliver(taken.private)
                deaths += taken.deaths
        await self._after_deaths(s, deaths, last_words=True)
        g.end_cycle()

    async def _ask_kamikaze(self, s: Session) -> Report | None:
        g = s.game
        kamikaze_id = g.kamikaze_pending
        s.kamikaze_choice = None
        s.kamikaze_event.clear()
        rows = [[Button(target_button_text(g.players[t]), data=f"kz:{s.game_id}:{g.day}:{t}")]
                for t in g.kamikaze_targets()]
        mid = await self.notifier.send(kamikaze_id, s.t("kamikaze.prompt"), rows)
        if mid is not None:
            try:
                await asyncio.wait_for(s.kamikaze_event.wait(), timeout=s.timings.witch)
            except TimeoutError:
                await self.notifier.edit(kamikaze_id, mid, s.t("kamikaze.timeout"))
        return g.kamikaze_take(s.kamikaze_choice)

    async def kamikaze_choose(self, user_id: int, game_id: int, day: int, target: int) -> tuple[bool, str]:
        """Дарға асылған Камикадзе кімді алып кететінін таңдады."""
        s = self._session_by_game(game_id)
        g = s.game if s else None
        if (s is None or g.day != day or g.kamikaze_pending != user_id or s.kamikaze_event.is_set()
                or target not in g.kamikaze_targets()):
            return False, i18n.t(g.lang if g else None, "game.stale")
        s.kamikaze_choice = target
        s.kamikaze_event.set()
        return True, s.t("kamikaze.ok", target=g.players[target].mention)

    # --- 👍/👎 растау ---------------------------------------------------------------------------

    def _confirm_keyboard(self, s: Session) -> Keyboard:
        yes, no = s.game.confirm_counts()
        gid, day = s.game_id, s.game.day
        return [[Button(f"👍 {yes}", data=f"c:{gid}:{day}:1"), Button(f"👎 {no}", data=f"c:{gid}:{day}:0")]]

    async def _confirm(self, s: Session) -> Report | None:
        """Ең көп дауыс жинаған ойыншыны шынымен асу керек пе — топта 👍/👎 батырмалары."""
        g = s.game
        s.confirm_mid = await self._say(
            s.chat_id, g.confirm_text(int(s.timings.confirm)), self._confirm_keyboard(s)
        )
        if s.confirm_mid is not None:
            await self._wait(s, s.timings.confirm, g.confirm_complete)
        await self._close_confirm(s, None if g.result is not None else g.confirm_closed_text())
        if g.result is not None:
            return None
        return g.resolve_confirm()

    async def _close_confirm(self, s: Session, text: str | None) -> None:
        """Растау хабарының батырмаларын алып тастау (``text`` берілсе, мәтінін де ауыстыру)."""
        mid, s.confirm_mid = s.confirm_mid, None
        task, s.confirm_task = s.confirm_task, None
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        if mid is not None:
            await self.notifier.edit(s.chat_id, mid, text or s.t("confirm.stopped"))

    def _schedule_confirm_update(self, s: Session) -> None:
        """Батырмалардағы 👍/👎 санын жаңарту. Қатар басылғандар бір өңдеуге жиналады."""
        if s.confirm_mid is None:
            return
        s.confirm_dirty = True
        if s.confirm_task and not s.confirm_task.done():
            return

        async def update() -> None:
            while True:
                await asyncio.sleep(self.confirm_edit_delay)
                mid = s.confirm_mid
                if mid is None or s.game.phase is not Phase.CONFIRM:
                    return
                s.confirm_dirty = False
                await self.notifier.edit(
                    s.chat_id, mid, s.game.confirm_text(int(s.timings.confirm)), self._confirm_keyboard(s)
                )
                if not s.confirm_dirty:
                    return

        s.confirm_task = self._spawn(update())

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
            rows = [[Button(g.action_label(o.kind), data=f"m:{gid}:{day}:{o.kind.value}")] for o in targeted]
        else:
            chosen = next((o for o in targeted if o.kind is mode), targeted[0] if targeted else None)
            if chosen is not None:
                for t in chosen.targets:
                    rows.append([Button(target_button_text(g.players[t]),
                                        data=f"n:{gid}:{day}:{chosen.kind.value}:{t}")])
            if mode is not None and len(targeted) > 1:
                rows.append([Button(s.t("game.back"), data=f"m:{gid}:{day}:back")])
        for o in plain:
            data = f"aw:{gid}:{day}" if o.kind is ActionKind.AWAKE else f"n:{gid}:{day}:{o.kind.value}:0"
            rows.append([Button(g.action_label(o.kind), data=data)])
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
            [Button(target_button_text(g.players[t]), data=f"v:{s.game_id}:{g.day}:{t}")]
            for t in g.vote_candidates(user_id)
        ]
        rows.append([Button(s.t("vote.abstain_btn"), data=f"v:{s.game_id}:{g.day}:0")])
        mid = await self.notifier.send(user_id, g.vote_prompt(), rows)
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
            [[Button(s.t("witch.punish"), data=f"w:{gid}:{day}:1"),
              Button(s.t("witch.forgive"), data=f"w:{gid}:{day}:0")]],
        )
        if mid is not None:
            try:
                await asyncio.wait_for(s.witch_event.wait(), timeout=s.timings.witch)
            except TimeoutError:
                await self.notifier.edit(prompt.witch_id, mid, s.t("witch.timeout"))
        s.witch_id = None
        return bool(s.witch_choice)

    async def _after_deaths(self, s: Session, deaths: list[int], last_words: bool) -> None:
        if not last_words or s.game.result is not None:
            return
        for uid in deaths:
            s.last_words[uid] = time.monotonic() + s.timings.day + s.timings.vote
            await self.notifier.send(uid, s.t("game.last_words_prompt"))

    # --- Ойыншы әрекеттері (callback-тер) ------------------------------------------------------

    def _session_by_game(self, game_id: int) -> Session | None:
        return next((s for s in self.sessions.values() if s.game_id == game_id), None)

    async def choose_mode(
        self, user_id: int, game_id: int, day: int, kind: str
    ) -> tuple[str, Keyboard | None]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day or s.game.phase is not Phase.NIGHT or user_id in s.game.actions:
            return i18n.t(s.game.lang if s else None, "game.stale"), None
        mode = None if kind == "back" else ActionKind(kind)
        text = s.game.night_prompt(user_id)
        if mode is not None:
            text += "\n\n" + s.t("game.mode", action=s.game.action_label(mode))
        return text, self._night_keyboard(s, user_id, mode)

    async def night_action(
        self, user_id: int, game_id: int, day: int, kind: str, target: int
    ) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day:
            return False, i18n.t(s.game.lang if s else None, "game.stale")
        try:
            action = ActionKind(kind)
        except ValueError:
            return False, s.t("game.unknown_action")
        g = s.game
        result = g.submit_action(user_id, action, target or None)
        if not result.ok:
            return False, result.message
        s.prompts.pop(user_id, None)
        self._announce(s.chat_id, g.action_announcement(user_id, action))
        if target:  # одақтастар бір-бірінің таңдауын көреді: «Бека: таңдады Айжан»
            note = g.team_choice_note(user_id, target)
            for mate in g.team_of(user_id):
                await self.notifier.send(mate.user_id, note)
        s.wake.set()
        return True, result.message

    async def stay_awake(self, user_id: int, game_id: int, day: int) -> tuple[bool, str, bool]:
        """Балым жалеп «Сору» батырмасын басты. ``(ok, мәтін, жеткілікті ме)``."""
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day:
            return False, i18n.t(s.game.lang if s else None, "game.stale"), False
        ok, text, done = s.game.press_awake(user_id)
        if ok and s.game.awake.get(user_id) == 1:  # түнде бірінші басқанда топқа бір рет жарияланады
            self._announce(s.chat_id, s.game.action_announcement(user_id, ActionKind.AWAKE))
        if done:
            s.prompts.pop(user_id, None)
            s.wake.set()
        return ok, text, done

    async def vote(self, user_id: int, game_id: int, day: int, target: int) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day:
            return False, i18n.t(s.game.lang if s else None, "game.stale_vote")
        result = s.game.submit_vote(user_id, target or None)
        if result.ok:
            s.prompts.pop(user_id, None)
            self._announce(s.chat_id, s.game.vote_announcement(user_id))
            s.wake.set()
        return result.ok, result.message

    async def confirm_vote(self, user_id: int, game_id: int, day: int, yes: bool) -> tuple[bool, str]:
        """Топтағы 👍/👎 батырмасы басылды."""
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day or s.game.phase is not Phase.CONFIRM:
            return False, i18n.t(s.game.lang if s else None, "confirm.not_now")
        result = s.game.submit_confirm(user_id, yes)
        if result.ok:
            self._schedule_confirm_update(s)
            s.wake.set()
        return result.ok, result.message

    async def witch_decision(self, user_id: int, game_id: int, day: int, punish: bool) -> tuple[bool, str]:
        s = self._session_by_game(game_id)
        if s is None or s.game.day != day or s.witch_id != user_id or s.witch_event.is_set():
            return False, i18n.t(s.game.lang if s else None, "game.stale_witch")
        s.witch_choice = punish
        s.witch_event.set()
        return True, s.t("witch.ok_punish" if punish else "witch.ok_forgive")

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
            await self._say(s.chat_id, s.t("game.last_words", name=p.mention, text=body))
            await self.notifier.send(user_id, s.t("game.last_words_sent"))
            return True
        mates = g.team_of(user_id)
        if not mates:
            return False
        for mate in mates:
            await self.notifier.send(
                mate.user_id, s.t("game.team_msg", name=p.mention, text=body)
            )
        return True

    # --- Аяқтау және тоқтату ----------------------------------------------------------------------

    def rewards_for(self, game: Game, result: GameResult) -> dict[int, int]:
        """Жеңімпаздардың сыйақысы. ⚛️ Higgs-Man екі есе алады."""
        base = win_reward(game.size)
        return {
            uid: base * (HIGGS_REWARD_MULTIPLIER if game.players[uid].role is Role.HIGGS else 1)
            for uid in result.winners
        }

    async def _finish(self, s: Session, result: GameResult) -> None:
        if s.finished:
            return
        s.finished = True
        g = s.game
        rewards = self.rewards_for(g, result)
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
        minutes = max(1, round((time.monotonic() - s.started_at) / 60))
        await self._say(s.chat_id, g.final_text(minutes))
        await self._release(s)
        try:
            profiles = await self.storage.profiles([p.user_id for p in g.ordered()])
        except Exception:
            log.exception("Профильдерді алу мүмкін болмады (game_id=%s)", g.game_id)
            profiles = {}
        for p in g.ordered():
            if p.user_id in result.winners:
                head = s.t("end.win", reward=rewards.get(p.user_id, 0))
            else:
                head = s.t("end.lose")
            card = self._profile_card(g, profiles.get(p.user_id))
            await self.notifier.send(p.user_id, f"{head}\n\n{card}" if card else head)

    def _profile_card(self, g: Game, profile: dict | None) -> str:
        if not profile:
            return ""
        next_role = profile.get("next_role")
        return g.t(
            "end.card",
            id=profile["user_id"],
            name=html.escape(profile.get("full_name") or profile.get("username") or str(profile["user_id"])),
            tenge=profile["tenge"],
            diamonds=profile["diamonds"],
            shields=profile["shields"],
            vote_shields=profile["vote_shields"],
            bullets=profile["piercing_bullets"],
            fake_docs=profile["fake_docs"],
            next_role=g.title(Role(next_role)) if next_role else "-",
            wins=profile["wins"],
            games=profile["games_played"],
        )

    async def _release(self, s: Session) -> None:
        now = time.monotonic()
        for uid, until in list(s.muted.items()):
            if until > now:
                await self.notifier.unrestrict(s.chat_id, uid)
        s.muted.clear()
        self.sessions.pop(s.chat_id, None)
        for uid in s.game.players:
            if self.user_chat.get(uid) == s.chat_id:
                self.user_chat.pop(uid, None)

    async def abort(self, chat_id: int, text: str | None = None) -> bool:
        lobby = self.lobbies.get(chat_id)
        if lobby is not None:
            if lobby.task and lobby.task is not asyncio.current_task():
                lobby.task.cancel()
            await self._cancel_lobby(lobby, text or lobby.t("game.stopped"))
            return True
        s = self.sessions.get(chat_id)
        if s is None or s.finished:
            return False
        s.finished = True
        if s.task and s.task is not asyncio.current_task():
            s.task.cancel()
        await self._close_prompts(s, s.t("game.stopped"))
        await self._close_confirm(s, None)
        await self.storage.abort_game(s.game_id)
        await self._release(s)
        await self._say(chat_id, text or s.t("game.stopped"))
        return True

    async def shutdown(self) -> None:
        for chat_id in list(self.lobbies) + list(self.sessions):
            try:
                await self.abort(chat_id, i18n.t(self.lobby_lang(chat_id), "game.shutdown"))
            except Exception:  # pragma: no cover
                log.exception("Ойынды тоқтату кезінде қате")

    async def recover_stale(self) -> None:
        """Бот қайта іске қосылғанда аяқталмай қалған ойындарды тоқтатып, шектеулерді алу."""
        for g in await self.storage.stale_games():
            restricted = await self.storage.abort_game(g["game_id"])
            for uid in restricted:
                await self.notifier.unrestrict(g["chat_id"], uid)
            if g["status"] == "running":
                await self.notifier.send(g["chat_id"], i18n.t(g.get("lang"), "game.restarted"))

