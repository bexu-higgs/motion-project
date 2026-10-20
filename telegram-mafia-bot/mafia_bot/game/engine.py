"""Мафия ойынының қозғалтқышы.

Бұл модуль Telegram-ға тәуелсіз: ол тек ойын күйін сақтайды, әрекеттерді тексереді
және түнгі/күндізгі нәтижелерді есептейді. Хабарламаларды жіберу — контроллердің ісі.
Барлық мәтін ойын тілінде (``Game.lang``) ``mafia_bot.i18n`` каталогынан алынады.
"""

from __future__ import annotations

import html
import random
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import StrEnum

from .. import i18n
from . import balance
from .roles import (
    DEFENDER_COVER_ROLES,
    HIGGS_SLOTS,
    KAMIKAZE_PREY,
    MAFIA_POWER_ROLES,
    MAFIA_TEAM_ROLES,
    NOT_FOR_SALE,
    Faction,
    Role,
    description,
    faction_of,
    faction_title,
)
from .roles import name as role_name

MAX_DAYS = 40          # шексіз ойынның алдын алу
QUIET_CYCLES_DRAW = 3  # қатарынан өлімсіз өткен күн+түн саны -> тең ойын
HIGGS_ARMOR = 3        # Higgs-Man-ның түнгі шабуылдан қорғанысы (4-оқ өлтіреді)
AFK_NIGHTS = 3         # қатарынан әрекетсіз өткен түн саны -> ойыннан шығарылады
AWAKE_PRESSES = 10     # Балым жалеп әр түнде «Сору» батырмасын кемінде осынша рет басуы керек


class Phase(StrEnum):
    LOBBY = "lobby"
    NIGHT = "night"
    DAY = "day"
    VOTE = "vote"
    CONFIRM = "confirm"   # 👍/👎 — ең көп дауыс жинаған ойыншыны шынымен асу керек пе
    ENDED = "ended"


class ActionKind(StrEnum):
    MAFIA_KILL = "mk"
    KILLER_KILL = "kk"
    MANIAC_KILL = "mn"
    CHECK = "ck"
    SHOOT = "sh"
    HEAL = "hl"
    BLOCK = "bl"
    PROTECT = "pr"
    VISIT = "vs"
    BOMB = "bm"
    DETONATE = "dt"
    AWAKE = "aw"
    SKIP = "sk"


# Шабуыл көздері (түнгі есептеу реті бойынша). Мәтіндері: ``cause.<көз>``.
SRC_MAFIA = "mafia"
SRC_KILLER = "killer"
SRC_MANIAC = "maniac"
SRC_COMMISSIONER = "commissioner"
SRC_BOMB = "bomb"
SRC_PYRO_SELF = "pyro_self"
SRC_WITCH = "witch"
SRC_KAMIKAZE = "kamikaze"
SRC_LYNCH = "lynch"
SRC_DESERT = "desert"
SRC_AFK = "afk"
SRC_SLEEPLESS = "sleepless"
CAUSES = (
    SRC_MAFIA, SRC_KILLER, SRC_MANIAC, SRC_COMMISSIONER, SRC_BOMB, SRC_PYRO_SELF,
    SRC_WITCH, SRC_KAMIKAZE, SRC_LYNCH, SRC_DESERT, SRC_AFK, SRC_SLEEPLESS,
)

# Түнгі әрекет нысанасына таңертең жеке чатта келетін хабар: (кілт, әрекет иесінің рөлі).
TARGET_NOTES: dict[ActionKind, tuple[str, Role]] = {
    ActionKind.CHECK: ("night.checked_you", Role.COMMISSIONER),
    ActionKind.HEAL: ("night.healed_you", Role.DOCTOR),
    ActionKind.PROTECT: ("night.protected_you", Role.DEFENDER),
    ActionKind.VISIT: ("night.visited_you", Role.BEGGAR),
    ActionKind.BOMB: ("night.bombed_you", Role.PYRO),
}

# Түнгі әрекет басылғанда топқа шығатын хабар (``announce.<кілт>``).
ANNOUNCE_KEYS: dict[ActionKind, str] = {
    ActionKind.KILLER_KILL: "killer",
    ActionKind.MANIAC_KILL: "maniac",
    ActionKind.CHECK: "check",
    ActionKind.SHOOT: "shoot",
    ActionKind.HEAL: "heal",
    ActionKind.BLOCK: "block",
    ActionKind.PROTECT: "protect",
    ActionKind.VISIT: "visit",
    ActionKind.BOMB: "bomb",
    ActionKind.DETONATE: "detonate",
    ActionKind.AWAKE: "sleepless",
}


def mention(user_id: int, name: str) -> str:
    return f'<a href="tg://user?id={user_id}">{html.escape(name)}</a>'


@dataclass
class Player:
    user_id: int
    name: str
    order: int
    role: Role = Role.CIVILIAN
    initial_role: Role = Role.CIVILIAN
    alive: bool = True
    deserted: bool = False
    death_day: int | None = None
    death_cause: str | None = None
    # Ойын басында профильден алынған заттар (бір ойынға ең көбі біреуден).
    shield_available: bool = False
    shield_used: bool = False
    vote_shield_available: bool = False
    vote_shield_used: bool = False
    bullet_available: bool = False
    bullet_used: bool = False
    fake_doc: bool = False             # белсенді, әлі жұмсалмаған жалған құжат
    fake_doc_activated: bool = False   # ойын басында іске қосылды (профильден шегеріледі)
    purchase_id: int | None = None     # сатып алынған рөл (берілген болса)
    # Рөлге қатысты күй.
    head_defender: bool = False
    self_heal_used: bool = False
    last_target: int | None = None     # Дәрігер/Хакер: өткен түндегі нысана
    witch_magic_used: bool = False
    personal_win: bool = False
    higgs_armor: int = 0               # Higgs-Man: қалған оқтан қорғаныс саны
    higgs_vote_save: bool = False      # Higgs-Man: дардан бір реттік қорғаныс
    idle_nights: int = 0               # қатарынан әрекетсіз өткен түндер (AFK)

    @property
    def faction(self) -> Faction:
        return faction_of(self.role)

    @property
    def mention(self) -> str:
        return mention(self.user_id, self.name)

    @property
    def number(self) -> int:
        """Ойын басында берілетін тұрақты реттік нөмір (ойын соңына дейін өзгермейді)."""
        return self.order + 1

    @property
    def label(self) -> str:
        return f"{self.number}. {self.mention}"

    @property
    def has_shield(self) -> bool:
        return self.shield_available and not self.shield_used

    @property
    def has_vote_shield(self) -> bool:
        return self.vote_shield_available and not self.vote_shield_used

    @property
    def has_bullet(self) -> bool:
        return self.bullet_available and not self.bullet_used


@dataclass(frozen=True)
class RoleRequest:
    """Ойыншының алмазға сатып алған, кезектің басындағы рөлі."""

    user_id: int
    role: Role
    purchase_id: int


@dataclass(frozen=True)
class Assignment:
    roles: dict[int, Role]
    fulfilled: list[RoleRequest]
    unfulfilled: list[RoleRequest]


