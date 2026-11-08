from __future__ import annotations

import xml.dom.minidom

import numpy as np

from montazhshy.analysis.beats import analyze_music
from montazhshy.autoedit import build, snap_cuts, time_budgets, timeline_grid
from montazhshy.export.nle import export_all
from montazhshy.musicfit import fit_music
from montazhshy.render.audio import duck_envelope, splice
from montazhshy.render.renderer import render, resolve_for
from montazhshy.script import latin_key, parse
from montazhshy.timeline import Clip, Timeline, Transition, describe, resolve

from .synth import drum_track


def test_resolve_frame_accuracy():
    tl = Timeline(clips=[Clip("A", 0, 2.0), Clip("B", 1.0, 3.0, transition=Transition("dissolve", 0.4)),
                         Clip("A", 3.0, 4.0)])
    r = resolve(tl, 25.0, {"A": 10.0, "B": 10.0})
    assert [round(p.start, 3) for p in r.placed] == [0.0, 1.6, 3.6]
    assert round(r.total, 3) == 4.6
    assert round(r.placed[1].cut_point, 3) == 1.8
    # тақ кадрлы ауысу жұпқа келтіріледі
    tl2 = Timeline(clips=[Clip("A", 0, 2.0), Clip("B", 0, 2.0, transition=Transition("dissolve", 0.44))])
    assert round(resolve(tl2, 25.0, {"A": 10.0, "B": 10.0}).placed[1].trans.duration * 25) % 2 == 0


def test_resolve_clamps_out_of_range():
    tl = Timeline(clips=[Clip("A", 8.0, 12.0)])
    r = resolve(tl, 25.0, {"A": 10.0})
    c = r.placed[0].clip
    assert c.src_out <= 10.0 + 1e-6 and c.src_in == 6.0
    assert r.warnings


def test_script_parse_and_translit():
    s = parse("# Атауы\n1. Таулар [01_tau.mp4]\nТитр: Іле\n\n2. Қала @V2\nДиктор: Сәлем\n3. Түн")
    assert s.title == "Атауы"
    assert len(s.scenes) == 3
    assert s.scenes[0].refs == ["01_tau.mp4"] and s.scenes[0].titles == ["Іле"]
    assert s.scenes[1].refs == ["V2"] and s.scenes[1].voiceover == ["Сәлем"]
    assert latin_key("Қала") == latin_key("kala") == latin_key("qala")


def test_music_fit_strategies():
    y, _, _ = drum_track(124, 60)
    ma = analyze_music(y)
    f = fit_music(ma, 30, "edit")
    assert f.strategy == "edit" and len(f.segments) == 2
    assert abs(f.length - 30) < 2.5
    # жапсар такт басында
    assert any(abs(f.segments[0][1] - d) < 0.01 for d in ma.downbeats)
    b = fit_music(ma, 20, "backtime")
    assert b.segments[0][1] > 55
    loop = fit_music(ma, 100, "auto")
    assert loop.strategy == "loop" and loop.length > 90


def test_splice_and_duck():
    sr = 48000
    src = np.ones((sr * 4, 2), dtype=np.float32)
    out = splice(src, [[0, 1], [2, 3]])
    assert abs(len(out) - 2 * sr) < 100
    dialog = np.zeros((sr * 6, 2), dtype=np.float32)
    dialog[2 * sr:4 * sr] = 0.1
    env, secs = duck_envelope(dialog, 12.0)
    assert env[int(1.0 * sr)] > 0.95
    assert env[int(3.0 * sr)] < 0.3
    assert env[int(1.95 * sr)] < 0.9  # look-ahead: сөйлеу басталмай тұрып басылады
    assert secs > 1.5


def test_time_budgets_respect_capacity():
    b = time_budgets(20, [6, 11, 13], [6, 11, 30])
    assert abs(sum(b) - 20) < 1e-6
    assert b[0] <= 6 * 0.95 + 1e-6


def test_autoedit_cuts_on_beat(demo_project):
    for style in ("cinematic", "dynamic", "documentary"):
        tl, info = build(demo_project, style=style, target=20)
        res = resolve_for(demo_project, tl)
        beats, _ = timeline_grid(demo_project, tl)
        d = describe(res, beats)
        on, total = map(int, d["cuts_on_beat"].split("/"))
        assert on == total, (style, d)
        assert abs(res.total - info["duration"]) < 0.1


def test_snap_restores_beat_alignment(demo_project):
    tl, _ = build(demo_project, style="cinematic", target=20)
    tl.clips[2].src_out += 0.13
    tl.clips[4].src_out -= 0.09
    snap_cuts(demo_project, tl)
    beats, _ = timeline_grid(demo_project, tl)
    d = describe(resolve_for(demo_project, tl), beats)
    on, total = map(int, d["cuts_on_beat"].split("/"))
    assert on == total


def test_render_preview_and_exports(demo_project):
    tl, _ = build(demo_project, style="vlog", target=12, title="Сынақ")
    r = render(demo_project, tl, mode="preview")
    assert r.path.exists()
    assert abs(r.duration - resolve_for(demo_project, tl).total) < 0.05
    assert r.audio["integrated_lufs"] is not None
    assert abs(r.audio["integrated_lufs"] - tl.audio.target_lufs) < 1.5
    assert r.audio["true_peak"] <= tl.audio.true_peak + 0.3
    ex = export_all(demo_project, tl)
    xml.dom.minidom.parse(ex["xml"])
    assert "FCM: NON-DROP FRAME" in open(ex["edl"], encoding="utf-8").read()
