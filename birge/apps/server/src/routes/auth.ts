import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SUPPORTED_LOCALES, type AuthResult } from '@birge/shared';
import type { Services } from '../services';
import { noContent, requestLocale } from '../http';

const OtpRequest = z.object({
  channel: z.enum(['email', 'phone']),
  target: z.string().max(320),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});
const OtpVerify = OtpRequest.extend({ code: z.string().max(20) });
const Exchange = z.object({ code: z.string().min(10).max(200) });
const AppleNative = z.object({
  identityToken: z.string().max(10_000),
  authorizationCode: z.string().max(2_000).optional(),
  fullName: z.string().max(200).nullable().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});
const Provider = z.object({ provider: z.enum(['google', 'apple']) });
const StartQuery = z.object({ redirect: z.string().max(2000), locale: z.enum(SUPPORTED_LOCALES).optional() });

export function authRoutes(app: FastifyInstance, s: Services) {
  const issue = async (userId: string, isNew: boolean, userAgent?: string): Promise<AuthResult> => {
    const token = await s.auth.createSession(userId, userAgent);
    return { token, user: await s.auth.getMe(userId), isNew };
  };

  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/api/auth/otp/request', strict, async (request) => {
    const body = OtpRequest.parse(request.body);
    const result = await s.auth.requestOtp(body.channel, body.target, requestLocale(request, body.locale), request.ip);
    return { ok: true, target: result.target, devCode: result.devCode };
  });

  app.post('/api/auth/otp/verify', strict, async (request) => {
    const body = OtpVerify.parse(request.body);
    const result = await s.auth.verifyOtp(body.channel, body.target, body.code, requestLocale(request, body.locale));
    return issue(result.userId, result.isNew, request.headers['user-agent']);
  });

  app.post('/api/auth/exchange', strict, async (request) => {
    const body = Exchange.parse(request.body);
    const result = await s.auth.exchangeLoginCode(body.code);
    return issue(result.userId, result.isNew, request.headers['user-agent']);
  });

  app.post('/api/auth/apple/native', strict, async (request) => {
    const body = AppleNative.parse(request.body);
    const result = await s.oauth.appleNative({ ...body, locale: requestLocale(request, body.locale) });
    return issue(result.userId, result.isNew, request.headers['user-agent']);
  });

  // Веб және Android: жүйелік браузерде провайдердің бетіне бағыттаймыз.
  app.get('/api/auth/oauth/:provider/start', async (request, reply) => {
    const { provider } = Provider.parse(request.params);
    const query = StartQuery.parse(request.query);
    return reply.redirect(await s.oauth.startUrl(provider, query.redirect, requestLocale(request, query.locale)));
  });

  // Google — GET, Apple — POST (response_mode=form_post).
  const callback = async (
    request: { params: unknown; query: unknown; body: unknown },
    reply: { redirect: (url: string, code?: number) => unknown },
  ) => {
    const { provider } = Provider.parse(request.params);
    const params = { ...(request.query as Record<string, string>), ...((request.body as Record<string, string>) ?? {}) };
    return reply.redirect(await s.oauth.handleCallback(provider, params), 303);
  };
  app.get('/api/auth/oauth/:provider/callback', callback);
  app.post('/api/auth/oauth/:provider/callback', callback);

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.token) await s.auth.revokeSession(request.token);
    return noContent(reply);
  });
}