def assign_roles(
    user_ids: list[int],
    requests: list[RoleRequest],
    rng: random.Random,
    higgs_chance: float = balance.HIGGS_CHANCE,
) -> Assignment:
    """Рөлдерді кездейсоқ бөлу. Сатып алынған рөлдер (сатып алу ретімен) бірінші беріледі.

    Бір рөлдің даналары құрамда қанша болса, сонша ғана беріледі — рөлдер саны
    ойыншылар санынан ешқашан аспайды. Сирек ⚛️ Higgs-Man бір тұрғынның орнын алады.
    Сатып алынған Higgs-Man (оны тек бот әкімшісі сата алады) ойыншылар санына қарамай
    тұрғынның, ол жоқ болса Қайыршының орнына шығады; бір ойында Higgs-Man біреу ғана.
    """
    if len(set(user_ids)) != len(user_ids):
        raise ValueError("Ойыншылар қайталанбауы керек")
    pool = balance.composition(len(user_ids))
    if (
        len(user_ids) >= balance.HIGGS_MIN_PLAYERS
        and pool[Role.CIVILIAN] > 0
        and rng.random() < higgs_chance
    ):
        pool[Role.CIVILIAN] -= 1
        pool[Role.HIGGS] += 1
    roles: dict[int, Role] = {}
    fulfilled: list[RoleRequest] = []
    unfulfilled: list[RoleRequest] = []
    seen: set[int] = set()
    for req in requests:
        if req.user_id not in user_ids or req.user_id in seen:
            continue
        seen.add(req.user_id)
        if req.role is Role.HIGGS and pool[Role.HIGGS] == 0 and Role.HIGGS not in roles.values():
            slot = next((r for r in HIGGS_SLOTS if pool[r] > 0), None)
            if slot is not None:
                pool[slot] -= 1
                pool[Role.HIGGS] += 1
        buyable = req.role not in NOT_FOR_SALE or req.role is Role.HIGGS
        if buyable and pool[req.role] > 0:
            pool[req.role] -= 1
            roles[req.user_id] = req.role
            fulfilled.append(req)
        else:
            unfulfilled.append(req)
    rest_roles = list(pool.elements())
    rng.shuffle(rest_roles)
    rest_players = [uid for uid in user_ids if uid not in roles]
    rng.shuffle(rest_players)
    if len(rest_roles) != len(rest_players):  # pragma: no cover - инвариант
        raise AssertionError("Рөлдер мен ойыншылар саны сәйкес емес")
    roles.update(zip(rest_players, rest_roles, strict=True))
    return Assignment(roles=roles, fulfilled=fulfilled, unfulfilled=unfulfilled)


@dataclass(frozen=True)
class ActionOption:
    kind: ActionKind
    targets: tuple[int, ...] = ()

    @property
    def needs_target(self) -> bool:
        return self.kind not in (ActionKind.DETONATE, ActionKind.AWAKE, ActionKind.SKIP)


@dataclass(frozen=True)
class NightAction:
    kind: ActionKind
    target: int | None = None


@dataclass(frozen=True)
class Attack:
    source: str
    attacker: int
    target: int
    pierce: bool = False


@dataclass
class WitchPrompt:
    witch_id: int
    attackers: list[int]


@dataclass
class _PendingNight:
    deaths: dict[int, str]
    lethal_by: dict[int, list[Attack]]
    wolf_hits: dict[int, str]
    explosion: tuple[int, list[int]] | None
    visits: dict[int, list[int]]
    effective: dict[int, NightAction]
    public: list[str]
    private: list[tuple[int, str]]
    witch: WitchPrompt | None
    blocked: set[int]
    saved_by_doctor: dict[int, list[str]]   # нысана -> Дәрігер тоқтатқан шабуылдаушылардың рөлдері


@dataclass
class Report:
    """Фазаның нәтижесі: топқа жарияланатын мәтін және жеке хабарламалар."""

    public: str
    private: list[tuple[int, str]] = field(default_factory=list)
    deaths: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class GameResult:
    winner: Faction | None   # None — тең ойын / жеңімпаз фракция жоқ
    label: str
    winners: frozenset[int]


@dataclass(frozen=True)
class SubmitResult:
    ok: bool
    message: str


