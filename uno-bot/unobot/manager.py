"""Чаттардағы ойындарды және ойыншылардың қай ойында екенін сақтау."""

from __future__ import annotations

from dataclasses import dataclass

from .game import Game, GameError, Phase


@dataclass
class Session:
    game: Game
    lobby_message_id: int | None = None
    status_message_id: int | None = None


class GameManager:
    def __init__(self) -> None:
        self.sessions: dict[int, Session] = {}
        self.user_chat: dict[int, int] = {}  # бір қолданушы бір уақытта тек бір ойында

    def get(self, chat_id: int) -> Session | None:
        return self.sessions.get(chat_id)

    def for_user(self, user_id: int) -> Session | None:
        chat_id = self.user_chat.get(user_id)
        return self.sessions.get(chat_id) if chat_id is not None else None

    def create(self, chat_id: int, host_id: int, host_name: str, target: int) -> Session:
        existing = self.sessions.get(chat_id)
        if existing and existing.game.phase is not Phase.FINISHED:
            raise GameError("game_exists")
        self._check_free(host_id, chat_id)
        game = Game(chat_id, host_id, target_score=target)
        game.add_player(host_id, host_name)
        session = Session(game)
        self.sessions[chat_id] = session
        self.user_chat[host_id] = chat_id
        return session

    def join(self, session: Session, user_id: int, name: str) -> None:
        self._check_free(user_id, session.game.chat_id)
        session.game.add_player(user_id, name)
        self.user_chat[user_id] = session.game.chat_id

    def _check_free(self, user_id: int, chat_id: int) -> None:
        other = self.for_user(user_id)
        if other is not None and other.game.chat_id != chat_id and other.game.phase is not Phase.FINISHED:
            raise GameError("in_other_game")

    def sync(self, session: Session) -> None:
        """Ойыннан шыққандарды босатып, аяқталған ойынды жою."""
        game = session.game
        if game.phase is Phase.FINISHED or not game.players:
            self.delete(game.chat_id)
            return
        for user_id, chat_id in list(self.user_chat.items()):
            if chat_id == game.chat_id and game.get_player(user_id) is None:
                del self.user_chat[user_id]

    def delete(self, chat_id: int) -> None:
        self.sessions.pop(chat_id, None)
        for user_id, user_chat_id in list(self.user_chat.items()):
            if user_chat_id == chat_id:
                del self.user_chat[user_id]
