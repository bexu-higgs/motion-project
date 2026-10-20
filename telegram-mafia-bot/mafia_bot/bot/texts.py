"""Бот хабарламаларын құрастыру. Барлық мәтін ``mafia_bot.i18n`` каталогынан алынады."""

from __future__ import annotations

import html
from datetime import timedelta

from ..economy import (
    DAILY_REWARDS,
    DIAMOND_PACKAGES,
    DIAMOND_TO_TENGE,
    PREMIUM_ROLE_PRICE,
    PREMIUM_ROLES,
    REWARD_POINTS,
    ROLE_PICK_PRICE,
    SHOP,
    Item,
    format_kzt,
    role_price,
)
from ..game import balance
from ..game.roles import (
    PURCHASABLE_ROLES,
    ROLE_INFO,
    Faction,
    Role,
    description,
    faction_title,
    name,
    title,
)
from ..i18n import t

# --- Басты мәзір -------------------------------------------------------------------------------

MENU_KEYS: tuple[tuple[str, ...], ...] = (
    ("btn.join", "btn.room"),
    ("btn.profile", "btn.shop"),
    ("btn.diamonds", "btn.role"),
    ("btn.rules", "btn.rating"),
    ("btn.daily", "btn.help"),
    ("btn.lang",),
)

RULE_PAGES: tuple[str, ...] = ("general", "roles", "night", "items", "balance")


def menu_rows(lang: str) -> list[list[str]]:
    return [[t(lang, key) for key in row] for row in MENU_KEYS]


def format_timedelta(delta: timedelta, lang: str) -> str:
    total = max(0, int(delta.total_seconds()))
    hours, rem = divmod(total, 3600)
    minutes = rem // 60
    if hours:
        return t(lang, "time.hm", h=hours, m=minutes)
    return t(lang, "time.m", m=max(minutes, 1))


# --- Ережелер ----------------------------------------------------------------------------------


def rules_page(page: str, lang: str) -> str:
    if page == "roles":
        lines = [t(lang, "rules.roles_title")]
        for faction in Faction:
            lines += ["", f"<b>{faction_title(faction, lang)}</b>"]
            for ri in ROLE_INFO.values():
                if ri.faction is faction:
                    lines.append(f"{title(ri.role, lang)} — <i>{description(ri.role, lang)}</i>")
        return "\n".join(lines)
    if page == "night":
        return t(lang, "rules.night")
    if page == "items":
        lines = [t(lang, "rules.items_title"), ""]
        for item in SHOP.values():
            lines.append(t(lang, "rules.item_line", emoji=item.emoji, name=item.name(lang),
                           price=item.price_label, desc=item.description(lang)))
        lines.append(t(lang, "rules.role_pick", price=ROLE_PICK_PRICE, premium=PREMIUM_ROLE_PRICE,
                       roles=premium_roles(lang)))
        lines.append(t(lang, "rules.exchange", rate=DIAMOND_TO_TENGE))
        lines.append(t(lang, "rules.fairness"))
        return "\n".join(lines)
    if page == "balance":
        rows = []
        prev = None
        for n in range(balance.MIN_PLAYERS, balance.MAX_PLAYERS + 1):
            special = {r: c for r, c in balance.composition(n).items() if r is not Role.CIVILIAN}
            if special != prev:
                parts = ", ".join(
                    f"{ROLE_INFO[r].emoji}{'×' + str(c) if c > 1 else ''}" for r, c in special.items()
                )
                rows.append(f"<b>{n}+</b>: {parts}")
                prev = special
        rewards = ", ".join(f"{n} → {r} ₸" for n, r in REWARD_POINTS)
        return "\n".join([
            t(lang, "rules.balance_title"),
            "",
            *rows,
            "",
            t(lang, "rules.higgs_rare", min=balance.HIGGS_MIN_PLAYERS, chance=round(balance.HIGGS_CHANCE * 100)),
            t(lang, "rules.sleepless_rare", min=balance.SLEEPLESS_MIN_PLAYERS,
              chance=round(balance.SLEEPLESS_CHANCE * 100)),
            t(lang, "rules.rewards", rewards=rewards),
        ])
    return t(lang, "rules.general", min=balance.MIN_PLAYERS, max=balance.MAX_PLAYERS)


# --- Профиль, дүкен, рейтинг -------------------------------------------------------------------


def display_name(username: str | None, full_name: str) -> str:
    return f"@{username}" if username else html.escape(full_name or "—")


