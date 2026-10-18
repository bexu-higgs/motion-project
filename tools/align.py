#!/usr/bin/env python3
"""Align caption lines and scene windows to the real Kazakh voice-over.

    python3 tools/align.py [assets/audio/voiceover.wav]

Finds the pauses in the recording and picks, for every boundary between two
caption lines, the pause that best matches the line lengths (dynamic
programming). Writes script/timing.aligned.json, which tools/prepare.mjs then
uses instead of the estimate. The file is plain JSON and can be hand-tuned.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 16000
HOP = 0.01  # 10 ms analysis frames
MIN_GAP = 0.16  # shortest pause that can separate two caption lines
SCENE_LEAD = 0.5  # scene starts this long before its first line
OUTRO = 7.2  # final clip + end card after the last line


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def energy_db(x):
    n = int(SR * HOP)
    frames = x[: len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)


def speech_mask(db):
    floor, peak = np.percentile(db, 10), np.percentile(db, 97)
    thr = floor + 0.32 * (peak - floor)
    m = db > thr
    # close tiny holes (plosives) and drop clicks
    k = int(0.06 / HOP)
    m = np.convolve(m.astype(float), np.ones(k), "same") > 0
    return m


def dips(db, t0, t1, taken, spacing=0.3):
    """Energy minima inside continuous speech: fallback boundaries for lines
    that were read without a real pause."""
    k = int(0.08 / HOP)
    sm = np.convolve(db, np.ones(k) / k, "same")
    r = int(spacing / HOP)
    out = []
    for i in range(int(t0 / HOP) + r, int(t1 / HOP) - r):
        if sm[i] == sm[i - r : i + r + 1].min():
            t = i * HOP
            if not any(a - 0.1 <= t <= b + 0.1 for a, b in taken):
                out.append((t, t))
    return out


def gaps(mask):
    """Silent runs between speech: list of (start, end) seconds."""
    out, i, n = [], 0, len(mask)
    first = np.argmax(mask)
    last = n - np.argmax(mask[::-1])
    i = first
    while i < last:
        if not mask[i]:
            j = i
            while j < last and not mask[j]:
                j += 1
            if (j - i) * HOP >= MIN_GAP:
                out.append((i * HOP, j * HOP))
            i = j
        else:
            i += 1
    return first * HOP, last * HOP, out


def align(lines, t0, t1, cands):
    """Choose len(lines)-1 pauses so line durations track character counts."""
    n = len(lines)
    w = np.array([len(l) for l in lines], dtype=float)
    m = len(cands)
    if m < n - 1:
        raise SystemExit(f"found only {m} pauses for {n} caption lines — check the audio or lower MIN_GAP")
    voiced = (t1 - t0) - sum(e - s for s, e in cands)
    rate = voiced / w.sum()  # seconds per character
    starts = [t0] + [e for _, e in cands]
    ends = [s for s, _ in cands] + [t1]
    INF = 1e18
    # cost[i][j]: line i ends at pause j (j == m means end of audio)
    cost = np.full((n, m + 1), INF)
    back = np.zeros((n, m + 1), dtype=int)

    def seg(a, b, i):
        d = ends[b] - starts[a]
        exp = w[i] * rate
        gap_bonus = 0.0 if b == m else (cands[b][1] - cands[b][0])
        return ((d - exp) ** 2) / max(exp, 0.5) - 0.8 * gap_bonus

    for j in range(m + 1):
        cost[0][j] = seg(0, j, 0)
    for i in range(1, n):
        for j in range(i, m + 1):
            best, arg = INF, -1
            for k in range(i - 1, j):
                c = cost[i - 1][k] + seg(k + 1, j, i)
                if c < best:
                    best, arg = c, k
            cost[i][j], back[i][j] = best, arg
    js = [m]
    for i in range(n - 1, 0, -1):
        js.append(back[i][js[-1]])
    js = js[::-1]
    res, a = [], 0
    for i, j in enumerate(js):
        res.append((round(starts[a], 3), round(ends[j], 3)))
        a = j + 1
    return res


def main():
    cfg = json.loads((ROOT / "project.config.json").read_text())
    lesson = json.loads((ROOT / "src/lesson.json").read_text())
    audio = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if audio is None:
        base = ROOT / cfg["audio"]
        for ext in (base.suffix, ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"):
            if base.with_suffix(ext).exists():
                audio = base.with_suffix(ext)
                break
    if audio is None or not audio.exists():
        raise SystemExit(f"voice-over not found: {cfg['audio']}")
    x = load(audio)
    dur = len(x) / SR
    db = energy_db(x)
    t0, t1, pauses = gaps(speech_mask(db))
    cands = sorted(pauses + dips(db, t0, t1, pauses))
    lines = [(s["id"], i, t) for s in lesson["scenes"] for i, t in enumerate(s["narration"])]
    spans = align([t for _, _, t in lines], t0, t1, cands)
    captions = [
        {"scene": sid, "index": i, "start": a, "end": b, "text": t}
        for (sid, i, t), (a, b) in zip(lines, spans)
    ]
    scenes, ids = [], [s["id"] for s in lesson["scenes"]]
    for k, sid in enumerate(ids):
        first = next(c for c in captions if c["scene"] == sid)
        start = 0.0 if k == 0 else round(first["start"] - SCENE_LEAD, 3)
        scenes.append({"id": sid, "start": start})
    for k in range(len(scenes) - 1):
        scenes[k]["end"] = scenes[k + 1]["start"]
    total = round(max(dur, captions[-1]["end"] + OUTRO), 3)
    scenes[-1]["end"] = total
    out = {"source": f"aligned:{audio.relative_to(ROOT) if audio.is_relative_to(ROOT) else audio}",
           "duration": total, "scenes": scenes, "captions": captions}
    dst = ROOT / "script/timing.aligned.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"audio {dur:.2f}s, speech {t0:.2f}–{t1:.2f}s, {len(pauses)} pauses (+{len(cands) - len(pauses)} dips) → {len(captions)} lines")
    for s in scenes:
        print(f"  {s['id']:9s} {s['start']:7.2f} – {s['end']:7.2f}")
    print(f"wrote {dst.relative_to(ROOT)} (video length {total:.1f}s)")


if __name__ == "__main__":
    main()