class Game:
    def __init__(
        self,
        game_id: int,
        chat_id: int,
        players: list[Player],
        rng: random.Random | None = None,
        lang: str = i18n.DEFAULT_LANG,
    ) -> None:
        if not balance.MIN_PLAYERS <= len(players) <= balance.MAX_PLAYERS:
            raise ValueError("Ойыншылар саны 4–50 болуы керек")
        self.game_id = game_id
        self.chat_id = chat_id
        self.lang = i18n.norm(lang)
        self.rng = rng or random.Random()
        self.players: dict[int, Player] = {p.user_id: p for p in players}
        self.phase = Phase.LOBBY
        self.day = 0
        self.actions: dict[int, NightAction] = {}
        self.votes: dict[int, int | None] = {}
        self.awake: dict[int, int] = {}            # Балым жалеп: осы түнгі басу саны
        self.candidate: int | None = None          # растауға шыққан ойыншы
        self.kamikaze_pending: int | None = None   # дарға асылған Камикадзе (кімді алып кететінін таңдайды)
        self.confirm_votes: dict[int, bool] = {}   # user_id -> 👍 (True) / 👎 (False)
        self.bombed: set[int] = set()
        self.defender_cover: int | None = None
        self.quiet_cycles = 0
        self._deaths_this_cycle = 0
        self._pending: _PendingNight | None = None
        self.result: GameResult | None = None
        defenders = [p for p in self.ordered() if p.role is Role.DEFENDER]
        if defenders:
            self.rng.choice(defenders).head_defender = True
        for p in self.players.values():
            if p.role is Role.HIGGS:
                p.higgs_armor = HIGGS_ARMOR
                p.higgs_vote_save = True

    # --- Көмекші әдістер ------------------------------------------------------

    def t(self, key: str, /, **params: object) -> str:
        return i18n.t(self.lang, key, **params)

    def title(self, role: Role) -> str:
        """Ойын мәтіндеріндегі рөл атауы (смайликсіз)."""
        return role_name(role, self.lang)

    def action_label(self, kind: ActionKind) -> str:
        return self.t(f"action.{kind.value}")

    def cause(self, source: str) -> str:
        return self.t(f"cause.{source}")

    @property
    def size(self) -> int:
        return len(self.players)

    def ordered(self) -> list[Player]:
        return sorted(self.players.values(), key=lambda p: p.order)

    def alive(self) -> list[Player]:
        return [p for p in self.ordered() if p.alive]

    def alive_ids(self) -> set[int]:
        return {p.user_id for p in self.players.values() if p.alive}

    def player(self, user_id: int) -> Player | None:
        return self.players.get(user_id)

    def with_role(self, *roles: Role, alive: bool = True) -> list[Player]:
        return [p for p in self.ordered() if p.role in roles and (p.alive or not alive)]

    def mafia_team(self) -> list[Player]:
        return self.with_role(*MAFIA_TEAM_ROLES)

    def team_of(self, user_id: int) -> list[Player]:
        """Ойыншы жеке чат арқылы сөйлесе алатын серіктестері (тірілер)."""
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return []
        if p.role in MAFIA_TEAM_ROLES:
            group = self.mafia_team()
        elif p.role is Role.DEFENDER:
            group = self.with_role(Role.DEFENDER)
        elif p.role in (Role.COMMISSIONER, Role.SERGEANT):
            group = self.with_role(Role.COMMISSIONER, Role.SERGEANT)
        else:
            return []
        return [q for q in group if q.user_id != user_id]

    def _name(self, user_id: int) -> str:
        return self.players[user_id].mention

    def reveal(self, p: Player) -> str:
        """Ашылған рөл (қасқыр не мұрагер болса, бұрынғы рөлімен)."""
        if p.role is not p.initial_role:
            return self.t("role.was", role=self.title(p.role), old=self.title(p.initial_role))
        return self.title(p.role)

    def alive_list_text(self) -> str:
        return "\n".join(p.label for p in self.alive())

    def alive_roles_text(self) -> str:
        """Тірілердің арасындағы рөлдер (әрқайсысы бір рет, кімде екені айтылмайды)."""
        present = {p.role for p in self.alive()}
        return ", ".join(self.title(role) for role in Role if role in present)

    def alive_block(self) -> list[str]:
        """«Тірі ойыншылар» тізімі, олардың ішіндегі рөлдер және жалпы саны."""
        return [
            self.t("night.alive"),
            self.alive_list_text(),
            "",
            self.t("night.roles", roles=self.alive_roles_text()),
            self.t("night.total", count=len(self.alive())),
        ]

    def _team_line(self, players: list[Player]) -> str:
        return ", ".join(f"{q.mention} ({self.title(q.role)})" for q in players) or "—"

    # --- Ойын басы --------------------------------------------------------------

    def allies(self, user_id: int) -> list[Player]:
        """Ойыншының одақтастары, өзімен бірге (командалық рөлдер үшін, әйтпесе бос)."""
        p = self.players[user_id]
        if p.role in MAFIA_TEAM_ROLES:
            return self.mafia_team()
        if p.role is Role.DEFENDER:
            return self.with_role(Role.DEFENDER)
        if p.role in (Role.COMMISSIONER, Role.SERGEANT):
            return self.with_role(Role.COMMISSIONER, Role.SERGEANT)
        return []

    def role_intro(self, user_id: int) -> str:
        """Ойын басындағы қысқа хабар: рөл, не істейтіні, одақтастары, заттары."""
        p = self.players[user_id]
        lines = [self.t("intro.role", role=self.title(p.role)), description(p.role, self.lang)]
        if p.role is Role.HIGGS:
            lines.append(self.t("intro.higgs", armor=p.higgs_armor))
        allies = self.allies(user_id)
        if len(allies) > 1:
            lines += ["", self.t("intro.allies")]
            lines += [f"{q.mention} - {self.title(q.role)}" for q in allies]
            if p.role is Role.DEFENDER:
                head = next((q for q in allies if q.head_defender), None)
                if head is not None:
                    lines.append(self.t("intro.head_defender", name=head.mention))
            lines.append(self.t("intro.team_chat"))
        items = []
        if p.shield_available:
            items.append(self.t("item.shields.name"))
        if p.vote_shield_available:
            items.append(self.t("item.vote_shields.name"))
        if p.bullet_available:
            items.append(self.t("item.piercing_bullets.name"))
        if p.fake_doc:
            items.append(self.t("item.fake_docs.name"))
        if items:
            lines += ["", self.t("intro.items", items=", ".join(items))]
        return "\n".join(lines)

    # --- Түн --------------------------------------------------------------------

    def start_night(self) -> str:
        self._require_running()
        if self.phase is Phase.NIGHT:
            raise RuntimeError("Түн басталып қойған")
        self.day += 1
        self.phase = Phase.NIGHT
        self.actions = {}
        self.awake = {}
        self.defender_cover = None
        return "\n".join([self.t("night.title", day=self.day), self.t("night.body")])

    def night_options(self, user_id: int) -> list[ActionOption]:
        p = self.players.get(user_id)
        if self.phase is not Phase.NIGHT or p is None or not p.alive:
            return []
        others = [q.user_id for q in self.alive() if q.user_id != user_id]
        mafia_ids = {q.user_id for q in self.mafia_team()}
        opts: list[ActionOption] = []

        def add(kind: ActionKind, targets: list[int]) -> None:
            if targets:
                opts.append(ActionOption(kind, tuple(targets)))

        role = p.role
        if role is Role.SLEEPLESS:
            return [ActionOption(ActionKind.AWAKE)]  # «Өткізу» жоқ — ұйықтауға болмайды
        if role in (Role.DON, Role.MAFIA):
            add(ActionKind.MAFIA_KILL, [t for t in others if t not in mafia_ids])
        elif role is Role.KILLER:
            add(ActionKind.KILLER_KILL, [t for t in others if t not in mafia_ids])
        elif role is Role.MANIAC:
            add(ActionKind.MANIAC_KILL, others)
        elif role is Role.COMMISSIONER:
            sergeants = {q.user_id for q in self.with_role(Role.SERGEANT)}
            targets = [t for t in others if t not in sergeants]
            add(ActionKind.CHECK, targets)
            if self.day > 1:
                add(ActionKind.SHOOT, targets)
        elif role is Role.DOCTOR:
            targets = [q.user_id for q in self.alive()]
            if p.self_heal_used:
                targets.remove(user_id)
            add(ActionKind.HEAL, [t for t in targets if t != p.last_target])
        elif role is Role.HACKER:
            add(ActionKind.BLOCK, [t for t in others if t != p.last_target])
        elif role is Role.DEFENDER and p.head_defender:
            defenders = {q.user_id for q in self.with_role(Role.DEFENDER)}
            add(ActionKind.PROTECT, [t for t in others if t not in defenders])
        elif role is Role.BEGGAR:
            add(ActionKind.VISIT, others)
        elif role is Role.PYRO:
            add(ActionKind.BOMB, [t for t in others if t not in self.bombed])
            if len(self._alive_bombed(exclude=user_id)) >= 3:
                opts.append(ActionOption(ActionKind.DETONATE))
        if opts:
            opts.append(ActionOption(ActionKind.SKIP))
        return opts

    def _alive_bombed(self, exclude: int | None = None) -> list[int]:
        return [b for b in self.bombed if self.players[b].alive and b != exclude]

    def expected_actors(self) -> set[int]:
        return {p.user_id for p in self.alive() if self.night_options(p.user_id)}

    def night_complete(self) -> bool:
        return self.expected_actors() <= set(self.actions)

    def note_idle(self, prompted: Iterable[int]) -> list[int]:
        """Түн соңында шақырылады. ``prompted`` — түнде әрекет етуге шақырылған ойыншылар.

        Ештеңе баспаған ойыншының әрекетсіз түндері санағы өседі (кез келген батырма,
        соның ішінде «Өткізу», санақты нөлдейді). ``AFK_NIGHTS`` түн қатарынан әрекетсіз
        қалғандар қайтарылады — оларды ойыннан шығару керек.
        """
        idle: list[int] = []
        for uid in prompted:
            p = self.players.get(uid)
            if p is None or not p.alive:
                continue
            if uid in self.actions:
                p.idle_nights = 0
                continue
            p.idle_nights += 1
            if p.idle_nights >= AFK_NIGHTS:
                idle.append(uid)
        return sorted(idle, key=lambda u: self.players[u].order)

    def night_prompt(self, user_id: int) -> str:
        """Түнгі әрекет сұрағы — қысқа, тек не істеу керектігі (батырмалар астында)."""
        p = self.players[user_id]
        role = p.role
        if role is Role.SLEEPLESS:
            body = self.t("prompt.sleepless", need=AWAKE_PRESSES)
        elif role is Role.COMMISSIONER and self.day <= 1:
            body = self.t("prompt.commissioner_first")
        elif role is Role.PYRO:
            bombed = [self._name(b) for b in self._alive_bombed(exclude=user_id)]
            body = self.t("prompt.pyro")
            if bombed:
                body += "\n" + self.t("prompt.pyro_bombed", names=", ".join(bombed))
            if len(bombed) >= 3:
                body += "\n" + self.t("prompt.pyro_ready")
        elif role in (
            Role.DON, Role.MAFIA, Role.KILLER, Role.MANIAC, Role.COMMISSIONER, Role.DOCTOR,
            Role.HACKER, Role.DEFENDER, Role.BEGGAR,
        ):
            body = self.t(f"prompt.{role.value}")
        else:
            return self.t("prompt.none")
        return body

    def submit_action(
        self, user_id: int, kind: ActionKind, target: int | None = None
    ) -> SubmitResult:
        if self.phase is not Phase.NIGHT:
            return SubmitResult(False, self.t("submit.not_night"))
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return SubmitResult(False, self.t("submit.not_alive"))
        if user_id in self.actions:
            return SubmitResult(False, self.t("submit.already"))
        option = next((o for o in self.night_options(user_id) if o.kind is kind), None)
        if option is None or kind is ActionKind.AWAKE:  # Балым жалеп — тек press_awake арқылы
            return SubmitResult(False, self.t("submit.unavailable"))
        if option.needs_target:
            if target not in option.targets:
                return SubmitResult(False, self.t("submit.bad_target"))
        else:
            target = None
        self.actions[user_id] = NightAction(kind, target)
        if kind is ActionKind.SKIP:
            return SubmitResult(True, self.t("submit.skip"))
        if kind is ActionKind.DETONATE:
            return SubmitResult(True, self.t("submit.detonate"))
        return SubmitResult(True, self.t("submit.ok", target=self._name(target)))

    def press_awake(self, user_id: int) -> tuple[bool, str, bool]:
        """Балым жалеп «Сору» батырмасын басты. ``(ok, мәтін, жеткілікті ме)`` қайтарады."""
        if self.phase is not Phase.NIGHT:
            return False, self.t("submit.not_night"), False
        p = self.players.get(user_id)
        if p is None or not p.alive or p.role is not Role.SLEEPLESS:
            return False, self.t("submit.unavailable"), False
        count = self.awake.get(user_id, 0) + 1
        self.awake[user_id] = count
        if count < AWAKE_PRESSES:
            return True, self.t("awake.progress", count=count, need=AWAKE_PRESSES), False
        # Жеткілікті басылды: түн «әрекет жасалды» деп есептеледі (түн ерте аяқтала алады).
        self.actions.setdefault(user_id, NightAction(ActionKind.AWAKE))
        return True, self.t("awake.done"), True

    def action_announcement(self, user_id: int, kind: ActionKind) -> str | None:
        """Әрекет таңдалғанда ортақ чатқа шығатын хабар (нысанасы айтылмайды)."""
        if kind is ActionKind.MAFIA_KILL:
            key = "don" if self.players[user_id].role is Role.DON else "mafia"
        else:
            key = ANNOUNCE_KEYS.get(kind)
            if key is None:
                return None
        return self.t(f"announce.{key}")

    def team_choice_note(self, user_id: int, target: int) -> str:
        """Одақтастарға: «Бека: таңдады Айжан»."""
        return self.t("night.team_choice", name=self._name(user_id), target=self._name(target))

    # --- Түнгі нәтижелерді есептеу ------------------------------------------------

    def resolve_night(self) -> WitchPrompt | None:
        """Түнгі әрекеттерді есептейді.

        Сиқыршыға шабуыл жасалса, оның шешімі қажет: ``WitchPrompt`` қайтарылады.
        Кез келген жағдайда кейін ``complete_night`` шақырылуы керек.
        """
        if self.phase is not Phase.NIGHT or self._pending is not None:
            raise RuntimeError("Түнді қазір есептеуге болмайды")
        alive_ids = self.alive_ids()
        acts = {uid: a for uid, a in self.actions.items() if uid in alive_ids}
        public: list[str] = []
        private: list[tuple[int, str]] = []
        visits: dict[int, list[int]] = defaultdict(list)

        def visit(target: int | None, visitor: int) -> None:
            if target is not None and visitor not in visits[target]:
                visits[target].append(visitor)

        # 2. Хакердің бұғаттауы.
        blocked: set[int] = set()
        for hacker in self.with_role(Role.HACKER):
            a = acts.get(hacker.user_id)
            if a is not None and a.kind is ActionKind.BLOCK:
                blocked.add(a.target)
                visit(a.target, hacker.user_id)
                hacker.last_target = a.target
            else:
                hacker.last_target = None
        effective = {
            uid: a
            for uid, a in acts.items()
            if a.kind is not ActionKind.SKIP
            and (uid not in blocked or self.players[uid].role is Role.HACKER)
        }

        # 3. Қорғаушылар.
        for uid, a in effective.items():
            if a.kind is ActionKind.PROTECT:
                visit(a.target, uid)
                if self.players[a.target].role in DEFENDER_COVER_ROLES:
                    self.defender_cover = a.target

        # 4. Дәрігердің емдеуі.
        healed: set[int] = set()
        for doctor in self.with_role(Role.DOCTOR):
            uid = doctor.user_id
            a = effective.get(uid)
            if a is not None and a.kind is ActionKind.HEAL:
                healed.add(a.target)
                visit(a.target, uid)
                doctor.last_target = a.target
                if a.target == uid:
                    doctor.self_heal_used = True
            else:
                doctor.last_target = None

        attacks: list[Attack] = []
        # 5. Дон мен мафияның ортақ шабуылы.
        target, attacker = self._mafia_decision(effective)
        if target is not None and attacker is not None:
            atk_player = self.players[attacker]
            attacks.append(
                Attack(SRC_MAFIA, attacker, target,
                       pierce=atk_player.role is Role.DON and atk_player.has_bullet)
            )
            visit(target, attacker)
        # 6. Киллер, 7. Қанішер.
        for kind, src in ((ActionKind.KILLER_KILL, SRC_KILLER), (ActionKind.MANIAC_KILL, SRC_MANIAC)):
            for uid, a in effective.items():
                if a.kind is kind:
                    attacks.append(Attack(src, uid, a.target, pierce=self.players[uid].has_bullet))
                    visit(a.target, uid)
        # 8. Комиссар: тексеру немесе оқ ату.
        for uid, a in effective.items():
            if a.kind is ActionKind.CHECK:
                visit(a.target, uid)
                text = self.t("night.check_result", target=self._name(a.target),
                              role=self._check_result(a.target))
                private.append((uid, text))
                for sergeant in self.with_role(Role.SERGEANT):
                    private.append((sergeant.user_id, self.t("night.sergeant_relay", text=text)))
            elif a.kind is ActionKind.SHOOT:
                attacks.append(
                    Attack(SRC_COMMISSIONER, uid, a.target, pierce=self.players[uid].has_bullet)
                )
                visit(a.target, uid)
        # 9. Қайыршының сапары (ақпарат төменде, барлық сапарлар белгілі болғанда).
        for uid, a in effective.items():
            if a.kind is ActionKind.VISIT:
                visit(a.target, uid)
        # 10. Бомбалар.
        explosion: tuple[int, list[int]] | None = None
        for uid, a in effective.items():
            if a.kind is ActionKind.BOMB:
                self.bombed.add(a.target)
                visit(a.target, uid)
                private.append((uid, self.t("night.bomb_planted", target=self._name(a.target))))
            elif a.kind is ActionKind.DETONATE:
                explosion = (uid, sorted(b for b in self._alive_bombed(exclude=uid)))

        # Шабуылдардың нәтижесі.
        deaths: dict[int, str] = {}
        lethal_by: dict[int, list[Attack]] = defaultdict(list)
        witch_attackers: dict[int, list[int]] = defaultdict(list)
        wolf_hits: dict[int, str] = {}
        saved_by_doctor: dict[int, list[str]] = defaultdict(list)
        for atk in attacks:
            t = self.players[atk.target]
            if t.role is Role.WITCH and not t.witch_magic_used:
                if atk.attacker not in witch_attackers[t.user_id]:
                    witch_attackers[t.user_id].append(atk.attacker)
                continue
            if t.role is Role.WOLF and atk.source in (SRC_MAFIA, SRC_KILLER, SRC_COMMISSIONER):
                wolf_hits.setdefault(t.user_id, atk.source)
                continue
            if t.role is Role.KAMIKAZE:  # Камикадзеге ешқандай қорғаныс жұмыс істемейді
                lethal_by[t.user_id].append(atk)
                deaths.setdefault(t.user_id, atk.source)
                continue
            if t.user_id in healed:
                saved_by_doctor[t.user_id].append(self.title(self.players[atk.attacker].role))
                continue
            if self._higgs_absorbs(t, private):
                continue
            if t.has_shield:
                shooter = self.players[atk.attacker]
                t.shield_used = True
                if atk.pierce and shooter.has_bullet:
                    shooter.bullet_used = True
                    private.append((shooter.user_id, self.t("night.bullet_pierced")))
                else:
                    private.append((t.user_id, self.t("night.shield_saved")))
                    continue
            lethal_by[t.user_id].append(atk)
            deaths.setdefault(t.user_id, atk.source)

        if explosion is not None:
            pyro_id, targets = explosion
            public.append(self.t("morning.explosion"))
            deaths[pyro_id] = SRC_PYRO_SELF
            for b in targets:
                if b in healed:
                    saved_by_doctor[b].append(self.title(Role.PYRO))
                    continue
                if self._higgs_absorbs(self.players[b], private):
                    continue
                deaths.setdefault(b, SRC_BOMB)
        if saved_by_doctor:
            public.append(self.t("morning.saved"))

        # Балым жалеп жеткілікті баспаса — таңертең мафиялар оны өлтіреді (Дәрігер құтқармайды).
        for p in self.with_role(Role.SLEEPLESS):
            if self.awake.get(p.user_id, 0) < AWAKE_PRESSES:
                if deaths.setdefault(p.user_id, SRC_SLEEPLESS) == SRC_SLEEPLESS:
                    public.append(self.t("morning.sleepless"))

        witch_prompt: WitchPrompt | None = None
        for witch_id, attackers in witch_attackers.items():
            self.players[witch_id].witch_magic_used = True
            if witch_id in deaths:  # Пиро бомбасы — сиқыр күшсіз
                continue
            witch_prompt = WitchPrompt(witch_id, attackers)
            public.append(self.t("morning.witch"))

        self._pending = _PendingNight(
            deaths=deaths,
            lethal_by=lethal_by,
            wolf_hits=wolf_hits,
            explosion=explosion,
            visits=visits,
            effective=effective,
            public=public,
            private=private,
            witch=witch_prompt,
            blocked=blocked,
            saved_by_doctor=dict(saved_by_doctor),
        )
        return witch_prompt

    def _higgs_absorbs(self, p: Player, private: list[tuple[int, str]]) -> bool:
        """Higgs-Man өрісі шабуылды өзіне алады (қорғаныс таусылғанша)."""
        if p.role is not Role.HIGGS or p.higgs_armor <= 0:
            return False
        p.higgs_armor -= 1
        private.append((p.user_id, self.t("night.higgs_absorbed", left=p.higgs_armor)))
        return True

    def witch_prompt_text(self, prompt: WitchPrompt) -> str:
        names = ", ".join(self._name(a) for a in prompt.attackers)
        return self.t("witch.prompt", names=names)

    def complete_night(self, witch_punish: bool | None = None) -> Report:
        pending = self._pending
        if pending is None:
            raise RuntimeError("Алдымен resolve_night шақырылуы керек")
        deaths = pending.deaths
        public = pending.public
        private = pending.private

        # 11. Сиқыршының шешімі.
        if pending.witch is not None:
            w = pending.witch
            if witch_punish:
                for attacker in w.attackers:
                    deaths.setdefault(attacker, SRC_WITCH)
                private.append((w.witch_id, self.t("night.witch_punished")))
            else:
                private.append((w.witch_id, self.t("night.witch_forgave")))

        # 12. Камикадзені атқандар онымен бірге өледі (Дәрігер мен қорғаныстан басым).
        #     Оны Комиссардан басқа біреу атса — Камикадзе жеңеді.
        for target_id, atks in pending.lethal_by.items():
            kamikaze = self.players[target_id]
            if kamikaze.role is not Role.KAMIKAZE or target_id not in deaths:
                continue
            for atk in atks:
                if atk.attacker != target_id and atk.attacker not in deaths:
                    deaths[atk.attacker] = SRC_KAMIKAZE
                    shooter = self.players[atk.attacker]
                    public.append(self.t("kamikaze.took", name=shooter.mention, role=self.reveal(shooter)))
            if any(atk.source in (SRC_MAFIA, SRC_KILLER, SRC_MANIAC) for atk in atks):
                kamikaze.personal_win = True

        # 13. Қасқырлардың фракция ауысуы.
        for wolf_id, source in pending.wolf_hits.items():
            if wolf_id not in deaths:
                private.extend(self._convert_wolf(wolf_id, source))
                key = "morning.wolf_mafia" if source in (SRC_MAFIA, SRC_KILLER) else "morning.wolf_sergeant"
                public.append(self.t(key))

        # 14. Өлімдерді бекіту.
        dead_order = [p.user_id for p in self.ordered() if p.user_id in deaths]
        for uid in dead_order:
            self._kill(uid, deaths[uid])
            private.append((uid, self.t("night.you_died", cause=self.cause(deaths[uid]))))

        if pending.explosion is not None:
            pyro_id, targets = pending.explosion
            if len(targets) >= 3 and all(not self.players[t].alive for t in targets):
                self.players[pyro_id].personal_win = True
                public.append(self.t("morning.pyro_won"))
            else:
                public.append(self.t("morning.pyro_failed"))
            self.bombed.clear()

        # Қайыршыға ақпарат.
        for uid, a in pending.effective.items():
            if a.kind is ActionKind.VISIT:
                guests = [v for v in pending.visits.get(a.target, []) if v != uid]
                names = ", ".join(self._name(v) for v in guests) or self.t("night.beggar_nobody")
                private.append(
                    (uid, self.t("night.beggar_info", target=self._name(a.target), names=names))
                )

        private.extend(self._target_notes(pending))
        private.extend(self._promotions())
        self._pending = None
        if self.result is None:
            self.phase = Phase.DAY

        lines = [self.t("morning.title", day=self.day)]
        if dead_order:
            lines.append(self.t("morning.dead"))
            for uid in dead_order:
                p = self.players[uid]
                lines.append(self.t("morning.dead_line", name=p.label, role=self.reveal(p),
                                    cause=self.cause(p.death_cause)))
        else:
            lines.append(self.t("morning.nobody"))
        lines += public
        lines += ["", *self.alive_block()]
        return Report(public="\n".join(lines), private=private, deaths=dead_order)

    def _target_notes(self, pending: _PendingNight) -> list[tuple[int, str]]:
        """Түнде өзіне әрекет жасалған тірі ойыншыларға жеке хабар (кім екені айтылмайды, тек рөлі)."""
        notes: list[tuple[int, str]] = []
        for uid in sorted(pending.blocked, key=lambda u: self.players[u].order):
            if self.players[uid].alive:
                own = self.actions.get(uid)
                acted = own is not None and own.kind is not ActionKind.SKIP
                key = "night.hacked" if acted else "night.hacked_idle"
                notes.append((uid, self.t(key, role=self.title(Role.HACKER))))
        for uid, a in pending.effective.items():
            note = TARGET_NOTES.get(a.kind)
            if note is None or a.target is None or a.target == uid or not self.players[a.target].alive:
                continue
            key, role = note
            if a.kind is ActionKind.HEAL and a.target in pending.saved_by_doctor:
                key = "night.healed_saved"
            notes.append((a.target, self.t(key, role=self.title(role))))
        # Дәрігерге: емделді ме (кімнен — тек рөлі) әлде емдеудің керегі болмады ма.
        for uid, a in pending.effective.items():
            if a.kind is not ActionKind.HEAL or not self.players[a.target].alive:
                continue
            guests = list(dict.fromkeys(pending.saved_by_doctor.get(a.target, [])))
            if guests:
                text = self.t("night.doctor_saved", target=self._name(a.target), roles=", ".join(guests))
            else:
                text = self.t("night.doctor_idle", target=self._name(a.target))
            notes.append((uid, text))
        return notes

    def _mafia_decision(self, effective: dict[int, NightAction]) -> tuple[int | None, int | None]:
        """Мафияның ортақ нысанасы және оны атқан адам.

        Нысананы Дон таңдайды, таңдамаса (не бұғатталса) — мафия мүшелерінің көпшілік дауысы.
        Бірақ атушы әрқашан Дон: Камикадзе Донды алып кетеді, Қайыршы тек Донды көреді.
        """
        don = next(iter(self.with_role(Role.DON)), None)
        if don is not None:
            chosen = effective.get(don.user_id)
            if chosen is not None and chosen.kind is ActionKind.MAFIA_KILL:
                return chosen.target, don.user_id
            own = self.actions.get(don.user_id)
            if own is not None and own.kind is ActionKind.SKIP:
                return None, None  # Дон әдейі шабуылдан бас тартты
        # Дон таңдау жасамады немесе бұғатталды — мафия мүшелерінің дауысы шешеді.
        votes = [
            (uid, a.target)
            for uid, a in effective.items()
            if a.kind is ActionKind.MAFIA_KILL and self.players[uid].role is Role.MAFIA
        ]
        if not votes:
            return None, None
        tally = Counter(t for _, t in votes)
        best = max(tally.values())
        tied = sorted(t for t, c in tally.items() if c == best)
        target = self.rng.choice(tied)
        attacker = don.user_id if don is not None else next(uid for uid, t in votes if t == target)
        return target, attacker

    def _check_result(self, target_id: int) -> str:
        t = self.players[target_id]
        if self.defender_cover == target_id:
            return self.title(Role.CIVILIAN)
        if t.fake_doc:
            t.fake_doc = False
            return self.title(Role.CIVILIAN)
        return self.title(t.role)

    def _convert_wolf(self, wolf_id: int, source: str) -> list[tuple[int, str]]:
        wolf = self.players[wolf_id]
        notes: list[tuple[int, str]] = []
        if source in (SRC_MAFIA, SRC_KILLER):
            wolf.role = Role.MAFIA
            mates = [q for q in self.mafia_team() if q.user_id != wolf_id]
            notes.append((wolf_id, self.t("night.wolf_mafia", role=self.title(Role.MAFIA),
                                          team=self._team_line(mates))))
            notes += [(q.user_id, self.t("night.wolf_joined_mafia", name=wolf.mention)) for q in mates]
        else:
            wolf.role = Role.SERGEANT
            mates = [q for q in self.with_role(Role.COMMISSIONER, Role.SERGEANT) if q.user_id != wolf_id]
            notes.append((wolf_id, self.t("night.wolf_sergeant", role=self.title(Role.SERGEANT),
                                          team=self._team_line(mates))))
            notes += [(q.user_id, self.t("night.wolf_joined_police", name=wolf.mention)) for q in mates]
        return notes

    def _promotions(self) -> list[tuple[int, str]]:
        notes: list[tuple[int, str]] = []
        if not self.with_role(Role.DON):
            heirs = self.with_role(Role.MAFIA)
            if heirs:
                new_don = self.rng.choice(heirs)  # мафиялардың кездейсоқ біреуі жаңа Дон болады
                new_don.role = Role.DON
                notes.append((new_don.user_id, self.t("promo.new_don")))
                for q in self.mafia_team():
                    if q.user_id != new_don.user_id:
                        notes.append((q.user_id, self.t("promo.new_don_team", name=new_don.mention)))
        if not self.with_role(Role.COMMISSIONER):
            heirs = self.with_role(Role.SERGEANT)
            if heirs:
                new_com = heirs[0]
                new_com.role = Role.COMMISSIONER
                notes.append((new_com.user_id, self.t("promo.new_com")))
                for q in self.with_role(Role.SERGEANT):
                    notes.append((q.user_id, self.t("promo.new_com_team", name=new_com.mention)))
        defenders = self.with_role(Role.DEFENDER)
        if defenders and not any(d.head_defender for d in defenders):
            defenders[0].head_defender = True
            notes.append((defenders[0].user_id, self.t("promo.new_head")))
        return notes

    def _kill(self, user_id: int, cause: str) -> None:
        p = self.players[user_id]
        if not p.alive:
            return
        p.alive = False
        p.death_day = self.day
        p.death_cause = cause
        p.head_defender = False
        self.bombed.discard(user_id)
        self._deaths_this_cycle += 1

    # --- Күн және дауыс беру --------------------------------------------------------

    def day_text(self, seconds: int) -> str:
        return self.t("day.text", day=self.day, seconds=seconds)

    def start_vote(self, seconds: int = 0) -> str:
        if self.phase is not Phase.DAY:
            raise RuntimeError("Дауыс беру тек күндіз басталады")
        self.phase = Phase.VOTE
        self.votes = {}
        return self.t("vote.start", seconds=seconds)

    def vote_prompt(self) -> str:
        return self.t("vote.prompt", day=self.day)

    def vote_candidates(self, user_id: int) -> list[int]:
        p = self.players.get(user_id)
        if self.phase is not Phase.VOTE or p is None or not p.alive:
            return []
        return [q.user_id for q in self.alive() if q.user_id != user_id]

    def submit_vote(self, user_id: int, target: int | None) -> SubmitResult:
        if self.phase is not Phase.VOTE:
            return SubmitResult(False, self.t("vote.not_now"))
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return SubmitResult(False, self.t("vote.not_alive"))
        if user_id in self.votes:
            return SubmitResult(False, self.t("vote.already"))
        if target is not None and target not in self.vote_candidates(user_id):
            return SubmitResult(False, self.t("vote.bad_target"))
        self.votes[user_id] = target
        if target is None:
            return SubmitResult(True, self.t("vote.ok_abstain"))
        return SubmitResult(True, self.t("vote.ok", target=self._name(target)))

    def vote_announcement(self, user_id: int) -> str:
        """Ойыншы дауыс бергенде ортақ чатқа шығатын жеке хабар."""
        target = self.votes.get(user_id)
        voter = self._name(user_id)
        if target is None:
            return self.t("vote.cast_abstain", voter=voter)
        return self.t("vote.cast", voter=voter, target=self._name(target))

    def vote_complete(self) -> bool:
        return self.alive_ids() <= set(self.votes)

    def resolve_vote(self) -> Report:
        """Дауыстарды санау.

        Бір ойыншы ең көп дауыс жинаса, 👍/👎 растау кезеңі басталады (``Phase.CONFIRM``,
        ``self.candidate``) — нәтижесін ``resolve_confirm`` шығарады. Дауыс болмаса
        не тең түссе, ешкім асылмайды және күн аяқталады.
        """
        if self.phase is not Phase.VOTE:
            raise RuntimeError("Дауыс беру жүріп жатқан жоқ")
        alive = self.alive_ids()
        votes = {v: t for v, t in self.votes.items() if v in alive and (t is None or t in alive)}
        tally = Counter(t for t in votes.values() if t is not None)
        top = tally.most_common(2)
        if not top:
            return self._end_vote([self.t("vote.no_votes")], [], [])
        if len(top) > 1 and top[0][1] == top[1][1]:
            return self._end_vote([self.t("vote.tie")], [], [])
        # Үміткер растау хабарында аталады — бөлек нәтиже хабары қажет емес.
        self.candidate = top[0][0]
        self.confirm_votes = {}
        self.phase = Phase.CONFIRM
        return Report(public="")

    # --- 👍/👎 растау ------------------------------------------------------------------

    def confirm_voters(self) -> set[int]:
        """Растауға дауыс бере алатындар: үміткерден басқа тірі ойыншылар."""
        return self.alive_ids() - {self.candidate}

    def confirm_counts(self) -> tuple[int, int]:
        voters = self.confirm_voters()
        yes = sum(1 for uid, v in self.confirm_votes.items() if v and uid in voters)
        no = sum(1 for uid, v in self.confirm_votes.items() if not v and uid in voters)
        return yes, no

    def confirm_text(self, seconds: int) -> str:
        return self.t("confirm.ask", day=self.day, name=self._name(self.candidate), seconds=seconds)

    def confirm_closed_text(self) -> str:
        yes, no = self.confirm_counts()
        return self.t("confirm.closed", name=self._name(self.candidate), yes=yes, no=no)

    def submit_confirm(self, user_id: int, yes: bool) -> SubmitResult:
        """👍/👎 дауысы. Уақыт біткенше пікірді өзгертуге болады."""
        if self.phase is not Phase.CONFIRM or self.candidate is None:
            return SubmitResult(False, self.t("confirm.not_now"))
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return SubmitResult(False, self.t("confirm.not_alive"))
        if user_id == self.candidate:
            return SubmitResult(False, self.t("confirm.self"))
        self.confirm_votes[user_id] = yes
        return SubmitResult(True, self.t("confirm.ok_yes" if yes else "confirm.ok_no"))

    def confirm_complete(self) -> bool:
        if self.candidate is None or not self.players[self.candidate].alive:
            return True
        return self.confirm_voters() <= set(self.confirm_votes)

    def resolve_confirm(self) -> Report:
        """Растау нәтижесі: 👍 саны 👎-ден көп болса ғана үміткер дарға асылады."""
        if self.phase is not Phase.CONFIRM or self.candidate is None:
            raise RuntimeError("Растау жүріп жатқан жоқ")
        yes, no = self.confirm_counts()
        lines: list[str] = []
        private: list[tuple[int, str]] = []
        deaths: list[int] = []
        target = self.players[self.candidate]
        if not target.alive:
            lines.append(self.t("confirm.gone", name=target.mention))
        elif yes <= no:
            lines.append(self.t("confirm.spared", name=target.mention))
        elif self.defender_cover == target.user_id and target.role in DEFENDER_COVER_ROLES:
            lines.append(self.t("vote.saved", name=target.mention))
        elif target.role is Role.KAMIKAZE:
            self._kill(target.user_id, SRC_LYNCH)
            deaths.append(target.user_id)
            lines.append(self.t("vote.lynched", name=target.mention, role=self.reveal(target)))
            self.kamikaze_pending = target.user_id  # енді кімді алып кететінін таңдайды
        elif target.role is Role.SUICIDE:
            self._kill(target.user_id, SRC_LYNCH)
            target.personal_win = True
            deaths.append(target.user_id)
            lines.append(self.t("vote.suicide_won", name=target.mention, role=self.reveal(target)))
        elif target.role is Role.HIGGS and target.higgs_vote_save:
            target.higgs_vote_save = False
            private.append((target.user_id, self.t("vote.higgs_saved")))
            lines.append(self.t("vote.saved", name=target.mention))
        elif target.has_vote_shield:
            target.vote_shield_used = True
            private.append((target.user_id, self.t("vote.vote_shield_used")))
            lines.append(self.t("vote.saved", name=target.mention))
        else:
            self._kill(target.user_id, SRC_LYNCH)
            deaths.append(target.user_id)
            lines.append(self.t("vote.lynched", name=target.mention, role=self.reveal(target)))
            private.append((target.user_id, self.t("vote.you_lynched")))
        return self._end_vote(lines, private, deaths)

    def kamikaze_targets(self) -> list[int]:
        """Дарға асылған Камикадзе алып кете алатындар: тірілер (басқа Камикадзелерсіз)."""
        if self.kamikaze_pending is None:
            return []
        return [p.user_id for p in self.alive() if p.role is not Role.KAMIKAZE]

    def kamikaze_take(self, target: int | None) -> Report | None:
        """Камикадзенің таңдауы (``None`` — уақыт бітті). Нысана бірден өледі.

        Мафияны, Донды, Киллерді, Қорғаушыны, Қанішерді не Пироны алып кетсе — Камикадзе жеңеді.
        """
        kamikaze_id = self.kamikaze_pending
        if kamikaze_id is None or self.result is not None:
            self.kamikaze_pending = None
            return None
        if target is not None and target not in self.kamikaze_targets():
            return None
        self.kamikaze_pending = None
        if target is None:
            return Report(public=self.t("kamikaze.none"))
        victim = self.players[target]
        self._kill(target, SRC_KAMIKAZE)
        if victim.role in KAMIKAZE_PREY:
            self.players[kamikaze_id].personal_win = True
        private = [(target, self.t("night.you_died", cause=self.cause(SRC_KAMIKAZE)))]
        private.extend(self._promotions())
        return Report(
            public=self.t("kamikaze.took", name=victim.mention, role=self.reveal(victim)),
            private=private,
            deaths=[target],
        )

    def _end_vote(self, lines: list[str], private: list[tuple[int, str]], deaths: list[int]) -> Report:
        private.extend(self._promotions())
        if self.result is None:
            self.phase = Phase.DAY
        self.defender_cover = None
        self.candidate = None
        self.confirm_votes = {}
        return Report(public="\n".join(lines), private=private, deaths=deaths)

    # --- Ойыннан шығу ------------------------------------------------------------------

    def desert(self, user_id: int, afk: bool = False) -> Report | None:
        """Ойыншыны ойыннан шығару: өз еркімен (/leave) немесе AFK болғаны үшін.

        Рөлі ортақ чатта ашылады. Шыққан ойыншы ойын соңында жеңе алмайды.
        """
        p = self.players.get(user_id)
        if p is None or not p.alive or self.phase in (Phase.LOBBY, Phase.ENDED):
            return None
        p.deserted = True
        self.actions.pop(user_id, None)
        self.votes.pop(user_id, None)
        self.confirm_votes.pop(user_id, None)
        self._kill(user_id, SRC_AFK if afk else SRC_DESERT)
        key = "afk.public" if afk else "desert.public"
        return Report(
            public=self.t(key, name=p.mention, role=self.reveal(p), nights=AFK_NIGHTS),
            private=self._promotions(),
            deaths=[user_id],
        )

    # --- Жеңіс шарттары -----------------------------------------------------------------

    def end_cycle(self) -> None:
        """Күн+түн циклі аяқталғанда шақырылады (өлімсіз циклдарды санау үшін)."""
        if self._deaths_this_cycle:
            self.quiet_cycles = 0
        else:
            self.quiet_cycles += 1
        self._deaths_this_cycle = 0

    def check_winner(self) -> GameResult | None:
        if self.result is not None:
            return self.result
        if self.phase is Phase.LOBBY:
            return None
        alive = self.alive()
        maniac_alive = any(p.role is Role.MANIAC for p in alive)
        power = sum(1 for p in alive if p.role in MAFIA_POWER_ROLES)
        mafia_faction = sum(1 for p in alive if p.faction is Faction.MAFIA)
        others = len(alive) - mafia_faction

        winner: Faction | None
        if not alive:
            winner, label = None, self.t("result.nobody_alive")
        elif maniac_alive and len(alive) <= 2:
            winner, label = Faction.INDEPENDENT, self.t("result.won", side=self.title(Role.MANIAC))
        elif power == 0 and not maniac_alive:
            winner, label = Faction.TOWN, self.t("result.won", side=faction_title(Faction.TOWN, self.lang))
        elif power > 0 and not maniac_alive and power >= others:
            winner, label = Faction.MAFIA, self.t("result.won", side=faction_title(Faction.MAFIA, self.lang))
        elif self.quiet_cycles >= QUIET_CYCLES_DRAW or self.day >= MAX_DAYS:
            winner, label = None, self.t("result.draw_long")
        else:
            return None

        # Тек тірі қалғандар жеңеді. Ерекшелік — өлімі арқылы жеңетін кейіпкерлер
        # (Өзін-өзі өлтіруші, Пиро): олардың жеке жеңісі сақталады.
        if winner is Faction.INDEPENDENT:
            winners = {p.user_id for p in alive if p.role is Role.MANIAC}
        elif winner is not None:
            # Камикадзенің мақсаты — тірі қалу емес: ол тек өзін құрбан етіп жеңеді.
            winners = {p.user_id for p in alive if p.faction is winner and p.role is not Role.KAMIKAZE}
        else:
            winners = set()
        winners |= {p.user_id for p in alive if p.role is Role.HIGGS}
        winners |= {p.user_id for p in self.players.values() if p.personal_win}
        winners -= {p.user_id for p in self.players.values() if p.deserted}
        self.result = GameResult(winner=winner, label=label, winners=frozenset(winners))
        self.phase = Phase.ENDED
        return self.result

    def final_text(self, minutes: int) -> str:
        """Ойын қорытындысы: жеңімпаздар, басқа ойыншылар және ойын ұзақтығы."""
        if self.result is None:
            raise RuntimeError("Ойын әлі аяқталған жоқ")
        winners = [p for p in self.ordered() if p.user_id in self.result.winners]
        others = [p for p in self.ordered() if p.user_id not in self.result.winners]
        lines = [self.t("final.title", label=self.result.label)]
        n = 0
        for header, group in (("final.winners", winners), ("final.losers", others)):
            if not group:
                continue
            lines += ["", self.t(header)]
            for p in group:
                n += 1
                lines.append(self.t("final.line", n=n, name=p.mention, role=self.reveal(p)))
        lines += ["", self.t("final.duration", minutes=minutes)]
        return "\n".join(lines)

    def _require_running(self) -> None:
        if self.phase is Phase.ENDED:
            raise RuntimeError("Ойын аяқталған")
