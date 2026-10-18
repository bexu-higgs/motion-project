FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY mafia_bot ./mafia_bot
RUN pip install --no-cache-dir .

RUN useradd --create-home bot
USER bot

CMD ["python", "-m", "mafia_bot"]
