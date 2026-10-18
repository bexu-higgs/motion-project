"""Мафия ойынының қозғалтқышы.

Бұл модуль Telegram-ға тәуелсіз: ол тек ойын күйін сақтайды, әрекеттерді тексереді
және түнгі/күндізгі нәтижелерді есептейді. Хабарламаларды жіберу — контроллердің ісі.
"""

from __future__ import annotations

import html
import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import StrEnum

from . import balance
from .roles import (
    DEFENDER_COVER_ROLES,
    FACTION_TITLES,
    MAFIA_POWER_ROLES,
    MAFIA_TEAM_ROLES,
    Faction,
    Role,
    faction_of,
    info,
    title,
)

MAX_DAYS = 40          # шексіз ойынның алдын алу
QUIET_CYCLES_DRAW = 3  # қатарынан өлімсіз өткен күн+түн саны -> тең ойын


class Phase(StrEnum):
    LOBBY = "lobby"
    NIGHT = "night"
    DAY = "day"
    VOTE = "vote"
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
    SKIP = "sk"


ACTION_LABELS: dict[ActionKind, str] = {
    ActionKind.MAFIA_KILL: "🔫 Құрбанды таңдау",
    ActionKind.KILLER_KILL: "🔪 Өлтіру",
    ActionKind.MANIAC_KILL: "🪓 Өлтіру",
    ActionKind.CHECK: "🔍 Тексеру",
    ActionKind.SHOOT: "🔫 Ату",
    ActionKind.HEAL: "💉 Емдеу",
    ActionKind.BLOCK: "💻 Бұғаттау",
    ActionKind.PROTECT: "🛡 Қорғау",
    ActionKind.VISIT: "🍾 Үйіне бару",
    ActionKind.BOMB: "💣 Бомба қою",
    ActionKind.DETONATE: "💥 Жарып жіберу",
    ActionKind.SKIP: "⏭ Өткізу",
}

# Шабуыл көздері (түнгі есептеу реті бойынша).
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

CAUSE_TEXT = {
    SRC_MAFIA: "мафия өлтірді",
    SRC_KILLER: "Киллер өлтірді",
    SRC_MANIAC: "Қанішер өлтірді",
    SRC_COMMISSIONER: "Комиссар атып тастады",
    SRC_BOMB: "бомба жарылды",
    SRC_PYRO_SELF: "өз бомбасымен бірге жарылды",
    SRC_WITCH: "Сиқыршының қарғысына ұшырады",
    SRC_KAMIKAZE: "Камикадзе өзімен бірге ала кетті",
    SRC_LYNCH: "дарға асылды",
    SRC_DESERT: "ойыннан қашып кетті",
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

    @property
    def faction(self) -> Faction:
        return faction_of(self.role)

    @property
    def mention(self) -> str:
        return mention(self.user_id, self.name)

    @property
    def has_shield(self) -> bool:
        return self.shield_available and not self.shield_used

    @property
    def has_vote_shield(self) -> bool:
        return self.vote_shield_available and not self.vote_shield_used

    @property
    def has_bullet(self) -> bool:
        return self.bullet_available and not self.bullet_used

    def role_reveal(self) -> str:
        if self.role is not self.initial_role:
            return f"{title(self.role)} (бұрын {title(self.initial_role)})"
        return title(self.role)


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
    user_ids: list[int], requests: list[RoleRequest], rng: random.Random
) -> Assignment:
    """Рөлдерді кездейсоқ бөлу. Сатып алынған рөлдер (сатып алу ретімен) бірінші беріледі.

    Бір рөлдің даналары құрамда қанша болса, сонша ғана беріледі — рөлдер саны
    ойыншылар санынан ешқашан аспайды.
    """
    if len(set(user_ids)) != len(user_ids):
        raise ValueError("Ойыншылар қайталанбауы керек")
    pool = balance.composition(len(user_ids))
    roles: dict[int, Role] = {}
    fulfilled: list[RoleRequest] = []
    unfulfilled: list[RoleRequest] = []
    seen: set[int] = set()
    for req in requests:
        if req.user_id not in user_ids or req.user_id in seen:
            continue
        seen.add(req.user_id)
        if req.role is not Role.CIVILIAN and pool[req.role] > 0:
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
    roles.update(zip(rest_players, rest_roles, strict=False))
    return Assignment(roles=roles, fulfilled=fulfilled, unfulfilled=unfulfilled)


