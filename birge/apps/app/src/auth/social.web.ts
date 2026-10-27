import type { AuthResult, Locale } from '@birge/shared';
import { apiBaseUrl } from '@/lib/api';

export type OAuthProvider = 'google' | 'apple';

export function isNativeOAuthPending(): boolean {
  return false;
}

export async function isNativeAppleAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithAppleNative(): Promise<AuthResult | null> {
  return null;
}

/** Вебте бүкіл бетпен провайдерге өтеміз; ол /auth/callback?code=… бетіне қайтарады. */
export async function signInWithOAuth(provider: OAuthProvider, locale: Locale): Promise<AuthResult | null> {
  const redirect = `${window.location.origin}/auth/callback`;
  window.location.assign(`${apiBaseUrl()}/api/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirect)}&locale=${locale}`);
  // Бет ауысады — промис ешқашан аяқталмайды.
  return new Promise<AuthResult | null>(() => undefined);
}
