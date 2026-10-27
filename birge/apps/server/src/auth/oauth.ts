import { createHash, createSecretKey } from 'node:crypto';
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { Locale } from '@birge/shared';
import type { Config } from '../config';
import { decrypt, encrypt, randomToken } from '../lib/crypto';
import { AppError } from '../lib/errors';
import type { Logger } from '../notify';
import type { AuthService, LoginResult } from './service';

export type OAuthProvider = 'google' | 'apple';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

export interface OAuthDeps {
  fetch?: typeof fetch;
  googleJwks?: JWTVerifyGetKey;
  appleJwks?: JWTVerifyGetKey;
}

interface StatePayload {
  provider: OAuthProvider;
  redirect: string;
  nonce: string;
  locale: Locale;
}

function appendParams(url: string, params: Record<string, string>): string {
  const [base, hash] = url.split('#');
  const sep = base!.includes('?') ? '&' : '?';
  return `${base}${sep}${new URLSearchParams(params).toString()}${hash ? `#${hash}` : ''}`;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Google және Apple арқылы кіру.
 *  - Веб пен Android: сервер арқылы OAuth (жүйелік браузерде), соңында қосымшаға бір реттік код қайтарамыз.
 *  - iOS: Apple-дың нативті терезесі identityToken береді, оны /auth/apple/native тексереді.
 */
export class OAuthService {
  private readonly fetch: typeof fetch;
  private readonly googleJwks: JWTVerifyGetKey;
  private readonly appleJwks: JWTVerifyGetKey;
  private readonly stateKey;

  constructor(
    private readonly config: Config,
    private readonly auth: AuthService,
    private readonly log: Logger,
    deps: OAuthDeps = {},
  ) {
    this.fetch = deps.fetch ?? fetch;
    this.googleJwks = deps.googleJwks ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    this.appleJwks = deps.appleJwks ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    this.stateKey = createSecretKey(createHash('sha256').update(`oauth-state:${config.secret}`).digest());
  }

  isEnabled(provider: OAuthProvider): boolean {
    if (provider === 'google') return Boolean(this.config.google);
    return Boolean(this.config.apple);
  }

  /** Тек өзіміздің веб-қосымшаға немесе қосымшаның схемасына қайтаруға рұқсат (open redirect болмасын). */
  isAllowedRedirect(redirect: string): boolean {
    const allowed = [`${this.config.webUrl}/`, `${this.config.appScheme}://`];
    if (!this.config.isProduction)
      allowed.push('exp://', 'http://localhost:', 'http://localhost/', 'http://127.0.0.1:', 'http://127.0.0.1/');
    return allowed.some((prefix) => redirect.startsWith(prefix));
  }

  private callbackUrl(provider: OAuthProvider): string {
    return `${this.config.publicUrl}/api/auth/oauth/${provider}/callback`;
  }

  private async signState(payload: StatePayload): Promise<string> {
    return new SignJWT({ ...payload }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(this.stateKey);
  }

  private async readState(state: string, provider: OAuthProvider): Promise<StatePayload> {
    const { payload } = await jwtVerify(state, this.stateKey, { algorithms: ['HS256'] });
    const p = payload as unknown as StatePayload;
    if (p.provider !== provider || !this.isAllowedRedirect(p.redirect)) throw new Error('bad state');
    return p;
  }

  async startUrl(provider: OAuthProvider, redirect: string, locale: Locale): Promise<string> {
    if (!this.isEnabled(provider)) throw new AppError('provider_not_configured');
    if (!this.isAllowedRedirect(redirect)) throw new AppError('invalid_input');
    const nonce = randomToken(16);
    const state = await this.signState({ provider, redirect, nonce, locale });

    if (provider === 'google') {
      const google = this.config.google!;
      return `${GOOGLE_AUTH_URL}?${new URLSearchParams({
        client_id: google.clientId,
        redirect_uri: this.callbackUrl('google'),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        prompt: 'select_account',
        hl: locale,
      })}`;
    }
    const apple = this.config.apple!;
    if (!apple.servicesId) throw new AppError('provider_not_configured');
    return `${APPLE_AUTH_URL}?${new URLSearchParams({
      client_id: apple.servicesId,
      redirect_uri: this.callbackUrl('apple'),
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state,
      nonce,
    })}`;
  }

  /** Провайдерден оралғанда шақырылады; қосымшаға қайту сілтемесін қайтарады. */
  async handleCallback(provider: OAuthProvider, params: Record<string, string | undefined>): Promise<string> {
    let state: StatePayload;
    try {
      state = await this.readState(params.state ?? '', provider);
    } catch {
      return appendParams(`${this.config.webUrl}/sign-in`, { error: 'oauth_failed' });
    }
    try {
      if (params.error) throw new Error(`provider error: ${params.error}`);
      const result = provider === 'google' ? await this.completeGoogle(params, state) : await this.completeAppleWeb(params, state);
      const code = await this.auth.createLoginCode(result);
      return appendParams(state.redirect, { code });
    } catch (err) {
      const code = err instanceof AppError ? err.code : 'oauth_failed';
      if (!(err instanceof AppError)) this.log.warn({ err, provider }, 'OAuth callback failed');
      return appendParams(state.redirect, { error: code });
    }
  }

  private async completeGoogle(params: Record<string, string | undefined>, state: StatePayload): Promise<LoginResult> {
    const google = this.config.google!;
    if (!params.code) throw new Error('missing code');
    const res = await this.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: this.callbackUrl('google'),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`google token exchange ${res.status}`);
    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) throw new Error('google: no id_token');
    const { payload } = await jwtVerify(tokens.id_token, this.googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: google.clientId,
    });
    if (payload.nonce !== state.nonce) throw new Error('google: nonce mismatch');
    return this.auth.findOrCreateUser({
      provider: 'google',
      subject: String(payload.sub),
      email: isTrue(payload.email_verified) ? String(payload.email ?? '') || null : null,
      displayName: typeof payload.name === 'string' ? payload.name : null,
      locale: state.locale,
    });
  }

  private async verifyAppleToken(idToken: string, audience: string[]): Promise<JWTPayload> {
    const { payload } = await jwtVerify(idToken, this.appleJwks, { issuer: APPLE_ISSUER, audience });
    if (!payload.sub) throw new Error('apple: no sub');
    return payload;
  }

  private async completeAppleWeb(params: Record<string, string | undefined>, state: StatePayload): Promise<LoginResult> {
    const apple = this.config.apple!;
    if (!params.id_token) throw new Error('apple: missing id_token');
    const payload = await this.verifyAppleToken(params.id_token, [apple.servicesId!]);
    if (payload.nonce !== state.nonce) throw new Error('apple: nonce mismatch');
    let displayName: string | null = null;
    if (params.user) {
      try {
        const user = JSON.parse(params.user) as { name?: { firstName?: string; lastName?: string } };
        displayName = [user.name?.firstName, user.name?.lastName].filter(Boolean).join(' ') || null;
      } catch {
        // Apple «user» өрісін тек алғашқы кіруде жібереді
      }
    }
    const refreshToken = params.code ? await this.exchangeAppleCode(params.code, apple.servicesId!, this.callbackUrl('apple')) : null;
    return this.loginApple(payload, displayName, state.locale, refreshToken, apple.servicesId!);
  }

  /** iOS: expo-apple-authentication берген identityToken мен authorizationCode. */
  async appleNative(input: {
    identityToken: string;
    authorizationCode?: string;
    fullName?: string | null;
    locale: Locale;
  }): Promise<LoginResult> {
    const apple = this.config.apple;
    if (!apple?.bundleId) throw new AppError('provider_not_configured');
    let payload: JWTPayload;
    try {
      payload = await this.verifyAppleToken(input.identityToken, [apple.bundleId]);
    } catch (err) {
      this.log.warn({ err }, 'Apple identity token rejected');
      throw new AppError('oauth_failed', 401);
    }
    const refreshToken = input.authorizationCode ? await this.exchangeAppleCode(input.authorizationCode, apple.bundleId) : null;
    return this.loginApple(payload, input.fullName ?? null, input.locale, refreshToken, apple.bundleId);
  }

  private loginApple(payload: JWTPayload, displayName: string | null, locale: Locale, refreshToken: string | null, clientId: string) {
    return this.auth.findOrCreateUser(
      {
        provider: 'apple',
        subject: String(payload.sub),
        email: isTrue(payload.email_verified) && typeof payload.email === 'string' ? payload.email : null,
        displayName,
        locale,
      },
      refreshToken ? { appleRefreshToken: encrypt(this.config.secret, refreshToken), appleClientId: clientId } : undefined,
    );
  }

  private async appleClientSecret(clientId: string): Promise<string> {
    const apple = this.config.apple!;
    const key = await importPKCS8(apple.privateKey, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: apple.keyId })
      .setIssuer(apple.teamId)
      .setSubject(clientId)
      .setAudience(APPLE_ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }

  /**
   * Авторизация кодын refresh-токенге айырбастаймыз. Ол аккаунт жойылғанда
   * Apple талабы бойынша токенді қайтарып алу (revoke) үшін керек.
   */
  private async exchangeAppleCode(code: string, clientId: string, redirectUri?: string): Promise<string | null> {
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: await this.appleClientSecret(clientId),
        code,
        grant_type: 'authorization_code',
      });
      if (redirectUri) body.set('redirect_uri', redirectUri);
      const res = await this.fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`apple token exchange ${res.status}`);
      const json = (await res.json()) as { refresh_token?: string };
      return json.refresh_token ?? null;
    } catch (err) {
      this.log.warn({ err }, 'Apple code exchange failed');
      return null;
    }
  }

  /** Аккаунтты жойғанда Sign in with Apple токендерін қайтарып аламыз. */
  async revokeApple(userId: string): Promise<void> {
    if (!this.config.apple) return;
    for (const { refreshToken, clientId } of await this.auth.getAppleTokens(userId)) {
      try {
        const id = clientId ?? this.config.apple.bundleId ?? this.config.apple.servicesId!;
        const res = await this.fetch(APPLE_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: id,
            client_secret: await this.appleClientSecret(id),
            token: decrypt(this.config.secret, refreshToken),
            token_type_hint: 'refresh_token',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`apple revoke ${res.status}`);
      } catch (err) {
        this.log.warn({ err, userId }, 'Apple token revoke failed');
      }
    }
  }
}
