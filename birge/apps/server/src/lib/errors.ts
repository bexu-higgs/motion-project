import type { ErrorCode } from '@birge/shared';

const STATUS: Partial<Record<ErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403,
  account_banned: 403,
  room_banned: 403,
  cannot_moderate_owner: 403,
  terms_required: 403,
  not_found: 404,
  room_not_joined: 403,
  rate_limited: 429,
  resend_too_soon: 429,
  too_many_attempts: 429,
  upload_too_large: 413,
  room_full: 409,
  queue_full: 409,
  provider_not_configured: 501,
  voice_unavailable: 503,
  server_error: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    status?: number,
  ) {
    super(code);
    this.status = status ?? STATUS[code] ?? 400;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
