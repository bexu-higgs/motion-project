from __future__ import annotations

import numpy as np
import pytest

from montazhshy.analysis.audio import analyze_audio, detect_speech
from montazhshy.analysis.beats import analyze_music
from montazhshy.analysis.shots import analyze_video

from .synth import drum_track, make_two_shot_video, speech_like, write_wav


@pytest.mark.parametrize("bpm", [92, 120, 128, 140])
def test_beat_tracking_accuracy(bpm):
    y, beats, downs = drum_track(bpm=bpm, seconds=30, offset=0.31)
    m = analyze_music(y)
    assert abs(m.bpm - bpm) < 1.0
    b = np.array(m.beats)
    errs = [abs(b[np.argmin(np.abs(b - x))] - x) for x in beats[2:-2]]
    assert np.median(errs) < 0.015
    assert max(errs) < 0.045
    d = np.array(m.downbeats)
    derr = [np.min(np.abs(d - x)) for x in downs[2:-2]]
    assert np.median(derr) < 0.03


def test_sections_find_energy_change():
    y, _, _ = drum_track(bpm=120, seconds=40, quiet_bars=4, offset=0.1)
    m = analyze_music(y)
    assert len(m.sections) >= 2
    assert m.sections[0].energy < m.sections[1].energy
    assert abs(m.sections[1].start - (0.1 + 16 * 0.5)) < 0.6


def test_speech_detection(tmp_path):
    y = speech_like(6.0)
    segs, _ = detect_speech(y)
    covered = sum(b - a for a, b in segs)
    assert covered > 3.5
    path = write_wav(tmp_path / "s.wav", y, 16000)
    a = analyze_audio(path, 6.0)
    assert a.speech_ratio > 0.5
    assert a.lufs is not None


def test_music_is_not_speech(tmp_path):
    y, _, _ = drum_track(120, 15)
    path = write_wav(tmp_path / "m.wav", y, 22050)
    a = analyze_audio(path, 15.0)
    assert a.speech_ratio < 0.2


def test_shot_detection(tmp_path):
    p = make_two_shot_video(tmp_path / "two.mp4", 2.0)
    va = analyze_video(p, 4.0, 25)
    assert len(va.shots) == 2
    assert abs(va.shots[1].start - 2.0) < 0.1
    a, b = va.best_window(1.0)
    assert b - a == pytest.approx(1.0, abs=1e-3)
    assert not (a < va.shots[1].start < b)
