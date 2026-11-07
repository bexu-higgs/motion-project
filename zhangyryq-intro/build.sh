#!/usr/bin/env bash
# Толық құрастыру: дыбыс -> кадрлар -> MP4 (1920x1080, 16:9, 24 fps, H.264 + AAC).
# Қажет: python3 (numpy, scipy), node + playwright (Chromium), ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

python3 audio.py
node render.mjs

ffmpeg -y -loglevel error \
  -i output/video_only.mp4 -i output/intro_audio.wav \
  -map 0:v -map 1:a -c:v copy -bsf:v h264_metadata=sample_aspect_ratio=1/1 -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart -shortest \
  -metadata title="YEMELBAI FILMS — ЖАҢҒЫРЫҚ (intro)" \
  output/YEMELBAI_FILMS_Zhangyryq_Intro_1080p.mp4

rm -f output/video_only.mp4
echo "Дайын: output/YEMELBAI_FILMS_Zhangyryq_Intro_1080p.mp4"
