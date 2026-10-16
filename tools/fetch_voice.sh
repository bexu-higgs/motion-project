#!/usr/bin/env bash
# Downloads the Kazakh Piper voice (ISSAI KazakhTTS / KazakhTTS2, CC-BY-4.0)
# into tools/.voices/. Only needed if you want to re-generate the narration.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .voices
if [ -f .voices/kk-issai-high.onnx ]; then
  echo "Voice already present: tools/.voices/kk-issai-high.onnx"
  exit 0
fi
curl -fL --retry 4 -o .voices/voice-kk-issai-high.tar.gz \
  https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-kk-issai-high.tar.gz
tar -xzf .voices/voice-kk-issai-high.tar.gz -C .voices
rm .voices/voice-kk-issai-high.tar.gz
echo "Voice ready: tools/.voices/kk-issai-high.onnx"
