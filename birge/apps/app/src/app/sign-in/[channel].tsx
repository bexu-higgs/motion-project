import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { formatPhone, OTP_LENGTH, OTP_RESEND_SECONDS, type AuthResult, type OtpChannel } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { Body, Button, ErrorBanner, H1, Screen, TextField } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, font, space } from '@/theme';

export default function ContactSignInScreen() {
  const { channel: raw } = useLocalSearchParams<{ channel: string }>();
  const channel: OtpChannel = raw === 'phone' ? 'phone' : 'email';
  const { t, locale } = useI18n();
  const { completeSignIn, config } = useAuth();
  const [target, setTarget] = useState(channel === 'phone' ? '+7 ' : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ target: string; devCode?: string }>('/api/auth/otp/request', { channel, target, locale });
      setSentTo(res.target);
      setDevCode(res.devCode ?? null);
      setCode('');
      setCooldown(OTP_RESEND_SECONDS);
      setTimeout(() => codeInput.current?.focus(), 100);
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!sentTo || value.length !== OTP_LENGTH) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<AuthResult>('/api/auth/otp/verify', { channel, target: sentTo, code: value, locale });
      await completeSignIn(result);
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setBusy(false);
    }
  };

  const onCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) void verify(digits);
  };

  const title = channel === 'phone' ? t('auth.phoneTitle') : t('auth.emailTitle');
  const display = sentTo ? (channel === 'phone' ? formatPhone(sentTo) : sentTo) : '';

  return (
    <Screen maxWidth={440}>
      <Stack.Screen options={{ title: '' }} />
      {!sentTo ? (
        <>
          <H1>{title}</H1>
          <Body muted>{channel === 'phone' ? t('auth.phoneHint') : t('auth.emailHint')}</Body>
          <TextField
            testID="contact-input"
            value={target}
            onChangeText={setTarget}
            placeholder={channel === 'phone' ? t('auth.phonePlaceholder') : t('auth.emailPlaceholder')}
            keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={channel === 'phone' ? 'tel' : 'email'}
            textContentType={channel === 'phone' ? 'telephoneNumber' : 'emailAddress'}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={() => void requestCode()}
          />
          <ErrorBanner message={error} />
          <Button
            testID="send-code"
            title={t('auth.sendCode')}
            onPress={() => void requestCode()}
            loading={busy}
            disabled={target.trim().length < 5}
          />
        </>
      ) : (
        <>
          <H1>{t('auth.codeTitle')}</H1>
          <View style={styles.sentRow}>
            <Body muted>{t('auth.codeSentTo', { target: display })}</Body>
            <Pressable accessibilityRole="button" onPress={() => setSentTo(null)}>
              <Text style={styles.link}>{t('auth.changeTarget')}</Text>
            </Pressable>
          </View>
          <TextField
            ref={codeInput}
            testID="code-input"
            value={code}
            onChangeText={onCodeChange}
            placeholder={t('auth.codePlaceholder')}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={OTP_LENGTH}
            inputStyle={styles.codeInput}
            autoFocus
          />
          {devCode && config?.devOtp ? <Text style={styles.dev}>{t('auth.devCode', { code: devCode })}</Text> : null}
          <ErrorBanner message={error} />
          <Button
            testID="verify-code"
            title={t('auth.verify')}
            onPress={() => void verify()}
            loading={busy}
            disabled={code.length !== OTP_LENGTH}
          />
          <Button
            variant="ghost"
            title={cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
            disabled={cooldown > 0 || busy}
            onPress={() => void requestCode()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  link: { color: colors.primary, fontWeight: '600', fontSize: font.body },
  codeInput: { fontSize: 28, letterSpacing: 10, textAlign: 'center', fontWeight: '700' },
  dev: { color: colors.warning, fontSize: font.small, textAlign: 'center' },
});
