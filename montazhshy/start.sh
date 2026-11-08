#!/usr/bin/env bash
# Монтажшыны іске қосу (Linux / macOS). Аргументсіз — Студия ашылады.
#   ./start.sh                       → браузердегі Студия
#   ./start.sh agent ~/kadrlar "…"   → терминалда ЖИ агенті
#   ./start.sh auto ~/kadrlar --final
cd "$(dirname "$0")" || exit 1
exec .venv/bin/python -m montazhshy "$@"
