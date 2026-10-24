#!/bin/bash
# Encode the rendered close-up scene ("look at each other", 120 frames) into videos.
# usage: ./make_closeup_videos.sh <frames_dir> [out_dir=renders/closeup]
set -e
FR=${1:?frames dir}
OUT=${2:-renders/closeup}
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ENC="-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart"
mkdir -p "$OUT/shots"

SHOTS=(1:CU1_Person_Afraid 27:CU2_Dragon_Cute 56:CU3_Person_Softens 81:CU4_Dragon_Happy 99:MS5_Person_Approaches 121:END)

ffmpeg -y -loglevel error -framerate 24 -i "$FR/frame_%04d.png" $ENC "$OUT/look_at_each_other_5s.mp4"

DT=""
for i in $(seq 0 4); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=${SHOTS[$((i+1))]%%:*}
  DT+="drawtext=fontfile=$FONT:text='$n':x=20:y=20:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.55:enable='between(n,$((a-1)),$((b-2)))',"
done
DT+="drawtext=fontfile=$FONT:text='%{pts\:hms}  f%{eif\:n+1\:d}':x=w-tw-20:y=20:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.55"
ffmpeg -y -loglevel error -i "$OUT/look_at_each_other_5s.mp4" -vf "$DT" $ENC "$OUT/look_at_each_other_5s_annotated.mp4"

for i in $(seq 0 4); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=${SHOTS[$((i+1))]%%:*}
  ffmpeg -y -loglevel error -framerate 24 -start_number "$a" -i "$FR/frame_%04d.png" -frames:v $((b - a)) $ENC "$OUT/shots/${n}.mp4"
done

# storyboard: 3 frames per shot
IN=(); F=""; k=0; L=""
for i in $(seq 0 4); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=$((${SHOTS[$((i+1))]%%:*} - 1))
  for f in $((a + 2)) $(((a + b) / 2)) $((b - 2)); do
    IN+=(-i "$FR/frame_$(printf %04d $f).png")
    t=$(awk "BEGIN{printf \"%.1f\", ($f-1)/24}")
    F+="[$k]scale=512:288,drawtext=fontfile=$FONT:text='${n%%_*}  ${t}s':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55[v$k];"
    L+="$(( (k % 3) * 512 ))_$(( (k / 3) * 288 ))|"; k=$((k + 1))
  done
done
S=""; for ((j=0;j<k;j++)); do S+="[v$j]"; done
ffmpeg -y -loglevel error "${IN[@]}" -filter_complex "${F}${S}xstack=inputs=$k:layout=${L%|}" "$OUT/storyboard.png"
ls -la "$OUT" "$OUT/shots"
