#!/usr/bin/env bash
# Толық құрастыру: дыбыс -> кадрлар -> MP4 (1920x1080, 16:9, 24 fps, H.264 + AAC).
# Нәтиже (output/):
#   YEMELBAI_FILMS_Full_Intro_1080p.mp4     — бәрі бірге (интро + Ziyo Fest AI кадры)
#   YEMELBAI_FILMS_VeoSeeBot_Intro_1080p.mp4 — тек интро
#   Ziyo_Fest_AI_Card_1080p.mp4              — тек 6 секундтық Ziyo Fest AI кадры
# Қажет: python3 (numpy, scipy), node + playwright (Chromium), ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

python3 audio.py
node render.mjs

CUT=$(python3 -c 'import json,re;s=open("timeline.js",encoding="utf-8").read();print(json.loads(s[s.index("{",s.index("window.TIMELINE")):s.rindex("}")+1])["introEnd"])')
mux() {   # mux <video-seek-args> <audio-seek-args> <title> <out>
  ffmpeg -y -loglevel error $1 -i output/video_only.mp4 $2 -i output/intro_audio.wav \
    -map 0:v -map 1:a -c:v copy -bsf:v h264_metadata=sample_aspect_ratio=1/1 -c:a aac -b:a 320k -ar 48000 \
    -movflags +faststart -shortest -metadata title="$3" "output/$4"
}
mux "" "" "YEMELBAI FILMS — made with VeoSeeBot, for Ziyo Fest AI" YEMELBAI_FILMS_Full_Intro_1080p.mp4
mux "-t $CUT" "-t $CUT" "YEMELBAI FILMS — made with VeoSeeBot (intro)" YEMELBAI_FILMS_VeoSeeBot_Intro_1080p.mp4
mux "-ss $CUT" "-ss $CUT" "Made for Ziyo Fest AI" Ziyo_Fest_AI_Card_1080p.mp4

rm -f output/video_only.mp4
ls -lh output/*.mp4
