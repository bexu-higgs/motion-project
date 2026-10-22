#!/usr/bin/env bash
# «Отты Арал» ойынының Android APK файлын толық Android SDK-сыз құрастыру.
# Қажет: JDK 17+, Node 18+, Python 3 + Pillow, интернет (тек алғашқы рет құралдарды жүктеу үшін).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/.tools"
BUILD="$ROOT/build"
OUT="$ROOT/release/OttyAral.apk"
MAVEN="${MAVEN_MIRROR:-https://maven-central.storage-download.googleapis.com/maven2}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"

mkdir -p "$TOOLS" "$BUILD"

fetch() { # <maven path> <file>
  if [ ! -s "$TOOLS/$2" ]; then
    echo "жүктелуде: $2"
    curl -fsSL -o "$TOOLS/$2.part" "$MAVEN/$1" && mv "$TOOLS/$2.part" "$TOOLS/$2"
  fi
}

fetch org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar apktool-lib.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar android-all.jar

if [ ! -x "$TOOLS/aapt2" ]; then
  (cd "$TOOLS" && unzip -o -q -j apktool-lib.jar prebuilt/linux/aapt2 prebuilt/android-framework.jar && chmod +x aapt2)
fi
AAPT2="$TOOLS/aapt2"
FRAMEWORK="$TOOLS/android-framework.jar"

# 1) Веб-ойынды жинау
echo "== ойын коды жиналуда"
(cd "$ROOT/game" && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npm run build)

# 2) Ресурстар
echo "== ресурстар"
rm -rf "$BUILD"/{res,compiled,assets,classes,gen} "$BUILD"/*.apk "$BUILD"/*.dex
mkdir -p "$BUILD"/{res,compiled,assets/game,classes,gen}
cp -r "$ROOT/android/res/." "$BUILD/res/"
python3 "$ROOT/tools/make_icon.py" "$BUILD/res" "$ROOT/release/icon.png"
cp -r "$ROOT/game/dist/." "$BUILD/assets/game/"

"$AAPT2" compile --dir "$BUILD/res" -o "$BUILD/compiled/res.zip"
"$AAPT2" link -o "$BUILD/base.apk" \
  -I "$FRAMEWORK" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$BUILD/gen" \
  -A "$BUILD/assets" \
  "$BUILD/compiled/res.zip"

# 3) Java -> DEX
echo "== java"
find "$ROOT/android/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 \
  -classpath "$TOOLS/android-all.jar" -d "$BUILD/classes" @"$BUILD/sources.txt"
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 \
  --output="$BUILD/classes.dex" "$BUILD/classes"

# 4) Буып-түю және қолтаңба
echo "== буып-түю"
python3 "$ROOT/tools/package_apk.py" "$BUILD/base.apk" "$BUILD/classes.dex" "$BUILD/unsigned.apk"

KEYSTORE="${KEYSTORE:-$ROOT/tools/otty-release.p12}"
KEYPASS="${KEYPASS:-ottyaral}"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -storepass "$KEYPASS" -keypass "$KEYPASS" \
    -alias otty -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Otty Aral, OU=Games, O=Otty Aral, L=Almaty, C=KZ" >/dev/null 2>&1
fi
mkdir -p "$BUILD/signer"
javac -nowarn -d "$BUILD/signer" -cp "$TOOLS/apksig.jar" "$ROOT/tools/ApkSign.java"
mkdir -p "$(dirname "$OUT")"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$BUILD/signer:$TOOLS/apksig.jar" ApkSign "$KEYSTORE" "$KEYPASS" otty "$BUILD/unsigned.apk" "$OUT"
ls -la "$OUT"
