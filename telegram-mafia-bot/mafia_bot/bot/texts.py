"""Боттың қазақ тіліндегі мәтіндері."""

from __future__ import annotations

import html

from ..economy import (
    DAILY_REWARDS,
    DIAMOND_PACKAGES,
    REWARD_POINTS,
    ROLE_PICK_PRICE,
    SHOP,
    Item,
    format_kzt,
)
from ..game import balance
from ..game.roles import FACTION_TITLES, ROLE_INFO, Faction, Role, title

# --- Басты мәзір батырмалары ---------------------------------------------------------------

BTN_JOIN = "🎮 Ойынға қосылу"
BTN_ROOM = "🏠 Ойын бөлмесін ашу"
BTN_PROFILE = "👤 Менің профилім"
BTN_SHOP = "🛍 Дүкен"
BTN_DIAMONDS = "💎 Алмаз сатып алу"
BTN_ROLE = "🎭 Рөл таңдау"
BTN_RULES = "📜 Ережелер"
BTN_RATING = "🏆 Рейтинг"
BTN_DAILY = "🎁 Күнделікті сыйлық"
BTN_HELP = "❓ Көмек"

MENU_ROWS = (
    (BTN_JOIN, BTN_ROOM),
    (BTN_PROFILE, BTN_SHOP),
    (BTN_DIAMONDS, BTN_ROLE),
    (BTN_RULES, BTN_RATING),
    (BTN_DAILY, BTN_HELP),
)

WELCOME = (
    "🎭 <b>Мафия ботына қош келдіңіз!</b>\n\n"
    "Мен топтық чатта 4–50 адамға арналған Мафия ойынын жүргіземін:\n"
    "• рөлдерді кездейсоқ таратамын және әр ойыншыға тек жеке чатта айтамын;\n"
    "• түнгі әрекеттер мен дауыс беру — осы жеке чатта;\n"
    "• нәтижелер таң атқанда ортақ чатта жарияланады.\n\n"
    "Бастау үшін мені топқа қосып, әкімші етіңіз де, топта /game жазыңыз.\n"
    "Төмендегі мәзірді пайдаланыңыз 👇"
)

HELP = (
    "❓ <b>Көмек</b>\n\n"
    "<b>Топта:</b>\n"
    "/game — жаңа ойынға тіркелуді ашу\n"
    "/startgame — тіркелуді аяқтап, ойынды бірден бастау (ашқан адам не әкімші)\n"
    "/extend — тіркелуді 30 секундқа ұзарту\n"
    "/leave — тіркелуден не ойыннан шығу\n"
    "/stop — ойынды тоқтату (тек әкімшілер)\n\n"
    "<b>Жеке чатта:</b>\n"
    "/profile — профиль, /shop — дүкен, /daily — күнделікті сыйлық,\n"
    "/rating — рейтинг, /rules — ережелер, /paysupport — төлем бойынша көмек\n\n"
    "<b>Ойын барысы:</b>\n"
    "1. Топта /game жазылады, ойыншылар «🎮 Ойынға қосылу» батырмасын басады.\n"
    "2. Кемінде 4 ойыншы жиналса, ойын басталады (ең көбі 50).\n"
    "3. Рөліңіз осы жеке чатқа келеді — оны ешкімге көрсетпеңіз!\n"
    "4. Түнде рөліңізге сай әрекетті осында таңдайсыз.\n"
    "5. Күндіз топта талқылайсыз, ал дауысты осы чатта бересіз.\n\n"
    "Мафия, Қорғаушылар және Комиссар командасы бір-біріне осы чат арқылы жаза алады: "
    "ойын кезінде ботқа жазған хабарламаңыз серіктестеріңізге жіберіледі."
)

NEED_ADMIN = (
    "⚠️ Ойынды жүргізу үшін маған әкімші құқықтары керек:\n"
    "• 🗑 хабарламаларды өшіру;\n"
    "• 🚫 қатысушыларды шектеу (өлген ойыншылардың жазуын шектеу үшін);\n"
    "• 📌 хабарламаларды бекіту (міндетті емес).\n\n"
    "Топ баптауларынан мені әкімші етіп тағайындаңыз, содан кейін /game жазыңыз."
)

BOT_ADDED = (
    "👋 Сәлем! Мен — Мафия ойынының жүргізушісімін.\n\n" + NEED_ADMIN
)

