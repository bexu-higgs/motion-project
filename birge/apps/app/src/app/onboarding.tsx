import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MIN_AGE, DISPLAY_NAME_MAX_LENGTH, type Me } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LegalLinks } from '@/components/LegalLinks';
import { Body, Button, Checkbox, ErrorBanner, H1, Screen, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { toErrorCode } from '@/lib/api';
import { colors, font, space } from '@/theme';

/** Тіркелгеннен кейін: аты және Пайдалану шарттарын қабылдау (App Store 1.2 талабы). */
export default function OnboardingScreen() {
  const { me } = useAuth();
  return me ? <OnboardingForm key={me.id} me={me} /> : null;
}

function OnboardingForm({ me }: { me: Me }) {
  const t = useT();
  const { updateMe, signOut } = useAuth();
  const [name, setName] = useState(me.displayName);
  const [agreed, setAgreed] = useState(me.termsAccepted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError(t('onboarding.nameTooShort'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateMe({ displayName: name, acceptTerms: true });
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} maxWidth={440}>
      <View style={styles.top}>
        <LanguageSwitch />
      </View>
      <H1>{t('onboarding.title')}</H1>
      <Body muted>{t('onboarding.subtitle')}</Body>
      <TextField
        testID="display-name"
        label={t('onboarding.nameLabel')}
        placeholder={t('onboarding.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        autoComplete="name"
        textContentType="name"
        autoFocus
      />
      <Checkbox testID="accept-terms" checked={agreed} onChange={setAgreed}>
        <Text style={styles.agree}>{t('onboarding.agree', { age: MIN_AGE })}</Text>
      </Checkbox>
      <LegalLinks />
      <ErrorBanner message={error} />
      <Button
        testID="onboarding-submit"
        title={t('onboarding.submit')}
        onPress={() => void submit()}
        loading={busy}
        disabled={!agreed || name.trim().length < 2}
      />
      <Button variant="ghost" title={t('settings.signOut')} onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  agree: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  gap: { gap: space.md },
});
