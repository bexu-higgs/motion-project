import { DarkTheme, Stack, ThemeProvider, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, setPendingHref, takePendingHref, useAuth } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/Toast';
import { Body, Button, H2 } from '@/components/ui';
import { I18nProvider, useI18n } from '@/i18n';
import { colors, space } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

/** Кірмей-ақ ашуға болатын беттер. */
const PUBLIC_ROUTES = new Set(['sign-in', 'auth', 'terms', 'privacy', 'delete-account']);
const LEGAL_ROUTES = new Set(['terms', 'privacy', 'delete-account']);

function AuthGate() {
  const { status, onboarded } = useAuth();
  const { ready, t } = useI18n();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const first = (segments[0] as string | undefined) ?? '';
  const loading = status === 'loading' || !ready;

  useEffect(() => {
    if (loading || status === 'offline') return;
    if (status === 'signedOut' && !PUBLIC_ROUTES.has(first)) {
      if (pathname && pathname !== '/') setPendingHref(pathname);
      router.replace('/sign-in');
    } else if (status === 'signedIn' && !onboarded && first !== 'onboarding' && !LEGAL_ROUTES.has(first)) {
      router.replace('/onboarding');
    } else if (status === 'signedIn' && onboarded && (first === 'sign-in' || first === 'onboarding' || first === 'auth')) {
      router.replace((takePendingHref() ?? '/') as Href);
    }
  }, [loading, status, onboarded, first, pathname, router]);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Birge' }} />
        <Stack.Screen name="sign-in/index" options={{ headerShown: false, title: 'Birge' }} />
        <Stack.Screen name="sign-in/[channel]" options={{ title: '' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, title: t('onboarding.title') }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false, title: 'Birge' }} />
        <Stack.Screen name="rooms/new" options={{ title: t('createRoom.title'), presentation: 'modal' }} />
        <Stack.Screen name="room/[id]" options={{ headerShown: false, title: 'Birge' }} />
        <Stack.Screen name="join/[code]" options={{ title: t('join.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="moderation" options={{ title: t('moderation.title') }} />
        <Stack.Screen name="terms" options={{ title: t('settings.terms') }} />
        <Stack.Screen name="privacy" options={{ title: t('settings.privacy') }} />
        <Stack.Screen name="delete-account" options={{ title: t('deleteAccount.title') }} />
      </Stack>
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
      {status === 'offline' ? <OfflineOverlay /> : null}
    </>
  );
}

function OfflineOverlay() {
  const { retry } = useAuth();
  const { t } = useI18n();
  return (
    <View style={styles.overlay}>
      <View style={{ gap: space.md, alignItems: 'center', padding: space.xl, maxWidth: 420 }}>
        <H2>{t('common.error')}</H2>
        <Body muted style={{ textAlign: 'center' }}>
          {t('errors.network')}
        </Body>
        <Button title={t('common.retry')} icon="refresh" onPress={retry} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <ToastProvider>
            <StatusBar style="light" />
            <AuthGate />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
