#!/usr/bin/env python3
"""Rough forced alignment of a Kazakh voice-over to its script, without an ASR model.

    python3 audio/align.py audio/voiceover.mp3 audio/voiceover.txt out/words.json [offset_s]

1. Speech/pause segmentation from the energy envelope.
2. The script is split into phrases at punctuation; a dynamic programme picks the pauses that best
   match each phrase's expected duration (syllable count — Kazakh is close to syllable-timed).
3. Inside a phrase, words get time in proportion to their syllables, skipping the short pauses.

Prints a table (start, end, word) and writes JSON: [{"w": word, "s": start, "e": end, "p": phrase_index}].
Times are video time (voice offset added).
"""
import json
import re
import subprocess
import sys

import numpy as np

VOWELS = set('аәеёиіоөуұүыэюяaeiouy' + 'АӘЕЁИІОӨУҰҮЫЭЮЯ')


def syllables(word):
    n = sum(1 for ch in word if ch in VOWELS)
    if n == 0 and re.search(r'\d', word):
        n = 2 * len(re.findall(r'\d', word))      # numbers are spoken as words
    if n == 0 and word.isupper() and len(word) <= 4:
        n = len(word)                             # abbreviations spelled out (EN, KZ)
    return max(n, 1)


def load_audio(path, sr=16000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768, sr


def segments(x, sr, hop=0.01, min_pause=0.12):
    n = int(hop * sr)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    thr = max(np.percentile(db, 20) + 8, np.max(db) - 38)
    speech = db > thr
    # close tiny gaps, find pauses
    pauses = []
    i = 0
    while i < frames:
        if not speech[i]:
            j = i
            while j < frames and not speech[j]:
                j += 1
            if (j - i) * hop >= min_pause:
                pauses.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    first = np.argmax(speech) * hop
    last = (frames - np.argmax(speech[::-1])) * hop
    return first, last, [p for p in pauses if p[0] > first and p[1] < last]


def main():
    audio, script, out = sys.argv[1:4]
    offset = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25
    x, sr = load_audio(audio)
    t0, t1, pauses = segments(x, sr)
    text = open(script, encoding='utf-8').read().strip()
    phrases = [p.strip() for p in re.split(r'(?<=[.!?;:…,—–])\s+|\n+', text) if p.strip()]
    words = [[w for w in re.findall(r"[\w%+\-.]+", ph) if re.search(r'\w', w)] for ph in phrases]
    syl = [sum(syllables(w) for w in ws) for ws in words]
    total = sum(syl)
    K = len(phrases)
    speech_time = (t1 - t0) - sum(b - a for a, b in pauses)
    rate = total / max(speech_time, 1e-3)
    # DP: choose K-1 pauses (in order) as phrase boundaries
    M = len(pauses)
    expected = np.cumsum(syl)[:-1] / total      # fraction of syllables before each boundary
    mid = [((a + b) / 2 - t0) / (t1 - t0) for a, b in pauses]
    INF = 1e18
    cost = np.full((K, M + 1), INF)
    back = np.zeros((K, M + 1), int)
    cost[0, :] = 0
    for k in range(1, K):
        for m in range(k, M + 1):
            best, arg = INF, -1
            for j in range(k - 1, m):
                c = cost[k - 1, j] if k > 1 else 0
                if k > 1 and j == 0:
                    continue
                if c < best:
                    best, arg = c, j
            pause_len = pauses[m - 1][1] - pauses[m - 1][0]
            cost[k, m] = best + (mid[m - 1] - expected[k - 1]) ** 2 * 100 - 0.4 * pause_len
            back[k, m] = arg
    bounds = []
    if K > 1 and M >= K - 1:
        m = int(np.argmin(cost[K - 1, K - 1:])) + K - 1
        for k in range(K - 1, 0, -1):
            bounds.append(pauses[m - 1])
            m = back[k, m]
        bounds = bounds[::-1]
    else:
        bounds = [(t0 + (t1 - t0) * e, t0 + (t1 - t0) * e) for e in expected]
    starts = [t0] + [b[1] for b in bounds]
    ends = [b[0] for b in bounds] + [t1]
    res = []
    for k, ws in enumerate(words):
        a, b = starts[k], ends[k]
        inner = [p for p in pauses if p[0] > a and p[1] < b]
        # speaking intervals inside the phrase
        spans, cur = [], a
        for p in inner:
            spans.append((cur, p[0])); cur = p[1]
        spans.append((cur, b))
        dur = sum(e - s for s, e in spans)
        def at(f):  # map fraction of speaking time to clock time
            left = f * dur
            for s, e in spans:
                if left <= e - s:
                    return s + left
                left -= e - s
            return b
        acc = 0
        tot = sum(syllables(w) for w in ws)
        for w in ws:
            s_ = at(acc / tot); acc += syllables(w); e_ = at(acc / tot)
            res.append({'w': w, 's': round(s_ + offset, 3), 'e': round(e_ + offset, 3), 'p': k})
    json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'speech {t0:.2f}-{t1:.2f}s, {len(pauses)} pauses, {K} phrases, ~{rate:.1f} syll/s')
    for k, ph in enumerate(phrases):
        ws = [r for r in res if r['p'] == k]
        print(f"{ws[0]['s']:6.2f} {ws[-1]['e']:6.2f}  {ph}")


if __name__ == '__main__':
    main()
