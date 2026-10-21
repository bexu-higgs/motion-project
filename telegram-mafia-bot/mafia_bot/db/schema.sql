-- Telegram Mafia Bot — PostgreSQL сұлбасы. Қайта іске қосуға қауіпсіз (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
    user_id          BIGINT PRIMARY KEY,
    username         TEXT,
    full_name        TEXT NOT NULL DEFAULT '',
    registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenge            BIGINT NOT NULL DEFAULT 0 CHECK (tenge >= 0),
    diamonds         BIGINT NOT NULL DEFAULT 0 CHECK (diamonds >= 0),
    shields          INT NOT NULL DEFAULT 0 CHECK (shields >= 0),
    fake_docs        INT NOT NULL DEFAULT 0 CHECK (fake_docs >= 0),
    vote_shields     INT NOT NULL DEFAULT 0 CHECK (vote_shields >= 0),
    piercing_bullets INT NOT NULL DEFAULT 0 CHECK (piercing_bullets >= 0),
    games_played     INT NOT NULL DEFAULT 0,
    wins             INT NOT NULL DEFAULT 0,
    losses           INT NOT NULL DEFAULT 0,
    daily_streak     INT NOT NULL DEFAULT 0,
    last_daily_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chats (
    chat_id     BIGINT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Әр ойынның бірегей ID-і бар: сыйақы бір ойын үшін тек бір рет есептеледі.
CREATE TABLE IF NOT EXISTS games (
    game_id       BIGSERIAL PRIMARY KEY,
    chat_id       BIGINT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'lobby'
                  CHECK (status IN ('lobby', 'running', 'finished', 'aborted')),
    players_count INT NOT NULL DEFAULT 0,
    winner        TEXT,
    days          INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS games_status_idx ON games (status);

CREATE TABLE IF NOT EXISTS game_players (
    game_id     BIGINT NOT NULL REFERENCES games (game_id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users (user_id),
    role        TEXT NOT NULL,
    final_role  TEXT,
    alive       BOOLEAN NOT NULL DEFAULT TRUE,
    won         BOOLEAN,
    reward      INT NOT NULL DEFAULT 0,
    deserted    BOOLEAN NOT NULL DEFAULT FALSE,
    restricted  BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS game_players_user_idx ON game_players (user_id);

-- Алмазға сатып алынған рөлдер кезегі.
CREATE TABLE IF NOT EXISTS role_purchases (
    purchase_id BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (user_id),
    role        TEXT NOT NULL,
    price       INT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'used', 'refunded')),
    game_id     BIGINT REFERENCES games (game_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS role_purchases_queue_idx ON role_purchases (user_id, status, purchase_id);

-- Әр төлемнің бірегей Telegram идентификаторы: бір төлемге алмаз екі рет берілмейді.
CREATE TABLE IF NOT EXISTS payments (
    payment_id                 BIGSERIAL PRIMARY KEY,
    telegram_payment_charge_id TEXT NOT NULL UNIQUE,
    provider_payment_charge_id TEXT,
    user_id                    BIGINT NOT NULL REFERENCES users (user_id),
    package_id                 TEXT NOT NULL,
    diamonds                   INT NOT NULL,
    currency                   TEXT NOT NULL,
    total_amount               INT NOT NULL,
    status                     TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    refunded_at                TIMESTAMPTZ
);

-- Барлық валюта қозғалысының журналы.
CREATE TABLE IF NOT EXISTS ledger (
    entry_id   BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (user_id),
    currency   TEXT NOT NULL CHECK (currency IN ('tenge', 'diamonds')),
    delta      BIGINT NOT NULL,
    reason     TEXT NOT NULL,
    ref        TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_unique_ref ON ledger (user_id, reason, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger (user_id, created_at);

-- v2: чат баптаулары (/settingsmafia) және пайдаланушы тілі.
ALTER TABLE chats ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'kk';
ALTER TABLE chats ADD COLUMN IF NOT EXISTS registration_seconds INT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'all';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'kk';

-- v3: /give командасында @username бойынша іздеу.
CREATE INDEX IF NOT EXISTS users_username_idx ON users (lower(username));

-- v4: 🎁 алмаз тарату (/give N топта): алғашқы N адам 1 💎-ден алады.
CREATE TABLE IF NOT EXISTS giveaways (
    giveaway_id BIGSERIAL PRIMARY KEY,
    chat_id     BIGINT NOT NULL,
    message_id  BIGINT,
    giver_id    BIGINT NOT NULL REFERENCES users (user_id),
    total       INT NOT NULL CHECK (total > 0),
    remaining   INT NOT NULL CHECK (remaining >= 0),
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS giveaways_open_idx ON giveaways (status, created_at);
-- v5: 'cancelled' — /reloaddm барлық алмазды нөлдегенде ашық таратулар жабылады.
ALTER TABLE giveaways DROP CONSTRAINT IF EXISTS giveaways_status_check;
ALTER TABLE giveaways ADD CONSTRAINT giveaways_status_check
    CHECK (status IN ('open', 'done', 'expired', 'cancelled'));

CREATE TABLE IF NOT EXISTS giveaway_claims (
    giveaway_id BIGINT NOT NULL REFERENCES giveaways (giveaway_id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users (user_id),
    claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (giveaway_id, user_id)
);

-- v6: бот бойынша баптаулар (мысалы, /sleeplesson, /sleeplessoff — Балым жалеп рөлі қосулы ма).
CREATE TABLE IF NOT EXISTS bot_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
