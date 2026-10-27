import type { FastifyReply, FastifyRequest } from 'fastify';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@birge/shared';
import type { UserRow } from './auth/service';
import { AppError } from './lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
    token: string | null;
  }
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export function requireUser(request: FastifyRequest): UserRow {
  if (!request.user) throw new AppError('unauthorized');
  return request.user;
}

/** Бөлме жасау/кіру үшін: шарттар қабылданып, аты жазылған болуы керек. */
export function requireActiveUser(request: FastifyRequest): UserRow {
  const user = requireUser(request);
  if (!user.terms_accepted_at || !user.display_name) throw new AppError('terms_required');
  return user;
}

export function requireModerator(request: FastifyRequest): UserRow {
  const user = requireUser(request);
  if (!user.is_moderator) throw new AppError('forbidden');
  return user;
}

export function requestLocale(request: FastifyRequest, fallback?: unknown): Locale {
  if (isLocale(fallback)) return fallback;
  const header = request.headers['accept-language'];
  if (typeof header === 'string' && header.toLowerCase().startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function noContent(reply: FastifyReply) {
  return reply.code(204).send();
}
