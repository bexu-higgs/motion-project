"""Монтаж стильдері, түс түзету (color grade) пресеттері және платформа стандарттары."""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Платформалар: дыбыс қаттылығы (LUFS) және шың (dBTP)
# ---------------------------------------------------------------------------
PLATFORMS: dict[str, dict] = {
    "youtube": {"name": "YouTube", "lufs": -14.0, "tp": -1.0},
    "instagram": {"name": "Instagram Reels", "lufs": -14.0, "tp": -1.0},
    "tiktok": {"name": "TikTok", "lufs": -14.0, "tp": -1.0},
    "tv": {"name": "Телеарна (EBU R128)", "lufs": -23.0, "tp": -1.0},
    "cinema": {"name": "Кинотеатр / фестиваль", "lufs": -24.0, "tp": -2.0},
    "podcast": {"name": "Подкаст / веб", "lufs": -16.0, "tp": -1.0},
}

# ---------------------------------------------------------------------------
# Түс пресеттері. Мәндер — «толық қарқындағы» параметрлер; intensity арқылы бейтарапқа араласады.
# ---------------------------------------------------------------------------
NEUTRAL = {
    "contrast": 1.0, "saturation": 1.0, "gamma": 1.0, "brightness": 0.0,
    "rs": 0.0, "gs": 0.0, "bs": 0.0, "rm": 0.0, "gm": 0.0, "bm": 0.0, "rh": 0.0, "gh": 0.0, "bh": 0.0,
    "s_curve": 0.0, "lift": 0.0, "crush": 0.0, "bw": 0.0,
}

GRADES: dict[str, dict] = {
    "natural": {"name": "Табиғи", "contrast": 1.04, "saturation": 1.06, "s_curve": 0.015},
    "cinematic": {"name": "Кинематографиялық (teal & orange)", "contrast": 1.06, "saturation": 1.04,
                  "rs": -0.07, "bs": 0.08, "gs": 0.01, "rh": 0.06, "gh": 0.015, "bh": -0.07,
                  "s_curve": 0.035, "lift": 0.015},
    "warm": {"name": "Жылы (алтын сағат)", "contrast": 1.04, "saturation": 1.08, "rm": 0.05, "bm": -0.05,
             "rh": 0.04, "bh": -0.05, "s_curve": 0.02},
    "cool": {"name": "Салқын (солтүстік)", "contrast": 1.05, "saturation": 0.9, "bs": 0.06, "bm": 0.035,
             "rm": -0.03, "s_curve": 0.02},
    "moody": {"name": "Мұңды / драма", "contrast": 1.1, "saturation": 0.78, "bs": 0.05, "rs": -0.02,
              "rh": 0.03, "s_curve": 0.04, "lift": 0.045, "crush": 0.03},
    "vibrant": {"name": "Жарқын (Reels)", "contrast": 1.08, "saturation": 1.28, "s_curve": 0.03},
    "bw": {"name": "Ақ-қара (нуар)", "contrast": 1.2, "saturation": 1.0, "s_curve": 0.05, "bw": 1.0},
    "vintage": {"name": "Винтаж / плёнка", "contrast": 0.98, "saturation": 0.84, "rm": 0.04, "bm": -0.04,
                "rh": 0.05, "bh": -0.06, "gs": 0.02, "lift": 0.07, "crush": 0.06},
    "wedding": {"name": "Нәзік (той)", "contrast": 0.98, "saturation": 0.95, "rh": 0.03, "gh": 0.01,
                "bh": -0.02, "lift": 0.03, "gamma": 1.04},
}


def grade_params(preset: str, intensity: float = 1.0) -> dict:
    base = GRADES.get(preset, GRADES["natural"])
    k = max(0.0, min(1.5, intensity))
    out = {}
    for key, neutral in NEUTRAL.items():
        v = base.get(key, neutral)
        out[key] = neutral + (v - neutral) * k
    return out


# ---------------------------------------------------------------------------
# Монтаж стильдері
# ---------------------------------------------------------------------------
@dataclass
class Style:
    key: str
    name: str
    description: str
    grade: str
    grade_intensity: float = 0.8
    letterbox: float = 0.0
    grain: float = 0.0
    vignette: float = 0.0
    # музыка энергиясына қарай неше битте бір кесу (тыныш / орташа / қарқынды)
    beats_per_cut: tuple[int, int, int] = (8, 4, 2)
    shot_range: tuple[float, float] = (2.0, 5.0)  # музыкасыз: кадр ұзақтығы аралығы
    scene_transition: str = "dissolve"  # сахна ауысқанда
    section_transition: str = "dip_black"  # музыка бөлімі ауысқанда
    drop_transition: str = "cut"  # «дроп» сәтінде
    accent_transitions: list[str] = field(default_factory=list)  # кейде қолданылатын ауысулар
    motion: str = "push_in"  # фото/статикалық кадрларға
    motion_amount: float = 0.06
    title_style: str = "cinematic"
    fade_in: float = 0.8
    fade_out: float = 1.5
    duck_db: float = 11.0
    music_fit: str = "edit"
    duration_factor: float = 0.6  # жақсы материалдың қанша бөлігін қолдану
    preferred_duration: tuple[float, float] = (30.0, 120.0)


