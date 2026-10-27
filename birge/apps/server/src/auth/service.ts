import { randomUUID } from 'node:crypto';
import {
  DEFAULT_LOCALE,
  DISPLAY_NAME_MAX_LENGTH,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  isLocale,
  normalizeEmail,
  normalizePhone,
  type AuthProvider,
  type Locale,
  type Me,
  type OtpChannel,
} from '@birge/shared';
import type { Config } from '../config';
import type { Db, Queryable } from '../db';
import { hmac, randomDigits, randomToken, safeEqual, sha256 } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { RateLimiter } from '../lib/rate-limit';
import type { Notifier } from '../notify';

const SESSION_TTL_DAYS = 180;
const LOGIN_CODE_TTL_SECONDS = 120;

export interface UserRow {
  id: string;
  display_name: string;
  locale: string;
  terms_accepted_at: Date | null;
  is_moderator: boolean;
  banned_at: Date | null;
  created_at: Date;
}

export interface IdentityInput {
  provider: AuthProvider;
  subject: string;
  /** Тек провайдер растаған пошта. */
  email?: string | null;
  displayName?: string | null;
  locale?: Locale;
}

export interface LoginResult {
  userId: string;
  isNew: boolean;
}

export function sanitizeDisplayName(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export class AuthService {
  private readonly ipLimiter = new RateLimiter(30, 60 * 60 * 1000);

  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly notifier: Notifier,
  ) {}

  // ---------- Сессиялар ----------

  async createSession(userId: string, userAgent?: string): Promise<string> {
    const token = `bg_${randomToken(32)}`;
    await this.db.query(
      `INSERT INTO sessions (token_hash, user_id, user_agent, expires_at)
       VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)`,
      [sha256(token), userId, userAgent?.slice(0, 300) ?? null, String(SESSION_TTL_DAYS)],
    );
    return token;
  }

  async authenticate(token: string | undefined | null): Promise<UserRow | null> {
    if (!token || !token.startsWith('bg_') || token.length > 200) return null;
    const { rows } = await this.db.query<UserRow>(
      `UPDATE sessions s SET last_used_at = now()
       FROM users u
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id AND u.banned_at IS NULL
       RETURNING u.*`,
      [sha256(token)],
    );
    return rows[0] ?? null;
  }

  async revokeSession(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  // ---------- Қолданушылар ----------

  async getUser(userId: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0] ?? null;
  }

  async getMe(userId: string): Promise<Me> {
    const user = await this.getUser(userId);
    if (!user) throw new AppError('unauthorized');
    const { rows } = await this.db.query<{ provider: AuthProvider; subject: string; email: string | null }>(
      'SELECT provider, subject, email FROM identities WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
    const email = rows.find((r) => r.provider === 'email')?.subject ?? rows.find((r) => r.email)?.email ?? null;
    return {
      id: user.id,
      displayName: user.display_name,
      locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
      termsAccepted: user.terms_accepted_at !== null,
      isModerator: user.is_moderator,
      providers: [...new Set(rows.map((r) => r.provider))],
      email,
      phone: rows.find((r) => r.provider === 'phone')?.subject ?? null,
      createdAt: user.created_at.getTime(),
    };
  }

  async updateProfile(userId: string, patch: { displayName?: string; locale?: Locale; acceptTerms?: boolean }): Promise<Me> {
    if (patch.displayName !== undefined) {
      const name = sanitizeDisplayName(patch.displayName);
      if (name.length < 2) throw new AppError('invalid_input');
      await this.db.query('UPDATE users SET display_name = $2 WHERE id = $1', [userId, name]);
    }
    if (patch.locale !== undefined) {
      await this.db.query('UPDATE users SET locale = $2 WHERE id = $1', [userId, patch.locale]);
    }
    if (patch.acceptTerms) {
      await this.db.query('UPDATE users SET terms_accepted_at = COALESCE(terms_accepted_at, now()) WHERE id = $1', [userId]);
    }
    return this.getMe(userId);
  }

  /**
   * Сәйкестікке (провайдер + subject) қолданушыны табады немесе жасайды.
   * Google/Apple растаған пошта бұрын пошта арқылы тіркелген аккаунтпен сәйкес келсе — біріктіреміз.
   */
  async findOrCreateUser(identity: IdentityInput, extra?: { appleRefreshToken?: string; appleClientId?: string }): Promise<LoginResult> {
    const email = identity.email ? normalizeEmail(identity.email) : null;
    const result = await this.db.transaction(async (tx) => {
      const existing = await tx.query<{ user_id: string }>('SELECT user_id FROM identities WHERE provider = $1 AND subject = $2', [
        identity.provider,
        identity.subject,
      ]);
      let userId = existing.rows[0]?.user_id;
      let isNew = false;

      if (!userId && email) {
        const linked = await tx.query<{ user_id: string }>(
          `SELECT user_id FROM identities WHERE (provider = 'email' AND subject = $1) OR email = $1 ORDER BY created_at LIMIT 1`,
          [email],
        );
        userId = linked.rows[0]?.user_id;
      }

      if (!userId) {
        userId = randomUUID();
        isNew = true;
        await tx.query('INSERT INTO users (id, display_name, locale) VALUES ($1, $2, $3)', [
          userId,
          sanitizeDisplayName(identity.displayName ?? ''),
          identity.locale ?? DEFAULT_LOCALE,
        ]);
      }

      if (!existing.rows[0]) {
        await tx.query('INSERT INTO identities (provider, subject, user_id, email) VALUES ($1, $2, $3, $4)', [
          identity.provider,
          identity.subject,
          userId,
          email,
        ]);
      } else if (email) {
        await tx.query('UPDATE identities SET email = $3 WHERE provider = $1 AND subject = $2', [
          identity.provider,
          identity.subject,
          email,
        ]);
      }

      if (extra?.appleRefreshToken) {
        await tx.query('UPDATE identities SET apple_refresh_token = $3, apple_client_id = $4 WHERE provider = $1 AND subject = $2', [
          identity.provider,
          identity.subject,
          extra.appleRefreshToken,
          extra.appleClientId ?? null,
        ]);
      }

      if (identity.displayName) {
        await tx.query(`UPDATE users SET display_name = $2 WHERE id = $1 AND display_name = ''`, [
          userId,
          sanitizeDisplayName(identity.displayName),
        ]);
      }

      await this.syncModerator(tx, userId);
      const user = await tx.query<{ banned_at: Date | null }>('SELECT banned_at FROM users WHERE id = $1', [userId]);
      return { userId, isNew, banned: Boolean(user.rows[0]?.banned_at) };
    });
    if (result.banned) throw new AppError('account_banned');
    return { userId: result.userId, isNew: result.isNew };
  }

  private async syncModerator(tx: Queryable, userId: string): Promise<void> {
    if (this.config.moderatorEmails.size === 0) return;
    const { rows } = await tx.query<{ email: string | null; provider: string; subject: string }>(
      'SELECT email, provider, subject FROM identities WHERE user_id = $1',
      [userId],
    );
    const emails = rows.flatMap((r) => [r.email, r.provider === 'email' ? r.subject : null]).filter(Boolean) as string[];
    if (emails.some((e) => this.config.moderatorEmails.has(e))) {
      await tx.query('UPDATE users SET is_moderator = true WHERE id = $1', [userId]);
    }
  }

  // ---------- Бір реттік кодтар (пошта / телефон) ----------

  normalizeTarget(channel: OtpChannel, raw: string): string {
    const target = channel === 'email' ? normalizeEmail(raw) : normalizePhone(raw);
    if (!target) throw new AppError(channel === 'email' ? 'invalid_email' : 'invalid_phone');
    return target;
  }

  private codeHash(channel: OtpChannel, target: string, code: string): string {
    return hmac(this.config.secret, `otp:${channel}:${target}:${code}`);
  }

  async requestOtp(channel: OtpChannel, rawTarget: string, locale: Locale, ip: string): Promise<{ target: string; devCode?: string }> {
    const target = this.normalizeTarget(channel, rawTarget);
    // App Review / Google Play тексерушілеріне арналған тұрақты код.
    if (this.config.reviewLogins.has(target)) return { target };
    if (!this.notifier.canSend(channel)) throw new AppError('provider_not_configured');

    // Сәтті қолданылған кодтар қайта жіберуді кешіктірмейді.
    const { rows } = await this.db.query<{ created_at: Date; recent: string }>(
      `SELECT max(created_at) FILTER (WHERE NOT verified) AS created_at, count(*)::text AS recent FROM otp_codes
       WHERE target = $1 AND created_at > now() - interval '1 hour'`,
      [target],
    );
    const last = rows[0]?.created_at;
    if (last && Date.now() - new Date(last).getTime() < OTP_RESEND_SECONDS * 1000) throw new AppError('resend_too_soon');
    if (Number(rows[0]?.recent ?? 0) >= 5) throw new AppError('rate_limited');
    if (!this.ipLimiter.take(ip)) throw new AppError('rate_limited');

    const code = randomDigits(OTP_LENGTH);
    await this.db.query(`UPDATE otp_codes SET consumed_at = now() WHERE target = $1 AND consumed_at IS NULL`, [target]);
    await this.db.query(
      `INSERT INTO otp_codes (id, channel, target, code_hash, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' seconds')::interval)`,
      [randomUUID(), channel, target, this.codeHash(channel, target, code), ip, String(OTP_TTL_SECONDS)],
    );
    await this.notifier.sendCode(channel, target, code, locale);
    return { target, devCode: this.config.devOtp ? code : undefined };
  }

  async verifyOtp(channel: OtpChannel, rawTarget: string, code: string, locale: Locale): Promise<LoginResult> {
    const target = this.normalizeTarget(channel, rawTarget);
    const cleanCode = code.replace(/\D/g, '');
    const login = () => this.findOrCreateUser({ provider: channel, subject: target, email: channel === 'email' ? target : null, locale });

    const reviewCode = this.config.reviewLogins.get(target);
    if (reviewCode) {
      if (!safeEqual(reviewCode, cleanCode)) throw new AppError('code_invalid');
      return login();
    }

    const { rows } = await this.db.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM otp_codes
       WHERE target = $1 AND channel = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [target, channel],
    );
    const row = rows[0];
    if (!row) throw new AppError('code_expired');
    if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AppError('too_many_attempts');
    if (!safeEqual(row.code_hash, this.codeHash(channel, target, cleanCode))) {
      await this.db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      throw new AppError(row.attempts + 1 >= OTP_MAX_ATTEMPTS ? 'too_many_attempts' : 'code_invalid');
    }
    const consumed = await this.db.query(
      'UPDATE otp_codes SET consumed_at = now(), verified = true WHERE id = $1 AND consumed_at IS NULL RETURNING id',
      [row.id],
    );
    if (consumed.rows.length === 0) throw new AppError('code_expired');
    return login();
  }

  // ---------- OAuth-тан қосымшаға қауіпсіз өту коды ----------

  async createLoginCode(result: LoginResult): Promise<string> {
    const code = randomToken(24);
    await this.db.query(
      `INSERT INTO login_codes (code_hash, user_id, is_new, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)`,
      [sha256(code), result.userId, result.isNew, String(LOGIN_CODE_TTL_SECONDS)],
    );
    return code;
  }

  async exchangeLoginCode(code: string): Promise<LoginResult> {
    const { rows } = await this.db.query<{ user_id: string; is_new: boolean }>(
      'DELETE FROM login_codes WHERE code_hash = $1 AND expires_at > now() RETURNING user_id, is_new',
      [sha256(code)],
    );
    const row = rows[0];
    if (!row) throw new AppError('code_expired');
    return { userId: row.user_id, isNew: row.is_new };
  }

  async getAppleTokens(userId: string): Promise<{ refreshToken: string; clientId: string | null }[]> {
    const { rows } = await this.db.query<{ apple_refresh_token: string; apple_client_id: string | null }>(
      `SELECT apple_refresh_token, apple_client_id FROM identities
       WHERE user_id = $1 AND provider = 'apple' AND apple_refresh_token IS NOT NULL`,
      [userId],
    );
    return rows.map((r) => ({ refreshToken: r.apple_refresh_token, clientId: r.apple_client_id }));
  }

  async cleanupExpired(): Promise<void> {
    await this.db.query(`DELETE FROM otp_codes WHERE created_at < now() - interval '1 day'`);
    await this.db.query('DELETE FROM login_codes WHERE expires_at < now()');
    await this.db.query('DELETE FROM sessions WHERE expires_at < now()');
  }
}
