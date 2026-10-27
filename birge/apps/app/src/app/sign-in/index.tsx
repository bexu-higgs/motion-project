import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { isNativeAppleAvailable, signInWithAppleNative, signInWithOAuth, type OAuthProvider } from '@/auth/social';
import { AppleButton } from '@/components/AppleButton';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LegalLinks } from '@/components/LegalLinks';
import { Body, Button, ErrorBanner, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { toErrorCode } from '@/lib/api';
import { colors, font, space } from '@/theme';

export default function SignInScreen() {
  const { t, locale } = useI18n();
  const { config, completeSignIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nativeApple, setNativeApple] = useState(false);

  useEffect(() => {
    void isNativeAppleAvailable().then(setNativeApple);
  }, []);

  useEffect(() => {
    if (params.error) setError(t(`errors.${toErrorCode(params.error) === 'network' ? 'oauth_failed' : toErrorCode(params.error)}`));
  }, [params.error, t]);

  const providers = config?.providers;
  const appleEnabled = Boolean(providers?.apple);
  // App Store 4.8: iOS-та Google ұсынылса, Sign in with Apple да болуы керек.
  const googleEnabled = Boolean(providers?.google) && (Platform.OS !== 'ios' || (appleEnabled && nativeApple));
  const emailEnabled = providers ? providers.email : true;
  const phoneEnabled = providers ? providers.phone : true;

  const social = async (provider: OAuthProvider) => {
    setError(null);
    setBusy(provider);
    try {
      const result = provider === 'apple' && nativeApple ? await signInWithAppleNative(locale) : await signInWithOAuth(provider, locale);
      if (result) await completeSignIn(result);
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} maxWidth={440}>
      <View style={styles.topBar}>
        <LanguageSwitch />
      </View>
      <View style={styles.hero}>
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.logo}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.brand}>Birge</Text>
        <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
        <Body muted style={styles.subtitle}>
          {t('auth.welcomeSubtitle')}
        </Body>
      </View>

      <View style={styles.buttons}>
        <ErrorBanner message={error} />
        {appleEnabled ? (
          <AppleButton title={t('auth.continueApple')} onPress={() => void social('apple')} loading={busy === 'apple'} />
        ) : null}
        {googleEnabled ? (
          <Button
            testID="sign-in-google"
            variant="light"
            title={t('auth.continueGoogle')}
            icon={<Ionicons name="logo-google" size={18} color="#111" />}
            loading={busy === 'google'}
            onPress={() => void social('google')}
          />
        ) : null}
        {emailEnabled ? (
          <Button
            testID="sign-in-email"
            variant="secondary"
            icon="mail-outline"
            title={t('auth.continueEmail')}
            onPress={() => router.push('/sign-in/email')}
          />
        ) : null}
        {phoneEnabled ? (
          <Button
            testID="sign-in-phone"
            variant="secondary"
            icon="call-outline"
            title={t('auth.continuePhone')}
            onPress={() => router.push('/sign-in/phone')}
          />
        ) : null}
      </View>

      <View style={styles.legal}>
        <Text style={styles.legalText}>{t('auth.legalNote')}</Text>
        <LegalLinks center />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', gap: space.md, marginTop: space.lg },
  logo: { width: 84, height: 84, borderRadius: 22 },
  brand: { color: colors.textMuted, fontSize: font.small, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: font.hero, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, lineHeight: 40 },
  subtitle: { textAlign: 'center', maxWidth: 380 },
  buttons: { gap: space.md, marginTop: space.xl },
  legal: { gap: space.sm, alignItems: 'center', marginTop: 'auto', paddingTop: space.xl },
  legalText: { color: colors.textFaint, fontSize: font.tiny + 1, textAlign: 'center' },
});
