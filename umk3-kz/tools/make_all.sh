#!/bin/sh
# usage: tools/make_all.sh original.apk out_dir [voice_dir]
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
APK=$1; OUT=$2; VOICE=$3
mkdir -p "$OUT/work"
unzip -o -q "$APK" assets/rom.zip -d "$OUT/work"
unzip -o -q "$OUT/work/assets/rom.zip" -d "$OUT/work"
python3 -c "import sys;d=open(sys.argv[1],'rb').read();open(sys.argv[2],'wb').write(d[512:] if len(d)%1024==512 else d)" "$OUT/work/umk3.smc" "$OUT/work/umk3.sfc"
python3 "$HERE/build.py" "$OUT/work/umk3.sfc" "$OUT/umk3_kz.sfc"
if [ -n "$VOICE" ]; then python3 "$HERE/apply_voice.py" "$OUT/umk3_kz.sfc" "$OUT/umk3_kz.sfc" "$VOICE"; fi
python3 "$HERE/mkapk.py" "$APK" "$OUT/umk3_kz.sfc" "$OUT/work/unsigned.apk" "$OUT/work/umk3.smc"
[ -f "$OUT/kz.keystore" ] || keytool -genkeypair -keystore "$OUT/kz.keystore" -storepass umk3kzpass -keypass umk3kzpass \
   -alias umk3kz -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=UMK3 KZ, C=KZ" >/dev/null 2>&1
cp "$OUT/work/unsigned.apk" "$OUT/umk3_kz.apk"
jarsigner -keystore "$OUT/kz.keystore" -storepass umk3kzpass -sigalg SHA256withRSA -digestalg SHA-256 "$OUT/umk3_kz.apk" umk3kz >/dev/null
echo "done: $OUT/umk3_kz.apk  $OUT/umk3_kz.sfc"
