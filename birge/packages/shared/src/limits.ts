/** Бір бөлмеге (серверге) кіре алатын адам саны: кемінде 2, ең көбі 50. */
export const ROOM_MIN_CAPACITY = 2;
export const ROOM_MAX_CAPACITY = 50;

export const ROOM_NAME_MAX_LENGTH = 60;
export const ROOM_CODE_LENGTH = 6;
/** Шатастыруға болатын таңбаларсыз (0/O, 1/I) әліпби. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const DISPLAY_NAME_MAX_LENGTH = 40;
export const CHAT_MAX_LENGTH = 1000;
export const CHAT_HISTORY_LIMIT = 100;
export const QUEUE_MAX_ITEMS = 100;
export const MEDIA_TITLE_MAX_LENGTH = 200;
export const MEDIA_URL_MAX_LENGTH = 2048;
export const REPORT_DETAILS_MAX_LENGTH = 1000;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

/** Қолданушының ең төменгі жасы (Пайдалану шарттарында көрсетілген). */
export const MIN_AGE = 16;

/** Қосымшада тек екі тіл бар: қазақша және ағылшынша. */
export const SUPPORTED_LOCALES = ['kk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'kk';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function clampCapacity(value: number): number {
  if (!Number.isFinite(value)) return ROOM_MAX_CAPACITY;
  return Math.min(ROOM_MAX_CAPACITY, Math.max(ROOM_MIN_CAPACITY, Math.round(value)));
}
