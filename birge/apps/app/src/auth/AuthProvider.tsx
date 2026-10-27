import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResult, Locale, Me, PublicConfig } from '@birge/shared';
import { useI18n } from '@/i18n';
import { ApiError, api, setApiToken, setUnauthorizedHandler } from '@/lib/api';
import { secure } from '@/lib/storage';

const TOKEN_KEY = 'birge.session';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'offline';

interface AuthValue {
  status: AuthStatus;
  me: Me | null;
  config: PublicConfig | null;
  /** Профиль толтырылып, шарттар қабылданды ма. */
  onboarded: boolean;
  completeSignIn(result: AuthResult): Promise<void>;
  signOut(): Promise<void>;
  updateMe(patch: { displayName?: string; locale?: Locale; acceptTerms?: boolean }): Promise<Me>;
  deleteAccount(): Promise<void>;
  retry(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clearSession = useCallback(async () => {
    setApiToken(null);
    await secure.remove(TOKEN_KEY);
    setMe(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Іске қосылғанда: сақталған сессияны тексереміз.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      api
        .get<PublicConfig>('/api/config')
        .then((c) => !cancelled && setConfig(c))
        .catch(() => undefined);
      const token = await secure.get(TOKEN_KEY);
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setApiToken(token);
      try {
        const profile = await api.get<Me>('/api/me');
        if (cancelled) return;
        setMe(profile);
        setStatus('signedIn');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) await clearSession();
        else setStatus('offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, clearSession]);

  // Қосымша тілі өзгерсе — серверге де хабарлаймыз (хаттар мен SMS сол тілде келеді).
  useEffect(() => {
    if (status !== 'signedIn' || !me || me.locale === locale) return;
    api
      .patch<Me>('/api/me', { locale })
      .then(setMe)
      .catch(() => undefined);
  }, [locale, me, status]);

  const completeSignIn = useCallback(async (result: AuthResult) => {
    await secure.set(TOKEN_KEY, result.token);
    setApiToken(result.token);
    setMe(result.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // желі болмаса да жергілікті сессияны өшіреміз
    }
    await clearSession();
  }, [clearSession]);

  const updateMe = useCallback(async (patch: { displayName?: string; locale?: Locale; acceptTerms?: boolean }) => {
    const updated = await api.patch<Me>('/api/me', patch);
    setMe(updated);
    return updated;
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.delete('/api/me');
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      config,
      onboarded: Boolean(me && me.termsAccepted && me.displayName),
      completeSignIn,
      signOut,
      updateMe,
      deleteAccount,
      retry: () => {
        setStatus('loading');
        setAttempt((a) => a + 1);
      },
    }),
    [status, me, config, completeSignIn, signOut, updateMe, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Кірмей тұрып ашылған сілтеме (мыс. /join/ABC123) — кіргеннен кейін соған ораламыз. */
let pendingHref: string | null = null;
export function setPendingHref(href: string | null): void {
  pendingHref = href;
}
export function takePendingHref(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}