BOT_PROMOTED = (
    "✅ Рахмет! Әкімші құқықтары берілді.\n"
    "Ойынға тіркелуді ашу үшін /game жазыңыз. Әр ойыншы ботпен жеке чатты бастауы керек."
)

PAY_SUPPORT = (
    "💳 <b>Төлем бойынша көмек</b>\n\n"
    "Алмаздар Telegram Stars (⭐) арқылы сатылады, төлем Telegram-ның өзінде өтеді.\n"
    "Төлем расталғаннан кейін алмаз балансыңызға бірден қосылады; бір төлем үшін алмаз тек бір рет беріледі.\n"
    "Мәселе туындаса, бот әкімшісіне төлем чегін (Telegram-дағы төлем хабарламасы) жіберіңіз."
)

TERMS = (
    "📄 <b>Шарттар</b>\n\n"
    "• ₸ — ойын ішіндегі тегін валюта, ол нақты ақша емес және айырбасталмайды.\n"
    "• 💎 алмаз — Telegram Stars арқылы сатып алынатын цифрлық ойын тауары.\n"
    "• Сатып алынған алмаздар мен заттар тек осы бот ішінде қолданылады.\n"
    "• Алмазға сатылатын артықшылықтар ойын ережелеріне сай шектеулі "
    "(бір ойында бір қорғаныс, бір оқ және т.б.).\n"
    "• Ереже бұзылғанда немесе алаяқтық анықталғанда әкімші тіркелгіні шектей алады."
)


def menu_hint() -> str:
    return "Мәзірден қажетті бөлімді таңдаңыз 👇"


# --- Ережелер ----------------------------------------------------------------------------------

RULE_PAGES = {
    "general": "📖 Жалпы",
    "roles": "🎭 Рөлдер",
    "night": "🌙 Түн реті",
    "items": "🎒 Заттар",
    "balance": "⚖️ Баланс",
}


