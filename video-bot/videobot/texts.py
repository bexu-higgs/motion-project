"""Боттың барлық қазақша мәтіндері (HTML форматында)."""

from __future__ import annotations

import html

START = (
    "👋 Сәлем! Мен видео жүктейтін ботпын.\n\n"
    "Маған видеоның сілтемесін жіберіңіз:\n"
    "▫️ <b>YouTube</b> — қолжетімді сапалардың тізімін көрсетемін, керегін өзіңіз таңдайсыз. "
    "Аудиосын MP3 не M4A ретінде бөлек алуға болады.\n"
    "▫️ <b>TikTok</b>, <b>Instagram</b>, <b>Facebook</b>, <b>Threads</b> — ең жақсы сапада, "
    "су белгісіз жіберемін.\n\n"
    "Толығырақ: /help"
)

HELP = (
    "📖 <b>Қалай қолданамын?</b>\n\n"
    "1. Видеоның сілтемесін көшіріп, маған жіберіңіз (бір хабарламада 3 сілтемеге дейін).\n"
    "2. YouTube болса — сапасын таңдаңыз: 🎬 видео немесе 🎧 тек аудио.\n"
    "3. Басқа платформалардан видео бірден ең жақсы сапада келеді.\n\n"
    "<b>Қолдау көрсетілетін сілтемелер:</b>\n"
    "• youtube.com, youtu.be, YouTube Shorts\n"
    "• tiktok.com, vm.tiktok.com\n"
    "• instagram.com — Reels, жазбалар (карусельдегі барлық видео)\n"
    "• facebook.com, fb.watch — видео, Reels\n"
    "• threads.com (threads.net)\n\n"
    "⚠️ Telegram ботқа {limit}-тан үлкен файл жіберуге рұқсат бермейді. "
    "Сондықтан тізімде одан үлкен сапалар 🚫 белгісімен көрсетіледі, ал басқа платформаларда "
    "видео шекке сыймаса, бот одан төменірек ең жақсы сапаны өзі таңдайды.\n\n"
    "Жабық (private) аккаунттардағы видеоларды жүктеу мүмкін емес."
)

CHECKING = "🔎 Сілтеме тексерілуде…"
QUEUED = "⏳ Кезекте тұр…"
DOWNLOADING = "⬇️ Жүктелуде…"
PROCESSING = "⚙️ Өңделуде…"
UPLOADING = "📤 Telegram-ға жіберілуде…"
NO_LINK = "Сілтеме табылмады 🤔\nYouTube, TikTok, Instagram, Facebook немесе Threads видеосының сілтемесін жіберіңіз."
UNSUPPORTED_LINK = (
    "Бұл сайтты қолдамаймын 😔\nYouTube, TikTok, Instagram, Facebook немесе Threads сілтемесін жіберіңіз."
)

CHOOSE = "Сапасын таңдаңыз:"
TOO_BIG_NOTE = "🚫 — {limit}-тан үлкен, Telegram арқылы жіберу мүмкін емес."

STARTED = "⏳ Жүктеу басталды"
EXPIRED = "Бұл тізімнің мерзімі өтті — сілтемені қайта жіберіңіз."
OPTION_TOO_BIG = "Бұл нұсқа {limit}-тан үлкен — Telegram оны жіберуге рұқсат бермейді. Төменірек сапаны таңдаңыз."
ALREADY_RUNNING = "Бұл файл қазір жүктеліп жатыр…"
BUSY = "Алдыңғы жүктеулер аяқталғанша күте тұрыңыз."
SKIPPED_LARGE = "ℹ️ Тағы {count} видео {limit}-тан үлкен болғандықтан жіберілмеді."

