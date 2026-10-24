#!/bin/bash
# Encode rendered PNG frames into the delivery videos.
# usage: ./make_videos.sh <frames_dir> [out_dir=renders]
set -e
FR=${1:?frames dir}
OUT=${2:-renders}
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ENC="-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart"
mkdir -p "$OUT/parts" "$OUT/shots"

ffmpeg -y -loglevel error -framerate 24 -i "$FR/frame_%04d.png" $ENC "$OUT/dragon_egg_blockout_30s.mp4"

# shot name + timecode burned in (review copy)
SHOTS=(1:SH01_Establish_Forest 97:SH02_POV_Stone_Path 173:SH03_Foot_Breaks_Shell 241:SH04_Egg_Rises
       341:SH05_Hatching 469:SH06_First_Contact_OTS 601:SH07_Bond_Embrace 721:END)
DT=""
for i in $(seq 0 6); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=${SHOTS[$((i+1))]%%:*}
  DT+="drawtext=fontfile=$FONT:text='$n':x=20:y=20:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.55:enable='between(n,$((a-1)),$((b-2)))',"
done
DT+="drawtext=fontfile=$FONT:text='%{pts\:hms}  f%{eif\:n+1\:d}':x=w-tw-20:y=20:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.55"
ffmpeg -y -loglevel error -i "$OUT/dragon_egg_blockout_30s.mp4" -vf "$DT" $ENC "$OUT/dragon_egg_blockout_30s_annotated.mp4"

clip() {  # first_frame last_frame output
  ffmpeg -y -loglevel error -framerate 24 -start_number "$1" -i "$FR/frame_%04d.png" -frames:v $(($2 - $1 + 1)) $ENC "$3"
}
clip 1 240   "$OUT/parts/part1_SH01-SH03_0-10s.mp4"
clip 241 468 "$OUT/parts/part2_SH04-SH05_10-19.5s.mp4"
clip 469 720 "$OUT/parts/part3_SH06-SH07_19.5-30s.mp4"
for i in $(seq 0 6); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=${SHOTS[$((i+1))]%%:*}
  clip "$a" $((b - 1)) "$OUT/shots/${n}.mp4"
done

# storyboard: 3 frames per shot (start / middle / end), labelled
IN=(); F=""; k=0; L=""
for i in $(seq 0 6); do
  a=${SHOTS[$i]%%:*}; n=${SHOTS[$i]#*:}; b=$((${SHOTS[$((i+1))]%%:*} - 1))
  for f in $((a + 4)) $(((a + b) / 2)) $((b - 4)); do
    IN+=(-i "$FR/frame_$(printf %04d $f).png")
    t=$(awk "BEGIN{printf \"%.1f\", ($f-1)/24}")
    F+="[$k]scale=512:288,drawtext=fontfile=$FONT:text='${n%%_*}  ${t}s':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55[v$k];"
    L+="$(( (k % 3) * 512 ))_$(( (k / 3) * 288 ))|"; k=$((k + 1))
  done
done
S=""; for ((j=0;j<k;j++)); do S+="[v$j]"; done
ffmpeg -y -loglevel error "${IN[@]}" -filter_complex "${F}${S}xstack=inputs=$k:layout=${L%|}" "$OUT/storyboard.png"
ls -la "$OUT" "$OUT/parts" "$OUT/shots"
