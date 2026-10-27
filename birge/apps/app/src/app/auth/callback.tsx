import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { AuthResult } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { isNativeOAuthPending } from '@/auth/social';
import { Body, Button, ErrorBanner, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, space } from '@/theme';

/** Google/Apple-дан оралғанда: бір реттік кодты сессияға айырбастаймыз. */
export default function AuthCallbackScreen() {
  const t = useT();
  const router = useRouter();
  const { completeSignIn } = useAuth();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [failure, setFailure] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Нативте кодты signInWithOAuth өзі айырбастайды.
    if (isNativeOAuthPending()) return;
    if (error || !code) {
      setFailure(t(`errors.${error === 'account_banned' ? 'account_banned' : 'oauth_failed'}`));
      return;
    }
    api
      .post<AuthResult>('/api/auth/exchange', { code })
      .then(completeSignIn)
      .catch((err) => setFailure(t(`errors.${toErrorCode(err)}`)));
  }, [code, error, completeSignIn, t]);

  return (
    <Screen maxWidth={440} style={{ justifyContent: 'center' }}>
      {failure ? (
        <View style={{ gap: space.md }}>
          <ErrorBanner message={failure} />
          <Button title={t('common.back')} onPress={() => router.replace('/sign-in')} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Body muted>{t('auth.signingIn')}</Body>
        </View>
      )}
    </Screen>
  );
}
