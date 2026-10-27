import { Stack, useRouter } from 'expo-router';
import { Body, Button, H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';

export default function NotFoundScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen maxWidth={440}>
      <Stack.Screen options={{ title: t('errors.not_found') }} />
      <H1>404</H1>
      <Body muted>{t('errors.not_found')}</Body>
      <Button title={t('common.back')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
