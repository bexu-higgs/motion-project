"""Баптаулар: .env файлы (API кілті, модель), жұмыс қалтасы."""

from __future__ import annotations

import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent  # montazhshy/ (репо ішіндегі қалта)
ENV_PATHS = [APP_DIR / ".env", Path.home() / ".montazhshy.env"]
DEFAULT_WORKSPACE = Path.home() / "Montazhshy"


def load_env() -> None:
    """Қарапайым .env оқу (KEY=VALUE). Жүйедегі айнымалылар басым."""
    for p in ENV_PATHS:
        if not p.exists():
            continue
        for line in p.read_text("utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def save_env(values: dict[str, str]) -> Path:
    """Мәндерді APP_DIR/.env файлына жазу (бар жолдарды жаңартады)."""
    path = ENV_PATHS[0]
    lines: list[str] = []
    seen: set[str] = set()
    if path.exists():
        for line in path.read_text("utf-8").splitlines():
            k = line.split("=", 1)[0].strip()
            if k in values:
                lines.append(f"{k}={values[k]}")
                seen.add(k)
            else:
                lines.append(line)
    for k, v in values.items():
        if k not in seen:
            lines.append(f"{k}={v}")
    path.write_text("\n".join(lines) + "\n", "utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    for k, v in values.items():
        os.environ[k] = v
    return path


def workspace() -> Path:
    return Path(os.environ.get("MONTAZH_WORKSPACE") or DEFAULT_WORKSPACE).expanduser()