def rules_page(page: str) -> str:
    if page == "roles":
        lines = ["🎭 <b>Рөлдер</b>"]
        for faction in Faction:
            lines += ["", f"<b>{FACTION_TITLES[faction]}</b>"]
            for ri in ROLE_INFO.values():
                if ri.faction is faction:
                    lines.append(f"{ri.title} — {ri.description}")
        return "\n".join(lines)
    if page == "night":
        return (
            "🌙 <b>Түнгі әрекеттердің есептелу реті</b>\n\n"
            "1. Барлық түнгі таңдаулар жиналады (бір мезгілде).\n"
            "2. 💻 Хакер бұғаттаған ойыншының әрекеті орындалмайды.\n"
            "3. 🛡 Бас қорғаушының нысанасы анықталады.\n"
            "4. 👨‍⚕️ Дәрігер емдейді (емделген адам сол түні шабуылдан да, бомбадан да өлмейді).\n"
            "5. 🤵 Мафияның ортақ шабуылы (Донның шешімі, болмаса мафия дауысы).\n"
            "6. 🔪 Киллер, 7. 🪓 Қанішер шабуылдайды.\n"
            "8. 🕵️ Комиссар тексереді немесе атады.\n"
            "9. 🍾 Қайыршы кімдер келгенін біледі.\n"
            "10. 🔥 Бомбалар қойылады не жарылады.\n"
            "11. 🧙‍♀️ Сиқыршы шабуылдаушыны жазалайды не кешіреді.\n"
            "12. 💣 Камикадзе өлтірушісін өзімен бірге алып кетеді (Дәрігерден басым).\n"
            "13. 🐺 Қасқырлар фракциясын ауыстырады.\n"
            "14. Өлім мен тірі қалу бекітіледі, 15. жеңіс шарттары тексеріледі,\n"
            "16. таңғы хабар ортақ чатта жарияланады.\n\n"
            "Сатып алынған 🛡 қорғаныс тек бірінші өлімге әкелетін шабуылды тоқтатады. "
            "Ол бомбаны, Камикадзе мен Сиқыршының арнайы әсерін тоқтатпайды."
        )
    if page == "items":
        lines = ["🎒 <b>Заттар мен артықшылықтар</b>", ""]
        for item in SHOP.values():
            lines.append(f"{item.emoji} <b>{item.name}</b> — {item.price_label}\n{item.description}\n")
        lines.append(
            f"🎭 <b>Рөл таңдау</b> — {ROLE_PICK_PRICE} 💎\nКелесі ойынға рөл таңдайсыз. Рөл ойыншылар "
            "санына сай қолжетімді болса беріледі, әйтпесе таңдау сақталады немесе алмазды қайтара аласыз.\n"
        )
        lines.append(
            "⚖️ Әділдік: бір ойында ең көбі бір қорғаныс, бір дауыс қорғанысы және бір оқ қолданылады. "
            "Заттар тек шын қажет болғанда жұмсалады."
        )
        return "\n".join(lines)
    if page == "balance":
        rows = []
        prev = None
        for n in range(balance.MIN_PLAYERS, balance.MAX_PLAYERS + 1):
            comp = balance.composition(n)
            special = {r: c for r, c in comp.items() if r is not Role.CIVILIAN}
            if special != prev:
                parts = ", ".join(
                    f"{title(r).split(' ', 1)[0]}{'×' + str(c) if c > 1 else ''}" for r, c in special.items()
                )
                rows.append(f"<b>{n}+</b>: {parts}")
                prev = special
        rewards = ", ".join(f"{n} ойыншы — {r} ₸" for n, r in REWARD_POINTS)
        return (
            "⚖️ <b>Ойыншылар санына қарай рөлдер</b>\n"
            "(қалған орындар — 👨 Тұрғындар)\n\n" + "\n".join(rows)
            + f"\n\n💰 <b>Жеңіс сыйақысы</b>: {rewards}; аралық сандар автоматты есептеледі."
        )
    return (
        "📖 <b>Жалпы ережелер</b>\n\n"
        f"• Ойынға {balance.MIN_PLAYERS}–{balance.MAX_PLAYERS} ойыншы қатысады.\n"
        "• Рөлдер кездейсоқ таратылады және тек жеке чатта айтылады.\n"
        "• Ойын түннен басталады. Түнде арнайы рөлдер жеке чатта әрекет етеді, басқалар ұйықтайды "
        "(түнде топқа жазылған хабарламалар өшіріледі).\n"
        "• Таңертең кім қаза тапқаны және оның рөлі жарияланады.\n"
        "• Күндіз талқылау, содан кейін жеке чатта дауыс беру. Ең көп дауыс жинаған дарға асылады; "
        "дауыс тең болса — ешкім асылмайды.\n"
        "• Өлген ойыншылар топқа жаза алмайды (ойын соңына дейін).\n"
        "• Ойыннан шыққан (/leave) ойыншы жеңіліске ұшырайды.\n\n"
        "<b>Жеңіс шарттары</b>\n"
        "🏘 Бейбіттер — барлық Дон, мафия, Киллер және Қанішер жойылса.\n"
        "🤵 Мафия — Дон, мафия және Киллер саны қалған ойыншылардан (Қорғаушыларды есептемегенде) "
        "кем болмаса және Қанішер тірі болмаса. Қорғаушылар мафиямен бірге жеңеді.\n"
        "🪓 Қанішер — тірі ойыншылардың соңғы екеуінің бірі болса.\n"
        "🤡 Өзін-өзі өлтіруші — дарға асылса; 🔥 Пиро — бомбаланғандарды түгел жарса.\n"
        "Жеңімпаз фракцияның тірі де, өлген де мүшелері ₸ сыйақы алады."
    )


# --- Профиль, дүкен, рейтинг -------------------------------------------------------------------


def display_name(username: str | None, full_name: str) -> str:
    return f"@{username}" if username else html.escape(full_name or "Ойыншы")


def profile_text(user, recent, queue, rank: int | None) -> str:
    games = user["games_played"]
    wins = user["wins"]
    rate = f"{wins / games * 100:.1f}".replace(".", ",") + "%" if games else "—"
    lines = [
        "👤 <b>Ойыншы профилі</b>",
        "",
        f"🎮 Ойыншы: {display_name(user['username'], user['full_name'])}",
        f"🆔 ID: <code>{user['user_id']}</code>",
        f"📅 Тіркелген күні: {user['registered_at']:%d.%m.%Y}",
        "",
        "📊 <b>Статистика:</b>",
        f"Ойындар: {games}",
        f"Жеңістер: {wins}",
        f"Жеңілістер: {user['losses']}",
        f"Жеңіс пайызы: {rate}",
    ]
    if rank:
        lines.append(f"Рейтингтегі орны: {rank}")
    if recent:
        lines += ["", "🕹 <b>Соңғы ойындар:</b>"]
        for r in recent:
            mark = "✅" if r["won"] else "❌"
            role = Role(r["final_role"] or r["role"])
            reward = f", +{r['reward']} ₸" if r["reward"] else ""
            lines.append(f"{mark} {title(role)} — {r['players_count']} ойыншы{reward}")
    lines += [
        "",
        "💰 <b>Баланс:</b>",
        f"₸: {user['tenge']}",
        f"💎 Алмаз: {user['diamonds']}",
        "",
        "🎒 <b>Заттар:</b>",
        f"🛡 Қорғаныс: {user['shields']}",
        f"📄 Жалған құжат: {user['fake_docs']}",
        "",
        "💎 <b>Премиум артықшылықтар:</b>",
        f"⚖️ Дауыс беруден қорғаныс: {user['vote_shields']}",
        f"💥 Қорғанысты тесетін оқ: {user['piercing_bullets']}",
        "",
    ]
    if queue:
        first = Role(queue[0]["role"])
        rest = f" (кезекте тағы {len(queue) - 1})" if len(queue) > 1 else ""
        lines.append(f"🎭 Келесі ойынның рөлі: {title(first)}{rest}")
    else:
        lines.append("🎭 Келесі ойынның рөлі: таңдалмаған")
    return "\n".join(lines)