STYLES: dict[str, Style] = {
    "cinematic": Style(
        "cinematic", "Кинематографиялық",
        "Баяу, ойлы ырғақ. Такт басында кесу, сахна аралығында жұмсақ ауысу, 2.39:1 жолақтар, плёнка түйіршігі.",
        grade="cinematic", grade_intensity=0.85, letterbox=2.39, grain=0.25, vignette=0.3,
        beats_per_cut=(8, 4, 2), shot_range=(3.0, 6.0), scene_transition="dissolve",
        section_transition="dip_black", drop_transition="cut", motion="push_in", motion_amount=0.05,
        title_style="cinematic", fade_in=1.2, fade_out=2.0, duck_db=12.0, music_fit="edit",
        duration_factor=0.55, preferred_duration=(45.0, 150.0)),
    "dynamic": Style(
        "dynamic", "Динамикалық (Reels / TikTok)",
        "Жылдам, битке дәл кесулер, дропта жарқыл/whip ауысулар, жарқын түс.",
        grade="vibrant", grade_intensity=0.8, letterbox=0.0, grain=0.0, vignette=0.1,
        beats_per_cut=(4, 2, 1), shot_range=(0.8, 2.0), scene_transition="cut",
        section_transition="flash", drop_transition="flash", accent_transitions=["whip_left", "whip_right", "zoom"],
        motion="push_in", motion_amount=0.1, title_style="center", fade_in=0.0, fade_out=0.6, duck_db=9.0,
        music_fit="edit", duration_factor=0.45, preferred_duration=(15.0, 45.0)),
    "documentary": Style(
        "documentary", "Деректі фильм",
        "Сюжетке бағынған монтаж: сөйлеуді кеспейді, J/L-кесулер, табиғи түс, музыка фонда.",
        grade="natural", grade_intensity=0.7, beats_per_cut=(8, 8, 4), shot_range=(3.5, 7.0),
        scene_transition="dissolve", section_transition="dip_black", drop_transition="cut",
        motion="push_in", motion_amount=0.04, title_style="lower_third", fade_in=1.0, fade_out=2.0,
        duck_db=14.0, music_fit="backtime", duration_factor=0.65, preferred_duration=(60.0, 300.0)),
    "wedding": Style(
        "wedding", "Той / Үйлену",
        "Нәзік, романтикалық: ұзын кадрлар, жұмсақ ауысулар, жылы әрі нәзік түс.",
        grade="wedding", grade_intensity=0.9, grain=0.1, vignette=0.25,
        beats_per_cut=(8, 4, 4), shot_range=(3.0, 6.0), scene_transition="dissolve",
        section_transition="dissolve", drop_transition="dip_white", motion="push_in", motion_amount=0.05,
        title_style="cinematic", fade_in=1.5, fade_out=2.5, duck_db=12.0, music_fit="edit",
        duration_factor=0.55, preferred_duration=(60.0, 240.0)),
    "trailer": Style(
        "trailer", "Трейлер",
        "Шиеленіс өседі: басында баяу, дропта жылдам кесулер, қараға батыру, үлкен титрлер.",
        grade="moody", grade_intensity=0.85, letterbox=2.39, grain=0.2, vignette=0.35,
        beats_per_cut=(8, 2, 1), shot_range=(1.5, 4.0), scene_transition="dip_black",
        section_transition="dip_black", drop_transition="flash", accent_transitions=["dip_white"],
        motion="push_in", motion_amount=0.08, title_style="center", fade_in=0.5, fade_out=1.5, duck_db=10.0,
        music_fit="backtime", duration_factor=0.45, preferred_duration=(30.0, 120.0)),
    "vlog": Style(
        "vlog", "Влог / Саяхат",
        "Жеңіл, жанды: битке кесу, кейде whip/slide ауысулар, жылы түс.",
        grade="warm", grade_intensity=0.75, beats_per_cut=(4, 4, 2), shot_range=(1.5, 4.0),
        scene_transition="whip_left", section_transition="dissolve", drop_transition="whip_right",
        accent_transitions=["slide_left", "zoom"], motion="push_in", motion_amount=0.06,
        title_style="center", fade_in=0.3, fade_out=1.0, duck_db=11.0, music_fit="edit",
        duration_factor=0.55, preferred_duration=(30.0, 180.0)),
}


def get_style(key: str | None) -> Style:
    return STYLES.get(key or "cinematic", STYLES["cinematic"])


def platform(key: str | None) -> dict:
    return PLATFORMS.get(key or "youtube", PLATFORMS["youtube"])
