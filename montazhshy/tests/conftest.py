from __future__ import annotations

import shutil

import pytest
from PIL import Image

from montazhshy.project import Project

from .synth import drum_track, make_two_shot_video, make_video, speech_like, write_wav

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg жоқ")


@pytest.fixture(scope="session")
def demo_root(tmp_path_factory):
    root = tmp_path_factory.mktemp("demo")
    make_video(root / "01_tau.mp4", seconds=6, size="640x360", source="testsrc2")
    make_video(root / "02_kala.mp4", seconds=5, size="640x360", rate="30", source="smptehdbars", tone=300)
    make_two_shot_video(root / "03_adam.mp4", 3.0)
    make_video(root / "04_tun.mp4", seconds=4, size="360x640", source="rgbtestsrc", tone=None)
    Image.new("RGB", (1200, 800), (200, 120, 40)).save(root / "05_foto.jpg")
    (root / "music").mkdir()
    y, _, _ = drum_track(124, 45)
    write_wav(root / "music" / "song.wav", y, 22050)
    write_wav(root / "diktor.wav", speech_like(6), 16000)
    p = Project.open(root)
    p.scan()
    p.analyze()
    return root


@pytest.fixture()
def demo_project(demo_root, tmp_path):
    # әр тест өз көшірмесімен жұмыс істейді (кэш пен таймлайн араласпасын)
    dst = tmp_path / "proj"
    shutil.copytree(demo_root, dst)
    p = Project.open(dst)
    p.scan()
    p.analyze()
    return p
