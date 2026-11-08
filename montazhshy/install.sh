#!/usr/bin/env bash
# Монтажшыны бір командамен орнату (Linux / macOS):
#   curl -fsSL https://raw.githubusercontent.com/bexu-higgs/motion-project/main/montazhshy/install.sh | bash
# Қайта іске қоссаңыз — код жаңартылады, .env (API кілті) сақталады.
set -euo pipefail

REPO="bexu-higgs/motion-project"
BRANCH="${MONTAZH_BRANCH:-main}"
DIR="${MONTAZH_DIR:-$HOME/montazhshy}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n❌ %s\n' "$*" >&2; exit 1; }

say "🎬 Монтажшыны орнату → $DIR"

PY=""
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 &&
        "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
        PY="$candidate"
        break
    fi
done
[ -n "$PY" ] || fail "Python 3.10 не одан жаңасы табылмады.
   Ubuntu/Debian: sudo apt install python3 python3-venv
   macOS:         brew install python"
command -v curl >/dev/null 2>&1 || fail "curl табылмады. Ubuntu/Debian: sudo apt install curl"
if ! command -v ffmpeg >/dev/null 2>&1; then
    printf '\n⚠️  FFmpeg табылмады — монтаж үшін міндетті.\n   Ubuntu/Debian: sudo apt install ffmpeg\n   macOS:         brew install ffmpeg\n'
fi

say "1/3 Код жүктелуде…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP"
SRC="$(find "$TMP" -maxdepth 2 -type d -name montazhshy | head -n 1)"
[ -n "$SRC" ] || fail "Жүктелген архивтен montazhshy қалтасы табылмады."
mkdir -p "$DIR"
cp -R "$SRC/." "$DIR/"
chmod +x "$DIR/start.sh" "$DIR/install.sh"

say "2/3 Python кітапханалары орнатылуда…"
if [ ! -x "$DIR/.venv/bin/python" ]; then
    "$PY" -m venv "$DIR/.venv" || fail "venv жасалмады. Ubuntu/Debian: sudo apt install python3-venv"
fi
"$DIR/.venv/bin/python" -m pip install --quiet --upgrade pip
"$DIR/.venv/bin/python" -m pip install --quiet -r "$DIR/requirements.txt"

if [ "${MONTAZH_SKIP_SETUP:-0}" = "1" ]; then
    say "✅ Орнатылды. Баптау: cd $DIR && ./start.sh setup"
    exit 0
fi

say "3/3 Баптау"
cd "$DIR"
# curl | bash кезінде stdin — скрипттің өзі, сондықтан сұрақтарға пернетақтадан жауап аламыз.
exec "$DIR/.venv/bin/python" -m montazhshy setup < /dev/tty