def shop_text(user) -> str:
    lines = [
        "🛍 <b>Дүкен</b>",
        f"Балансыңыз: {user['tenge']} ₸ · {user['diamonds']} 💎",
        "",
    ]
    for item in SHOP.values():
        lines.append(f"{item.emoji} <b>{item.name}</b> — {item.price_label}\n{item.description}\n")
    lines.append("Заттар профильде сақталады және келесі ойындарда автоматты түрде қолданылады.")
    return "\n".join(lines)


def purchase_ok(item: Item, balance_left: int, count: int) -> str:
    s = SHOP[item]
    currency = "₸" if s.currency == "tenge" else "💎"
    return f"✅ {s.emoji} {s.name} сатып алынды! Қолыңызда: {count}. Қалған баланс: {balance_left} {currency}"


def diamonds_text() -> str:
    lines = [
        "💎 <b>Алмаз сатып алу</b>",
        "",
        "Пакет үлкейген сайын бір алмаздың бағасы арзандайды.",
        "Төлем Telegram Stars (⭐) арқылы қауіпсіз өтеді.",
        "",
    ]
    for p in DIAMOND_PACKAGES:
        lines.append(
            f"• <b>{format_kzt(p.diamonds)} 💎</b> — {format_kzt(p.price_kzt)} ₸ "
            f"({format_kzt(round(p.per_diamond_kzt, 2))} ₸/💎) · {p.stars} ⭐"
        )
    return "\n".join(lines)


def role_pick_text(queue) -> str:
    lines = [
        "🎭 <b>Келесі ойынға рөл таңдау</b>",
        f"Бағасы: {ROLE_PICK_PRICE} 💎. Рөл ойыншылар саны жеткен ойында беріледі.",
        "Бір ойында бір таңдау қолданылады, қалғандары кезекте тұрады.",
        "",
    ]
    for role in Role:
        if role is Role.CIVILIAN:
            continue
        lines.append(f"{title(role)} — {balance.min_players_for(role)}+ ойыншы")
    if queue:
        lines += ["", "📋 Кезегіңіз: " + ", ".join(title(Role(q["role"])) for q in queue)]
    return "\n".join(lines)


def rating_text(top, me_rank: int | None) -> str:
    lines = ["🏆 <b>Үздік ойыншылар</b>", ""]
    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    if not top:
        lines.append("Әзірге ешкім ойнаған жоқ.")
    for i, r in enumerate(top, 1):
        rate = r["wins"] / r["games_played"] * 100 if r["games_played"] else 0
        lines.append(
            f"{medals.get(i, f'{i}.')} {display_name(r['username'], r['full_name'])} — "
            f"{r['wins']} жеңіс / {r['games_played']} ойын ({rate:.0f}%)"
        )
    if me_rank:
        lines += ["", f"Сіздің орныңыз: {me_rank}"]
    return "\n".join(lines)


def daily_text(day: int, reward: int, balance_now: int | None) -> str:
    plan = " · ".join(
        (f"<b>{r}</b>" if i + 1 == day else str(r)) for i, r in enumerate(DAILY_REWARDS)
    )
    tail = f"\nБалансыңыз: {balance_now} ₸" if balance_now is not None else ""
    return f"🎁 {day}-күннің сыйлығы: <b>+{reward} ₸</b>!\n{plan}{tail}\nЕртең тағы келіңіз!"
