#!/usr/bin/env python3
"""Mix narration + effects from build/cues.json into audio/mix.wav (+ .m4a for the preview).

Voice bus: high-pass, presence lift, gentle compression.
Effects bus: ducked under the voice with a side-chain compressor.
Master: two-pass EBU R128 loudness normalisation to -16 LUFS, -1.5 dBTP. No music.

Usage: python3 tools/mix.py [--video build/video.mp4 --out renders/xxx.mp4]
"""
import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RATE = sfx.RATE


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(RATE), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def add(bus, x, t):
    s = int(round(t * RATE))
    if s >= len(bus):
        return
    e = min(len(bus), s + len(x))
    bus[s:e] += x[: e - s]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cues", default=os.path.join(ROOT, "build", "cues.json"))
    ap.add_argument("--video", help="mux the mix onto this video")
    ap.add_argument("--out", help="output video path")
    args = ap.parse_args()

    cues = json.load(open(args.cues, encoding="utf-8"))
    n = int(cues["duration"] * RATE)
    vo = np.zeros(n, dtype=np.float32)
    fx = np.zeros((n, 2), dtype=np.float32)

    for c in cues["vo"]:
        add(vo, decode(os.path.join(ROOT, c["file"])), c["t"])
    for i, c in enumerate(cues["sfx"]):
        var = int(abs(c["t"]) * 1000 + i) % 8 if c["id"] == "key" else 0
        x = sfx.make(c["id"], dur=c.get("dur"), var=var) * float(c.get("gain", 1))
        add(fx, x, c["t"])
    print("voice peak %.2f, fx peak %.2f" % (np.abs(vo).max(), np.abs(fx).max()))

    build = os.path.join(ROOT, "build")
    os.makedirs(build, exist_ok=True)
    vo_raw, fx_raw = os.path.join(build, "vo.f32"), os.path.join(build, "fx.f32")
    vo.tofile(vo_raw)
    fx.astype(np.float32).tofile(fx_raw)

    graph = (
        "[0:a]highpass=f=75,equalizer=f=220:t=q:w=1.0:g=-1.5,equalizer=f=3300:t=q:w=1.3:g=2.5,"
        "acompressor=threshold=-21dB:ratio=3:attack=6:release=140:makeup=2,"
        "aformat=channel_layouts=stereo,asplit=2[v][sc];"
        "[1:a][sc]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=350[f];"
        "[v][f]amix=inputs=2:normalize=0:duration=longest"
    )
    inputs = ["-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", vo_raw,
              "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", fx_raw]
    # pass 1: measure loudness
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-v", "info", *inputs, "-filter_complex",
                           graph + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True)
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", meas.stderr).group(0))
    ln = ("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
          "measured_thresh={input_thresh}:offset={target_offset}:linear=true").format(**m)
    mix_wav = os.path.join(ROOT, "audio", "mix.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph + "," + ln,
                    "-ar", str(RATE), "-c:a", "pcm_s16le", mix_wav], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mix_wav, "-c:a", "aac", "-b:a", "192k",
                    os.path.join(ROOT, "audio", "mix.m4a")], check=True)
    print("mix → audio/mix.wav, audio/mix.m4a (input %s LUFS → -16 LUFS)" % m["input_i"])

    if args.video and args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", args.video, "-i", mix_wav, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", str(RATE), "-movflags", "+faststart",
                        "-metadata", "title=Module 03 — Prompt Writing", "-metadata:s:a:0", "language=kaz",
                        args.out], check=True)
        print("final →", os.path.relpath(args.out, ROOT))
    os.remove(vo_raw)
    os.remove(fx_raw)


if __name__ == "__main__":
    main()
