#!/usr/bin/env bash
# UNO ботын іске қосу (Linux / macOS)
cd "$(dirname "$0")" || exit 1
exec .venv/bin/python -m unobot "$@"
