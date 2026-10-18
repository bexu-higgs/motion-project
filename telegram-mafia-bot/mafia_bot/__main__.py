"""Іске қосу: ``python -m mafia_bot``."""

import asyncio
import logging
import os
import sys

from .bot.app import run
from .config import Settings, StartupError


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        asyncio.run(run(Settings.from_env()))
    except StartupError as e:
        logging.getLogger("mafia_bot").error("%s", e)
        sys.exit(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
