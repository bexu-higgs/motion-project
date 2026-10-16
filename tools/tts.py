"""Generate the Kazakh narration and caption timings.

Reads   content/narration.json
Writes  public/audio/narration/<id>.wav          (48 kHz mono, trimmed, level-matched)
        src/generated/narration-timing.json      (durations + caption phrase timings)

Caption phrases are aligned to the pauses the voice actually makes, so the
on-screen text changes when the narrator breathes rather than on a guess.

If you replace the TTS with a human recording, drop files named L01.wav ...
into public/audio/narration/ and run:  python tools/tts.py --timing-only
That level-matches the files in place (-15.5 dB active RMS, -1.5 dBFS ceiling)
and the video timeline re-flows automatically from the new durations.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "content" / "narration.json"
OUT_AUDIO = ROOT / "public" / "audio" / "narration"
OUT_TIMING = ROOT / "src" / "generated" / "narration-timing.json"

SR = 48000
LEAD_IN = 0.06  # seconds of room tone kept before speech
TAIL = 0.14  # seconds kept after speech
TARGET_RMS_DB = -15.5  # per-line speech level (active frames) -> mix lands near -15 LUFS
CEILING_DB = -1.5  # look-ahead peak limiter ceiling


def split_phrases(line: dict) -> list[str]:
    if line.get("captionBreaks"):
        phrases = line["captionBreaks"]
        if " ".join(phrases) != line["text"]:
            raise SystemExit(f"{line['id']}: captionBreaks do not join back to text")
        return phrases
    parts = re.split(r"(?<=[,:;])\s+|\s+(?=—)", line["text"])
    merged: list[str] = []
    for p in parts:
        if merged and (len(merged[-1]) < 22 or len(p) < 14) and len(merged[-1]) + len(p) < 64:
            merged[-1] = f"{merged[-1]} {p}"
        else:
            merged.append(p)
    return merged


def synthesize(voice, text: str, args) -> tuple[np.ndarray, int]:
    from piper import SynthesisConfig

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(
            text,
            w,
            syn_config=SynthesisConfig(
                speaker_id=args.speaker,
                length_scale=args.length_scale,
                noise_scale=args.noise,
                noise_w_scale=args.noise_w,
            ),
        )
    buf.seek(0)
    with wave.open(buf) as r:
        sr = r.getframerate()
        a = np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return a, sr


def frame_db(a: np.ndarray, sr: int, hop: float = 0.01) -> np.ndarray:
    n = int(sr * hop)
    frames = len(a) // n
    rms = np.sqrt(np.mean(a[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def clean(a: np.ndarray, sr: int) -> np.ndarray:
    """Resample to 48k, high-pass, trim and fade."""
    if sr != SR:
        g = np.gcd(sr, SR)
        a = resample_poly(a, SR // g, sr // g)
    a = sosfilt(butter(2, 70, "highpass", fs=SR, output="sos"), a)
    a = sosfilt(butter(8, 10500, "lowpass", fs=SR, output="sos"), a)  # remove resampling images
    db = frame_db(a, SR)
    voiced = np.where(db > db.max() - 45)[0]
    start = max(0, int((voiced[0] * 0.01 - LEAD_IN) * SR))
    end = min(len(a), int(((voiced[-1] + 1) * 0.01 + TAIL) * SR))
    a = a[start:end]
    fade = int(0.012 * SR)
    a[:fade] *= np.linspace(0, 1, fade)
    a[-fade:] *= np.linspace(1, 0, fade)
    return a


def master(a: np.ndarray) -> np.ndarray:
    """Level-match every line, then a transparent look-ahead peak limiter."""
    db = frame_db(a, SR)
    active = db[db > db.max() - 30]
    a = a * 10 ** ((TARGET_RMS_DB - 10 * np.log10(np.mean(10 ** (active / 10)))) / 20)
    ceiling = 10 ** (CEILING_DB / 20)
    need = np.minimum(1.0, ceiling / (np.abs(a) + 1e-9))
    w = int(0.004 * SR)
    # min over 2w then average over w: the gain ramps smoothly and never exceeds `need`
    g = uniform_filter1d(minimum_filter1d(need, size=2 * w + 1), size=w + 1)
    return np.clip(a * g, -ceiling, ceiling)


def pauses(a: np.ndarray) -> list[tuple[float, float]]:
    """(start, end) of low-energy gaps >= 50 ms inside the line, in seconds.

    Includes short stop-consonant closures; align() prefers the longest gap
    near each expected phrase boundary, which is the real breath/comma pause.
    """
    db = frame_db(a, SR)
    silent = db < db.max() - 30
    out, run = [], None
    for i, s in enumerate(silent):
        if s and run is None:
            run = i
        elif not s and run is not None:
            if i - run >= 5 and run > 5:
                out.append((run * 0.01, i * 0.01))
            run = None
    return out


def align(phrases: list[str], a: np.ndarray) -> list[dict]:
    dur = len(a) / SR
    if len(phrases) == 1:
        return [{"text": phrases[0], "start": 0.0, "end": round(dur, 3)}]
    total = sum(len(p) for p in phrases)
    gaps = pauses(a)
    bounds, used, acc = [], set(), 0
    for p in phrases[:-1]:
        acc += len(p)
        expected = LEAD_IN + (dur - LEAD_IN - TAIL) * acc / total
        best = None  # (gap index, mid, score): longest gap, lightly penalised by distance
        for gi, (gs, ge) in enumerate(gaps):
            mid = (gs + ge) / 2
            if gi in used or (bounds and mid <= bounds[-1] + 0.5) or abs(mid - expected) > 0.6:
                continue
            score = (ge - gs) - 0.05 * abs(mid - expected)
            if best is None or score > best[2]:
                best = (gi, mid, score)
        if best:
            used.add(best[0])
            bounds.append(best[1])
        else:
            bounds.append(expected)
    edges = [0.0, *bounds, dur]
    return [
        {"text": p, "start": round(edges[i], 3), "end": round(edges[i + 1], 3)}
        for i, p in enumerate(phrases)
    ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=str(ROOT / "tools" / ".voices" / "kk-issai-high.onnx"))
    ap.add_argument("--speaker", type=int, default=3, help="3 = ISSAI_KazakhTTS_F1_Raya")
    ap.add_argument("--length-scale", type=float, default=1.0, help=">1 slower, <1 faster")
    ap.add_argument("--noise", type=float, default=0.6)
    ap.add_argument("--noise-w", type=float, default=0.7)
    ap.add_argument("--timing-only", action="store_true", help="reuse existing WAVs (e.g. a human voice-over)")
    args = ap.parse_args()

    lines = json.loads(SCRIPT.read_text())["lines"]
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    voice = None
    if not args.timing_only:
        from piper import PiperVoice

        voice = PiperVoice.load(args.voice, config_path=args.voice + ".json")

    timing = []
    for line in lines:
        path = OUT_AUDIO / f"{line['id']}.wav"
        if args.timing_only:
            sr, raw = wavfile.read(path)
            a = raw.astype(np.float64) / (32768 if raw.dtype == np.int16 else 1)
            if a.ndim > 1:
                a = a.mean(axis=1)
            if sr != SR:
                g = np.gcd(sr, SR)
                a = resample_poly(a, SR // g, sr // g)
            a = master(a)
        else:
            raw, sr = synthesize(voice, line.get("tts") or line["text"], args)
            a = master(clean(raw, sr))
        wavfile.write(path, SR, (a * 32767).astype(np.int16))
        phrases = align(split_phrases(line), a)
        timing.append(
            {
                "id": line["id"],
                "section": line["section"],
                "text": line["text"],
                "file": f"audio/narration/{line['id']}.wav",
                "duration": round(len(a) / SR, 3),
                "phrases": phrases,
            }
        )
        print(f"{line['id']}  {len(a) / SR:5.2f}s  " + " | ".join(f"{p['start']:.2f}" for p in phrases))

    OUT_TIMING.parent.mkdir(parents=True, exist_ok=True)
    if args.timing_only:
        meta = json.loads(OUT_TIMING.read_text()).get("voice") if OUT_TIMING.exists() else None
        meta = meta or {"source": "external"}
    else:
        meta = {"engine": "piper", "model": "kk-issai-high", "speaker": args.speaker, "lengthScale": args.length_scale}
    OUT_TIMING.write_text(json.dumps({"voice": meta, "lines": timing}, ensure_ascii=False, indent=2) + "\n")
    print(f"total speech {sum(t['duration'] for t in timing):.1f}s -> {OUT_TIMING.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
