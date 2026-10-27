import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Поштаны салыстыруға ыңғайлы түрге келтіреді; жарамсыз болса null. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** Телефон нөмірін E.164 форматына келтіреді (+77011234567); жарамсыз болса null. */
export function normalizePhone(input: string, defaultCountry: CountryCode = 'KZ'): string | null {
  const phone = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!phone || !phone.isValid()) return null;
  return phone.number;
}

/** +77011234567 → +7 701 123 45 67 (көрсету үшін). */
export function formatPhone(e164: string): string {
  const phone = parsePhoneNumberFromString(e164);
  return phone ? phone.formatInternational() : e164;
}

/** Құпиялылық үшін: a***@mail.kz, +7 701 *** ** 67 */
export function maskContact(value: string): string {
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name!.slice(0, 1)}***@${domain}`;
  }
  return value.length > 6 ? `${value.slice(0, 5)}*****${value.slice(-2)}` : value;
}
