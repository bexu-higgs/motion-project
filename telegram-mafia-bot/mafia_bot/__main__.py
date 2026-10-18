"""Іске қосу: ``python -m mafia_bot``."""

import asyncio
import logging
import os

from .bot.app import run
from .config import Settings


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run(Settings.from_env()))


if __name__ == "__main__":
    main()
