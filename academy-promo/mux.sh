#!/usr/bin/env bash
# Mix the voice-over over the music + sound-design bed and attach it to a rendered video.
#   ./mux.sh <video.mp4> <bed.wav> <voice.mp3|wav> <out.mp4> [vo_offset_s=0.25]
# The bed ducks under the voice (sidechain), the result is loudness-normalised to -14 LUFS (Instagram/YouTube).
set -euo pipefail
VIDEO=$1; BED=$2; VOICE=$3; OUT=$4; OFF=${5:-0.25}
MS=$(python3 -c "print(int(round(float('$OFF')*1000)))")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
ffmpeg -hide_banner -loglevel error -y -i "$VIDEO" -i "$BED" -i "$VOICE" -filter_complex "
  [2:a]aresample=48000,aformat=channel_layouts=mono,highpass=f=75,lowpass=f=15000,
       acompressor=threshold=-24dB:ratio=2.5:attack=8:release=120:makeup=2dB,
       loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,
       adelay=${MS},apad,pan=stereo|c0=c0|c1=c0,asplit=2[vo][sc];
  [1:a]aresample=48000,volume=0.75[bed];
  [bed][sc]sidechaincompress=threshold=0.035:ratio=6:attack=25:release=420:makeup=1[ducked];
  [vo]volume=1.0[vo2];
  [ducked][vo2]amix=inputs=2:normalize=0:duration=first,
       loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 320k -t "$DUR" -movflags +faststart "$OUT"
echo "wrote $OUT"
