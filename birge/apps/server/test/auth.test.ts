import { afterEach, describe, expect, it } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, type JWK } from 'jose';
import type { AuthResult, Me, PublicConfig } from '@birge/shared';
import { startServer, type TestServer } from './helpers';

let server: TestServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function signer(alg: 'RS256' | 'ES256', kid: string) {
  const { privateKey, publicKey } = await generateKeyPair(alg, { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg } as JWK;
  return {
    privateKey,
    jwks: createLocalJWKSet({ keys: [jwk] }),
    sign: (claims: Record<string, unknown>, iss: string, aud: string) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg, kid })
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(privateKey),
  };
}

describe('email / phone codes', () => {
  it('signs up with an email code, then logs in again as the same user', async () => {
    server = await startServer();
    const req = await server.api<{ devCode: string; target: string }>('POST', '/api/auth/otp/request', {
      body: { channel: 'email', target: ' Aru@Example.KZ ', locale: 'kk' },
    });
    expect(req.status).toBe(200);
    expect(req.body.target).toBe('aru@example.kz');
    expect(req.body.devCode).toMatch(/^\d{6}$/);

    const ver = await server.api<AuthResult>('POST', '/api/auth/otp/verify', {
      body: { channel: 'email', target: 'aru@example.kz', code: req.body.devCode },
    });
    expect(ver.status).toBe(200);
    expect(ver.body.isNew).toBe(true);
    expect(ver.body.user).toMatchObject({ email: 'aru@example.kz', providers: ['email'], termsAccepted: false, locale: 'kk' });

    // Код екінші рет жарамайды.
    const reuse = await server.api('POST', '/api/auth/otp/verify', {
      body: { channel: 'email', target: 'aru@example.kz', code: req.body.devCode },
    });
    expect(reuse.body).toEqual({ error: 'code_expired' });

    // Шарттарды қабылдамай бөлме жасауға болмайды.
    const blocked = await server.api('POST', '/api/rooms', { token: ver.body.token, body: { name: 'Кино', capacity: 10 } });
    expect(blocked.body).toEqual({ error: 'terms_required' });

    const me = await server.api<Me>('PATCH', '/api/me', {
      token: ver.body.token,
      body: { displayName: '  Ару  ', acceptTerms: true, locale: 'en' },
    });
    expect(me.body).toMatchObject({ displayName: 'Ару', termsAccepted: true, locale: 'en' });

    const again = await server.signUp('aru@example.kz', 'Ару');
    expect(again.userId).toBe(ver.body.user.id);
  });

  it('limits wrong guesses and resends', async () => {
    server = await startServer();
    const target = '+7 701 123 45 67';
    const req = await server.api<{ devCode: string; target: string }>('POST', '/api/auth/otp/request', {
      body: { channel: 'phone', target },
    });
    expect(req.body.target).toBe('+77011234567');

    const resend = await server.api('POST', '/api/auth/otp/request', { body: { channel: 'phone', target } });
    expect(resend.body).toEqual({ error: 'resend_too_soon' });

    const wrong = req.body.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      const r = await server.api('POST', '/api/auth/otp/verify', { body: { channel: 'phone', target, code: wrong } });
      expect(r.body).toEqual({ error: 'code_invalid' });
    }
    const fifth = await server.api('POST', '/api/auth/otp/verify', { body: { channel: 'phone', target, code: wrong } });
    expect(fifth.body).toEqual({ error: 'too_many_attempts' });
    const right = await server.api('POST', '/api/auth/otp/verify', { body: { channel: 'phone', target, code: req.body.devCode } });
    expect(right.body).toEqual({ error: 'too_many_attempts' });
  });

  it('validates input', async () => {
    server = await startServer();
    expect((await server.api('POST', '/api/auth/otp/request', { body: { channel: 'email', target: 'nope' } })).body).toEqual({
      error: 'invalid_email',
    });
    expect((await server.api('POST', '/api/auth/otp/request', { body: { channel: 'phone', target: '123' } })).body).toEqual({
      error: 'invalid_phone',
    });
    expect((await server.api('POST', '/api/auth/otp/request', { body: { channel: 'fax', target: '1' } })).status).toBe(400);
  });

  it('accepts the fixed App Review login without sending anything', async () => {
    const sent: string[] = [];
    server = await startServer(
      { DEV_OTP: '', REVIEW_LOGINS: 'review@birge.app:246810' },
      { notifier: { canSend: () => false, sendCode: async (_c, t) => void sent.push(t) } },
    );
    const config = await server.api<PublicConfig>('GET', '/api/config');
    expect(config.body.providers).toMatchObject({ email: true, phone: false, google: false, apple: false });
    expect((await server.api('POST', '/api/auth/otp/request', { body: { channel: 'email', target: 'review@birge.app' } })).status).toBe(
      200,
    );
    expect((await server.api('POST', '/api/auth/otp/request', { body: { channel: 'email', target: 'other@birge.app' } })).body).toEqual({
      error: 'provider_not_configured',
    });
    const ok = await server.api<AuthResult>('POST', '/api/auth/otp/verify', {
      body: { channel: 'email', target: 'review@birge.app', code: '246810' },
    });
    expect(ok.status).toBe(200);
    expect(sent).toEqual([]);
  });

  it('logs out', async () => {
    server = await startServer();
    const { token } = await server.signUp('a@b.kz', 'Asel');
    expect((await server.api('GET', '/api/me', { token })).status).toBe(200);
    expect((await server.api('POST', '/api/auth/logout', { token })).status).toBe(204);
    expect((await server.api('GET', '/api/me', { token })).status).toBe(401);
  });
});