def profile_text(user, recent, queue, rank: int | None, lang: str) -> str:
    games = user["games_played"]
    wins = user["wins"]
    rate = f"{wins / games * 100:.1f}%" if games else "—"
    lines = [
        t(lang, "profile.title"),
        "",
        t(lang, "profile.player", name=display_name(user["username"], user["full_name"])),
        t(lang, "profile.id", id=user["user_id"]),
        t(lang, "profile.registered", date=f"{user['registered_at']:%d.%m.%Y}"),
        "",
        t(lang, "profile.stats"),
        t(lang, "profile.games", n=games),
        t(lang, "profile.wins", n=wins),
        t(lang, "profile.losses", n=user["losses"]),
        t(lang, "profile.rate", rate=rate),
    ]
    if rank:
        lines.append(t(lang, "profile.rank", rank=rank))
    if recent:
        lines += ["", t(lang, "profile.recent")]
        for r in recent:
            reward = t(lang, "profile.reward", reward=r["reward"]) if r["reward"] else ""
            lines.append(t(lang, "profile.recent_line", mark="✅" if r["won"] else "❌",
                           role=title(Role(r["final_role"] or r["role"]), lang),
                           count=r["players_count"], reward=reward))
    lines += [
        "",
        t(lang, "profile.balance"),
        t(lang, "profile.tenge", n=user["tenge"]),
        t(lang, "profile.diamonds", n=user["diamonds"]),
        "",
        t(lang, "profile.items"),
        t(lang, "profile.shields", n=user["shields"]),
        t(lang, "profile.fake_docs", n=user["fake_docs"]),
        "",
        t(lang, "profile.premium"),
        t(lang, "profile.vote_shields", n=user["vote_shields"]),
        t(lang, "profile.bullets", n=user["piercing_bullets"]),
        "",
    ]
    if queue:
        more = t(lang, "profile.queue_more", n=len(queue) - 1) if len(queue) > 1 else ""
        lines.append(t(lang, "profile.next_role", role=title(Role(queue[0]["role"]), lang), more=more))
    else:
        lines.append(t(lang, "profile.next_none"))
    return "\n".join(lines)


def shop_text(user, lang: str) -> str:
    lines = [t(lang, "shop.title"), t(lang, "shop.balance", tenge=user["tenge"], diamonds=user["diamonds"]), ""]
    for item in SHOP.values():
        lines.append(t(lang, "rules.item_line", emoji=item.emoji, name=item.name(lang),
                       price=item.price_label, desc=item.description(lang)))
    lines.append(t(lang, "rules.exchange", rate=DIAMOND_TO_TENGE))
    lines.append(t(lang, "shop.footer"))
    return "\n".join(lines)


def purchase_ok(item: Item, balance_left: int, count: int, lang: str) -> str:
    s = SHOP[item]
    currency = "₸" if s.currency == "tenge" else "💎"
    return t(lang, "shop.bought", emoji=s.emoji, name=s.name(lang), count=count,
             balance=balance_left, currency=currency)


def diamonds_text(lang: str) -> str:
    lines = [t(lang, "dia.title"), "", t(lang, "dia.intro"), ""]
    for p in DIAMOND_PACKAGES:
        lines.append(t(lang, "dia.line", diamonds=format_kzt(p.diamonds), price=format_kzt(p.price_kzt),
                       per=format_kzt(round(p.per_diamond_kzt, 2)), stars=p.stars))
    return "\n".join(lines)


def premium_roles(lang: str) -> str:
    """Қымбатырақ (2 💎) рөлдердің атаулары."""
    return ", ".join(name(r, lang) for r in PURCHASABLE_ROLES if r in PREMIUM_ROLES)


def role_pick_text(queue, lang: str) -> str:
    intro = t(lang, "rp.intro", price=ROLE_PICK_PRICE, premium=PREMIUM_ROLE_PRICE, roles=premium_roles(lang))
    lines = [t(lang, "rp.title"), intro, ""]
    for role in PURCHASABLE_ROLES:
        lines.append(t(lang, "rp.line", role=title(role, lang), price=role_price(role),
                       min=balance.min_players_for(role)))
    lines += ["", t(lang, "rp.higgs_note", role=title(Role.HIGGS, lang))]
    if queue:
        lines += ["", t(lang, "rp.queue", roles=", ".join(title(Role(q["role"]), lang) for q in queue))]
    return "\n".join(lines)


def rating_text(top, me_rank: int | None, lang: str) -> str:
    lines = [t(lang, "rating.title"), ""]
    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    if not top:
        lines.append(t(lang, "rating.empty"))
    for i, r in enumerate(top, 1):
        rate = r["wins"] / r["games_played"] * 100 if r["games_played"] else 0
        lines.append(t(lang, "rating.line", medal=medals.get(i, f"{i}."),
                       name=display_name(r["username"], r["full_name"]), wins=r["wins"],
                       games=r["games_played"], rate=f"{rate:.0f}"))
    if me_rank:
        lines += ["", t(lang, "rating.me", rank=me_rank)]
    return "\n".join(lines)


def weekly_top_text(top, chat_title: str, lang: str) -> str:
    lines = [t(lang, "top.title", chat=html.escape(chat_title)), ""]
    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    if not top:
        lines.append(t(lang, "top.empty"))
    for i, r in enumerate(top, 1):
        lines.append(t(lang, "top.line", medal=medals.get(i, f"{i}."),
                       name=display_name(r["username"], r["full_name"]), wins=r["wins"],
                       games=r["games"], earned=r["earned"]))
    return "\n".join(lines)


def daily_text(day: int, reward: int, balance_now: int | None, lang: str) -> str:
    plan = " · ".join((f"<b>{r}</b>" if i + 1 == day else str(r)) for i, r in enumerate(DAILY_REWARDS))
    lines = [t(lang, "daily.ok", day=day, reward=reward), plan]
    if balance_now is not None:
        lines.append(t(lang, "daily.balance", n=balance_now))
    lines.append(t(lang, "daily.tomorrow"))
    return "\n".join(lines)
