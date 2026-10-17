#!/usr/bin/env python3
"""Synthesize the Kazakh voiceover with Piper (ISSAI Kazakh voice).

Reads script/voiceover.kk.json, renders every line as its own clip and writes:
  audio/vo/<scene>_<n>.flac      trimmed narration clips (48 kHz mono)
  audio/vo/manifest.json         durations + internal pause positions
  src/data/vo-manifest.js        the same data for the browser composition

Piper's duration predictor is stochastic, so each phrase is rendered a few
times and the take with the median length is kept. The committed clips are
the reference takes; re-running this script produces new takes.

A line with `parts` is synthesized phrase by phrase and joined with short
pauses; the start of every phrase is stored in `marks` so the animation can
land on a specific word.

Usage: python3 tools/vo.py [--takes 3] [--speaker 0] [--length-scale 0.95] [--only s3]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import re
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPER = os.path.join(ROOT, ".cache", "piper")
SCRIPT = os.path.join(ROOT, "script", "voiceover.kk.json")
OUT_DIR = os.path.join(ROOT, "audio", "vo")
MANIFEST_JS = os.path.join(ROOT, "src", "data", "vo-manifest.js")
OUT_RATE = 48000


def synth(text, speaker, length_scale, path, noise_w=0.5):
    env = dict(os.environ, LD_LIBRARY_PATH=os.path.join(PIPER, "bin"))
    cmd = [
        os.path.join(PIPER, "bin", "piper"),
        "--model", os.path.join(PIPER, "voices", "kk-issai-high.onnx"),
        "--espeak_data", os.path.join(PIPER, "bin", "espeak-ng-data"),
        "--speaker", str(speaker),
        "--length_scale", str(length_scale),
        "--noise_w", str(noise_w),
        "--sentence_silence", "0.18",
        "--output_file", path,
    ]
    subprocess.run(cmd, input=text.encode("utf-8"), env=env, check=True, capture_output=True)
    with wave.open(path) as w:
        rate = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return data, rate


def frame_db(x, rate, hop=0.01):
    n = int(rate * hop)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def trim(x, rate, pad=0.03):
    db = frame_db(x, rate)
    loud = np.where(db > db.max() - 42)[0]
    if len(loud) == 0:
        return x
    a = max(0, int((loud[0] * 0.01 - pad) * rate))
    b = min(len(x), int(((loud[-1] + 1) * 0.01 + pad) * rate))
    return x[a:b]


def pauses(x, rate, min_gap=0.07):
    """Silent stretches inside a clip, as [start, end] seconds."""
    db = frame_db(x, rate)
    ref = np.percentile(db, 90)
    silent = db < ref - 30
    out, start = [], None
    for i, s in enumerate(silent):
        if s and start is None:
            start = i
        elif not s and start is not None:
            if (i - start) * 0.01 >= min_gap and start > 0:
                out.append([round(start * 0.01, 3), round(i * 0.01, 3)])
            start = None
    return out


def resample(x, rate, target):
    t_old = np.arange(len(x)) / rate
    t_new = np.arange(int(len(x) * target / rate)) / target
    return np.interp(t_new, t_old, x).astype(np.float32)


def write_flac(x, rate, path):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp.name, "-ar", str(OUT_RATE),
                        "-af", "aresample=resampler=soxr", path], check=True)
    os.unlink(tmp.name)


def words(s):
    return re.sub(r"[«»,.:;!?—]", " ", s).split()


def best_take(text, args):
    takes = []
    for _ in range(args.takes):
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            x, rate = synth(text, args.speaker, args.length_scale, tmp.name)
        x = trim(x, rate)
        takes.append((len(x) / rate, x))
    takes.sort(key=lambda t: t[0])
    return takes[len(takes) // 2][1], rate, [round(t[0], 2) for t in takes]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--takes", type=int, default=3)
    ap.add_argument("--speaker", type=int, default=0)  # ISSAI_KazakhTTS2_M2 (male)
    ap.add_argument("--length-scale", type=float, default=0.95)
    ap.add_argument("--only", help="re-render a single scene id, keep the rest")
    args = ap.parse_args()

    if not os.path.exists(os.path.join(PIPER, "bin", "piper")):
        sys.exit("Piper not found. Run tools/fetch_piper.sh first.")

    script = json.load(open(SCRIPT, encoding="utf-8"))
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST_JS), exist_ok=True)
    man_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = json.load(open(man_path)) if args.only and os.path.exists(man_path) else {"lines": {}}
    manifest.update({"voice": "kk-issai-high / speaker %d" % args.speaker,
                     "length_scale": args.length_scale, "rate": OUT_RATE})

    for scene in script["scenes"]:
        if args.only and scene["id"] != args.only:
            continue
        lines = []
        for i, line in enumerate(scene["lines"]):
            parts = line.get("parts") or [line.get("tts", line["text"])]
            if "parts" in line and words(" ".join(parts)) != words(line["text"]):
                sys.exit("parts of %s/%d do not match its text" % (scene["id"], i))
            chunks, marks, info = [], [], []
            for k, part in enumerate(parts):
                x, rate, durs = best_take(part, args)
                if k:
                    gap = 0.3 if parts[k - 1].rstrip().endswith(":") else 0.17
                    chunks.append(np.zeros(int(gap * rate), dtype=np.float32))
                marks.append(round(sum(len(c) for c in chunks) / rate, 3))
                chunks.append(x / max(1e-6, np.abs(x).max()))
                info.append(durs)
            x = np.concatenate(chunks)
            dur = len(x) / rate
            name = "%s_%d.flac" % (scene["id"], i)
            write_flac(x * 0.89, rate, os.path.join(OUT_DIR, name))
            lines.append({"file": "audio/vo/" + name, "text": line["text"], "dur": round(dur, 3),
                          "marks": marks, "pauses": pauses(x, rate)})
            print("%s/%d  %.2fs  marks=%s takes=%s" % (scene["id"], i, dur, marks, info))
        manifest["lines"][scene["id"]] = lines

    json.dump(manifest, open(man_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(MANIFEST_JS, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/vo.py. Do not edit by hand.\n")
        f.write("window.VO_MANIFEST = %s;\n" % json.dumps(manifest, ensure_ascii=False, indent=1))
    total = sum(l["dur"] for s in manifest["lines"].values() for l in s)
    print("total speech %.2fs" % total)


if __name__ == "__main__":
    main()
