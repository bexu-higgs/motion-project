#!/usr/bin/env bash
# Rebuild the intro end-to-end.
#   TTS=<vits-piper-kk_KZ-issai-high dir>  ASR=<sherpa-onnx-whisper-turbo dir>  ./build.sh [--voice]
# Without --voice the committed voiceover takes in assets/vo are reused
# (TTS sampling is stochastic, so re-synthesis changes the timing).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build output
if [[ "${1:-}" == "--voice" ]]; then
  python3 audio/build_vo.py "$TTS" assets/vo "${ASR:-}" 8
fi
python3 audio/align.py                       # word onsets + cue sheet → src/timeline.json
python3 audio/sfx.py build/sfx.wav           # sound design from the cue sheet
python3 audio/mix.py build/sfx.wav output/intro_mix.wav
for fmt in "1080 1920 9x16" "1920 1080 16x9"; do
  set -- $fmt
  node render/render.mjs video "$1" "$2" 60 "build/raw_$3.mp4"
  # 60 fps capture → 30 fps with a 2-frame blend (180° shutter motion blur)
  ffmpeg -y -loglevel error -i "build/raw_$3.mp4" -i output/intro_mix.wav \
    -vf "tmix=frames=2:weights='1 1',fps=30,format=yuv420p" \
    -c:v libx264 -preset slow -crf 16 -profile:v high -tune film \
    -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "output/intro_$3.mp4"
done