describe('app links', () => {
  it('serves Universal Links and Android App Links files when configured', async () => {
    server = await startServer({
      APPLE_TEAM_ID: 'TEAM123',
      APPLE_KEY_ID: 'KEY',
      APPLE_PRIVATE_KEY: 'unused',
      APPLE_BUNDLE_ID: 'kz.birge.app',
      ANDROID_PACKAGE: 'kz.birge.app',
      ANDROID_CERT_SHA256: 'aa:bb, cc:dd',
    });
    const ios = await server.api<{ applinks: { details: { appIDs: string[] }[] } }>('GET', '/.well-known/apple-app-site-association');
    expect(ios.body.applinks.details[0]!.appIDs).toEqual(['TEAM123.kz.birge.app']);
    const android = await server.api<{ target: { sha256_cert_fingerprints: string[] } }[]>('GET', '/.well-known/assetlinks.json');
    expect(android.body[0]!.target.sha256_cert_fingerprints).toEqual(['AA:BB', 'CC:DD']);
  });

  it('returns 404 when not configured', async () => {
    server = await startServer();
    expect((await server.api('GET', '/.well-known/assetlinks.json')).status).toBe(404);
  });
});

describe('Google and Apple sign-in', () => {
  it('runs the Google OAuth flow and hands the app a one-time code', async () => {
    const google = await signer('RS256', 'g1');
    let nonce = '';
    const fakeFetch = (async (input: string | URL | Request) => {
      if (String(input) !== 'https://oauth2.googleapis.com/token') throw new Error(`unexpected fetch ${input}`);
      const idToken = await google.sign(
        { sub: 'google-123', email: 'aigerim@gmail.com', email_verified: true, name: 'Aigerim', nonce },
        'https://accounts.google.com',
        'google-client',
      );
      return new Response(JSON.stringify({ id_token: idToken }), { headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    server = await startServer(
      { GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'secret', WEB_URL: 'https://birge.example' },
      { oauth: { fetch: fakeFetch, googleJwks: google.jwks } },
    );

    // Бұрын пошта арқылы тіркелген — Google аккаунты соған қосылуы керек.
    const existing = await server.signUp('aigerim@gmail.com', 'Әйгерім');

    const evil = await server.api('GET', `/api/auth/oauth/google/start?redirect=${encodeURIComponent('https://evil.example/cb')}`);
    expect(evil.status).toBe(400);
    const lookalike = await server.api(
      'GET',
      `/api/auth/oauth/google/start?redirect=${encodeURIComponent('http://localhost.evil.example/cb')}`,
    );
    expect(lookalike.status).toBe(400);

    const start = await fetch(`${server.url}/api/auth/oauth/google/start?redirect=${encodeURIComponent('birge://auth/callback')}`, {
      redirect: 'manual',
    });
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get('location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe('google-client');
    nonce = location.searchParams.get('nonce')!;
    const state = location.searchParams.get('state')!;

    const cb = await fetch(`${server.url}/api/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`, {
      redirect: 'manual',
    });
    expect(cb.status).toBe(303);
    const back = new URL(cb.headers.get('location')!);
    expect(back.protocol).toBe('birge:');
    const code = back.searchParams.get('code')!;
    expect(code).toBeTruthy();

    const exchanged = await server.api<AuthResult>('POST', '/api/auth/exchange', { body: { code } });
    expect(exchanged.status).toBe(200);
    expect(exchanged.body.user.id).toBe(existing.userId);
    expect(exchanged.body.user.providers.sort()).toEqual(['email', 'google']);
    // Бір реттік код екінші рет жарамайды.
    expect((await server.api('POST', '/api/auth/exchange', { body: { code } })).body).toEqual({ error: 'code_expired' });

    // Бұзылған state → веб-қосымшаға қате.
    const bad = await fetch(`${server.url}/api/auth/oauth/google/callback?code=abc&state=forged`, { redirect: 'manual' });
    expect(bad.headers.get('location')).toBe('https://birge.example/sign-in?error=oauth_failed');
  });

  it('verifies native Apple sign-in and revokes the token when the account is deleted', async () => {
    const apple = await signer('RS256', 'a1');
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const calls: string[] = [];
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      const body = new URLSearchParams(String(init?.body));
      if (url === 'https://appleid.apple.com/auth/token') {
        expect(body.get('client_id')).toBe('kz.birge.app');
        expect(body.get('client_secret')?.split('.')).toHaveLength(3);
        return new Response(JSON.stringify({ refresh_token: 'apple-refresh' }));
      }
      if (url === 'https://appleid.apple.com/auth/revoke') {
        expect(body.get('token')).toBe('apple-refresh');
        return new Response('');
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    server = await startServer(
      {
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_KEY_ID: 'KEY123',
        APPLE_PRIVATE_KEY: await exportPKCS8(privateKey),
        APPLE_BUNDLE_ID: 'kz.birge.app',
      },
      { oauth: { fetch: fakeFetch, appleJwks: apple.jwks } },
    );

    const wrongAud = await apple.sign({ sub: 'apple-1' }, 'https://appleid.apple.com', 'other.app');
    expect((await server.api('POST', '/api/auth/apple/native', { body: { identityToken: wrongAud } })).status).toBe(401);

    const identityToken = await apple.sign(
      { sub: 'apple-1', email: 'x@privaterelay.appleid.com', email_verified: 'true' },
      'https://appleid.apple.com',
      'kz.birge.app',
    );
    const res = await server.api<AuthResult>('POST', '/api/auth/apple/native', {
      body: { identityToken, authorizationCode: 'auth-code', fullName: 'Dana Serik', locale: 'en' },
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ displayName: 'Dana Serik', providers: ['apple'], locale: 'en' });

    await server.api('PATCH', '/api/me', { token: res.body.token, body: { acceptTerms: true } });
    const room = await server.api<{ id: string }>('POST', '/api/rooms', {
      token: res.body.token,
      body: { name: 'Apple room', capacity: 5 },
    });
    expect(room.status).toBe(200);

    expect((await server.api('DELETE', '/api/me', { token: res.body.token })).status).toBe(204);
    expect(calls).toContain('https://appleid.apple.com/auth/revoke');
    expect((await server.api('GET', '/api/me', { token: res.body.token })).status).toBe(401);
    const { rows } = await server.built.services.db.query('SELECT id FROM rooms');
    expect(rows).toEqual([]);

    // Жойылғаннан кейін қайта кірсе — жаңа аккаунт.
    const again = await server.api<AuthResult>('POST', '/api/auth/apple/native', { body: { identityToken } });
    expect(again.body.isNew).toBe(true);
  });
});
