"""Synthesize the Kazakh voiceover phrase-by-phrase with the ISSAI KazakhTTS
(Piper/VITS) male voice and write the chosen take of every chunk.

VITS sampling is stochastic, so several takes are generated per chunk. If a
Whisper model directory is given, each take is transcribed and the take whose
transcript is closest to the script (and whose words are most evenly voiced)
is kept.

Models (sherpa-onnx releases on GitHub):
  tts-models/vits-piper-kk_KZ-issai-high.tar.bz2
  asr-models/sherpa-onnx-whisper-turbo.tar.bz2   (optional, for take selection)
Usage: python3 audio/build_vo.py <tts_model_dir> <out_dir> [whisper_dir] [takes]
"""
import difflib, json, re, sys
import numpy as np, soundfile as sf, sherpa_onnx, librosa

# Exact script, split only at phrase boundaries (text is not altered).
# Trailing punctuation is a prosody hint for the model only.
CHUNKS = [
    ("salem",    "Сәлем!"),
    ("with",     "Сіздермен бірге,"),
    ("name",     "Бексұлтан."),
    ("sizderge", "Сіздерге,"),
    ("ai",       "жасанды интеллект"),
    ("lessons",  "туралы нақты базалық сабақтарды"),
    ("final",    "үйрететін боламын!"),
]
SPEAKER = 1        # ISSAI_KazakhTTS_M1_Iseke — warm, low male narrator
SPEED = 0.86       # unhurried, confident delivery

model_dir, out_dir = sys.argv[1], sys.argv[2]
asr_dir = sys.argv[3] if len(sys.argv) > 3 else None
TAKES = int(sys.argv[4]) if len(sys.argv) > 4 else (8 if asr_dir else 1)

tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=f"{model_dir}/kk_KZ-issai-high.onnx", tokens=f"{model_dir}/tokens.txt",
        data_dir=f"{model_dir}/espeak-ng-data", noise_scale=0.55, noise_scale_w=0.7),
    num_threads=4)))
asr = None
if asr_dir:
    asr = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=f"{asr_dir}/turbo-encoder.int8.onnx", decoder=f"{asr_dir}/turbo-decoder.int8.onnx",
        tokens=f"{asr_dir}/turbo-tokens.txt", language="kk", task="transcribe", num_threads=8)

def norm(s):
    return re.sub(r"[^\w ]", "", s.lower()).strip()

def trim(x, sr, thr=0.012):
    env = np.convolve(np.abs(x), np.ones(int(sr * 0.01)) / int(sr * 0.01), "same")
    idx = np.where(env > thr)[0]
    a, b = max(idx[0] - int(sr * 0.015), 0), min(idx[-1] + int(sr * 0.06), len(x))
    return x[a:b]

def synth(text):
    a = tts.generate(text, sid=SPEAKER, speed=SPEED)
    return trim(np.asarray(a.samples, dtype=np.float32), a.sample_rate), a.sample_rate

def transcribe(x, sr):
    pad = np.zeros(sr, dtype=np.float32)
    y = librosa.resample(np.concatenate([pad, x, pad]), orig_sr=sr, target_sr=16000)
    s = asr.create_stream(); s.accept_waveform(16000, y.astype(np.float32)); asr.decode_stream(s)
    return s.result.text

def evenness(x, sr):
    # ratio of the quietest to loudest 150 ms voiced window (1 = perfectly even)
    rms = librosa.feature.rms(y=x, frame_length=int(sr * 0.15), hop_length=int(sr * 0.05))[0]
    v = rms[rms > 0.15 * rms.max()]
    return float(np.percentile(v, 20) / rms.max())

meta = {}
for key, text in CHUNKS:
    best = None
    for k in range(TAKES):
        x, sr = synth(text)
        score, hyp = 0.0, ""
        if asr:
            hyp = transcribe(x, sr)
            score = difflib.SequenceMatcher(None, norm(hyp), norm(text)).ratio()
        score += 0.25 * evenness(x, sr)
        if best is None or score > best[0]:
            best = (score, x, sr, hyp)
    _, x, sr, hyp = best
    sf.write(f"{out_dir}/{key}.wav", x, sr)
    meta[key] = {"text": text, "dur": round(len(x) / sr, 3), "sr": sr, "asr": hyp, "score": round(best[0], 3)}
    words = re.findall(r"[^\s,.!]+", text)
    if len(words) > 1:
        # isolated words, DTW-aligned against the chunk by align.py
        meta[key]["word_durs"] = []
        for i, w in enumerate(words):
            y, _ = synth(w)
            sf.write(f"{out_dir}/{key}__{i}.wav", y, sr)
            meta[key]["word_durs"].append([w, round(len(y) / sr, 3)])
    print(key, meta[key]["dur"], meta[key]["score"], "|", hyp, flush=True)
json.dump(meta, open(f"{out_dir}/chunks.json", "w"), ensure_ascii=False, indent=1)
