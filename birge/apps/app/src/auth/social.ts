import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { AuthResult, Locale } from '@birge/shared';
import { ApiError, api, apiBaseUrl } from '@/lib/api';

export type OAuthProvider = 'google' | 'apple';

let nativeOAuthPending = false;
/** OAuth жүріп жатқанда /auth/callback экраны кодты өзі айырбастамауы керек. */
export function isNativeOAuthPending(): boolean {
  return nativeOAuthPending;
}

/** iOS-та Apple-дың нативті терезесі қолжетімді ме. */
export async function isNativeAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** iOS: Sign in with Apple (нативті). Қолданушы бас тартса — null. */
export async function signInWithAppleNative(locale: Locale): Promise<AuthResult | null> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw new ApiError('oauth_failed');
  }
  if (!credential.identityToken) throw new ApiError('oauth_failed');
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || null;
  return api.post<AuthResult>('/api/auth/apple/native', {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode ?? undefined,
    fullName,
    locale,
  });
}

/**
 * Google (және Android-та Apple): жүйелік браузерде (ASWebAuthenticationSession / Custom Tabs)
 * сервердің OAuth бетін ашамыз, соңында қосымшаға бір реттік код оралады.
 */
export async function signInWithOAuth(provider: OAuthProvider, locale: Locale): Promise<AuthResult | null> {
  const redirect = Linking.createURL('auth/callback');
  const url = `${apiBaseUrl()}/api/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirect)}&locale=${locale}`;
  nativeOAuthPending = true;
  try {
    const result = await WebBrowser.openAuthSessionAsync(url, redirect);
    if (result.type !== 'success') return null;
    const { queryParams } = Linking.parse(result.url);
    const error = typeof queryParams?.error === 'string' ? queryParams.error : null;
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (error || !code) throw new ApiError(error === 'account_banned' ? 'account_banned' : 'oauth_failed');
    return await api.post<AuthResult>('/api/auth/exchange', { code });
  } finally {
    nativeOAuthPending = false;
  }
}
