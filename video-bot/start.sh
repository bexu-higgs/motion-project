#!/usr/bin/env bash
# Видео ботын іске қосу (Linux / macOS)
cd "$(dirname "$0")" || exit 1
exec .venv/bin/python -m videobot "$@"
