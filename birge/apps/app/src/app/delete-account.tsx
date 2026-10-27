import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth, setPendingHref } from '@/auth/AuthProvider';
import { alertMessage, confirmAsync } from '@/components/dialogs';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Body, Button, Card, ErrorBanner, H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { toErrorCode } from '@/lib/api';
import { colors, font, space } from '@/theme';

/**
 * Google Play талабы: аккаунтты жою жолы қосымшадан тыс, вебте де болуы керек.
 * Бұл бетті Play Console-дағы «Delete account URL» өрісіне көрсетіңіз: https://<домен>/delete-account
 */
export default function DeleteAccountPage() {
  const t = useT();
  const router = useRouter();
  const { status, me, config, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = config?.supportEmail ?? 'support@birge.app';

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('settings.deleteConfirmTitle'),
      message: t('settings.deleteConfirm'),
      confirmText: t('settings.deleteAccount'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAccount();
      alertMessage(t('settings.deleted'));
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={640}>
      <View style={styles.top}>
        <LanguageSwitch />
      </View>
      <H1>{t('deleteAccount.title')}</H1>
      <Body muted>{t('deleteAccount.intro')}</Body>
      <Card>
        <Text style={styles.item}>1. {t('deleteAccount.inApp')}</Text>
        <Text style={styles.item}>2. {t('deleteAccount.web')}</Text>
        <Text style={styles.item}>3. {t('deleteAccount.email', { email })}</Text>
      </Card>
      <Body muted style={{ fontSize: font.small }}>
        {t('deleteAccount.whatDeleted')}
      </Body>
      <ErrorBanner message={error} />
      {status === 'signedIn' && me ? (
        <Button
          testID="web-delete-account"
          variant="danger"
          icon="trash-outline"
          title={t('deleteAccount.button')}
          onPress={() => void remove()}
          loading={busy}
        />
      ) : (
        <Button
          title={t('deleteAccount.signIn')}
          onPress={() => {
            setPendingHref('/delete-account');
            router.push('/sign-in');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  item: { color: colors.text, fontSize: font.body - 1, lineHeight: 22, marginBottom: space.xs },
});
