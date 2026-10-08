"""Place the voiceover chunks on the master timeline and derive word-level
onsets, written to src/timeline.json (read by both the visuals and the mixer).

Word boundaries inside a multi-word chunk come from DTW alignment (MFCC) of
the chunk against the concatenation of the same words synthesized in isolation
by the same voice, then each onset is nudged to the actual energy rise.
"""
import json, sys, numpy as np, soundfile as sf, librosa

vo_dir = sys.argv[1] if len(sys.argv) > 1 else "assets/vo"
# Chunk start times (s). Pauses are deliberate beats that the visuals fill.
PLACEMENT = {
    "salem":    0.60,
    "with":     2.00,
    "name":     3.28,   # short presenter beat before the name
    "sizderge": 5.45,
    "ai":       7.40,   # HERO
    "lessons": 11.10,
    "final":   15.35,
}
DURATION = 20.0
HOP = 0.005

def feats(y, sr):
    m = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20, hop_length=int(sr * HOP), n_fft=1024)
    return (m - m.mean(1, keepdims=True)) / (m.std(1, keepdims=True) + 1e-6)

meta = json.load(open(f"{vo_dir}/chunks.json"))
words, chunks = [], {}
for key, t0 in PLACEMENT.items():
    m = meta[key]
    x, sr = sf.read(f"{vo_dir}/{key}.wav")
    chunks[key] = {"start": t0, "end": round(t0 + m["dur"], 3), "text": m["text"]}
    if "word_durs" not in m:
        words.append({"w": m["text"].strip(",.!"), "chunk": key, "t": t0, "end": chunks[key]["end"]})
        continue
    parts = [sf.read(f"{vo_dir}/{key}__{i}.wav")[0] for i in range(len(m["word_durs"]))]
    ref = np.concatenate(parts)
    _, wp = librosa.sequence.dtw(feats(ref, sr), feats(x, sr), subseq=False)
    wp = wp[::-1]
    env = librosa.feature.rms(y=x, frame_length=512, hop_length=int(sr * HOP))[0]
    thr = 0.06 * env.max()
    bounds, acc = [0.0], 0
    for p in parts[:-1]:
        acc += len(p)
        fr = acc / sr / HOP
        j = wp[np.argmin(np.abs(wp[:, 0] - fr)), 1]
        while j < len(env) - 1 and env[j] < thr:   # skip any gap to the real onset
            j += 1
        bounds.append(j * HOP)
    bounds.append(m["dur"])
    for i, (w, _) in enumerate(m["word_durs"]):
        words.append({"w": w, "chunk": key, "t": round(t0 + bounds[i], 3),
                      "end": round(t0 + bounds[i + 1], 3)})

# Motion / sound cues — the single source of truth shared by the renderer
# (src/scene.js) and the sound design (audio/sfx.py).
W = {w["w"]: w["t"] for w in words}
c = {
    "pulse1": 0.16, "pulse2": 0.38,
    "salem": W["Сәлем"],                       # kinetic hit + light burst
    "salemOut": W["Сәлем"] + 1.02,             # word dissolves into fragments
    "gather": W["Сіздермен"] + 0.32,           # fragments start converging
    "name": W["Бексұлтан"],                    # letters lock (staggered)
    "nameStagger": 0.045,
    "nameSweep": W["Бексұлтан"] + 0.74,        # light sweep across the name
    "flow": chunks["sizderge"]["start"] - 0.62,  # ribbon enters, name wiped
    "siz": W["Сіздерге"],
    "collapse": W["жасанды"] - 0.85,           # everything focuses into the core
    "hero": W["жасанды"],                      # core bursts into the network
    "intel": W["интеллект"],                   # neural layer fires
    "scan2": W["интеллект"] + 1.05,
    "shift": W["туралы"],                      # abstract -> structured
    "mod1": W["нақты"], "mod2": W["базалық"], "mod3": W["сабақтарды"],
    "converge": W["үйрететін"] - 0.55,
    "ui": W["үйрететін"],
    "bol": W["боламын"],                       # landing impact
    "lockup": W["боламын"] + 1.15,
    "end": DURATION,
}
cues = {k: round(v, 3) for k, v in c.items()}

tl = {"duration": DURATION, "chunks": chunks, "words": words, "cues": cues}
json.dump(tl, open("src/timeline.json", "w"), ensure_ascii=False, indent=1)
for w in words: print(f"{w['t']:6.2f}-{w['end']:6.2f}  {w['w']}")
