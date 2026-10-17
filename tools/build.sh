#!/usr/bin/env bash
# Full build: narration (optional) → frames → audio mix → final MP4.
#   tools/build.sh            render video + mix with the committed narration takes
#   tools/build.sh --voice    re-synthesize the narration first (needs tools/fetch_piper.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=renders/module03-prompt-writing.mp4

if [[ "${1:-}" == "--voice" ]]; then
  tools/fetch_piper.sh
  python3 tools/vo.py
fi
node tools/render.mjs
python3 tools/mix.py --video build/video.mp4 --out "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
