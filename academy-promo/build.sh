#!/usr/bin/env bash
# Full pipeline: cue list -> sound design -> 16:9 4K60 + 9:16 1080x1920@60 renders -> mixes with the voice-over.
#   ./build.sh [voice.mp3]
set -euo pipefail
cd "$(dirname "$0")"
VOICE=${1:-audio/voiceover.mp3}
if [ -z "${DISPLAY:-}" ]; then Xvfb :99 -screen 0 1280x720x24 >/dev/null 2>&1 & export DISPLAY=:99; sleep 2; fi
mkdir -p out
node render.js --cues out/cues.json
python3 audio/synth.py out/cues.json out/audio
node render.js --aspect 16x9 --scale 2 --fps 60 --out out/video_16x9_4k60.mp4
node render.js --aspect 9x16 --scale 1 --fps 60 --out out/video_9x16_1080x1920_60.mp4
for v in out/video_16x9_4k60.mp4 out/video_9x16_1080x1920_60.mp4; do
  ./mux.sh "$v" out/audio/bed.wav "$VOICE" "${v%.mp4}_final.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$v" -i out/audio/bed.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest "${v%.mp4}_music_sfx.mp4"
done
