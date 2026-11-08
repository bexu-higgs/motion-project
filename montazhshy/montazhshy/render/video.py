"""Видео сүзгілерін құрастыру: кадрлау (reframe), қозғалыс, түс, ауысулар, титрлер.

Әр кадр (clip) алдымен жеке аралық файлға рендерленеді (шығыс өлшемі, кадр жиілігі, түс бір
стандартқа келтіріледі). Кейін аралық файлдар бір графта concat/xfade арқылы жиналады.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from .. import ffmpeg
from ..media import MediaItem
from ..styles import grade_params
from ..timeline import TRANSITIONS, Grade, Placed, Title

FONTS_DIR = Path(__file__).resolve().parent.parent / "fonts"
FONT_LIGHT = FONTS_DIR / "Montserrat-Light.ttf"
FONT_SEMI = FONTS_DIR / "Montserrat-SemiBold.ttf"
FONT_BOLD = FONTS_DIR / "Montserrat-ExtraBold.ttf"


@dataclass
class ShotLook:
    """Кадрдың орташа жарығы мен түсі (автотеңестіру үшін)."""

    brightness: float = 0.45
    color: tuple[float, float, float] = (0.45, 0.45, 0.45)


def _f(v: float) -> str:
    return f"{v:.5f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))


# ---------------------------------------------------------------------------
# Түс
# ---------------------------------------------------------------------------

def grade_filters(grade: Grade, overrides: dict | None, look: ShotLook | None, target_luma: float) -> list[str]:
    p = grade_params(grade.preset, grade.intensity)
    o = overrides or {}
    gamma = p["gamma"]
    rm, gm, bm = p["rm"], p["gm"], p["bm"]
    if grade.auto_match and look is not None:
        b = min(0.95, max(0.05, look.brightness))
        g = math.log(b) / math.log(min(0.9, max(0.1, target_luma)))
        g = 1 + (g - 1) * 0.6
        gamma *= min(1.3, max(0.8, g))
        r, gg, bb = look.color
        avg = (r + gg + bb) / 3
        if avg > 0.04:
            rm += max(-0.08, min(0.08, (avg - r) / avg * 0.5))
            gm += max(-0.06, min(0.06, (avg - gg) / avg * 0.4))
            bm += max(-0.08, min(0.08, (avg - bb) / avg * 0.5))
    # жеке түзетулер
    exposure = float(o.get("exposure", 0.0))  # -1..1 (≈ ±1 стоп)
    if exposure:
        gamma *= 2 ** (exposure * 0.6)
    temp = float(o.get("temperature", 0.0))  # -1 салқын .. +1 жылы
    if temp:
        rm += 0.08 * temp
        bm -= 0.08 * temp
    contrast = p["contrast"] * float(o.get("contrast", 1.0))
    saturation = p["saturation"] * float(o.get("saturation", 1.0))
    out = [f"eq=contrast={contrast:.3f}:saturation={saturation:.3f}:gamma={gamma:.3f}"
           f":brightness={p['brightness']:.3f}"]
    cb = {"rs": p["rs"], "gs": p["gs"], "bs": p["bs"], "rm": rm, "gm": gm, "bm": bm,
          "rh": p["rh"], "gh": p["gh"], "bh": p["bh"]}
    if any(abs(v) > 1e-4 for v in cb.values()):
        out.append("colorbalance=" + ":".join(f"{k}={max(-1, min(1, v)):.4f}" for k, v in cb.items()))
    s, lift, crush = p["s_curve"], p["lift"], p["crush"]
    if s > 1e-4 or lift > 1e-4 or crush > 1e-4:
        pts = [(0.0, lift), (0.25, 0.25 - s + lift * 0.5), (0.75, 0.75 + s - crush * 0.5), (1.0, 1.0 - crush)]
        pts = [(x, min(1.0, max(0.0, y))) for x, y in pts]
        out.append("curves=all='" + " ".join(f"{x:.3f}/{y:.3f}" for x, y in pts) + "'")
    if p["bw"] > 0.5:
        out.append("hue=s=0")
    return out


# ---------------------------------------------------------------------------
# Кадрлау және қозғалыс
# ---------------------------------------------------------------------------

def _motion_exprs(motion: str, amount: float, dur: float, zoom: float, focus: tuple[float, float]
                  ) -> tuple[str, str, str]:
    """(масштаб көбейткіші, fx, fy) өрнектері, t — кадр уақыты."""
    p = f"clip(t/{_f(max(dur, 1e-3))},0,1)"
    fx, fy = _f(focus[0]), _f(focus[1])
    a = _f(amount)
    z0 = _f(zoom)
    if motion == "push_in":
        return f"{z0}*(1+{a}*{p})", fx, fy
    if motion == "pull_out":
        return f"{z0}*(1+{a}*(1-{p}))", fx, fy
    if motion == "pan_left":
        return f"{z0}*(1+{a})", f"(0.8-0.6*{p})", fy
    if motion == "pan_right":
        return f"{z0}*(1+{a})", f"(0.2+0.6*{p})", fy
    if motion == "tilt_up":
        return f"{z0}*(1+{a})", fx, f"(0.8-0.6*{p})"
    if motion == "tilt_down":
        return f"{z0}*(1+{a})", fx, f"(0.2+0.6*{p})"
    return z0, fx, fy


def frame_filters(src_w: int, src_h: int, W: int, H: int, *, reframe: str, motion: str, amount: float,
                  zoom: float, focus: tuple[float, float], dur: float, label_in: str, label_out: str) -> str:
    """Кіріс кадрды W×H-қа келтіретін граф бөлігі (label_in → label_out)."""
    src_w = max(2, src_w)
    src_h = max(2, src_h)
    src_ar = src_w / src_h
    out_ar = W / H
    if reframe == "auto":
        reframe = "fill" if abs(math.log(src_ar / out_ar)) < 0.22 else "blur"
    if reframe == "fit":
        return (f"[{label_in}]scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[{label_out}]")
    cover = max(W / src_w, H / src_h)
    w0, h0 = src_w * cover, src_h * cover
    z, fx, fy = _motion_exprs(motion, amount, dur, max(1.0, zoom), focus)
    static = motion in ("none", "") and abs(zoom - 1.0) < 1e-6
    if reframe == "blur":
        # фон: толтырылған, бұлдыр, сәл қараңғы; алдыңғы жоспар: толық кадр (қозғалыспен)
        fit = min(W / src_w, H / src_h)
        fw, fh = src_w * fit, src_h * fit
        bg_w, bg_h = max(2, int(W / 8) // 2 * 2), max(2, int(H / 8) // 2 * 2)
        if static:
            fg = f"scale={int(fw) // 2 * 2}:{int(fh) // 2 * 2}:flags=lanczos"
        else:
            fg = (f"scale=w='trunc({_f(fw)}*({z})/2)*2':h='trunc({_f(fh)}*({z})/2)*2':eval=frame:flags=bicubic")
        return (f"[{label_in}]split=2[{label_out}_a][{label_out}_b];"
                f"[{label_out}_a]scale={bg_w}:{bg_h}:force_original_aspect_ratio=increase,"
                f"crop={bg_w}:{bg_h},boxblur=4:2,eq=brightness=-0.07:saturation=0.8,"
                f"scale={W}:{H}:flags=bicubic,setsar=1[{label_out}_bg];"
                f"[{label_out}_b]{fg},setsar=1[{label_out}_fg];"
                f"[{label_out}_bg][{label_out}_fg]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame,setsar=1[{label_out}]")
    if static:
        sw = max(W, int(math.ceil(w0 / 2)) * 2)
        sh = max(H, int(math.ceil(h0 / 2)) * 2)
        x = int(round((sw - W) * focus[0]))
        y = int(round((sh - H) * focus[1]))
        return f"[{label_in}]scale={sw}:{sh}:flags=lanczos,crop={W}:{H}:{x}:{y},setsar=1[{label_out}]"
    sw_e = f"max({W},trunc({_f(w0)}*({z})/2)*2)"
    sh_e = f"max({H},trunc({_f(h0)}*({z})/2)*2)"
    return (f"[{label_in}]scale=w='{sw_e}':h='{sh_e}':eval=frame:flags=bicubic,"
            f"crop={W}:{H}:x='({sw_e}-{W})*{fx}':y='({sh_e}-{H})*{fy}',setsar=1[{label_out}]")


def clip_graph(p: Placed, item: MediaItem, W: int, H: int, fps: float, grade: Grade, look: ShotLook | None,
               target_luma: float, *, sharpen: bool) -> str:
    """Бір кадрды аралық файлға рендерлейтін толық filter_complex (кіріс [0:v] → [v])."""
    c = p.clip
    motion = c.motion
    if motion == "auto":
        motion = "push_in" if item.kind == "image" else "none"
    pre = []
    if item.kind != "image":
        pre.append(f"setpts=(PTS-STARTPTS)/{_f(c.speed)}")
    pre.append(f"fps={_f(fps)}")
    g = f"[0:v]{','.join(pre)}[pre];"
    g += frame_filters(item.width, item.height, W, H, reframe=c.reframe, motion=motion, amount=c.motion_amount,
                       zoom=c.zoom, focus=(c.focus[0], c.focus[1]) if len(c.focus) >= 2 else (0.5, 0.5),
                       dur=p.duration, label_in="pre", label_out="fr") + ";"
    post = grade_filters(grade, c.grade, look, target_luma)
    if sharpen and grade.sharpen > 0:
        post.append(f"unsharp=5:5:{0.3 + 0.7 * grade.sharpen:.2f}:5:5:0")
    # дәл кадр саны: соңында жетпесе — соңғы кадрды ұстап тұру, артығын кесу
    post += ["tpad=stop_mode=clone:stop_duration=2", f"trim=end_frame={p.frames}", "setpts=PTS-STARTPTS",
             "format=yuv420p"]
    g += f"[fr]{','.join(post)}[v]"
    return g


# ---------------------------------------------------------------------------
# Жинау (assembly)
# ---------------------------------------------------------------------------

def assembly_graph(placed: list[Placed], total: float, W: int, H: int, grade: Grade, titles: list[Title],
                   fade_in: float, fade_out: float, text_dir: Path, audio_input: int | None,
                   title_lumas: list[float] | None = None) -> str:
    """Аралық файлдарды ([i:v]) бір видеоға жинайтын граф → [vout]."""
    parts: list[str] = []
    # 0) барлық кірістің уақыт базасын бірдей ету (xfade/concat талабы)
    for i in range(len(placed)):
        parts.append(f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[s{i}]")
    # 1) тікелей кесулермен жалғасқан топтар
    groups: list[list[int]] = []
    for i, p in enumerate(placed):
        if i == 0 or p.trans.type != "cut":
            groups.append([i])
        else:
            groups[-1].append(i)
    glabels: list[str] = []
    for gi, g in enumerate(groups):
        if len(g) == 1:
            glabels.append(f"s{g[0]}")
        else:
            ins = "".join(f"[s{i}]" for i in g)
            parts.append(f"{ins}concat=n={len(g)}:v=1:a=0[g{gi}]")
            glabels.append(f"g{gi}")
    # 2) топтар арасындағы ауысулар (xfade)
    acc = glabels[0]
    for gi in range(1, len(groups)):
        first = placed[groups[gi][0]]
        xf = TRANSITIONS.get(first.trans.type) or "fade"
        out = f"x{gi}"
        parts.append(f"[{acc}][{glabels[gi]}]xfade=transition={xf}:duration={_f(first.trans.duration)}"
                     f":offset={_f(first.start)}[{out}]")
        acc = out
    chain: list[str] = []
    # 3) жалпы әсерлер
    if grade.letterbox and grade.letterbox > W / H + 0.01:
        bar = int(round((H - W / grade.letterbox) / 2))
        if bar > 1:
            chain.append(f"drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill")
            chain.append(f"drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill")
    if grade.vignette > 0:
        chain.append(f"vignette=angle={0.15 + 0.55 * min(1.0, grade.vignette):.3f}")
    if grade.grain > 0:
        chain.append(f"noise=c0s={int(4 + 14 * min(1.0, grade.grain))}:c0f=t")
    chain += title_filters(titles, W, H, total, text_dir, letterbox=grade.letterbox, lumas=title_lumas)
    if fade_in > 0:
        chain.append(f"fade=t=in:st=0:d={_f(min(fade_in, total / 3))}")
    if fade_out > 0:
        fo = min(fade_out, total / 3)
        chain.append(f"fade=t=out:st={_f(max(0.0, total - fo))}:d={_f(fo)}")
    chain.append("format=yuv420p")
    parts.append(f"[{acc}]{','.join(chain)}[vout]")
    return ";\n".join(parts)


def _alpha(start: float, end: float, fade: float) -> str:
    s, e, f = _f(start), _f(end), _f(max(0.05, fade))
    return (f"if(lt(t,{s}),0,if(lt(t,{s}+{f}),(t-{s})/{f},"
            f"if(lt(t,{e}-{f}),1,if(lt(t,{e}),({e}-t)/{f},0))))")


def _spaced(text: str) -> str:
    return " ".join(text)


def title_filters(titles: list[Title], W: int, H: int, total: float, text_dir: Path,
                  letterbox: float = 0.0, lumas: list[float] | None = None) -> list[str]:
    out: list[str] = []
    base = min(W, H)
    text_dir.mkdir(parents=True, exist_ok=True)
    bar = 0
    if letterbox and letterbox > W / H + 0.01:
        bar = int(round((H - W / letterbox) / 2))

    def dt(text: str, *, font: Path, size: float, x: str, y: str, start: float, end: float, fade: float,
           color: str = "white", shadow: bool = True, box: str = "", idx: int) -> str:
        f = text_dir / f"t{idx}.txt"
        f.write_text(text, "utf-8")
        if dark and not box:  # жарық фонда — қараңғы мәтін (оқылуы үшін)
            color = color.replace("white", "0x111216")
        opts = [f"fontfile='{ffmpeg.escape_filter_path(font)}'", f"textfile='{ffmpeg.escape_filter_path(f)}'",
                "expansion=none", f"fontsize={int(size)}", f"fontcolor={color}",
                f"x='{x}'", f"y='{y}'", f"alpha='{_alpha(start, end, fade)}'",
                f"enable='between(t,{_f(start)},{_f(end)})'"]
        if shadow:
            opts += ["shadowcolor=" + ("white@0.35" if dark and not box else "black@0.55"),
                     f"shadowx={max(1, int(size / 30))}",
                     f"shadowy={max(1, int(size / 30))}"]
        if box:
            opts += ["box=1", f"boxcolor={box}", f"boxborderw={int(size * 0.45)}"]
        return "drawtext=" + ":".join(opts)

    n = 0
    dark = False
    for ti, t in enumerate(titles):
        dark = bool(lumas and ti < len(lumas) and lumas[ti] > 0.58)
        start = max(0.0, t.start)
        end = min(total, t.start + max(0.3, t.duration))
        if end <= start:
            continue
        text = (t.text or "").strip()
        if not text:
            continue
        lines = [ln for ln in text.splitlines() if ln.strip()]
        sub = [ln for ln in (t.subtext or "").splitlines() if ln.strip()]
        k = max(0.4, min(2.5, t.size))
        style = t.style if t.style in ("cinematic", "center", "lower_third", "subtitle", "end_card",
                                       "chapter") else "center"
        if style in ("cinematic", "chapter", "end_card"):
            font = FONT_LIGHT if style == "cinematic" else FONT_BOLD if style == "end_card" else FONT_SEMI
            size = base * (0.062 if style == "cinematic" else 0.075) * k
            lh = size * 1.35
            sub_size = size * 0.42
            block = lh * len(lines) + (sub_size * 1.8 * len(sub) if sub else 0)
            y0 = H / 2 - block / 2
            if t.position == "bottom":
                y0 = H - bar - block - H * 0.1
            elif t.position == "top":
                y0 = bar + H * 0.1
            for i, ln in enumerate(lines):
                txt = _spaced(ln.upper()) if style == "cinematic" and len(ln) <= 28 else ln
                out.append(dt(txt, font=font, size=size, x="(w-text_w)/2", y=f"{y0 + i * lh:.1f}",
                              start=start, end=end, fade=min(0.8, (end - start) / 3), idx=n))
                n += 1
            for j, ln in enumerate(sub):
                out.append(dt(_spaced(ln.upper()), font=FONT_SEMI, size=sub_size, x="(w-text_w)/2",
                              y=f"{y0 + len(lines) * lh + sub_size * 0.6 + j * sub_size * 1.8:.1f}",
                              start=start + 0.25, end=end, fade=min(0.8, (end - start) / 3), color="white@0.85",
                              idx=n))
                n += 1
        elif style == "lower_third":
            size = base * 0.05 * k
            sub_size = size * 0.68
            x0 = W * 0.07
            y0 = H - bar - H * 0.2 - (sub_size * 1.6 if sub else 0)
            slide = f"{x0:.1f}-{W * 0.04:.1f}*pow(1-min(1,max(0,(t-{_f(start)})/0.45)),3)"
            for i, ln in enumerate(lines[:2]):
                out.append(dt(ln, font=FONT_SEMI, size=size, x=slide, y=f"{y0 + i * size * 1.3:.1f}",
                              start=start, end=end, fade=0.35, box="black@0.42", idx=n))
                n += 1
            for j, ln in enumerate(sub[:2]):
                out.append(dt(ln, font=FONT_LIGHT, size=sub_size, x=slide,
                              y=f"{y0 + len(lines[:2]) * size * 1.3 + sub_size * 0.5 + j * sub_size * 1.4:.1f}",
                              start=start + 0.15, end=end, fade=0.35, color="white@0.9", idx=n))
                n += 1
        elif style == "subtitle":
            size = base * 0.042 * k
            lh = size * 1.5
            y0 = H - bar - H * 0.08 - lh * len(lines)
            for i, ln in enumerate(lines[:3]):
                out.append(dt(ln, font=FONT_SEMI, size=size, x="(w-text_w)/2", y=f"{y0 + i * lh:.1f}",
                              start=start, end=end, fade=0.12, box="black@0.5", shadow=False, idx=n))
                n += 1
        else:  # center
            size = base * 0.09 * k
            lh = size * 1.2
            block = lh * len(lines)
            y0 = H / 2 - block / 2
            if t.position == "bottom":
                y0 = H - bar - block - H * 0.12
            elif t.position == "top":
                y0 = bar + H * 0.12
            for i, ln in enumerate(lines):
                out.append(dt(ln, font=FONT_BOLD, size=size, x="(w-text_w)/2", y=f"{y0 + i * lh:.1f}",
                              start=start, end=end, fade=min(0.35, (end - start) / 4), idx=n))
                n += 1
            for j, ln in enumerate(sub):
                out.append(dt(ln, font=FONT_SEMI, size=size * 0.4, x="(w-text_w)/2",
                              y=f"{y0 + block + size * 0.2 + j * size * 0.55:.1f}",
                              start=start + 0.2, end=end, fade=0.3, color="white@0.9", idx=n))
                n += 1
    return out
