"""Рөлдер, фракциялар және олардың сипаттамасы."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Faction(StrEnum):
    TOWN = "town"            # Бейбіт тұрғындар
    MAFIA = "mafia"          # Мафия фракциясы (Дон, мафия, Киллер, Қорғаушылар)
    INDEPENDENT = "solo"     # Жеке жеңіс шарты бар кейіпкерлер


class Role(StrEnum):
    CIVILIAN = "civilian"
    DON = "don"
    MAFIA = "mafia"
    KILLER = "killer"
    DEFENDER = "defender"
    COMMISSIONER = "commissioner"
    SERGEANT = "sergeant"
    DOCTOR = "doctor"
    HACKER = "hacker"
    BEGGAR = "beggar"
    KAMIKAZE = "kamikaze"
    SUICIDE = "suicide"
    WITCH = "witch"
    PYRO = "pyro"
    WOLF = "wolf"
    MANIAC = "maniac"


@dataclass(frozen=True)
class RoleInfo:
    role: Role
    emoji: str
    name: str
    faction: Faction
    description: str

    @property
    def title(self) -> str:
        return f"{self.emoji} {self.name}"


ROLE_INFO: dict[Role, RoleInfo] = {
    Role.CIVILIAN: RoleInfo(
        Role.CIVILIAN, "👨", "Тұрғын", Faction.TOWN,
        "Түнде әрекетіңіз жоқ. Күндіз талқылап, мафияны тауып, дұрыс адамға дауыс беріңіз.",
    ),
    Role.DON: RoleInfo(
        Role.DON, "🤵", "Дон", Faction.MAFIA,
        "Мафияның басшысы. Түнде мафияның ортақ шабуылының нысанасын сіз анықтайсыз. "
        "Мафия мүшелері сізге дауыстарымен көмектеседі, бірақ соңғы шешім — сіздікі.",
    ),
    Role.MAFIA: RoleInfo(
        Role.MAFIA, "🕴", "Мафия", Faction.MAFIA,
        "Түнде Донмен бірге құрбанды таңдайсыз. Дон тірі болмаса немесе таңдау жасамаса, "
        "мафия мүшелерінің дауысы шешеді. Дон өлсе, мафия мүшелерінің бірі жаңа Дон болады.",
    ),
    Role.KILLER: RoleInfo(
        Role.KILLER, "🔪", "Киллер", Faction.MAFIA,
        "Мафияның жалдамалы өлтірушісі. Мафияны танисыз және әр түнде мафиядан бөлек "
        "бір ойыншыны өз бетіңізше өлтіре аласыз.",
    ),
    Role.DEFENDER: RoleInfo(
        Role.DEFENDER, "🛡", "Қорғаушы", Faction.MAFIA,
        "Мафия жағындасыз, бірақ мафия мүшелерін танымайсыз. Екі қорғаушы бір команда: "
        "түнде бас қорғаушы бір ойыншыны қорғайды. Ол Дон не мафия болса, Комиссар сол түні "
        "оны «Тұрғын» деп көреді, ал келесі күні дарға асылса — аман қалады.",
    ),
    Role.COMMISSIONER: RoleInfo(
        Role.COMMISSIONER, "🕵️", "Комиссар", Faction.TOWN,
        "Әр түнде бір ойыншыны тексересіз (рөлін білесіз) немесе атасыз. "
        "Бірінші түні тек тексеруге болады. Сержанттар тексеру нәтижелерін біледі.",
    ),
    Role.SERGEANT: RoleInfo(
        Role.SERGEANT, "👮", "Сержант", Faction.TOWN,
        "Комиссардың көмекшісі. Комиссарды танисыз, оның тексеру нәтижелерін аласыз. "
        "Комиссар өлсе, оның орнына сіз Комиссар боласыз.",
    ),
    Role.DOCTOR: RoleInfo(
        Role.DOCTOR, "👨‍⚕️", "Дәрігер", Faction.TOWN,
        "Әр түнде бір ойыншыны емдейсіз — ол сол түні шабуылдан өлмейді. "
        "Бір адамды қатарынан екі түн емдеуге болмайды, өзіңізді ойында бір рет қана емдей аласыз.",
    ),
    Role.HACKER: RoleInfo(
        Role.HACKER, "💻", "Хакер", Faction.TOWN,
        "Түнде бір ойыншының телефонын бұзасыз — оның сол түнгі әрекеті орындалмайды. "
        "Бір адамды қатарынан екі түн бұғаттауға болмайды.",
    ),
    Role.BEGGAR: RoleInfo(
        Role.BEGGAR, "🍾", "Қайыршы", Faction.TOWN,
        "Түнде бір ойыншының үйіне барып, бөтелке сұрайсыз. Таңертең сол үйге "
        "түнде кімдер келгенін білесіз.",
    ),
    Role.KAMIKAZE: RoleInfo(
        Role.KAMIKAZE, "💣", "Камикадзе", Faction.TOWN,
        "Бейбіт тұрғынсыз. Сізді түнде біреу өлтірсе, өлтірушіні өзіңізбен бірге ала кетесіз "
        "(бұл әсерді Дәрігер де, қорғаныс та тоқтата алмайды). Пиро бомбасына қарсы жұмыс істемейді.",
    ),
    Role.SUICIDE: RoleInfo(
        Role.SUICIDE, "🤡", "Өзін-өзі өлтіруші", Faction.INDEPENDENT,
        "Жеке жеңіс шартыңыз бар: күндізгі дауыс беруде дарға асылсаңыз — жеңесіз.",
    ),
    Role.WITCH: RoleInfo(
        Role.WITCH, "🧙‍♀️", "Сиқыршы", Faction.TOWN,
        "Бейбіт тұрғындар жағындасыз. Сізге түнде алғаш рет шабуыл жасалғанда сиқырыңыз "
        "сізді сақтайды, ал сіз шабуылдаушыны жазалауды не кешіруді таңдайсыз. "
        "Сиқыр ойында бір рет жұмыс істейді және Пиро бомбасына қарсы күшсіз.",
    ),
    Role.PYRO: RoleInfo(
        Role.PYRO, "🔥", "Пиро (Бомбалаушы)", Faction.INDEPENDENT,
        "Әр түнде бір ойыншының үйіне бомба қоясыз. Кемінде үш тірі адамда бомба болғанда "
        "оларды жарып жібере аласыз (өзіңіз де өлесіз). Бомбаланғандардың бәрі сол түні өлсе — жеңесіз.",
    ),
    Role.WOLF: RoleInfo(
        Role.WOLF, "🐺", "Қасқыр", Faction.TOWN,
        "Бейбіт тұрғын болып бастайсыз. Сізге мафия (не Киллер) шабуыл жасаса — өлмей, мафияға "
        "қосыласыз. Комиссар атса — өлмей, Сержант боласыз. Басқа шабуылдан әдеттегідей өлесіз.",
    ),
    Role.MANIAC: RoleInfo(
        Role.MANIAC, "🪓", "Қанішер", Faction.INDEPENDENT,
        "Ешкімнің жағында емессіз. Әр түнде бір ойыншыны өлтіресіз. "
        "Тірі ойыншылардың соңғы екеуінің бірі болсаңыз — жеңесіз.",
    ),
}

# Мафияның «қарулы» мүшелері — жеңіс теңдігін есептегенде есепке алынады.
MAFIA_POWER_ROLES = frozenset({Role.DON, Role.MAFIA, Role.KILLER})
# Бір-бірін танитын мафия мүшелері.
MAFIA_TEAM_ROLES = MAFIA_POWER_ROLES
# Жалған құжатты қолдана алатын рөлдер.
FAKE_DOC_ROLES = frozenset({Role.DON, Role.MAFIA, Role.PYRO, Role.MANIAC})
# Қорғаушылардың жасыру әсері жұмыс істейтін рөлдер.
DEFENDER_COVER_ROLES = frozenset({Role.DON, Role.MAFIA})
# Сатып алуға болатын рөлдер (қарапайым тұрғыннан басқасы).
PURCHASABLE_ROLES = tuple(r for r in Role if r is not Role.CIVILIAN)


def info(role: Role) -> RoleInfo:
    return ROLE_INFO[role]


def title(role: Role) -> str:
    return ROLE_INFO[role].title


def faction_of(role: Role) -> Faction:
    return ROLE_INFO[role].faction


FACTION_TITLES = {
    Faction.TOWN: "🏘 Бейбіт тұрғындар",
    Faction.MAFIA: "🤵 Мафия",
    Faction.INDEPENDENT: "🎭 Тәуелсіз кейіпкерлер",
}
