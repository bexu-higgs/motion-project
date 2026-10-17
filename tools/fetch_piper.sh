#!/usr/bin/env bash
# Downloads the Piper TTS engine and the ISSAI Kazakh voice into .cache/piper.
# Voice: ISSAI KazakhTTS / KazakhTTS2 (CC BY 4.0), https://github.com/IS2AI/Kazakh_TTS
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.cache/piper"
mkdir -p "$DEST/voices"
if [ ! -x "$DEST/bin/piper" ]; then
  curl -sSL -o "$DEST/piper.tgz" https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
  tar xzf "$DEST/piper.tgz" -C "$DEST" && mv "$DEST/piper" "$DEST/bin" && rm "$DEST/piper.tgz"
fi
if [ ! -f "$DEST/voices/kk-issai-high.onnx" ]; then
  curl -sSL -o "$DEST/voice.tgz" https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-kk-issai-high.tar.gz
  tar xzf "$DEST/voice.tgz" -C "$DEST/voices" && rm "$DEST/voice.tgz"
fi
echo "Piper ready in $DEST"
