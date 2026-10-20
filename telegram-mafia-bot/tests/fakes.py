"""Тесттерге арналған жалған Notifier және Storage."""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field

from mafia_bot.controller import Button, GameManager, Keyboard
from mafia_bot.db.models import FinalRow, Inventory
from mafia_bot.game.engine import RoleRequest


@dataclass
class Sent:
    chat_id: int
    message_id: int
    text: str
    keyboard: Keyboard | None


class FakeNotifier:
    def __init__(self, unreachable: set[int] | None = None) -> None:
        self.sent: list[Sent] = []
        self.edits: list[tuple[int, int, str]] = []
        self.restricted: dict[tuple[int, int], float] = {}   # (chat, user) -> секунд
        self.unrestricted: list[tuple[int, int]] = []
        self.deleted: list[tuple[int, int]] = []
        self.unreachable = unreachable or set()
        self._next_id = 1
        self.on_send = None  # callable(Sent) -> None

    async def send(self, chat_id, text, keyboard=None):
        if chat_id in self.unreachable:
            return None
        msg = Sent(chat_id, self._next_id, text, keyboard)
        self._next_id += 1
        self.sent.append(msg)
        if self.on_send is not None:
            self.on_send(msg)
        return msg.message_id

    async def edit(self, chat_id, message_id, text, keyboard=None):
        self.edits.append((chat_id, message_id, text))

    async def delete(self, chat_id, message_id):
        self.deleted.append((chat_id, message_id))

    async def restrict(self, chat_id, user_id, seconds):
        self.restricted[(chat_id, user_id)] = seconds
        return True

    async def unrestrict(self, chat_id, user_id):
        self.restricted.pop((chat_id, user_id), None)
        self.unrestricted.append((chat_id, user_id))

    async def pin(self, chat_id, message_id):
        pass

    async def unpin(self, chat_id, message_id):
        pass

    def start_link(self, payload):
        return f"https://t.me/test_bot?start={payload}"

    def chat_link(self):
        return "https://t.me/test_bot"

    def to(self, chat_id) -> list[Sent]:
        return [m for m in self.sent if m.chat_id == chat_id]


@dataclass
class FakeStorage:
    inventory: dict[int, Inventory] = field(default_factory=dict)
    requests: list[RoleRequest] = field(default_factory=list)
    games: dict[int, str] = field(default_factory=dict)
    started: dict[int, list[tuple[int, str]]] = field(default_factory=dict)
    finalized: dict[int, list[FinalRow]] = field(default_factory=dict)
    finalize_calls: int = 0
    restricted: set[tuple[int, int]] = field(default_factory=set)
    users: set[int] = field(default_factory=set)
    _next: int = 1

    async def ensure_user(self, user_id, username, full_name):
        self.users.add(user_id)
        return "kk"

    async def create_game(self, chat_id):
        gid = self._next
        self._next += 1
        self.games[gid] = "lobby"
        return gid

    async def start_game(self, game_id, players):
        assert self.games[game_id] == "lobby"
        assert all(uid in self.users for uid, _ in players)
        self.games[game_id] = "running"
        self.started[game_id] = players

    async def abort_game(self, game_id):
        if self.games.get(game_id) in ("lobby", "running"):
            self.games[game_id] = "aborted"
        released = [uid for gid, uid in self.restricted if gid == game_id]
        self.restricted = {(g, u) for g, u in self.restricted if g != game_id}
        return released

    async def finalize_game(self, game_id, winner, days, rows):
        self.finalize_calls += 1
        if self.games.get(game_id) != "running":
            return False
        self.games[game_id] = "finished"
        self.finalized[game_id] = rows
        return True

    async def inventories(self, user_ids):
        return {u: self.inventory[u] for u in user_ids if u in self.inventory}

    async def queue_heads(self, user_ids):
        return [r for r in self.requests if r.user_id in user_ids]

    async def profiles(self, user_ids):
        return {
            u: {"user_id": u, "username": None, "full_name": f"Player {u}", "tenge": 0, "diamonds": 0,
                "shields": 0, "vote_shields": 0, "piercing_bullets": 0, "fake_docs": 0, "wins": 0,
                "games_played": 0, "next_role": None}
            for u in user_ids if u in self.users
        }

    async def stale_games(self):
        return [
            {"game_id": g, "chat_id": -1, "status": s, "restricted": []}
            for g, s in self.games.items() if s in ("lobby", "running")
        ]


def buttons(keyboard: Keyboard | None) -> list[Button]:
    return [b for row in keyboard or [] for b in row if b.data]


class AutoPlayers:
    """Жеке чатқа келген кез келген батырманы кездейсоқ басатын «ойыншылар»."""

    def __init__(self, manager: GameManager, notifier: FakeNotifier, seed: int = 0,
                 idle: set[int] | None = None) -> None:
        self.manager = manager
        self.rng = random.Random(seed)
        self.idle = idle or set()
        self.tasks: list[asyncio.Task] = []
        notifier.on_send = self._on_send

    def _on_send(self, msg: Sent) -> None:
        if msg.chat_id < 0:
            self._on_group(msg)
            return
        if msg.chat_id in self.idle or not buttons(msg.keyboard):
            return
        self.tasks.append(asyncio.create_task(self._click(msg.chat_id, msg.keyboard)))

    def _on_group(self, msg: Sent) -> None:
        """Топтағы 👍/👎 растау: әр тірі ойыншы кездейсоқ батырманы басады."""
        confirm = [b for b in buttons(msg.keyboard) if b.data.startswith("c:")]
        s = self.manager.sessions.get(msg.chat_id)
        if not confirm or s is None:
            return
        for uid in sorted(s.game.confirm_voters() - self.idle):
            self.tasks.append(asyncio.create_task(self._confirm(uid, self.rng.choice(confirm))))

    async def _confirm(self, user_id: int, button: Button) -> None:
        await asyncio.sleep(self.rng.random() * 0.002)
        _, gid, day, yes = button.data.split(":")
        await self.manager.confirm_vote(user_id, int(gid), int(day), yes == "1")

    async def _click(self, user_id: int, keyboard: Keyboard) -> None:
        await asyncio.sleep(self.rng.random() * 0.002)
        for _ in range(3):
            button = self.rng.choice(buttons(keyboard))
            parts = button.data.split(":")
            kind = parts[0]
            if kind == "m":
                _, gid, day, mode = parts
                _, keyboard = await self.manager.choose_mode(user_id, int(gid), int(day), mode)
                if not keyboard:
                    return
                continue
            if kind == "aw":  # Балым жалеп кейде жеткілікті басады, кейде жоқ
                _, gid, day = parts
                for _ in range(self.rng.choice((4, 10, 12))):
                    await self.manager.stay_awake(user_id, int(gid), int(day))
                return
            if kind == "n":
                _, gid, day, action, target = parts
                await self.manager.night_action(user_id, int(gid), int(day), action, int(target))
            elif kind == "v":
                _, gid, day, target = parts
                await self.manager.vote(user_id, int(gid), int(day), int(target))
            elif kind == "w":
                _, gid, day, punish = parts
                await self.manager.witch_decision(user_id, int(gid), int(day), punish == "1")
            elif kind == "kz":
                _, gid, day, target = parts
                await self.manager.kamikaze_choose(user_id, int(gid), int(day), int(target))
            return
