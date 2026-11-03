#!/usr/bin/env bash
# Rendered PNG frames + soundtrack -> final 1920x1080 MP4 (24 fps, 24 s).
#   ./make_video.sh frames/ soundtrack.wav shol-reference.mp4
# Frames are expected as f0001.png ... f0576.png (render.py output).
set -euo pipefail
FRAMES=${1:-frames}
AUDIO=${2:-soundtrack.wav}
OUT=${3:-shol-reference.mp4}

ffmpeg -y -hide_banner -loglevel warning \
  -framerate 24 -start_number 1 -i "$FRAMES/f%04d.png" -i "$AUDIO" \
  -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.35,hue=s=0,vignette=angle=PI/5.5,noise=alls=3:allf=t,fade=t=in:st=0:d=0.35,fade=t=out:st=23.45:d=0.55,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -tune film \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
echo "wrote $OUT"