@dataclass(frozen=True)
class ActionOption:
    kind: ActionKind
    targets: tuple[int, ...] = ()

    @property
    def label(self) -> str:
        return ACTION_LABELS[self.kind]

    @property
    def needs_target(self) -> bool:
        return self.kind not in (ActionKind.DETONATE, ActionKind.SKIP)


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
    ) -> None:
        if not balance.MIN_PLAYERS <= len(players) <= balance.MAX_PLAYERS:
            raise ValueError("Ойыншылар саны 4–50 болуы керек")
        self.game_id = game_id
        self.chat_id = chat_id
        self.rng = rng or random.Random()
        self.players: dict[int, Player] = {p.user_id: p for p in players}
        self.phase = Phase.LOBBY
        self.day = 0
        self.actions: dict[int, NightAction] = {}
        self.votes: dict[int, int | None] = {}
        self.bombed: set[int] = set()
        self.defender_cover: int | None = None
        self.quiet_cycles = 0
        self._deaths_this_cycle = 0
        self._pending: _PendingNight | None = None
        self.result: GameResult | None = None
        defenders = [p for p in self.ordered() if p.role is Role.DEFENDER]
        if defenders:
            self.rng.choice(defenders).head_defender = True

    # --- Көмекші әдістер ------------------------------------------------------

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

    def alive_list_text(self) -> str:
        lines = [f"{i}. {p.mention}" for i, p in enumerate(self.alive(), 1)]
        return "\n".join(lines)

    def alive_roles_text(self) -> str:
        counts = Counter(p.role for p in self.alive())
        parts = []
        for role in Role:
            if counts[role]:
                suffix = f" ×{counts[role]}" if counts[role] > 1 else ""
                parts.append(f"{title(role)}{suffix}")
        return ", ".join(parts)

    # --- Ойын басы --------------------------------------------------------------

    def role_intro(self, user_id: int) -> str:
        p = self.players[user_id]
        ri = info(p.role)
        lines = [
            f"🎭 Сіздің рөліңіз: <b>{ri.title}</b>",
            f"Фракция: {FACTION_TITLES[ri.faction]}",
            "",
            ri.description,
        ]
        if p.role in MAFIA_TEAM_ROLES:
            mates = [f"• {q.mention} — {title(q.role)}" for q in self.team_of(user_id)]
            lines += ["", "🤝 Сіздің командаңыз:", *(mates or ["• (сіз жалғызсыз)"])]
            lines.append("✉️ Ботқа жазған хабарламаңыз командаңызға жіберіледі.")
        elif p.role is Role.DEFENDER:
            mates = [f"• {q.mention}" for q in self.team_of(user_id)]
            lines += ["", "🤝 Екінші қорғаушы:", *mates]
            lines.append(
                "👑 Сіз — бас қорғаушысыз, түнде нысананы сіз таңдайсыз."
                if p.head_defender
                else "Түнгі нысананы бас қорғаушы таңдайды, ол өлсе — сіз бас қорғаушы боласыз."
            )
        elif p.role in (Role.COMMISSIONER, Role.SERGEANT):
            mates = [f"• {q.mention} — {title(q.role)}" for q in self.team_of(user_id)]
            if mates:
                lines += ["", "🤝 Сіздің командаңыз:", *mates]
                lines.append("✉️ Ботқа жазған хабарламаңыз командаңызға жіберіледі.")
        items = []
        if p.shield_available:
            items.append("🛡 Қорғаныс (түнгі шабуылдан бір рет)")
        if p.vote_shield_available:
            items.append("⚖️ Дауыс беруден қорғаныс")
        if p.bullet_available:
            items.append("💥 Қорғанысты тесетін оқ")
        if p.fake_doc:
            items.append("📄 Жалған құжат (Комиссардың бірінші тексеруі)")
        if items:
            lines += ["", "🎒 Осы ойындағы заттарыңыз:", *(f"• {i}" for i in items)]
        return "\n".join(lines)

    # --- Түн --------------------------------------------------------------------

    def start_night(self) -> str:
        self._require_running()
        if self.phase is Phase.NIGHT:
            raise RuntimeError("Түн басталып қойған")
        self.day += 1
        self.phase = Phase.NIGHT
        self.actions = {}
        self.defender_cover = None
        return (
            f"🌙 <b>{self.day}-түн</b>\n"
            "Қала ұйықтайды... Арнайы рөлдер ботпен жеке чатта әрекет жасайды.\n\n"
            f"👥 Тірі ойыншылар ({len(self.alive())}):\n{self.alive_list_text()}\n\n"
            f"🎭 Ойындағы рөлдер: {self.alive_roles_text()}"
        )

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

    def night_prompt(self, user_id: int) -> str:
        p = self.players[user_id]
        role = p.role
        head = f"🌙 <b>{self.day}-түн.</b> Сіз — {title(role)}.\n"
        if role in (Role.DON, Role.MAFIA):
            extra = (
                "Мафияның бүгінгі құрбанын таңдаңыз. Соңғы шешім — сіздікі."
                if role is Role.DON
                else "Құрбанға дауыс беріңіз. Дон таңдау жасамаса, мафия дауысы шешеді."
            )
        elif role is Role.KILLER:
            extra = "Бүгін кімді өлтіресіз?"
        elif role is Role.MANIAC:
            extra = "Бүгінгі құрбаныңызды таңдаңыз."
        elif role is Role.COMMISSIONER:
            extra = (
                "Бүгін біреуді тексересіз бе, әлде атасыз ба?"
                if self.day > 1
                else "Бірінші түні тек тексеруге болады. Кімді тексересіз?"
            )
        elif role is Role.DOCTOR:
            extra = "Бүгін кімді емдейсіз?"
        elif role is Role.HACKER:
            extra = "Кімнің телефонын бұзасыз? Оның бүгінгі әрекеті орындалмайды."
        elif role is Role.DEFENDER:
            extra = "Бүгін кімді қорғайсыз?"
        elif role is Role.BEGGAR:
            extra = "Бүгін кімнің үйіне барасыз?"
        elif role is Role.PYRO:
            bombed = [self._name(b) for b in self._alive_bombed(exclude=user_id)]
            extra = "Кімнің үйіне бомба қоясыз?"
            if bombed:
                extra += "\n💣 Бомба қойылғандар: " + ", ".join(bombed)
            if len(bombed) >= 3:
                extra += "\n💥 Енді бәрін жарып жіберуге болады (өзіңіз де өлесіз)."
        else:
            extra = "Бүгін түнде сізде әрекет жоқ."
        return head + extra

    def submit_action(
        self, user_id: int, kind: ActionKind, target: int | None = None
    ) -> SubmitResult:
        if self.phase is not Phase.NIGHT:
            return SubmitResult(False, "Қазір түн емес.")
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return SubmitResult(False, "Сіз бұл ойында тірі ойыншы емессіз.")
        if user_id in self.actions:
            return SubmitResult(False, "Сіз бұл түні таңдау жасап қойдыңыз.")
        option = next((o for o in self.night_options(user_id) if o.kind is kind), None)
        if option is None:
            return SubmitResult(False, "Бұл әрекет сізге қолжетімді емес.")
        if option.needs_target:
            if target not in option.targets:
                return SubmitResult(False, "Бұл ойыншыны таңдауға болмайды.")
        else:
            target = None
        self.actions[user_id] = NightAction(kind, target)
        if kind is ActionKind.SKIP:
            return SubmitResult(True, "⏭ Сіз бұл түні әрекет жасамайсыз.")
        if kind is ActionKind.DETONATE:
            return SubmitResult(True, "💥 Таңертең бомбалар жарылады...")
        return SubmitResult(True, f"✅ Таңдауыңыз: {ACTION_LABELS[kind]} → {self._name(target)}")

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
        if blocked:
            public.append("💻 Хакер біреудің телефонын бұзды.")
            for uid in blocked:
                if uid in acts and acts[uid].kind is not ActionKind.SKIP:
                    private.append(
                        (uid, "💻 Түнде хакер телефоныңызды бұзды — әрекетіңіз орындалмады.")
                    )

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
        if healed:
            public.append("👨‍⚕️ Дәрігер түнде біреуге барды.")

        attacks: list[Attack] = []
        # 5. Дон мен мафияның ортақ шабуылы.
        target, attacker = self._mafia_decision(effective)
        if target is not None and attacker is not None:
            atk_player = self.players[attacker]
            attacks.append(
                Attack(
                    SRC_MAFIA,
                    attacker,
                    target,
                    pierce=atk_player.role is Role.DON and atk_player.has_bullet,
                )
            )
            visit(target, attacker)
            public.append("🤵 Мафия түнде аң аулауға шықты.")
        # 6. Киллер, 7. Қанішер.
        for kind, src, line in (
            (ActionKind.KILLER_KILL, SRC_KILLER, "🔪 Киллер біреуді нысанаға алды."),
            (ActionKind.MANIAC_KILL, SRC_MANIAC, "🪓 Қанішер көшеге шықты."),
        ):
            for uid, a in effective.items():
                if a.kind is kind:
                    attacks.append(Attack(src, uid, a.target, pierce=self.players[uid].has_bullet))
                    visit(a.target, uid)
                    public.append(line)
        # 8. Комиссар: тексеру немесе оқ ату.
        for uid, a in effective.items():
            if a.kind is ActionKind.CHECK:
                visit(a.target, uid)
                result = self._check_result(a.target)
                text = f"🔍 Тексеру нәтижесі: {self._name(a.target)} — <b>{result}</b>"
                private.append((uid, text))
                for sergeant in self.with_role(Role.SERGEANT):
                    private.append((sergeant.user_id, f"👮 Комиссардан хабар:\n{text}"))
                public.append("🕵️ Комиссар біреуді тексерді.")
            elif a.kind is ActionKind.SHOOT:
                attacks.append(
                    Attack(SRC_COMMISSIONER, uid, a.target, pierce=self.players[uid].has_bullet)
                )
                visit(a.target, uid)
                public.append("🕵️ Комиссар тапаншасын оқтады.")
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
                private.append((uid, f"💣 {self._name(a.target)} үйіне бомба қойылды."))
            elif a.kind is ActionKind.DETONATE:
                explosion = (uid, sorted(b for b in self._alive_bombed(exclude=uid)))

        # Шабуылдардың нәтижесі.
        deaths: dict[int, str] = {}
        lethal_by: dict[int, list[Attack]] = defaultdict(list)
        witch_attackers: dict[int, list[int]] = defaultdict(list)
        wolf_hits: dict[int, str] = {}
        saved = False
        for atk in attacks:
            t = self.players[atk.target]
            if t.role is Role.WITCH and not t.witch_magic_used:
                if atk.attacker not in witch_attackers[t.user_id]:
                    witch_attackers[t.user_id].append(atk.attacker)
                continue
            if t.role is Role.WOLF and atk.source in (SRC_MAFIA, SRC_KILLER, SRC_COMMISSIONER):
                wolf_hits.setdefault(t.user_id, atk.source)
                continue
            if t.user_id in healed:
                saved = True
                continue
            if t.has_shield:
                shooter = self.players[atk.attacker]
                t.shield_used = True
                if atk.pierce and shooter.has_bullet:
                    shooter.bullet_used = True
                    private.append(
                        (shooter.user_id, "💥 Оғыңыз нысананың қорғанысын тесіп өтті!")
                    )
                else:
                    private.append(
                        (t.user_id, "🛡 Түнде сізге шабуыл жасалды, бірақ қорғанысыңыз сақтап қалды!")
                    )
                    continue
            lethal_by[t.user_id].append(atk)
            deaths.setdefault(t.user_id, atk.source)

        if explosion is not None:
            pyro_id, targets = explosion
            public.append("🔥 Түнде қаланы қатты жарылыс шайқады!")
            deaths[pyro_id] = SRC_PYRO_SELF
            for b in targets:
                if b in healed:
                    saved = True
                    continue
                deaths.setdefault(b, SRC_BOMB)
        if saved:
            public.append("💉 Дәрігер біреудің өмірін сақтап қалды!")

        witch_prompt: WitchPrompt | None = None
        for witch_id, attackers in witch_attackers.items():
            witch = self.players[witch_id]
            witch.witch_magic_used = True
            if witch_id in deaths:  # Пиро бомбасы — сиқыр күшсіз
                continue
            witch_prompt = WitchPrompt(witch_id, attackers)
            public.append("🧙‍♀️ Біреудің үйінде сиқырлы жарқыл көрінді...")

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
        )
        return witch_prompt

    def witch_prompt_text(self, prompt: WitchPrompt) -> str:
        names = ", ".join(self._name(a) for a in prompt.attackers)
        return (
            f"🧙‍♀️ Түнде сізге {names} шабуыл жасады! Сиқырыңыз сізді сақтап қалды.\n"
            "Шабуылдаушыны не істейсіз?"
        )

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
                private.append((w.witch_id, "⚔️ Сіз шабуылдаушыны қарғыспен жазаладыңыз."))
            else:
                private.append((w.witch_id, "🕊 Сіз шабуылдаушыны кешірдіңіз."))

        # 12. Камикадзенің арнайы өлім әсері (Дәрігер мен қорғаныстан басым).
        for target_id, atks in pending.lethal_by.items():
            if self.players[target_id].role is Role.KAMIKAZE and target_id in deaths:
                for atk in atks:
                    if atk.attacker != target_id:
                        deaths.setdefault(atk.attacker, SRC_KAMIKAZE)
                public.append("💣 Камикадзе өлтірушісін өзімен бірге ала кетті!")

        # 13. Қасқырлардың фракция ауысуы.
        for wolf_id, source in pending.wolf_hits.items():
            if wolf_id in deaths:
                continue
            private.extend(self._convert_wolf(wolf_id, source))

        # 14. Өлімдерді бекіту.
        dead_order = [p.user_id for p in self.ordered() if p.user_id in deaths]
        for uid in dead_order:
            self._kill(uid, deaths[uid])
            private.append((uid, f"☠️ Сіз қаза таптыңыз ({CAUSE_TEXT[deaths[uid]]})."))

        if pending.explosion is not None:
            pyro_id, targets = pending.explosion
            pyro = self.players[pyro_id]
            if len(targets) >= 3 and all(not self.players[t].alive for t in targets):
                pyro.personal_win = True
                public.append("🔥 Пиро барлық нысанасын жарып жіберді — Пиро жеңді!")
            else:
                public.append("🔥 Пиро нысаналарының бәрін жоя алмады.")
            self.bombed.clear()

        # Қайыршыға ақпарат.
        for uid, a in pending.effective.items():
            if a.kind is ActionKind.VISIT:
                guests = [v for v in pending.visits.get(a.target, []) if v != uid]
                names = ", ".join(self._name(v) for v in guests) if guests else "ешкім келмеді"
                private.append(
                    (uid, f"🍾 Түнде {self._name(a.target)} үйіне келгендер: {names}.")
                )

        private.extend(self._promotions())
        self._pending = None
        if self.result is None:
            self.phase = Phase.DAY

        lines = [f"🌅 <b>{self.day}-күн. Таң атты!</b>", ""]
        if public:
            lines += ["🌙 Түнде не болды:", *public, ""]
        if dead_order:
            lines.append("☠️ Түнде қаза тапқандар:")
            for uid in dead_order:
                p = self.players[uid]
                lines.append(f"• {p.mention} — {p.role_reveal()} ({CAUSE_TEXT[p.death_cause]})")
        else:
            lines.append("😮 Бүгін түнде ешкім қаза таппады.")
        lines += ["", f"👥 Тірі ойыншылар ({len(self.alive())}):", self.alive_list_text()]
        return Report(public="\n".join(lines), private=private, deaths=dead_order)

    def _mafia_decision(self, effective: dict[int, NightAction]) -> tuple[int | None, int | None]:
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
        attacker = next(uid for uid, t in votes if t == target)
        return target, attacker

    def _check_result(self, target_id: int) -> str:
        t = self.players[target_id]
        if self.defender_cover == target_id:
            return title(Role.CIVILIAN)
        if t.fake_doc:
            t.fake_doc = False
            return title(Role.CIVILIAN)
        return title(t.role)

    def _convert_wolf(self, wolf_id: int, source: str) -> list[tuple[int, str]]:
        wolf = self.players[wolf_id]
        notes: list[tuple[int, str]] = []
        if source in (SRC_MAFIA, SRC_KILLER):
            wolf.role = Role.MAFIA
            mates = [q for q in self.mafia_team() if q.user_id != wolf_id]
            lines = ", ".join(f"{q.mention} ({title(q.role)})" for q in mates) or "—"
            notes.append(
                (wolf_id, f"🐺 Мафия сізге шабуыл жасады, бірақ сіз өлмедіңіз — енді сіз "
                          f"{title(Role.MAFIA)} боласыз!\n🤝 Командаңыз: {lines}")
            )
            for q in mates:
                notes.append((q.user_id, f"🐺 {wolf.mention} мафияға қосылды!"))
        else:
            wolf.role = Role.SERGEANT
            mates = self.with_role(Role.COMMISSIONER, Role.SERGEANT)
            mates = [q for q in mates if q.user_id != wolf_id]
            lines = ", ".join(f"{q.mention} ({title(q.role)})" for q in mates) or "—"
            notes.append(
                (wolf_id, f"🐺 Комиссар сізді атты, бірақ сіз өлмедіңіз — енді сіз "
                          f"{title(Role.SERGEANT)} боласыз!\n🤝 Командаңыз: {lines}")
            )
            for q in mates:
                notes.append((q.user_id, f"🐺 {wolf.mention} сержант болып қосылды!"))
        return notes

    def _promotions(self) -> list[tuple[int, str]]:
        notes: list[tuple[int, str]] = []
        if not self.with_role(Role.DON):
            heirs = self.with_role(Role.MAFIA)
            if heirs:
                new_don = heirs[0]
                new_don.role = Role.DON
                notes.append((new_don.user_id, "🤵 Дон қаза тапты. Енді сіз — жаңа Донсыз!"))
                for q in self.mafia_team():
                    if q.user_id != new_don.user_id:
                        notes.append((q.user_id, f"🤵 Жаңа Дон: {new_don.mention}"))
        if not self.with_role(Role.COMMISSIONER):
            heirs = self.with_role(Role.SERGEANT)
            if heirs:
                new_com = heirs[0]
                new_com.role = Role.COMMISSIONER
                notes.append(
                    (new_com.user_id, "🕵️ Комиссар қаза тапты. Енді сіз — жаңа Комиссарсыз!")
                )
                for q in self.with_role(Role.SERGEANT):
                    notes.append((q.user_id, f"🕵️ Жаңа Комиссар: {new_com.mention}"))
        defenders = self.with_role(Role.DEFENDER)
        if defenders and not any(d.head_defender for d in defenders):
            defenders[0].head_defender = True
            notes.append(
                (defenders[0].user_id,
                 "👑 Бас қорғаушы қаза тапты. Келесі түннен бастап нысананы сіз таңдайсыз.")
            )
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

    def start_vote(self) -> str:
        if self.phase is not Phase.DAY:
            raise RuntimeError("Дауыс беру тек күндіз басталады")
        self.phase = Phase.VOTE
        self.votes = {}
        return (
            "🗳 <b>Дауыс беру басталды!</b>\n"
            "Ботпен жеке чатта кімді дарға асу керек екенін таңдаңыз."
        )

    def vote_candidates(self, user_id: int) -> list[int]:
        p = self.players.get(user_id)
        if self.phase is not Phase.VOTE or p is None or not p.alive:
            return []
        return [q.user_id for q in self.alive() if q.user_id != user_id]

    def submit_vote(self, user_id: int, target: int | None) -> SubmitResult:
        if self.phase is not Phase.VOTE:
            return SubmitResult(False, "Қазір дауыс беру жүріп жатқан жоқ.")
        p = self.players.get(user_id)
        if p is None or not p.alive:
            return SubmitResult(False, "Тек тірі ойыншылар дауыс бере алады.")
        if user_id in self.votes:
            return SubmitResult(False, "Сіз дауыс беріп қойдыңыз.")
        if target is not None and target not in self.vote_candidates(user_id):
            return SubmitResult(False, "Бұл ойыншыға дауыс беруге болмайды.")
        self.votes[user_id] = target
        if target is None:
            return SubmitResult(True, "🤐 Сіз қалыс қалдыңыз.")
        return SubmitResult(True, f"✅ Сіз {self._name(target)} үшін дауыс бердіңіз.")

    def vote_complete(self) -> bool:
        return self.alive_ids() <= set(self.votes)

    def resolve_vote(self) -> Report:
        if self.phase is not Phase.VOTE:
            raise RuntimeError("Дауыс беру жүріп жатқан жоқ")
        alive = self.alive_ids()
        votes = {v: t for v, t in self.votes.items() if v in alive and (t is None or t in alive)}
        tally = Counter(t for t in votes.values() if t is not None)
        lines = ["🗳 <b>Дауыс беру нәтижесі</b>", ""]
        if tally:
            for target, count in tally.most_common():
                voters = ", ".join(self._name(v) for v, t in votes.items() if t == target)
                lines.append(f"• {self._name(target)} — {count} дауыс ({voters})")
        abstained = [p for p in self.alive() if votes.get(p.user_id, -1) is None]
        silent = [p for p in self.alive() if p.user_id not in votes]
        if abstained:
            lines.append("🤐 Қалыс қалғандар: " + ", ".join(p.mention for p in abstained))
        if silent:
            lines.append("😴 Дауыс бермегендер: " + ", ".join(p.mention for p in silent))
        lines.append("")
        private: list[tuple[int, str]] = []
        deaths: list[int] = []
        top = tally.most_common(2)
        if not top:
            lines.append("Ешкім дауыс бермеді — бүгін ешкім дарға асылмайды.")
        elif len(top) > 1 and top[0][1] == top[1][1]:
            lines.append("⚖️ Дауыстар тең түсті — бүгін ешкім дарға асылмайды.")
        else:
            target = self.players[top[0][0]]
            if self.defender_cover == target.user_id and target.role in DEFENDER_COVER_ROLES:
                lines.append(f"🪢 {target.mention} дарға асылмақ болды, бірақ аман қалды!")
            elif target.role is Role.SUICIDE:
                self._kill(target.user_id, SRC_LYNCH)
                target.personal_win = True
                deaths.append(target.user_id)
                lines.append(
                    f"🪢 {target.mention} дарға асылды. Ол — {target.role_reveal()} еді. "
                    "🤡 Өзін-өзі өлтіруші өз мақсатына жетіп, жеңді!"
                )
            elif target.has_vote_shield:
                target.vote_shield_used = True
                private.append(
                    (target.user_id, "⚖️ Дауыс беруден қорғанысыңыз сізді дардан құтқарды!")
                )
                lines.append(f"🪢 {target.mention} дарға асылмақ болды, бірақ аман қалды!")
            else:
                self._kill(target.user_id, SRC_LYNCH)
                deaths.append(target.user_id)
                lines.append(
                    f"🪢 {target.mention} дарға асылды. Ол — <b>{target.role_reveal()}</b> еді."
                )
                private.append((target.user_id, "☠️ Сізді қала дарға асты."))
        private.extend(self._promotions())
        if self.result is None:
            self.phase = Phase.DAY
        self.defender_cover = None
        return Report(public="\n".join(lines), private=private, deaths=deaths)

    def day_text(self) -> str:
        return (
            f"☀️ <b>{self.day}-күн.</b> Талқылау уақыты!\n"
            "Күдіктілерді талқылаңыз — жақында дауыс беру басталады."
        )

    # --- Ойыннан шығу ------------------------------------------------------------------

    def desert(self, user_id: int) -> Report | None:
        p = self.players.get(user_id)
        if p is None or not p.alive or self.phase in (Phase.LOBBY, Phase.ENDED):
            return None
        p.deserted = True
        self.actions.pop(user_id, None)
        self.votes.pop(user_id, None)
        self._kill(user_id, SRC_DESERT)
        notes = self._promotions()
        return Report(
            public=f"🏃 {p.mention} ойыннан қашып кетті. Ол — <b>{p.role_reveal()}</b> еді.",
            private=notes,
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
            winner, label = None, "🤝 Ешкім тірі қалмады — тең ойын"
        elif maniac_alive and len(alive) <= 2:
            winner, label = Faction.INDEPENDENT, f"{title(Role.MANIAC)} жеңді"
        elif power == 0 and not maniac_alive:
            winner, label = Faction.TOWN, f"{FACTION_TITLES[Faction.TOWN]} жеңді"
        elif power > 0 and not maniac_alive and power >= others:
            winner, label = Faction.MAFIA, f"{FACTION_TITLES[Faction.MAFIA]} жеңді"
        elif self.quiet_cycles >= QUIET_CYCLES_DRAW or self.day >= MAX_DAYS:
            winner, label = None, "🤝 Ойын тым ұзаққа созылды — тең ойын"
        else:
            return None

        if winner is Faction.INDEPENDENT:
            winners = {p.user_id for p in alive if p.role is Role.MANIAC}
        elif winner is not None:
            winners = {p.user_id for p in self.players.values() if p.faction is winner}
        else:
            winners = set()
        winners |= {p.user_id for p in self.players.values() if p.personal_win}
        winners -= {p.user_id for p in self.players.values() if p.deserted}
        self.result = GameResult(winner=winner, label=label, winners=frozenset(winners))
        self.phase = Phase.ENDED
        return self.result

    def final_text(self, rewards: dict[int, int]) -> str:
        if self.result is None:
            raise RuntimeError("Ойын әлі аяқталған жоқ")
        lines = [f"🏁 <b>Ойын аяқталды!</b> {self.result.label}", ""]
        winners = [p for p in self.ordered() if p.user_id in self.result.winners]
        losers = [p for p in self.ordered() if p.user_id not in self.result.winners]
        if winners:
            lines.append("🏆 Жеңімпаздар:")
            for p in winners:
                reward = rewards.get(p.user_id, 0)
                bonus = f" +{reward} ₸" if reward else ""
                lines.append(f"• {p.mention} — {p.role_reveal()}{bonus}")
            lines.append("")
        if losers:
            lines.append("💀 Қалғандары:")
            for p in losers:
                status = "тірі" if p.alive else "қаза тапты"
                lines.append(f"• {p.mention} — {p.role_reveal()} ({status})")
        lines += ["", f"📅 Ойын {self.day} күнге созылды."]
        return "\n".join(lines)

    def _require_running(self) -> None:
        if self.phase is Phase.ENDED:
            raise RuntimeError("Ойын аяқталған")