ERRORS = {
    "private": "🔒 Бұл видео жабық (private) — оны жүктеу мүмкін емес.",
    "login": (
        "🔒 Бұл видеоны көру үшін аккаунтқа кіру керек (жабық аккаунт, жас шектеуі немесе "
        "сайт уақытша шектеу қойды). Кейінірек қайталап көріңіз."
    ),
    "bot_check": (
        "🤖 YouTube серверді бот деп күдіктеніп, уақытша бөгеді. Кейінірек қайталап көріңіз.\n"
        "Бот иесіне: cookies.txt файлын қосу керек (README-де жазылған)."
    ),
    "age": "🔞 Бұл видеоның жас шектеуі бар — аккаунтқа кірмей жүктеу мүмкін емес.",
    "geo": "🌍 Бұл видео сервер орналасқан елде қолжетімсіз.",
    "live": "📡 Тікелей эфирді (немесе әлі басталмаған эфирді) жүктеу мүмкін емес.",
    "playlist": "📃 Бұл — плейлист не арна. Жеке видеоның сілтемесін жіберіңіз.",
    "no_video": "🖼 Бұл жазбада видео табылмады.",
    "unsupported": UNSUPPORTED_LINK,
    "unavailable": "❌ Видео табылмады: ол өшірілген немесе сілтеме қате.",
    "network": "🌐 Сайтқа қосылу мүмкін болмады. Кейінірек қайталап көріңіз.",
    "too_big": "📦 Видео тым үлкен — Telegram ботқа {limit}-тан үлкен файл жіберуге рұқсат бермейді.",
    "upload": "📤 Файлды Telegram-ға жіберу мүмкін болмады. Кейінірек қайталап көріңіз.",
    "failed": "😔 Видеоны жүктеу мүмкін болмады. Кейінірек қайталап көріңіз.",
}

BOT_COMMANDS = [
    ("start", "Ботты бастау"),
    ("help", "Қалай қолдану керек"),
]


def esc(text: str | None) -> str:
    return html.escape(text or "", quote=False)


def _num(value: float, digits: int) -> str:
    return f"{value:.{digits}f}".replace(".", ",")  # қазақша үтір: 1,5 МБ


def human_size(size: int | float | None) -> str:
    if not size:
        return "?"
    mb = size / 1024 / 1024
    if mb < 1:
        return f"{max(1, round(size / 1024))} КБ"
    if mb < 10:
        return f"{_num(mb, 1)} МБ"
    if mb < 1024:
        return f"{mb:.0f} МБ"
    return f"{_num(mb / 1024, 1)} ГБ"


def limit_text(max_file_mb: int) -> str:
    if max_file_mb >= 1000 and max_file_mb % 1000 == 0:
        return f"{max_file_mb // 1000} ГБ"
    return f"{max_file_mb} МБ"


def duration_text(seconds: int | None) -> str:
    if not seconds:
        return ""
    hours, rest = divmod(int(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"


def shorten(text: str | None, limit: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def menu_caption(title: str, uploader: str | None, duration: int | None, any_too_big: bool, limit: str) -> str:
    lines = [f"🎬 <b>{esc(shorten(title, 200))}</b>"]
    meta = []
    if uploader:
        meta.append(f"👤 {esc(uploader)}")
    if duration:
        meta.append(f"⏱ {duration_text(duration)}")
    if meta:
        lines.append(" · ".join(meta))
    lines += ["", CHOOSE]
    if any_too_big:
        lines.append(TOO_BIG_NOTE.format(limit=limit))
    return "\n".join(lines)


def option_button(label: str, kind: str, size: int | None, fits: bool) -> str:
    icon = "🚫" if not fits else ("🎧" if kind == "audio" else "🎬")
    name = label or "Видео"
    return f"{icon} {name} · {human_size(size)}" if size else f"{icon} {name}"


def media_caption(title: str | None, source_url: str, platform_name: str) -> str:
    title_line = esc(shorten(title, 300))
    link = f'<a href="{html.escape(source_url, quote=True)}">{esc(platform_name)}</a>'
    return f"{title_line}\n\n🔗 {link}" if title_line else f"🔗 {link}"


def progress_text(stage: str, fraction: float | None = None, label: str | None = None) -> str:
    head = {"process": PROCESSING, "upload": UPLOADING, "queued": QUEUED}.get(stage, DOWNLOADING)
    if label:
        head = f"{head} {label}"
    if stage == "download" and fraction is not None:
        filled = max(0, min(10, int(fraction * 10)))
        return f"{head} — {int(fraction * 100)}%\n{'▓' * filled}{'░' * (10 - filled)}"
    return head
